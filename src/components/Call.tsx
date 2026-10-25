import { useEffect, useRef, useState } from "react";
import type { CallResult, Config, Rates, Setup } from "../types";
import { Hanzi } from "./Hanzi";

type Item = { id: string; role: "user" | "assistant"; text: string; done: boolean };
type Status = "connecting" | "listening" | "user" | "tutor" | "wrapping";

type Usage = {
  input_token_details?: {
    text_tokens?: number;
    audio_tokens?: number;
    cached_tokens_details?: { text_tokens?: number; audio_tokens?: number };
  };
  output_token_details?: { text_tokens?: number; audio_tokens?: number };
};

function costOf(u: Usage, r: Rates): number {
  const i = u.input_token_details ?? {};
  const c = i.cached_tokens_details ?? {};
  const o = u.output_token_details ?? {};
  const textIn = (i.text_tokens ?? 0) - (c.text_tokens ?? 0);
  const audioIn = (i.audio_tokens ?? 0) - (c.audio_tokens ?? 0);
  return (
    (textIn * r.textIn +
      (c.text_tokens ?? 0) * r.textCached +
      audioIn * r.audioIn +
      (c.audio_tokens ?? 0) * r.audioCached +
      (o.text_tokens ?? 0) * r.textOut +
      (o.audio_tokens ?? 0) * r.audioOut) /
    1e6
  );
}

const clock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

const STATUS_TEXT: Record<Status, string> = {
  connecting: "Connecting",
  listening: "Your turn",
  user: "Listening",
  tutor: "Tutor speaking",
  wrapping: "Wrapping up",
};

