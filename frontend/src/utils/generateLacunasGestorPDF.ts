import jsPDF from "jspdf";
import { LOGO_BRANCO_4K_BASE64 } from "./logoBranco4kBase64";
import { NOTA_TECNICA_LABELS } from "@/constants/competencias";
import type { RelatorioLacunasGestor } from "@/services/lacunasCompetenciasApi";

// Mesmas constantes dos demais geradores do módulo, para o PDF sair no mesmo padrão visual.
const BLACK = [0, 0, 0] as const;
const GRAY_LIGHT = [245, 245, 245] as const;
const VERDE = [4, 120, 87] as const;
const VERMELHO = [185, 28, 28] as const;
const CINZA = [120, 120, 120] as const;
const PAGE_WIDTH = 210;
const PAGE_HEIGHT = 297;
const MARGIN_LEFT = 15;
const MARGIN_RIGHT = 15;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN_LEFT - MARGIN_RIGHT;
const FOOTER_Y = PAGE_HEIGHT - 15;

/**
 * Grau/nota em duas linhas — número e nível. Numa coluna estreita, "3 — Intermediário" numa linha
 * só não cabe e a quebra automática do jsPDF transborda a célula.
 */
const nivelLinhas = (n: number | null): string[] =>
  n == null ? ["—"] : [String(n), NOTA_TECNICA_LABELS[n] || ""];

const situacaoTexto = (
  nota: number | null,
  atingiu: boolean,
  debito: number | null,
): string => {
  if (nota == null) return "Não avaliada";
  if (atingiu) return "Alcançada";
  return debito === 1 ? "Falta 1 nível" : `Faltam ${debito} níveis`;
};

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
  doc.text("Lacunas de Competências do Gestor", MARGIN_LEFT, FOOTER_Y);
  doc.text(
    `Página ${pageNum} de ${totalPages}`,
    PAGE_WIDTH - MARGIN_RIGHT,
    FOOTER_Y,
    { align: "right" },
  );
}

/**
 * Célula com texto já quebrado em linhas: a altura vem do chamador, calculada a partir da
 * contagem de linhas. É o que impede o texto de transbordar a borda quando quebra.
 */
function drawCell(
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
    align?: "left" | "center";
    color?: readonly [number, number, number];
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
  doc.setTextColor(...(options?.color ?? BLACK));
  const centralizado = options?.align === "center";
  const tx = centralizado ? x + w / 2 : x + 3;
  let ty = y + (h - lines.length * alturaLinha) / 2 + 3.2;
  for (const line of lines) {
    doc.text(line, tx, ty, centralizado ? { align: "center" } : undefined);
    ty += alturaLinha;
  }
}

