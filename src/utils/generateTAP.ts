import jsPDF from "jspdf";
import type { Projeto } from "../services/cadastrosProjetosApi";
import { P_CENT_BASE64 } from "./pCentBase64";

// Validação dos campos obrigatórios do TAP
export function validateTAPFields(projeto: Projeto): {
  valid: boolean;
  missingFields: string[];
} {
  const missingFields: string[] = [];

  if (!projeto.nome) missingFields.push("Nome do Projeto");
  if (!projeto.tap_vinculado) missingFields.push("Nº do Proad");
  if (!projeto.data_prevista_inicio)
    missingFields.push("Data Prevista de Início");
  if (!projeto.data_prevista_conclusao)
    missingFields.push("Data Prevista de Conclusão");
  if (!projeto.objetivo) missingFields.push("Objetivo");
  if (!projeto.contexto_justificativa)
    missingFields.push("Contexto e Justificativa");
  if (!projeto.patrocinador_id) missingFields.push("Patrocinador");
  if (!projeto.gestor_id) missingFields.push("Gestor");
  if (!projeto.escopo_sintetico) missingFields.push("Escopo");
  if (!projeto.fora_do_escopo) missingFields.push("Fora do Escopo");
  if (!projeto.entregas || projeto.entregas.length === 0)
    missingFields.push("Entregas (pelo menos 1)");
  if (!projeto.instrumentos || projeto.instrumentos.length === 0)
    missingFields.push("Ancoragem Estratégica (pelo menos 1)");
  if (!projeto.prioridade) missingFields.push("Prioridade");
  if (!projeto.complexidade) missingFields.push("Complexidade");

  return { valid: missingFields.length === 0, missingFields };
}

// ============================================================
// Paleta — TAP usa tom âmbar/amarelo como identidade visual
// ============================================================
const TEXT_DARK = [15, 23, 42] as const; // #0f172a — títulos e textos do cabeçalho
const ACCENT = [176, 122, 92] as const; // #B07A5C — terracota institucional: faixa, marcador, número da seção
const ACCENT_BG_LIGHT = [245, 232, 222] as const; // #F5E8DE — cream claro harmonizado: fundo dos blocos
const BORDER_GRAY = [203, 213, 225] as const; // #cbd5e1 — bordas das tabelas
const LABEL_GRAY = [55, 65, 81] as const; // #374151 — labels em negrito
const TEXT_GRAY = [31, 41, 55] as const; // #1f2937 — texto comum
const MUTED_GRAY = [107, 114, 128] as const; // #6b7280 — texto secundário (rodapé)
const SUBTLE_GRAY = [100, 116, 139] as const; // #64748b — textos auxiliares (área, status)
const WHITE = [255, 255, 255] as const;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    const raw = dateStr.substring(0, 10);
    const [year, month, day] = raw.split("-").map(Number);
    return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
  } catch {
    return dateStr;
  }
}

function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
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

function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function translatePrioridade(p: string): string {
  const map: Record<string, string> = {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
  };
  return map[p] || p;
}

function translateComplexidade(c: string): string {
  const map: Record<string, string> = {
    alta: "Alta",
    media: "Média",
    baixa: "Baixa",
  };
  return map[c] || c;
}

function translateAbrangencia(a: string): string {
  const map: Record<string, string> = {
    uma_unidade: "Uma Unidade",
    multiplas_unidades: "Múltiplas Unidades",
    transversal: "Transversal",
  };
  return map[a] || a;
}

function addFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  versao: number,
  tapId: string | null,
) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_GRAY);
  const idPart = tapId ? `  —  ID: ${tapId}` : "";
  doc.text(
    `TAP  —  Termo de Abertura do Projeto  —  Versão ${versao}.0${idPart}`,
    MARGIN_LEFT,
    FOOTER_Y,
  );
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    FOOTER_Y,
    { align: "right" },
  );
}

