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
  Target,
  ShoppingCart,
  ShieldCheck,
  BarChart3,
  RefreshCw,
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
import { getPcaStats, getPcaItems, formatCurrency } from "@/services/pcaApi";
import type { PcaStats, PcaItem } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import {
  processosNegocioApi,
  isVigente,
  isK1,
  temDocumentoPrimario,
  type ProcessoNegocio,
} from "@/services/processosNegocioApi";

const TODAS = "__todas__";

// KR-2 (Base) e KR-3 (Alvo) puxam do Plano de Contratações Anual do ano corrente.
// versionNumber undefined = PLANO VIGENTE (dado atual/vivo), igual ao padrão da tela do PCA —
// snapshots congelados (pcas_snapshots) não têm os itens recém-adicionados.
const PCA_ANO = new Date().getFullYear();
const PCA_VERSAO: number | undefined = undefined;
// Meta fixa do KR-2 (não muda com os dados).
const KR2_ALVO = 25;
// Meta fixa do KR-3: nº de processos revisados a atingir.
const KR3_ALVO = 40;
// KR-3: mede quantos processos de negócio de TI VIGENTES são Modelo K1 (base) sobre o total de
// vigentes (alvo). Grupo "ti" = Escritório de Processos / Tecnologia da Informação.
const PROCESSOS_GRUPO_TI = "ti";

