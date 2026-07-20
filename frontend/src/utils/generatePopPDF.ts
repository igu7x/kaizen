import jsPDF from "jspdf";
import { PopCriado } from "../services/popsCriadosApi";
import { BRASAO_GOIAS_BASE64 } from "./brasaoBase64";

// ============================================================
// Gerador de PDF do POP (Procedimento Operacional Padrão) — layout institucional SGQ,
// o mais fiel possível ao modelo do TJGO.
//
// O conteúdo FLUI entre páginas: uma seção só é empurrada para a página seguinte se não
// couber o cabeçalho da seção + ao menos duas linhas de texto. Caso contrário ela começa
// na página atual e continua na próxima, sem deixar espaços vazios.
// ============================================================

const PAGE_W = 210;
const PAGE_H = 297;
const MARGIN = 15;
const CONTENT_W = PAGE_W - MARGIN * 2;
const FOOTER_Y = PAGE_H - 22;
/** Limite inferior do conteúdo (acima do rodapé). */
const LIMITE_Y = FOOTER_Y - 4;

const SECTION_BLUE: [number, number, number] = [68, 114, 196]; // #4472C4
const TEXT_DARK: [number, number, number] = [33, 37, 41];
const BORDER: [number, number, number] = [140, 150, 165];
const WHITE: [number, number, number] = [255, 255, 255];

const BAR_H = 6.5;
const FONT_SIZE = 9;

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

