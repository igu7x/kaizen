import jsPDF from "jspdf";
import type { ProcessoNegocio } from "../services/processosNegocioApi";
import { TIPO_DOCUMENTO_LABEL } from "../services/processosNegocioApi";
import { P_CENT_BASE64 } from "./pCentBase64";

// ============================================================
// Paleta — usa o mesmo bege/amber do template institucional
// ============================================================
const TEXT_DARK = [15, 23, 42] as const;
const ACCENT = [55, 65, 81] as const; // #374151 — cinza escuro institucional
const ACCENT_BG_LIGHT = [241, 245, 249] as const; // #F1F5F9 — cinza claro harmonizado
const BORDER_GRAY = [203, 213, 225] as const;
const LABEL_GRAY = [55, 65, 81] as const;
const TEXT_GRAY = [31, 41, 55] as const;
const MUTED_GRAY = [107, 114, 128] as const;
const BLUE_TITLE = [29, 78, 216] as const; // título do processo em destaque azul
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

// Formata o campo "Período" pra exibir só mês/ano (ex: "2025-05-15" → "maio/2025").
// Mantém compatibilidade: valores antigos em texto livre são exibidos como estão.
function formatPeriodoMesAno(periodo: string | null | undefined): string {
  if (!periodo || !periodo.trim()) return "—";
  const m = periodo.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    const meses = [
      "janeiro",
      "fevereiro",
      "março",
      "abril",
      "maio",
      "junho",
      "julho",
      "agosto",
      "setembro",
      "outubro",
      "novembro",
      "dezembro",
    ];
    const idx = parseInt(m[2], 10) - 1;
    if (idx >= 0 && idx < 12) return `${meses[idx]}/${m[1]}`;
  }
  return periodo;
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
): number {
  const h = 10;
  const numberSquareW = 12;
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_LEFT, y, numberSquareW, h, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(String(numero), MARGIN_LEFT + numberSquareW / 2, y + 6.8, {
    align: "center",
  });

  doc.setFillColor(...ACCENT_BG_LIGHT);
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
  doc.text(title, MARGIN_LEFT + numberSquareW + 4, y + 6.8);

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
  let cy = y + 5;
  for (const item of items) {
    const lines = doc.splitTextToSize(item, w - 10);
    for (let i = 0; i < lines.length; i++) {
      if (i === 0) {
        doc.text("•", x + 3, cy);
        doc.text(lines[i], x + 7, cy);
      } else {
        doc.text(lines[i], x + 7, cy);
      }
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
    totalLines += doc.splitTextToSize(item, w - 10).length;
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
  //   linha 1: [logo+textos institucionais (esq)] | [TÍTULO PROCESSO DE NEGÓCIO DA DIRETORIA DE X]
  //   linha 2: [Macroprocesso:] [valor]
  //   linha 3: [Diretoria | valor] [Período | valor]
  //   linha 4: [Revisão: | valor] [Código/Versão | valor]
  //   linha 5: [NOME DO PROCESSO] [valor]
  const leftColW = 60;
  const rightColW = CONTENT_WIDTH - leftColW;
  const rowH = 9;

  // Coluna esquerda — institucional. Atravessa as 4 primeiras linhas (título + 3 meta-rows)
  const leftTotalH = rowH * 4;
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT, y, leftColW, leftTotalH, "F");
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, leftColW, leftTotalH, "S");

  // Brasão + textos institucionais como artwork pronto (mesma imagem do TAP/TEP).
  // Aspecto original ~2071x1217 (1.7:1). Encaixa centralizado dentro da coluna esquerda.
  const imgW = Math.min(leftColW - 6, 52);
  const imgH = imgW * (1217 / 2071);
  const imgX = MARGIN_LEFT + (leftColW - imgW) / 2;
  const imgY = y + (leftTotalH - imgH) / 2;
  doc.addImage(P_CENT_BASE64, "PNG", imgX, imgY, imgW, imgH, undefined, "FAST");

  // Coluna direita — título do tipo de processo
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT + leftColW, y, rightColW, rowH, "F");
  doc.rect(MARGIN_LEFT + leftColW, y, rightColW, rowH, "S");
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  const tituloHeader = `PROCESSO DE NEGÓCIO DA DIRETORIA DE ${(processo.diretoria || "—").toUpperCase()}`;
  doc.text(
    tituloHeader,
    MARGIN_LEFT + leftColW + rightColW / 2,
    y + rowH / 2 + 1.4,
    { align: "center" },
  );

  // Linha 2: Macroprocesso (full right col)
  const yMacro = y + rowH;
  const labelW = 35;
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
      color: BLUE_TITLE,
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

  // Linha 3: Diretoria | Período
  const yDir = yMacro + rowH;
  const halfRightW = rightColW / 2;
  drawTextCell(doc, "Diretoria", MARGIN_LEFT + leftColW, yDir, labelW, rowH, {
    bold: true,
    fontSize: 9,
    bg: ACCENT_BG_LIGHT,
    color: BLUE_TITLE,
    align: "center",
  });
  drawTextCell(
    doc,
    processo.diretoria || "—",
    MARGIN_LEFT + leftColW + labelW,
    yDir,
    halfRightW - labelW,
    rowH,
    { fontSize: 9 },
  );
  drawTextCell(
    doc,
    "Período",
    MARGIN_LEFT + leftColW + halfRightW,
    yDir,
    labelW,
    rowH,
    {
      bold: true,
      fontSize: 9,
      bg: ACCENT_BG_LIGHT,
      color: BLUE_TITLE,
      align: "center",
    },
  );
  drawTextCell(
    doc,
    formatPeriodoMesAno(processo.periodo),
    MARGIN_LEFT + leftColW + halfRightW + labelW,
    yDir,
    halfRightW - labelW,
    rowH,
    { fontSize: 9 },
  );

  // Linha 4: Revisão | Código/Versão
  const yRev = yDir + rowH;
  drawTextCell(doc, "Revisão:", MARGIN_LEFT + leftColW, yRev, labelW, rowH, {
    bold: true,
    fontSize: 9,
    bg: ACCENT_BG_LIGHT,
    color: BLUE_TITLE,
    align: "center",
  });
  drawTextCell(
    doc,
    processo.revisao || "—",
    MARGIN_LEFT + leftColW + labelW,
    yRev,
    halfRightW - labelW,
    rowH,
    { fontSize: 9 },
  );
  drawTextCell(
    doc,
    "Código/Versão",
    MARGIN_LEFT + leftColW + halfRightW,
    yRev,
    labelW,
    rowH,
    {
      bold: true,
      fontSize: 9,
      bg: ACCENT_BG_LIGHT,
      color: BLUE_TITLE,
      align: "center",
    },
  );
  drawTextCell(
    doc,
    processo.codigo_versao || "—",
    MARGIN_LEFT + leftColW + halfRightW + labelW,
    yRev,
    halfRightW - labelW,
    rowH,
    { fontSize: 9 },
  );

  // Linha 5: NOME DO PROCESSO (full width, label esquerda + valor à direita em itálico azul)
  const yNome = yRev + rowH;
  const nomeRowH = 11;
  drawTextCell(
    doc,
    "NOME DO PROCESSO",
    MARGIN_LEFT,
    yNome,
    leftColW,
    nomeRowH,
    { bold: true, fontSize: 9, align: "center" },
  );
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT + leftColW, yNome, rightColW, nomeRowH, "F");
  doc.setDrawColor(...BORDER_GRAY);
  doc.rect(MARGIN_LEFT + leftColW, yNome, rightColW, nomeRowH, "S");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(...BLUE_TITLE);
  doc.text(
    processo.nome_processo || "—",
    MARGIN_LEFT + leftColW + 4,
    yNome + nomeRowH / 2 + 1.6,
  );

  return yNome + nomeRowH;
}

