import { ANALYSIS_MODEL, LANG_NAME, type Lang } from "./config.js";
import { structured } from "./openai.js";
import type { Profile } from "./profile.js";

export type Line = { role: "user" | "assistant"; text: string };

export type Analysis = {
  summary: string;
  mistakes: { said: string; correct: string; pinyin: string; type: "tone" | "word" | "grammar" | "other"; note: string }[];
  pronunciationSuspects: { heard: string; meant: string; pinyin: string; note: string }[];
  newVocab: { word: string; pinyin: string; meaning: string }[];
  ankiCards: { front: string; back: string }[];
  profileUpdates: { level: string; weakSpots: string[]; topicsCovered: string[] };
};

const str = { type: "string" };
const obj = (props: Record<string, object>) => ({
  type: "object",
  properties: props,
  required: Object.keys(props),
  additionalProperties: false,
});
const arr = (items: object) => ({ type: "array", items });

const SCHEMA = obj({
  summary: str,
  mistakes: arr(obj({ said: str, correct: str, pinyin: str, type: { type: "string", enum: ["tone", "word", "grammar", "other"] }, note: str })),
  pronunciationSuspects: arr(obj({ heard: str, meant: str, pinyin: str, note: str })),
  newVocab: arr(obj({ word: str, pinyin: str, meaning: str })),
  ankiCards: arr(obj({ front: str, back: str })),
  profileUpdates: obj({ level: str, weakSpots: arr(str), topicsCovered: arr(str) }),
});

export async function analyze(lang: Lang, lines: Line[], profile: Profile): Promise<Analysis> {
  const L = LANG_NAME[lang];
  const zh = lang === "zh";
  const system = [
    `You review a ${L} speaking-practice session between Roman (the learner) and an AI tutor. Write all explanations in English.`,
    "Roman's lines are automatic speech recognition output, so they may contain words he didn't intend.",
    "",
    "Return:",
    "- summary: exactly 2 sentences on how it went and what to work on.",
    `- mistakes: his real errors (grammar, word choice, ${zh ? "measure words, word order, " : "gender, conjugation, "}English fallbacks). "said" is his words verbatim, "correct" is the natural fix, "note" is a short why. Only real errors or clearly unnatural phrasing a native speaker would notice; skip anything that is already fine. Most important first, max 10. ${zh ? "pinyin = pinyin of the correct version with tone marks." : "pinyin = empty string."} Use type "tone" only for clear tone issues.`,
    zh
      ? "- pronunciationSuspects: places where the transcript shows a word that makes no sense in context, so he probably said the intended word with the wrong tone or sound. heard = what was transcribed, meant = what he probably meant, pinyin = pinyin of meant, note = which syllable/tone was likely off. Only real suspects. This is approximate."
      : "- pronunciationSuspects: places where the transcript shows a word that makes no sense in context, so he probably mispronounced the intended word. heard, meant, pinyin = empty string, note. Only real suspects.",
    `- newVocab: words the tutor used that he probably didn't know (he asked, hesitated, or misunderstood). ${zh ? "pinyin with tone marks." : "pinyin = empty string."} Max 8.`,
    `- ankiCards: 3 to 6 sentence cards from his mistakes and new words. front = a short English prompt of a full sentence; back = the natural ${L} sentence${zh ? ", then a line break, then its pinyin" : ""}. Use <br> for line breaks.`,
    "- profileUpdates: level = a short level estimate (e.g. \"HSK 3, weak on measure words\" or \"B1\"). weakSpots = 1 to 5 recurring weak points as short reusable labels; reuse an existing label exactly when it matches. topicsCovered = 1 to 4 short topic labels.",
  ].join("\n");

  const user = [
    `Existing weak-spot labels: ${profile.weakSpots.map((w) => w.item).join("; ") || "(none)"}`,
    `Previous level estimate: ${profile.level || "(none)"}`,
    "",
    "Transcript:",
    ...lines.map((l) => `${l.role === "user" ? "Roman" : "Tutor"}: ${l.text}`),
  ].join("\n");

  return structured<Analysis>({ model: ANALYSIS_MODEL, effort: "low", system, user, name: "session_analysis", schema: SCHEMA });
}