export function Call({
  setup,
  config,
  onEnd,
  onError,
}: {
  setup: Setup;
  config: Config;
  onEnd: (r: CallResult) => void;
  onError: (msg: string) => void;
}) {
  const zh = setup.lang === "zh";
  const [items, setItems] = useState<Item[]>([]);
  const [status, setStatus] = useState<Status>("connecting");
  const [elapsed, setElapsed] = useState(0);
  const [cost, setCost] = useState(0);
  const [showPinyin, setShowPinyin] = useState(() => localStorage.getItem("pinyin") !== "off");
  const [translations, setTranslations] = useState<Record<string, string>>({});
  const [translating, setTranslating] = useState(false);
  const [busy, setBusy] = useState(false); // a tutor response is in progress
  const scroller = useRef<HTMLDivElement>(null);

  // Mutable call state shared by event handlers.
  const s = useRef({
    pc: null as RTCPeerConnection | null,
    dc: null as RTCDataChannel | null,
    stream: null as MediaStream | null,
    audio: null as HTMLAudioElement | null,
    wrapUp: "",
    hint: "",
    startedAt: 0,
    cost: 0,
    items: [] as Item[],
    responding: false,
    tutorSpeaking: false,
    phase: "live" as "live" | "wrapping" | "goodbye-done" | "ended",
    wrapQueued: false,
    elapsed: 0,
  }).current;

  const send = (ev: object) => s.dc?.readyState === "open" && s.dc.send(JSON.stringify(ev));

  const commit = (next: Item[]) => {
    s.items = next;
    setItems(next);
  };

  const patch = (id: string, role: Item["role"], fn: (t: string) => string, done = false) => {
    const idx = s.items.findIndex((it) => it.id === id);
    if (idx === -1) {
      commit([...s.items, { id, role, text: fn(""), done }]);
    } else {
      const next = s.items.slice();
      next[idx] = { ...next[idx], text: fn(next[idx].text), done: done || next[idx].done };
      commit(next);
    }
  };

  const cleanup = () => {
    s.stream?.getTracks().forEach((t) => t.stop());
    s.dc?.close();
    s.pc?.close();
    if (s.audio) s.audio.srcObject = null;
  };

  const finish = () => {
    if (s.phase === "ended") return;
    s.phase = "ended";
    cleanup();
    onEnd({
      lines: s.items.filter((it) => it.text.trim()).map(({ role, text }) => ({ role, text: text.trim() })),
      seconds: Math.round(s.elapsed),
      cost: s.cost,
    });
  };

  const sendGoodbye = () => {
    s.wrapQueued = false;
    send({ type: "response.create", response: { instructions: s.wrapUp } });
    setTimeout(finish, 25_000); // safety net if the goodbye never finishes
  };

  const wrap = () => {
    if (s.phase !== "live") return;
    s.phase = "wrapping";
    setStatus("wrapping");
    // Stop the tutor from replying to anything said after this point.
    send({
      type: "session.update",
      session: {
        type: "realtime",
        audio: { input: { turn_detection: { type: "semantic_vad", eagerness: "low", create_response: false, interrupt_response: false } } },
      },
    });
    if (s.responding) s.wrapQueued = true;
    else sendGoodbye();
  };

  const handle = (ev: any) => {
    switch (ev.type) {
      case "conversation.item.added":
      case "conversation.item.created": {
        const it = ev.item;
        if (it?.type === "message" && (it.role === "user" || it.role === "assistant")) patch(it.id, it.role, (t) => t);
        break;
      }
      case "conversation.item.input_audio_transcription.delta":
        patch(ev.item_id, "user", (t) => t + ev.delta);
        break;
      case "conversation.item.input_audio_transcription.completed":
        patch(ev.item_id, "user", () => ev.transcript ?? "", true);
        break;
      case "conversation.item.input_audio_transcription.failed":
        patch(ev.item_id, "user", (t) => t, true);
        break;
      case "response.output_audio_transcript.delta":
        patch(ev.item_id, "assistant", (t) => t + ev.delta);
        break;
      case "response.output_audio_transcript.done":
        patch(ev.item_id, "assistant", () => ev.transcript ?? "", true);
        break;
      case "response.created":
        s.responding = true;
        setBusy(true);
        break;
      case "response.done":
        s.responding = false;
        setBusy(false);
        if (ev.response?.usage) {
          s.cost += costOf(ev.response.usage, config.rates);
          setCost(s.cost);
        }
        if (s.wrapQueued) sendGoodbye();
        else if (s.phase === "wrapping") {
          s.phase = "goodbye-done";
          if (!s.tutorSpeaking) setTimeout(finish, 800);
        }
        break;
      case "input_audio_buffer.speech_started":
        if (s.phase === "live") setStatus("user");
        break;
      case "input_audio_buffer.speech_stopped":
        if (s.phase === "live") setStatus("listening");
        break;
      case "output_audio_buffer.started":
        s.tutorSpeaking = true;
        if (s.phase === "live") setStatus("tutor");
        break;
      case "output_audio_buffer.stopped":
      case "output_audio_buffer.cleared":
        s.tutorSpeaking = false;
        if (s.phase === "live") setStatus("listening");
        if (s.phase === "goodbye-done") setTimeout(finish, 600);
        break;
      case "error":
        console.warn("realtime error", ev.error);
        break;
    }
  };

  useEffect(() => {
    (async () => {
      try {
        s.stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
        });
      } catch {
        return onError("Microphone access was blocked. Allow it in the browser and try again.");
      }
      try {
        const pc = (s.pc = new RTCPeerConnection());
        s.audio = new Audio();
        s.audio.autoplay = true;
        pc.ontrack = (e) => (s.audio!.srcObject = e.streams[0]);
        pc.addTrack(s.stream.getAudioTracks()[0], s.stream);
        const dc = (s.dc = pc.createDataChannel("oai-events"));
        dc.onmessage = (e) => handle(JSON.parse(e.data));
        dc.onopen = () => {
          s.startedAt = Date.now();
          setStatus("listening");
          send({ type: "response.create" }); // the tutor speaks first
        };
        pc.onconnectionstatechange = () => {
          if (pc.connectionState === "failed" && s.phase !== "ended") {
            s.items.some((it) => it.role === "user") ? finish() : (cleanup(), onError("The connection dropped."));
          }
        };

        await pc.setLocalDescription(await pc.createOffer());
        const r = await fetch("/api/call", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            sdp: pc.localDescription!.sdp,
            lang: setup.lang,
            level: setup.level,
            mode: setup.mode,
            scenarioId: setup.scenarioId,
            minutes: setup.minutes,
            focus: setup.focus,
          }),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error ?? "Could not start the call");
        s.wrapUp = j.wrapUp;
        s.hint = j.hint;
        if (j.instructions) console.info("[tutor] session instructions\n\n" + j.instructions);
        await pc.setRemoteDescription({ type: "answer", sdp: j.sdp });
      } catch (err) {
        cleanup();
        onError((err as Error).message);
      }
    })();

    const timer = setInterval(() => {
      if (!s.startedAt || s.phase === "ended") return;
      s.elapsed = (Date.now() - s.startedAt) / 1000;
      setElapsed(s.elapsed);
      if (s.elapsed >= setup.minutes * 60) wrap();
    }, 500);

    return () => {
      clearInterval(timer);
      if (s.phase !== "ended") cleanup();
    };
  }, []);

  useEffect(() => {
    scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: "smooth" });
  }, [items, translations]);

  const lastTutor = [...items].reverse().find((it) => it.role === "assistant" && it.text.trim());

  async function translate() {
    if (!lastTutor) return;
    if (translations[lastTutor.id]) {
      const { [lastTutor.id]: _, ...rest } = translations;
      return setTranslations(rest);
    }
    setTranslating(true);
    try {
      const r = await fetch("/api/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: lastTutor.text }),
      });
      const j = await r.json();
      if (j.en) setTranslations((t) => ({ ...t, [lastTutor.id]: j.en }));
    } finally {
      setTranslating(false);
    }
  }

  const hint = () => send({ type: "response.create", response: { instructions: s.hint } });

  const togglePinyin = () => {
    localStorage.setItem("pinyin", showPinyin ? "off" : "on");
    setShowPinyin(!showPinyin);
  };

  const remaining = Math.max(0, setup.minutes * 60 - elapsed);
  const live = status !== "connecting" && status !== "wrapping";

  return (
    <main className="call">
      <header className="call-top">
        <span className={`status ${status}`}>
          <i />
          {STATUS_TEXT[status]}
        </span>
        <span className="call-label">{setup.label}</span>
        <span className="meter">
          <span>{clock(remaining)}</span>
          <span className="faint">${cost.toFixed(2)}</span>
        </span>
      </header>
      <div className="progress">
        <i style={{ width: `${Math.min(100, (elapsed / (setup.minutes * 60)) * 100)}%` }} />
      </div>

      <div className="transcript" ref={scroller}>
        <div className="transcript-inner">
          {items.length === 0 && <p className="faint center">{status === "connecting" ? "Connecting…" : "Say hello."}</p>}
          {items.map((it) =>
            it.role === "user" && !it.text && it.done ? null : (
              <div key={it.id} className={`line ${it.role} ${zh ? "zh" : ""}`}>
                {it.text ? (
                  <p>{zh ? <Hanzi text={it.text} show={showPinyin} /> : it.text}</p>
                ) : (
                  <p className="faint">…</p>
                )}
                {translations[it.id] && <p className="translation">{translations[it.id]}</p>}
              </div>
            ),
          )}
        </div>
      </div>

      <footer className="controls">
        <div className="row">
          {zh && (
            <button className={`btn ghost ${showPinyin ? "on" : ""}`} onClick={togglePinyin}>
              Pinyin
            </button>
          )}
          <button className="btn ghost" disabled={!lastTutor || translating} onClick={translate}>
            {translating ? "Translating…" : lastTutor && translations[lastTutor.id] ? "Hide English" : "Translate"}
          </button>
          <button className="btn ghost" disabled={!live || busy} onClick={hint}>
            Simpler
          </button>
        </div>
        <button className="btn end" onClick={finish}>
          End
        </button>
      </footer>
    </main>
  );
}
