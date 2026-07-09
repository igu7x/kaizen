import jsPDF from "jspdf";
import { LOGO_BRANCO_4K_BASE64 } from "./logoBranco4kBase64";
import type { FormularioCompetencias } from "@/services/competenciasGestorApi";
import { competenciasPadraoApi } from "@/services/competenciasPadraoApi";
import {
  COMPETENCIAS_COMPORTAMENTAIS,
  COMPETENCIAS_ESTRATEGICAS,
  COMPETENCIAS_GERENCIAIS,
} from "@/constants/competencias";

// ============================================================
// Paleta — design dos cards baseado nos mockups de referência
// ============================================================
const BLUE_DARK = [10, 35, 81] as const; // #0a2351 — quadrado do número, textos institucionais
const BLUE_MEDIUM = [30, 70, 140] as const; // #1e468c — barra do título do card
const BLUE_TITLE_BG = [219, 234, 254] as const; // #dbeafe — faixa "COMPETÊNCIAS TÉCNICAS (N)"
const HEADER_BLOCK_BG = [241, 245, 249] as const; // #f1f5f9 — header do bloco "Histórico de Validação"
const BORDER_GRAY = [203, 213, 225] as const; // #cbd5e1 — bordas das tabelas
const LABEL_GRAY = [55, 65, 81] as const; // #374151 — labels em negrito
const TEXT_GRAY = [31, 41, 55] as const; // #1f2937 — texto comum
const MUTED_GRAY = [107, 114, 128] as const; // #6b7280 — texto secundário
const ACCENT_ORANGE = [249, 115, 22] as const; // #f97316 — marcador lateral do bloco de validação
const WHITE = [255, 255, 255] as const;
const BLACK = [0, 0, 0] as const;

// Badge por peso
const PESO_CRITICA_BG = [254, 226, 226] as const; // #fee2e2
const PESO_CRITICA_TEXT = [185, 28, 28] as const; // #b91c1c
const PESO_CRITICA_BAR = [239, 68, 68] as const; // #ef4444
const PESO_IMPORTANTE_BG = [254, 243, 199] as const; // #fef3c7
const PESO_IMPORTANTE_TEXT = [180, 83, 9] as const; // #b45309
const PESO_IMPORTANTE_BAR = [245, 158, 11] as const; // #f59e0b
const PESO_UTIL_BG = [220, 252, 231] as const; // #dcfce7
const PESO_UTIL_TEXT = [22, 101, 52] as const; // #166534
const PESO_UTIL_BAR = [34, 197, 94] as const; // #22c55e

const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

const pesoLabels: Record<number, string> = {
  1: "Útil",
  2: "Importante",
  3: "Crítica",
};

function pesoColors(peso: number) {
  if (peso === 3)
    return {
      bg: PESO_CRITICA_BG,
      text: PESO_CRITICA_TEXT,
      bar: PESO_CRITICA_BAR,
    };
  if (peso === 2)
    return {
      bg: PESO_IMPORTANTE_BG,
      text: PESO_IMPORTANTE_TEXT,
      bar: PESO_IMPORTANTE_BAR,
    };
  return { bg: PESO_UTIL_BG, text: PESO_UTIL_TEXT, bar: PESO_UTIL_BAR };
}

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

/** Só a data (sem horário) — usado na Vigência do cabeçalho. */
function formatDateOnly(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
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
  doc.text(footerLabel, MARGIN_LEFT, FOOTER_Y);
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    FOOTER_Y,
    { align: "right" },
  );
}

