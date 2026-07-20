import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRASAO_GOIAS_BASE64 } from "./brasaoBase64";

/**
 * RF-70/71 — "Proposta de Revisão do PCA-TIC [ano]". A Especificação v2 não define o layout; adota-se
 * o padrão institucional: cabeçalho + a lista consolidada das alterações propostas (RF-68) em três
 * seções — Incluídos, Alterados (de → para) e Excluídos.
 */

const NAVY: [number, number, number] = [22, 53, 111];
const GREEN: [number, number, number] = [31, 122, 67];
const BLUE: [number, number, number] = [27, 63, 184];
const RED: [number, number, number] = [176, 42, 42];

export interface ItemLinha {
  item_pca?: string | null;
  objeto?: string | null;
  area_demandante?: string | null;
}

export interface MudancaCampo {
  campo: string;
  de: unknown;
  para: unknown;
}

export interface ItemAlterado {
  item_pca?: string | null;
  objeto?: string | null;
  mudancas?: MudancaCampo[];
}

export interface RevisaoPdfData {
  ano: number;
  versao: number;
  proad?: string | null;
  incluidos: ItemLinha[];
  alterados: ItemAlterado[];
  excluidos: ItemLinha[];
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

function secao(
  doc: jsPDF,
  titulo: string,
  cor: [number, number, number],
  y: number,
  head: string[],
  body: (string)[][],
  margin: number,
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(cor[0], cor[1], cor[2]);
  doc.text(`${titulo}  (${body.length})`, margin, y);
  if (body.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(8);
    doc.setTextColor(130);
    doc.text("Nenhum item.", margin, y + 5);
    return y + 10;
  }
  autoTable(doc, {
    startY: y + 2,
    head: [head],
    body,
    styles: { fontSize: 8, cellPadding: 1.5 },
    headStyles: { fillColor: cor, textColor: 255 },
    margin: { left: margin, right: margin },
  });
  return finalY(doc) + 8;
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

export function generateRevisaoPcaPDF(data: RevisaoPdfData): void {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 15;

  try {
    doc.addImage(BRASAO_GOIAS_BASE64, "PNG", margin, 10, 14, 14);
  } catch {
    /* brasão é opcional */
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("TRIBUNAL DE JUSTIÇA DO ESTADO DE GOIÁS", pageW / 2, 14, { align: "center" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80);
  doc.text("Secretaria de Governança Judiciária e Tecnológica — SGJT/CCA", pageW / 2, 19, { align: "center" });

  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, 26, pageW - margin, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text(`PROPOSTA DE REVISÃO DO PCA-TIC ${data.ano}`, pageW / 2, 34, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Gera a Versão ${data.versao}`, pageW / 2, 40, { align: "center" });
  doc.setFontSize(9);
  doc.text(`PROAD da revisão: ${data.proad ?? "—"}`, margin, 47);
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, 47, { align: "right" });

  let y = 55;

  y = secao(
    doc,
    "Itens incluídos",
    GREEN,
    y,
    ["Item", "Objeto", "Área demandante"],
    data.incluidos.map((i) => [fmt(i.item_pca), fmt(i.objeto), fmt(i.area_demandante)]),
    margin,
  );

  y = secao(
    doc,
    "Itens alterados",
    BLUE,
    y,
    ["Item", "Objeto", "Alterações (de → para)"],
    data.alterados.map((i) => [
      fmt(i.item_pca),
      fmt(i.objeto),
      (i.mudancas ?? []).map((m) => `${m.campo}: ${fmt(m.de)} → ${fmt(m.para)}`).join("\n") || "—",
    ]),
    margin,
  );

  y = secao(
    doc,
    "Itens excluídos",
    RED,
    y,
    ["Item", "Objeto", "Área demandante"],
    data.excluidos.map((i) => [fmt(i.item_pca), fmt(i.objeto), fmt(i.area_demandante)]),
    margin,
  );

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(
      `Kaizen · Orçamento de TIC · Proposta de Revisão do PCA-TIC ${data.ano} — página ${p}/${pages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" },
    );
  }

  doc.save(`Proposta_Revisao_PCA-TIC_${data.ano}_V${data.versao}.pdf`);
}
