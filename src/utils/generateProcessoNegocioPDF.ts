import jsPDF from "jspdf";
import type { ProcessoNegocio } from "../services/processosNegocioApi";
import {
  normalizeResponsavel,
  REVISAO_POLITICA_TEXTO,
  getFluxograma,
  COMITES_APROVACAO,
  isK1,
  temDocumentoPrimario,
  aprovacaoDoComite,
} from "../services/processosNegocioApi";
import { BRASAO_GOIAS_BASE64 } from "./brasaoBase64";

// ============================================================
// Paleta institucional revisada (mockup TJGO / Secretaria de
// Governança Judiciária e Tecnológica)
// ============================================================
const TEXT_DARK = [31, 41, 51] as const; // #1F2933 — títulos em geral
const ACCENT = [31, 47, 70] as const; // #1F2F46 — fundo do número da seção
const ACCENT_BG_LIGHT = [243, 246, 250] as const; // #F3F6FA — fundo dos subtítulos (cabeçalhos de coluna)
const TITLE_BG = [220, 230, 242] as const; // #DCE6F2 — fundo dos títulos de seção (tom mais escuro)
const BORDER_GRAY = [214, 222, 232] as const; // #D6DEE8 — linhas divisórias
const NAVY = [31, 47, 70] as const; // #1F2F46 — nome do processo
const SUBTITLE = [47, 95, 143] as const; // #2F5F8F — subtítulos (cabeçalhos de coluna)
const LABEL_GRAY = [55, 65, 81] as const;
const TEXT_GRAY = [31, 41, 55] as const;
const MUTED_GRAY = [107, 114, 128] as const;
const WHITE = [255, 255, 255] as const;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 18;

