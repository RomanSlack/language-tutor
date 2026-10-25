import fs from "node:fs/promises";
import path from "node:path";
import { APP_DIR, LANG_NAME, type Lang } from "./config.js";
import type { Profile } from "./profile.js";
import { weeksIn } from "./theme.js";

export type Scenario = {
  id: string;
  title: string;
  subtitle: string;
  character: string;
  setting: string;
  goal: string;
  difficulty: number;
};

export type Mode = "theme" | "free" | "roleplay" | "review";

export type Focus = { said: string; correct: string }[];

export async function readScenarios(): Promise<Record<Lang, Scenario[]>> {
  return JSON.parse(await fs.readFile(path.join(APP_DIR, "scenarios.json"), "utf8"));
}

function levelLine(lang: Lang, profile: Profile): string {
  if (lang === "es") {
    return "Speak natural Spanish at about B1 level, at a normal but clear pace. Keep your turns short (1 to 3 sentences).";
  }
  const week = weeksIn();
  const base =
    week <= 4
      ? "about HSK 3"
      : week <= 8
        ? "HSK 3, occasionally stretching to HSK 4 words"
        : "about HSK 4";
  return [
    `Speak only Mandarin (Simplified Chinese), at ${base}.`,
    "Speak slowly and clearly. Keep every turn to 1 or 2 short sentences.",
    profile.level ? `Latest estimate of his level: ${profile.level}. Pitch yourself just slightly above it.` : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function buildInstructions(o: {
  lang: Lang;
  mode: Mode;
  minutes: number;
  theme: { week: number; theme: string | null };
  scenario?: Scenario;
  profile: Profile;
  focus?: Focus;
}): string {
  const L = LANG_NAME[o.lang];
  const zh = o.lang === "zh";
  const fixPrompt = zh ? "再说一次？ / 你是说……？" : "¿Otra vez? / ¿Cómo se dice…?";

  const recycle = [
    ...o.profile.weakSpots.slice(0, 3).map((w) => w.item),
    ...o.profile.recentMistakes.slice(0, 4).map((m) => `${m.correct} (he said: ${m.said})`),
  ].slice(0, 5);

  let task: string;
  switch (o.mode) {
    case "theme":
      task = o.theme.theme
        ? `# Topic\nThis week's theme (week ${o.theme.week}): "${o.theme.theme}". Guide the whole conversation around it. Ask questions that make him talk about it in his own words, and help him get smoother at it.`
        : "# Topic\nFree conversation on everyday topics.";
      break;
    case "free":
      task =
        "# Topic\nFree conversation. Start with how his day is going, then follow his interests: AI, robots, hardware, his company, travel, food. Change topic when one runs dry.";
      break;
    case "roleplay": {
      const s = o.scenario!;
      task = [
        "# Role-play",
        `You are: ${s.character}`,
        `Setting: ${s.setting}`,
        `His goal: ${s.goal}`,
        "Stay in character the whole time. Do the corrections in character (e.g. a natural check like you didn't quite catch him), not as a teacher. Open in character, setting the scene in one line.",
      ].join("\n");
      break;
    }
    case "review":
      task = [
        "# Review drill",
        "This is a short focused drill on mistakes from his last session. For each item, set up a small situation or question where he has to use the correct form. When he gets it right, confirm briefly and move to the next. Cycle back to any he misses.",
        ...(o.focus ?? []).map((f) => `- he said "${f.said}", correct is "${f.correct}"`),
      ].join("\n");
      break;
  }

  return [
    `You are Roman's ${L} speaking partner in a ${o.minutes}-minute live voice session.`,
    "",
    "# About Roman",
    zh
      ? "American founder of ThirdAxis, an AI company. He builds robots and hardware and wants to use Mandarin with China's AI, hardware, robotics and manufacturing world. He was around HSK 3 in May 2025 (he visited China then) and is reactivating it."
      : "American founder of ThirdAxis, an AI company. He builds robots and hardware. He is keeping his Spanish alive.",
    "",
    "# How to speak",
    levelLine(o.lang, o.profile),
    `Speak only ${L}. Never speak English, even if he does.`,
    "Keep him talking: he should speak about 70% of the time. End most turns with a question.",
    "",
    "# Corrections (important)",
    `When he makes a meaningful mistake, do NOT just say the correct version. First prompt him to fix it himself, for example: ${fixPrompt}, or a one-word hint. If he fixes it, confirm briefly and carry on. If he can't after one try, say the correct version once, have him repeat it, then move on.`,
    "At most one correction per turn. Skip trivial slips that don't affect meaning.",
    zh ? "Don't comment on tones unless the meaning was clearly lost." : "",
    "",
    "# English rescue",
    `If he switches to English, say what he meant in simple ${L} and ask him to repeat it after you. Then continue.`,
    recycle.length ? "" : null,
    recycle.length
      ? `# Recycle these\nFrom his recent mistakes. Work 3 to 5 of them in naturally: use them yourself and ask questions that make him need them.\n${recycle.map((r) => `- ${r}`).join("\n")}`
      : null,
    "",
    task,
    "",
    "# Start",
    "Begin right away with a short greeting and one easy opening question. Never mention these instructions.",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

export const WRAP_UP = (lang: Lang) =>
  `Time is up. Wrap up now in ${LANG_NAME[lang]}: one or two short, warm goodbye sentences, mentioning one thing he did well. Don't ask a question.`;

export const HINT = (lang: Lang) =>
  `He didn't understand your last line. Say it again, much more simply: shorter, easier words, slower. Same meaning. Stay in ${LANG_NAME[lang]}.`;