function drawHeader(doc: jsPDF, rel: RelatorioLacunasGestor) {
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
  doc.text("Inventário do Gestor", MARGIN_LEFT + 5, 27, {
    maxWidth: leftMaxW,
  });
  doc.setFontSize(10);
  doc.setTextColor(200, 210, 230);
  const lotacao = `${rel.area_sigla || ""}${rel.unidade_nome ? ": " + rel.unidade_nome : ""}`;
  doc.text(doc.splitTextToSize(lotacao, leftMaxW), MARGIN_LEFT + 5, 36);
  doc.setFontSize(9);
  doc.setTextColor(180, 195, 220);
  doc.text(
    doc.splitTextToSize(`Gestor: ${rel.gestor_nome || "—"}`, leftMaxW),
    MARGIN_LEFT + 5,
    45,
  );

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

export function generateLacunasGestorPDF(rel: RelatorioLacunasGestor) {
  const doc = new jsPDF("p", "mm", "a4");
  drawHeader(doc, rel);
  let y = 55 + 8;

  // ── Parâmetros ───────────────────────────────────────────────────────────
  // O relatório é uma FOTOGRAFIA: registra o momento e a matriz de referência, porque o mesmo
  // relatório gerado amanhã pode dar outro número.
  const infos: [string, string][] = [
    ["Gerado em", formatDateTime(new Date())],
    [
      "Matriz de referência",
      rel.matriz_status === "validado_final"
        ? `Validada${rel.matriz_validada_em ? " em " + new Date(rel.matriz_validada_em).toLocaleDateString("pt-BR") : ""}`
        : "Em elaboração (sem validação final)",
    ],
    ["Competências analisadas", String(rel.total_competencias)],
    [
      "Com nota no Resultado Final",
      `${rel.competencias_avaliadas} de ${rel.total_competencias}`,
    ],
    ["Alcançadas", String(rel.atingidas)],
    ["Em débito", String(rel.em_debito)],
    [
      "Níveis a evoluir",
      rel.soma_debito_niveis === 1
        ? "1 nível"
        : `${rel.soma_debito_niveis} níveis`,
    ],
    ["Alcance", `${rel.percentual_alcance}% das competências avaliadas`],
  ];
  const rowH = 7;
  const labelW = 60;
  for (const [label, value] of infos) {
    const linhasLabel = doc.splitTextToSize(label, labelW - 6) as string[];
    const linhasValor = doc.splitTextToSize(
      value,
      CONTENT_WIDTH - labelW - 6,
    ) as string[];
    const h = Math.max(
      rowH,
      Math.max(linhasLabel.length, linhasValor.length) * 4.5 + 3,
    );
    drawCell(doc, linhasLabel, MARGIN_LEFT, y, labelW, h, {
      bold: true,
      bg: GRAY_LIGHT,
    });
    drawCell(
      doc,
      linhasValor,
      MARGIN_LEFT + labelW,
      y,
      CONTENT_WIDTH - labelW,
      h,
    );
    y += h;
  }
  y += 8;

  // ── Aviso de ausência de Resultado Final ─────────────────────────────────
  // Sem ele o relatório pareceria dizer que o gestor não domina nada.
  if (!rel.tem_resultado_final) {
    doc.setFillColor(255, 247, 224);
    doc.setDrawColor(217, 164, 6);
    doc.setLineWidth(0.3);
    const aviso = doc.splitTextToSize(
      "Atenção: este gestor ainda não tem Resultado Final calculado no inventário do gestor. " +
        "Sem nota não há o que comparar — as competências aparecem como não avaliadas.",
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
  const colW = [76, 28, 28, 48];
  const heads = ["Competência", "Grau mín.", "Nota", "Situação"];
  const drawHeadRow = (yy: number) => {
    let x = MARGIN_LEFT;
    heads.forEach((h, i) => {
      drawCell(doc, [h], x, yy, colW[i], rowH, {
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
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "normal");
    const linhasNome = doc.splitTextToSize(
      linha.competencia_nome || "—",
      colW[0] - 6,
    ) as string[];
    const linhasGrau = nivelLinhas(linha.grau_minimo_esperado);
    const linhasNota = nivelLinhas(linha.nota);
    const situacao = situacaoTexto(
      linha.nota,
      linha.atingiu,
      linha.debito_niveis,
    );
    const linhasSituacao = doc.splitTextToSize(
      situacao,
      colW[3] - 6,
    ) as string[];
    const h = Math.max(
      rowH,
      Math.max(
        linhasNome.length,
        linhasGrau.length,
        linhasNota.length,
        linhasSituacao.length,
      ) *
        4.2 +
        3,
    );

    if (y + h > FOOTER_Y - 5) {
      doc.addPage();
      y = 20;
      y = drawHeadRow(y);
    }

    const corSituacao =
      linha.nota == null ? CINZA : linha.atingiu ? VERDE : VERMELHO;

    let x = MARGIN_LEFT;
    drawCell(doc, linhasNome, x, y, colW[0], h, { fontSize: 8.5 });
    x += colW[0];
    drawCell(doc, linhasGrau, x, y, colW[1], h, {
      fontSize: 8.5,
      align: "center",
    });
    x += colW[1];
    drawCell(doc, linhasNota, x, y, colW[2], h, {
      fontSize: 8.5,
      align: "center",
    });
    x += colW[2];
    drawCell(doc, linhasSituacao, x, y, colW[3], h, {
      fontSize: 8.5,
      align: "center",
      bold: linha.nota != null && !linha.atingiu,
      color: corSituacao,
    });
    y += h;
  }

  if (rel.competencias.length === 0) {
    drawCell(
      doc,
      ["A Matriz do Gestor desta unidade não tem competências cadastradas."],
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

  // Abre em nova aba — mesmo comportamento dos demais geradores do módulo.
  const blobUrl = doc.output("bloburl");
  window.open(blobUrl as unknown as string, "_blank");
}
