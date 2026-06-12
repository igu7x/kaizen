import jsPDF from "jspdf";
import { LOGO_BRANCO_4K_BASE64 } from "./logoBranco4kBase64";
import type { CompetenciaPadrao } from "@/services/competenciasPadraoApi";

// Mesmas constantes do generateCompetenciasPDF para garantir consistência visual
const GRAY_LIGHT = [245, 245, 245] as const;
const BLACK = [0, 0, 0] as const;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addFooter(
  doc: jsPDF,
  pageNum: number,
  totalPages: number,
  footerLabel: string,
) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BLACK);
  doc.text(footerLabel, MARGIN_LEFT, FOOTER_Y);
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    FOOTER_Y,
    { align: "right" },
  );
}

function drawSectionHeader(doc: jsPDF, title: string, y: number): number {
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(10, 35, 81);
  doc.text(title, MARGIN_LEFT + CONTENT_WIDTH / 2, y + 5, { align: "center" });
  return y + 12;
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
  if (options?.bg) {
    doc.setFillColor(...options.bg);
    doc.rect(x, y, w, h, "F");
  }
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "S");
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setTextColor(...BLACK);
  const textX =
    align === "center" ? x + w / 2 : align === "right" ? x + w - 3 : x + 3;
  doc.text(text || "", textX, y + h / 2 + 1, { align, maxWidth: w - 6 });
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

function drawHeader(doc: jsPDF, tipoFormulario: "equipe" | "gestor") {
  const headerY = 0;
  const headerH = 55;

  // Gradiente azul (mesma paleta dos outros geradores)
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
    doc.rect(i * stepSize, headerY, stepSize + 1, headerH, "F");
  }

  // Largura segura para textos da esquerda — não invade a zona do brasão
  const leftMaxW = PAGE_WIDTH * 0.6 - (MARGIN_LEFT + 5) - 4;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Competências Padrão", MARGIN_LEFT + 5, headerY + 18, {
    maxWidth: leftMaxW,
  });

  const subtitulo =
    tipoFormulario === "gestor"
      ? "Catálogo do Formulário do Gestor"
      : "Catálogo do Formulário da Equipe";
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text(subtitulo, MARGIN_LEFT + 5, headerY + 27, { maxWidth: leftMaxW });

  doc.setFontSize(10);
  doc.setTextColor(200, 210, 230);
  doc.text("Documento somente leitura", MARGIN_LEFT + 5, headerY + 36, {
    maxWidth: leftMaxW,
  });

  doc.setFontSize(9);
  doc.setTextColor(180, 195, 220);
  doc.text(
    `Gerado em ${formatDate(new Date())}`,
    MARGIN_LEFT + 5,
    headerY + 44,
    { maxWidth: leftMaxW },
  );

  // Lado direito - Brasão + textos institucionais
  const rightZoneStart = PAGE_WIDTH * 0.6;
  const rightZoneWidth = PAGE_WIDTH * 0.4;
  const rightCenterX = rightZoneStart + rightZoneWidth / 2;
  const brasaoW = 18;
  const brasaoH = 22;
  doc.addImage(
    LOGO_BRANCO_4K_BASE64,
    "PNG",
    rightCenterX - brasaoW / 2,
    headerY + 10,
    brasaoW,
    brasaoH,
    undefined,
    "FAST",
  );

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("PODER JUDICIÁRIO", rightCenterX, headerY + 37, { align: "center" });

  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    "Tribunal de Justiça do Estado de Goiás",
    rightCenterX,
    headerY + 43,
    { align: "center" },
  );

  return headerY + headerH + 8;
}

function renderSecao(
  doc: jsPDF,
  yStart: number,
  titulo: string,
  items: CompetenciaPadrao[],
): number {
  let y = yStart + 16;
  y = checkPageBreak(doc, y, 20);
  y = drawSectionHeader(doc, `${titulo} (${items.length})`, y);

  if (items.length === 0) {
    drawTextCell(
      doc,
      "Nenhuma competência cadastrada.",
      MARGIN_LEFT,
      y,
      CONTENT_WIDTH,
      8,
      { fontSize: 9, align: "center" },
    );
    return y + 8;
  }

  for (let i = 0; i < items.length; i++) {
    const comp = items[i];
    doc.setFontSize(9);
    const descLines = doc.splitTextToSize(
      comp.descricao || "",
      CONTENT_WIDTH - 6,
    );
    const estimatedHeight = 30 + descLines.length * 4;
    y = checkPageBreak(doc, y, estimatedHeight);

    // Header da competência - faixa azul
    const compHeaderH = 8;
    doc.setFillColor(30, 70, 140);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, compHeaderH, "F");
    doc.setDrawColor(30, 70, 140);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, compHeaderH, "S");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(255, 255, 255);
    doc.text(`${i + 1}. ${comp.nome}`, MARGIN_LEFT + 3, y + 5.5);
    y += compHeaderH;

    // Label "Descrição"
    const descRowH = 6;
    drawTextCell(doc, "Descrição", MARGIN_LEFT, y, 30, descRowH, {
      fontSize: 8,
      bg: GRAY_LIGHT,
    });
    y += descRowH;

    // Conteúdo da descrição
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(...BLACK);
    const lineHeight = 4;
    const textHeight = descLines.length * lineHeight + 4;
    const boxH = Math.max(12, textHeight);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, boxH, "S");
    doc.text(descLines, MARGIN_LEFT + 3, y + 5);
    y += boxH;

    y += 6; // espaço entre competências
  }

  return y;
}

interface GerarOptions {
  tipoFormulario: "equipe" | "gestor";
  comportamentais: CompetenciaPadrao[];
  estrategicas: CompetenciaPadrao[];
  gerenciais: CompetenciaPadrao[];
  versaoAtual?: number | null;
}

export function generateCompetenciasPadraoPDF(opts: GerarOptions) {
  const {
    tipoFormulario,
    comportamentais,
    estrategicas,
    gerenciais,
    versaoAtual,
  } = opts;
  const doc = new jsPDF("p", "mm", "a4");

  // Header
  let y = drawHeader(doc, tipoFormulario);

  // Comportamentais (sempre)
  y = renderSecao(doc, y, "Competências Comportamentais", comportamentais);

  // Estratégicas e Gerenciais (apenas para gestor)
  if (tipoFormulario === "gestor") {
    y = renderSecao(doc, y, "Competências Estratégicas", estrategicas);
    y = renderSecao(doc, y, "Competências Gerenciais", gerenciais);
  }

  // Rodapé em todas as páginas — sem data/hora, só identificação e versão
  const totalPages = doc.getNumberOfPages();
  const tipoLabel =
    tipoFormulario === "gestor"
      ? "Formulário do Gestor"
      : "Formulário da Equipe";
  const versaoPart =
    versaoAtual && versaoAtual > 0 ? `Catálogo v${versaoAtual}` : "";
  const footerLabel = [`Competências Padrão — ${tipoLabel}`, versaoPart]
    .filter(Boolean)
    .join(" — ");
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, footerLabel);
  }

  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
