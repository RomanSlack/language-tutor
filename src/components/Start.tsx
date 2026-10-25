import { useState } from "react";
import type { Config, Lang, Mode, Setup } from "../types";

const LANGS: { id: Lang; label: string; sub: string }[] = [
  { id: "zh", label: "中文", sub: "Mandarin" },
  { id: "es", label: "Español", sub: "Spanish" },
];

const MODES: { id: Exclude<Mode, "review">; label: string }[] = [
  { id: "theme", label: "This week" },
  { id: "free", label: "Free chat" },
  { id: "roleplay", label: "Role-play" },
];

const LENGTHS = [10, 15, 20];

export function Start({ config, notice, onStart }: { config: Config; notice?: string; onStart: (s: Setup) => void }) {
  const [lang, setLang] = useState<Lang>(() => (localStorage.getItem("lang") as Lang) || "zh");
  const [mode, setMode] = useState<Exclude<Mode, "review">>(config.theme.theme ? "theme" : "free");
  const [minutes, setMinutes] = useState(10);
  const scenarios = config.scenarios[lang];
  const [scenarioId, setScenarioId] = useState(scenarios[0]?.id);
  const profile = config.profiles[lang];

  const pickLang = (l: Lang) => {
    setLang(l);
    localStorage.setItem("lang", l);
    setScenarioId(config.scenarios[l][0]?.id);
  };

  const scenario = scenarios.find((s) => s.id === scenarioId);
  const label =
    mode === "theme"
      ? `Week ${config.theme.week}: ${config.theme.theme}`
      : mode === "roleplay"
        ? `Role-play: ${scenario?.subtitle}`
        : "Free chat";

  return (
    <main className="page">
      <header className="top">
        <span className="wordmark">
          <i className="dot" /> Tutor
        </span>
        <span className="muted small">
          {profile.sessions ? `${profile.sessions} ${profile.sessions === 1 ? "session" : "sessions"} · ${Math.round(profile.minutes)} min` : "No sessions yet"}
        </span>
      </header>

      {notice && <p className="notice">{notice}</p>}

      <section className="field">
        <div className="seg big">
          {LANGS.map((l) => (
            <button key={l.id} className={lang === l.id ? "on" : ""} onClick={() => pickLang(l.id)}>
              <span className="seg-main">{l.label}</span>
              <span className="seg-sub">{l.sub}</span>
            </button>
          ))}
        </div>
      </section>

      <section className="field">
        <label className="label">Mode</label>
        <div className="seg">
          {MODES.map((m) => (
            <button
              key={m.id}
              className={mode === m.id ? "on" : ""}
              disabled={m.id === "theme" && !config.theme.theme}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>

        {mode === "theme" && (
          <div className="panel">
            <span className="kicker">Week {config.theme.week}</span>
            <p className="theme">{config.theme.theme}</p>
          </div>
        )}
        {mode === "free" && (
          <div className="panel">
            <p className="muted">Open conversation. The tutor follows what you want to talk about.</p>
          </div>
        )}
        {mode === "roleplay" && (
          <ul className="list">
            {scenarios.map((s) => (
              <li key={s.id}>
                <button className={s.id === scenarioId ? "on" : ""} onClick={() => setScenarioId(s.id)}>
                  <span className="list-main">{s.title}</span>
                  <span className="list-sub">{s.subtitle}</span>
                  <span className="pips" aria-label={`difficulty ${s.difficulty} of 4`}>
                    {[1, 2, 3, 4].map((n) => (
                      <i key={n} className={n <= s.difficulty ? "on" : ""} />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="field">
        <label className="label">Length</label>
        <div className="seg">
          {LENGTHS.map((n) => (
            <button key={n} className={minutes === n ? "on" : ""} onClick={() => setMinutes(n)}>
              {n} min
            </button>
          ))}
        </div>
      </section>

      <button className="btn primary start" onClick={() => onStart({ lang, mode, minutes, scenarioId, label })}>
        Start
      </button>

      <footer className="foot">
        {profile.weakSpots.length > 0 && (
          <p>
            <span className="faint">Working on</span> {profile.weakSpots.join(" · ")}
          </p>
        )}
        <p className="faint">
          {config.model}
          {profile.level && ` · level ${profile.level}`}
        </p>
      </footer>
    </main>
  );
}