// Faixa que abre uma seção (ex.: "COMPETÊNCIAS TÉCNICAS (8)").
// Divisor decorativo: bolinhas azuis nas pontas, linhas finas se estendendo até o texto
// centralizado em maiúsculas (azul escuro, bold).
function drawSectionTitleBar(doc: jsPDF, title: string, y: number): number {
  const h = 14;
  const upperText = title.toUpperCase();
  const decorY = y + h / 2;
  const centerX = MARGIN_LEFT + CONTENT_WIDTH / 2;

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE_DARK);
  const textWidth = doc.getTextWidth(upperText);

  // Linhas horizontais nos dois lados, com folga até o texto
  doc.setDrawColor(...BLUE_DARK);
  doc.setLineWidth(0.5);
  doc.line(MARGIN_LEFT + 6, decorY, centerX - textWidth / 2 - 5, decorY);
  doc.line(
    centerX + textWidth / 2 + 5,
    decorY,
    MARGIN_LEFT + CONTENT_WIDTH - 6,
    decorY,
  );

  // Bolinhas nas pontas
  doc.setFillColor(...BLUE_DARK);
  doc.circle(MARGIN_LEFT + 3, decorY, 1.5, "F");
  doc.circle(MARGIN_LEFT + CONTENT_WIDTH - 3, decorY, 1.5, "F");

  // Texto centralizado (baseline ~1pt abaixo do meio)
  doc.text(upperText, centerX, decorY + 1.5, { align: "center" });

  return y + h + 4;
}

