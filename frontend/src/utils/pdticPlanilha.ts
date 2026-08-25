import { zipSync } from "fflate";
import { pdticAcoesApi, type PdticAcao } from "@/services/pdticAcoesApi";
import {
  baixarArquivo,
  buildXlsx,
  MIME_XLSX,
  MIME_ZIP,
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
  { header: "Evidência", width: 46 },
];

const PASTA_EVIDENCIAS = "evidencias";

export interface ResultadoExportacao {
  arquivo: string;
  /** Quantas evidências entraram no pacote. */
  evidencias: number;
  /** Ações concluídas cuja evidência não pôde ser baixada. */
  falhas: number;
}

/** Nome utilizável como caminho dentro do zip: sem acento, sem caractere especial. */
function nomeSeguro(nome: string): string {
  // NFD separa a letra do acento; a faixa abaixo são os diacríticos combinantes.
  const semAcento = nome.normalize("NFD").replace(/[̀-ͯ]/g, "");
  return (
    semAcento
      .replace(/[^A-Za-z0-9 ._-]+/g, "_")
      .replace(/\s+/g, " ")
      .replace(/^[ ._-]+|[ ._-]+$/g, "")
      .slice(0, 90) || "evidencia"
  );
}

/** Dois PDFs com o mesmo nome sobrescreveriam um ao outro dentro do zip. */
function caminhoUnico(usados: Set<string>, base: string): string {
  const ponto = base.lastIndexOf(".");
  const raiz = ponto > 0 ? base.slice(0, ponto) : base;
  const ext = ponto > 0 ? base.slice(ponto) : "";
  let candidato = base;
  let n = 2;
  while (usados.has(candidato.toLowerCase())) candidato = `${raiz} (${n++})${ext}`;
  usados.add(candidato.toLowerCase());
  return candidato;
}

function dataUrlParaBytes(dataUrl: string): Uint8Array {
  const virgula = dataUrl.indexOf(",");
  const base64 = virgula >= 0 ? dataUrl.slice(virgula + 1) : dataUrl;
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes;
}

/** Executa `fn` sobre os itens com no máximo `limite` chamadas simultâneas. */
async function emLotes<T>(
  itens: T[],
  limite: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let proximo = 0;
  const trabalhadores = Array.from(
    { length: Math.min(limite, itens.length) },
    async () => {
      while (proximo < itens.length) await fn(itens[proximo++]);
    },
  );
  await Promise.all(trabalhadores);
}

function carimboData(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Exporta as ações do PDTIC (KR-1) em planilha.
 *
 * A evidência é servida pelo backend como data URL base64, não como link público — e o formato
 * XLSX não embute arquivos arbitrários. Então, quando há evidências, o download é um `.zip` com a
 * planilha e uma pasta `evidencias/`, e a coluna Evidência vira um hyperlink relativo pro PDF
 * correspondente: descompactado, clicar na célula abre o documento. Sem nenhuma evidência no
 * recorte exportado, baixa o `.xlsx` puro — zip vazio só atrapalharia.
 */
export async function exportarPlanilhaAcoes(
  acoes: PdticAcao[],
  opts: {
    incluirEvidencias?: boolean;
    onProgresso?: (baixadas: number, total: number) => void;
  } = {},
): Promise<ResultadoExportacao> {
  const incluirEvidencias = opts.incluirEvidencias !== false;
  const temEvidencia = (a: PdticAcao) => !!a.evidencia_nome?.trim();
  const concluidas = acoes.filter(temEvidencia);

  const anexos: Record<string, Uint8Array> = {};
  const caminhoPorAcao = new Map<number, string>();
  const usados = new Set<string>();
  let baixadas = 0;
  let falhas = 0;

  if (incluirEvidencias && concluidas.length > 0) {
    await emLotes(concluidas, 4, async (a) => {
      try {
        const ev = await pdticAcoesApi.getEvidencia(a.id);
        if (!ev.evidencia_data) {
          falhas++;
          return;
        }
        const rotulo = nomeSeguro(
          `${a.id_pdtic ? `${a.id_pdtic} - ` : ""}${ev.evidencia_nome || `acao-${a.id}.pdf`}`,
        );
        const nome = caminhoUnico(
          usados,
          /\.pdf$/i.test(rotulo) ? rotulo : `${rotulo}.pdf`,
        );
        anexos[`${PASTA_EVIDENCIAS}/${nome}`] = dataUrlParaBytes(ev.evidencia_data);
        caminhoPorAcao.set(a.id, `${PASTA_EVIDENCIAS}/${nome}`);
      } catch {
        falhas++;
      } finally {
        opts.onProgresso?.(++baixadas, concluidas.length);
      }
    });
  }

  const linhas: XlsxCell[][] = acoes.map((a) => {
    const ok = temEvidencia(a);
    const caminho = caminhoPorAcao.get(a.id);
    const evidencia: XlsxCell = caminho
      ? { value: a.evidencia_nome || "Evidência", link: encodeURI(caminho) }
      : {
          value: ok
            ? `${a.evidencia_nome} (não exportada)`
            : "Sem evidência",
        };
    return [
      { value: a.id_pdtic || "" },
      { value: a.nome || "" },
      { value: a.diretoria || "" },
      { value: a.area_responsavel || "" },
      { value: prazoMesAno(a.conclusao) },
      { value: ok ? "Concluído" : "Pendente" },
      evidencia,
    ];
  });

  const planilha = buildXlsx({
    sheetName: "Ações do PDTIC",
    columns: COLUNAS,
    rows: linhas,
  });

  const base = `PDTIC - Acoes - ${carimboData()}`;
  const quantidadeAnexos = Object.keys(anexos).length;

  if (quantidadeAnexos === 0) {
    baixarArquivo(planilha, `${base}.xlsx`, MIME_XLSX);
    return { arquivo: `${base}.xlsx`, evidencias: 0, falhas };
  }

  // Nível 0 nos PDFs: já são comprimidos, recomprimir só gastaria CPU sem ganho.
  const pacote = zipSync(
    { [`${base}.xlsx`]: planilha, ...anexos },
    { level: 0 },
  );
  baixarArquivo(pacote, `${base}.zip`, MIME_ZIP);
  return { arquivo: `${base}.zip`, evidencias: quantidadeAnexos, falhas };
}