// ============================================================
// Helpers
// ============================================================

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const raw = dateStr.substring(0, 10);
    const [y, m, d] = raw.split("-");
    return `${d}/${m}/${y}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

function lineHeightFor(fontSize: number): number {
  return fontSize * 0.3528 * 1.4 + 0.15;
}

// Quebra o texto em parágrafos (split por \n) e wrap por largura.
function splitParagraphs(
  doc: jsPDF,
  text: string,
  maxWidth: number,
): string[][] {
  const paragraphs = (text || "").split("\n");
  return paragraphs.map((p) => {
    const trimmed = p.replace(/\s+$/, "");
    if (!trimmed) return [];
    return doc.splitTextToSize(trimmed, maxWidth) as string[];
  });
}

function countVisualLines(wrapped: string[][]): number {
  return wrapped.reduce((acc, p) => acc + (p.length === 0 ? 1 : p.length), 0);
}

// Renderiza parágrafo a parágrafo — jsPDF deixa a última linha de cada array
// sem justify, então a última linha de cada parágrafo não fica esticada.
function renderJustifiedParagraphs(
  doc: jsPDF,
  wrapped: string[][],
  x: number,
  baselineY: number,
  maxWidth: number,
  lineHeight: number,
): void {
  let lineCursor = 0;
  for (const paraLines of wrapped) {
    if (paraLines.length === 0) {
      lineCursor++;
      continue;
    }
    doc.text(paraLines, x, baselineY + lineCursor * lineHeight, {
      align: "justify",
      maxWidth,
      lineHeightFactor: 1.4,
    });
    lineCursor += paraLines.length;
  }
}

function checkPageBreak(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
): number {
  if (currentY + neededHeight > FOOTER_Y - 5) {
    doc.addPage();
    return 15;
  }
  return currentY;
}

// Calcula próxima revisão (Período + 1 ano) no formato DD/MM/AAAA.
function addOneYearToDate(periodo: string | null | undefined): string {
  if (!periodo || !periodo.trim()) return "—";
  const m = periodo.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return "—";
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "—";
  d.setFullYear(d.getFullYear() + 1);
  const pad = (n: number) => n.toString().padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

function drawTextCell(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  w: number,
  h: number,
  options?: {
    bold?: boolean;
    fontSize?: number;
    align?: "left" | "center" | "right";
    bg?: readonly [number, number, number];
    color?: readonly [number, number, number];
  },
) {
  const fontSize = options?.fontSize || 9;
  const align = options?.align || "left";

  doc.setFillColor(...(options?.bg || WHITE));
  doc.rect(x, y, w, h, "F");
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "S");

  doc.setFontSize(fontSize);
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setTextColor(
    ...(options?.color || (options?.bold ? LABEL_GRAY : TEXT_GRAY)),
  );

  const innerW = w - 6;
  const wrapped = splitParagraphs(doc, text, innerW);
  const totalLines = countVisualLines(wrapped);
  if (totalLines <= 1) {
    const textX =
      align === "center" ? x + w / 2 : align === "right" ? x + w - 3 : x + 3;
    doc.text(text || "", textX, y + h / 2 + fontSize * 0.15, { align });
  } else {
    // Multi-linha: respeita align center/right (sem justify). Default 'left' usa justify por parágrafo.
    const lineHeightMm = lineHeightFor(fontSize);
    const textBlockH = totalLines * lineHeightMm;
    const yTop = y + Math.max(2, (h - textBlockH) / 2);
    const yFirstBaseline = yTop + lineHeightMm * 0.78;
    if (align === "center" || align === "right") {
      const textX = align === "center" ? x + w / 2 : x + w - 3;
      const allLines = wrapped.flatMap((p) => (p.length === 0 ? [""] : p));
      allLines.forEach((line, i) => {
        if (!line) return;
        doc.text(line, textX, yFirstBaseline + i * lineHeightMm, { align });
      });
    } else {
      renderJustifiedParagraphs(
        doc,
        wrapped,
        x + 3,
        yFirstBaseline,
        innerW,
        lineHeightMm,
      );
    }
  }
}

function calcRowHeight(
  doc: jsPDF,
  cells: Array<{ text: string; width: number }>,
  fontSize: number = 9,
  minHeight: number = 9,
): number {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", "normal");
  let maxLines = 1;
  for (const cell of cells) {
    const wrapped = splitParagraphs(doc, cell.text || "", cell.width - 6);
    maxLines = Math.max(maxLines, countVisualLines(wrapped));
  }
  return Math.max(minHeight, maxLines * lineHeightFor(fontSize) + 4);
}

// Cabeçalho de seção numerada — quadrado terracota + faixa cream
function drawNumberedSectionHeader(
  doc: jsPDF,
  numero: number,
  title: string,
  y: number,
  minContentH: number = 20,
): number {
  const h = 10;
  // Evita título órfão no rodapé: se o cabeçalho + o início do conteúdo do tópico não
  // couberem na página atual, empurra o título inteiro para a próxima página.
  y = checkPageBreak(doc, y, h + minContentH);
  const numberSquareW = 12;
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_LEFT, y, numberSquareW, h, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(String(numero), MARGIN_LEFT + numberSquareW / 2, y + 6.8, {
    align: "center",
  });

  doc.setFillColor(...TITLE_BG);
  doc.rect(
    MARGIN_LEFT + numberSquareW,
    y,
    CONTENT_WIDTH - numberSquareW,
    h,
    "F",
  );
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(title.toUpperCase(), MARGIN_LEFT + numberSquareW + 4, y + 6.8);

  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, h, "S");
  return y + h;
}

// Texto livre dentro de uma box (com page-break + justify + centro vertical).
// Renderiza parágrafo a parágrafo pra que a última linha de cada um fique sem justify.
function drawMultilineContent(
  doc: jsPDF,
  text: string,
  y: number,
  minHeight: number = 18,
): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_GRAY);

  const maxW = CONTENT_WIDTH - 8;
  const lineHeight = 4.6;
  const paddingTop = 5;
  const paddingBottom = 3;
  const bottomLimit = FOOTER_Y - 5;

  const wrapped = splitParagraphs(doc, text, maxW);
  const flat: Array<{ text: string; paraIdx: number }> = [];
  wrapped.forEach((paraLines, paraIdx) => {
    if (paraLines.length === 0) {
      flat.push({ text: "", paraIdx: -1 });
    } else {
      paraLines.forEach((l) => flat.push({ text: l, paraIdx }));
    }
  });

  if (flat.length === 0) {
    if (y + minHeight > bottomLimit) {
      doc.addPage();
      y = 15;
    }
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, minHeight, "S");
    return y + minHeight;
  }

  let lineIndex = 0;
  while (lineIndex < flat.length) {
    let availableHeight = bottomLimit - y;
    const isFirstChunkNow = lineIndex === 0;
    const minNeeded = Math.max(
      lineHeight + paddingTop + paddingBottom,
      isFirstChunkNow ? minHeight : 0,
    );
    if (availableHeight < minNeeded) {
      doc.addPage();
      y = 15;
      availableHeight = bottomLimit - y;
    }

    const linesAvailable = Math.max(
      1,
      Math.floor((availableHeight - paddingTop - paddingBottom) / lineHeight),
    );
    const chunkEnd = Math.min(flat.length, lineIndex + linesAvailable);
    const chunkLen = chunkEnd - lineIndex;
    const isFirstAndLastChunk = lineIndex === 0 && chunkEnd >= flat.length;
    let chunkHeight = chunkLen * lineHeight + paddingTop + paddingBottom;
    if (isFirstAndLastChunk) chunkHeight = Math.max(minHeight, chunkHeight);

    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, chunkHeight, "S");

    const textBlockH = chunkLen * lineHeight;
    const yFirstBaseline =
      y + Math.max(paddingTop, (chunkHeight - textBlockH) / 2) + lineHeight - 1;

    let subStart = lineIndex;
    while (subStart < chunkEnd) {
      const paraIdx = flat[subStart].paraIdx;
      if (paraIdx === -1) {
        subStart++;
        continue;
      }
      let subEnd = subStart + 1;
      while (subEnd < chunkEnd && flat[subEnd].paraIdx === paraIdx) subEnd++;
      const subLines = flat.slice(subStart, subEnd).map((it) => it.text);
      const yLine = yFirstBaseline + (subStart - lineIndex) * lineHeight;
      doc.text(subLines, MARGIN_LEFT + 4, yLine, {
        align: "justify",
        maxWidth: maxW,
        lineHeightFactor: 1.4,
      });
      subStart = subEnd;
    }

    y += chunkHeight;
    lineIndex = chunkEnd;
    if (lineIndex < flat.length) {
      doc.addPage();
      y = 15;
    }
  }
  return y;
}

// Bullet list dentro de uma célula (Proprietário, Atores, Áreas Responsáveis...)
function renderBulletList(
  doc: jsPDF,
  items: string[],
  x: number,
  y: number,
  w: number,
  h: number,
) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_GRAY);

  if (items.length === 0) {
    doc.setTextColor(...MUTED_GRAY);
    doc.text("Não informado", x + w / 2, y + h / 2 + 1.4, { align: "center" });
    return;
  }

  const lineHeight = lineHeightFor(9);
  const cx = x + w / 2;
  let cy = y + 5;
  for (const item of items) {
    const lines = doc.splitTextToSize(item, w - 14) as string[];
    for (let i = 0; i < lines.length; i++) {
      // Bullet só na 1ª linha; cada linha centralizada na coluna.
      const text = i === 0 ? `•  ${lines[i]}` : lines[i];
      doc.text(text, cx, cy, { align: "center" });
      cy += lineHeight;
    }
  }
}

function calcBulletListHeight(
  doc: jsPDF,
  items: string[],
  w: number,
  minHeight: number = 16,
): number {
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  if (items.length === 0) return minHeight;
  const lineHeight = lineHeightFor(9);
  let totalLines = 0;
  for (const item of items) {
    totalLines += doc.splitTextToSize(item, w - 14).length;
  }
  return Math.max(minHeight, totalLines * lineHeight + 6);
}

// ============================================================
// CABEÇALHO INSTITUCIONAL (mimetiza a tabela do template)
// ============================================================
function drawCabecalhoInstitucional(
  doc: jsPDF,
  processo: ProcessoNegocio,
  y: number,
): number {
  // Layout:
  //   linha 1: [brasão colorido + textos institucionais (esq)] | [TÍTULO]
  //   linha 2: [Macroprocesso:] [valor]
  //   linha 3: [Data da Versão:] [valor]
  //   linha 4: [NOME DO PROCESSO] [valor]
  const leftColW = 46; // área da logo reduzida (mockup)
  const rightColW = CONTENT_WIDTH - leftColW;
  const rowH = 9;
  const titleH = 16; // título institucional ocupa 2 linhas

  // Coluna esquerda — institucional. Atravessa o título + 2 meta-rows.
  const leftTotalH = titleH + rowH * 2;
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT, y, leftColW, leftTotalH, "F");
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, leftColW, leftTotalH, "S");

  // Brasão COLORIDO (500x500) + textos institucionais renderizados como texto.
  const brasaoW = 15;
  const brasaoH = brasaoW; // 1:1
  const textLine1H = 4; // "PODER JUDICIÁRIO"
  // Forçado em 2 linhas (a coluna estreita quebraria em 4 no auto-wrap).
  const subLines = ["Tribunal de Justiça do", "Estado de Goiás"];
  const textLine2H = subLines.length * 3;
  const lockupH = brasaoH + 1.5 + textLine1H + textLine2H;
  let lockupY = y + (leftTotalH - lockupH) / 2;
  const brasaoX = MARGIN_LEFT + (leftColW - brasaoW) / 2;
  doc.addImage(
    BRASAO_GOIAS_BASE64,
    "PNG",
    brasaoX,
    lockupY,
    brasaoW,
    brasaoH,
    undefined,
    "FAST",
  );
  lockupY += brasaoH + 2.5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text("PODER JUDICIÁRIO", MARGIN_LEFT + leftColW / 2, lockupY, {
    align: "center",
  });
  lockupY += textLine1H - 0.5;
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_GRAY);
  for (const line of subLines) {
    doc.text(line, MARGIN_LEFT + leftColW / 2, lockupY, { align: "center" });
    lockupY += 3;
  }

  // Coluna direita — título em 2 linhas: "PROCESSO DE NEGÓCIO" em destaque +
  // subtítulo "SECRETARIA DE GOVERNANÇA JUDICIÁRIA E TECNOLÓGICA" abaixo.
  const titleX = MARGIN_LEFT + leftColW + rightColW / 2;
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT + leftColW, y, rightColW, titleH, "F");
  doc.setDrawColor(...BORDER_GRAY);
  doc.rect(MARGIN_LEFT + leftColW, y, rightColW, titleH, "S");
  doc.setFontSize(11.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text("PROCESSO DE NEGÓCIO", titleX, y + titleH / 2 - 0.5, {
    align: "center",
  });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);
  doc.text(
    "SECRETARIA DE GOVERNANÇA JUDICIÁRIA E TECNOLÓGICA",
    titleX,
    y + titleH / 2 + 4.2,
    { align: "center" },
  );

  const labelW = 38;

  // Linha 2: Macroprocesso (full right col)
  const yMacro = y + titleH;
  drawTextCell(
    doc,
    "Macroprocesso:",
    MARGIN_LEFT + leftColW,
    yMacro,
    labelW,
    rowH,
    {
      bold: true,
      fontSize: 9,
      bg: ACCENT_BG_LIGHT,
      color: TEXT_DARK,
      align: "center",
    },
  );
  drawTextCell(
    doc,
    processo.macroprocesso || "—",
    MARGIN_LEFT + leftColW + labelW,
    yMacro,
    rightColW - labelW,
    rowH,
    { fontSize: 9 },
  );

  // Linha 3: Data da Versão — preenchida só após homologação (validado_final).
  const yData = yMacro + rowH;
  drawTextCell(
    doc,
    "Data da Versão:",
    MARGIN_LEFT + leftColW,
    yData,
    labelW,
    rowH,
    {
      bold: true,
      fontSize: 9,
      bg: ACCENT_BG_LIGHT,
      color: TEXT_DARK,
      align: "center",
    },
  );
  const dataVersao = processo.validado_final_em
    ? formatDate(processo.periodo) || formatDate(processo.validado_final_em)
    : "Pendente de aprovação";
  drawTextCell(
    doc,
    dataVersao,
    MARGIN_LEFT + leftColW + labelW,
    yData,
    rightColW - labelW,
    rowH,
    { fontSize: 9 },
  );

  // Linha 4: NOME DO PROCESSO (label esquerda + valor centralizado, quebra em 2+ linhas se extenso)
  const yNome = yData + rowH;
  doc.setFontSize(10);
  doc.setFont("helvetica", "bolditalic");
  const nomeLines = doc.splitTextToSize(
    processo.nome_processo || "—",
    rightColW - 8,
  ) as string[];
  const nomeLineH = 4.8;
  const nomeRowH = Math.max(11, nomeLines.length * nomeLineH + 4);

  drawTextCell(doc, "NOME DO PROCESSO", MARGIN_LEFT, yNome, leftColW, nomeRowH, {
    bold: true,
    fontSize: 9,
    align: "center",
  });
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT + leftColW, yNome, rightColW, nomeRowH, "F");
  doc.setDrawColor(...BORDER_GRAY);
  doc.rect(MARGIN_LEFT + leftColW, yNome, rightColW, nomeRowH, "S");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...NAVY);
  const nomeCx = MARGIN_LEFT + leftColW + rightColW / 2;
  let nomeY = yNome + (nomeRowH - nomeLines.length * nomeLineH) / 2 + nomeLineH - 1.2;
  for (const ln of nomeLines) {
    doc.text(ln, nomeCx, nomeY, { align: "center" });
    nomeY += nomeLineH;
  }

  return yNome + nomeRowH;
}

// ============================================================
// Rodapé institucional (em cada página)
// ============================================================
function drawRodapeInstitucional(
  doc: jsPDF,
  processo: ProcessoNegocio,
  diretoriaNome: string,
  pageNum: number,
  totalPages: number,
) {
  // 4 campos inline ("LABEL: valor") distribuídos com espaçamento uniforme ao longo da
  // largura útil. Label em cinza, valor em negrito escuro, com um respiro entre eles.

  // Fase de proposta = enquanto não finalizado (status ≠ validado_final). Neste PDF o
  // formulário já corresponde ao Modelo K1, então:
  //  - MODELO: sempre "K1" (mesmo antes da aprovação);
  //  - VERSÃO: última versão aprovada + 1, com sufixo "(Proposta)".
  const isProposta = processo.status !== "validado_final";
  const versaoBase = (processo.versao || "1").replace(/\.0$/, "");
  const versaoNum = parseInt(versaoBase, 10);
  const versaoValue =
    isProposta && Number.isFinite(versaoNum)
      ? `${versaoNum + 1} (Proposta)`
      : versaoBase;
  const modeloLabel =
    isProposta || isK1(processo)
      ? "K1"
      : temDocumentoPrimario(processo)
        ? "Doc. Primário"
        : "—";

  const GAP_LABEL_VALUE = 1.6; // respiro entre o label e o valor
  const footerFields = [
    { label: "MODELO:", value: modeloLabel },
    { label: "ID:", value: processo.codigo || "—" },
    {
      label: "VERSÃO:",
      value: versaoValue,
    },
    { label: "DATA DA PROPOSTA:", value: formatDate(processo.updated_at) },
  ].map((f) => {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    const labelW = doc.getTextWidth(f.label);
    doc.setFont("helvetica", "bold");
    const valueW = doc.getTextWidth(f.value);
    return { ...f, labelW, valueW, w: labelW + GAP_LABEL_VALUE + valueW };
  });

  const totalText = footerFields.reduce((s, f) => s + f.w, 0);
  const gap = Math.max(
    4,
    (CONTENT_WIDTH - totalText) / (footerFields.length - 1),
  );
  let fx = MARGIN_LEFT;
  for (const f of footerFields) {
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...MUTED_GRAY);
    doc.text(f.label, fx, FOOTER_Y + 2);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(f.value, fx + f.labelW + GAP_LABEL_VALUE, FOOTER_Y + 2);
    fx += f.w + gap;
  }

  // Linha discreta com paginação
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_GRAY);
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH / 2,
    FOOTER_Y + 10,
    { align: "center" },
  );
}

// ============================================================
// PDF MAIN
// ============================================================
export function generateProcessoNegocioPDF(
  processo: ProcessoNegocio,
  diretoriaNome?: string,
  // Aba pré-aberta no gesto do clique (evita bloqueio de popup quando há await antes).
  targetWindow?: Window | null,
) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 15;

  // Cabeçalho institucional
  y = drawCabecalhoInstitucional(doc, processo, y);
  y += 6;

  // 1. Descrição
  y = drawNumberedSectionHeader(doc, 1, "Descrição do Processo", y, 22);
  y = drawMultilineContent(doc, processo.descricao || "", y, 22);
  y += 6;

  // 2. Governança e Responsáveis (3 colunas)
  y = checkPageBreak(doc, y, 35);
  y = drawNumberedSectionHeader(doc, 2, "Governança e Responsáveis", y);
  const govHeaderH = 8;
  const govColW = CONTENT_WIDTH / 2;
  drawTextCell(doc, "RESPONSÁVEL:", MARGIN_LEFT, y, govColW, govHeaderH, {
    bold: true,
    fontSize: 8.5,
    align: "center",
    bg: ACCENT_BG_LIGHT,
    color: SUBTITLE,
  });
  drawTextCell(
    doc,
    "ÁREAS ENVOLVIDAS",
    MARGIN_LEFT + govColW,
    y,
    govColW,
    govHeaderH,
    {
      bold: true,
      fontSize: 8.5,
      align: "center",
      bg: ACCENT_BG_LIGHT,
      color: SUBTITLE,
    },
  );
  y += govHeaderH;

  // Responsável: no documento mostra "cargo (área)".
  const responsavelLabels = (processo.proprietarios || [])
    .map((r) => normalizeResponsavel(r))
    .filter((r) => r.cargo.length > 0)
    .map((r) => (r.area ? `${r.cargo} (${r.area})` : r.cargo));
  const govRowH = Math.max(
    calcBulletListHeight(doc, responsavelLabels, govColW),
    calcBulletListHeight(doc, processo.areas_responsaveis || [], govColW),
  );
  y = checkPageBreak(doc, y, govRowH);
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, govColW, govRowH, "S");
  doc.rect(MARGIN_LEFT + govColW, y, govColW, govRowH, "S");
  renderBulletList(doc, responsavelLabels, MARGIN_LEFT, y, govColW, govRowH);
  renderBulletList(
    doc,
    processo.areas_responsaveis || [],
    MARGIN_LEFT + govColW,
    y,
    govColW,
    govRowH,
  );
  y += govRowH + 6;

  // 3. Informações Utilizadas (2 colunas)
  y = checkPageBreak(doc, y, 30);
  y = drawNumberedSectionHeader(doc, 3, "Informações Utilizadas", y);
  const infHeaderH = 8;
  const infColW = CONTENT_WIDTH / 2;
  drawTextCell(doc, "ENTRADA", MARGIN_LEFT, y, infColW, infHeaderH, {
    bold: true,
    fontSize: 8.5,
    align: "center",
    bg: ACCENT_BG_LIGHT,
    color: SUBTITLE,
  });
  drawTextCell(doc, "SAÍDA", MARGIN_LEFT + infColW, y, infColW, infHeaderH, {
    bold: true,
    fontSize: 8.5,
    align: "center",
    bg: ACCENT_BG_LIGHT,
    color: SUBTITLE,
  });
  y += infHeaderH;
  const infRowH = Math.max(
    calcBulletListHeight(doc, processo.entradas || [], infColW),
    calcBulletListHeight(doc, processo.saidas || [], infColW),
  );
  y = checkPageBreak(doc, y, infRowH);
  doc.rect(MARGIN_LEFT, y, infColW, infRowH, "S");
  doc.rect(MARGIN_LEFT + infColW, y, infColW, infRowH, "S");
  renderBulletList(
    doc,
    processo.entradas || [],
    MARGIN_LEFT,
    y,
    infColW,
    infRowH,
  );
  renderBulletList(
    doc,
    processo.saidas || [],
    MARGIN_LEFT + infColW,
    y,
    infColW,
    infRowH,
  );
  y += infRowH + 6;

  // 4. Estrutura do Processo
  y = drawNumberedSectionHeader(doc, 4, "Estrutura do Processo", y, 25);
  y = drawMultilineContent(doc, processo.detalhamento || "", y, 25);
  y += 6;

  // 5. Recursos Utilizados (2 colunas)
  y = checkPageBreak(doc, y, 30);
  y = drawNumberedSectionHeader(doc, 5, "Recursos Utilizados", y);
  drawTextCell(
    doc,
    "SISTEMAS / FERRAMENTAS",
    MARGIN_LEFT,
    y,
    infColW,
    infHeaderH,
    {
      bold: true,
      fontSize: 8.5,
      align: "center",
      bg: ACCENT_BG_LIGHT,
      color: SUBTITLE,
    },
  );
  drawTextCell(
    doc,
    "NORMATIVO / REFERÊNCIAS",
    MARGIN_LEFT + infColW,
    y,
    infColW,
    infHeaderH,
    {
      bold: true,
      fontSize: 8.5,
      align: "center",
      bg: ACCENT_BG_LIGHT,
      color: SUBTITLE,
    },
  );
  y += infHeaderH;
  const recRowH = Math.max(
    calcBulletListHeight(doc, processo.sistemas_ferramentas || [], infColW),
    calcBulletListHeight(doc, processo.normativos_referencias || [], infColW),
  );
  y = checkPageBreak(doc, y, recRowH);
  doc.rect(MARGIN_LEFT, y, infColW, recRowH, "S");
  doc.rect(MARGIN_LEFT + infColW, y, infColW, recRowH, "S");
  renderBulletList(
    doc,
    processo.sistemas_ferramentas || [],
    MARGIN_LEFT,
    y,
    infColW,
    recRowH,
  );
  renderBulletList(
    doc,
    processo.normativos_referencias || [],
    MARGIN_LEFT + infColW,
    y,
    infColW,
    recRowH,
  );
  y += recRowH + 6;

  // 6. Indicadores
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 6, "Indicadores", y);
  y = drawMultilineContent(doc, processo.indicadores || "", y, 18);
  y += 6;

  // 7. Modelagem / Fluxograma
  y = checkPageBreak(doc, y, 30);
  y = drawNumberedSectionHeader(doc, 7, "Modelagem / Fluxograma", y);
  const flux = getFluxograma(processo);
  if (flux.data && flux.mime?.startsWith("image/")) {
    // Embedar imagem mantendo proporção
    try {
      const fmt = flux.mime.includes("png")
        ? "PNG"
        : flux.mime.includes("webp")
          ? "WEBP"
          : "JPEG";
      // Estimar altura via tag <img> dinâmica não é trivial em jsPDF; assumimos largura full
      // e altura proporcional a uma proporção média 16:9 — se preferir, pode ser ajustado depois.
      const imgW = CONTENT_WIDTH;
      const imgH = imgW * 0.5; // proporção segura pra diagrama
      y = checkPageBreak(doc, y, imgH + 4);
      doc.addImage(
        flux.data,
        fmt,
        MARGIN_LEFT,
        y + 2,
        imgW,
        imgH,
        undefined,
        "FAST",
      );
      doc.setDrawColor(...BORDER_GRAY);
      doc.rect(MARGIN_LEFT, y + 2, imgW, imgH, "S");
      y += imgH + 6;
    } catch (e) {
      y = drawMultilineContent(
        doc,
        `Fluxograma anexado: ${flux.filename || ""} (não foi possível incorporar a imagem no PDF)`,
        y,
        16,
      );
    }
  } else if (flux.data && flux.mime === "application/pdf") {
    y = drawMultilineContent(
      doc,
      `Fluxograma em PDF anexado: ${flux.filename || ""}`,
      y,
      16,
    );
  } else {
    y = drawMultilineContent(doc, "Nenhum fluxograma anexado.", y, 16);
  }
  y += 4;

  // 8. Documentos Anexados
  y = checkPageBreak(doc, y, 25);
  y = drawNumberedSectionHeader(doc, 8, "Documentos Anexados", y);
  if ((processo.documentos_anexados || []).length === 0) {
    y = drawMultilineContent(doc, "Nenhum documento anexado.", y, 14);
  } else {
    const docHeaderH = 8;
    const colTipo = CONTENT_WIDTH * 0.25;
    const colDoc = CONTENT_WIDTH * 0.75;
    drawTextCell(doc, "TIPO", MARGIN_LEFT, y, colTipo, docHeaderH, {
      bold: true,
      fontSize: 8.5,
      align: "center",
      bg: ACCENT_BG_LIGHT,
      color: SUBTITLE,
    });
    drawTextCell(
      doc,
      "DOCUMENTO",
      MARGIN_LEFT + colTipo,
      y,
      colDoc,
      docHeaderH,
      {
        bold: true,
        fontSize: 8.5,
        align: "center",
        bg: ACCENT_BG_LIGHT,
        color: SUBTITLE,
      },
    );
    y += docHeaderH;
    for (const docAnx of processo.documentos_anexados) {
      const rowH = calcRowHeight(doc, [
        { text: docAnx.tipo, width: colTipo },
        { text: docAnx.nome, width: colDoc },
      ]);
      y = checkPageBreak(doc, y, rowH);
      drawTextCell(doc, docAnx.tipo, MARGIN_LEFT, y, colTipo, rowH, {
        align: "center",
        bold: true,
      });
      drawTextCell(doc, docAnx.nome, MARGIN_LEFT + colTipo, y, colDoc, rowH, {
        align: "center",
      });
      y += rowH;
    }
  }
  y += 6;

  // 9. Revisão (2 colunas: Periodicidade | Próxima Revisão)
  y = checkPageBreak(doc, y, 30);
  y = drawNumberedSectionHeader(doc, 9, "Revisão", y);
  const revHeaderH = 8;
  const revColW = CONTENT_WIDTH / 2;
  drawTextCell(doc, "PERIODICIDADE", MARGIN_LEFT, y, revColW, revHeaderH, {
    bold: true,
    fontSize: 8.5,
    align: "center",
    bg: ACCENT_BG_LIGHT,
    color: SUBTITLE,
  });
  drawTextCell(
    doc,
    "PRÓXIMA REVISÃO",
    MARGIN_LEFT + revColW,
    y,
    revColW,
    revHeaderH,
    {
      bold: true,
      fontSize: 8.5,
      align: "center",
      bg: ACCENT_BG_LIGHT,
      color: SUBTITLE,
    },
  );
  y += revHeaderH;

  const proximaRevisao = processo.periodo
    ? addOneYearToDate(processo.periodo)
    : "—";
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  const periodicidadeLines = doc.splitTextToSize(
    REVISAO_POLITICA_TEXTO,
    revColW - 8,
  );
  const revLineH = lineHeightFor(9);
  const revRowH = Math.max(periodicidadeLines.length * revLineH + 4, 16);
  y = checkPageBreak(doc, y, revRowH);
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, revColW, revRowH, "S");
  doc.rect(MARGIN_LEFT + revColW, y, revColW, revRowH, "S");
  // Esquerda: periodicidade (texto multilinha, centralizado ao meio)
  doc.setTextColor(...TEXT_GRAY);
  const periodicidadeBlockH = periodicidadeLines.length * revLineH;
  let revTextY = y + (revRowH - periodicidadeBlockH) / 2 + revLineH - 1.2;
  for (const line of periodicidadeLines) {
    doc.text(line, MARGIN_LEFT + revColW / 2, revTextY, { align: "center" });
    revTextY += revLineH;
  }
  // Direita: próxima revisão (centralizada)
  doc.text(
    proximaRevisao,
    MARGIN_LEFT + revColW + revColW / 2,
    y + revRowH / 2 + 1.4,
    { align: "center" },
  );
  y += revRowH + 6;

  // 10. Rito de Aprovação
  const histLabelW = 60;
  const histFontSize = 9;
  const histValueW = CONTENT_WIDTH - histLabelW;
  const exigidos = processo.apreciacao || [];
  const histLinhas = [
    {
      label: "Responsável",
      valor:
        processo.validado_autor_em && processo.validado_autor_nome
          ? `${processo.validado_autor_nome} — ${formatDateTime(processo.validado_autor_em)}`
          : "Pendente",
    },
    {
      label: "Revisor",
      valor:
        processo.validado_diretoria_em && processo.validado_diretoria_nome
          ? `${processo.validado_diretoria_nome} — ${formatDateTime(processo.validado_diretoria_em)}`
          : "Pendente",
    },
    {
      label: "Compliance Officer",
      valor:
        processo.validado_final_em && processo.validado_final_nome
          ? `${processo.validado_final_nome} — ${formatDateTime(processo.validado_final_em)}`
          : "Pendente",
    },
    // Uma linha por comitê exigido (Modelo K1). Sem comitês, nenhuma linha é adicionada.
    // Label = nome do comitê; valor = "Aprovado — Ata <SIGLA> - <data>" (ou "Pendente").
    ...exigidos.map((comite) => {
      const aprov = aprovacaoDoComite(processo, comite);
      const nome = COMITES_APROVACAO[comite] || comite;
      return {
        label: nome,
        valor: aprov
          ? `Aprovado — Ata ${comite}${aprov.em ? ` - ${formatDate(aprov.em)}` : ""}`
          : "Pendente",
      };
    }),
  ];

  // Altura uniforme para TODAS as linhas da seção: calcula quantas linhas cada célula
  // (label e valor) ocupa após o wrap e usa a maior necessidade — evita linhas desiguais
  // e o texto longo vazando da box quando precisa de 2 linhas.
  const histLineH = lineHeightFor(histFontSize);
  let histRowH = 9;
  for (const linha of histLinhas) {
    doc.setFontSize(histFontSize);
    doc.setFont("helvetica", "bold");
    const labelLines = countVisualLines(
      splitParagraphs(doc, linha.label, histLabelW - 6),
    );
    doc.setFont("helvetica", "normal");
    const valueLines = countVisualLines(
      splitParagraphs(doc, linha.valor, histValueW - 6),
    );
    histRowH = Math.max(histRowH, Math.max(labelLines, valueLines) * histLineH + 4);
  }

  y = checkPageBreak(doc, y, histLinhas.length * histRowH + 12);
  y = drawNumberedSectionHeader(doc, 10, "Rito de Aprovação", y);
  for (const linha of histLinhas) {
    drawTextCell(doc, linha.label, MARGIN_LEFT, y, histLabelW, histRowH, {
      bold: true,
      fontSize: histFontSize,
      bg: [248, 250, 252],
    });
    drawTextCell(
      doc,
      linha.valor,
      MARGIN_LEFT + histLabelW,
      y,
      histValueW,
      histRowH,
      { fontSize: histFontSize },
    );
    y += histRowH;
  }

  // Rodapé em todas as páginas
  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    drawRodapeInstitucional(
      doc,
      processo,
      diretoriaNome || processo.diretoria || "",
      p,
      totalPages,
    );
  }

  const blobUrl = doc.output("bloburl");
  if (targetWindow) {
    targetWindow.location.href = blobUrl as unknown as string;
  } else {
    window.open(blobUrl, "_blank");
  }
}
