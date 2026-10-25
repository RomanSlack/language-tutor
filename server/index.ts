import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import express from "express";
import {
  DATA_DIR,
  DEV,
  FAST_MODEL,
  LANG_NAME,
  LANG_SLUG,
  OPENAI_API_KEY,
  PORT,
  PRICES,
  REALTIME_MODEL,
  TRANSCRIBE_MODEL,
  VOICE,
  type Lang,
} from "./config.js";
import { analyze, type Line } from "./analyze.js";
import { appendErrorLog, saveCards, writeSessionRecord } from "./files.js";
import { structured } from "./openai.js";
import { readProfile, updateProfile } from "./profile.js";
import { buildInstructions, HINT, readScenarios, WRAP_UP, type Focus, type Mode } from "./prompt.js";
import { currentTheme } from "./theme.js";

if (!OPENAI_API_KEY) {
  console.error("OPENAI_API_KEY is missing. Put it in tutor/.env");
  process.exit(1);
}

const app = express();
app.use(express.json({ limit: "2mb" }));

const isLang = (l: unknown): l is Lang => l === "zh" || l === "es";
const pad = (n: number) => String(n).padStart(2, "0");
const localDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

app.get("/api/config", async (_req, res) => {
  const [theme, scenarios, zh, es] = await Promise.all([currentTheme(), readScenarios(), readProfile("zh"), readProfile("es")]);
  const brief = (p: typeof zh) => ({
    sessions: p.sessions,
    minutes: p.minutes,
    level: p.level,
    lastSession: p.lastSession,
    weakSpots: p.weakSpots.slice(0, 3).map((w) => w.item),
  });
  res.json({
    theme,
    scenarios,
    model: REALTIME_MODEL,
    rates: PRICES[REALTIME_MODEL] ?? PRICES["gpt-realtime-2.1"],
    profiles: { zh: brief(zh), es: brief(es) },
  });
});

// Builds the session instructions, then forwards the browser's SDP offer to OpenAI.
app.post("/api/call", async (req, res) => {
  const { sdp, lang, mode, scenarioId, minutes, focus } = req.body as {
    sdp: string;
    lang: Lang;
    mode: Mode;
    scenarioId?: string;
    minutes: number;
    focus?: Focus;
  };
  if (!sdp || !isLang(lang)) return void res.status(400).json({ error: "Bad request" });

  const [theme, scenarios, profile] = await Promise.all([currentTheme(), readScenarios(), readProfile(lang)]);
  const scenario = scenarios[lang].find((s) => s.id === scenarioId);
  if (mode === "roleplay" && !scenario) return void res.status(400).json({ error: "Unknown scenario" });

  const instructions = buildInstructions({ lang, mode, minutes, theme, scenario, profile, focus });
  if (DEV) {
    console.log(`\n--- instructions (${LANG_NAME[lang]}, ${mode}) ---\n${instructions}\n---\n`);
    const dir = path.join(DATA_DIR, "tutor-data");
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, `last-instructions-${LANG_SLUG[lang]}.txt`), instructions + "\n");
  }

  const session = {
    type: "realtime",
    model: REALTIME_MODEL,
    instructions,
    audio: {
      input: {
        noise_reduction: { type: "near_field" },
        transcription: {
          model: TRANSCRIBE_MODEL,
          languages: [lang, "en"],
          prompt: `A learner practising ${LANG_NAME[lang]}, sometimes switching to English. Transcribe exactly what is said, including mistakes and wrong words. Do not correct anything.`,
        },
        turn_detection: { type: "semantic_vad", eagerness: "low" },
      },
      output: { voice: VOICE, speed: lang === "zh" ? 0.9 : 1 },
    },
  };

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(session));
  try {
    const r = await fetch("https://api.openai.com/v1/realtime/calls", {
      method: "POST",
      headers: { Authorization: `Bearer ${OPENAI_API_KEY}` },
      body: form,
    });
    const answer = await r.text();
    if (!r.ok) {
      console.error("Realtime call failed:", answer);
      return void res.status(502).json({ error: `OpenAI: ${answer.slice(0, 300)}` });
    }
    res.json({ sdp: answer, wrapUp: WRAP_UP(lang), hint: HINT(lang), instructions: DEV ? instructions : undefined });
  } catch (err) {
    console.error(err);
    res.status(502).json({ error: "Could not reach OpenAI" });
  }
});

app.post("/api/translate", async (req, res) => {
  const { text } = req.body as { text: string };
  try {
    const out = await structured<{ en: string }>({
      model: FAST_MODEL,
      effort: "none",
      system: "Translate the line into natural, plain English. Translation only.",
      user: text,
      name: "translation",
      schema: { type: "object", properties: { en: { type: "string" } }, required: ["en"], additionalProperties: false },
    });
    res.json(out);
  } catch (err) {
    res.status(502).json({ error: (err as Error).message });
  }
});

// Runs after a session: analysis, error log, session file, Anki, profile.
app.post("/api/analyze", async (req, res) => {
  const { lang, label, lines, seconds, cost } = req.body as {
    lang: Lang;
    label: string;
    lines: Line[];
    seconds: number;
    cost: number;
  };
  if (!isLang(lang)) return void res.status(400).json({ error: "Bad request" });
  if (!lines?.some((l) => l.role === "user" && l.text.trim())) {
    return void res.status(400).json({ error: "Nothing to analyse: you didn't say anything." });
  }

  try {
    const now = new Date();
    const date = localDate(now);
    const stamp = `${date}-${pad(now.getHours())}${pad(now.getMinutes())}`;
    const minutes = Math.round((seconds / 60) * 10) / 10;

    const profile = await readProfile(lang);
    const a = await analyze(lang, lines, profile);
    const [errorLog, sessionFile, cards] = await Promise.all([
      appendErrorLog(lang, date, a),
      writeSessionRecord({ lang, stamp, label, minutes, cost, lines, a }),
      saveCards(lang, a.ankiCards),
    ]);
    await updateProfile(lang, date, minutes, a.mistakes, a.profileUpdates);

    res.json({ ...a, saved: { errorLog, sessionFile, cards } });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, "127.0.0.1", () => console.log(`tutor server on http://127.0.0.1:${PORT} (data: ${DATA_DIR})`));
