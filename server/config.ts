import path from "node:path";
import { fileURLToPath } from "node:url";

export type Lang = "zh" | "es";

export const APP_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const DATA_DIR = path.resolve(APP_DIR, process.env.DATA_DIR ?? "..");

export const OPENAI_API_KEY = process.env.OPENAI_API_KEY ?? "";
export const REALTIME_MODEL = process.env.REALTIME_MODEL ?? "gpt-realtime-2.1";
export const TRANSCRIBE_MODEL = process.env.TRANSCRIBE_MODEL ?? "gpt-transcribe";
export const ANALYSIS_MODEL = process.env.ANALYSIS_MODEL ?? "gpt-5.5";
export const FAST_MODEL = process.env.FAST_MODEL ?? "gpt-5.4-mini";
export const VOICE = process.env.VOICE ?? "marin";
export const PORT = Number(process.env.PORT ?? 8787);
export const DEV = process.env.NODE_ENV !== "production";

export const LANG_NAME: Record<Lang, string> = { zh: "Mandarin", es: "Spanish" };
export const LANG_SLUG: Record<Lang, string> = { zh: "mandarin", es: "spanish" };

// USD per 1M tokens. Third-party estimates, not official: check openai.com/api/pricing.
export const PRICES: Record<string, Rates> = {
  "gpt-realtime-2.1": { textIn: 4, textCached: 0.4, textOut: 24, audioIn: 32, audioCached: 0.4, audioOut: 64 },
  "gpt-realtime-2.1-mini": { textIn: 0.6, textCached: 0.06, textOut: 2.4, audioIn: 10, audioCached: 0.3, audioOut: 20 },
};

export type Rates = {
  textIn: number;
  textCached: number;
  textOut: number;
  audioIn: number;
  audioCached: number;
  audioOut: number;
};
