import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { BRASAO_GOIAS_BASE64 } from "./brasaoBase64";
import { PcaItem } from "@/types";
import { getAreaLabel } from "./formatters";

const NAVY: [number, number, number] = [22, 53, 111];

export interface RevisaoPdfData {
  ano: number;
  versao: number;
  proad?: string | null;
  itens: PcaItem[];
}

function fmtMoney(v?: number | string | null): string {
  if (v === null || v === undefined || v === "") return "—";
  const num = Number(v);
  if (isNaN(num)) return "—";
  return num.toLocaleString("pt-BR", { 
    style: "currency", 
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function fmtDateStr(v?: string | null): string {
  if (!v) return "—";
  if (v.includes("T")) {
    const parts = v.split("T")[0].split("-");
    if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return v;
}

function getUnidadeRequisitante(item: PcaItem): string {
  return getAreaLabel({
    areaSigla: item.areaSigla,
    areaNome: item.areaNome,
    unidadeSigla: item.unidadeSigla,
    unidadeNome: item.unidadeNome,
    cadastrosAreasId: item.cadastrosAreasId,
    cadastrosUnidadesId: item.cadastrosUnidadesId
  });
}

function fmt(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  return String(v);
}

function fmtPrioridade(v?: string | number | null): string {
  if (v === null || v === undefined || String(v).trim() === "") return "—";
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "alto" || s === "alta") return "Alto";
  if (s === "2" || s === "médio" || s === "medio" || s === "média" || s === "media") return "Médio";
  if (s === "3" || s === "baixo" || s === "baixa") return "Baixo";
  return String(v).charAt(0).toUpperCase() + String(v).slice(1);
}

export function generateRevisaoPcaPDF(data: RevisaoPdfData): void {
  // Alterando para a3 em paisagem (landscape) devido ao número excessivo de colunas (25)
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a3" });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 10;

  try {
    doc.addImage(BRASAO_GOIAS_BASE64, "PNG", margin, 10, 14, 14);
  } catch {
    /* brasão opcional */
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(NAVY[0], NAVY[1], NAVY[2]);
  doc.text("PODER JUDICIÁRIO", pageW / 2, 14, { align: "center" });
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text("Tribunal de Justiça do Estado de Goiás", pageW / 2, 19, { align: "center" });
  doc.text("Presidência", pageW / 2, 24, { align: "center" });

  doc.setFont("helvetica", "bold");
  doc.setFontSize(14)

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`PROPOSTA DE REVISÃO DO PCA-TIC ${data.ano} (Versão ${data.versao})`, pageW / 2, 38, { align: "center" });
  doc.setFontSize(9);
  doc.text(`PROAD: ${data.proad ?? "—"}`, margin, 45);
  doc.text(`Emitido em: ${new Date().toLocaleDateString("pt-BR")}`, pageW - margin, 45, { align: "right" });

  const headers = [
    [
      "UNIDADE REQUISITANTE",
      "Nº PCA",
      "Descrição",
      "Justificativa",
      "Demanda incluída no PCA?",
      "PROAD Demanda",
      "PROAD Renovação",
      "Grau de Prioridade",
      "Estimativa preliminar do valor global (R$)",
      "Valor a ser desembolsado no ano de referência",
      "Valor estimado (R$)",
      "Valor contratado (R$)",
      "Renovação, Nova contratação, Encerramento",
      "Tipo de gasto",
      "Previsão de contratação",
      "Data de autuação (PROAD)",
      "Data de contratação (PROAD)",
      "Demanda Executada",
      "Em caso de não executada - Justifique",
      "Demanda Remanejada",
      "Análise de Risco",
      "Observações",
      "Alinhada às diretrizes de sustentabilidade (sim ou não)",
      "Objetivo estratégico TJGO",
      "Identificação da natureza da despesa",
      "Compra compartilhada com outros órgãos (sim ou não)"
    ]
  ];

  const body = data.itens.map(i => [
    getUnidadeRequisitante(i),
    fmt(i.itemPca || i.item_pca),
    fmt(i.objeto || i.description),
    fmt(i.justification),
    i.origem_ciclo_id ? "Sim" : "Não",
    fmt(i.process || i.origem_proad),
    "—",
    fmtPrioridade(i.priority),
    fmtMoney(i.valor_estimado),
    "—",
    fmtMoney(i.valor_estimado),
    fmtMoney(i.valor_formalizado),
    fmt(i.contract_type || i.tipo),
    fmt(i.financial_resource_type),
    fmtDateStr(i.data_estimada_contratacao || i.estimated_date),
    "—",
    "—",
    i.status === "Concluída" || i.status === "Formalizada" ? "Sim" : "Não",
    (i.status === "Cancelada" || i.status === "Suspensa") ? fmt(i.description) : "—",
    "—",
    "—",
    "—",
    "—",
    "—",
    "—",
    "—"
  ]);

  if (body.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.text("Nenhum item cadastrado para esta revisão.", margin, 55);
  } else {
    autoTable(doc, {
      startY: 50,
      head: headers,
      body: body,
      styles: { fontSize: 5, cellPadding: 1, overflow: "linebreak" },
      headStyles: { fillColor: NAVY, textColor: 255, halign: "center", valign: "middle" },
      columnStyles: {
        2: { cellWidth: 35 }, // Descrição
        3: { cellWidth: 35 }, // Justificativa
      },
      margin: { left: margin, right: margin }
    });
  }

  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(140);
    doc.text(
      `Página ${p} de ${pages}`,
      pageW / 2,
      pageH - 8,
      { align: "center" }
    );
  }

  doc.save(`Proposta_Revisao_PCA-TIC_${data.ano}_V${data.versao}_AnexoII.pdf`);
}
