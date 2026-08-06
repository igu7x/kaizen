/**
 * Marcação mínima de negrito: `**texto**`. O conteúdo é guardado como texto puro com esses
 * marcadores; telas e PDF renderizam o negrito a partir daqui (fonte única de parsing).
 */

export interface BoldRun {
  text: string;
  bold: boolean;
}

/** Quebra um texto em runs {text, bold} pela marcação `**negrito**`. `.` casa `\n` (negrito multilinha). */
export function splitBoldRuns(text: string): BoldRun[] {
  const runs: BoldRun[] = [];
  if (!text) return runs;
  const re = /\*\*([\s\S]+?)\*\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) runs.push({ text: text.slice(last, m.index), bold: false });
    runs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), bold: false });
  return runs;
}

/** Remove os marcadores `**` (texto sem formatação) — usado onde não há como renderizar negrito. */
export function stripBold(text: string | null | undefined): string {
  return (text || "").replace(/\*\*([\s\S]+?)\*\*/g, "$1");
}
