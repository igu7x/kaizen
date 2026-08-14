import { useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Download,
  X,
  Eye,
  ChevronRight,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { pdticAcoesApi, PdticAcao } from "@/services/pdticAcoesApi";

const TODAS = "__todas__";

/** Prazo no formato MM/AAAA a partir de YYYY-MM-DD. */
function prazoMesAno(iso?: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : iso;
}

const concluida = (a: PdticAcao) => !!a.evidencia_nome?.trim();

export default function Pdtic() {
  const [acoes, setAcoes] = useState<PdticAcao[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtroDiretoria, setFiltroDiretoria] = useState(TODAS);
  const [filtroArea, setFiltroArea] = useState(TODAS);
  const [filtroStatus, setFiltroStatus] = useState<
    "todas" | "concluidas" | "pendentes"
  >("todas");
  const [busy, setBusy] = useState<number | null>(null);
  const [expandidos, setExpandidos] = useState<Set<number>>(new Set());
  const toggleExpandir = (id: number) =>
    setExpandidos((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const uploadRef = useRef<HTMLInputElement>(null);
  const uploadAcaoId = useRef<number | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      setAcoes(await pdticAcoesApi.list());
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
  }, []);

  const diretorias = useMemo(
    () =>
      Array.from(
        new Set(acoes.map((a) => a.diretoria).filter(Boolean) as string[]),
      ).sort((a, b) => a.localeCompare(b)),
    [acoes],
  );
  const areas = useMemo(
    () =>
      Array.from(
        new Set(
          acoes
            .filter(
              (a) =>
                filtroDiretoria === TODAS || a.diretoria === filtroDiretoria,
            )
            .map((a) => a.area_responsavel)
            .filter(Boolean) as string[],
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [acoes, filtroDiretoria],
  );

  const filtradas = useMemo(
    () =>
      acoes.filter((a) => {
        if (filtroDiretoria !== TODAS && a.diretoria !== filtroDiretoria)
          return false;
        if (filtroArea !== TODAS && a.area_responsavel !== filtroArea)
          return false;
        return true;
      }),
    [acoes, filtroDiretoria, filtroArea],
  );

  const stats = useMemo(() => {
    const total = filtradas.length;
    const concluidas = filtradas.filter(concluida).length;
    const pendentes = total - concluidas;
    const progresso = total === 0 ? 0 : Math.round((concluidas / total) * 100);
    return { total, concluidas, pendentes, progresso };
  }, [filtradas]);

  // Os cards funcionam como filtro: a tabela respeita o status escolhido (os cards seguem
  // mostrando os totais reais, independentemente do filtro ativo).
  const tabelaFiltradas = useMemo(() => {
    if (filtroStatus === "todas") return filtradas;
    const querConcluida = filtroStatus === "concluidas";
    return filtradas.filter((a) => concluida(a) === querConcluida);
  }, [filtradas, filtroStatus]);

  // ── Evidência ───────────────────────────────────────────────────────────
  const escolherArquivo = (acaoId: number) => {
    uploadAcaoId.current = acaoId;
    uploadRef.current?.click();
  };

  const onArquivoSelecionado = (file?: File) => {
    const acaoId = uploadAcaoId.current;
    if (!file || acaoId == null) return;
    if (file.type !== "application/pdf") {
      toast.error("A evidência deve ser um PDF.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("A evidência deve ter até 10 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      setBusy(acaoId);
      try {
        const upd = await pdticAcoesApi.setEvidencia(acaoId, {
          nome: file.name,
          mime: file.type,
          data: String(reader.result),
        });
        setAcoes((prev) => prev.map((a) => (a.id === acaoId ? upd : a)));
        toast.success("Evidência anexada. Ação concluída.");
      } catch {
        /* erro tratado no apiClient */
      } finally {
        setBusy(null);
      }
    };
    reader.onerror = () => toast.error("Não foi possível ler o arquivo.");
    reader.readAsDataURL(file);
  };

  const abrirEvidencia = async (acaoId: number) => {
    setBusy(acaoId);
    try {
      const ev = await pdticAcoesApi.getEvidencia(acaoId);
      if (!ev.evidencia_data) {
        toast.error("Evidência indisponível.");
        return;
      }
      // Converte o data URL em blob para abrir de forma confiável (PDFs grandes).
      const resp = await fetch(ev.evidencia_data);
      const blob = await resp.blob();
      window.open(URL.createObjectURL(blob), "_blank");
    } catch {
      toast.error("Não foi possível abrir a evidência.");
    } finally {
      setBusy(null);
    }
  };

  const removerEvidencia = async (acaoId: number) => {
    setBusy(acaoId);
    try {
      const upd = await pdticAcoesApi.removerEvidencia(acaoId);
      setAcoes((prev) => prev.map((a) => (a.id === acaoId ? upd : a)));
      toast.success("Evidência removida. Ação voltou a pendente.");
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setBusy(null);
    }
  };

  return (
    <Layout>
      <div className="space-y-5 page-transition-enter">
        <Breadcrumbs
          items={[
            { label: "Gestão Estratégica", to: "/gestao-estrategica" },
            { label: "PDTIC" },
          ]}
        />

        {/* HEADER */}
        <div className="flex items-center gap-4">
          <div
            className="w-1.5 h-12 rounded-full"
            style={{
              background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
            }}
          />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
              Gestão Estratégica
            </p>
            <h1 className="text-2xl font-bold text-slate-800">
              Plano Diretor de TIC - PDTIC
            </h1>
          </div>
        </div>

        {/* Filtros */}
        <div className="flex flex-wrap gap-4">
            <div className="flex flex-col min-w-[220px] flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Diretoria
              </label>
              <Select
                value={filtroDiretoria}
                onValueChange={(v) => {
                  setFiltroDiretoria(v);
                  setFiltroArea(TODAS);
                }}
              >
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue placeholder="Todas as Diretorias" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as Diretorias</SelectItem>
                  {diretorias.map((d) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col min-w-[220px] flex-1">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Área
              </label>
              <Select value={filtroArea} onValueChange={setFiltroArea}>
                <SelectTrigger className="h-10 bg-white">
                  <SelectValue placeholder="Todas as Áreas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={TODAS}>Todas as Áreas</SelectItem>
                  {areas.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              titulo="Ações"
              valor={stats.total}
              icon={<FileText className="h-6 w-6" />}
              cor="blue"
              active={filtroStatus === "todas"}
              onClick={() => setFiltroStatus("todas")}
            />
            <StatCard
              titulo="Concluídas"
              valor={stats.concluidas}
              icon={<CheckCircle2 className="h-6 w-6" />}
              cor="green"
              active={filtroStatus === "concluidas"}
              onClick={() => setFiltroStatus("concluidas")}
            />
            <StatCard
              titulo="Pendentes"
              valor={stats.pendentes}
              icon={<AlertTriangle className="h-6 w-6" />}
              cor="red"
              active={filtroStatus === "pendentes"}
              onClick={() => setFiltroStatus("pendentes")}
            />
            <ProgressoCard progresso={stats.progresso} />
          </div>

          {/* Tabela */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[1fr_200px_120px_120px_120px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span>Ações</span>
              <span>Área responsável</span>
              <span className="text-center">Conclusão</span>
              <span className="text-center">Status</span>
              <span className="text-center">Evidência</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando ações…
              </div>
            ) : tabelaFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <FileText className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm">
                  {filtroStatus === "concluidas"
                    ? "Nenhuma ação concluída para os filtros selecionados."
                    : filtroStatus === "pendentes"
                      ? "Nenhuma ação pendente para os filtros selecionados."
                      : "Nenhuma ação do PDTIC para os filtros selecionados."}
                </p>
                <p className="text-xs mt-1 text-slate-400">
                  Cadastre ações em Cadastros → Ações do PDTIC.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {tabelaFiltradas.map((a) => {
                  const ok = concluida(a);
                  const carregando = busy === a.id;
                  const aberto = expandidos.has(a.id);
                  return (
                    <li key={a.id}>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => toggleExpandir(a.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          toggleExpandir(a.id);
                        }
                      }}
                      aria-expanded={aberto}
                      className="grid grid-cols-[1fr_200px_120px_120px_120px] items-center gap-3 px-5 py-3 hover:bg-slate-50/60 cursor-pointer"
                    >
                      <div className="flex items-start gap-2 min-w-0">
                        <ChevronRight
                          className={cn(
                            "h-4 w-4 mt-0.5 flex-shrink-0 text-slate-400 transition-transform",
                            aberto && "rotate-90",
                          )}
                        />
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-500" />
                        <div className="min-w-0">
                          <p className="text-sm text-slate-800">{a.nome}</p>
                          {a.id_pdtic && (
                            <p className="text-[11px] font-medium uppercase text-slate-400">
                              {a.id_pdtic}
                            </p>
                          )}
                        </div>
                      </div>
                      <div
                        className="truncate text-sm text-slate-600"
                        title={a.area_responsavel || undefined}
                      >
                        {a.area_responsavel || "—"}
                      </div>
                      <div className="text-center text-sm tabular-nums text-slate-600 whitespace-nowrap">
                        {prazoMesAno(a.conclusao)}
                      </div>
                      <div className="flex justify-center">
                        <span
                          className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
                            ok
                              ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                              : "bg-red-50 text-red-600 ring-red-200"
                          }`}
                        >
                          {ok ? "Concluído" : "Pendente"}
                        </span>
                      </div>
                      <div
                        className="flex items-center justify-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {carregando ? (
                          <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                        ) : ok ? (
                          <>
                            <button
                              type="button"
                              title="Ver evidência"
                              onClick={() => abrirEvidencia(a.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-blue-600 hover:bg-blue-50 transition-colors"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              title="Remover evidência"
                              onClick={() => removerEvidencia(a.id)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => escolherArquivo(a.id)}
                            title="Anexar evidência (PDF)"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </button>
                        )}
                      </div>
                    </div>
                    {aberto && <DetalhesAcao a={a} />}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <p className="text-xs text-slate-400">
            {stats.total} açã{stats.total === 1 ? "o" : "es"} ·{" "}
            {stats.concluidas} concluída{stats.concluidas === 1 ? "" : "s"} ·{" "}
            {stats.pendentes} pendente{stats.pendentes === 1 ? "" : "s"}
            {filtroStatus !== "todas" && (
              <span className="ml-1 text-slate-500">
                · filtrando:{" "}
                {filtroStatus === "concluidas" ? "Concluídas" : "Pendentes"}
              </span>
            )}
          </p>
      </div>

      {/* Input de upload oculto (reusado por todas as linhas) */}
      <input
        ref={uploadRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={(e) => {
          onArquivoSelecionado(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </Layout>
  );
}

/** Formata um valor de custo (texto livre, ex.: "2000000,00") como moeda brasileira: R$ 2.000.000,00. */
function formatReais(valor?: string | null): string {
  if (!valor || !valor.trim()) return "";
  const n = Number(
    valor.replace(/R\$/gi, "").replace(/\s/g, "").replace(/\./g, "").replace(",", "."),
  );
  if (Number.isNaN(n)) return valor.trim();
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** Painel expansível com os campos não obrigatórios cadastrados da ação. */
function DetalhesAcao({ a }: { a: PdticAcao }) {
  const curtos: [string, string | null | undefined][] = [
    ["Diretoria", a.diretoria],
    ["Área responsável", a.area_responsavel],
    ["Classe", a.classe],
    ["Indicador", a.indicador],
    ["Reagendada", a.reagendada],
    ["Objetivos ENTIC-JUD", a.objetivos_enticjud],
    ["Macrodesafios TJGO", a.macrodesafios_tjgo],
    [
      "Custo",
      a.com_custo
        ? a.custo?.trim()
          ? formatReais(a.custo)
          : "Sim (valor não informado)"
        : null,
    ],
  ];
  const preenchidos = curtos.filter(([, v]) => v && String(v).trim());
  const necessidade = a.necessidade_identificada?.trim();
  const resultado = a.resultado?.trim();
  const vazio = preenchidos.length === 0 && !necessidade && !resultado;

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-4 pl-11">
      {vazio ? (
        <p className="text-xs text-slate-400">
          Sem informações adicionais cadastradas para esta ação.
        </p>
      ) : (
        <div className="space-y-4">
          {necessidade && (
            <Campo titulo="Necessidade identificada" valor={necessidade} />
          )}
          {resultado && <Campo titulo="Resultado" valor={resultado} />}
          {preenchidos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3">
              {preenchidos.map(([titulo, valor]) => (
                <Campo key={titulo} titulo={titulo} valor={String(valor)} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Campo({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
        {titulo}
      </p>
      <p className="text-sm text-slate-700 whitespace-pre-wrap">{valor}</p>
    </div>
  );
}

function StatCard({
  titulo,
  valor,
  icon,
  cor,
  active,
  onClick,
}: {
  titulo: string;
  valor: number;
  icon: React.ReactNode;
  cor: "blue" | "green" | "red";
  active?: boolean;
  onClick?: () => void;
}) {
  const fundo = {
    blue: "bg-gradient-to-br from-blue-50 to-white",
    green: "bg-gradient-to-br from-emerald-50 to-white",
    red: "bg-gradient-to-br from-red-50 to-white",
  }[cor];
  const iconeCls = {
    blue: "bg-blue-100 text-blue-600",
    green: "bg-emerald-100 text-emerald-600",
    red: "bg-red-100 text-red-600",
  }[cor];
  const anel = {
    blue: "ring-blue-400 border-blue-300",
    green: "ring-emerald-400 border-emerald-300",
    red: "ring-red-400 border-red-300",
  }[cor];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center justify-between rounded-xl border border-slate-200 p-5 text-left transition-all hover:shadow-sm",
        fundo,
        active ? `ring-2 ${anel}` : "hover:border-slate-300",
      )}
    >
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          {titulo}
        </p>
        <p className="mt-1 text-3xl font-bold text-slate-900">{valor}</p>
      </div>
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          iconeCls,
        )}
      >
        {icon}
      </div>
    </button>
  );
}

function ProgressoCard({ progresso }: { progresso: number }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white p-5">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
          Progresso
        </p>
        <p className="text-2xl font-bold text-violet-600">{progresso}%</p>
      </div>
      <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-violet-100">
        <div
          className="h-full rounded-full bg-violet-500 transition-all"
          style={{ width: `${progresso}%` }}
        />
      </div>
    </div>
  );
}
