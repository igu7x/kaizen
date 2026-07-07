import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import type { Ciclo } from "../services/cicloOrcamentarioApi";
import type { Ifo, BlocoIfo } from "../services/dfdApi";
import { BRASAO_GOIAS_BASE64 } from "./brasaoBase64";

/**
 * RF-33 — "Proposta de DFD-TIC" (Formação). A Especificação v2 não define o layout campo-a-campo
 * (ponto pendente §11); adota-se o padrão institucional do TJGO: cabeçalho com brasão, itens
 * agrupados pelos 4 blocos do ciclo de vida (RF-05) e totais por bloco + total geral.
 */

const BRL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const NAVY: [number, number, number] = [22, 53, 111];
const FOOT_BG: [number, number, number] = [240, 243, 248];

const BLOCO_LABEL: Record<BlocoIfo, string> = {
  encerramento: "Encerramento no exercício",
  renovacao: "Renovação",
  plurianual: "Plurianual",
  nova_contratacao: "Nova Contratação",
};
const ORDEM_BLOCOS: BlocoIfo[] = ["encerramento", "renovacao", "plurianual", "nova_contratacao"];

function naturezaLabel(n: string | null): string {
  if (n === "continuada") return "Continuada";
  if (n === "pontual") return "Pontual";
  return "—";
}

function finalY(doc: jsPDF): number {
  return (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
}

export function generateDfdTicPDF(ciclo: Ciclo, ifos: Ifo[]): void {
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
  doc.text("Secretaria de Governança Judiciária e Tecnológica — CCA", pageW / 2, 19, { align: "center" });

  doc.setDrawColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.setLineWidth(0.4);
  doc.line(margin, 26, pageW - margin, 26);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("PROPOSTA DE DFD-TIC", pageW / 2, 34, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Formação do PCA-TIC ${ciclo.ano} · Versão ${ciclo.versaoGerada ?? 1}`, pageW / 2, 40, {
    align: "center",
  });
  doc.setFontSize(9);
  doc.text(`PROAD de instrução: ${ciclo.proad ?? "—"}`, margin, 47);
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, 47, { align: "right" });

  let y = 53;
  let totalGeral = 0;

  for (const bloco of ORDEM_BLOCOS) {
    const doBloco = ifos.filter((i) => i.bloco === bloco);
    if (doBloco.length === 0) continue;
    const subtotal = doBloco.reduce((s, i) => s + (i.valorEstimado ?? 0), 0);
    totalGeral += subtotal;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`${BLOCO_LABEL[bloco]}  (${doBloco.length})`, margin, y);

    autoTable(doc, {
      startY: y + 2,
      head: [["Código", "Objeto", "Área demandante", "Natureza", "Valor estimado"]],
      body: doBloco.map((i) => [
        i.codigoOficial ?? i.codigo,
        i.objeto ?? "—",
        i.areaDemandante ?? "—",
        naturezaLabel(i.natureza),
        BRL.format(i.valorEstimado ?? 0),
      ]),
      foot: [["", "", "", "Subtotal", BRL.format(subtotal)]],
      styles: { fontSize: 8, cellPadding: 1.5 },
      headStyles: { fillColor: NAVY, textColor: 255 },
      footStyles: { fillColor: FOOT_BG, textColor: NAVY, fontStyle: "bold", halign: "right" },
      columnStyles: { 4: { halign: "right" } },
      margin: { left: margin, right: margin },
    });
    y = finalY(doc) + 7;
  }

  if (totalGeral > 0) {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
    doc.text(`TOTAL GERAL: ${BRL.format(totalGeral)}`, pageW - margin, y + 2, { align: "right" });
  } else {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(9);
    doc.setTextColor(120);
    doc.text("Nenhum item na DFD deste ciclo.", margin, y + 2);
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(`Kaizen · Orçamento de TIC · Proposta de DFD-TIC — página ${p}/${pages}`, pageW / 2, pageH - 8, {
      align: "center",
    });
  }

  doc.save(`Proposta_DFD-TIC_${ciclo.ano}.pdf`);
}
