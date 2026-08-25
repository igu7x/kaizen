import jsPDF from "jspdf";
import { LOGO_BRANCO_4K_BASE64 } from "./logoBranco4kBase64";
import { NOTA_TECNICA_LABELS } from "@/constants/competencias";
import type { RelatorioLacunas } from "@/services/lacunasCompetenciasApi";

// Mesmas constantes dos demais geradores do módulo, para o PDF sair no mesmo padrão visual.
const BLACK = [0, 0, 0] as const;
const GRAY_LIGHT = [245, 245, 245] as const;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

/** Grau mínimo esperado da competência, na escala do Resultado Final. */
const grauLabel = (grau: number) =>
  `${grau} — ${NOTA_TECNICA_LABELS[grau] || ""}`;

function formatDateTime(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function addFooter(doc: jsPDF, pageNum: number, totalPages: number) {
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...BLACK);
  doc.text("Lacunas de Competências", MARGIN_LEFT, FOOTER_Y);
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    FOOTER_Y,
    { align: "right" },
  );
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
  if (options?.bg) {
    doc.setFillColor(...options.bg);
    doc.rect(x, y, w, h, "F");
  }
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "S");
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setTextColor(...(options?.color ?? BLACK));
  const textX =
    align === "center" ? x + w / 2 : align === "right" ? x + w - 3 : x + 3;
  doc.text(text || "", textX, y + h / 2 + 1, { align, maxWidth: w - 6 });
}

/**
 * Célula com texto já quebrado em linhas, centralizado verticalmente no bloco.
 * Diferente de drawTextCell (que usa `maxWidth` e assume uma linha só), aqui a altura é
 * informada pelo chamador a partir da contagem de linhas — é o que impede o corte.
 */
function drawWrappedCell(
  doc: jsPDF,
  lines: string[],
  x: number,
  y: number,
  w: number,
  h: number,
  options?: {
    bold?: boolean;
    bg?: readonly [number, number, number];
    fontSize?: number;
  },
) {
  if (options?.bg) {
    doc.setFillColor(...options.bg);
    doc.rect(x, y, w, h, "F");
  }
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  doc.rect(x, y, w, h, "S");
  const fontSize = options?.fontSize ?? 9;
  const alturaLinha = fontSize >= 9 ? 4.5 : 4.2;
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", options?.bold ? "bold" : "normal");
  doc.setTextColor(...BLACK);
  let ty = y + (h - lines.length * alturaLinha) / 2 + 3.2;
  for (const line of lines) {
    doc.text(line, x + 3, ty);
    ty += alturaLinha;
  }
}

function drawHeader(doc: jsPDF, rel: RelatorioLacunas) {
  const headerH = 55;
  const colorStart = [10, 35, 81];
  const colorEnd = [30, 70, 140];
  const totalSteps = Math.ceil(PAGE_WIDTH);
  for (let i = 0; i < totalSteps; i++) {
    const t = i / (totalSteps - 1);
    doc.setFillColor(
      Math.round(colorStart[0] + (colorEnd[0] - colorStart[0]) * t),
      Math.round(colorStart[1] + (colorEnd[1] - colorStart[1]) * t),
      Math.round(colorStart[2] + (colorEnd[2] - colorStart[2]) * t),
    );
    doc.rect(i, 0, 2, headerH, "F");
  }

  const leftMaxW = PAGE_WIDTH * 0.6 - (MARGIN_LEFT + 5) - 4;
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("Lacunas de Competências", MARGIN_LEFT + 5, 18, {
    maxWidth: leftMaxW,
  });
  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");
  doc.text("Inventário da Equipe", MARGIN_LEFT + 5, 27, {
    maxWidth: leftMaxW,
  });
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 230);
  const lotacao = `${rel.area_sigla || ""}${rel.unidade_nome ? ": " + rel.unidade_nome : ""}`;
  const lotLines = doc.splitTextToSize(lotacao, leftMaxW);
  doc.text(lotLines, MARGIN_LEFT + 5, 36);

  const rcx = PAGE_WIDTH * 0.6 + (PAGE_WIDTH * 0.4) / 2;
  doc.addImage(
    LOGO_BRANCO_4K_BASE64,
    "PNG",
    rcx - 9,
    10,
    18,
    22,
    undefined,
    "FAST",
  );
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("PODER JUDICIÁRIO", rcx, 37, { align: "center" });
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "normal");
  doc.text("Tribunal de Justiça do Estado de Goiás", rcx, 43, {
    align: "center",
  });
}

