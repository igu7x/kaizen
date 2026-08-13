import { useEffect, useState } from "react";
import { Loader2, Settings2, Check, X, Pencil, RotateCcw } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { sgsiApi, SgsiConfiguracao } from "@/services/sgsiApi";

/** Formata a data ISO do backend para um rótulo curto pt-BR. */
function fmtData(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function SgsiConfiguracoes() {
  const [itens, setItens] = useState<SgsiConfiguracao[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [rascunho, setRascunho] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  function carregar() {
    setLoading(true);
    sgsiApi
      .getConfiguracoes()
      .then(setItens)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  function iniciarEdicao(c: SgsiConfiguracao) {
    setEditando(c.chave);
    setRascunho(c.valor);
    setErro(null);
  }

  function cancelar() {
    setEditando(null);
    setRascunho("");
    setErro(null);
  }

  async function salvar(chave: string) {
    let normalizado: string;
    try {
      normalizado = JSON.stringify(JSON.parse(rascunho));
    } catch {
      setErro("Valor deve ser um JSON válido (ex.: 15, true, \"texto\", [\"a\"]).");
      return;
    }
    setSalvando(true);
    setErro(null);
    try {
      const atualizado = await sgsiApi.atualizarConfiguracao(chave, normalizado);
      setItens((prev) =>
        prev.map((c) => (c.chave === chave ? { ...c, ...atualizado } : c)),
      );
      cancelar();
    } catch {
      setErro("Não foi possível salvar. Verifique o valor e tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Gestão de Riscos e Compliance",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Configurações" },
            ]}
          />

          {/* Header */}
          <div className="mt-4 mb-6 flex items-center gap-4">
            <div
              className="w-1.5 h-12 rounded-full"
              style={{
                background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
              }}
            />
            <div className="flex-1">
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">
                Gestão de Riscos e Compliance
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <Settings2 className="h-6 w-6 text-blue-600" />
                Configurações
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Parâmetros do SGSI (limiares de risco, janela de alerta, step-up,
                digitalização…). Cada valor é um JSON.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregar}
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Recarregar
            </Button>
          </div>

          {/* Lista */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando parâmetros…
              </div>
            ) : itens.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Nenhum parâmetro cadastrado.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {itens.map((c) => {
                  const emEdicao = editando === c.chave;
                  return (
                    <li key={c.chave} className="px-5 py-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-semibold text-slate-800">
                            {c.chave}
                          </p>
                          {c.descricao && (
                            <p className="text-sm text-slate-500 mt-0.5">
                              {c.descricao}
                            </p>
                          )}
                          <p className="text-[11px] text-slate-400 mt-1">
                            Atualizado em {fmtData(c.atualizado_em)}
                          </p>
                        </div>
                        {!emEdicao && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => iniciarEdicao(c)}
                          >
                            <Pencil className="h-3.5 w-3.5 mr-1.5" />
                            Editar
                          </Button>
                        )}
                      </div>

                      {emEdicao ? (
                        <div className="mt-3">
                          <textarea
                            value={rascunho}
                            onChange={(e) => setRascunho(e.target.value)}
                            spellCheck={false}
                            rows={Math.min(6, rascunho.split("\n").length + 1)}
                            className="w-full rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 font-mono text-sm text-slate-800 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                          {erro && (
                            <p className="mt-1.5 text-xs text-red-600">{erro}</p>
                          )}
                          <div className="mt-2 flex items-center gap-2">
                            <Button
                              size="sm"
                              onClick={() => salvar(c.chave)}
                              disabled={salvando}
                            >
                              {salvando ? (
                                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Check className="h-3.5 w-3.5 mr-1.5" />
                              )}
                              Salvar
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={cancelar}
                              disabled={salvando}
                            >
                              <X className="h-3.5 w-3.5 mr-1.5" />
                              Cancelar
                            </Button>
                          </div>
                        </div>
                      ) : (
                        <pre className="mt-2 overflow-x-auto rounded-lg bg-slate-900 px-3 py-2 font-mono text-xs text-blue-100">
                          {c.valor}
                        </pre>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {itens.length} parâmetro(s)
          </p>
        </div>
      </div>
    </Layout>
  );
}
