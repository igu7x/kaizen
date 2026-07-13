import jsPDF from "jspdf";
import { LOGO_BRANCO_4K_BASE64 } from "./logoBranco4kBase64";
import type { AvaliacaoIntegradaFormulario } from "@/services/avaliacaoIntegradaApi";

// Paleta — design unificado dos PDFs
const BLUE_DARK = [10, 35, 81] as const;
const BLUE_MEDIUM = [30, 70, 140] as const;
const BLUE_TITLE_BG = [219, 234, 254] as const;
const HEADER_BLOCK_BG = [241, 245, 249] as const;
const BORDER_GRAY = [203, 213, 225] as const;
const LABEL_GRAY = [55, 65, 81] as const;
const TEXT_GRAY = [31, 41, 55] as const;
const MUTED_GRAY = [107, 114, 128] as const;
const ACCENT_ORANGE = [249, 115, 22] as const;
const WHITE = [255, 255, 255] as const;

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

const NOTA_LABELS: Record<string, Record<number, string>> = {
  tecnica: {
    1: "1 — Iniciante",
    2: "2 — Básico",
    3: "3 — Intermediário",
    4: "4 — Avançado",
    5: "5 — Especialista",
  },
  comportamental: {
    1: "1 — Não demonstra",
    2: "2 — Em desenvolvimento",
    3: "3 — Adequado",
    4: "4 — Destaque",
    5: "5 — Referência",
  },
  estrategica: {
    1: "1 — Compreensão Limitada",
    2: "2 — Em Desenvolvimento",
    3: "3 — Alinhado",
    4: "4 — Contribui Ativamente",
    5: "5 — Referência",
  },
  gerencial: {
    1: "1 — Compreensão Limitada",
    2: "2 — Em Desenvolvimento",
    3: "3 — Alinhado",
    4: "4 — Contribui Ativamente",
    5: "5 — Referência",
  },
};

function formatDate(dateStr: string): string {
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

function addFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  footerLabel: string,
) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...MUTED_GRAY);
  doc.text(footerLabel, MARGIN_LEFT, FOOTER_Y, {
    maxWidth: CONTENT_WIDTH - 40,
  });
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    FOOTER_Y,
    { align: "right" },
  );
}

function drawSectionTitleBar(doc: jsPDF, title: string, y: number): number {
  const h = 14;
  const upperText = title.toUpperCase();
  const decorY = y + h / 2;
  const centerX = MARGIN_LEFT + CONTENT_WIDTH / 2;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE_DARK);
  const textWidth = doc.getTextWidth(upperText);

  doc.setDrawColor(...BLUE_DARK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT + 6, decorY, centerX - textWidth / 2 - 5, decorY);
  doc.line(
    centerX + textWidth / 2 + 5,
    decorY,
    MARGIN_LEFT + CONTENT_WIDTH - 6,
    decorY,
  );

  doc.setFillColor(...BLUE_DARK);
  doc.circle(MARGIN_LEFT + 3, decorY, 1.5, "F");
  doc.circle(MARGIN_LEFT + CONTENT_WIDTH - 3, decorY, 1.5, "F");

  doc.text(upperText, centerX, decorY + 1.5, { align: "center" });

  return y + h + 4;
}

