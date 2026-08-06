import { Fragment } from "react";
import { splitBoldRuns } from "@/utils/markdownBold";

/**
 * Exibe um texto com marcação `**negrito**`. Renderiza apenas os runs (sem wrapper), então o
 * elemento pai mantém o próprio estilo (ex.: whitespace-pre-line / text-justify).
 */
export function RichText({ text }: { text?: string | null }) {
  return (
    <>
      {splitBoldRuns(text || "").map((r, i) =>
        r.bold ? (
          <strong key={i}>{r.text}</strong>
        ) : (
          <Fragment key={i}>{r.text}</Fragment>
        ),
      )}
    </>
  );
}
