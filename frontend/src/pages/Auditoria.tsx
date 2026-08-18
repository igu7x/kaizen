import { useEffect, useMemo, useState } from "react";
import { Loader2, History, Search, RotateCcw } from "lucide-react";
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
import { auditoriaApi } from "@/services/auditoriaApi";
import type {
  AuditoriaRegistro,
  AuditoriaFacetas,
} from "@/services/auditoriaApi";

const TODOS = "__todos__";

/** Rótulos amigáveis por tabela do audit_log (best-effort; cai no nome cru se não mapeado). */
const TABELA_LABEL: Record<string, string> = {
  // Projetos / Estratégia
  cadastros_projetos: "Projetos",
  cadastros_projetos_entregas: "Projetos — Entregas",
  cadastros_projetos_riscos: "Projetos — Riscos",
  cadastros_projetos_entraves: "Projetos — Entraves",
  tep_termos_encerramento: "Projetos — TEP",
  pdtic_acoes: "PDTIC — Ações",
  processos_negocio: "Escritório de Processos",
  // Contratações
  pcas: "Contratações — PCA",
  pcas_snapshots: "Contratações — PCA (versão)",
  ifo: "Contratações — IFO",
  ifo_contratos: "Contratações — IFO/Contratos",
  contracts: "Contratações — Contratos",
  ciclo_orcamentario: "Ciclo Orçamentário",
  atas_comites: "Atas de Comitês",
  // Pessoas / Competências
  autoavaliacao_formularios: "Pessoas — Autoavaliação",
  avaliacao_gestor_formularios: "Pessoas — Avaliação do Gestor",
  avaliacao_integrada_formularios: "Pessoas — Avaliação Integrada",
  competencias_gestor_formularios: "Pessoas — Matriz de Competências",
  // SGSI
  sgsi_emissao: "SGSI — Emissões",
  sgsi_relatorio: "SGSI — Relatórios",
  sgsi_risco: "SGSI — Riscos",
  sgsi_tarefa: "SGSI — Tarefas 5W2H",
  sgsi_indicador: "SGSI — Indicadores",
  sgsi_framework_item: "SGSI — Frameworks",
  sgsi_documento: "SGSI — Obrigações",
  sgsi_ata: "SGSI — Atas",
  sgsi_configuracao: "SGSI — Configurações",
  sgsi_leitura_requisito: "SGSI — Leitura (requisitos)",
  sgsi_leitura_confirmacao: "SGSI — Leitura (confirmação)",
  sgsi_evento_rh: "SGSI — Eventos de RH",
  sgsi_incidente: "SGSI — Incidentes",
  sgsi_alerta: "SGSI — Alertas",
  sgsi_api_chave: "SGSI — Chaves de API",
  sgsi_webhook: "SGSI — Webhooks",
  sgsi_sbom_sistema: "SGSI — SBOM",
};

/** Agrupa um table_name do audit_log num MÓDULO de negócio (o filtro é por módulo, não por tabela). */
function moduloDe(table: string): string {
  if (table.startsWith("sgsi_")) return "Segurança da Informação";
  if (table.startsWith("cadastros_projetos") || table.startsWith("tep_"))
    return "Projetos";
  if (table === "processos_negocio") return "Escritório de Processos";
  if (table === "pdtic_acoes") return "PDTIC";
  if (
    [
      "pcas",
      "pcas_snapshots",
      "ifo",
      "ifo_contratos",
      "contracts",
      "ciclo_orcamentario",
      "atas_comites",
    ].includes(table)
  )
    return "Contratações de TIC";
  if (
    table.startsWith("autoavaliacao") ||
    table.startsWith("avaliacao_") ||
    table.startsWith("competencias_")
  )
    return "Pessoas / Competências";
  return "Outros";
}

/** Cor por evento/ação (canônicos INSERT/UPDATE/DELETE + eventos semânticos do SGSI). */
const EVENTO_CLASSE: Record<string, string> = {
  INSERT: "bg-emerald-50 text-emerald-700",
  UPDATE: "bg-blue-50 text-blue-700",
  DELETE: "bg-red-50 text-red-600",
  SOFT_DELETE: "bg-amber-50 text-amber-700",
  RESTORE: "bg-emerald-50 text-emerald-700",
  LOGIN: "bg-slate-100 text-slate-600",
  LOGOUT: "bg-slate-100 text-slate-600",
  EXPORT: "bg-indigo-50 text-indigo-700",
  EMITIDO: "bg-emerald-50 text-emerald-700",
  CRIADO: "bg-emerald-50 text-emerald-700",
  ATUALIZADO: "bg-blue-50 text-blue-700",
  AVALIADO: "bg-blue-50 text-blue-700",
  STATUS_ALTERADO: "bg-blue-50 text-blue-700",
  DOC_ASSINADO: "bg-emerald-50 text-emerald-700",
  DOC_REABERTO: "bg-amber-50 text-amber-700",
  CANCELADO: "bg-red-50 text-red-600",
  EXCLUIDO: "bg-red-50 text-red-600",
};

