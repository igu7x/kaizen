import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  History,
  Search,
  RotateCcw,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AuditoriaDetalheDialog } from "@/components/auditoria/AuditoriaDetalheDialog";
import { auditoriaApi } from "@/services/auditoriaApi";
import type {
  AuditoriaRegistro,
  AuditoriaFacetas,
} from "@/services/auditoriaApi";
import {
  acaoClasse,
  acaoLabel,
  moduloDe,
  parseJson,
  resumoItem,
  tabelaLabel,
} from "@/utils/auditoriaLabels";

const TODOS = "__todos__";

/** Quantos registros por rodada. Não é teto: a tela pagina até cobrir 100% da trilha. */
const TAMANHO_PAGINA = 200;

function fmtDataHora(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Data no formato que o <input type="date"> e o backend usam (AAAA-MM-DD), no fuso local. */
function paraIso(d: Date): string {
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

function diasAtras(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

/** Atalhos do período — cobrem o que se pergunta na prática ("o que mudou esta semana?"). */
const ATALHOS_PERIODO: {
  rotulo: string;
  intervalo: () => { de: string; ate: string };
}[] = [
  {
    rotulo: "Hoje",
    intervalo: () => ({ de: paraIso(new Date()), ate: paraIso(new Date()) }),
  },
  {
    rotulo: "Últimos 7 dias",
    intervalo: () => ({ de: paraIso(diasAtras(6)), ate: paraIso(new Date()) }),
  },
  {
    rotulo: "Últimos 30 dias",
    intervalo: () => ({ de: paraIso(diasAtras(29)), ate: paraIso(new Date()) }),
  },
  {
    rotulo: "Este mês",
    intervalo: () => {
      const hoje = new Date();
      return {
        de: paraIso(new Date(hoje.getFullYear(), hoje.getMonth(), 1)),
        ate: paraIso(hoje),
      };
    },
  },
];

/**
 * O evento que a linha mostra. Os módulos do SGSI gravam um evento de negócio dentro de
 * `changed_fields.evento` (EMITIDO, DOC_ASSINADO…); os demais usam a ação canônica do audit_log.
 */
function eventoDa(r: AuditoriaRegistro): string {
  const extras = parseJson(r.changed_fields);
  return (extras?.evento as string | undefined) || r.action;
}

export default function Auditoria() {
  const [registros, setRegistros] = useState<AuditoriaRegistro[]>([]);
  const [total, setTotal] = useState(0);
  const [facetas, setFacetas] = useState<AuditoriaFacetas>({
    acoes: [],
    tabelas: [],
  });
  const [loading, setLoading] = useState(true);
  const [carregandoMais, setCarregandoMais] = useState(false);
  const [fAcao, setFAcao] = useState(TODOS);
  const [fModulo, setFModulo] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");
  // Período (AAAA-MM-DD). Vazio = sem limite daquele lado.
  const [fDe, setFDe] = useState("");
  const [fAte, setFAte] = useState("");
  const [detalheId, setDetalheId] = useState<number | null>(null);

  // Ignora resposta de requisição antiga que chegar depois de o filtro já ter mudado.
  const requisicaoAtual = useRef(0);

  // Módulo → tabelas do audit_log que ele agrupa (deriva das tabelas realmente presentes).
  const modulosTabelas = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const t of facetas.tabelas) {
      const mod = moduloDe(t);
      m.set(mod, [...(m.get(mod) || []), t]);
    }
    return m;
  }, [facetas.tabelas]);
  const modulos = useMemo(
    () => Array.from(modulosTabelas.keys()).sort((a, b) => a.localeCompare(b)),
    [modulosTabelas],
  );

  // debounce da busca
  useEffect(() => {
    const t = setTimeout(() => setBuscaAplicada(busca), 350);
    return () => clearTimeout(t);
  }, [busca]);

  useEffect(() => {
    auditoriaApi
      .getFacetas()
      .then(setFacetas)
      .catch(() => {});
  }, []);

  const filtros = useCallback(
    () => ({
      acao: fAcao === TODOS ? undefined : fAcao,
      // Um módulo agrupa várias tabelas — manda todas (o backend filtra com IN).
      tabela:
        fModulo === TODOS
          ? undefined
          : (modulosTabelas.get(fModulo) || []).join(","),
      busca: buscaAplicada || undefined,
      de: fDe || undefined,
      ate: fAte || undefined,
    }),
    [fAcao, fModulo, buscaAplicada, modulosTabelas, fDe, fAte],
  );

  /** Recarrega do começo (troca de filtro ou clique em "Atualizar"). */
  const carregar = useCallback(() => {
    const req = ++requisicaoAtual.current;
    setLoading(true);
    auditoriaApi
      .getAuditoria({ ...filtros(), pagina: 0, tamanho: TAMANHO_PAGINA })
      .then((p) => {
        if (req !== requisicaoAtual.current) return;
        setRegistros(p.itens);
        setTotal(p.total);
      })
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => {
        if (req === requisicaoAtual.current) setLoading(false);
      });
  }, [filtros]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  /** Traz o próximo lote (ou o restante inteiro) sem perder o que já está na tela. */
  const carregarMais = useCallback(
    (tudo = false) => {
      const req = requisicaoAtual.current;
      setCarregandoMais(true);
      auditoriaApi
        .getAuditoria({
          ...filtros(),
          pagina: tudo ? 0 : Math.floor(registros.length / TAMANHO_PAGINA),
          tamanho: tudo ? 0 : TAMANHO_PAGINA,
        })
        .then((p) => {
          if (req !== requisicaoAtual.current) return;
          setTotal(p.total);
          setRegistros((atuais) => {
            if (tudo) return p.itens;
            // Dedupe por id: se algo entrou na trilha entre as páginas, não duplica a linha.
            const vistos = new Set(atuais.map((r) => r.id));
            return [...atuais, ...p.itens.filter((r) => !vistos.has(r.id))];
          });
        })
        .catch(() => {})
        .finally(() => setCarregandoMais(false));
    },
    [filtros, registros.length],
  );

  const limpar = () => {
    setFAcao(TODOS);
    setFModulo(TODOS);
    setBusca("");
    setFDe("");
    setFAte("");
  };

  const carregados = registros.length;
  const faltam = Math.max(0, total - carregados);

  // Resolve o evento uma vez por registro: com "carregar todos" seriam milhares de JSON.parse
  // a cada render se isso ficasse dentro do map da tabela.
  const linhas = useMemo(
    () =>
      registros.map((r) => ({
        r,
        evento: eventoDa(r),
        alvo: resumoItem(r.table_name, eventoDa(r), r.record_id, r.item_nome),
      })),
    [registros],
  );

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <Breadcrumbs items={[{ label: "Auditoria" }]} />

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
                Administração
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <History className="h-6 w-6 text-blue-600" />
                Histórico de Alterações
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Quem fez o quê no sistema — todas as ações, de todas as pessoas,
                em todas as áreas. Clique em uma linha para ver exatamente o que
                mudou. O histórico é permanente e ninguém consegue apagá-lo.
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={carregar}
              disabled={loading}
            >
              <RotateCcw className="h-4 w-4 mr-1.5" />
              Atualizar
            </Button>
          </div>

          {/* Filtros */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Área do sistema
              </label>
              <Select value={fModulo} onValueChange={setFModulo}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas as áreas</SelectItem>
                  {modulos.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                O que aconteceu
              </label>
              <Select value={fAcao} onValueChange={setFAcao}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Tudo</SelectItem>
                  {facetas.acoes.map((a) => (
                    <SelectItem key={a} value={a}>
                      {acaoLabel(a)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, e-mail ou número do item…"
                  className="pl-9 h-10 bg-white"
                />
              </div>
            </div>
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Período
              </label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  aria-label="Data inicial"
                  value={fDe}
                  max={fAte || undefined}
                  onChange={(e) => setFDe(e.target.value)}
                  className="h-10 bg-white"
                />
                <span className="text-xs text-slate-400">até</span>
                <Input
                  type="date"
                  aria-label="Data final"
                  value={fAte}
                  min={fDe || undefined}
                  onChange={(e) => setFAte(e.target.value)}
                  className="h-10 bg-white"
                />
              </div>
            </div>
          </div>

          <div className="mb-4 flex flex-wrap items-center gap-2">
            {ATALHOS_PERIODO.map((atalho) => (
              <Button
                key={atalho.rotulo}
                variant="outline"
                size="sm"
                className="h-8 text-xs"
                onClick={() => {
                  const { de, ate } = atalho.intervalo();
                  setFDe(de);
                  setFAte(ate);
                }}
              >
                {atalho.rotulo}
              </Button>
            ))}
            <Button variant="ghost" size="sm" onClick={limpar} className="h-8">
              Limpar filtros
            </Button>
          </div>

          {/* Tabela */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando o histórico…
              </div>
            ) : carregados === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Nenhuma ação registrada para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 font-semibold">Quando</th>
                      <th className="px-4 py-2.5 font-semibold">Quem fez</th>
                      <th className="px-4 py-2.5 font-semibold">
                        O que aconteceu
                      </th>
                      <th className="px-4 py-2.5 font-semibold">Onde</th>
                      <th className="px-4 py-2.5 font-semibold text-right">
                        Detalhes
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linhas.map(({ r, evento, alvo }) => {
                      return (
                        <tr
                          key={r.id}
                          onClick={() => setDetalheId(r.id)}
                          className="cursor-pointer align-top hover:bg-blue-50/40"
                        >
                          <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                            {fmtDataHora(r.created_at)}
                          </td>
                          <td className="px-4 py-3">
                            <p className="text-slate-800">
                              {r.user_name || "Usuário não identificado"}
                            </p>
                            {r.user_email && (
                              <span className="text-xs text-slate-400">
                                {r.user_email}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={cn(
                                "inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                                acaoClasse(evento),
                              )}
                            >
                              {acaoLabel(evento)}
                            </span>
                            {alvo && (
                              <p className="mt-1 text-xs text-slate-600">
                                {alvo}
                              </p>
                            )}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <p className="text-slate-700">
                              {moduloDe(r.table_name)}
                            </p>
                            <span className="text-xs text-slate-400">
                              {tabelaLabel(r.table_name)}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <span
                              className={cn(
                                "inline-flex items-center gap-1 text-xs",
                                r.tem_detalhe
                                  ? "font-medium text-blue-600"
                                  : "text-slate-400",
                              )}
                            >
                              {r.tem_detalhe
                                ? "Ver o que mudou"
                                : "Ver registro"}
                              <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Rodapé de carga: sem teto — dá pra chegar a 100% dos registros */}
          {!loading && carregados > 0 && (
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-slate-400">
                Mostrando {carregados.toLocaleString("pt-BR")} de{" "}
                {total.toLocaleString("pt-BR")}{" "}
                {total === 1 ? "registro" : "registros"} — mais recentes
                primeiro.
              </p>
              {faltam > 0 && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={carregandoMais}
                    onClick={() => carregarMais(false)}
                  >
                    {carregandoMais && (
                      <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    )}
                    Carregar mais{" "}
                    {Math.min(TAMANHO_PAGINA, faltam).toLocaleString("pt-BR")}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={carregandoMais}
                    onClick={() => carregarMais(true)}
                  >
                    Carregar todos os {total.toLocaleString("pt-BR")}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <AuditoriaDetalheDialog
        registroId={detalheId}
        onClose={() => setDetalheId(null)}
      />
    </Layout>
  );
}
