import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ShieldCheck,
  Loader2,
  FileDown,
  AlertTriangle,
  BadgeCheck,
} from "lucide-react";
import {
  processosNegocioApi,
  ProcessoNegocio,
} from "@/services/processosNegocioApi";
import { areasApi } from "@/services/areasApi";
import { generateProcessoNegocioPDF } from "@/utils/generateProcessoNegocioPDF";

function formatData(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : v;
}

/**
 * Validação de autenticidade de um processo. O usuário já está autenticado (rota protegida);
 * informa o código impresso no PDF e, se válido, o documento é confirmado como autêntico e o
 * PDF do processo é aberto diretamente.
 */
export default function ValidarProcesso() {
  const [searchParams] = useSearchParams();
  const [codigo, setCodigo] = useState(searchParams.get("codigo") || "");
  const [validando, setValidando] = useState(false);
  const [processo, setProcesso] = useState<ProcessoNegocio | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  const abrirPdf = async (p: ProcessoNegocio) => {
    let diretoriaNome = p.diretoria || "";
    try {
      const areas = await areasApi.getAll();
      diretoriaNome = areas.find((a) => a.sigla === p.diretoria)?.nome || diretoriaNome;
    } catch {
      /* mantém a sigla */
    }
    const win = window.open("", "_blank");
    generateProcessoNegocioPDF(p, diretoriaNome, win);
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
    try {
      const p = await processosNegocioApi.validarPorCodigo(limpo);
      setProcesso(p);
      await abrirPdf(p);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Layout>
      <div className="mx-auto max-w-xl py-10">
        <div className="text-center mb-8">
          <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-blue-50 flex items-center justify-center">
            <ShieldCheck className="h-7 w-7 text-blue-600" />
          </div>
          <h1 className="text-xl font-bold text-slate-900">
            Validação de Documento
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            Informe o código impresso no PDF para confirmar a autenticidade do
            processo e abrir o documento.
          </p>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            validar(codigo);
          }}
          className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <Label htmlFor="codigo" className="text-sm font-semibold text-slate-700">
            Código de validação
          </Label>
          <Input
            id="codigo"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            placeholder="Código de 12 dígitos impresso no PDF"
            inputMode="numeric"
            className="mt-1.5 tabular-nums tracking-wide"
            autoFocus
          />
          <Button
            type="submit"
            disabled={validando}
            className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white"
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
          <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-6">
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
                val={formatData(processo.periodo || processo.updated_at)}
              />
            </dl>
            <Button
              onClick={() => abrirPdf(processo)}
              variant="outline"
              className="mt-4"
            >
              <FileDown className="h-4 w-4 mr-1.5" />
              Abrir o PDF novamente
            </Button>
          </div>
        )}
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
