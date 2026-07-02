import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  FileSearch,
  XCircle,
  RefreshCcw,
  CalendarClock,
  PlusCircle,
  Layers,
  Send,
  Trash2,
  CheckCircle2,
  Undo2,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { areasApi, type Unidade } from "@/services/areasApi";
import {
  dfdApi,
  ifoApi,
  type DfdConsulta as DfdConsultaData,
  type DfdItem,
  type DfdPcaItem,
  type BlocoDfd,
  type Ifo,
} from "@/services/dfdApi";
import { cicloOrcamentarioApi } from "@/services/cicloOrcamentarioApi";
import { cn } from "@/lib/utils";

const ANOS = [2025, 2026, 2027];
const TODAS = "todas";

function formatBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

const BLOCO_LABEL: Record<string, string> = {
  encerramento: "Encerramento",
  renovacao: "Renovação",
  plurianual: "Plurianual",
  nova_contratacao: "Nova Contratação",
};

const ESTADO_IFO_BADGE: Record<string, string> = {
  rascunho: "bg-gray-100 text-gray-600 border-gray-200",
  enviado_cca: "bg-blue-100 text-blue-700 border-blue-200",
  consolidado: "bg-purple-100 text-purple-700 border-purple-200",
  publicado: "bg-green-100 text-green-700 border-green-200",
};

const ESTADO_IFO_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  enviado_cca: "Enviado à CCA",
  consolidado: "Consolidado",
  publicado: "Publicado",
};

// §8.4 — validação por demanda em 2 camadas.
const VALIDACAO_LABEL: Record<string, string> = {
  em_edicao: "Em edição",
  validada_1a: "Validada 1ª",
  validada_2a: "Validada 2ª",
};

const VALIDACAO_BADGE: Record<string, string> = {
  em_edicao: "bg-slate-100 text-slate-600 border-slate-200",
  validada_1a: "bg-amber-100 text-amber-700 border-amber-200",
  validada_2a: "bg-emerald-100 text-emerald-700 border-emerald-200",
};

/**
 * DFD-Consulta (Orçamento de TIC, Cap. 1) — instrumento de captura da Formação. Mostra os 4 blocos
 * canônicos derivados dos contratos continuada da unidade + itens do PCA-TIC corrente (RF-01..05),
 * permite agrupar contratos em IFOs (banda-envelope, RF-10/24) e enviá-los à CCA (RF-26).
 */