/** Carrega a logo do SGQ (public/) como data URL para embutir no PDF. */
async function carregarLogoSgq(): Promise<string | null> {
  try {
    const res = await fetch("/logoSGQsemfundo.png");
    if (!res.ok) return null;
    const blob = await res.blob();
    return await new Promise<string | null>((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}

/** Uma linha já quebrada, pronta para desenhar. */
interface LinhaPdf {
  texto: string;
  /** true = primeira linha de um item de lista (desenha o "•"). */
  bullet?: boolean;
  /** true = linha de continuação de um item de lista (indentada). */
  indent?: boolean;
}

// ── Cabeçalho institucional (repetido em cada página) ─────────────────
function drawHeader(doc: jsPDF, pop: PopCriado, logoSgq: string | null): number {
  const y = MARGIN;
  const leftW = 40;
  const rightW = 26;
  const centerW = CONTENT_W - leftW - rightW;
  const h = 26;

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

  // ── Direita: logo do SGQ (imagem real; fallback desenhado se não carregar) ──
  const sx = MARGIN + leftW + centerW;
  if (logoSgq) {
    try {
      const props = doc.getImageProperties(logoSgq);
      const maxW = rightW - 5;
      const maxH = h - 5;
      const escala = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * escala;
      const hh = props.height * escala;
      doc.addImage(
        logoSgq,
        "PNG",
        sx + (rightW - w) / 2,
        y + (h - hh) / 2,
        w,
        hh,
        undefined,
        "FAST",
      );
    } catch {
      /* se a imagem falhar, segue sem a logo */
    }
  } else {
    doc.setFillColor(...SECTION_BLUE);
    doc.roundedRect(sx + 4, y + 5, rightW - 8, 10, 1.5, 1.5, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...WHITE);
    doc.text("SGQ", sx + rightW / 2, y + 11, {
      align: "center",
      baseline: "middle",
    });
  }

  return y + h + 5;
}

// ── Barra azul numerada da seção ─────────────────
function drawSectionBar(
  doc: jsPDF,
  num: number,
  title: string,
  y: number,
): number {
  doc.setFillColor(...SECTION_BLUE);
  doc.rect(MARGIN, y, CONTENT_W, BAR_H, "F");
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...WHITE);
  doc.text(`${num}. ${title}`, MARGIN + 2.5, y + BAR_H / 2, {
    baseline: "middle",
  });
  return y + BAR_H;
}

/**
 * Desenha as linhas em caixas, quebrando de página quando necessário: preenche a página
 * atual até o limite e continua na próxima, em vez de empurrar o bloco inteiro.
 */
function drawLinhasComQuebra(
  doc: jsPDF,
  pop: PopCriado,
  logoSgq: string | null,
  itens: LinhaPdf[],
  y: number,
  minH: number,
): number {
  const lh = lineHeight(FONT_SIZE);
  doc.setFontSize(FONT_SIZE);
  doc.setFont("helvetica", "normal");

  if (itens.length === 0) itens = [{ texto: "—" }];

  let idx = 0;
  let primeiroBloco = true;
  while (idx < itens.length) {
    let cabem = Math.floor((LIMITE_Y - y - 4) / lh);
    if (cabem < 1) {
      doc.addPage();
      y = drawHeader(doc, pop, logoSgq);
      cabem = Math.floor((LIMITE_Y - y - 4) / lh);
    }
    const qtd = Math.min(cabem, itens.length - idx);
    const alturaTexto = qtd * lh + 4;
    const h = primeiroBloco ? Math.max(minH, alturaTexto) : alturaTexto;

    doc.setDrawColor(...BORDER);
    doc.setLineWidth(0.3);
    doc.rect(MARGIN, y, CONTENT_W, h, "S");
    doc.setTextColor(...TEXT_DARK);
    doc.setFontSize(FONT_SIZE);
    doc.setFont("helvetica", "normal");

    for (let i = 0; i < qtd; i++) {
      const item = itens[idx + i];
      const baseline = y + 3.5 + i * lh;
      if (item.bullet) doc.text("•", MARGIN + 4, baseline);
      doc.text(item.texto, MARGIN + (item.bullet || item.indent ? 8 : 3), baseline);
    }

    idx += qtd;
    y += h;
    primeiroBloco = false;

    if (idx < itens.length) {
      doc.addPage();
      y = drawHeader(doc, pop, logoSgq);
    }
  }
  return y;
}

/** Quebra texto livre (respeitando \n) em linhas prontas. */
function linhasDeTexto(doc: jsPDF, texto: string): LinhaPdf[] {
  doc.setFontSize(FONT_SIZE);
  doc.setFont("helvetica", "normal");
  const out: LinhaPdf[] = [];
  for (const paragrafo of (texto || "—").split("\n")) {
    if (!paragrafo.trim()) {
      out.push({ texto: "" });
      continue;
    }
    const wrapped = doc.splitTextToSize(paragrafo, CONTENT_W - 6) as string[];
    wrapped.forEach((l) => out.push({ texto: l }));
  }
  return out;
}

/** Quebra uma lista em linhas prontas (marcador na primeira linha de cada item). */
function linhasDeLista(doc: jsPDF, itens: string[]): LinhaPdf[] {
  doc.setFontSize(FONT_SIZE);
  doc.setFont("helvetica", "normal");
  const out: LinhaPdf[] = [];
  for (const item of itens) {
    const wrapped = doc.splitTextToSize(item, CONTENT_W - 12) as string[];
    wrapped.forEach((l, i) =>
      out.push(i === 0 ? { texto: l, bullet: true } : { texto: l, indent: true }),
    );
  }
  return out;
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
    const wrapped = doc.splitTextToSize(valores[i] || "", colW - 6) as string[];
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
}

export async function generatePopPDF(pop: PopCriado): Promise<void> {
  const doc = new jsPDF("p", "mm", "a4");
  const logoSgq = await carregarLogoSgq();

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

  let y = drawHeader(doc, pop, logoSgq);
  const lh = lineHeight(FONT_SIZE);
  // Só empurra a seção para a próxima página se não couber a barra + 2 linhas.
  const minimoSecao = BAR_H + 2 * lh + 4;

  for (const sec of secoes) {
    const necessario = sec.tipo === "validacao" ? BAR_H + 20 : minimoSecao;
    if (y + necessario > LIMITE_Y) {
      doc.addPage();
      y = drawHeader(doc, pop, logoSgq);
    }

    y = drawSectionBar(doc, sec.num, sec.titulo, y);

    if (sec.tipo === "validacao") {
      y = drawValidacao(doc, pop, y);
    } else if (sec.tipo === "lista") {
      y = drawLinhasComQuebra(
        doc,
        pop,
        logoSgq,
        linhasDeLista(doc, linhas(sec.valor)),
        y,
        sec.minH || 9,
      );
    } else {
      y = drawLinhasComQuebra(
        doc,
        pop,
        logoSgq,
        linhasDeTexto(doc, sec.valor || "—"),
        y,
        sec.minH || 9,
      );
    }
    y += 1.5;
  }

  // Anexo: imagem do fluxograma, em página própria, escalada para caber sem distorcer.
  if (pop.fluxograma_data) {
    try {
      const props = doc.getImageProperties(pop.fluxograma_data);
      doc.addPage();
      let ay = drawHeader(doc, pop, logoSgq);
      ay = drawSectionBar(doc, 11, "Anexo — Fluxograma", ay) + 3;
      const maxW = CONTENT_W;
      const maxH = LIMITE_Y - ay;
      const escala = Math.min(maxW / props.width, maxH / props.height);
      const w = props.width * escala;
      const h = props.height * escala;
      doc.addImage(
        pop.fluxograma_data,
        /^data:image\/jpe?g/i.test(pop.fluxograma_data) ? "JPEG" : "PNG",
        MARGIN + (CONTENT_W - w) / 2,
        ay,
        w,
        h,
        undefined,
        "FAST",
      );
    } catch {
      /* imagem inválida: o PDF sai sem o anexo */
    }
  }

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pop, i, totalPages);
  }

  window.open(doc.output("bloburl") as unknown as string, "_blank");
}
