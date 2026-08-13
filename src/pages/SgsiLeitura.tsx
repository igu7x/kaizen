import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Loader2,
  BookCheck,
  Check,
  Users,
  UserCheck,
  Save,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getUsers } from "@/services/api";
import type { User } from "@/types";
import {
  sgsiApi,
  SgsiLeituraItem,
  SgsiLeituraDetalhe,
} from "@/services/sgsiApi";

function fmtData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function pct(confirmados: number, exigidos: number): number {
  return exigidos > 0 ? Math.round((confirmados / exigidos) * 100) : 0;
}

function corBarra(p: number): string {
  if (p >= 80) return "bg-emerald-500";
  if (p >= 40) return "bg-amber-500";
  return "bg-red-500";
}

export default function SgsiLeitura() {
  const [itens, setItens] = useState<SgsiLeituraItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selecionado, setSelecionado] = useState<SgsiLeituraItem | null>(null);

  function carregar() {
    setLoading(true);
    sgsiApi
      .getLeituraPanorama()
      .then(setItens)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(carregar, []);

  const totais = useMemo(() => {
    const pend = itens.filter((i) => i.eu_exigido && !i.eu_confirmei).length;
    return { pendencias: pend, total: itens.length };
  }, [itens]);

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Gestão de Riscos e Compliance",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Ciência e Leitura" },
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
                <BookCheck className="h-6 w-6 text-blue-600" />
                Ciência e Leitura Confirmada
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Quem deve ler cada instrumento e quem já confirmou. Sem lista de
                exigidos, a leitura vale para todos os usuários ativos.
              </p>
            </div>
            {totais.pendencias > 0 && (
              <span className="rounded-full bg-amber-50 px-3 py-1 text-sm font-semibold text-amber-700">
                {totais.pendencias} pendente(s) para você
              </span>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando…
              </div>
            ) : itens.length === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Nenhum instrumento cadastrado.
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {itens.map((i) => {
                  const p = pct(i.confirmados, i.exigidos);
                  return (
                    <li key={i.codigo}>
                      <button
                        onClick={() => setSelecionado(i)}
                        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-slate-50/60"
                      >
                        <div className="w-14 shrink-0 text-center">
                          <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs font-semibold text-slate-600">
                            {i.numeral_romano || "—"}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-slate-800">
                            {i.sigla_oficial || i.codigo}
                          </p>
                          <p className="text-xs text-slate-400">
                            {i.requisitos > 0
                              ? `${i.requisitos} leitor(es) exigido(s)`
                              : "Todos os usuários ativos"}
                          </p>
                        </div>
                        {/* status pessoal */}
                        {i.eu_exigido && (
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              i.eu_confirmei
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-amber-50 text-amber-700",
                            )}
                          >
                            {i.eu_confirmei ? "Você confirmou" : "Você deve ler"}
                          </span>
                        )}
                        {/* barra de ciência */}
                        <div className="w-40 shrink-0">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                            <span>
                              {i.confirmados}/{i.exigidos}
                            </span>
                            <span className="font-semibold">{p}%</span>
                          </div>
                          <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={cn("h-full rounded-full", corBarra(p))}
                              style={{ width: `${p}%` }}
                            />
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>

      {selecionado && (
        <LeituraDetalheDialog
          item={selecionado}
          onClose={() => setSelecionado(null)}
          onMudou={carregar}
        />
      )}
    </Layout>
  );
}

function LeituraDetalheDialog({
  item,
  onClose,
  onMudou,
}: {
  item: SgsiLeituraItem;
  onClose: () => void;
  onMudou: () => void;
}) {
  const [detalhe, setDetalhe] = useState<SgsiLeituraDetalhe | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [confirmando, setConfirmando] = useState(false);
  const [euConfirmei, setEuConfirmei] = useState(item.eu_confirmei);

  // edição de requisitos
  const [editando, setEditando] = useState(false);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [selecao, setSelecao] = useState<Set<number>>(new Set());
  const [salvando, setSalvando] = useState(false);

  async function recarregar() {
    setCarregando(true);
    try {
      const d = await sgsiApi.getLeituraDetalhe(item.codigo);
      setDetalhe(d);
      if (d.modo === "LISTA") {
        setSelecao(new Set(d.leitores.map((l) => l.usuario_id)));
      } else {
        setSelecao(new Set());
      }
    } catch {
      /* tratado no apiClient */
    } finally {
      setCarregando(false);
    }
  }

  useEffect(() => {
    recarregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.codigo]);

  async function abrirEdicao() {
    setEditando(true);
    if (usuarios.length === 0) {
      try {
        const us = await getUsers();
        setUsuarios(us.filter((u) => u.status === "ACTIVE"));
      } catch {
        /* tratado no apiClient */
      }
    }
  }

  function toggle(id: number) {
    setSelecao((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function confirmar() {
    setConfirmando(true);
    try {
      const d = await sgsiApi.confirmarLeitura(item.codigo);
      setDetalhe(d);
      setEuConfirmei(true);
      toast.success("Leitura confirmada.");
      onMudou();
    } catch {
      /* tratado no apiClient */
    } finally {
      setConfirmando(false);
    }
  }

  async function salvarRequisitos() {
    setSalvando(true);
    try {
      const d = await sgsiApi.definirRequisitosLeitura(
        item.codigo,
        Array.from(selecao),
      );
      setDetalhe({
        ...d,
        exigidos: Number(d.exigidos),
        confirmados: Number(d.confirmados),
      });
      setEditando(false);
      toast.success(
        selecao.size === 0
          ? "Leitura passa a ser exigida de todos."
          : `${selecao.size} leitor(es) exigido(s).`,
      );
      onMudou();
      recarregar();
    } catch {
      /* tratado no apiClient */
    } finally {
      setSalvando(false);
    }
  }

  const p = detalhe ? pct(detalhe.confirmados, detalhe.exigidos) : 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto overflow-x-hidden">
        <DialogHeader className="min-w-0">
          <DialogTitle className="flex min-w-0 items-center gap-2 pr-8">
            <BookCheck className="h-5 w-5 text-blue-600 shrink-0" />
            <span className="min-w-0 truncate">
              {item.sigla_oficial || item.codigo}
              {detalhe?.instrumento.nome_completo
                ? ` — ${detalhe.instrumento.nome_completo}`
                : ""}
            </span>
          </DialogTitle>
        </DialogHeader>

        {carregando || !detalhe ? (
          <div className="flex items-center justify-center py-10 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando…
          </div>
        ) : (
          <div className="space-y-4">
            {/* resumo */}
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                  detalhe.modo === "TODOS"
                    ? "bg-slate-100 text-slate-600"
                    : "bg-blue-50 text-blue-700",
                )}
              >
                <Users className="h-3.5 w-3.5" />
                {detalhe.modo === "TODOS"
                  ? "Exigido de todos os ativos"
                  : "Lista específica de leitores"}
              </span>
              <span className="text-sm text-slate-600">
                {detalhe.confirmados}/{detalhe.exigidos} confirmaram ({p}%)
              </span>
              <div className="h-1.5 flex-1 min-w-[80px] overflow-hidden rounded-full bg-slate-100">
                <div
                  className={cn("h-full rounded-full", corBarra(p))}
                  style={{ width: `${p}%` }}
                />
              </div>
            </div>

            {/* minha leitura */}
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2">
              <span className="min-w-0 text-sm text-slate-600">
                {item.eu_exigido
                  ? euConfirmei
                    ? "Você já confirmou a leitura deste instrumento."
                    : "Você precisa confirmar a leitura deste instrumento."
                  : "Você não está entre os leitores exigidos."}
              </span>
              {item.eu_exigido && !euConfirmei && (
                <Button size="sm" className="shrink-0" onClick={confirmar} disabled={confirmando}>
                  {confirmando ? (
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <UserCheck className="h-3.5 w-3.5 mr-1.5" />
                  )}
                  Confirmar minha leitura
                </Button>
              )}
            </div>

            {/* leitores + confirmações */}
            <div>
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                  Leitores ({detalhe.leitores.length})
                </p>
                {!editando && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0"
                    onClick={abrirEdicao}
                  >
                    Definir leitores exigidos
                  </Button>
                )}
              </div>

              {!editando ? (
                <div className="max-h-72 overflow-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                  {detalhe.leitores.map((l) => (
                    <div
                      key={l.usuario_id}
                      className="flex items-center justify-between px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-slate-700">{l.nome}</p>
                        {l.email && (
                          <p className="truncate text-xs text-slate-400">
                            {l.email}
                          </p>
                        )}
                      </div>
                      {l.confirmado ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                          <Check className="h-3 w-3" />
                          {fmtData(l.confirmado_em)}
                        </span>
                      ) : (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                          pendente
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">
                    Marque os leitores exigidos. Nenhum marcado = exigido de{" "}
                    <strong>todos os usuários ativos</strong>.
                  </p>
                  <div className="max-h-60 overflow-auto rounded-lg border border-slate-200 divide-y divide-slate-100">
                    {usuarios.length === 0 ? (
                      <div className="flex items-center justify-center py-6 text-slate-400">
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        Carregando usuários…
                      </div>
                    ) : (
                      usuarios.map((u) => {
                        const uid = Number(u.id);
                        const marcado = selecao.has(uid);
                        return (
                          <label
                            key={u.id}
                            className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-slate-50"
                          >
                            <input
                              type="checkbox"
                              checked={marcado}
                              onChange={() => toggle(uid)}
                              className="h-4 w-4 rounded border-slate-300"
                            />
                            <div className="min-w-0">
                              <p className="truncate text-slate-700">{u.name}</p>
                              <p className="truncate text-xs text-slate-400">
                                {u.email}
                              </p>
                            </div>
                          </label>
                        );
                      })
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditando(false);
                        recarregar();
                      }}
                      disabled={salvando}
                    >
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={salvarRequisitos} disabled={salvando}>
                      {salvando ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Salvar leitores ({selecao.size || "todos"})
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
