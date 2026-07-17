import jsPDF from "jspdf";
import { PopCriado } from "../services/popsCriadosApi";
import { BRASAO_GOIAS_BASE64 } from "./brasaoBase64";

// ============================================================
// Gerador de PDF do POP (Procedimento Operacional Padrão) — layout institucional SGQ,
// o mais fiel possível ao modelo do TJGO.
// ============================================================

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 22;

const SECTION_BLUE: [number, number, number] = [68, 114, 196]; // #4472C4
const TEXT_DARK: [number, number, number] = [33, 37, 41];
const BORDER: [number, number, number] = [140, 150, 165];
const WHITE: [number, number, number] = [255, 255, 255];

function formatData(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  return v;
}

/** Divide um texto (com \n) em itens de lista, ignorando linhas vazias. */
function linhas(texto: string | null | undefined): string[] {
  return (texto || "")
    .split("\n")
    .map((l) => l.replace(/^[-•\s]+/, "").trim())
    .filter(Boolean);
}

function lineHeight(fontSize: number): number {
  return fontSize * 0.3528 * 1.35 + 0.3;
}

// ── Cabeçalho institucional (repetido em cada página) ─────────────────
function drawHeader(doc: jsPDF, pop: PopCriado): number {
  const y = MARGIN;
  const leftW = 40;
  const rightW = 26;
  const centerW = CONTENT_W - leftW - rightW;
  const h = 26;

  // Molduras
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, leftW, h, "S");
  doc.rect(MARGIN + leftW + centerW, y, rightW, h, "S");

  // ── Esquerda: brasão + órgão ──
  const brasaoW = 11;
  const brasaoX = MARGIN + (leftW - brasaoW) / 2;
  doc.addImage(
    BRASAO_GOIAS_BASE64,
    "PNG",
    brasaoX,
    y + 1.5,
    brasaoW,
    brasaoW,
    undefined,
    "FAST",
  );
  let ly = y + brasaoW + 3.5;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  doc.text("PODER JUDICIÁRIO", MARGIN + leftW / 2, ly, { align: "center" });
  ly += 2.6;
  doc.setFontSize(5);
  doc.setFont("helvetica", "normal");
  doc.text("Tribunal de Justiça do Estado de Goiás", MARGIN + leftW / 2, ly, {
    align: "center",
  });
  ly += 3;
  doc.setFontSize(6);
  doc.setFont("helvetica", "bold");
  const orgLines = [pop.diretoria_orgao, pop.unidade_orgao].filter(
    Boolean,
  ) as string[];
  for (const line of orgLines) {
    const wrapped = doc.splitTextToSize(line, leftW - 3) as string[];
    for (const w of wrapped) {
      doc.text(w, MARGIN + leftW / 2, ly, { align: "center" });
      ly += 2.5;
    }
  }

  // ── Centro: 3 linhas (nome do processo / POP / macroprocesso) ──
  const cx = MARGIN + leftW;
  const row1 = h * 0.45;
  const row2 = h * 0.275;
  const row3 = h - row1 - row2;
  doc.rect(cx, y, centerW, row1, "S");
  doc.rect(cx, y + row1, centerW, row2, "S");
  doc.rect(cx, y + row1 + row2, centerW, row3, "S");

  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...TEXT_DARK);
  const nome = (pop.nome_processo || "NOME DO PROCESSO").toUpperCase();
  const nomeWrapped = doc.splitTextToSize(nome, centerW - 6) as string[];
  doc.text(nomeWrapped.slice(0, 2), cx + centerW / 2, y + row1 / 2 - 0.5, {
    align: "center",
    baseline: "middle",
  });

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(
    "Procedimento Operacional Padrão (POP)",
    cx + centerW / 2,
    y + row1 + row2 / 2,
    { align: "center", baseline: "middle" },
  );

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(
    `Macroprocesso: ${pop.macroprocesso || "—"}`,
    cx + centerW / 2,
    y + row1 + row2 + row3 / 2,
    { align: "center", baseline: "middle" },
  );

  // ── Direita: selo SGQ (desenhado, sem asset) ──
  const sx = MARGIN + leftW + centerW;
  doc.setFillColor(...SECTION_BLUE);
  doc.roundedRect(sx + 4, y + 5, rightW - 8, 10, 1.5, 1.5, "F");
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text("SGQ", sx + rightW / 2, y + 11, {
    align: "center",
    baseline: "middle",
  });
  doc.setFontSize(4);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...TEXT_DARK);
  doc.text("SISTEMA DE GESTÃO", sx + rightW / 2, y + 18, { align: "center" });
  doc.text("DA QUALIDADE", sx + rightW / 2, y + 20.5, { align: "center" });

  return y + h + 5;
}