function drawValidationBlock(
  doc: jsPDF,
  items: Array<{ label: string; value: string }>,
  headerLabel: string,
  y: number,
): number {
  if (items.length === 0) return y;
  const headerH = 9;
  const rowH = 9;
  const totalH = headerH + items.length * rowH;
  const labelColW = 60;

  doc.setFillColor(...HEADER_BLOCK_BG);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerH, "F");
  doc.setFillColor(...BLUE_DARK);
  doc.rect(MARGIN_LEFT + 3, y + 2, 1.5, headerH - 4, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE_DARK);
  doc.text(headerLabel, MARGIN_LEFT + 8, y + 6);

  let rowY = y + headerH;
  for (const item of items) {
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, rowH, "F");

    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...LABEL_GRAY);
    doc.text(item.label, MARGIN_LEFT + 4, rowY + 5.8);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_GRAY);
    const valueText = doc.splitTextToSize(
      item.value,
      CONTENT_WIDTH - labelColW - 8,
    );
    doc.text(valueText[0] || "", MARGIN_LEFT + labelColW + 4, rowY + 5.8);

    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.2);
    doc.line(MARGIN_LEFT, rowY, MARGIN_LEFT + CONTENT_WIDTH, rowY);
    doc.line(
      MARGIN_LEFT + labelColW,
      rowY,
      MARGIN_LEFT + labelColW,
      rowY + rowH,
    );

    rowY += rowH;
  }

  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, totalH, "S");
  doc.line(MARGIN_LEFT, y + headerH, MARGIN_LEFT + CONTENT_WIDTH, y + headerH);

  return y + totalH + 6;
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

  const textX =
    align === "center" ? x + w / 2 : align === "right" ? x + w - 3 : x + 3;
  doc.text(text || "", textX, y + h / 2 + 1, { align, maxWidth: w - 6 });
}

// Card de competência integrada — header azul (número + nome) e tabela de notas
// (Auto / Gestor / Integrada) + descrição e comentário (opcionais).
function drawIntegradaCard(
  doc: jsPDF,
  options: {
    numero: number;
    nome: string;
    descricao?: string;
    notaAutoLabel: string;
    notaGestorLabel: string;
    notaIntegradaLabel: string;
    comentario?: string;
    y: number;
  },
): number {
  const {
    numero,
    nome,
    descricao,
    notaAutoLabel,
    notaGestorLabel,
    notaIntegradaLabel,
    comentario,
  } = options;
  let y = options.y;

  const headerH = 10;
  const numberSquareW = 12;

  // Header
  doc.setFillColor(...BLUE_DARK);
  doc.rect(MARGIN_LEFT, y, numberSquareW, headerH, "F");
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(String(numero), MARGIN_LEFT + numberSquareW / 2, y + 7, {
    align: "center",
  });

  doc.setFillColor(...BLUE_MEDIUM);
  doc.rect(
    MARGIN_LEFT + numberSquareW,
    y,
    CONTENT_WIDTH - numberSquareW,
    headerH,
    "F",
  );
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  const nameLines = doc.splitTextToSize(
    nome,
    CONTENT_WIDTH - numberSquareW - 6,
  );
  doc.text(nameLines[0] || "", MARGIN_LEFT + numberSquareW + 3, y + 6.5);

  y += headerH;

  // Tabela de notas (3 colunas)
  const notaH = 9;
  const notaW = CONTENT_WIDTH / 3;

  // Header das 3 notas
  drawTextCell(doc, "Autoavaliação", MARGIN_LEFT, y, notaW, notaH, {
    fontSize: 9,
    bg: HEADER_BLOCK_BG,
    align: "center",
    bold: true,
  });
  drawTextCell(
    doc,
    "Avaliação do Gestor",
    MARGIN_LEFT + notaW,
    y,
    notaW,
    notaH,
    { fontSize: 9, bg: HEADER_BLOCK_BG, align: "center", bold: true },
  );
  drawTextCell(
    doc,
    "Nota Integrada",
    MARGIN_LEFT + notaW * 2,
    y,
    notaW,
    notaH,
    { fontSize: 9, bg: HEADER_BLOCK_BG, align: "center", bold: true },
  );
  y += notaH;

  // Valores
  drawTextCell(doc, notaAutoLabel, MARGIN_LEFT, y, notaW, notaH, {
    fontSize: 9,
    align: "center",
  });
  drawTextCell(doc, notaGestorLabel, MARGIN_LEFT + notaW, y, notaW, notaH, {
    fontSize: 9,
    align: "center",
  });
  drawTextCell(
    doc,
    notaIntegradaLabel,
    MARGIN_LEFT + notaW * 2,
    y,
    notaW,
    notaH,
    { fontSize: 9, align: "center", bold: true },
  );
  y += notaH;

  // Descrição
  if (descricao) {
    const labelColW = 32;
    const descLines = doc.splitTextToSize(
      descricao,
      CONTENT_WIDTH - labelColW - 8,
    );
    const descH = Math.max(notaH, descLines.length * 4.3 + 3);
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, descH, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...LABEL_GRAY);
    doc.setFontSize(9);
    doc.text("Descrição", MARGIN_LEFT + 4, y + 5.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_GRAY);
    doc.text(descLines, MARGIN_LEFT + labelColW + 4, y + 5.8);
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, descH, "S");
    doc.line(MARGIN_LEFT + labelColW, y, MARGIN_LEFT + labelColW, y + descH);
    y += descH;
  }

  // Comentário
  if (comentario) {
    const labelColW = 32;
    const comLines = doc.splitTextToSize(
      comentario,
      CONTENT_WIDTH - labelColW - 8,
    );
    const comH = Math.max(notaH, comLines.length * 4.3 + 3);
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, comH, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...LABEL_GRAY);
    doc.setFontSize(9);
    doc.text("Comentário", MARGIN_LEFT + 4, y + 5.8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...TEXT_GRAY);
    doc.text(comLines, MARGIN_LEFT + labelColW + 4, y + 5.8);
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, comH, "S");
    doc.line(MARGIN_LEFT + labelColW, y, MARGIN_LEFT + labelColW, y + comH);
    y += comH;
  }

  return y + 5;
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