// ============================================================
// Histórico de Validação (3 linhas — Autor, Diretoria, Final)
// ============================================================
function drawHistoricoValidacao(
  doc: jsPDF,
  processo: ProcessoNegocio,
  y: number,
): number {
  y = checkPageBreak(doc, y, 35);
  y = drawNumberedSectionHeader(doc, 99, "Histórico de Validação", y);
  // Reusa drawNumberedSectionHeader mas substitui o número por ícone? Mantém 99 como placeholder.
  // (Pra deixar mais elegante, vamos sobrescrever o quadrado do número manualmente.)
  // Simplificação: vamos só usar 3 linhas tabela após o header.

  const rowH = 9;
  const labelW = 60;

  const linhas = [
    {
      label: "Validação do Autor",
      valor:
        processo.validado_autor_em && processo.validado_autor_nome
          ? `${processo.validado_autor_nome} — ${formatDateTime(processo.validado_autor_em)}`
          : "Pendente",
    },
    {
      label: "Validação da Diretoria",
      valor:
        processo.validado_diretoria_em && processo.validado_diretoria_nome
          ? `${processo.validado_diretoria_nome} — ${formatDateTime(processo.validado_diretoria_em)}`
          : "Pendente",
    },
    {
      label: "Validação Final",
      valor:
        processo.validado_final_em && processo.validado_final_nome
          ? `${processo.validado_final_nome} — ${formatDateTime(processo.validado_final_em)}`
          : "Pendente",
    },
  ];

  for (const linha of linhas) {
    drawTextCell(doc, linha.label, MARGIN_LEFT, y, labelW, rowH, {
      bold: true,
      fontSize: 9,
      bg: [248, 250, 252],
    });
    drawTextCell(
      doc,
      linha.valor,
      MARGIN_LEFT + labelW,
      y,
      CONTENT_WIDTH - labelW,
      rowH,
      { fontSize: 9 },
    );
    y += rowH;
  }

  return y;
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
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_GRAY);
  doc.text("ELABORADO POR:", MARGIN_LEFT, FOOTER_Y);
  doc.text("VERSÃO:", PAGE_WIDTH / 2, FOOTER_Y, { align: "center" });
  doc.text("DATA DA ATUALIZAÇÃO:", PAGE_WIDTH - MARGIN_RIGHT, FOOTER_Y, {
    align: "right",
  });

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text(
    diretoriaNome || processo.diretoria || "—",
    MARGIN_LEFT,
    FOOTER_Y + 4,
    { maxWidth: 60 },
  );
  doc.text(processo.versao || "1.0", PAGE_WIDTH / 2, FOOTER_Y + 4, {
    align: "center",
  });
  doc.text(
    formatDate(processo.updated_at),
    PAGE_WIDTH - MARGIN_RIGHT,
    FOOTER_Y + 4,
    { align: "right" },
  );

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
) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 15;

  // Cabeçalho institucional
  y = drawCabecalhoInstitucional(doc, processo, y);
  y += 6;

  // 1. Descrição
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 1, "Descrição do Processo", y);
  y = drawMultilineContent(doc, processo.descricao || "", y, 22);
  y += 6;

  // 2. Governança e Responsáveis (3 colunas)
  y = checkPageBreak(doc, y, 35);
  y = drawNumberedSectionHeader(doc, 2, "Governança e Responsáveis", y);
  const govHeaderH = 8;
  const govColW = CONTENT_WIDTH / 3;
  drawTextCell(doc, "PROPRIETÁRIO:", MARGIN_LEFT, y, govColW, govHeaderH, {
    bold: true,
    fontSize: 8.5,
    align: "center",
    bg: ACCENT_BG_LIGHT,
    color: BLUE_TITLE,
  });
  drawTextCell(doc, "ATORES:", MARGIN_LEFT + govColW, y, govColW, govHeaderH, {
    bold: true,
    fontSize: 8.5,
    align: "center",
    bg: ACCENT_BG_LIGHT,
    color: BLUE_TITLE,
  });
  drawTextCell(
    doc,
    "ÁREAS RESPONSÁVEIS",
    MARGIN_LEFT + govColW * 2,
    y,
    govColW,
    govHeaderH,
    {
      bold: true,
      fontSize: 8.5,
      align: "center",
      bg: ACCENT_BG_LIGHT,
      color: BLUE_TITLE,
    },
  );
  y += govHeaderH;

  const govRowH = Math.max(
    calcBulletListHeight(doc, processo.proprietarios || [], govColW),
    calcBulletListHeight(doc, processo.atores || [], govColW),
    calcBulletListHeight(doc, processo.areas_responsaveis || [], govColW),
  );
  y = checkPageBreak(doc, y, govRowH);
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, govColW, govRowH, "S");
  doc.rect(MARGIN_LEFT + govColW, y, govColW, govRowH, "S");
  doc.rect(MARGIN_LEFT + govColW * 2, y, govColW, govRowH, "S");
  renderBulletList(
    doc,
    processo.proprietarios || [],
    MARGIN_LEFT,
    y,
    govColW,
    govRowH,
  );
  renderBulletList(
    doc,
    processo.atores || [],
    MARGIN_LEFT + govColW,
    y,
    govColW,
    govRowH,
  );
  renderBulletList(
    doc,
    processo.areas_responsaveis || [],
    MARGIN_LEFT + govColW * 2,
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
    color: BLUE_TITLE,
  });
  drawTextCell(doc, "SAÍDA", MARGIN_LEFT + infColW, y, infColW, infHeaderH, {
    bold: true,
    fontSize: 8.5,
    align: "center",
    bg: ACCENT_BG_LIGHT,
    color: BLUE_TITLE,
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

  // 4. Detalhamento
  y = checkPageBreak(doc, y, 22);
  y = drawNumberedSectionHeader(doc, 4, "Detalhamento do Processo", y);
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
      color: BLUE_TITLE,
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
      color: BLUE_TITLE,
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

  // 6. Modelagem / Fluxograma
  y = checkPageBreak(doc, y, 30);
  y = drawNumberedSectionHeader(doc, 6, "Modelagem / Fluxograma", y);
  if (
    processo.fluxograma_data &&
    processo.fluxograma_mime?.startsWith("image/")
  ) {
    // Embedar imagem mantendo proporção
    try {
      const fmt = processo.fluxograma_mime.includes("png")
        ? "PNG"
        : processo.fluxograma_mime.includes("webp")
          ? "WEBP"
          : "JPEG";
      // Estimar altura via tag <img> dinâmica não é trivial em jsPDF; assumimos largura full
      // e altura proporcional a uma proporção média 16:9 — se preferir, pode ser ajustado depois.
      const imgW = CONTENT_WIDTH;
      const imgH = imgW * 0.5; // proporção segura pra diagrama
      y = checkPageBreak(doc, y, imgH + 4);
      doc.addImage(
        processo.fluxograma_data,
        fmt as any,
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
        `Fluxograma anexado: ${processo.fluxograma_filename || ""} (não foi possível incorporar a imagem no PDF)`,
        y,
        16,
      );
    }
  } else if (
    processo.fluxograma_data &&
    processo.fluxograma_mime === "application/pdf"
  ) {
    y = drawMultilineContent(
      doc,
      `Fluxograma em PDF anexado: ${processo.fluxograma_filename || ""}`,
      y,
      16,
    );
  } else {
    y = drawMultilineContent(doc, "Nenhum fluxograma anexado.", y, 16);
  }
  y += 4;

  // 7. Documentos Anexados
  y = checkPageBreak(doc, y, 25);
  y = drawNumberedSectionHeader(doc, 7, "Documentos Anexados", y);
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
      color: BLUE_TITLE,
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
        color: BLUE_TITLE,
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

  // 8. Periodicidade da Revisão
  y = checkPageBreak(doc, y, 18);
  y = drawNumberedSectionHeader(doc, 8, "Periodicidade da Revisão", y);
  const proximaRevisao = processo.periodo
    ? `Próxima revisão prevista: ${addOneYearToDate(processo.periodo)} (1 ano após o período cadastrado)`
    : "Período do processo não informado — próxima revisão não pôde ser calculada.";
  y = drawMultilineContent(doc, proximaRevisao, y, 14);
  y += 6;

  // 9. Histórico de Validação
  y = checkPageBreak(doc, y, 35);
  y = drawNumberedSectionHeader(doc, 9, "Histórico de Validação", y);
  const histRowH = 9;
  const histLabelW = 60;
  const histLinhas = [
    {
      label: "Validação do Autor",
      valor:
        processo.validado_autor_em && processo.validado_autor_nome
          ? `${processo.validado_autor_nome} — ${formatDateTime(processo.validado_autor_em)}`
          : "Pendente",
    },
    {
      label: "Validação da Diretoria",
      valor:
        processo.validado_diretoria_em && processo.validado_diretoria_nome
          ? `${processo.validado_diretoria_nome} — ${formatDateTime(processo.validado_diretoria_em)}`
          : "Pendente",
    },
    {
      label: "Validação Final",
      valor:
        processo.validado_final_em && processo.validado_final_nome
          ? `${processo.validado_final_nome} — ${formatDateTime(processo.validado_final_em)}`
          : "Pendente",
    },
  ];
  for (const linha of histLinhas) {
    drawTextCell(doc, linha.label, MARGIN_LEFT, y, histLabelW, histRowH, {
      bold: true,
      fontSize: 9,
      bg: [248, 250, 252],
    });
    drawTextCell(
      doc,
      linha.valor,
      MARGIN_LEFT + histLabelW,
      y,
      CONTENT_WIDTH - histLabelW,
      histRowH,
      { fontSize: 9 },
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
  window.open(blobUrl, "_blank");
}