// ── Barra azul numerada da seção ─────────────────
function drawSectionBar(
  doc: jsPDF,
  num: number,
  title: string,
  y: number,
): number {
  const h = 6.5;
  doc.setFillColor(...SECTION_BLUE);
  doc.rect(MARGIN, y, CONTENT_W, h, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(`${num}. ${title}`, MARGIN + 2.5, y + h / 2, { baseline: "middle" });
  return y + h;
}

// ── Caixa de conteúdo (texto livre) ─────────────────
function drawTextBox(
  doc: jsPDF,
  texto: string,
  y: number,
  minH = 9,
  italic = false,
): number {
  const fs = 9;
  doc.setFontSize(fs);
  doc.setFont("helvetica", italic ? "italic" : "normal");
  const inner = CONTENT_W - 6;
  const wrapped = doc.splitTextToSize(texto || "—", inner) as string[];
  const lh = lineHeight(fs);
  const h = Math.max(minH, wrapped.length * lh + 4);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, h, "S");
  doc.setTextColor(...TEXT_DARK);
  wrapped.forEach((line, i) => {
    doc.text(line, MARGIN + 3, y + 3.5 + i * lh);
  });
  return y + h;
}

// ── Caixa com lista de bullets ─────────────────
function drawBulletBox(
  doc: jsPDF,
  itens: string[],
  y: number,
  minH = 9,
): number {
  const fs = 9;
  const lh = lineHeight(fs);
  const inner = CONTENT_W - 10;
  doc.setFontSize(fs);
  doc.setFont("helvetica", "normal");
  const blocos = itens.map((it) => doc.splitTextToSize(it, inner) as string[]);
  const totalLines = blocos.reduce((a, b) => a + b.length, 0) || 1;
  const h = Math.max(minH, totalLines * lh + 4);
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, CONTENT_W, h, "S");
  doc.setTextColor(...TEXT_DARK);
  let cy = y + 3.5;
  if (itens.length === 0) {
    doc.text("—", MARGIN + 3, cy);
  } else {
    blocos.forEach((linhasItem) => {
      doc.text("•", MARGIN + 4, cy);
      linhasItem.forEach((line, i) => {
        doc.text(line, MARGIN + 8, cy + i * lh);
      });
      cy += linhasItem.length * lh;
    });
  }
  return y + h;
}