function fmtDataHora(iso?: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "medium" });
}

interface CamposParsed {
  evento: string | null;
  extras: [string, string][];
}

function parseCampos(changed: string | null, action: string): CamposParsed {
  if (!changed) return { evento: action, extras: [] };
  try {
    const obj = JSON.parse(changed) as Record<string, unknown>;
    const evento = (obj.evento as string) ?? action;
    const extras = Object.entries(obj)
      .filter(([k]) => k !== "evento")
      .map(([k, v]) => [k, String(v)] as [string, string]);
    return { evento, extras };
  } catch {
    return { evento: action, extras: [] };
  }
}

export default function Auditoria() {
  const [registros, setRegistros] = useState<AuditoriaRegistro[]>([]);
  const [facetas, setFacetas] = useState<AuditoriaFacetas>({
    acoes: [],
    tabelas: [],
  });
  const [loading, setLoading] = useState(true);
  const [fAcao, setFAcao] = useState(TODOS);
  const [fModulo, setFModulo] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [buscaAplicada, setBuscaAplicada] = useState("");

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

  function carregar() {
    setLoading(true);
    auditoriaApi
      .getAuditoria({
        acao: fAcao === TODOS ? undefined : fAcao,
        // Um módulo agrupa várias tabelas — manda todas (o backend filtra com IN).
        tabela:
          fModulo === TODOS
            ? undefined
            : (modulosTabelas.get(fModulo) || []).join(","),
        busca: buscaAplicada || undefined,
        limite: 300,
      })
      .then(setRegistros)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }

  useEffect(carregar, [fAcao, fModulo, buscaAplicada, modulosTabelas]);

  const total = registros.length;
  const limpar = () => {
    setFAcao(TODOS);
    setFModulo(TODOS);
    setBusca("");
  };

  const linhas = useMemo(
    () =>
      registros.map((r) => ({
        r,
        campos: parseCampos(r.changed_fields, r.action),
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
                Trilha de Auditoria
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Quem fez o quê em todo o sistema — de todos os usuários e módulos.
                Registro imutável em audit_log.
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

          {/* Filtros */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Módulo
              </label>
              <Select value={fModulo} onValueChange={setFModulo}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todos</SelectItem>
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
                Operação
              </label>
              <Select value={fAcao} onValueChange={setFAcao}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODOS}>Todas</SelectItem>
                  {facetas.acoes.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
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
                  placeholder="Ator, e-mail, módulo…"
                  className="pl-9 h-10 bg-white"
                />
              </div>
            </div>
            <div className="flex items-end">
              <Button variant="ghost" onClick={limpar} className="h-10">
                Limpar filtros
              </Button>
            </div>
          </div>

          {/* Tabela */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando trilha…
              </div>
            ) : total === 0 ? (
              <div className="py-16 text-center text-sm text-slate-500">
                Nenhum registro de auditoria para os filtros selecionados.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                    <tr className="text-left">
                      <th className="px-4 py-2.5 font-semibold">Data/hora</th>
                      <th className="px-4 py-2.5 font-semibold">Ator</th>
                      <th className="px-4 py-2.5 font-semibold">Módulo</th>
                      <th className="px-4 py-2.5 font-semibold">Operação</th>
                      <th className="px-4 py-2.5 font-semibold">Recurso</th>
                      <th className="px-4 py-2.5 font-semibold">Detalhe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {linhas.map(({ r, campos }) => (
                      <tr key={r.id} className="align-top hover:bg-slate-50/60">
                        <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                          {fmtDataHora(r.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-slate-800">{r.user_name || "—"}</p>
                          {r.user_email && (
                            <span className="text-xs text-slate-400">
                              {r.user_email}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <p className="text-slate-700">
                            {moduloDe(r.table_name)}
                          </p>
                          <span className="text-xs text-slate-400">
                            {TABELA_LABEL[r.table_name] || r.table_name}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={cn(
                              "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                              (campos.evento &&
                                EVENTO_CLASSE[campos.evento]) ||
                                "bg-slate-100 text-slate-600",
                            )}
                          >
                            {campos.evento || r.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 font-mono text-xs whitespace-nowrap">
                          {r.record_id && r.record_id > 0
                            ? `#${r.record_id}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs max-w-xs">
                          {campos.extras.length === 0 ? (
                            "—"
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {campos.extras.map(([k, v]) => (
                                <span
                                  key={k}
                                  className="rounded bg-slate-100 px-1.5 py-0.5"
                                >
                                  <span className="text-slate-400">{k}:</span>{" "}
                                  {v.length > 40 ? `${v.slice(0, 40)}…` : v}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {total} registro(s) — mais recentes primeiro (limite 300).
          </p>
        </div>
      </div>
    </Layout>
  );
}