export function generateLacunasCompetenciasPDF(rel: RelatorioLacunas) {
  const doc = new jsPDF("p", "mm", "a4");
  const geradoEm = new Date();
  drawHeader(doc, rel);
  let y = 55 + 8;

  // ── Parâmetros do cálculo ────────────────────────────────────────────────
  // O relatório é uma FOTOGRAFIA: registra o critério e o momento, porque o mesmo
  // relatório gerado amanhã pode dar outro número.
  const infos: [string, string][] = [
    ["Gerado em", formatDateTime(geradoEm)],
    // O corte e por competencia (coluna "Grau minimo" da tabela), nao mais um nivel unico.
    ["Colaboradores na unidade", String(rel.qtd_colaboradores)],
    [
      "Com Resultado Final",
      `${rel.colaboradores_avaliados} de ${rel.qtd_colaboradores}`,
    ],
    // Deixa registrado de qual matriz saiu o "necessário" — um rascunho ainda pode mudar.
    [
      "Matriz de referência",
      rel.matriz_status === "validado_final"
        ? `Validada${rel.matriz_validada_em ? " em " + new Date(rel.matriz_validada_em).toLocaleDateString("pt-BR") : ""}`
        : "Em elaboração (sem validação final)",
    ],
    ["Competências analisadas", String(rel.total_competencias)],
    ["Competências com débito", String(rel.competencias_com_debito)],
    ["Cobertura geral", `${rel.cobertura_geral_percentual}%`],
    // A explicação da unidade vai no VALOR, não no rótulo: a coluna do rótulo tem 60mm e
    // um título longo quebrava em duas linhas dentro de uma célula de altura fixa.
    ["Débito total", `${rel.soma_debito} lacunas (colaborador × competência)`],
    // Recorte só entre quem tem Resultado Final — falta de competência, sem o ruído da
    // falta de avaliação.
    [
      "Débito entre avaliados",
      `${rel.soma_debito_avaliados} de ${rel.soma_necessario_avaliados} possíveis`,
    ],
  ];
  const rowH = 7;
  const labelW = 60;
  for (const [label, value] of infos) {
    // A altura sai do conteúdo: com altura fixa, um texto que quebrasse em duas linhas
    // transbordava a célula e a segunda linha aparecia cortada.
    const linhasLabel = doc.splitTextToSize(label, labelW - 6) as string[];
    const linhasValor = doc.splitTextToSize(
      value,
      CONTENT_WIDTH - labelW - 6,
    ) as string[];
    const alturaLinha = Math.max(
      rowH,
      Math.max(linhasLabel.length, linhasValor.length) * 4.5 + 3,
    );
    drawWrappedCell(doc, linhasLabel, MARGIN_LEFT, y, labelW, alturaLinha, {
      bold: true,
      bg: GRAY_LIGHT,
    });
    drawWrappedCell(
      doc,
      linhasValor,
      MARGIN_LEFT + labelW,
      y,
      CONTENT_WIDTH - labelW,
      alturaLinha,
    );
    y += alturaLinha;
  }
  y += 8;

  // ── Aviso de cobertura ───────────────────────────────────────────────────
  // Sem isso o número de "possuem" engana: quem não foi avaliado nunca conta como apto.
  if (rel.colaboradores_avaliados < rel.qtd_colaboradores) {
    const faltam = rel.qtd_colaboradores - rel.colaboradores_avaliados;
    doc.setFillColor(255, 247, 224);
    doc.setDrawColor(217, 164, 6);
    doc.setLineWidth(0.3);
    const aviso = doc.splitTextToSize(
      `Atenção: ${faltam} colaborador(es) da unidade ainda não têm Resultado Final calculado. ` +
        `Eles não entram na coluna "Possuem", então o débito apurado é o pior cenário.`,
      CONTENT_WIDTH - 8,
    );
    const avisoH = aviso.length * 4.5 + 6;
    doc.rect(MARGIN_LEFT, y, CONTENT_WIDTH, avisoH, "FD");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(120, 80, 0);
    doc.text(aviso, MARGIN_LEFT + 4, y + 5);
    y += avisoH + 8;
  }

  // ── Tabela ───────────────────────────────────────────────────────────────
  const colW = [78, 22, 22, 22, 22, 14];
  const heads = [
    "Competência",
    "Grau mín.",
    "Necess.",
    "Possuem",
    "Débito",
    "%",
  ];
  const drawHeadRow = (yy: number) => {
    let x = MARGIN_LEFT;
    heads.forEach((h, i) => {
      drawTextCell(doc, h, x, yy, colW[i], rowH, {
        bold: true,
        bg: GRAY_LIGHT,
        align: i === 0 ? "left" : "center",
        fontSize: 8.5,
      });
      x += colW[i];
    });
    return yy + rowH;
  };
  y = drawHeadRow(y);

  for (const linha of rel.competencias) {
    // Nome de competência é texto livre e costuma ser longo ("Gerenciamento de Configurações
    // e de Ativos de Serviço"). A linha cresce conforme a quebra, senão o nome sai cortado.
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const linhasNome = doc.splitTextToSize(
      linha.competencia_nome || "—",
      colW[0] - 6,
    ) as string[];
    const alturaLinha = Math.max(rowH, linhasNome.length * 4.2 + 3);

    if (y + alturaLinha > FOOTER_Y - 5) {
      doc.addPage();
      y = 20;
      y = drawHeadRow(y);
    }
    const emDebito = linha.debito > 0;
    const numeros: [string, boolean][] = [
      [grauLabel(linha.grau_minimo_esperado), false],
      [String(linha.necessario), false],
      [String(linha.possuem), false],
      [String(linha.debito), emDebito],
      [`${linha.cobertura_percentual}%`, false],
    ];
    drawWrappedCell(doc, linhasNome, MARGIN_LEFT, y, colW[0], alturaLinha, {
      fontSize: 8.5,
    });
    let x = MARGIN_LEFT + colW[0];
    numeros.forEach(([texto, destaca], i) => {
      drawTextCell(doc, texto, x, y, colW[i + 1], alturaLinha, {
        align: "center",
        fontSize: 8.5,
        bold: destaca,
        color: destaca ? [185, 28, 28] : BLACK,
      });
      x += colW[i + 1];
    });
    y += alturaLinha;
  }

  if (rel.competencias.length === 0) {
    drawTextCell(
      doc,
      "Nenhuma competência técnica com aplicabilidade declarada na Matriz da equipe.",
      MARGIN_LEFT,
      y,
      CONTENT_WIDTH,
      rowH,
    );
  }

  const total = doc.getNumberOfPages();
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    addFooter(doc, i, total);
  }

  // Abrir PDF em nova aba — mesmo comportamento dos demais geradores do módulo (o visualizador
  // do navegador já oferece o download). Baixar direto foge do padrão das outras telas.
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
