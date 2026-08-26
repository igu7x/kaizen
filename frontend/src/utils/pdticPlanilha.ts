import { type PdticAcao } from "@/services/pdticAcoesApi";
import {
  baixarArquivo,
  buildXlsx,
  MIME_XLSX,
  type XlsxCell,
  type XlsxColumn,
} from "./xlsx";

/** Prazo no formato MM/AAAA a partir de YYYY-MM-DD. */
export function prazoMesAno(iso?: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : iso;
}

const COLUNAS: XlsxColumn[] = [
  { header: "ID PDTIC", width: 12 },
  { header: "Ação", width: 64 },
  { header: "Diretoria", width: 28 },
  { header: "Área Responsável", width: 36 },
  { header: "Conclusão", width: 13 },
  { header: "Status", width: 12 },
  { header: "Evidência", width: 18 },
];

export interface ResultadoExportacao {
  arquivo: string;
  /** Quantas das ações exportadas têm evidência anexada. */
  comEvidencia: number;
}

function carimboData(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Exporta as ações do PDTIC (KR-1) numa planilha `.xlsx` única.
 *
 * A coluna Evidência é apenas um indicador ("Com evidência" / "Sem evidência") — o arquivo em si
 * não é exportado. Os PDFs já chegaram a ir junto, num `.zip` com pasta `evidencias/` e hyperlink
 * relativo na célula (o XLSX não embute anexo, e a evidência vem do backend como data URL base64);
 * isso foi removido a pedido: só a planilha basta. Por isso a exportação não faz mais nenhuma
 * chamada de rede e é síncrona.
 */
export function exportarPlanilhaAcoes(acoes: PdticAcao[]): ResultadoExportacao {
  const temEvidencia = (a: PdticAcao) => !!a.evidencia_nome?.trim();

  const linhas: XlsxCell[][] = acoes.map((a) => {
    const ok = temEvidencia(a);
    return [
      { value: a.id_pdtic || "" },
      { value: a.nome || "" },
      { value: a.diretoria || "" },
      { value: a.area_responsavel || "" },
      { value: prazoMesAno(a.conclusao) },
      { value: ok ? "Concluído" : "Pendente" },
      { value: ok ? "Com evidência" : "Sem evidência" },
    ];
  });

  const planilha = buildXlsx({
    sheetName: "Ações do PDTIC",
    columns: COLUNAS,
    rows: linhas,
  });

  const arquivo = `PDTIC - Acoes - ${carimboData()}.xlsx`;
  baixarArquivo(planilha, arquivo, MIME_XLSX);
  return { arquivo, comEvidencia: acoes.filter(temEvidencia).length };
}