export default function DfdConsulta() {
  const [ano, setAno] = useState<number>(2026);
  const [unidadeId, setUnidadeId] = useState<number | undefined>(undefined);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [data, setData] = useState<DfdConsultaData | null>(null);
  const [ifos, setIfos] = useState<Ifo[]>([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  // Seleção para agrupar em IFO — escopada a um único bloco por vez.
  const [selBloco, setSelBloco] = useState<BlocoDfd | null>(null);
  const [selIds, setSelIds] = useState<Set<number>>(new Set());
  const [criandoIfo, setCriandoIfo] = useState(false);

  // Ciclo de formação do exercício — amarra os IFOs à esteira (permite a remessa da partição, §8.4).
  const [cicloId, setCicloId] = useState<number | null>(null);
  useEffect(() => {
    setCicloId(null);
  }, [ano]);

  const garantirCicloId = useCallback(async (): Promise<number | null> => {
    if (cicloId != null) return cicloId;
    try {
      const c = await cicloOrcamentarioApi.getOuAbrirFormacao(ano);
      setCicloId(c.id);
      return c.id;
    } catch {
      return null;
    }
  }, [cicloId, ano]);

  useEffect(() => {
    areasApi
      .getAllUnidades()
      .then((us) => setUnidades(us))
      .catch(() => setUnidades([]));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    setSelBloco(null);
    setSelIds(new Set());
    try {
      setData(await dfdApi.getConsulta(ano, unidadeId));
    } catch {
      setErro("Não foi possível carregar a DFD-Consulta.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ano, unidadeId]);

  const carregarIfos = useCallback(async () => {
    try {
      setIfos(await ifoApi.listar(ano));
    } catch {
      setIfos([]);
    }
  }, [ano]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  useEffect(() => {
    carregarIfos();
  }, [carregarIfos]);

  const toggleItem = (bloco: BlocoDfd, id: number) => {
    if (selBloco !== bloco) {
      // Trocar de bloco reinicia a seleção (IFO agrupa contratos de um único bloco).
      setSelBloco(bloco);
      setSelIds(new Set([id]));
      return;
    }
    setSelIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const criarIfo = async (bloco: BlocoDfd, itens: DfdItem[]) => {
    const selecionados = itens.filter((i) => selIds.has(i.contractId));
    if (selecionados.length === 0) return;
    setCriandoIfo(true);
    try {
      const valor = selecionados.reduce((s, i) => s + (i.valorTotal || 0), 0);
      const objeto =
        selecionados.length === 1
          ? selecionados[0].objeto || "Item de formação"
          : `Banda-envelope (${selecionados.length} contratos)`;
      const cid = await garantirCicloId();
      await ifoApi.criar({
        ano,
        cicloId: cid,
        bloco,
        natureza: "continuada",
        objeto,
        areaDemandante: selecionados[0].unidade,
        unidadeId: unidadeId ?? null,
        valorEstimado: valor,
        interesseRenovacao: bloco === "renovacao" ? true : null,
        contratos: selecionados.map((i) => i.contractId),
      });
      toast.success("IFO criado.");
      setSelBloco(null);
      setSelIds(new Set());
      carregarIfos();
    } catch {
      toast.error("Não foi possível criar o IFO.");
    } finally {
      setCriandoIfo(false);
    }
  };

  const enviarCca = async (ifo: Ifo) => {
    try {
      await ifoApi.enviarCca(ifo.id);
      toast.success(`${ifo.codigo} enviado à CCA.`);
      carregarIfos();
    } catch {
      toast.error("Não foi possível enviar à CCA.");
    }
  };

  // §8.4 — validação por demanda: 1ª camada (Gestor Demandante) → 2ª camada (Diretor de Área).
  const validarDemanda = async (ifo: Ifo, camada: 1 | 2) => {
    try {
      await ifoApi.validar(ifo.id, camada);
      toast.success(`${ifo.codigo} validado (${camada}ª camada).`);
      carregarIfos();
    } catch {
      toast.error("Não foi possível validar (só a Autoridade Demandante pode; a 2ª exige a 1ª).");
    }
  };

  // RN-GERAL-07 — devolve a demanda à edição, derrubando as validações.
  const devolverDemanda = async (ifo: Ifo) => {
    try {
      await ifoApi.devolverDemanda(ifo.id);
      toast.success(`${ifo.codigo} devolvido à edição.`);
      carregarIfos();
    } catch {
      toast.error("Não foi possível devolver a demanda.");
    }
  };

  // RN-GERAL-08 — remessa da partição (todos os IFO da unidade no ciclo) à CCA; só com tudo em 2ª camada.
  const remeterParticao = async () => {
    if (unidadeId == null) {
      toast.error("Selecione uma unidade específica para remeter a partição.");
      return;
    }
    const cid = await garantirCicloId();
    if (cid == null) {
      toast.error("Não foi possível resolver o ciclo de formação.");
      return;
    }
    try {
      const r = await ifoApi.remeterParticao(cid, unidadeId);
      toast.success(`Partição remetida à CCA (${r.remetidas} demanda(s)).`);
      carregarIfos();
    } catch {
      toast.error("Remessa bloqueada: todas as demandas precisam estar validadas em 2ª camada.");
    }
  };

  const excluirIfo = async (ifo: Ifo) => {
    try {
      await ifoApi.excluir(ifo.id);
      toast.success(`${ifo.codigo} removido.`);
      carregarIfos();
    } catch {
      toast.error("Não foi possível remover o IFO.");
    }
  };

  // RF-07 — interesse na renovação
  const [reclassificando, setReclassificando] = useState<Ifo | null>(null);
  const [motivo, setMotivo] = useState("");

  const marcarInteresse = async (ifo: Ifo, interesse: boolean, motivoTexto?: string) => {
    try {
      await ifoApi.definirInteresseRenovacao(ifo.id, interesse, motivoTexto);
      toast.success(
        interesse ? "Interesse na renovação confirmado." : `${ifo.codigo} reclassificado para Encerramento.`,
      );
      carregarIfos();
    } catch {
      toast.error("Não foi possível atualizar o interesse na renovação.");
    }
  };

  const confirmarReclassificacao = async () => {
    if (!reclassificando) return;
    await marcarInteresse(reclassificando, false, motivo);
    setReclassificando(null);
    setMotivo("");
  };

  const totalGeral = useMemo(() => {
    if (!data) return 0;
    const soma = (arr: DfdItem[]) => arr.reduce((s, i) => s + (i.valorTotal || 0), 0);
    return (
      soma(data.encerramento) +
      soma(data.renovacao) +
      soma(data.plurianual) +
      data.novaContratacao.reduce((s, i) => s + (i.valorEstimado || 0), 0)
    );
  }, [data]);

  const selCount = (bloco: BlocoDfd) => (selBloco === bloco ? selIds.size : 0);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <FileSearch className="h-6 w-6 text-blue-600" />
            DFD-Consulta
          </h1>
          <p className="text-sm text-gray-500">
            Captura da Formação — contratos continuada classificados por ciclo de vida + itens do PCA-TIC.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v, 10))}>
            <SelectTrigger className="w-[120px] h-9 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={unidadeId === undefined ? TODAS : String(unidadeId)}
            onValueChange={(v) => setUnidadeId(v === TODAS ? undefined : parseInt(v, 10))}
          >
            <SelectTrigger className="w-[260px] h-9 bg-white">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : erro ? (
        <p className="text-sm text-red-600 py-8 text-center">{erro}</p>
      ) : data ? (
        <>
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
              <span className="text-gray-600">
                Exercício <strong>{data.ano}</strong> ·{" "}
                {data.encerramento.length + data.renovacao.length + data.plurianual.length} contratos continuada ·{" "}
                {data.novaContratacao.length} itens do PCA
              </span>
              <span className="font-semibold text-gray-800">
                Total estimado: {formatBRL(totalGeral)}
              </span>
            </CardContent>
          </Card>

          <BlocoContratos
            titulo="1 · Encerramento"
            descricao="Continuada que encerra no exercício sem prazo de prorrogação — exige nova contratação."
            bloco="encerramento"
            icone={<XCircle className="h-5 w-5" />}
            cor="red"
            itens={data.encerramento}
            selecionadosIds={selBloco === "encerramento" ? selIds : EMPTY}
            onToggle={toggleItem}
            onCriarIfo={criarIfo}
            criandoIfo={criandoIfo}
            selCount={selCount("encerramento")}
          />
          <BlocoContratos
            titulo="2 · Renovação"
            descricao="Continuada que encerra no exercício com prazo de prorrogação — sujeita a interesse na renovação."
            bloco="renovacao"
            icone={<RefreshCcw className="h-5 w-5" />}
            cor="amber"
            itens={data.renovacao}
            selecionadosIds={selBloco === "renovacao" ? selIds : EMPTY}
            onToggle={toggleItem}
            onCriarIfo={criarIfo}
            criandoIfo={criandoIfo}
            selCount={selCount("renovacao")}
          />
          <BlocoContratos
            titulo="3 · Plurianual"
            descricao="Continuada cuja vigência ultrapassa o exercício — segue vigente, sem ação nesta formação."
            bloco="plurianual"
            icone={<CalendarClock className="h-5 w-5" />}
            cor="blue"
            itens={data.plurianual}
            selecionadosIds={selBloco === "plurianual" ? selIds : EMPTY}
            onToggle={toggleItem}
            onCriarIfo={criarIfo}
            criandoIfo={criandoIfo}
            selCount={selCount("plurianual")}
          />
          <BlocoNovaContratacao itens={data.novaContratacao} />

          <PainelIfos
            ifos={ifos}
            onEnviarCca={enviarCca}
            onExcluir={excluirIfo}
            onValidar={validarDemanda}
            onDevolver={devolverDemanda}
            onRemeter={remeterParticao}
            podeRemeter={unidadeId != null}
            onRenovarSim={(ifo) => marcarInteresse(ifo, true)}
            onRenovarNao={(ifo) => {
              setMotivo("");
              setReclassificando(ifo);
            }}
          />
        </>
      ) : null}

      <Dialog open={reclassificando != null} onOpenChange={(o) => !o && setReclassificando(null)}>
        <DialogContent className="bg-white">
          <DialogHeader>
            <DialogTitle className="text-gray-800">
              Sem interesse na renovação — {reclassificando?.codigo}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-500">
            O item será reclassificado automaticamente para <strong>Encerramento</strong> (RF-07). Informe o
            motivo (registrado em metadado).
          </p>
          <Input
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Motivo da não renovação"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReclassificando(null)}>
              Cancelar
            </Button>
            <Button className="bg-red-600 hover:bg-red-700 text-white" onClick={confirmarReclassificacao}>
              Reclassificar para Encerramento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const EMPTY: Set<number> = new Set();

const CORES: Record<string, { header: string; ring: string; badge: string }> = {
  red: { header: "text-red-700", ring: "border-red-200", badge: "bg-red-100 text-red-700 border-red-200" },
  amber: { header: "text-amber-700", ring: "border-amber-200", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  blue: { header: "text-blue-700", ring: "border-blue-200", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  green: { header: "text-green-700", ring: "border-green-200", badge: "bg-green-100 text-green-700 border-green-200" },
};

function BlocoContratos({
  titulo,
  descricao,
  bloco,
  icone,
  cor,
  itens,
  selecionadosIds,
  onToggle,
  onCriarIfo,
  criandoIfo,
  selCount,
}: {
  titulo: string;
  descricao: string;
  bloco: BlocoDfd;
  icone: React.ReactNode;
  cor: "red" | "amber" | "blue";
  itens: DfdItem[];
  selecionadosIds: Set<number>;
  onToggle: (bloco: BlocoDfd, id: number) => void;
  onCriarIfo: (bloco: BlocoDfd, itens: DfdItem[]) => void;
  criandoIfo: boolean;
  selCount: number;
}) {
  const c = CORES[cor];
  const total = itens.reduce((s, i) => s + (i.valorTotal || 0), 0);
  return (
    <Card className={cn("border", c.ring)}>
      <CardHeader className="pb-3">
        <CardTitle className={cn("flex items-center gap-2 text-base", c.header)}>
          {icone} {titulo}
          <Badge variant="outline" className={cn("ml-1", c.badge)}>
            {itens.length}
          </Badge>
          <span className="ml-auto text-sm font-normal text-gray-500">{formatBRL(total)}</span>
          {selCount > 0 && (
            <Button
              size="sm"
              className="ml-3 h-8 bg-blue-600 hover:bg-blue-700"
              disabled={criandoIfo}
              onClick={() => onCriarIfo(bloco, itens)}
            >
              <Layers className="h-4 w-4 mr-1.5" />
              Criar IFO ({selCount})
            </Button>
          )}
        </CardTitle>
        <p className="text-xs text-gray-500">{descricao}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {itens.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nenhum contrato neste bloco.</p>
        ) : (
          <div className="space-y-1.5">
            {itens.map((i) => (
              <div
                key={i.contractId}
                className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <Checkbox
                  className="mt-0.5"
                  checked={selecionadosIds.has(i.contractId)}
                  onCheckedChange={() => onToggle(bloco, i.contractId)}
                  aria-label={`Selecionar contrato ${i.contractId}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-gray-800 truncate">{i.objeto || "—"}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {i.supplier || "Fornecedor não informado"}
                    {i.process ? ` · ${i.process}` : ""}
                    {i.unidade ? ` · ${i.unidade}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600">
                  <span>Vigência até {formatData(i.endDate)}</span>
                  {i.limitDate && <span>Limite {formatData(i.limitDate)}</span>}
                  <span className="font-semibold text-gray-800">{formatBRL(i.valorTotal)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlocoNovaContratacao({ itens }: { itens: DfdPcaItem[] }) {
  const c = CORES.green;
  const total = itens.reduce((s, i) => s + (i.valorEstimado || 0), 0);
  return (
    <Card className={cn("border", c.ring)}>
      <CardHeader className="pb-3">
        <CardTitle className={cn("flex items-center gap-2 text-base", c.header)}>
          <PlusCircle className="h-5 w-5" /> 4 · Nova Contratação
          <Badge variant="outline" className={cn("ml-1", c.badge)}>
            {itens.length}
          </Badge>
          <span className="ml-auto text-sm font-normal text-gray-500">{formatBRL(total)}</span>
        </CardTitle>
        <p className="text-xs text-gray-500">
          Pré-preenchido com os itens do PCA-TIC corrente (itens pontuais não entram nesta formação).
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {itens.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nenhum item do PCA para o exercício.</p>
        ) : (
          <div className="space-y-1.5">
            {itens.map((i) => (
              <div
                key={i.pcaId ?? i.itemPca}
                className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <Badge variant="outline" className={cn("shrink-0 font-mono text-xs", c.badge)}>
                  {i.itemPca || "—"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{i.objeto || "—"}</p>
                  <p className="text-xs text-gray-500">{i.areaDemandante || "—"}</p>
                </div>
                <span className="text-xs font-semibold text-gray-800">{formatBRL(i.valorEstimado)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PainelIfos({
  ifos,
  onEnviarCca,
  onExcluir,
  onValidar,
  onDevolver,
  onRemeter,
  podeRemeter,
  onRenovarSim,
  onRenovarNao,
}: {
  ifos: Ifo[];
  onEnviarCca: (ifo: Ifo) => void;
  onExcluir: (ifo: Ifo) => void;
  onValidar: (ifo: Ifo, camada: 1 | 2) => void;
  onDevolver: (ifo: Ifo) => void;
  onRemeter: () => void;
  podeRemeter: boolean;
  onRenovarSim: (ifo: Ifo) => void;
  onRenovarNao: (ifo: Ifo) => void;
}) {
  return (
    <Card className="border-gray-200">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base text-gray-800">
          <Layers className="h-5 w-5 text-blue-600" /> IFOs do exercício
          <Badge variant="outline" className="ml-1 bg-gray-100 text-gray-600 border-gray-200">
            {ifos.length}
          </Badge>
          {podeRemeter && ifos.some((i) => i.estado === "rascunho") && (
            <Button
              size="sm"
              variant="outline"
              className="ml-auto h-8 text-indigo-700 border-indigo-200 hover:bg-indigo-50"
              onClick={onRemeter}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Remeter partição à CCA
            </Button>
          )}
        </CardTitle>
        <p className="text-xs text-gray-500">
          Bandas-envelope (IFO-{"{"}ano{"}"}-NNNN) geradas a partir da DFD-Consulta. Na publicação viram código oficial de PCA.
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {ifos.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">
            Nenhum IFO criado. Selecione contratos em um bloco e use "Criar IFO".
          </p>
        ) : (
          <div className="space-y-1.5">
            {ifos.map((ifo) => (
              <div
                key={ifo.id}
                className="flex flex-wrap items-center gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <Badge variant="outline" className="font-mono text-xs bg-white border-gray-300 text-gray-700">
                  {ifo.codigo}
                </Badge>
                <span className="text-xs text-gray-500">{BLOCO_LABEL[ifo.bloco] ?? ifo.bloco}</span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{ifo.objeto || "—"}</p>
                  <p className="text-xs text-gray-500">
                    {ifo.contratos.length} contrato(s) · {formatBRL(ifo.valorEstimado)}
                  </p>
                  {ifo.motivoReclassificacao && (
                    <p className="text-[11px] text-red-500">
                      Reclassificado (RF-07): {ifo.motivoReclassificacao}
                    </p>
                  )}
                </div>
                {ifo.bloco === "renovacao" && ifo.estado === "rascunho" && (
                  <div className="flex items-center gap-1 text-xs text-gray-500">
                    <span>Renovar?</span>
                    <Button
                      size="sm"
                      variant={ifo.interesseRenovacao ? "default" : "outline"}
                      className={cn("h-7 px-2", ifo.interesseRenovacao && "bg-green-600 hover:bg-green-700")}
                      onClick={() => onRenovarSim(ifo)}
                    >
                      Sim
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 px-2 text-red-600 border-red-200 hover:bg-red-50"
                      onClick={() => onRenovarNao(ifo)}
                    >
                      Não
                    </Button>
                  </div>
                )}
                {ifo.codigoOficial && (
                  <Badge
                    variant="outline"
                    className="text-xs font-mono bg-green-100 text-green-700 border-green-200"
                    title="Código oficial de Item de PCA (convertido na publicação)"
                  >
                    PCA {ifo.codigoOficial}
                  </Badge>
                )}
                {ifo.estado === "rascunho" && (
                  <Badge
                    variant="outline"
                    className={cn("text-xs", VALIDACAO_BADGE[ifo.validacao ?? "em_edicao"])}
                    title="Validação por demanda (§8.4)"
                  >
                    {VALIDACAO_LABEL[ifo.validacao ?? "em_edicao"]}
                  </Badge>
                )}
                <Badge
                  variant="outline"
                  className={cn("text-xs", ESTADO_IFO_BADGE[ifo.estado] ?? ESTADO_IFO_BADGE.rascunho)}
                >
                  {ESTADO_IFO_LABEL[ifo.estado] ?? ifo.estado}
                </Badge>
                {ifo.estado === "rascunho" && (
                  <div className="flex items-center gap-1">
                    {(ifo.validacao ?? "em_edicao") === "em_edicao" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-amber-700 border-amber-200 hover:bg-amber-50"
                        onClick={() => onValidar(ifo, 1)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Validar 1ª
                      </Button>
                    )}
                    {ifo.validacao === "validada_1a" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        onClick={() => onValidar(ifo, 2)}
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                        Validar 2ª (Diretor)
                      </Button>
                    )}
                    {ifo.validacao != null && ifo.validacao !== "em_edicao" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2 text-slate-500 hover:bg-slate-100"
                        onClick={() => onDevolver(ifo)}
                      >
                        <Undo2 className="h-3.5 w-3.5 mr-1.5" />
                        Devolver
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 text-blue-700 border-blue-200 hover:bg-blue-50"
                      onClick={() => onEnviarCca(ifo)}
                    >
                      <Send className="h-3.5 w-3.5 mr-1.5" />
                      Enviar à CCA
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-red-600 hover:bg-red-50"
                      onClick={() => onExcluir(ifo)}
                      aria-label="Remover IFO"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