/** Prazo no formato MM/AAAA a partir de YYYY-MM-DD. */
function prazoMesAno(iso?: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${m[2]}/${m[1]}` : iso;
}

const concluida = (a: PdticAcao) => !!a.evidencia_nome?.trim();

export default function Pdtic() {
  // Anônimo (rota pública) pode VER/baixar evidências, mas não anexar/remover.
  const { isAuthenticated } = useAuth();
  const podeEditar = isAuthenticated;
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

  // Estatísticas do PCA (versão 1) para alimentar KR-2 (concluídos) e KR-3 (total de itens).
  const [pca, setPca] = useState<PcaStats | null>(null);
  useEffect(() => {
    getPcaStats(PCA_ANO, undefined, PCA_VERSAO)
      .then(setPca)
      .catch(() => {
        /* sem PCA, os KRs dependentes ficam em 0 */
      });
  }, []);

  // KR-3: processos de negócio de TI. Vigentes (alvo) e quantos deles são Modelo K1 (base).
  const [processos, setProcessos] = useState<ProcessoNegocio[]>([]);
  const [processosLoading, setProcessosLoading] = useState(true);
  useEffect(() => {
    processosNegocioApi
      .getAll(undefined, PROCESSOS_GRUPO_TI)
      .then(setProcessos)
      .catch(() => {
        /* sem processos, o KR-3 fica em 0 */
      })
      .finally(() => setProcessosLoading(false));
  }, []);
  // "Vigentes" = mesma base da aba "Processos Vigentes" do Escritório de Processos
  // (isVigente OU com documento primário anexado). É mais amplo que só isVigente — por isso os
  // Modelo K1 (isK1) são um SUBCONJUNTO dos vigentes (ex.: 10 vigentes, 4 K1).
  const processosVigentes = useMemo(
    () => processos.filter((p) => isVigente(p) || temDocumentoPrimario(p)),
    [processos],
  );
  const processosK1 = useMemo(
    () => processosVigentes.filter(isK1),
    [processosVigentes],
  );
  // Filtro dentro do KR-3: "todos" (card Processos Vigentes) ou "revisados" (card Processos Revisados).
  const [processoFiltro, setProcessoFiltro] = useState<"todos" | "revisados">(
    "todos",
  );
  const processosTabela = useMemo(
    () => (processoFiltro === "revisados" ? processosK1 : processosVigentes),
    [processoFiltro, processosK1, processosVigentes],
  );

  // KR clicado (filtro): "kr1" → ações; "kr2" → itens do PCA; "kr3" → processos de TI vigentes.
  const [krAtivo, setKrAtivo] = useState<"kr1" | "kr2" | "kr3" | null>(null);
  const [pcaItens, setPcaItens] = useState<PcaItem[]>([]);
  const [pcaItensLoading, setPcaItensLoading] = useState(false);
  const [pcaItensCarregado, setPcaItensCarregado] = useState(false);
  // Filtro dentro do KR-2: "todos" (card Alvo) ou "concluidos" (card Concluída).
  const [pcaFiltro, setPcaFiltro] = useState<"todos" | "concluidos">("todos");
  const pcaConcluidos = useMemo(
    () =>
      pcaItens.filter((p) =>
        String(p.status).toLowerCase().startsWith("conclu"),
      ),
    [pcaItens],
  );
  // Lista exibida na tabela do KR-2, respeitando o card-filtro (Alvo/Concluída).
  const pcaTabela = useMemo(
    () => (pcaFiltro === "concluidos" ? pcaItens.filter(pcaConcluido) : pcaItens),
    [pcaItens, pcaFiltro],
  );

  const handleKr1 = () => {
    // KR-1 mostra TODAS as ações (a coluna Status já indica concluída/pendente).
    // Clicar repetidamente mantém o KR-1 ativo (sem toggle) — só sai dele pelos cards de status.
    setKrAtivo("kr1");
    setFiltroStatus("todas");
  };

  const handleKr2 = () => {
    // Idempotente: clicar de novo no KR-2 continua no KR-2 (sem voltar pro modo Ações).
    setKrAtivo("kr2");
    setPcaFiltro("todos");
    if (!pcaItensCarregado) {
      setPcaItensLoading(true);
      getPcaItems(PCA_ANO, undefined, PCA_VERSAO)
        .then((its) => {
          setPcaItens(its);
          setPcaItensCarregado(true);
        })
        .catch(() => {
          /* erro tratado no apiClient */
        })
        .finally(() => setPcaItensLoading(false));
    }
  };

  // KR-3: mostra a relação dos processos de TI vigentes (a coluna Revisado indica os revisados).
  const handleKr3 = () => {
    setKrAtivo("kr3");
    setProcessoFiltro("todos");
  };

  /** Volta para o modo de Ações (limpa o KR ativo) e aplica o filtro de status escolhido. */
  const selecionarStatus = (s: "todas" | "concluidas" | "pendentes") => {
    setKrAtivo(null);
    setFiltroStatus(s);
  };

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

  // KRs do PDTIC. KR-1 vem das ações (Base = concluídas, Alvo = total). KR-2/KR-3 vêm do PCA.
  // O Atingimento Geral fica em 0% até os 3 KRs estarem bem estabelecidos.
  const krs = useMemo(() => {
    const pctd = (base: number, alvo: number) =>
      alvo > 0 ? Math.round((base / alvo) * 100) : 0;
    const kr1Base = stats.concluidas;
    const kr1Alvo = stats.total;
    const kr2Base = pca?.concluidos ?? 0;
    const kr3Base = processosK1.length; // processos revisados (Modelo K1)
    const kr1Pct = pctd(kr1Base, kr1Alvo);
    const kr2Pct = pctd(kr2Base, KR2_ALVO);
    const kr3Pct = pctd(kr3Base, KR3_ALVO); // progresso rumo à meta de 40 revisados
    return {
      kr1: { base: kr1Base, alvo: kr1Alvo, pct: kr1Pct },
      kr2: { base: kr2Base, alvo: KR2_ALVO, pct: kr2Pct },
      kr3: { base: kr3Base, alvo: KR3_ALVO, pct: kr3Pct },
      // Atingimento Geral do PDTIC = média simples dos 3 KRs.
      geral: Math.round((kr1Pct + kr2Pct + kr3Pct) / 3),
    };
  }, [stats.concluidas, stats.total, pca, processosK1]);

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

          {/* KRs (Resultados-Chave) */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
            <KrCard
              tag="KR-1"
              tagColor="text-blue-600"
              iconBg="bg-blue-50 text-blue-600"
              icon={<Target className="h-6 w-6" />}
              titulo="Cumprir 80% das Ações Planejadas dentro do prazo de conclusão definido no quadro de ações"
              gaugeColor="#2563eb"
              pct={krs.kr1.pct}
              onClick={handleKr1}
              active={krAtivo === "kr1"}
              activeRing="ring-blue-400"
              linhas={[
                ["Mensurado", "% de ações concluídas"],
                ["Fonte", "Painel de Ações"],
                ["Frequência", "Anual"],
                ["Base", String(krs.kr1.base)],
                ["Alvo", String(krs.kr1.alvo)],
              ]}
            />
            <KrCard
              tag="KR-2"
              tagColor="text-emerald-600"
              iconBg="bg-emerald-50 text-emerald-600"
              icon={<ShoppingCart className="h-6 w-6" />}
              titulo="Concluir 25 demandas de aquisições de TIC do plano de contratação anual vigente"
              gaugeColor="#16a34a"
              pct={krs.kr2.pct}
              onClick={handleKr2}
              active={krAtivo === "kr2"}
              activeRing="ring-emerald-400"
              linhas={[
                ["Mensurado", "% de contratos assinados"],
                ["Fonte", "Plano de Contratações"],
                ["Frequência", "Semestral"],
                ["Base", String(krs.kr2.base)],
                ["Alvo", String(krs.kr2.alvo)],
              ]}
            />
            <KrCard
              tag="KR-3"
              tagColor="text-violet-600"
              iconBg="bg-violet-50 text-violet-600"
              icon={<ShieldCheck className="h-6 w-6" />}
              titulo="Manter 95% de compliance quanto à transparência, aprovação e revisão dos planejamentos táticos e processos e planos de negócio em TIC"
              gaugeColor="#7c3aed"
              pct={krs.kr3.pct}
              onClick={handleKr3}
              active={krAtivo === "kr3"}
              activeRing="ring-violet-400"
              linhas={[
                ["Mensurado", "% de processos revisados (meta 40)"],
                ["Fonte", "Escritório de Processos (TI)"],
                ["Frequência", "Anual"],
                ["Base", String(krs.kr3.base)],
                ["Alvo", String(krs.kr3.alvo)],
              ]}
            />
            <AtingimentoGeralCard pct={krs.geral} />
          </div>

          {/* Cards — KR-2 ativo mostra Alvo/Concluída do PCA; senão, os totais das ações */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {krAtivo === "kr2" ? (
              <>
                <StatCard
                  titulo="Alvo"
                  valor={krs.kr2.alvo}
                  icon={<Target className="h-6 w-6" />}
                  cor="blue"
                  active={pcaFiltro === "todos"}
                  onClick={() => setPcaFiltro("todos")}
                />
                <StatCard
                  titulo="Concluída"
                  valor={krs.kr2.base}
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  cor="green"
                  active={pcaFiltro === "concluidos"}
                  onClick={() => setPcaFiltro("concluidos")}
                />
                <ProgressoCard
                  progresso={krs.kr2.pct}
                  className="sm:col-span-2"
                />
              </>
            ) : krAtivo === "kr3" ? (
              <>
                <StatCard
                  titulo="Processos Vigentes"
                  valor={processosVigentes.length}
                  icon={<ShieldCheck className="h-6 w-6" />}
                  cor="blue"
                  active={processoFiltro === "todos"}
                  onClick={() => setProcessoFiltro("todos")}
                />
                <StatCard
                  titulo="Processos Revisados"
                  valor={krs.kr3.base}
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  cor="green"
                  active={processoFiltro === "revisados"}
                  onClick={() => setProcessoFiltro("revisados")}
                />
                <ProgressoCard
                  progresso={krs.kr3.pct}
                  className="sm:col-span-2"
                />
              </>
            ) : (
              <>
                <StatCard
                  titulo="Ações"
                  valor={stats.total}
                  icon={<FileText className="h-6 w-6" />}
                  cor="blue"
                  active={krAtivo === null && filtroStatus === "todas"}
                  onClick={() => selecionarStatus("todas")}
                />
                <StatCard
                  titulo="Concluídas"
                  valor={stats.concluidas}
                  icon={<CheckCircle2 className="h-6 w-6" />}
                  cor="green"
                  active={krAtivo === null && filtroStatus === "concluidas"}
                  onClick={() => selecionarStatus("concluidas")}
                />
                <StatCard
                  titulo="Pendentes"
                  valor={stats.pendentes}
                  icon={<AlertTriangle className="h-6 w-6" />}
                  cor="red"
                  active={krAtivo === null && filtroStatus === "pendentes"}
                  onClick={() => selecionarStatus("pendentes")}
                />
                <ProgressoCard progresso={stats.progresso} />
              </>
            )}
          </div>

          {/* Tabela: Ações do PDTIC — ou os itens do PCA concluídos quando o KR-2 está ativo */}
          {krAtivo === "kr2" ? (
            <PcaItensTabela
              itens={pcaTabela}
              loading={pcaItensLoading}
              filtro={pcaFiltro}
            />
          ) : krAtivo === "kr3" ? (
            <ProcessosTabela
              processos={processosTabela}
              k1Ids={new Set(processosK1.map((p) => p.id))}
              loading={processosLoading}
            />
          ) : (
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[minmax(0,1fr)_260px_110px_110px_110px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
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
                      className="grid grid-cols-[minmax(0,1fr)_260px_110px_110px_110px] items-center gap-3 px-5 py-3 hover:bg-slate-50/60 cursor-pointer"
                    >
                      <div className="flex items-start gap-2 min-w-0 pr-6">
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
                        className="text-sm text-slate-600 break-words"
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
                            {podeEditar && (
                              <button
                                type="button"
                                title="Remover evidência"
                                onClick={() => removerEvidencia(a.id)}
                                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </>
                        ) : podeEditar ? (
                          <button
                            type="button"
                            onClick={() => escolherArquivo(a.id)}
                            title="Anexar evidência (PDF)"
                            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                          >
                            <Download className="h-4 w-4" />
                            PDF
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
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
          )}

          {krAtivo === "kr3" ? (
            <p className="text-xs text-slate-400">
              {processosVigentes.length} processo(s) de TI vigente(s) ·{" "}
              {processosK1.length} revisado(s) · meta {KR3_ALVO}.
            </p>
          ) : krAtivo === "kr2" ? (
            <p className="text-xs text-slate-400">
              {pcaItens.length} item(ns) do PCA · {pcaConcluidos.length}{" "}
              concluído(s) — Plano de Contratações Anual {PCA_ANO} (vigente).
            </p>
          ) : (
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
          )}
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

/** Gauge circular (270°) com o percentual no centro. */
function KrGauge({ pct, color }: { pct: number; color: string }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  const size = 128;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const track = circ * 0.75; // arco de 270°, com a abertura embaixo
  const filled = track * (v / 100);
  return (
    <div className="relative flex h-28 w-28 items-center justify-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="h-28 w-28"
        style={{ transform: "rotate(135deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth={stroke}
          strokeDasharray={`${track} ${circ}`}
          strokeLinecap="round"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={`${filled} ${circ}`}
          strokeLinecap="round"
          className="transition-[stroke-dasharray] duration-500"
        />
      </svg>
      <span className="absolute text-2xl font-bold text-slate-900">{v}%</span>
    </div>
  );
}

/** Card de um Resultado-Chave (KR) do PDTIC: cabeçalho, gauge e a ficha (Mensurado/Fonte/…). */
function KrCard({
  tag,
  tagColor,
  iconBg,
  icon,
  titulo,
  gaugeColor,
  pct,
  linhas,
  onClick,
  active = false,
  activeRing,
}: {
  tag: string;
  tagColor: string;
  iconBg: string;
  icon: React.ReactNode;
  titulo: string;
  gaugeColor: string;
  pct: number;
  linhas: [string, string][];
  onClick?: () => void;
  active?: boolean;
  activeRing?: string;
}) {
  const clicavel = !!onClick;
  return (
    <div
      role={clicavel ? "button" : undefined}
      tabIndex={clicavel ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        clicavel
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      className={cn(
        "flex flex-col rounded-2xl border border-slate-200 bg-white p-5 transition-shadow",
        clicavel && "cursor-pointer hover:shadow-md",
        active && cn("ring-2 ring-offset-1", activeRing),
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("shrink-0 rounded-xl p-2.5", iconBg)}>{icon}</div>
        <div className="min-w-0">
          <p className={cn("text-lg font-bold", tagColor)}>{tag}</p>
          <p className="text-xs leading-snug text-slate-600">{titulo}</p>
        </div>
      </div>
      <div className="my-3 flex justify-center">
        <KrGauge pct={pct} color={gaugeColor} />
      </div>
      <table className="w-full text-xs">
        <tbody>
          {linhas.map(([k, v]) => (
            <tr key={k} className="border-t border-slate-100">
              <td className="py-1.5 pr-2 font-medium text-slate-500">{k}</td>
              <td className="py-1.5 text-slate-700">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Card de Atingimento Geral do PDTIC (0% até os 3 KRs estarem estabelecidos). */
function AtingimentoGeralCard({ pct }: { pct: number }) {
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="shrink-0 rounded-xl bg-blue-50 p-2.5 text-blue-600">
          <BarChart3 className="h-6 w-6" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold uppercase tracking-wide text-blue-600">
            Atingimento Geral
          </p>
          <p className="mt-1.5 text-xs font-semibold text-slate-500">Objetivo</p>
          <p className="text-xs leading-snug text-slate-700">
            Aumentar a satisfação dos usuários com recursos de TIC
          </p>
        </div>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center py-4">
        <span className="text-4xl font-bold text-blue-600">{v}%</span>
        <span className="mt-1 text-xs text-slate-500">Atingimento do PDTIC</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-blue-600 transition-all"
          style={{ width: `${v}%` }}
        />
      </div>
    </div>
  );
}

// A API do PCA responde em snake_case; a interface PcaItem mistura nomes, então lemos os campos
// reais de forma defensiva (item_pca, area_demandante) sem depender dos apelidos camelCase.
type PcaRow = PcaItem & { item_pca?: string; area_demandante?: string };
const codPca = (p: PcaItem) => (p as PcaRow).item_pca ?? p.itemPca ?? "";
const areaPca = (p: PcaItem) =>
  (p as PcaRow).area_demandante ?? p.areaSigla ?? p.areaNome ?? "";

/** Um item do PCA está concluído quando o status começa com "Conclu" (Concluída/Concluído). */
const pcaConcluido = (p: PcaItem) =>
  String(p.status).toLowerCase().startsWith("conclu");

/** Rótulo do status do item do PCA para exibição. */
function pcaStatusLabel(p: PcaItem): string {
  const s = String(p.status ?? "").toLowerCase();
  if (s.startsWith("conclu")) return "Concluído";
  if (s.includes("andamento")) return "Em andamento";
  if (s.includes("inici")) return "Não iniciada";
  return String(p.status ?? "").trim() || "—";
}

/** Tabela de TODOS os itens do PCA (exibida no KR-2), com a coluna de status por item. */
function PcaItensTabela({
  itens,
  loading,
  filtro,
}: {
  itens: PcaItem[];
  loading: boolean;
  filtro: "todos" | "concluidos";
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando itens do PCA…
      </div>
    );
  }
  if (itens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-500">
        <ShoppingCart className="h-8 w-8 text-slate-300 mb-2" />
        <p className="text-sm">
          {filtro === "concluidos"
            ? "Nenhum item concluído no PCA vigente."
            : "Nenhum item no PCA vigente."}
        </p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {/* Cabeçalho — alinhado às colunas de cada linha (Tipo · PCA/Objeto · Área · Valor · Status) */}
      <div className="flex items-center gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <div className="w-16 shrink-0 text-center">Tipo</div>
        <div className="min-w-0 flex-1">PCA / Objeto</div>
        <div className="hidden shrink-0 items-center gap-6 md:flex">
          <div className="w-32 text-center">Área</div>
          <div className="w-32 text-right">Valor estimado</div>
          <div className="w-28 text-center">Status</div>
        </div>
      </div>
      <div className="divide-y divide-slate-100">
      {itens.map((p) => {
        const renov =
          p.tipo === "Renovação" || p.contract_type === "Renovação";
        const cod = codPca(p);
        const num = parseInt(cod, 10);
        const ok = pcaConcluido(p);
        return (
          <div
            key={p.id}
            className="flex items-center gap-4 px-5 py-4"
          >
            {/* Ícone por tipo (Renovação/Nova) — mesmo padrão do Plano de Contratações */}
            <div className="flex w-16 shrink-0 flex-col items-center gap-2">
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl shadow-lg",
                  renov
                    ? "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/30"
                    : "bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-600/30",
                )}
              >
                {renov ? (
                  <RefreshCw className="h-5 w-5 text-white" />
                ) : (
                  <FileText className="h-5 w-5 text-white" />
                )}
              </div>
              <span
                className={cn(
                  "text-[11px] font-medium leading-none",
                  renov ? "text-emerald-600" : "text-blue-600",
                )}
              >
                {renov ? "Renovação" : "Nova"}
              </span>
            </div>

            {/* Número do PCA + objeto */}
            <div className="min-w-0 flex-1">
              <p className="truncate text-base font-semibold text-slate-900">
                {cod ? (num ? `PCA ${num}` : cod) : "—"}
              </p>
              <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">
                {p.objeto || "—"}
              </p>
            </div>

            {/* Colunas (desktop): área · valor · status */}
            <div className="hidden shrink-0 items-center gap-6 md:flex">
              <div className="w-32 text-center text-sm text-slate-700">
                {areaPca(p) || "—"}
              </div>
              <div className="w-32 text-right text-sm font-bold text-emerald-700">
                {formatCurrency(Number(p.valor_estimado || 0))}
              </div>
              <div className="flex w-28 justify-center">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                    ok
                      ? "bg-emerald-50 text-emerald-700 ring-emerald-200"
                      : "bg-amber-50 text-amber-700 ring-amber-200",
                  )}
                >
                  {pcaStatusLabel(p)}
                </span>
              </div>
            </div>
          </div>
        );
      })}
      </div>
    </div>
  );
}

/** Tabela dos processos de TI VIGENTES (exibida no KR-3); a coluna Modelo marca os Modelo K1. */
function ProcessosTabela({
  processos,
  k1Ids,
  loading,
}: {
  processos: ProcessoNegocio[];
  k1Ids: Set<number>;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-slate-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando processos…
      </div>
    );
  }
  if (processos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white py-16 text-center text-slate-500">
        <ShieldCheck className="mb-2 h-8 w-8 text-slate-300" />
        <p className="text-sm">Nenhum processo de TI vigente.</p>
      </div>
    );
  }
  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      <div className="grid grid-cols-[130px_minmax(0,1fr)_160px_120px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
        <span>Código</span>
        <span>Processo</span>
        <span>Diretoria</span>
        <span className="text-center">Revisado</span>
      </div>
      <ul className="divide-y divide-slate-100">
        {processos.map((p) => {
          const ehK1 = k1Ids.has(p.id);
          return (
            <li
              key={p.id}
              className="grid grid-cols-[130px_minmax(0,1fr)_160px_120px] items-center gap-3 px-5 py-3"
            >
              <span className="text-xs font-medium tabular-nums text-slate-500">
                {p.codigo || "—"}
              </span>
              <div className="flex min-w-0 items-center gap-2">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 text-violet-500" />
                <p className="truncate text-sm text-slate-800">
                  {p.nome_processo}
                </p>
              </div>
              <span
                className="truncate text-sm text-slate-600"
                title={p.diretoria}
              >
                {p.diretoria || "—"}
              </span>
              <div className="flex justify-center">
                {ehK1 ? (
                  <span className="inline-flex items-center rounded-full bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
                    Revisado
                  </span>
                ) : (
                  <span className="text-xs text-slate-400">—</span>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
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

function ProgressoCard({
  progresso,
  className,
}: {
  progresso: number;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col justify-center rounded-xl border border-slate-200 bg-gradient-to-br from-violet-50 to-white p-5",
        className,
      )}
    >
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
