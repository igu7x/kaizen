import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  ShieldCheck,
  Loader2,
  ExternalLink,
  AlertTriangle,
  BadgeCheck,
} from "lucide-react";
import {
  processosNegocioApi,
  ProcessoNegocio,
  dataVigencia,
} from "@/services/processosNegocioApi";
import { areasApi } from "@/services/areasApi";
import { generateProcessoNegocioPDF } from "@/utils/generateProcessoNegocioPDF";

const AZUL = "#0a2351";

function formatData(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/**
 * Validação de autenticidade de um processo, dentro da interface do sistema. O usuário já está
 * autenticado (rota protegida); informa o código impresso no PDF e, se válido, o documento é
 * confirmado como autêntico e o PDF é exibido em um preview embutido.
 */
export default function ValidarProcesso() {
  const [searchParams] = useSearchParams();
  const [codigo, setCodigo] = useState(searchParams.get("codigo") || "");
  const [validando, setValidando] = useState(false);
  const [processo, setProcesso] = useState<ProcessoNegocio | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  // Gera o PDF e devolve a URL do blob para o preview embutido (sem abrir aba). Revoga a URL
  // anterior para não vazar memória.
  const gerarPreview = async (p: ProcessoNegocio) => {
    let diretoriaNome = p.diretoria || "";
    try {
      const areas = await areasApi.getAll();
      diretoriaNome =
        areas.find((a) => a.sigla === p.diretoria)?.nome || diretoriaNome;
    } catch {
      /* mantém a sigla */
    }
    if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    const url = await generateProcessoNegocioPDF(p, diretoriaNome, null, {
      suppressOpen: true,
    });
    pdfUrlRef.current = url;
    setPdfUrl(url);
  };

  const validar = async (cod: string) => {
    const limpo = cod.replace(/\D/g, "");
    if (limpo.length < 6) {
      setErro("Informe o código de validação impresso no PDF.");
      return;
    }
    setValidando(true);
    setErro(null);
    setProcesso(null);
    setPdfUrl(null);
    try {
      const p = await processosNegocioApi.validarPorCodigo(limpo);
      setProcesso(p);
      await gerarPreview(p);
    } catch {
      setErro(
        "Nenhum documento validado foi encontrado para este código. Confira os dígitos e tente novamente.",
      );
    } finally {
      setValidando(false);
    }
  };

  // Se o código vier na URL (?codigo=...), valida automaticamente ao abrir.
  useEffect(() => {
    const q = searchParams.get("codigo");
    if (q) validar(q);
    return () => {
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-2.5 border-b border-slate-200 pb-4">
          <ShieldCheck className="h-6 w-6" style={{ color: AZUL }} />
          <h1 className="text-2xl font-bold" style={{ color: AZUL }}>
            Validação de Documentos
          </h1>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            validar(codigo);
          }}
          className="mt-6 max-w-md"
        >
          <label
            htmlFor="codigo"
            className="block text-sm font-semibold text-slate-700 mb-1.5"
          >
            Código de validação
          </label>
          <Input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de 12 dígitos impresso no PDF"
            inputMode="numeric"
            className="tabular-nums tracking-wide"
            autoFocus
          />
          <Button
            type="submit"
            disabled={validando}
            className="mt-3 text-white"
            style={{ backgroundColor: AZUL }}
          >
            {validando ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <BadgeCheck className="h-4 w-4 mr-1.5" />
            )}
            Validar documento
          </Button>

          {erro && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{erro}</span>
            </div>
          )}
        </form>

        {processo && (
          <div className="mt-6 max-w-2xl rounded-xl border border-emerald-200 bg-emerald-50/60 p-6">
            <div className="flex items-center gap-2 text-emerald-700 mb-3">
              <BadgeCheck className="h-5 w-5" />
              <span className="font-semibold">Documento autêntico</span>
            </div>
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
              <Info rot="Processo" val={processo.nome_processo} />
              <Info rot="ID" val={processo.codigo || "—"} />
              <Info rot="Macroprocesso" val={processo.macroprocesso || "—"} />
              <Info rot="Área" val={processo.diretoria || "—"} />
              <Info rot="Versão" val={processo.versao || "—"} />
              <Info
                rot="Data da versão"
                val={formatData(
                  dataVigencia(processo) || processo.periodo || processo.updated_at,
                )}
              />
            </dl>
          </div>
        )}

        {/* Preview do PDF embutido (rolável), abaixo do selo — não troca de página. */}
        {pdfUrl && (
          <div className="mt-6 max-w-3xl">
            <div className="flex items-center justify-between gap-3 mb-2">
              <h2 className="text-sm font-bold text-slate-700">
                Documento do processo
              </h2>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
              >
                Abrir em nova aba
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
            <iframe
              src={`${pdfUrl}#navpanes=0&view=FitH`}
              title="Pré-visualização do PDF do processo"
              className="w-full h-[80vh] rounded-xl border border-slate-300 bg-slate-100"
            />
          </div>
        )}

        {/* Rodapé institucional */}
        <div className="mt-12 border-t border-slate-200 pt-4 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <img
              src="/brasao-goias.png"
              alt="Brasão do Estado de Goiás"
              className="h-11 w-auto"
            />
            <div className="text-sm leading-tight">
              <div className="font-bold text-slate-800">PODER JUDICIÁRIO</div>
              <div className="text-slate-500">
                Tribunal de Justiça do Estado de Goiás
              </div>
            </div>
          </div>
          <div className="text-sm text-right font-bold" style={{ color: AZUL }}>
            Secretaria de Governança Judiciária e Tecnológica
          </div>
        </div>
      </div>
    </Layout>
  );
}

function Info({ rot, val }: { rot: string; val: string }) {
  return (
    <div>
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
        {rot}
      </dt>
      <dd className="text-slate-800">{val}</dd>
    </div>
  );
}