export function generateAvaliacaoIntegradaPDF(
  formulario: AvaliacaoIntegradaFormulario,
) {
  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;

  const tipoInventario = formulario.tipo_inventario || "equipe";
  const tipoLabel =
    tipoInventario === "gestor"
      ? "Matriz de Competências do Gestor"
      : "Matriz de Competências da Equipe";

  // ============================================================
  // HEADER (mantido)
  // ============================================================
  const headerH = 55;
  const colorStart = [10, 35, 81];
  const colorEnd = [30, 70, 140];
  const stepSize = 1;
  const totalSteps = Math.ceil(PAGE_WIDTH / stepSize);
  for (let i = 0; i < totalSteps; i++) {
    const t = i / (totalSteps - 1);
    const r = Math.round(colorStart[0] + (colorEnd[0] - colorStart[0]) * t);
    const g = Math.round(colorStart[1] + (colorEnd[1] - colorStart[1]) * t);
    const b = Math.round(colorStart[2] + (colorEnd[2] - colorStart[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(i * stepSize, 0, stepSize + 1, headerH, "F");
  }

  const leftMaxW = PAGE_WIDTH * 0.6 - (MARGIN_LEFT + 5) - 4;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Avaliação Integrada", MARGIN_LEFT + 5, 18, { maxWidth: leftMaxW });

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(255, 255, 255);
  doc.text(tipoLabel, MARGIN_LEFT + 5, 27, { maxWidth: leftMaxW });

  doc.setFontSize(10);
  doc.setTextColor(200, 210, 230);
  const lotacaoText = `${formulario.diretoria || ""}${formulario.unidade_nome ? ": " + formulario.unidade_nome : ""}`;
  const lotacaoLines = doc.splitTextToSize(lotacaoText, leftMaxW);
  doc.text(lotacaoLines, MARGIN_LEFT + 5, 36);

  const lotacaoEndY = 36 + (lotacaoLines.length - 1) * 4;

  doc.setFontSize(9);
  doc.setTextColor(180, 195, 220);
  const colabText = `Colaborador: ${formulario.pessoa_nome || ""}`;
  doc.text(
    doc.splitTextToSize(colabText, leftMaxW),
    MARGIN_LEFT + 5,
    lotacaoEndY + 8,
  );

  // Logo
  const rightZoneStart = PAGE_WIDTH * 0.6;
  const rightZoneWidth = PAGE_WIDTH * 0.4;
  const rightCenterX = rightZoneStart + rightZoneWidth / 2;
  const brasaoW = 18;
  const brasaoH = 22;
  doc.addImage(
    LOGO_BRANCO_4K_BASE64,
    "PNG",
    rightCenterX - brasaoW / 2,
    10,
    brasaoW,
    brasaoH,
    undefined,
    "FAST",
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("PODER JUDICIÁRIO", rightCenterX, 37, { align: "center" });
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("Tribunal de Justiça do Estado de Goiás", rightCenterX, 43, {
    align: "center",
  });

  y = headerH + 8;

  // ============================================================
  // COMPETÊNCIAS (por seção)
  // ============================================================
  const respostas = formulario.respostas || [];

  const tiposSecao: { tipo: string; titulo: string }[] = [
    { tipo: "tecnica", titulo: "Competências Técnicas" },
    { tipo: "comportamental", titulo: "Competências Comportamentais" },
  ];

  if (tipoInventario === "gestor") {
    tiposSecao.push(
      { tipo: "estrategica", titulo: "Competências Estratégicas" },
      { tipo: "gerencial", titulo: "Competências Gerenciais" },
    );
  }

  for (const secao of tiposSecao) {
    const respostasSecao = respostas.filter(
      (r) => (r.tipo || "tecnica") === secao.tipo,
    );
    if (respostasSecao.length === 0) continue;

    y = checkPageBreak(doc, y, 24);
    y = drawSectionTitleBar(
      doc,
      `${secao.titulo} (${respostasSecao.length})`,
      y,
    );

    for (let i = 0; i < respostasSecao.length; i++) {
      const resp = respostasSecao[i];

      doc.setFontSize(9.5);
      const linesEstim = doc.splitTextToSize(
        (resp.competencia_descricao || "") + (resp.comentario || ""),
        CONTENT_WIDTH - 40,
      );
      const estimatedHeight = 10 + 9 + 9 + linesEstim.length * 4.5 + 18;
      y = checkPageBreak(doc, y, estimatedHeight);

      const tipoLabels =
        NOTA_LABELS[resp.tipo || secao.tipo] || NOTA_LABELS.tecnica;
      y = drawIntegradaCard(doc, {
        numero: i + 1,
        nome: resp.competencia_nome,
        descricao: resp.competencia_descricao || undefined,
        notaAutoLabel:
          tipoLabels[resp.nota_autoavaliacao] || `${resp.nota_autoavaliacao}`,
        notaGestorLabel: tipoLabels[resp.nota_gestor] || `${resp.nota_gestor}`,
        notaIntegradaLabel:
          tipoLabels[resp.nota_integrada] || `${resp.nota_integrada}`,
        comentario: resp.comentario || undefined,
        y,
      });
    }
  }

  // ============================================================
  // BLOCO - Histórico de Validação (ao final do documento)
  // ============================================================
  const validationItems: Array<{ label: string; value: string }> = [];
  validationItems.push({
    label: "Avaliador",
    value: formulario.avaliador_nome || "",
  });
  validationItems.push({
    label: "Colaborador",
    value: formulario.pessoa_nome || "",
  });

  if (formulario.validado_gestor_nome) {
    const label1 =
      tipoInventario === "gestor"
        ? "Validação da Liderança"
        : "Validação do Gestor";
    validationItems.push({
      label: label1,
      value: `${formulario.validado_gestor_nome} — ${formulario.validado_gestor_em ? formatDate(formulario.validado_gestor_em) : ""}`,
    });
  }
  if (formulario.validado_colaborador_nome) {
    const label2 =
      tipoInventario === "gestor"
        ? "Validação do Gestor"
        : "Validação do Colaborador";
    validationItems.push({
      label: label2,
      value: `${formulario.validado_colaborador_nome} — ${formulario.validado_colaborador_em ? formatDate(formulario.validado_colaborador_em) : ""}`,
    });
  }
  y += 6;
  y = checkPageBreak(doc, y, 16 + validationItems.length * 9);
  y = drawValidationBlock(doc, validationItems, "Histórico de Validação", y);

  // ============================================================
  // RODAPÉS — sem data/hora, só identificação e versão
  // ============================================================
  const totalPages = doc.getNumberOfPages();
  const versionPart =
    formulario.versao_formulario && formulario.versao_formulario > 0
      ? `Versão ${formulario.versao_formulario}.0`
      : "";
  const footerBase = `Avaliação Integrada — ${tipoLabel} — ${formulario.pessoa_nome || ""}`;
  const footerLabel = [footerBase, versionPart].filter(Boolean).join(" — ");
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, footerLabel);
  }

  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
