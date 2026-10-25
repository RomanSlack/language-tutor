import fs from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "./config.js";

const WEEK_ONE = new Date(2026, 9, 26); // Monday Oct 26, 2026 (local time)
const DAY = 86_400_000;

// Weeks since the plan started (1-based, never below 1). Used for difficulty.
export function weeksIn(today = new Date()): number {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((start.getTime() - WEEK_ONE.getTime()) / DAY);
  return days < 0 ? 1 : Math.floor(days / 7) + 1;
}

// Parses the "Weekly themes" table in DAILY.md.
export async function readThemes(): Promise<Map<number, string>> {
  const themes = new Map<number, string>();
  let md = "";
  try {
    md = await fs.readFile(path.join(DATA_DIR, "DAILY.md"), "utf8");
  } catch {
    return themes;
  }
  const section = md.split(/^## Weekly themes.*$/m)[1]?.split(/^## /m)[0] ?? "";
  for (const line of section.split("\n")) {
    const m = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$/);
    if (m) themes.set(Number(m[1]), m[2]);
  }
  return themes;
}

export async function currentTheme(): Promise<{ week: number; theme: string | null }> {
  const themes = await readThemes();
  const week = weeksIn();
  if (themes.size === 0) return { week, theme: null };
  const cycled = ((week - 1) % themes.size) + 1;
  return { week: cycled, theme: themes.get(cycled) ?? null };
}