// Cabeçalho de seção numerada — quadrado âmbar com o número branco
// + faixa âmbar claro com o título em texto escuro. Tem borda externa cinza
// pra "encaixar" com as linhas da tabela do conteúdo logo abaixo.
// Tamanhos padronizados pra match com o "Histórico de Validação" (título 10pt).
function drawNumberedSectionHeader(
  doc: jsPDF,
  numero: number,
  title: string,
  y: number,
): number {
  const h = 10;
  const numberSquareW = 12;

  // Quadrado âmbar com número (fonte reduzida pra equilibrar visual)
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_LEFT, y, numberSquareW, h, "F");
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(String(numero), MARGIN_LEFT + numberSquareW / 2, y + 6.8, {
    align: "center",
  });

  // Barra âmbar claro com título em texto escuro
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

  // Borda externa cinza ao redor de todo o cabeçalho da seção
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, h, "S");

  return y + h;
}

// Bloco "Histórico de Validação" — header cinza claro com marcador laranja à esquerda
// e linhas com label em negrito (coluna fixa) | valor (coluna restante).
function drawValidationBlock(
  doc: jsPDF,
  items: Array<{ label: string; value: string }>,
  y: number,
): number {
  if (items.length === 0) return y;
  const headerH = 9;
  const rowH = 9;
  const totalH = headerH + items.length * rowH;
  const labelColW = 60;

  // Header âmbar claro
  doc.setFillColor(...ACCENT_BG_LIGHT);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerH, "F");
  // Marcador âmbar vertical à esquerda
  doc.setFillColor(...ACCENT);
  doc.rect(MARGIN_LEFT + 3, y + 2, 1.5, headerH - 4, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text("Histórico de Validação", MARGIN_LEFT + 8, y + 6);

  // Linhas
  let rowY = y + headerH;
  for (const item of items) {
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, rowH, "F");

    // Label
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...LABEL_GRAY);
    doc.text(item.label, MARGIN_LEFT + 4, rowY + 5.8);

    // Valor
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_GRAY);
    const valueText = doc.splitTextToSize(
      item.value,
      CONTENT_WIDTH - labelColW - 8,
    );
    doc.text(valueText[0] || "", MARGIN_LEFT + labelColW + 4, rowY + 5.8);

    // Linha divisória entre rows
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, rowY, MARGIN_LEFT + CONTENT_WIDTH, rowY);

    // Separador vertical entre label e valor
    doc.line(
      MARGIN_LEFT + labelColW,
      rowY,
      MARGIN_LEFT + labelColW,
      rowY + rowH,
    );

    rowY += rowH;
  }

  // Borda externa do bloco inteiro
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, totalH, "S");
  // Linha entre header e primeira linha
  doc.line(MARGIN_LEFT, y + headerH, MARGIN_LEFT + CONTENT_WIDTH, y + headerH);

  return y + totalH + 6;
}

// Linha de tabela com label (à esquerda, em negrito) e valor (à direita).
// Usada nas seções como "Identificação do Projeto" e "Classificação".
function drawLabelValueRow(
  doc: jsPDF,
  label: string,
  value: string,
  y: number,
  labelWidth: number = 55,
): number {
  const rowH = 9;

  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, rowH, "F");

  // Label
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...LABEL_GRAY);
  doc.text(label, MARGIN_LEFT + 4, y + 5.8);

  // Valor (com quebra se for longo demais)
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_GRAY);
  const valueLines = doc.splitTextToSize(
    value || "",
    CONTENT_WIDTH - labelWidth - 8,
  );
  const usedH = Math.max(rowH, valueLines.length * 4.3 + 3);
  if (usedH > rowH) {
    // Re-pinta o fundo na altura ampliada
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, usedH, "F");
    // Re-escreve o label no topo
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...LABEL_GRAY);
    doc.text(label, MARGIN_LEFT + 4, y + 5.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_GRAY);
    doc.text(valueLines, MARGIN_LEFT + labelWidth + 4, y + 5.8);
  } else {
    doc.text(valueLines[0] || "", MARGIN_LEFT + labelWidth + 4, y + 5.8);
  }

  // Bordas
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, usedH, "S");
  doc.line(MARGIN_LEFT + labelWidth, y, MARGIN_LEFT + labelWidth, y + usedH);

  return y + usedH;
}

