import type { Analysis, Setup } from "../types";

export function Results({
  setup,
  analysis: a,
  onPractice,
  onDone,
}: {
  setup: Setup;
  analysis: Analysis;
  onPractice: () => void;
  onDone: () => void;
}) {
  const { cards } = a.saved;
  return (
    <main className="page results">
      <header className="top">
        <span className="wordmark">
          <i className="dot" /> Session review
        </span>
        <span className="muted small">{setup.label}</span>
      </header>

      <p className="summary">{a.summary}</p>

      <p className="saved">
        {a.mistakes.length + a.pronunciationSuspects.length} rows → {a.saved.errorLog}
        <span className="sep">·</span>
        {cards.added} cards → {cards.via === "anki" ? `Anki (${cards.where})` : cards.where}
        <span className="sep">·</span>
        {a.saved.sessionFile}
      </p>

      {a.mistakes.length > 0 && (
        <section className="block">
          <h2 className="label">Mistakes</h2>
          <ul className="mistakes">
            {a.mistakes.map((m, i) => (
              <li key={i}>
                <div className="said">{m.said}</div>
                <div className="correct">
                  {m.correct}
                  {m.pinyin && <span className="py">{m.pinyin}</span>}
                </div>
                <div className="note">
                  <span className="tag">{m.type}</span>
                  {m.note}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.pronunciationSuspects.length > 0 && (
        <section className="block">
          <h2 className="label">
            Heard as <span className="faint">· approximate</span>
          </h2>
          <ul className="mistakes">
            {a.pronunciationSuspects.map((p, i) => (
              <li key={i}>
                <div className="note">
                  You said <b>{p.meant}</b>
                  {p.pinyin && <span className="py">{p.pinyin}</span>}, it heard <b className="heard">{p.heard}</b>
                </div>
                <div className="note faint">{p.note}</div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.newVocab.length > 0 && (
        <section className="block">
          <h2 className="label">New words</h2>
          <ul className="vocab">
            {a.newVocab.map((v, i) => (
              <li key={i}>
                <span className="v-word">{v.word}</span>
                {v.pinyin && <span className="py">{v.pinyin}</span>}
                <span className="muted">{v.meaning}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {a.ankiCards.length > 0 && (
        <section className="block">
          <h2 className="label">Cards</h2>
          <ul className="cards">
            {a.ankiCards.map((c, i) => (
              <li key={i}>
                <div className="muted">{c.front}</div>
                <div dangerouslySetInnerHTML={{ __html: c.back }} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="actions">
        {a.mistakes.length > 0 && (
          <button className="btn primary" onClick={onPractice}>
            Practise these again · 5 min
          </button>
        )}
        <button className="btn" onClick={onDone}>
          Done
        </button>
      </div>
    </main>
  );
}