// Bloco "Histórico de Validação": header cinza claro com marcador laranja à esquerda
// e linhas com label em negrito | valor.
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

  // Borda externa
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);

  // Header
  doc.setFillColor(...HEADER_BLOCK_BG);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, headerH, "F");
  // Marcador azul vertical à esquerda do header (mesma cor do título)
  doc.setFillColor(...BLUE_DARK);
  doc.rect(MARGIN_LEFT + 3, y + 2, 1.5, headerH - 4, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...BLUE_DARK);
  doc.text("Histórico de Validação", MARGIN_LEFT + 8, y + 6);

  // Linhas
  let rowY = y + headerH;
  for (const item of items) {
    // Linha com label cinza claro à esquerda e valor branco à direita
    doc.setFillColor(...WHITE);
    doc.rect(MARGIN_LEFT, rowY, CONTENT_WIDTH, rowH, "F");

    // Label (em negrito, com fundo branco — sem fill diferente, mas com separador vertical)
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

// Card de competência completo — header azul (quadrado do número + barra do nome + badge)
// e body branco com descrição. Para o tipo "equipe" mostra também a aplicabilidade
// (e a quantidade quando "Parte da equipe").
//
// Quando `peso` é informado, desenha o badge à direita do header. A borda do card é
// uma única linha cinza-clara ao redor do body — divisores internos finos separam
// descrição e aplicabilidade.
function drawCompetenciaCard(
  doc: jsPDF,
  options: {
    numero: number;
    nome: string;
    descricao: string;
    peso?: number;
    aplicabilidade?: string | null;
    quantidade?: number | null;
    showAplicabilidade?: boolean;
    y: number;
  },
): number {
  const {
    numero,
    nome,
    descricao,
    peso,
    aplicabilidade,
    quantidade,
    showAplicabilidade,
  } = options;
  const startY = options.y;
  let y = startY;

  // ---- Cabeçalho do card ----
  const headerH = 10;
  const numberSquareW = 12;
  const hasPeso = typeof peso === "number";
  const cores = hasPeso ? pesoColors(peso!) : null;

  // Quadrado azul escuro com o número
  doc.setFillColor(...BLUE_DARK);
  doc.rect(MARGIN_LEFT, y, numberSquareW, headerH, "F");
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(String(numero), MARGIN_LEFT + numberSquareW / 2, y + 7, {
    align: "center",
  });

  // Barra azul média com o nome
  const namebarX = MARGIN_LEFT + numberSquareW;
  const namebarW = CONTENT_WIDTH - numberSquareW;
  doc.setFillColor(...BLUE_MEDIUM);
  doc.rect(namebarX, y, namebarW, headerH, "F");

  // Espaço pra badge à direita (se houver)
  let badgeX = 0;
  let badgeW = 0;
  if (hasPeso) {
    const badgeText = pesoLabels[peso!] || `Peso ${peso}`;
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    badgeW = doc.getTextWidth(badgeText) + 8;
    badgeX = MARGIN_LEFT + CONTENT_WIDTH - badgeW - 3;
  }

  // Nome (truncado pra não invadir o badge)
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  const nameMaxW = badgeW > 0 ? badgeX - namebarX - 6 : namebarW - 6;
  const nameLines = doc.splitTextToSize(nome, nameMaxW);
  doc.text(nameLines[0] || "", namebarX + 3, y + 6.5);

  // Badge à direita (pílula com texto colorido)
  if (hasPeso && cores) {
    const badgeH = 6;
    const badgeY = y + (headerH - badgeH) / 2;
    doc.setFillColor(...cores.bg);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 2.5, 2.5, "F");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...cores.text);
    const badgeText = pesoLabels[peso!] || `Peso ${peso}`;
    doc.text(badgeText, badgeX + badgeW / 2, badgeY + 4.2, { align: "center" });
  }

  y += headerH;

  // ---- Body: pré-calcula alturas pra desenhar uma única borda externa no final ----
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  const descLines = doc.splitTextToSize(descricao || "", CONTENT_WIDTH - 8);
  const descLineH = 4.5;
  const descPadding = 5;
  const descBoxH = Math.max(12, descLines.length * descLineH + descPadding * 2);
  const aplicRowH = showAplicabilidade ? 9 : 0;
  const totalBodyH = descBoxH + aplicRowH;

  // Fundo branco do body inteiro
  doc.setFillColor(...WHITE);
  doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, totalBodyH, "F");

  // Descrição — justificada (jsPDF quebra pelo maxWidth e deixa a última linha à esquerda)
  doc.setFontSize(9.5);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_GRAY);
  doc.text(descricao || "", MARGIN_LEFT + 4, y + descPadding + 3, {
    align: "justify",
    maxWidth: CONTENT_WIDTH - 8,
  });

  // Linha de Aplicabilidade (apenas quando solicitado)
  if (showAplicabilidade) {
    const apY = y + descBoxH;
    const labelColW = 32;
    const aplicText =
      aplicabilidade === "parte" ? "Parte da equipe" : "Todos os colaboradores";

    if (aplicabilidade === "parte" && quantidade) {
      // Layout em 4 células: Aplicabilidade | Parte da equipe | Quantidade | N colaboradores
      const cellAplicLabelW = labelColW;
      const cellAplicValueW = (CONTENT_WIDTH - labelColW * 2) / 2;
      const cellQtdLabelW = labelColW;
      let cx = MARGIN_LEFT;

      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...LABEL_GRAY);
      doc.text("Aplicabilidade", cx + 4, apY + 5.8);
      cx += cellAplicLabelW;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_GRAY);
      doc.text(aplicText, cx + 4, apY + 5.8);
      cx += cellAplicValueW;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(...LABEL_GRAY);
      doc.text("Quantidade", cx + 4, apY + 5.8);
      cx += cellQtdLabelW;

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_GRAY);
      doc.text(`${quantidade} colaboradores`, cx + 4, apY + 5.8);

      // Separadores verticais entre as 4 células
      doc.setDrawColor(...BORDER_GRAY);
      doc.setLineWidth(0.2);
      doc.line(
        MARGIN_LEFT + cellAplicLabelW,
        apY,
        MARGIN_LEFT + cellAplicLabelW,
        apY + aplicRowH,
      );
      doc.line(
        MARGIN_LEFT + cellAplicLabelW + cellAplicValueW,
        apY,
        MARGIN_LEFT + cellAplicLabelW + cellAplicValueW,
        apY + aplicRowH,
      );
      doc.line(
        MARGIN_LEFT + cellAplicLabelW + cellAplicValueW + cellQtdLabelW,
        apY,
        MARGIN_LEFT + cellAplicLabelW + cellAplicValueW + cellQtdLabelW,
        apY + aplicRowH,
      );
    } else {
      // Layout em 2 células: Aplicabilidade | Todos os colaboradores
      doc.setFontSize(9);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...LABEL_GRAY);
      doc.text("Aplicabilidade", MARGIN_LEFT + 4, apY + 5.8);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...TEXT_GRAY);
      doc.text(aplicText, MARGIN_LEFT + labelColW + 4, apY + 5.8);

      doc.setDrawColor(...BORDER_GRAY);
      doc.setLineWidth(0.2);
      doc.line(
        MARGIN_LEFT + labelColW,
        apY,
        MARGIN_LEFT + labelColW,
        apY + aplicRowH,
      );
    }

    // Divisor horizontal entre descrição e aplicabilidade
    doc.setDrawColor(...BORDER_GRAY);
    doc.setLineWidth(0.3);
    doc.line(MARGIN_LEFT, apY, MARGIN_LEFT + CONTENT_WIDTH, apY);
  }

  // Borda externa única ao redor do body
  doc.setDrawColor(...BORDER_GRAY);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN_LEFT, startY + headerH, CONTENT_WIDTH, totalBodyH, "S");

  return startY + headerH + totalBodyH + 5; // gap entre cards
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

