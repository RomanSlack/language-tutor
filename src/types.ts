export type Lang = "zh" | "es";
export type Mode = "theme" | "free" | "roleplay" | "review";

export type Scenario = { id: string; title: string; subtitle: string; difficulty: number };

export type Rates = { textIn: number; textCached: number; textOut: number; audioIn: number; audioCached: number; audioOut: number };

export type ProfileBrief = { sessions: number; minutes: number; level: string; lastSession: string | null; weakSpots: string[] };

export type Config = {
  theme: { week: number; theme: string | null };
  scenarios: Record<Lang, Scenario[]>;
  model: string;
  rates: Rates;
  profiles: Record<Lang, ProfileBrief>;
};

export type Setup = {
  lang: Lang;
  mode: Mode;
  minutes: number;
  scenarioId?: string;
  focus?: { said: string; correct: string }[];
  label: string;
};

export type Line = { role: "user" | "assistant"; text: string };

export type CallResult = { lines: Line[]; seconds: number; cost: number };

export type Mistake = { said: string; correct: string; pinyin: string; type: string; note: string };

export type Analysis = {
  summary: string;
  mistakes: Mistake[];
  pronunciationSuspects: { heard: string; meant: string; pinyin: string; note: string }[];
  newVocab: { word: string; pinyin: string; meaning: string }[];
  ankiCards: { front: string; back: string }[];
  saved: { errorLog: string; sessionFile: string; cards: { via: "anki" | "tsv"; added: number; where: string } };
};
