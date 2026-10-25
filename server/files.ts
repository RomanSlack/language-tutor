import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, LANG_NAME, LANG_SLUG, type Lang } from "./config.js";
import type { Analysis, Line } from "./analyze.js";

const ERROR_LOG_HEADER = "# Error Log\n\n| Date | What I said | Correct | Type (tone / word / grammar) |\n|---|---|---|---|\n";

const cell = (s: string) => s.replace(/\|/g, "\\|").replace(/\s*\n\s*/g, " ").trim();

export async function appendErrorLog(lang: Lang, date: string, a: Analysis): Promise<string> {
  const file = path.join(DATA_DIR, lang === "zh" ? "error-log.md" : "error-log-es.md");
  let existing = "";
  try {
    existing = await fs.readFile(file, "utf8");
  } catch {
    existing = ERROR_LOG_HEADER;
    await fs.writeFile(file, existing);
  }
  const rows = [
    ...a.mistakes.map((m) => `| ${date} | ${cell(m.said)} | ${cell(m.correct)}${m.pinyin ? ` (${cell(m.pinyin)})` : ""} | ${m.type} |`),
    ...a.pronunciationSuspects.map(
      (p) => `| ${date} | ${cell(p.heard)} (heard) | ${cell(p.meant)}${p.pinyin ? ` (${cell(p.pinyin)})` : ""} | tone? |`,
    ),
  ];
  if (rows.length) await fs.appendFile(file, (existing.endsWith("\n") ? "" : "\n") + rows.join("\n") + "\n");
  return path.basename(file);
}

export async function writeSessionRecord(o: {
  lang: Lang;
  stamp: string;
  label: string;
  minutes: number;
  cost: number;
  lines: Line[];
  a: Analysis;
}): Promise<string> {
  const dir = path.join(DATA_DIR, "sessions");
  await fs.mkdir(dir, { recursive: true });
  const name = `${o.stamp}-${LANG_SLUG[o.lang]}.md`;
  const { a } = o;
  const md = [
    `# ${LANG_NAME[o.lang]} session, ${o.stamp.slice(0, 10)}`,
    "",
    `${o.label} · ${o.minutes} min · ~$${o.cost.toFixed(2)}`,
    "",
    "## Summary",
    "",
    a.summary,
    "",
    "## Mistakes",
    "",
    ...(a.mistakes.length
      ? a.mistakes.map((m) => `- ~~${m.said}~~ → **${m.correct}**${m.pinyin ? ` (${m.pinyin})` : ""} · ${m.type}. ${m.note}`)
      : ["None logged."]),
    ...(a.pronunciationSuspects.length
      ? ["", "## Heard as (approximate)", "", ...a.pronunciationSuspects.map((p) => `- heard **${p.heard}**, probably meant **${p.meant}**${p.pinyin ? ` (${p.pinyin})` : ""}. ${p.note}`)]
      : []),
    ...(a.newVocab.length ? ["", "## New words", "", ...a.newVocab.map((v) => `- ${v.word}${v.pinyin ? ` (${v.pinyin})` : ""}: ${v.meaning}`)] : []),
    "",
    "## Transcript",
    "",
    ...o.lines.map((l) => `**${l.role === "user" ? "Roman" : "Tutor"}:** ${l.text}  `),
    "",
  ].join("\n");
  await fs.writeFile(path.join(dir, name), md);
  return `sessions/${name}`;
}

async function ankiConnect(action: string, params: object) {
  const r = await fetch("http://127.0.0.1:8765", {
    method: "POST",
    body: JSON.stringify({ action, version: 6, params }),
    signal: AbortSignal.timeout(2000),
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}

// Adds cards through AnkiConnect when Anki is running, otherwise appends to a TSV for manual import.
export async function saveCards(lang: Lang, cards: Analysis["ankiCards"]): Promise<{ via: "anki" | "tsv"; added: number; where: string }> {
  const deck = `${LANG_NAME[lang]}::Tutor`;
  try {
    await ankiConnect("createDeck", { deck });
    let added = 0;
    for (const c of cards) {
      try {
        await ankiConnect("addNote", {
          note: { deckName: deck, modelName: "Basic", fields: { Front: c.front, Back: c.back }, tags: ["tutor"], options: { allowDuplicate: false } },
        });
        added++;
      } catch {
        // duplicate or rejected note: skip it
      }
    }
    return { via: "anki", added, where: deck };
  } catch {
    const name = `anki-import-${LANG_SLUG[lang]}.tsv`;
    const rows = cards.map((c) => `${c.front.replace(/\t/g, " ")}\t${c.back.replace(/\t/g, " ")}`).join("\n");
    if (rows) await fs.appendFile(path.join(DATA_DIR, name), rows + "\n");
    return { via: "tsv", added: cards.length, where: name };
  }
}