export async function generateCompetenciasPDF(
  formulario: FormularioCompetencias,
) {
  // Resolução do catálogo de padrões (Comportamentais / Estratégicas / Gerenciais):
  //   1) Se o formulário já carrega `padroes` (é um SNAPSHOT histórico salvo no momento
  //      da validação final), usa esse catálogo congelado — assim o PDF de uma versão
  //      antiga reflete os padrões vigentes naquela época, não os atuais.
  //   2) Caso contrário (PDF do formulário corrente), busca os padrões CORRENTES da API.
  //   3) Se a API falhar, cai para as constantes embutidas para nunca quebrar o PDF.
  let comportamentaisPadrao = COMPETENCIAS_COMPORTAMENTAIS.map((c) => ({
    nome: c.nome,
    descricao: c.descricao,
  }));
  let estrategicasPadrao = COMPETENCIAS_ESTRATEGICAS.map((c) => ({
    nome: c.nome,
    descricao: c.descricao,
  }));
  let gerenciaisPadrao = COMPETENCIAS_GERENCIAIS.map((c) => ({
    nome: c.nome,
    descricao: c.descricao,
  }));
  const padroesSnapshot = (formulario as any).padroes as
    | {
        comportamental?: Array<{ nome: string; descricao: string }>;
        estrategica?: Array<{ nome: string; descricao: string }>;
        gerencial?: Array<{ nome: string; descricao: string }>;
      }
    | undefined;
  if (
    padroesSnapshot &&
    (padroesSnapshot.comportamental?.length ||
      padroesSnapshot.estrategica?.length ||
      padroesSnapshot.gerencial?.length)
  ) {
    if (padroesSnapshot.comportamental?.length)
      comportamentaisPadrao = padroesSnapshot.comportamental.map((c) => ({
        nome: c.nome,
        descricao: c.descricao,
      }));
    if (padroesSnapshot.estrategica?.length)
      estrategicasPadrao = padroesSnapshot.estrategica.map((c) => ({
        nome: c.nome,
        descricao: c.descricao,
      }));
    if (padroesSnapshot.gerencial?.length)
      gerenciaisPadrao = padroesSnapshot.gerencial.map((c) => ({
        nome: c.nome,
        descricao: c.descricao,
      }));
  } else {
    try {
      const data = await competenciasPadraoApi.getAll();
      if (data.comportamental?.length)
        comportamentaisPadrao = data.comportamental.map((c) => ({
          nome: c.nome,
          descricao: c.descricao,
        }));
      if (data.estrategica?.length)
        estrategicasPadrao = data.estrategica.map((c) => ({
          nome: c.nome,
          descricao: c.descricao,
        }));
      if (data.gerencial?.length)
        gerenciaisPadrao = data.gerencial.map((c) => ({
          nome: c.nome,
          descricao: c.descricao,
        }));
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  }

  const doc = new jsPDF("p", "mm", "a4");
  let y = 0;

  // ============================================================
  // HEADER - Fundo azul escuro com gradiente simulado
  // (mantido idêntico ao atual)
  // ============================================================
  const headerY = 0;
  const headerH = 55;

  const colorStart = [10, 35, 81]; // #0a2351 (esquerda)
  const colorEnd = [30, 70, 140]; // #1e468c (direita)
  const stepSize = 1; // 1mm por strip
  const totalSteps = Math.ceil(PAGE_WIDTH / stepSize);
  for (let i = 0; i < totalSteps; i++) {
    const t = i / (totalSteps - 1);
    const r = Math.round(colorStart[0] + (colorEnd[0] - colorStart[0]) * t);
    const g = Math.round(colorStart[1] + (colorEnd[1] - colorStart[1]) * t);
    const b = Math.round(colorStart[2] + (colorEnd[2] - colorStart[2]) * t);
    doc.setFillColor(r, g, b);
    doc.rect(i * stepSize, headerY, stepSize + 1, headerH, "F");
  }

  // Lado esquerdo - textos em branco
  const leftMaxW = PAGE_WIDTH * 0.6 - (MARGIN_LEFT + 5) - 4;

  // Título único: "Matriz de Competências - Gestor" / "- Equipe" (sem o subtítulo redundante).
  const tipoLabel =
    formulario.tipo === "gestor"
      ? "Matriz de Competências - Gestor"
      : "Matriz de Competências - Equipe";
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text(tipoLabel, MARGIN_LEFT + 5, headerY + 20, { maxWidth: leftMaxW });

  doc.setFontSize(10);
  doc.setTextColor(200, 210, 230);
  const lotacaoText = `${formulario.diretoria || ""}${formulario.unidade_nome ? ": " + formulario.unidade_nome : ""}`;
  const lotacaoLines = doc.splitTextToSize(lotacaoText, leftMaxW);
  doc.text(lotacaoLines, MARGIN_LEFT + 5, headerY + 36);
  const lotacaoEndY = headerY + 36 + (lotacaoLines.length - 1) * 4;

  const vigenciaDate = formulario.validado_final_em
    ? formatDateOnly(formulario.validado_final_em)
    : formulario.validado_por_diretoria_em
      ? formatDateOnly(formulario.validado_por_diretoria_em)
      : "";
  const statusText = vigenciaDate
    ? `Vigência: ${vigenciaDate}`
    : `Status: ${formulario.status || "Enviado"}`;
  doc.setFontSize(9);
  doc.setTextColor(180, 195, 220);
  doc.text(statusText, MARGIN_LEFT + 5, lotacaoEndY + 8, {
    maxWidth: leftMaxW,
  });

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
  doc.setTextColor(255, 255, 255);
  doc.text(
    "Tribunal de Justiça do Estado de Goiás",
    rightCenterX,
    headerY + 43,
    { align: "center" },
  );

  y = headerY + headerH + 8;

  // ============================================================
  // SEÇÃO - Competências Técnicas
  // ============================================================
  const competencias = formulario.competencias || [];

  y = checkPageBreak(doc, y, 20);
  y = drawSectionTitleBar(
    doc,
    `Competências Técnicas (${competencias.length})`,
    y,
  );

  for (let i = 0; i < competencias.length; i++) {
    const comp = competencias[i];
    // Estimativa pra page break
    doc.setFontSize(9.5);
    const linesEstim = doc.splitTextToSize(
      comp.descricao || "",
      CONTENT_WIDTH - 8,
    );
    const estimatedHeight = 10 + linesEstim.length * 4.5 + 10 + 12;
    y = checkPageBreak(doc, y, estimatedHeight);

    y = drawCompetenciaCard(doc, {
      numero: i + 1,
      nome: comp.nome,
      descricao: comp.descricao || "",
      // peso (Grau de Impacto) omitido — não exibimos badge em nenhuma seção,
      // mantendo o padrão das competências comportamentais/estratégicas/gerenciais.
      aplicabilidade: comp.aplicabilidade || null,
      quantidade: comp.quantidade_pessoas || null,
      showAplicabilidade: formulario.tipo !== "gestor",
      y,
    });
  }

  // ============================================================
  // Função auxiliar para renderizar seção de competências fixas
  // ============================================================
  function renderFixedSection(
    title: string,
    items: { nome: string; descricao: string }[],
  ) {
    y += 6; // gap entre seções
    y = checkPageBreak(doc, y, 24);
    y = drawSectionTitleBar(doc, title, y);

    for (let i = 0; i < items.length; i++) {
      const comp = items[i];
      doc.setFontSize(9.5);
      const linesEstim = doc.splitTextToSize(comp.descricao, CONTENT_WIDTH - 8);
      const estimatedHeight = 10 + linesEstim.length * 4.5 + 10 + 12;
      y = checkPageBreak(doc, y, estimatedHeight);

      y = drawCompetenciaCard(doc, {
        numero: i + 1,
        nome: comp.nome,
        descricao: comp.descricao,
        peso: undefined,
        aplicabilidade: "todos",
        quantidade: null,
        showAplicabilidade: formulario.tipo !== "gestor",
        y,
      });
    }
  }

  // Competências Comportamentais (comum a equipe e gestor)
  renderFixedSection(
    `Competências Comportamentais (${comportamentaisPadrao.length})`,
    comportamentaisPadrao,
  );

  if (formulario.tipo === "gestor") {
    renderFixedSection(
      `Competências Estratégicas (${estrategicasPadrao.length})`,
      estrategicasPadrao,
    );
    renderFixedSection(
      `Competências Gerenciais (${gerenciaisPadrao.length})`,
      gerenciaisPadrao,
    );
  }

  // ============================================================
  // BLOCO - Histórico de Validação (ao final do documento)
  // ============================================================
  const validationItems: Array<{ label: string; value: string }> = [];
  if (formulario.validado_por_autor_nome) {
    validationItems.push({
      label: "Validação do Autor",
      value: `${formulario.validado_por_autor_nome} — ${formulario.validado_por_autor_em ? formatDate(formulario.validado_por_autor_em) : ""}`,
    });
  }
  if (formulario.validado_por_diretoria_nome) {
    validationItems.push({
      label: "Validação da Diretoria",
      value: `${formulario.validado_por_diretoria_nome} — ${formulario.validado_por_diretoria_em ? formatDate(formulario.validado_por_diretoria_em) : ""}`,
    });
  }
  if (formulario.validado_final_nome) {
    validationItems.push({
      label: "Validação Final",
      value: `${formulario.validado_final_nome} — ${formulario.validado_final_em ? formatDate(formulario.validado_final_em) : ""}`,
    });
  }
  if (validationItems.length > 0) {
    y += 6;
    y = checkPageBreak(doc, y, 16 + validationItems.length * 9);
    y = drawValidationBlock(doc, validationItems, y);
  }

  // ============================================================
  // RODAPÉS em todas as páginas
  // ============================================================
  const totalPages = doc.getNumberOfPages();
  const versionPart =
    formulario.versao_formulario && formulario.versao_formulario > 0
      ? `Versão ${formulario.versao_formulario}.0`
      : "";
  const unidadePart = formulario.unidade_nome || "";
  const footerParts = [unidadePart, versionPart].filter(Boolean);
  const footerLabel = footerParts.join(" — ");
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addFooter(doc, i, totalPages, footerLabel);
  }

  // Abrir PDF em nova aba
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
