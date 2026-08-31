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

/**
 * Medidas da PÁGINA ATUAL. O fluxograma passou a ter uma página própria em PAISAGEM, então
 * largura e rodapé deixaram de ser constantes: cabeçalho, barra de seção e rodapé precisam ler
 * do documento, senão saem cortados ou fora da folha na página deitada.
 */
const larguraUtil = (doc: jsPDF): number =>
  doc.internal.pageSize.getWidth() - MARGIN * 2;
const rodapeY = (doc: jsPDF): number => doc.internal.pageSize.getHeight() - 22;

const SECTION_BLUE: [number, number, number] = [47, 79, 127]; // #2F4F7F
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
  /**
   * Trechos da linha com o estilo de cada um. Só vem preenchido quando o texto usa **negrito**;
   * sem isso a linha é desenhada de uma vez só, em regular.
   */
  trechos?: { texto: string; negrito: boolean }[];
}

// ── Cabeçalho institucional (repetido em cada página) ─────────────────
function drawHeader(doc: jsPDF, pop: PopCriado, logoSgq: string | null): number {
  const y = MARGIN;
  const leftW = 40;
  const rightW = 26;
  const centerW = larguraUtil(doc) - leftW - rightW;
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
  doc.setFont("helvetica", "bold");
  const orgLines = [pop.diretoria_orgao, pop.unidade_orgao].filter(
    Boolean,
  ) as string[];
  // Ajusta a fonte quando o texto do órgão é extenso, para caber na altura da caixa (não estourar).
  const orgBottom = y + h - 1; // limite inferior da caixa esquerda
  let orgFs = 6;
  let orgWrapped: string[] = [];
  let orgLh = 2.5;
  for (const cand of [6, 5.5, 5, 4.5, 4, 3.6]) {
    doc.setFontSize(cand);
    const wl = orgLines.flatMap(
      (l) => doc.splitTextToSize(l, leftW - 2.5) as string[],
    );
    const lh = cand * 0.42;
    orgFs = cand;
    orgWrapped = wl;
    orgLh = lh;
    if (ly + wl.length * lh <= orgBottom) break; // coube: usa este tamanho
  }
  doc.setFontSize(orgFs);
  for (const w of orgWrapped) {
    doc.text(w, MARGIN + leftW / 2, ly, { align: "center" });
    ly += orgLh;
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
  doc.setFont("helvetica", "bold");
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
  doc.rect(MARGIN, y, larguraUtil(doc), BAR_H, "F");
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
      const x0 = MARGIN + (item.bullet || item.indent ? 8 : 3);
      if (!item.trechos) {
        doc.text(item.texto, x0, baseline);
        continue;
      }
      // Linha com **negrito**: desenha trecho a trecho, avançando pela largura já medida na
      // fonte de cada um (getTextWidth usa a fonte corrente, por isso o setFont vem antes).
      let x = x0;
      for (const t of item.trechos) {
        doc.setFont("helvetica", t.negrito ? "bold" : "normal");
        doc.text(t.texto, x, baseline);
        x += doc.getTextWidth(t.texto);
      }
      doc.setFont("helvetica", "normal");
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

/**
 * Separa a marcação **negrito** do texto.
 *
 * Devolve o texto SEM os asteriscos e um vetor paralelo dizendo, caractere a caractere, se ele
 * está em negrito. O vetor é o que permite reencontrar os trechos depois da quebra de linha —
 * o splitTextToSize não sabe nada de estilo.
 */
function separarNegrito(bruto: string): { limpo: string; negrito: boolean[] } {
  let limpo = "";
  const negrito: boolean[] = [];
  let emNegrito = false;
  for (let i = 0; i < bruto.length; i++) {
    if (bruto[i] === "*" && bruto[i + 1] === "*") {
      emNegrito = !emNegrito;
      i++;
      continue;
    }
    limpo += bruto[i];
    negrito.push(emNegrito);
  }
  return { limpo, negrito };
}

/** Agrupa o intervalo [ini, fim) do vetor de estilo em trechos contíguos. */
function trechosDe(
  linha: string,
  negrito: boolean[],
  ini: number,
): { texto: string; negrito: boolean }[] {
  const out: { texto: string; negrito: boolean }[] = [];
  for (let i = 0; i < linha.length; i++) {
    const b = negrito[ini + i] === true;
    const ultimo = out[out.length - 1];
    if (ultimo && ultimo.negrito === b) {
      ultimo.texto += linha[i];
    } else {
      out.push({ texto: linha[i], negrito: b });
    }
  }
  return out;
}

/** Quebra texto livre (respeitando \n) em linhas prontas, preservando **negrito**. */
function linhasDeTexto(doc: jsPDF, texto: string): LinhaPdf[] {
  doc.setFontSize(FONT_SIZE);
  doc.setFont("helvetica", "normal");
  const out: LinhaPdf[] = [];
  for (const paragrafoBruto of (texto || "—").split("\n")) {
    if (!paragrafoBruto.trim()) {
      out.push({ texto: "" });
      continue;
    }
    const { limpo, negrito } = separarNegrito(paragrafoBruto);
    const temNegrito = negrito.some(Boolean);
    // Com negrito na linha, quebra numa largura um pouco menor: o wrap é medido em regular e o
    // bold do helvetica é alguns por cento mais largo, o que faria a linha encostar na borda.
    const largura = CONTENT_W - (temNegrito ? 9 : 6);
    const wrapped = doc.splitTextToSize(limpo, largura) as string[];
    let cursor = 0;
    for (const l of wrapped) {
      if (!temNegrito) {
        out.push({ texto: l });
        continue;
      }
      // splitTextToSize devolve pedaços do próprio texto, então dá para reencontrar a posição
      // e recortar o estilo correspondente.
      const ini = limpo.indexOf(l, cursor);
      const de = ini >= 0 ? ini : cursor;
      cursor = de + l.length;
      out.push({ texto: l, trechos: trechosDe(l, negrito, de) });
    }
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

/**
 * Item 9 (Anexos): o fluxograma ganha uma PÁGINA PRÓPRIA e ocupa a LARGURA INTEIRA dela.
 *
 * O que deixava a imagem pequena não era a orientação da folha, era ela dividir a página com o
 * resto da seção: sobrava pouca altura e a escala caía junto. Numa página só dela, em retrato,
 * a altura deixa de ser o gargalo e a imagem passa a ser limitada pela LARGURA — ou seja, sai
 * nos 180mm cheios de conteúdo, que é como o fluxograma aparece no PDF do cadastro do processo
 * (generateProcessoNegocioPDF, seção "7. Modelagem / Fluxograma").
 *
 * Paisagem foi tentada antes e piorou: o cabeçalho institucional consome a mesma altura numa
 * folha 87mm mais baixa, então a imagem voltava a ser limitada pela altura e sobrava faixa
 * branca dos dois lados.
 *
 * A barra "9. Anexos" é desenhada AQUI, na página do anexo, e não pelo laço de seções: assim ela
 * não fica órfã no fim da página anterior. Devolve o y logo abaixo da imagem, para a seção 10
 * continuar na mesma página quando couber.
 */
function drawFluxograma(
  doc: jsPDF,
  pop: PopCriado,
  logoSgq: string | null,
  dataUrl: string,
): number {
  const props = doc.getImageProperties(dataUrl);

  doc.addPage();
  let y = drawHeader(doc, pop, logoSgq);
  y = drawSectionBar(doc, 9, "Anexos", y);

  const padding = 3;
  const boxW = larguraUtil(doc);
  const maxW = boxW - padding * 2;
  // A página é só do fluxograma, então a altura disponível é tudo que existe até o rodapé.
  const maxH = rodapeY(doc) - 4 - y - padding * 2;
  const escala = Math.min(maxW / props.width, maxH / props.height);
  const w = props.width * escala;
  const h = props.height * escala;

  doc.setDrawColor(...BORDER);
  doc.setLineWidth(0.3);
  doc.rect(MARGIN, y, boxW, h + padding * 2, "S");
  doc.addImage(
    dataUrl,
    /^data:image\/jpe?g/i.test(dataUrl) ? "JPEG" : "PNG",
    MARGIN + (boxW - w) / 2,
    y + padding,
    w,
    h,
    undefined,
    "FAST",
  );

  return y + h + padding * 2;
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
  const y = rodapeY(doc);
  const h = 11;
  const cw = larguraUtil(doc);
  const widths = [cw * 0.34, cw * 0.24, cw * 0.21];
  widths.push(cw - widths[0] - widths[1] - widths[2]);
  const cells = [
    { label: pop.codigo || "POP", value: pop.nome_processo || "" },
    { label: "Data:", value: formatData(pop.data_versao) },
    { label: "Revisão:", value: pop.revisao || "000" },
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

    // O fluxograma monta a página inteira dele (barra + imagem, em paisagem). Chamar antes da
     // barra evita deixá-la sozinha no fim da página retrato.
    if (sec.num === 9 && pop.fluxograma_data) {
      try {
        y = drawFluxograma(doc, pop, logoSgq, pop.fluxograma_data);
        continue;
      } catch {
        // imagem ilegível: segue para o caminho de texto, abaixo.
      }
    }

    y = drawSectionBar(doc, sec.num, sec.titulo, y);

    if (sec.tipo === "validacao") {
      y = drawValidacao(doc, pop, y);
    } else if (sec.num === 9) {
      // Sem fluxograma (ou com imagem ilegível): a seção fica com um traço.
      {
        y = drawLinhasComQuebra(
          doc,
          pop,
          logoSgq,
          linhasDeTexto(doc, "—"),
          y,
          sec.minH || 9,
        );
      }
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

  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    drawFooter(doc, pop, i, totalPages);
  }

  window.open(doc.output("bloburl") as unknown as string, "_blank");
}