// ── Seção 10: Validação (3 colunas) ─────────────────
function drawValidacao(doc: jsPDF, pop: PopCriado, y: number): number {
  const colW = CONTENT_W / 3;
  const h = 20;
  const labels = ["Proposto por:", "Analisado por:", "Aprovado por:"];
  const valores = [pop.proposto_por, pop.analisado_por, pop.aprovado_por];
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  for (let i = 0; i < 3; i++) {
    const x = MARGIN + colW * i;
    doc.rect(x, y, colW, h, "S");
    doc.setFontSize(8.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    doc.text(labels[i], x + 3, y + 5);
    doc.setFont("helvetica", "normal");
    const wrapped = doc.splitTextToSize(
      valores[i] || "",
      colW - 6,
    ) as string[];
    wrapped.forEach((line, j) => doc.text(line, x + 3, y + 11 + j * 4));
  }
  return y + h;
}

function drawFooter(
  doc: jsPDF,
  pop: PopCriado,
  pageNum: number,
  totalPages: number,
): void {
  const y = FOOTER_Y;
  const h = 11;
  const widths = [CONTENT_W * 0.34, CONTENT_W * 0.24, CONTENT_W * 0.21];
  widths.push(CONTENT_W - widths[0] - widths[1] - widths[2]);
  const cells = [
    { label: `POP-${pop.codigo || "—"}`, value: pop.nome_processo || "" },
    { label: "Data:", value: formatData(pop.data_versao) },
    { label: "Revisão:", value: pop.revisao || "00" },
    { label: "Página", value: `${pageNum} de ${totalPages}` },
  ];
  let x = MARGIN;
  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  cells.forEach((c, i) => {
    const w = widths[i];
    doc.rect(x, y, w, h, "S");
    doc.setFontSize(7);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(120, 128, 138);
    doc.text(c.label, x + 2, y + 3.5);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...TEXT_DARK);
    const wrapped = doc.splitTextToSize(c.value, w - 4) as string[];
    doc.text(wrapped.slice(0, 2), x + 2, y + 7.5);
    x += w;
  });
}

interface Secao {
  num: number;
  titulo: string;
  tipo: "texto" | "lista" | "validacao";
  valor?: string | null;
  minH?: number;
  italic?: boolean;
}

export function generatePopPDF(pop: PopCriado): void {
  const doc = new jsPDF("p", "mm", "a4");

  const secoes: Secao[] = [
    { num: 1, titulo: "Serviço", tipo: "texto", valor: pop.servico },
    { num: 2, titulo: "Objetivo", tipo: "texto", valor: pop.objetivo },
    {
      num: 3,
      titulo: "Unidade Responsável",
      tipo: "texto",
      valor: pop.unidade_responsavel,
      minH: 14,
    },
    { num: 4, titulo: "Siglas", tipo: "lista", valor: pop.siglas },
    { num: 5, titulo: "Normativa", tipo: "lista", valor: pop.normativa },
    {
      num: 6,
      titulo: "Descrição do Procedimento",
      tipo: "texto",
      valor: pop.descricao_procedimento,
      minH: 16,
    },
    {
      num: 7,
      titulo: "Gestor do Processo",
      tipo: "texto",
      valor: pop.gestor_processo,
    },
    {
      num: 8,
      titulo: "Sistemas Utilizados",
      tipo: "lista",
      valor: pop.sistemas_utilizados,
    },
    { num: 9, titulo: "Anexos", tipo: "lista", valor: pop.anexos },
    { num: 10, titulo: "Validação", tipo: "validacao" },
  ];

  let y = drawHeader(doc, pop);

  for (const sec of secoes) {
    // Estimativa da altura da seção (barra + conteúdo) p/ evitar título órfão.
    const fs = 9;
    const lh = lineHeight(fs);
    let estH = 6.5 + (sec.minH || 9);
    if (sec.tipo === "validacao") estH = 6.5 + 20;
    else if (sec.tipo === "lista") {
      const its = linhas(sec.valor);
      estH = 6.5 + Math.max(sec.minH || 9, (its.length || 1) * lh + 4);
    } else {
      doc.setFontSize(fs);
      doc.setFont("helvetica", "normal");
      const wrapped = doc.splitTextToSize(
        sec.valor || "—",
        CONTENT_W - 6,
      ) as string[];
      estH = 6.5 + Math.max(sec.minH || 9, wrapped.length * lh + 4);
    }

    if (y + estH > FOOTER_Y - 4) {
      doc.addPage();
      y = drawHeader(doc, pop);
    }

    y = drawSectionBar(doc, sec.num, sec.titulo, y);
    if (sec.tipo === "validacao") {
      y = drawValidacao(doc, pop, y);
    } else if (sec.tipo === "lista") {
      y = drawBulletBox(doc, linhas(sec.valor), y, sec.minH);
    } else {
      y = drawTextBox(doc, sec.valor || "—", y, sec.minH, sec.italic);
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pop, i, totalPages);
  }

  window.open(doc.output("bloburl") as unknown as string, "_blank");
}
