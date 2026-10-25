import { useEffect, useState } from "react";
import { Call } from "./components/Call";
import { Results } from "./components/Results";
import { Start } from "./components/Start";
import type { Analysis, CallResult, Config, Setup } from "./types";

type Screen =
  | { name: "start"; notice?: string }
  | { name: "call"; setup: Setup }
  | { name: "analyzing"; setup: Setup; result: CallResult; error?: string }
  | { name: "results"; setup: Setup; analysis: Analysis };

export function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [loadError, setLoadError] = useState("");
  const [screen, setScreen] = useState<Screen>({ name: "start" });

  const loadConfig = () =>
    fetch("/api/config")
      .then((r) => r.json())
      .then(setConfig)
      .catch(() => setLoadError("Can't reach the local server. Is `npm run dev` running?"));

  useEffect(() => {
    loadConfig();
  }, []);

  async function runAnalysis(setup: Setup, result: CallResult) {
    setScreen({ name: "analyzing", setup, result });
    try {
      const r = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ lang: setup.lang, level: setup.level, label: setup.label, ...result }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "Analysis failed");
      setScreen({ name: "results", setup, analysis: j });
      loadConfig();
    } catch (err) {
      setScreen({ name: "analyzing", setup, result, error: (err as Error).message });
    }
  }

  if (loadError) return <Centered title="Offline" body={loadError} />;
  if (!config) return <Centered title="" body="" />;

  switch (screen.name) {
    case "start":
      return <Start config={config} notice={screen.notice} onStart={(setup) => setScreen({ name: "call", setup })} />;
    case "call":
      return (
        <Call
          setup={screen.setup}
          config={config}
          onEnd={(result) =>
            result.lines.some((l) => l.role === "user")
              ? runAnalysis(screen.setup, result)
              : setScreen({ name: "start", notice: "Session ended before you said anything, so nothing was logged." })
          }
          onError={(msg) => setScreen({ name: "start", notice: msg })}
        />
      );
    case "analyzing":
      return screen.error ? (
        <Centered title="Analysis failed" body={screen.error}>
          <div className="row">
            <button className="btn primary" onClick={() => runAnalysis(screen.setup, screen.result)}>
              Retry
            </button>
            <button className="btn" onClick={() => setScreen({ name: "start" })}>
              Discard
            </button>
          </div>
        </Centered>
      ) : (
        <Centered title="Reviewing your session" body="Logging mistakes, writing cards, updating your profile.">
          <div className="pulse" />
        </Centered>
      );
    case "results":
      return (
        <Results
          setup={screen.setup}
          analysis={screen.analysis}
          onPractice={() =>
            setScreen({
              name: "call",
              setup: {
                lang: screen.setup.lang,
                level: screen.setup.level,
                mode: "review",
                minutes: 5,
                focus: screen.analysis.mistakes.map(({ said, correct }) => ({ said, correct })),
                label: "Review drill",
              },
            })
          }
          onDone={() => setScreen({ name: "start" })}
        />
      );
  }
}

function Centered({ title, body, children }: { title: string; body: string; children?: React.ReactNode }) {
  return (
    <main className="page centered">
      {title && <h1 className="title">{title}</h1>}
      {body && <p className="muted">{body}</p>}
      {children}
    </main>
  );
}