// Célula genérica com texto (usada em tabelas com mais de duas colunas, como Governança).
// Conversão: fontSize (pt) × 0.3528 mm/pt × lineHeightFactor 1.4 = altura real da linha em mm.
// Para fontSize 9 → ~4.45mm; arredondamos pra cima e adicionamos folga pra evitar overflow.
function lineHeightFor(fontSize: number): number {
  return fontSize * 0.3528 * 1.4 + 0.15;
}

// Quebra o texto em parágrafos (split por \n) e wrap por largura.
// Retorna array de arrays: cada subarray é um parágrafo já quebrado em linhas visuais.
// Parágrafos vazios viram subarrays vazios e funcionam como linhas em branco entre parágrafos.
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

// Conta total de linhas visuais (incluindo linhas em branco entre parágrafos).
function countVisualLines(wrapped: string[][]): number {
  return wrapped.reduce((acc, p) => acc + (p.length === 0 ? 1 : p.length), 0);
}

// Renderiza texto justificado parágrafo a parágrafo. jsPDF, ao receber um array de linhas,
// deixa naturalmente a ÚLTIMA linha do array sem justify — então chamamos doc.text() uma vez
// por parágrafo pra que a última linha de cada um não fique esticada com gaps gigantes.
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
      lineCursor++; // linha em branco entre parágrafos
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
  doc.setTextColor(...(options?.bold ? LABEL_GRAY : TEXT_GRAY));

  const innerW = w - 6;
  const wrapped = splitParagraphs(doc, text, innerW);
  const totalLines = countVisualLines(wrapped);

  if (totalLines <= 1) {
    // Linha única: respeita o align passado (header de coluna usa center, labels usam left).
    const textX =
      align === "center" ? x + w / 2 : align === "right" ? x + w - 3 : x + 3;
    doc.text(text || "", textX, y + h / 2 + fontSize * 0.15, { align });
  } else {
    // Multi-linha: respeita align center/right (alinhamento puro, sem justify) — usado em
    // tabelas como Entregas onde justify deixaria gaps gigantes em colunas estreitas.
    // Default 'left' usa justify por parágrafo (última linha sem esticar).
    const lineHeightMm = lineHeightFor(fontSize);
    const textBlockH = totalLines * lineHeightMm;
    const yTop = y + Math.max(2, (h - textBlockH) / 2);
    const yFirstBaseline = yTop + lineHeightMm * 0.78; // baseline ≈ 78% da altura da linha
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
  // Usa o MESMO lineHeight do drawTextCell + padding vertical generoso (4mm)
  // pra que a altura calculada comporte o texto sem vazar.
  return Math.max(minHeight, maxLines * lineHeightFor(fontSize) + 4);
}

// Texto livre (parágrafos) sob uma seção. Suporta múltiplas linhas, page-break,
// e desenha uma borda fina ao redor do bloco pra delimitar o conteúdo.
// IMPORTANTE: lineHeight tem que casar com fontSize × lineHeightFactor real
// (9pt ≈ 3.18mm × 1.4 = 4.45mm). Usar valor menor faz o texto vazar pra fora
// do retângulo. Padding adicional no rodapé garante folga visual.
// Fonte padronizada com o body do "Histórico de Validação" (9pt).
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
  const lineHeight = 4.6; // fontSize 9pt × lineHeightFactor 1.4 ≈ 4.45mm — arredondado pra cima
  const paddingTop = 5;
  const paddingBottom = 3;
  const bottomLimit = FOOTER_Y - 5;

  // Pré-quebra em parágrafos + linhas visuais. Preservamos a estrutura de parágrafos pra
  // que cada um seja renderizado em sua própria chamada doc.text() — assim a última linha
  // de cada parágrafo fica naturalmente sem justify (sem aquelas gaps gigantes entre
  // palavras quando o parágrafo termina numa linha curta).
  const wrapped = splitParagraphs(doc, text, maxW);
  // Achata em sequência de linhas anotadas com índice do parágrafo (-1 = linha em branco).
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
      y = 20;
    }
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, minHeight, "S");
    return y + minHeight;
  }

  let lineIndex = 0;
  while (lineIndex < flat.length) {
    let availableHeight = bottomLimit - y;
    // Espaço mínimo necessário: pelo menos 1 linha+padding OU minHeight (quando vier
    // o primeiro/único chunk que enforça minHeight). Sem essa segunda condição a box
    // pode estourar pra dentro da área do rodapé.
    const isFirstChunkNow = lineIndex === 0;
    const minNeeded = Math.max(
      lineHeight + paddingTop + paddingBottom,
      isFirstChunkNow ? minHeight : 0,
    );
    if (availableHeight < minNeeded) {
      doc.addPage();
      y = 20;
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
    if (isFirstAndLastChunk) {
      chunkHeight = Math.max(minHeight, chunkHeight);
    }

    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, chunkHeight, "S");

    // Centraliza verticalmente: yText = topo do retângulo + (espaço sobrando / 2) + offset da 1ª baseline.
    const textBlockH = chunkLen * lineHeight;
    const yFirstBaseline =
      y + Math.max(paddingTop, (chunkHeight - textBlockH) / 2) + lineHeight - 1;

    // Renderiza sub-parágrafo a sub-parágrafo dentro do chunk pra que a última linha
    // de cada parágrafo fique sem justify.
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
      y = 20;
    }
  }

  return y;
}

