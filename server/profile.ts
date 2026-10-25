import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR, LANG_SLUG, type Lang } from "./config.js";

export type Profile = {
  level: string;
  sessions: number;
  minutes: number;
  lastSession: string | null;
  weakSpots: { item: string; count: number; lastSeen: string }[];
  recentMistakes: { said: string; correct: string; type: string; date: string }[];
  topicsCovered: string[];
};

const file = (lang: Lang) => path.join(DATA_DIR, "tutor-data", `profile-${LANG_SLUG[lang]}.json`);

export async function readProfile(lang: Lang): Promise<Profile> {
  try {
    return JSON.parse(await fs.readFile(file(lang), "utf8"));
  } catch {
    return { level: "", sessions: 0, minutes: 0, lastSession: null, weakSpots: [], recentMistakes: [], topicsCovered: [] };
  }
}

export async function updateProfile(
  lang: Lang,
  date: string,
  minutes: number,
  mistakes: { said: string; correct: string; type: string }[],
  updates: { level: string; weakSpots: string[]; topicsCovered: string[] },
): Promise<Profile> {
  const p = await readProfile(lang);
  p.sessions += 1;
  p.minutes = Math.round((p.minutes + minutes) * 10) / 10;
  p.lastSession = date;
  if (updates.level) p.level = updates.level;

  for (const item of updates.weakSpots) {
    const hit = p.weakSpots.find((w) => w.item.toLowerCase() === item.toLowerCase());
    if (hit) {
      hit.count += 1;
      hit.lastSeen = date;
    } else {
      p.weakSpots.push({ item, count: 1, lastSeen: date });
    }
  }
  p.weakSpots.sort((a, b) => b.count - a.count || b.lastSeen.localeCompare(a.lastSeen));
  p.weakSpots = p.weakSpots.slice(0, 25);

  p.recentMistakes = [...mistakes.map((m) => ({ ...m, date })), ...p.recentMistakes].slice(0, 30);
  p.topicsCovered = [...new Set([...updates.topicsCovered, ...p.topicsCovered])].slice(0, 40);

  await fs.mkdir(path.dirname(file(lang)), { recursive: true });
  await fs.writeFile(file(lang), JSON.stringify(p, null, 2) + "\n");
  return p;
}
