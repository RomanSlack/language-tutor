import { useMemo } from "react";
import { pinyin } from "pinyin-pro";

// Chinese text with pinyin above each character.
export function Hanzi({ text, show }: { text: string; show: boolean }) {
  const parts = useMemo(
    () => (show ? (pinyin(text, { type: "all" }) as { origin: string; pinyin: string; isZh: boolean }[]) : []),
    [text, show],
  );
  if (!show) return <>{text}</>;
  return (
    <>
      {parts.map((p, i) =>
        p.isZh ? (
          <ruby key={i}>
            {p.origin}
            <rt>{p.pinyin}</rt>
          </ruby>
        ) : (
          <span key={i}>{p.origin}</span>
        ),
      )}
    </>
  );
}