function checkPageBreak(
  doc: jsPDF,
  currentY: number,
  neededHeight: number,
): number {
  if (currentY + neededHeight > FOOTER_Y - 5) {
    doc.addPage();
    return 20;
  }
  return currentY;
}

export function generateTAPPdf(projeto: Projeto) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;

  // ============================================================
  // HEADER - Fundo âmbar claro, texto escuro, brasão + faixa âmbar abaixo
  // ============================================================
  const headerY = 0;
  const headerH = 55;

  // Fundo do cabeçalho em tom âmbar claro
  doc.setFillColor(...ACCENT_BG_LIGHT);
  doc.rect(0, headerY, PAGE_WIDTH, headerH, "F");

  const leftMaxW = PAGE_WIDTH * 0.6 - (MARGIN_LEFT + 5) - 4;

  // Título principal
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  const titleLines = doc.splitTextToSize(
    "Termo de Abertura do Projeto",
    leftMaxW,
  );
  const titleY = headerY + 16;
  doc.text(titleLines, MARGIN_LEFT + 5, titleY);
  const titleLineH = 8.1;
  const titleEndY = titleY + (titleLines.length - 1) * titleLineH;

  // Subtítulo "TAP"
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  const tapLabelY = titleEndY + 9;
  doc.text("TAP", MARGIN_LEFT + 5, tapLabelY);

  // Área / diretoria
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...SUBTLE_GRAY);
  const areaText = projeto.areas_execucao_diretorias || projeto.diretoria || "";
  const areaLines = doc.splitTextToSize(areaText, leftMaxW);
  const areaStartY = tapLabelY + 7;
  doc.text(areaLines, MARGIN_LEFT + 5, areaStartY);
  const areaEndY = areaStartY + (areaLines.length - 1) * 4.5;

  // Status
  const tapStatus = projeto.tap_validado_patrocinador_em
    ? `Validado em ${formatDate(projeto.tap_validado_patrocinador_em)}`
    : projeto.tap_validado_diretor_em
      ? "Aguardando validação do Patrocinador"
      : projeto.tap_validado_gestor_em
        ? "Aguardando validação da Diretoria"
        : "Aguardando validação do Gestor";
  doc.setFontSize(9);
  doc.setTextColor(...TEXT_DARK);
  doc.text(
    doc.splitTextToSize(`Status: ${tapStatus}`, leftMaxW),
    MARGIN_LEFT + 5,
    areaEndY + 7,
  );

  // Lado direito - Imagem única "PODER JUDICIÁRIO / Tribunal de Justiça do Estado de Goiás"
  // (brasão + textos institucionais como artwork pronto)
  const rightZoneStart = PAGE_WIDTH * 0.6;
  const rightZoneWidth = PAGE_WIDTH * 0.4;
  const rightCenterX = rightZoneStart + rightZoneWidth / 2;

  // Aspecto original ~2071x1217 (1.7:1). Encaixar no header com folga lateral.
  const imgW = 60;
  const imgH = imgW * (1217 / 2071);
  const imgY = headerY + (headerH - imgH) / 2;
  doc.addImage(
    P_CENT_BASE64,
    "PNG",
    rightCenterX - imgW / 2,
    imgY,
    imgW,
    imgH,
    undefined,
    "FAST",
  );

  // Faixa horizontal âmbar separando o header do corpo
  doc.setFillColor(...ACCENT);
  doc.rect(0, headerH, PAGE_WIDTH, 2, "F");

  y = headerY + headerH + 10;

  // ============================================================
  // BLOCO - Histórico de Validação
  // ============================================================
  const validationItems: Array<{ label: string; value: string }> = [];
  validationItems.push({
    label: "Validação do Gestor",
    value: projeto.tap_validado_gestor_em
      ? `${projeto.gestor_nome || "Gestor"} — ${formatDateTime(projeto.tap_validado_gestor_em)}`
      : "Pendente",
  });
  validationItems.push({
    label: "Validação da Diretoria",
    value: projeto.tap_validado_diretor_em
      ? `${projeto.diretoria || "Diretoria"} — ${formatDateTime(projeto.tap_validado_diretor_em)}`
      : "Pendente",
  });
  validationItems.push({
    label: "Validação do Patrocinador",
    value: projeto.tap_validado_patrocinador_em
      ? `${projeto.patrocinador_nome || "Patrocinador"} — ${formatDateTime(projeto.tap_validado_patrocinador_em)}`
      : "Pendente",
  });
  y = drawValidationBlock(doc, validationItems, y);

  // ============================================================
  // SEÇÃO 1 - Identificação do Projeto
  // ============================================================
  y = drawNumberedSectionHeader(doc, 1, "Identificação do Projeto", y);
  y = drawLabelValueRow(doc, "Nome do Projeto", projeto.nome || "", y);
  y = drawLabelValueRow(
    doc,
    "Área Responsável",
    projeto.areas_execucao_diretorias || projeto.diretoria || "",
    y,
  );
  y = drawLabelValueRow(doc, "Nº do Proad", projeto.tap_vinculado || "", y);
  y = drawLabelValueRow(doc, "ID do Projeto", projeto.tap_id || "", y);
  y += 6;

  // SEÇÃO 2 - Prazo Estimado
  y = drawNumberedSectionHeader(doc, 2, "Prazo Estimado", y);
  const prazoInicio = formatDate(projeto.data_prevista_inicio);
  const prazoConclusao = formatDate(projeto.data_prevista_conclusao);
  const prazoText =
    prazoInicio && prazoConclusao
      ? `Início: ${prazoInicio}   |   Conclusão: ${prazoConclusao}`
      : prazoConclusao || prazoInicio;
  y = drawMultilineContent(doc, prazoText, y, 12);
  y += 6;

  // SEÇÃO 3 - Ancoragem Estratégica
  y = drawNumberedSectionHeader(doc, 3, "Ancoragem Estratégica", y);
  const ancoragens: string[] = [];
  if (projeto.instrumentos && projeto.instrumentos.length > 0) {
    projeto.instrumentos.forEach((inst) => {
      ancoragens.push(`${inst.instrumento_nome} (${inst.instrumento_tipo})`);
    });
  }
  y = drawMultilineContent(doc, ancoragens.join("\n") || "", y, 12);
  y += 6;

  // SEÇÃO 4 - Contexto e Justificativa
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 4, "Contexto e Justificativa", y);
  y = drawMultilineContent(doc, projeto.contexto_justificativa || "", y, 30);
  y += 6;

  // SEÇÃO 5 - Objetivo — só quebra se não couber pelo menos o header + linha mínima
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 5, "Objetivo", y);
  y = drawMultilineContent(doc, projeto.objetivo || "", y, 25);
  y += 6;

  // SEÇÃO 6 - Governança e Responsáveis — só quebra se não couber header + 1ª linha da tabela
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 6, "Governança e Responsáveis", y);

  const govHeaderH = 9;
  const colPapel = 45;
  const colResp = 70;
  const colNome = CONTENT_WIDTH - colPapel - colResp;

  drawTextCell(doc, "Papel", MARGIN_LEFT, y, colPapel, govHeaderH, {
    bold: true,
    fontSize: 9,
    align: "center",
    bg: ACCENT_BG_LIGHT,
  });
  drawTextCell(
    doc,
    "Responsabilidades-chave",
    MARGIN_LEFT + colPapel,
    y,
    colResp,
    govHeaderH,
    { bold: true, fontSize: 9, align: "center", bg: ACCENT_BG_LIGHT },
  );
  drawTextCell(
    doc,
    "Nome",
    MARGIN_LEFT + colPapel + colResp,
    y,
    colNome,
    govHeaderH,
    { bold: true, fontSize: 9, align: "center", bg: ACCENT_BG_LIGHT },
  );
  y += govHeaderH;

  const areasText =
    projeto.areasExecucao
      ?.map((a) => `${a.diretoria} - ${a.area_nome}`)
      .join(", ") ||
    projeto.areas_execucao_diretorias ||
    "";

  const respPatrocinador =
    "Assegurar o alinhamento estratégico do projeto aos objetivos do Tribunal; aprovar o TAP e validar alterações de escopo; viabilizar os recursos necessários; e atuar na remoção de impedimentos organizacionais e institucionais.";
  const respGestor =
    "Planejar e coordenar as atividades do projeto; acompanhar o cronograma e a execução das entregas; gerenciar riscos e comunicações; e reportar o progresso e eventuais desvios ao Patrocinador para tomada de decisão.";
  const respAreas =
    "Executar as atividades técnicas e operacionais previstas no escopo; garantir a qualidade técnica das entregas (módulos e funcionalidades); e fornecer subsídios para o monitoramento de indicadores e progresso das ações.";

  const govRow1H = calcRowHeight(
    doc,
    [
      { text: respPatrocinador, width: colResp },
      { text: projeto.patrocinador_nome || "", width: colNome },
    ],
    9,
    12,
  );
  y = checkPageBreak(doc, y, govRow1H);
  drawTextCell(doc, "Patrocinador", MARGIN_LEFT, y, colPapel, govRow1H, {
    bold: true,
    fontSize: 9,
  });
  drawTextCell(
    doc,
    respPatrocinador,
    MARGIN_LEFT + colPapel,
    y,
    colResp,
    govRow1H,
    { fontSize: 9 },
  );
  drawTextCell(
    doc,
    projeto.patrocinador_nome || "",
    MARGIN_LEFT + colPapel + colResp,
    y,
    colNome,
    govRow1H,
  );
  y += govRow1H;

  const govRow2H = calcRowHeight(
    doc,
    [
      { text: respGestor, width: colResp },
      { text: projeto.gestor_nome || "", width: colNome },
    ],
    9,
    12,
  );
  y = checkPageBreak(doc, y, govRow2H);
  drawTextCell(doc, "Gestor", MARGIN_LEFT, y, colPapel, govRow2H, {
    bold: true,
    fontSize: 9,
  });
  drawTextCell(doc, respGestor, MARGIN_LEFT + colPapel, y, colResp, govRow2H, {
    fontSize: 9,
  });
  drawTextCell(
    doc,
    projeto.gestor_nome || "",
    MARGIN_LEFT + colPapel + colResp,
    y,
    colNome,
    govRow2H,
  );
  y += govRow2H;

  const govRow3H = calcRowHeight(
    doc,
    [
      { text: respAreas, width: colResp },
      { text: areasText, width: colNome },
    ],
    9,
    12,
  );
  y = checkPageBreak(doc, y, govRow3H);
  drawTextCell(doc, "Áreas de Execução", MARGIN_LEFT, y, colPapel, govRow3H, {
    bold: true,
    fontSize: 9,
  });
  drawTextCell(doc, respAreas, MARGIN_LEFT + colPapel, y, colResp, govRow3H, {
    fontSize: 9,
  });
  drawTextCell(
    doc,
    areasText,
    MARGIN_LEFT + colPapel + colResp,
    y,
    colNome,
    govRow3H,
  );
  y += govRow3H + 6;

  // SEÇÃO 7 - Escopo
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 7, "Escopo", y);
  y = drawMultilineContent(doc, projeto.escopo_sintetico || "", y, 30);
  y += 6;

  // SEÇÃO 8 - Fora do Escopo
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 8, "Fora do Escopo", y);
  y = drawMultilineContent(doc, projeto.fora_do_escopo || "", y, 22);
  y += 6;

  // SEÇÃO 9 - Entregas — só quebra se não couber header + 1ª linha
  y = checkPageBreak(doc, y, 20);
  y = drawNumberedSectionHeader(doc, 9, "Entregas", y);

  const entregaHeaderH = 9;
  const colEntregaNome = CONTENT_WIDTH * 0.45;
  const colEntregaArea = CONTENT_WIDTH * 0.3;
  const colEntregaPrazo = CONTENT_WIDTH * 0.25;

  drawTextCell(
    doc,
    "Nome da Entrega",
    MARGIN_LEFT,
    y,
    colEntregaNome,
    entregaHeaderH,
    { bold: true, fontSize: 9, align: "center", bg: ACCENT_BG_LIGHT },
  );
  drawTextCell(
    doc,
    "Área Responsável",
    MARGIN_LEFT + colEntregaNome,
    y,
    colEntregaArea,
    entregaHeaderH,
    { bold: true, fontSize: 9, align: "center", bg: ACCENT_BG_LIGHT },
  );
  drawTextCell(
    doc,
    "Prazo Estimado",
    MARGIN_LEFT + colEntregaNome + colEntregaArea,
    y,
    colEntregaPrazo,
    entregaHeaderH,
    { bold: true, fontSize: 9, align: "center", bg: ACCENT_BG_LIGHT },
  );
  y += entregaHeaderH;

  const entregas = projeto.entregas || [];
  for (let i = 0; i < entregas.length; i++) {
    const entrega = entregas[i];
    const prazoTexto = formatDate((entrega as any).prazo_estimado) || "—";
    const rowH = calcRowHeight(doc, [
      { text: entrega.nome || "", width: colEntregaNome },
      { text: entrega.area_responsavel_nome || "", width: colEntregaArea },
      { text: prazoTexto, width: colEntregaPrazo },
    ]);
    y = checkPageBreak(doc, y, rowH);
    drawTextCell(
      doc,
      entrega.nome || "",
      MARGIN_LEFT,
      y,
      colEntregaNome,
      rowH,
      { align: "center" },
    );
    drawTextCell(
      doc,
      entrega.area_responsavel_nome || "",
      MARGIN_LEFT + colEntregaNome,
      y,
      colEntregaArea,
      rowH,
      { align: "center" },
    );
    drawTextCell(
      doc,
      prazoTexto,
      MARGIN_LEFT + colEntregaNome + colEntregaArea,
      y,
      colEntregaPrazo,
      rowH,
      { align: "center" },
    );
    y += rowH;
  }
  y += 6;

  // SEÇÃO 10 - Classificação
  y = checkPageBreak(doc, y, 30);
  y = drawNumberedSectionHeader(doc, 10, "Classificação", y);
  y = drawLabelValueRow(
    doc,
    "Prioridade Institucional",
    translatePrioridade(projeto.prioridade),
    y,
  );
  y = drawLabelValueRow(
    doc,
    "Complexidade do Projeto",
    translateComplexidade(projeto.complexidade),
    y,
  );
  y = drawLabelValueRow(
    doc,
    "Abrangência Organizacional",
    translateAbrangencia(projeto.abrangencia),
    y,
  );
  y = drawLabelValueRow(
    doc,
    "Haverá contratação?",
    projeto.havera_contratacao ? "Sim" : "Não",
    y,
  );
  if (projeto.havera_contratacao) {
    y = drawLabelValueRow(
      doc,
      "Valor Estimado",
      formatCurrency(projeto.valor_estimado_contratacao),
      y,
    );
  }

  // ============================================================
  // RODAPÉS em todas as páginas
  // ============================================================
  const totalPages = doc.getNumberOfPages();
  const versao = projeto.tap_versao || 1;
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, versao, projeto.tap_id || null);
  }

  // Abrir PDF em nova aba
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
