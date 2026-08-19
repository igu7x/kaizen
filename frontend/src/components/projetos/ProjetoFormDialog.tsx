import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import {
  Plus,
  Edit,
  Eye,
  FolderKanban,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Calendar,
  Users,
  Target,
  FileText,
  Package,
  Loader2,
  Pencil,
  Check,
  History,
  FileDown,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  cadastrosProjetosApi,
  Projeto,
  CreateProjetoDto,
  Colaborador,
  Area,
  CreateEntregaDto,
  CreateRiscoDto,
  CreateEntraveDto,
} from "@/services/cadastrosProjetosApi";
import {
  planosProgramasApi,
  InstrumentoAncoragem,
} from "@/services/planosProgramasApi";
import { areasApi, Area as AreaDiretoria, Unidade } from "@/services/areasApi";
import { validateTAPFields, generateTAPPdf } from "@/utils/generateTAP";
import { pcaApi } from "@/services/pcaApi";
import type { PcaItem } from "@/types";

// ============================================================
// HELPERS
// ============================================================
const formatDateForInput = (dateString: string | null | undefined): string => {
  if (!dateString) return "";
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return "";
    return date.toISOString().split("T")[0];
  } catch {
    return "";
  }
};

const formatDatePtBr = (dateString: string | null | undefined): string => {
  if (!dateString) return "-";
  const ymd = dateString.substring(0, 10);
  const date = new Date(ymd + "T00:00:00");
  if (isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("pt-BR");
};

/** Rótulo amigável de um item do PCA: "ano - código - object_name" */
const labelPcaItem = (item: PcaItem): string => {
  const ano = item.ano || item.year || "-";
  let num = String(item.item_pca || item.code || "");
  num = num.padStart(3, "0");
  const desc = item.object_name || item.objeto || item.description || "";
  return `${ano} - PCA ${num} - ${desc}`;
};

const tapFieldMap: Record<string, string> = {
  "Nome do Projeto": "nome",
  "Nº do Proad": "tap_vinculado",
  "Data Prevista de Início": "data_prevista_inicio",
  "Data Prevista de Conclusão": "data_prevista_conclusao",
  Objetivo: "objetivo",
  "Contexto e Justificativa": "contexto_justificativa",
  Patrocinador: "patrocinador_id",
  Gestor: "gestor_id",
  Escopo: "escopo_sintetico",
  "Fora do Escopo": "fora_do_escopo",
  "Entregas (pelo menos 1)": "entregas",
  "Ancoragem Estratégica (pelo menos 1)": "instrumentos",
};

// ============================================================
// PROPS
// ============================================================
export interface ProjetoFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit" | "view";
  onModeChange: (mode: "create" | "edit" | "view") => void;
  /** Quando true, oculta o formulário detalhado e mostra apenas o painel de
   *  validação do TAP — usado para o fluxo "Gerar TAP" / "Visualizar TAP",
   *  onde a edição dos campos do projeto é feita pelo botão "Editar Projeto". */
  slim?: boolean;
  projetoId: number | null;
  diretoria?: string;
  onSaved?: (projeto: Projeto) => void;
  /** Quando true, o submit (mode='edit') envia apenas os 13 campos do TAP.
   *  Usado para usuários com Permissão do TAP — alterações em outros campos
   *  são descartadas no salvar. Exibe banner de aviso no topo. */
  tapEditMode?: boolean;
  /** Nome da diretoria do usuário com Permissão TAP — usado no banner. */
  tapEditDiretoria?: string | null;
  /** "Revisar TAP" (no modo slim, TAP vigente): abre a edição do projeto para gerar nova versão. */
  onRevisar?: () => void;
}

// ============================================================
// COMPONENT
// ============================================================
export function ProjetoFormDialog({
  open,
  onOpenChange,
  mode,
  onModeChange,
  slim = false,
  projetoId,
  diretoria,
  onSaved,
  tapEditMode = false,
  tapEditDiretoria = null,
  onRevisar,
}: ProjetoFormDialogProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const currentUserId = user?.id ? Number(user.id) : null;
  const isSuperadmin =
    (user as { is_superadmin?: boolean } | null)?.is_superadmin === true;
  // Campos "destacados" (Nome do Projeto, toda a Governança e Responsáveis, Prioridade,
  // Complexidade, Saúde e Justificativa da Saúde) só podem ser alterados por superadmin ao
  // EDITAR um projeto existente. Na criação seguem liberados para quem cria (ADMIN/Gestor).
  const camposRestritos = mode === "view" || (mode === "edit" && !isSuperadmin);

  // Estado da validação TAP
  const [validandoCamadaTAP, setValidandoCamadaTAP] = useState<number | null>(
    null,
  );

  // Recusa do TAP
  const [recusaDialogOpen, setRecusaDialogOpen] = useState(false);
  const [recusaCamada, setRecusaCamada] = useState<2 | 3 | null>(null);
  const [recusaComentario, setRecusaComentario] = useState("");
  const [recusandoTAP, setRecusandoTAP] = useState(false);

  // Histórico de versões do TAP
  const [versoesDialogOpen, setVersoesDialogOpen] = useState(false);
  const [versoes, setVersoes] = useState<
    Array<{
      versao: number;
      validado_em: string | null;
      validado_por_nome: string | null;
    }>
  >([]);
  const [loadingVersoes, setLoadingVersoes] = useState(false);
  const [loadingPdfVersao, setLoadingPdfVersao] = useState<number | null>(null);

  // Aux data
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [diretorias, setDiretorias] = useState<AreaDiretoria[]>([]);
  const [unidadesDiretorias, setUnidadesDiretorias] = useState<
    (Unidade & { diretoria_sigla?: string })[]
  >([]);
  const [instrumentos, setInstrumentos] = useState<InstrumentoAncoragem[]>([]);
  const [pcaItens, setPcaItens] = useState<PcaItem[]>([]);
  const [auxLoaded, setAuxLoaded] = useState(false);

  // Form state
  const [selectedProjeto, setSelectedProjeto] = useState<Projeto | null>(null);

  // Camada 2 (Diretor) = diretor da 1ª diretoria indicada na Governança do projeto
  // (areas_vinculadas_ids), resolvida pelo cadastro de diretorias. Fallback: diretoria de domínio.
  const camada2Area = (() => {
    const ids = (selectedProjeto as { areas_vinculadas_ids?: number[] } | null)
      ?.areas_vinculadas_ids;
    const firstId = ids && ids.length > 0 ? ids[0] : null;
    return firstId ? (diretorias.find((d) => d.id === firstId) ?? null) : null;
  })();
  const camada2DiretorUserId =
    camada2Area?.gestor_user_id ??
    (selectedProjeto as { diretor_user_id?: number } | null)?.diretor_user_id;
  const camada2DiretoriaLabel =
    camada2Area?.sigla || selectedProjeto?.diretoria || "-";
  const [formData, setFormData] = useState<CreateProjetoDto>({
    codigo: "",
    nome: "",
    descricao_sintetica: "",
    objetivo: "",
    contexto_justificativa: "",
    patrocinador_id: undefined,
    patrocinador_cargo: "",
    gestor_id: undefined,
    gestor_cargo: "",
    ancoragem_estrategica_plano_gestao: false,
    ancoragem_estrategica_pep: false,
    ancoragem_estrategica_programa_x: false,
    instrumentos_ids: [],
    escopo_sintetico: "",
    fora_do_escopo: "",
    data_prevista_inicio: "",
    data_prevista_conclusao: "",
    status: "planejado",
    prioridade: "media",
    complexidade: "media",
    abrangencia: "uma_unidade",
    havera_contratacao: false,
    valor_estimado_contratacao: undefined,
    pcas_id: undefined,
    saude: "verde",
    saude_justificativa: "",
    tap_vinculado: "",
    observacoes_gerais: "",
    areas_execucao: [],
    areas_vinculadas_ids: [],
    entregas: [],
    riscos: [],
    entraves: [],
  });

  const [tempEntregas, setTempEntregas] = useState<CreateEntregaDto[]>([]);
  const [tempRiscos, setTempRiscos] = useState<CreateRiscoDto[]>([]);
  const [tempEntraves, setTempEntraves] = useState<CreateEntraveDto[]>([]);
  const [novaEntrega, setNovaEntrega] = useState({
    nome: "",
    area_responsavel_id: null as number | null,
    prazo_estimado: "",
  });

  // Edição inline de entrega já cadastrada
  const [editingEntregaIdx, setEditingEntregaIdx] = useState<number | null>(
    null,
  );
  const [editEntregaDraft, setEditEntregaDraft] = useState({
    nome: "",
    area_responsavel_id: null as number | null,
    prazo_estimado: "",
  });

  const [buscaPatrocinador, setBuscaPatrocinador] = useState("");
  const [buscaGestor, setBuscaGestor] = useState("");
  const [buscaPca, setBuscaPca] = useState("");
  const [showPcaList, setShowPcaList] = useState(false);
  const [showPatrocinadorList, setShowPatrocinadorList] = useState(false);
  const [showGestorList, setShowGestorList] = useState(false);
  const [ancoragemSearch, setAncoragemSearch] = useState("");

  const [tapMissingFields, setTapMissingFields] = useState<string[]>([]);
  const [tapValidationDialogOpen, setTapValidationDialogOpen] = useState(false);

  // ============================================================
  // EFFECTS
  // ============================================================

  // Carregar dados auxiliares (apenas quando abre o dialog)
  useEffect(() => {
    if (!open || auxLoaded) return;
    const loadAuxiliares = async () => {
      try {
        const colabs = await cadastrosProjetosApi.getColaboradores(diretoria);
        setColaboradores(colabs);
      } catch (e) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
      try {
        const areasData = await cadastrosProjetosApi.getAreas(diretoria);
        setAreas(areasData);
      } catch (e) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
      try {
        const allDiretorias = await areasApi.getAll();
        setDiretorias(allDiretorias);
      } catch (e) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
      try {
        const instrumentosData =
          await planosProgramasApi.getInstrumentosParaAncoragem(diretoria);
        setInstrumentos(instrumentosData);
      } catch (e) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
      try {
        // Itens do PCA (Contratações de TIC > Orçamento > PCA) para vincular à contratação.
        const pcaData = await pcaApi.getPcaItems();
        setPcaItens(pcaData.filter((p) => !p.is_deleted));
      } catch (e) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
      setAuxLoaded(true);
    };
    loadAuxiliares();
  }, [open, diretoria, auxLoaded]);

  // Carregar projeto e popular form quando abre em modo edit/view
  useEffect(() => {
    if (!open) return;
    setTapMissingFields([]);
    setTempEntregas([]);
    setTempRiscos([]);
    setTempEntraves([]);
    setNovaEntrega({ nome: "", area_responsavel_id: null, prazo_estimado: "" });

    if (projetoId && (mode === "edit" || mode === "view")) {
      const loadProjeto = async () => {
        try {
          const projetoCompleto =
            await cadastrosProjetosApi.getProjetoById(projetoId);
          setSelectedProjeto(projetoCompleto);
          setFormData({
            codigo: projetoCompleto.codigo || "",
            nome: projetoCompleto.nome,
            descricao_sintetica: projetoCompleto.descricao_sintetica || "",
            objetivo: projetoCompleto.objetivo || "",
            contexto_justificativa:
              projetoCompleto.contexto_justificativa || "",
            patrocinador_id: projetoCompleto.patrocinador_id || undefined,
            patrocinador_cargo: projetoCompleto.patrocinador_cargo || "",
            gestor_id: projetoCompleto.gestor_id || undefined,
            gestor_cargo: projetoCompleto.gestor_cargo || "",
            ancoragem_estrategica_plano_gestao:
              projetoCompleto.ancoragem_estrategica_plano_gestao,
            ancoragem_estrategica_pep:
              projetoCompleto.ancoragem_estrategica_pep,
            ancoragem_estrategica_programa_x:
              projetoCompleto.ancoragem_estrategica_programa_x,
            instrumentos_ids:
              projetoCompleto.instrumentos?.map((i) => i.instrumento_id) || [],
            escopo_sintetico: projetoCompleto.escopo_sintetico || "",
            fora_do_escopo: projetoCompleto.fora_do_escopo || "",
            data_prevista_inicio: formatDateForInput(
              projetoCompleto.data_prevista_inicio,
            ),
            data_prevista_conclusao: formatDateForInput(
              projetoCompleto.data_prevista_conclusao,
            ),
            status: projetoCompleto.status,
            prioridade: projetoCompleto.prioridade,
            complexidade: projetoCompleto.complexidade,
            abrangencia: projetoCompleto.abrangencia,
            havera_contratacao: projetoCompleto.havera_contratacao,
            valor_estimado_contratacao:
              projetoCompleto.valor_estimado_contratacao || undefined,
            pcas_id: projetoCompleto.pcas_id ?? undefined,
            saude: projetoCompleto.saude,
            saude_justificativa: projetoCompleto.saude_justificativa || "",
            tap_vinculado: projetoCompleto.tap_vinculado || "",
            observacoes_gerais: projetoCompleto.observacoes_gerais || "",
            areas_execucao:
              projetoCompleto.areasExecucao?.map((a) => a.area_id) || [],
            areas_vinculadas_ids: projetoCompleto.areas_vinculadas_ids || [],
          });
          if (projetoCompleto.entregas && projetoCompleto.entregas.length > 0) {
            setTempEntregas(
              projetoCompleto.entregas.map((e) => ({
                id: e.id,
                nome: e.nome,
                descricao: e.descricao || undefined,
                status: e.status,
                area_responsavel_id: e.area_responsavel_id,
                ordem: e.ordem,
                prazo_estimado: e.prazo_estimado || null,
                areas_responsaveis: [],
              })),
            );
          }
          if (projetoCompleto.riscos && projetoCompleto.riscos.length > 0) {
            setTempRiscos(
              projetoCompleto.riscos.map((r) => ({
                descricao: r.descricao,
                probabilidade: r.probabilidade,
                impacto: r.impacto,
                tratamento: r.tratamento || undefined,
                observacoes: r.observacoes || undefined,
              })),
            );
          }
          if (projetoCompleto.entraves && projetoCompleto.entraves.length > 0) {
            setTempEntraves(
              projetoCompleto.entraves.map((e) => ({
                id: e.id,
                descricao: e.descricao,
                data_identificacao: e.data_identificacao,
                observacoes: e.observacoes || undefined,
              })),
            );
          }
        } catch (error) {
          /* erro já tratado pelo apiClient ou ignorado intencionalmente */
        }
      };
      loadProjeto();
    } else if (mode === "create") {
      setSelectedProjeto(null);
      setFormData({
        codigo: "",
        nome: "",
        descricao_sintetica: "",
        objetivo: "",
        contexto_justificativa: "",
        patrocinador_id: undefined,
        gestor_id: undefined,
        ancoragem_estrategica_plano_gestao: false,
        ancoragem_estrategica_pep: false,
        ancoragem_estrategica_programa_x: false,
        instrumentos_ids: [],
        escopo_sintetico: "",
        fora_do_escopo: "",
        data_prevista_inicio: "",
        data_prevista_conclusao: "",
        status: "planejado",
        prioridade: "media",
        complexidade: "media",
        abrangencia: "uma_unidade",
        havera_contratacao: false,
        valor_estimado_contratacao: undefined,
        saude: "verde",
        saude_justificativa: "",
        tap_vinculado: "",
        observacoes_gerais: "",
        areas_execucao: [],
        areas_vinculadas_ids: [],
      });
      setBuscaPatrocinador("");
      setBuscaGestor("");
    }
  }, [open, projetoId, mode]);

  // Preencher nomes de patrocinador/gestor quando colaboradores carregam
  useEffect(() => {
    if (!selectedProjeto || colaboradores.length === 0) return;
    const patrocinador = colaboradores.find(
      (c) => c.id === selectedProjeto.patrocinador_id,
    );
    const gestor = colaboradores.find(
      (c) => c.id === selectedProjeto.gestor_id,
    );
    setBuscaPatrocinador(patrocinador?.nome || "");
    setBuscaGestor(gestor?.nome || "");
  }, [selectedProjeto, colaboradores]);

  // Carregar unidades das diretorias selecionadas
  useEffect(() => {
    const fetchUnidades = async () => {
      const ids = formData.areas_vinculadas_ids || [];
      if (ids.length === 0) {
        setUnidadesDiretorias([]);
        return;
      }
      try {
        const promises = ids.map(async (areaId) => {
          const unidades = await areasApi.getUnidades(areaId);
          const dir = diretorias.find((d) => d.id === areaId);
          const sigla = dir?.sigla || dir?.nome || "";
          return unidades.map((u) => ({ ...u, diretoria_sigla: sigla }));
        });
        const results = await Promise.all(promises);
        const todasUnidades = results.flat();
        setUnidadesDiretorias(todasUnidades);
        const idsValidos = new Set(todasUnidades.map((u) => u.id));
        setFormData((prev) => {
          const current = prev.areas_execucao || [];
          const filtered = current.filter((id) => idsValidos.has(id));
          if (filtered.length !== current.length) {
            return { ...prev, areas_execucao: filtered };
          }
          return prev;
        });
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    };
    fetchUnidades();
  }, [formData.areas_vinculadas_ids, diretorias]);

  // Patrocinador e Gestor podem ser de QUALQUER diretoria — não restringimos
  // por areas_vinculadas_ids para permitir, p.ex., um patrocinador SGJT de um
  // projeto vinculado a outra diretoria.
  const filteredColaboradores = useMemo(() => colaboradores, [colaboradores]);

  // ============================================================
  // HANDLERS
  // ============================================================
  const isTapFieldMissing = (fieldKey: string): boolean => {
    return tapMissingFields.some((f) => tapFieldMap[f] === fieldKey);
  };

  // Área Responsável: seleção ÚNICA — escolher outra substitui a atual; escolher a mesma remove.
  const toggleAreaExecucao = (areaId: number) => {
    setFormData((prev) => ({
      ...prev,
      areas_execucao: (prev.areas_execucao || []).includes(areaId)
        ? []
        : [areaId],
    }));
  };

  // Diretoria: seleção ÚNICA — trocar substitui a atual e limpa a área responsável
  // (as unidades disponíveis dependem da diretoria escolhida).
  const handleAdicionarDiretoria = (value: string) => {
    const areaId = parseInt(value);
    if (!areaId || formData.areas_vinculadas_ids?.includes(areaId)) return;
    setFormData((prev) => ({
      ...prev,
      areas_vinculadas_ids: [areaId],
      areas_execucao: [],
    }));
  };

  // Remover a diretoria do projeto (limpa também a área responsável vinculada a ela)
  const handleRemoverDiretoria = (_areaId: number) => {
    setFormData((prev) => ({
      ...prev,
      areas_vinculadas_ids: [],
      areas_execucao: [],
    }));
  };

  const handleAddEntrega = () => {
    if (!novaEntrega.nome.trim()) {
      toast({
        title: "Atenção",
        description: "Digite o nome da entrega",
        variant: "destructive",
      });
      return;
    }
    const novaEntregaObj: CreateEntregaDto = {
      ...novaEntrega,
      prazo_estimado: novaEntrega.prazo_estimado || null,
      status: "pendente",
      ordem: tempEntregas.length,
      areas_responsaveis: [],
    };
    setTempEntregas((prev) => [...prev, novaEntregaObj]);
    setNovaEntrega({ nome: "", area_responsavel_id: null, prazo_estimado: "" });
    toast({
      title: "Entrega adicionada",
      description: `"${novaEntrega.nome}" foi adicionada à lista`,
    });
  };

  const handleValidarCamadaTAP = async (camada: number) => {
    if (!selectedProjeto) return;
    setValidandoCamadaTAP(camada);
    try {
      await cadastrosProjetosApi.validarTAP(selectedProjeto.id, camada);
      const updated = await cadastrosProjetosApi.getProjetoById(
        selectedProjeto.id,
      );
      setSelectedProjeto(updated);
      const labels = ["", "Gestor", "Diretor", "Patrocinador"];
      toast({
        title:
          camada === 3
            ? "TAP Vigente! Validação concluída."
            : `TAP validado — Camada ${camada} (${labels[camada]})`,
      });
      onSaved?.(updated);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setValidandoCamadaTAP(null);
    }
  };

  const abrirDialogRecusa = (camada: 2 | 3) => {
    setRecusaCamada(camada);
    setRecusaComentario("");
    setRecusaDialogOpen(true);
  };

  const handleAbrirVersoes = async () => {
    if (!selectedProjeto) return;
    setVersoesDialogOpen(true);
    setLoadingVersoes(true);
    try {
      const data = await cadastrosProjetosApi.getTapVersoes(selectedProjeto.id);
      setVersoes(data);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingVersoes(false);
    }
  };

  const handlePdfVersao = async (versao: number) => {
    if (!selectedProjeto) return;
    setLoadingPdfVersao(versao);
    try {
      const dados = await cadastrosProjetosApi.getTapVersaoDados(
        selectedProjeto.id,
        versao,
      );
      await generateTAPPdf(dados);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingPdfVersao(null);
    }
  };

  const handleRecusarTAP = async () => {
    if (!selectedProjeto || !recusaCamada) return;
    setRecusandoTAP(true);
    try {
      await cadastrosProjetosApi.recusarTAP(
        selectedProjeto.id,
        recusaCamada,
        recusaComentario.trim() || null,
      );
      const updated = await cadastrosProjetosApi.getProjetoById(
        selectedProjeto.id,
      );
      setSelectedProjeto(updated);
      onSaved?.(updated);
      setRecusaDialogOpen(false);
      setRecusaCamada(null);
      setRecusaComentario("");
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setRecusandoTAP(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome?.trim()) {
      toast({
        title: "Erro",
        description: "O nome do projeto é obrigatório",
        variant: "destructive",
      });
      return;
    }
    if (mode === "edit") {
      const camposFaltando: string[] = [];
      if (!formData.nome?.trim()) camposFaltando.push("Nome do Projeto");
      if (!diretoria) camposFaltando.push("Diretoria");
      if (!formData.areas_execucao || formData.areas_execucao.length === 0)
        camposFaltando.push("Área Responsável");
      if (camposFaltando.length > 0) {
        toast({
          title: "Não é possível salvar",
          description: `Os seguintes campos obrigatórios não podem ser removidos: ${camposFaltando.join(", ")}`,
          variant: "destructive",
        });
        return;
      }
    }

    try {
      const entregasParaSalvar = [...tempEntregas];
      const riscosParaSalvar = [...tempRiscos];
      const entravesParaSalvar = [...tempEntraves];

      if (novaEntrega.nome && novaEntrega.nome.trim() !== "") {
        entregasParaSalvar.push({
          nome: novaEntrega.nome.trim(),
          area_responsavel_id: novaEntrega.area_responsavel_id,
          prazo_estimado: novaEntrega.prazo_estimado || null,
          status: "pendente",
          ordem: entregasParaSalvar.length,
          areas_responsaveis: [],
        });
        setNovaEntrega({
          nome: "",
          area_responsavel_id: null,
          prazo_estimado: "",
        });
      }

      let dataToSend: any = {
        ...formData,
        diretoria,
        entregas: entregasParaSalvar,
        riscos: riscosParaSalvar,
        entraves: entravesParaSalvar,
      };

      // Modo Permissão TAP: só envia os 13 campos que compõem o TAP.
      // Alterações em outros campos são descartadas antes do PUT.
      if (tapEditMode && mode === "edit") {
        const TAP_PAYLOAD_KEYS = [
          "nome",
          "tap_vinculado",
          "data_prevista_inicio",
          "data_prevista_conclusao",
          "objetivo",
          "contexto_justificativa",
          "patrocinador_id",
          "gestor_id",
          "escopo_sintetico",
          "fora_do_escopo",
          "entregas",
          "instrumentos_ids",
          "prioridade",
          "complexidade",
        ];
        const filtered: any = {};
        for (const k of TAP_PAYLOAD_KEYS) {
          if ((dataToSend as any)[k] !== undefined)
            filtered[k] = (dataToSend as any)[k];
        }
        dataToSend = filtered;
      }

      let projetoSalvo: Projeto;
      if (mode === "create") {
        projetoSalvo = await cadastrosProjetosApi.createProjeto(dataToSend);

        onSaved?.(projetoSalvo);
        onOpenChange(false); // create finalizado — fecha o dialog
      } else if (mode === "edit" && selectedProjeto) {
        await cadastrosProjetosApi.updateProjeto(
          selectedProjeto.id,
          dataToSend,
        );
        projetoSalvo = await cadastrosProjetosApi.getProjetoById(
          selectedProjeto.id,
        );
        setSelectedProjeto(projetoSalvo);

        onSaved?.(projetoSalvo);
        // Após salvar, volta para o modo de visualização travado (sem fechar
        // o dialog) — assim o usuário vê o resultado e decide continuar editando
        // ou fechar manualmente.
        onModeChange("view");
      } else {
        return;
      }
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handlePropostaTAP = async () => {
    const projetoParaValidar = {
      ...formData,
      entregas:
        tempEntregas.length > 0
          ? tempEntregas.map((e, i) => ({
              id: i,
              projeto_id: 0,
              nome: e.nome,
              descricao: null,
              status: "pendente" as const,
              quantidade_sprints: 0,
              ordem: i,
              area_responsavel_id: e.area_responsavel_id,
              area_responsavel_nome:
                areas.find((a) => a.id === e.area_responsavel_id)?.nome_area ||
                null,
              prazo_estimado: e.prazo_estimado || null,
            }))
          : [],
      instrumentos:
        formData.instrumentos_ids?.map((id) => ({ id, nome: "", tipo: "" })) ||
        [],
    } as any;
    const { valid, missingFields } = validateTAPFields(projetoParaValidar);
    if (!valid) {
      setTapMissingFields(missingFields);
      setTapValidationDialogOpen(true);
      return;
    }
    setTapMissingFields([]);
    setTapValidationDialogOpen(true);
  };

  // ============================================================
  // RENDER
  // ============================================================
  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          className={cn(
            "max-w-4xl max-h-[80vh] overflow-y-auto",
            mode === "view" &&
              "[&_input:disabled]:bg-gray-50 [&_input:disabled]:text-gray-700 [&_input:disabled]:opacity-100 [&_input:disabled]:cursor-default [&_input:disabled]:border-gray-200 [&_textarea:disabled]:bg-gray-50 [&_textarea:disabled]:text-gray-700 [&_textarea:disabled]:opacity-100 [&_textarea:disabled]:cursor-default [&_textarea:disabled]:border-gray-200 [&_button[role=combobox]:disabled]:bg-gray-50 [&_button[role=combobox]:disabled]:text-gray-700 [&_button[role=combobox]:disabled]:opacity-100 [&_label]:text-gray-500",
          )}
        >
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-3">
              <span>
                {mode === "create"
                  ? "Novo Projeto"
                  : mode === "edit"
                    ? tapEditMode
                      ? "Editar TAP do Projeto"
                      : "Editar Projeto"
                    : "Gerenciamento de TAP"}
              </span>
              {selectedProjeto?.codigo && (
                <span className="text-gray-500 font-mono text-sm">
                  ({selectedProjeto.codigo})
                </span>
              )}
            </DialogTitle>
          </DialogHeader>

          {tapEditMode && mode === "edit" && (
            <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <strong>Modo Permissão TAP:</strong> apenas os 13 campos que
              compõem o TAP serão salvos. Alterações em outros campos serão
              ignoradas.
              {tapEditDiretoria ? (
                <>
                  {" "}
                  Escopo: projetos da diretoria{" "}
                  <strong>{tapEditDiretoria}</strong>.
                </>
              ) : null}
            </div>
          )}

          {/* Banner de TAP recusado — visível enquanto não há nova validação do gestor */}
          {selectedProjeto?.tap_recusado_em &&
            !selectedProjeto?.tap_validado_gestor_em && (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-3">
                <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1 text-sm">
                  <p className="font-semibold text-red-900">
                    TAP recusado pelo{" "}
                    {selectedProjeto.tap_recusado_camada === "patrocinador"
                      ? "Patrocinador"
                      : "Diretor"}
                  </p>
                  <p className="text-red-700 text-xs mt-0.5">
                    {selectedProjeto.tap_recusado_por_nome
                      ? `Por ${selectedProjeto.tap_recusado_por_nome} — `
                      : ""}
                    {new Date(
                      selectedProjeto.tap_recusado_em,
                    ).toLocaleDateString("pt-BR")}
                  </p>
                  {selectedProjeto.tap_recusado_comentario && (
                    <p className="text-red-800 text-sm mt-2 italic">
                      "{selectedProjeto.tap_recusado_comentario}"
                    </p>
                  )}
                  <p className="text-red-600 text-xs mt-2">
                    O gestor deve ajustar o que for necessário e validar
                    novamente para recomeçar o ciclo.
                  </p>
                </div>
              </div>
            )}

          {/* Banner de campos pendentes — só em slim (Gerar TAP) e quando o TAP
              ainda não está vigente. Lista os campos que precisam ser preenchidos
              em "Editar Projeto" antes do TAP poder ser validado. */}
          {slim &&
            selectedProjeto &&
            !selectedProjeto.tap_validado_patrocinador_em &&
            (() => {
              const { valid, missingFields } =
                validateTAPFields(selectedProjeto);
              if (valid) return null;
              return (
                <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="flex-1 text-sm">
                    <p className="font-semibold text-amber-900">
                      Campos pendentes para gerar o TAP
                    </p>
                    <p className="text-amber-700 text-xs mt-1">
                      Os campos abaixo precisam estar preenchidos no projeto
                      para iniciar o ciclo de validação:
                    </p>
                    <ul className="mt-2 space-y-1">
                      {missingFields.map((f, i) => (
                        <li
                          key={i}
                          className="flex items-center gap-2 text-sm text-amber-800"
                        >
                          <XCircle className="h-3.5 w-3.5 text-amber-600 flex-shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <p className="text-amber-700 text-xs mt-3">
                      Use o botão <strong>Editar Projeto</strong> para preencher
                      esses campos.
                    </p>
                  </div>
                </div>
              );
            })()}

          {mode === "view" && selectedProjeto?.tap_validado_patrocinador_em && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-semibold text-emerald-900">TAP Vigente</p>
                <p className="text-emerald-700 text-xs">
                  Validado em{" "}
                  {new Date(
                    selectedProjeto.tap_validado_patrocinador_em,
                  ).toLocaleDateString("pt-BR")}
                  {selectedProjeto.tap_versao
                    ? ` — versão ${selectedProjeto.tap_versao}`
                    : ""}
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500 text-emerald-700 hover:bg-emerald-100"
                onClick={handleAbrirVersoes}
              >
                <History className="h-4 w-4 mr-1" />
                Versões
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="border-emerald-500 text-emerald-700 hover:bg-emerald-100"
                onClick={() =>
                  selectedProjeto && void generateTAPPdf(selectedProjeto)
                }
              >
                <FileText className="h-4 w-4 mr-1" />
                Visualizar PDF
              </Button>
              {onRevisar && (
                <Button
                  size="sm"
                  onClick={onRevisar}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Pencil className="h-4 w-4 mr-1" />
                  Revisar TAP
                </Button>
              )}
            </div>
          )}

          {/* Painel de Validação do TAP — 3 camadas. Escondido quando o TAP já está
              vigente (validação concluída): o banner "TAP Vigente" e o botão "Revisar TAP"
              acima já bastam. */}
          {selectedProjeto &&
            !selectedProjeto.tap_validado_patrocinador_em &&
            (slim ||
              selectedProjeto.tap_validado_gestor_em ||
              mode === "view") && (
              <div className="bg-white border border-gray-200 rounded-lg p-3">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-xs font-semibold text-gray-700">
                    Validação do TAP
                  </h4>
                  {!selectedProjeto.tap_validado_patrocinador_em && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => void generateTAPPdf(selectedProjeto)}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Visualizar TAP
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {/* CAMADA 1 — GESTOR */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border p-2 text-center",
                      selectedProjeto.tap_validado_gestor_em
                        ? "bg-green-50 border-green-200"
                        : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Camada 1 — Gestor
                    </p>
                    <p className="text-xs font-medium truncate">
                      {selectedProjeto.gestor_nome || "-"}
                    </p>
                    {selectedProjeto.tap_validado_gestor_em ? (
                      <div className="mt-1">
                        <Badge className="bg-green-600 text-white text-[10px] h-5">
                          Validado
                        </Badge>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {new Date(
                            selectedProjeto.tap_validado_gestor_em,
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ) : currentUserId &&
                      selectedProjeto.gestor_user_id &&
                      Number(selectedProjeto.gestor_user_id) ===
                        currentUserId ? (
                      <Button
                        size="sm"
                        className="mt-1 bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-6 w-full"
                        disabled={validandoCamadaTAP !== null}
                        onClick={() => handleValidarCamadaTAP(1)}
                      >
                        {validandoCamadaTAP === 1 ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <>
                            <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                          </>
                        )}
                      </Button>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-gray-400 mt-1 h-5"
                      >
                        Pendente
                      </Badge>
                    )}
                  </div>

                  <span className="text-gray-300 text-base">→</span>

                  {/* CAMADA 2 — DIRETOR */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border p-2 text-center",
                      selectedProjeto.tap_validado_diretor_em
                        ? "bg-green-50 border-green-200"
                        : !selectedProjeto.tap_validado_gestor_em
                          ? "bg-gray-100 border-gray-200 opacity-50"
                          : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Camada 2 — Diretor
                    </p>
                    <p className="text-xs font-medium truncate">
                      {selectedProjeto.diretor_nome ||
                        camada2Area?.gestor ||
                        camada2DiretoriaLabel}
                    </p>
                    {selectedProjeto.tap_validado_diretor_em ? (
                      <div className="mt-1">
                        <Badge className="bg-green-600 text-white text-[10px] h-5">
                          Validado
                        </Badge>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {new Date(
                            selectedProjeto.tap_validado_diretor_em,
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ) : selectedProjeto.tap_validado_gestor_em &&
                      currentUserId &&
                      camada2DiretorUserId &&
                      Number(camada2DiretorUserId) === currentUserId ? (
                      <div className="mt-1 space-y-1">
                        <Button
                          size="sm"
                          className="bg-blue-600 hover:bg-blue-700 text-white text-[10px] h-6 w-full"
                          disabled={validandoCamadaTAP !== null}
                          onClick={() => handleValidarCamadaTAP(2)}
                        >
                          {validandoCamadaTAP === 2 ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 w-full border-red-300 text-red-700 hover:bg-red-50"
                          disabled={validandoCamadaTAP !== null}
                          onClick={() => abrirDialogRecusa(2)}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-gray-400 mt-1 h-5"
                      >
                        {selectedProjeto.tap_validado_gestor_em
                          ? "Pendente"
                          : "Bloqueado"}
                      </Badge>
                    )}
                  </div>

                  <span className="text-gray-300 text-base">→</span>

                  {/* CAMADA 3 — PATROCINADOR */}
                  <div
                    className={cn(
                      "flex-1 rounded-lg border p-2 text-center",
                      selectedProjeto.tap_validado_patrocinador_em
                        ? "bg-green-50 border-green-200"
                        : !selectedProjeto.tap_validado_diretor_em
                          ? "bg-gray-100 border-gray-200 opacity-50"
                          : "bg-gray-50 border-gray-200",
                    )}
                  >
                    <p className="text-[10px] text-gray-500 mb-0.5">
                      Camada 3 — Patrocinador
                    </p>
                    <p className="text-xs font-medium truncate">
                      {selectedProjeto.patrocinador_nome || "-"}
                    </p>
                    {selectedProjeto.tap_validado_patrocinador_em ? (
                      <div className="mt-1">
                        <Badge
                          className="bg-green-700 text-white text-[10px] h-5 cursor-pointer"
                          onClick={() => void generateTAPPdf(selectedProjeto)}
                        >
                          TAP Vigente
                        </Badge>
                        <p className="text-[9px] text-gray-400 mt-0.5">
                          {new Date(
                            selectedProjeto.tap_validado_patrocinador_em,
                          ).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                    ) : selectedProjeto.tap_validado_diretor_em &&
                      currentUserId &&
                      selectedProjeto.patrocinador_user_id &&
                      Number(selectedProjeto.patrocinador_user_id) ===
                        currentUserId ? (
                      <div className="mt-1 space-y-1">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 text-white text-[10px] h-6 w-full"
                          disabled={validandoCamadaTAP !== null}
                          onClick={() => handleValidarCamadaTAP(3)}
                        >
                          {validandoCamadaTAP === 3 ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <>
                              <CheckCircle2 className="h-3 w-3 mr-1" /> Validar
                            </>
                          )}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-[10px] h-6 w-full border-red-300 text-red-700 hover:bg-red-50"
                          disabled={validandoCamadaTAP !== null}
                          onClick={() => abrirDialogRecusa(3)}
                        >
                          <XCircle className="h-3 w-3 mr-1" /> Recusar
                        </Button>
                      </div>
                    ) : (
                      <Badge
                        variant="outline"
                        className="text-[10px] text-gray-400 mt-1 h-5"
                      >
                        {selectedProjeto.tap_validado_diretor_em
                          ? "Pendente"
                          : "Bloqueado"}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            )}

          {/* Aviso para nova versão do TAP — só em slim quando o TAP está vigente. */}
          {slim && selectedProjeto?.tap_validado_patrocinador_em && (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-blue-900">
                Para gerar uma <strong>nova versão</strong> do TAP, altere as
                informações do projeto pelo botão <strong>Revisar TAP</strong>.
                As mudanças vão reiniciar o ciclo de validação (gestor → diretor
                → patrocinador).
              </p>
            </div>
          )}

          {!slim && (
            <>
              <div className="space-y-4">
                <Accordion
                  type="multiple"
                  defaultValue={[
                    "identificacao",
                    "governanca",
                    "escopo",
                    "temporalidade",
                    "classificacao",
                    "execucao",
                    "entregas",
                    "formalizacao",
                  ]}
                  className="w-full"
                >
                  {/* IDENTIFICAÇÃO */}
                  <AccordionItem value="identificacao">
                    <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                      <div className="flex items-center gap-2">
                        <FolderKanban className="h-4 w-4" />
                        Identificação do Projeto
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label
                            className={
                              isTapFieldMissing("nome") ? "text-red-600" : ""
                            }
                          >
                            Nome do Projeto *
                          </Label>
                          <Input
                            value={formData.nome}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                nome: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter((f) => tapFieldMap[f] !== "nome"),
                              );
                            }}
                            disabled={camposRestritos}
                            placeholder="Digite o nome do projeto"
                            className={
                              isTapFieldMissing("nome") ? "border-red-500" : ""
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Descrição Sintética</Label>
                          <Textarea
                            value={formData.descricao_sintetica}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                descricao_sintetica: e.target.value,
                              })
                            }
                            disabled={mode === "view"}
                            placeholder="Breve descrição do projeto"
                            rows={3}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label
                            className={
                              isTapFieldMissing("objetivo")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Objetivo
                          </Label>
                          <Textarea
                            value={formData.objetivo || ""}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                objetivo: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) => tapFieldMap[f] !== "objetivo",
                                ),
                              );
                            }}
                            disabled={mode === "view"}
                            placeholder="Descreva o objetivo do projeto"
                            rows={3}
                            className={
                              isTapFieldMissing("objetivo")
                                ? "border-red-500"
                                : ""
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label
                            className={
                              isTapFieldMissing("contexto_justificativa")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Contexto e Justificativa
                          </Label>
                          <Textarea
                            value={formData.contexto_justificativa || ""}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                contexto_justificativa: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) =>
                                    tapFieldMap[f] !== "contexto_justificativa",
                                ),
                              );
                            }}
                            disabled={mode === "view"}
                            placeholder="Descreva o contexto e justificativa do projeto"
                            rows={3}
                            className={
                              isTapFieldMissing("contexto_justificativa")
                                ? "border-red-500"
                                : ""
                            }
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* GOVERNANÇA */}
                  <AccordionItem value="governanca">
                    <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        Governança e Responsáveis
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="relative">
                          <Label
                            className={
                              isTapFieldMissing("patrocinador_id")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Patrocinador (Sponsor)
                          </Label>
                          <Input
                            placeholder="Digite para buscar..."
                            value={buscaPatrocinador}
                            onChange={(e) => {
                              setBuscaPatrocinador(e.target.value);
                              setShowPatrocinadorList(true);
                              if (!e.target.value)
                                setFormData({
                                  ...formData,
                                  patrocinador_id: undefined,
                                });
                            }}
                            onFocus={() => setShowPatrocinadorList(true)}
                            onBlur={() =>
                              setTimeout(
                                () => setShowPatrocinadorList(false),
                                200,
                              )
                            }
                            disabled={camposRestritos}
                            className={
                              isTapFieldMissing("patrocinador_id")
                                ? "border-red-500"
                                : ""
                            }
                          />
                          {showPatrocinadorList &&
                            buscaPatrocinador.length > 0 && (
                              <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                                {filteredColaboradores
                                  .filter((c) =>
                                    c.nome
                                      .toLowerCase()
                                      .includes(
                                        buscaPatrocinador.toLowerCase(),
                                      ),
                                  )
                                  .map((c) => (
                                    <div
                                      key={c.id}
                                      className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                                      onMouseDown={() => {
                                        setFormData({
                                          ...formData,
                                          patrocinador_id: c.id,
                                        });
                                        setBuscaPatrocinador(c.nome);
                                        setShowPatrocinadorList(false);
                                      }}
                                    >
                                      {c.nome}
                                    </div>
                                  ))}
                                {filteredColaboradores.filter((c) =>
                                  c.nome
                                    .toLowerCase()
                                    .includes(buscaPatrocinador.toLowerCase()),
                                ).length === 0 && (
                                  <div className="px-3 py-2 text-sm text-gray-500">
                                    Nenhum resultado
                                  </div>
                                )}
                              </div>
                            )}
                          <Input
                            placeholder="Digite o cargo"
                            value={formData.patrocinador_cargo || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                patrocinador_cargo: e.target.value,
                              })
                            }
                            disabled={camposRestritos}
                            className="mt-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Cargo (substitui o nome do responsável no TAP)
                          </p>
                        </div>
                        <div className="relative">
                          <Label
                            className={
                              isTapFieldMissing("gestor_id")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Gestor
                          </Label>
                          <Input
                            placeholder="Digite para buscar..."
                            value={buscaGestor}
                            onChange={(e) => {
                              setBuscaGestor(e.target.value);
                              setShowGestorList(true);
                              if (!e.target.value)
                                setFormData({
                                  ...formData,
                                  gestor_id: undefined,
                                });
                            }}
                            onFocus={() => setShowGestorList(true)}
                            onBlur={() =>
                              setTimeout(() => setShowGestorList(false), 200)
                            }
                            disabled={camposRestritos}
                            className={
                              isTapFieldMissing("gestor_id")
                                ? "border-red-500"
                                : ""
                            }
                          />
                          {showGestorList && buscaGestor.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border rounded-md shadow-lg max-h-48 overflow-y-auto">
                              {filteredColaboradores
                                .filter((c) =>
                                  c.nome
                                    .toLowerCase()
                                    .includes(buscaGestor.toLowerCase()),
                                )
                                .map((c) => (
                                  <div
                                    key={c.id}
                                    className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                                    onMouseDown={() => {
                                      setFormData({
                                        ...formData,
                                        gestor_id: c.id,
                                      });
                                      setBuscaGestor(c.nome);
                                      setShowGestorList(false);
                                    }}
                                  >
                                    {c.nome}
                                  </div>
                                ))}
                              {filteredColaboradores.filter((c) =>
                                c.nome
                                  .toLowerCase()
                                  .includes(buscaGestor.toLowerCase()),
                              ).length === 0 && (
                                <div className="px-3 py-2 text-sm text-gray-500">
                                  Nenhum resultado
                                </div>
                              )}
                            </div>
                          )}
                          <Input
                            placeholder="Digite o cargo"
                            value={formData.gestor_cargo || ""}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                gestor_cargo: e.target.value,
                              })
                            }
                            disabled={camposRestritos}
                            className="mt-2"
                          />
                          <p className="text-xs text-gray-500 mt-1">
                            Cargo (substitui o nome do responsável no TAP)
                          </p>
                        </div>

                        <div className="md:col-span-2">
                          <Label className="text-blue-700 font-semibold mb-2 block">
                            Diretoria
                          </Label>
                          {formData.areas_vinculadas_ids &&
                            formData.areas_vinculadas_ids.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {formData.areas_vinculadas_ids.map((id) => {
                                  const dir = diretorias.find(
                                    (d) => d.id === id,
                                  );
                                  if (!dir) return null;
                                  return (
                                    <Badge
                                      key={id}
                                      variant="secondary"
                                      className="bg-blue-100 text-blue-800 px-3 py-1.5 text-sm gap-2"
                                    >
                                      {dir.sigla} - {dir.nome}
                                      {!camposRestritos && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleRemoverDiretoria(id)
                                          }
                                          className="ml-1 hover:text-red-600 transition-colors"
                                        >
                                          <XCircle className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          {!camposRestritos && (
                            <Select
                              value=""
                              onValueChange={handleAdicionarDiretoria}
                            >
                              <SelectTrigger className="w-full bg-white border-gray-300 border-dashed">
                                <div className="flex items-center gap-2 text-gray-500">
                                  <Plus className="h-4 w-4" />
                                  <span>
                                    {formData.areas_vinculadas_ids?.length
                                      ? "Trocar diretoria"
                                      : "Selecione a diretoria do projeto"}
                                  </span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {diretorias
                                  .filter(
                                    (dir) =>
                                      !formData.areas_vinculadas_ids?.includes(
                                        dir.id,
                                      ),
                                  )
                                  .map((dir) => (
                                    <SelectItem
                                      key={dir.id}
                                      value={dir.id.toString()}
                                    >
                                      {dir.sigla} - {dir.nome}
                                    </SelectItem>
                                  ))}
                                {diretorias.filter(
                                  (dir) =>
                                    !formData.areas_vinculadas_ids?.includes(
                                      dir.id,
                                    ),
                                ).length === 0 && (
                                  <SelectItem value="none" disabled>
                                    Nenhuma outra diretoria disponível
                                  </SelectItem>
                                )}
                              </SelectContent>
                            </Select>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Selecione a diretoria do projeto (apenas uma)
                          </p>
                        </div>

                        {formData.areas_vinculadas_ids &&
                          formData.areas_vinculadas_ids.length > 0 && (
                            <div className="md:col-span-2 animate-in fade-in slide-in-from-top-2 duration-300">
                              <Label className="text-blue-700 font-semibold mb-2 block">
                                Área Responsável
                              </Label>
                              {formData.areas_execucao &&
                                formData.areas_execucao.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 mb-2">
                                    {formData.areas_execucao.map((id) => {
                                      const unidade = unidadesDiretorias.find(
                                        (u) => u.id === id,
                                      );
                                      if (!unidade) return null;
                                      return (
                                        <Badge
                                          key={id}
                                          variant="secondary"
                                          className="bg-blue-100 text-blue-800 px-2 py-1 text-xs gap-1.5"
                                        >
                                          {unidade.nome}
                                          <span className="text-[9px] text-blue-500">
                                            ({unidade.diretoria_sigla})
                                          </span>
                                          {!camposRestritos && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                toggleAreaExecucao(id)
                                              }
                                              className="hover:text-red-600"
                                            >
                                              <XCircle className="h-3 w-3" />
                                            </button>
                                          )}
                                        </Badge>
                                      );
                                    })}
                                  </div>
                                )}
                              {!camposRestritos &&
                                unidadesDiretorias.length > 0 && (
                                  <Select
                                    value=""
                                    onValueChange={(value) => {
                                      const id = parseInt(value);
                                      if (id) toggleAreaExecucao(id);
                                    }}
                                  >
                                    <SelectTrigger className="w-full bg-white border-gray-300">
                                      <span className="text-gray-500 text-sm">
                                        {formData.areas_execucao?.length
                                          ? "Trocar área responsável..."
                                          : "Selecionar área responsável..."}
                                      </span>
                                    </SelectTrigger>
                                    <SelectContent className="max-h-60">
                                      {unidadesDiretorias.map((unidade) => (
                                        <SelectItem
                                          key={unidade.id}
                                          value={unidade.id.toString()}
                                        >
                                          <div className="flex items-center gap-2">
                                            {formData.areas_execucao?.includes(
                                              unidade.id,
                                            ) && (
                                              <CheckCircle2 className="h-3.5 w-3.5 text-blue-600 flex-shrink-0" />
                                            )}
                                            <span>{unidade.nome}</span>
                                            <span className="text-[10px] text-gray-400 uppercase">
                                              ({unidade.diretoria_sigla})
                                            </span>
                                          </div>
                                        </SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                )}
                              {unidadesDiretorias.length === 0 && (
                                <p className="text-gray-500 text-sm italic py-2">
                                  Nenhuma unidade cadastrada nas diretorias
                                  selecionadas.
                                </p>
                              )}
                              {mode === "view" &&
                                (!formData.areas_execucao ||
                                  formData.areas_execucao.length === 0) && (
                                  <p className="text-gray-500 text-sm italic py-2">
                                    Nenhuma área responsável selecionada.
                                  </p>
                                )}
                            </div>
                          )}

                        <div className="md:col-span-2">
                          <Label
                            className={
                              isTapFieldMissing("instrumentos")
                                ? "text-red-600 font-semibold mb-2 block"
                                : "text-blue-700 font-semibold mb-2 block"
                            }
                          >
                            Ancoragem Estratégica (Planos/Programas)
                          </Label>
                          {/* Itens selecionados como badges removíveis */}
                          {formData.instrumentos_ids &&
                            formData.instrumentos_ids.length > 0 && (
                              <div className="flex flex-wrap gap-2 mb-2">
                                {formData.instrumentos_ids.map((id) => {
                                  const inst = instrumentos.find(
                                    (i) => i.id === id,
                                  );
                                  if (!inst) return null;
                                  return (
                                    <Badge
                                      key={id}
                                      variant="secondary"
                                      className="bg-blue-100 text-blue-800 px-3 py-1.5 text-sm gap-2"
                                    >
                                      {inst.nome}
                                      <span className="text-[10px] text-blue-500 uppercase">
                                        ({inst.tipo})
                                      </span>
                                      {!camposRestritos && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setFormData({
                                              ...formData,
                                              instrumentos_ids: (
                                                formData.instrumentos_ids || []
                                              ).filter((x) => x !== id),
                                            })
                                          }
                                          className="ml-1 hover:text-red-600 transition-colors"
                                        >
                                          <XCircle className="h-3.5 w-3.5" />
                                        </button>
                                      )}
                                    </Badge>
                                  );
                                })}
                              </div>
                            )}
                          {/* Botão adicionar — Select que mostra apenas os ainda não selecionados */}
                          {!camposRestritos && (
                            <Select
                              value=""
                              onValueChange={(value) => {
                                const id = parseInt(value);
                                if (
                                  !id ||
                                  formData.instrumentos_ids?.includes(id)
                                )
                                  return;
                                setFormData({
                                  ...formData,
                                  instrumentos_ids: [
                                    ...(formData.instrumentos_ids || []),
                                    id,
                                  ],
                                });
                                setTapMissingFields((prev) =>
                                  prev.filter(
                                    (f) => tapFieldMap[f] !== "instrumentos",
                                  ),
                                );
                              }}
                            >
                              <SelectTrigger
                                className={cn(
                                  "w-full bg-white border-gray-300 border-dashed",
                                  isTapFieldMissing("instrumentos")
                                    ? "border-red-500"
                                    : "",
                                )}
                              >
                                <div className="flex items-center gap-2 text-gray-500">
                                  <Plus className="h-4 w-4" />
                                  <span>
                                    {formData.instrumentos_ids?.length
                                      ? "Adicionar outro plano/programa"
                                      : "Selecione um ou mais planos/programas"}
                                  </span>
                                </div>
                              </SelectTrigger>
                              <SelectContent>
                                {instrumentos
                                  .filter(
                                    (i) =>
                                      !formData.instrumentos_ids?.includes(
                                        i.id,
                                      ),
                                  )
                                  .map((i) => (
                                    <SelectItem
                                      key={i.id}
                                      value={i.id.toString()}
                                    >
                                      <div className="flex items-center gap-2">
                                        <span>{i.nome}</span>
                                        <span className="text-[10px] text-gray-400 uppercase">
                                          ({i.tipo})
                                        </span>
                                      </div>
                                    </SelectItem>
                                  ))}
                                {instrumentos.length === 0 && (
                                  <SelectItem value="none" disabled>
                                    Nenhum plano/programa cadastrado
                                  </SelectItem>
                                )}
                                {instrumentos.length > 0 &&
                                  instrumentos.filter(
                                    (i) =>
                                      !formData.instrumentos_ids?.includes(
                                        i.id,
                                      ),
                                  ).length === 0 && (
                                    <SelectItem value="none" disabled>
                                      Todos os planos/programas já foram
                                      adicionados
                                    </SelectItem>
                                  )}
                              </SelectContent>
                            </Select>
                          )}
                          <p className="text-xs text-gray-500 mt-1">
                            Selecione um ou mais planos/programas para ancoragem
                            estratégica
                          </p>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ESCOPO */}
                  <AccordionItem value="escopo">
                    <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Escopo
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="space-y-4">
                        <div>
                          <Label
                            className={
                              isTapFieldMissing("escopo_sintetico")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Escopo
                          </Label>
                          <Textarea
                            value={formData.escopo_sintetico}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                escopo_sintetico: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) => tapFieldMap[f] !== "escopo_sintetico",
                                ),
                              );
                            }}
                            disabled={mode === "view"}
                            placeholder="Descreva o que está incluído no escopo do projeto"
                            rows={4}
                            className={
                              isTapFieldMissing("escopo_sintetico")
                                ? "border-red-500"
                                : ""
                            }
                          />
                        </div>
                        <div>
                          <Label
                            className={
                              isTapFieldMissing("fora_do_escopo")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Fora do Escopo
                          </Label>
                          <Textarea
                            value={formData.fora_do_escopo}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                fora_do_escopo: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) => tapFieldMap[f] !== "fora_do_escopo",
                                ),
                              );
                            }}
                            disabled={mode === "view"}
                            placeholder="Descreva o que NÃO está incluído no escopo do projeto"
                            rows={4}
                            className={
                              isTapFieldMissing("fora_do_escopo")
                                ? "border-red-500"
                                : ""
                            }
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* TEMPORALIDADE */}
                  <AccordionItem value="temporalidade">
                    <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Temporalidade e Situação
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <Label
                            className={
                              isTapFieldMissing("data_prevista_inicio")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Data Prevista de Início
                          </Label>
                          <Input
                            type="date"
                            value={formData.data_prevista_inicio}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                data_prevista_inicio: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) =>
                                    tapFieldMap[f] !== "data_prevista_inicio",
                                ),
                              );
                            }}
                            disabled={mode === "view"}
                            className={
                              isTapFieldMissing("data_prevista_inicio")
                                ? "border-red-500"
                                : ""
                            }
                          />
                        </div>
                        <div>
                          <Label
                            className={
                              isTapFieldMissing("data_prevista_conclusao")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Data Prevista de Conclusão
                          </Label>
                          <Input
                            type="date"
                            value={formData.data_prevista_conclusao}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                data_prevista_conclusao: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) =>
                                    tapFieldMap[f] !==
                                    "data_prevista_conclusao",
                                ),
                              );
                            }}
                            disabled={mode === "view"}
                            className={
                              isTapFieldMissing("data_prevista_conclusao")
                                ? "border-red-500"
                                : ""
                            }
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* CLASSIFICAÇÃO */}
                  <AccordionItem value="classificacao">
                    <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                      <div className="flex items-center gap-2">
                        <Target className="h-4 w-4" />
                        Contratação
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="col-span-1 md:col-span-2 lg:col-span-4">
                          <Label>Haverá Contratação?</Label>
                          <div className="flex items-center gap-4 mt-2">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <Checkbox
                                checked={formData.havera_contratacao || false}
                                onCheckedChange={(checked) =>
                                  setFormData({
                                    ...formData,
                                    havera_contratacao: !!checked,
                                    // Ao desmarcar, limpa o item do PCA vinculado.
                                    ...(checked ? {} : { pcas_id: undefined }),
                                  })
                                }
                                disabled={mode === "view"}
                              />
                              <span>Sim</span>
                            </label>
                            {formData.havera_contratacao &&
                              (() => {
                                const pcaSelecionado = pcaItens.find(
                                  (p) => p.id === formData.pcas_id,
                                );
                                const pcaLabel = pcaSelecionado
                                  ? labelPcaItem(pcaSelecionado)
                                  : selectedProjeto?.pca_item_label ||
                                    (formData.pcas_id
                                      ? `Item PCA #${formData.pcas_id}`
                                      : "");
                                const q = buscaPca.trim().toLowerCase();
                                const pcaFiltrados = pcaItens
                                  .filter((item) => {
                                    if (!q) return true;
                                    return labelPcaItem(item)
                                      .toLowerCase()
                                      .includes(q);
                                  })
                                  .slice(0, 50);
                                return (
                                  <div className="relative flex-1 min-w-[220px]">
                                    {formData.pcas_id ? (
                                      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-sm">
                                        <Info className="h-4 w-4 flex-shrink-0 text-blue-600" />
                                        <span
                                          className="flex-1 truncate text-blue-900"
                                          title={pcaLabel}
                                        >
                                          {pcaLabel}
                                        </span>
                                        {mode !== "view" && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              setFormData({
                                                ...formData,
                                                pcas_id: undefined,
                                              })
                                            }
                                            className="text-blue-500 hover:text-red-600 transition-colors"
                                            title="Remover item do PCA"
                                          >
                                            <XCircle className="h-4 w-4" />
                                          </button>
                                        )}
                                      </div>
                                    ) : mode === "view" ? (
                                      <span className="text-sm text-gray-400">
                                        Nenhum item do PCA selecionado
                                      </span>
                                    ) : (
                                      // Popover (portal) em vez de um <div absolute>: o
                                      // AccordionContent tem overflow-hidden e o corpo do
                                      // Dialog rola, então a lista ancorada ficava recortada
                                      // e atrás do conteúdo. O portal escapa desses clips.
                                      <Popover
                                        open={showPcaList}
                                        onOpenChange={setShowPcaList}
                                      >
                                        <PopoverAnchor asChild>
                                          <Input
                                            className="pca-picker-input-inline"
                                            placeholder="Adicionar o item do PCA..."
                                            value={buscaPca}
                                            onChange={(e) => {
                                              setBuscaPca(e.target.value);
                                              setShowPcaList(true);
                                            }}
                                            onFocus={() => setShowPcaList(true)}
                                          />
                                        </PopoverAnchor>
                                        <PopoverContent
                                          align="start"
                                          sideOffset={4}
                                          className="w-[var(--radix-popover-trigger-width)] max-w-[80vw] max-h-60 overflow-y-auto p-0 z-[80]"
                                          onInteractOutside={(e) => {
                                            const target = e.target as Element;
                                            if (
                                              target &&
                                              target.closest(
                                                ".pca-picker-input-inline",
                                              )
                                            ) {
                                              e.preventDefault();
                                            }
                                          }}
                                          // Mantém o cursor no input enquanto a lista está aberta.
                                          onOpenAutoFocus={(e) =>
                                            e.preventDefault()
                                          }
                                          onCloseAutoFocus={(e) =>
                                            e.preventDefault()
                                          }
                                        >
                                          {pcaItens.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-gray-500">
                                              Nenhum item do PCA cadastrado.
                                            </div>
                                          ) : pcaFiltrados.length === 0 ? (
                                            <div className="px-3 py-2 text-sm text-gray-500">
                                              Nenhum item encontrado.
                                            </div>
                                          ) : (
                                            pcaFiltrados.map((item) => (
                                              <div
                                                key={item.id}
                                                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                                                onMouseDown={() => {
                                                  setFormData({
                                                    ...formData,
                                                    pcas_id: item.id,
                                                  });
                                                  setBuscaPca("");
                                                  setShowPcaList(false);
                                                }}
                                              >
                                                {labelPcaItem(item)}
                                              </div>
                                            ))
                                          )}
                                        </PopoverContent>
                                      </Popover>
                                    )}
                                  </div>
                                );
                              })()}
                          </div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* EXECUÇÃO */}
                  <AccordionItem value="execucao">
                    <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        Execução e Monitoramento
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label>Saúde do Projeto</Label>
                          <Select
                            value={formData.saude}
                            onValueChange={(v) =>
                              setFormData({ ...formData, saude: v })
                            }
                            disabled={camposRestritos}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="verde">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-green-500" />
                                  Saudável (Verde)
                                </div>
                              </SelectItem>
                              <SelectItem value="amarelo">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-yellow-500" />
                                  Atenção (Amarelo)
                                </div>
                              </SelectItem>
                              <SelectItem value="vermelho">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-red-500" />
                                  Crítico (Vermelho)
                                </div>
                              </SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Justificativa da Saúde</Label>
                          <Textarea
                            value={formData.saude_justificativa}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                saude_justificativa: e.target.value,
                              })
                            }
                            disabled={camposRestritos}
                            placeholder="Justifique o status de saúde do projeto"
                            rows={2}
                          />
                        </div>
                        {selectedProjeto && (
                          <div className="md:col-span-2">
                            <Label>
                              Progresso ({selectedProjeto.progresso_percentual}
                              %)
                            </Label>
                            <Progress
                              value={selectedProjeto.progresso_percentual}
                              className="mt-2"
                            />
                            <p className="text-sm text-gray-500 mt-1">
                              {selectedProjeto.entregas_concluidas || 0} de{" "}
                              {selectedProjeto.total_entregas || 0} entregas
                              concluídas
                            </p>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* ENTREGAS */}
                  <AccordionItem value="entregas">
                    <AccordionTrigger
                      className={`px-4 rounded-t ${isTapFieldMissing("entregas") ? "bg-red-50" : "bg-amber-50"}`}
                    >
                      <div
                        className={`flex items-center gap-2 ${isTapFieldMissing("entregas") ? "text-red-600" : ""}`}
                      >
                        <Package className="h-4 w-4" />
                        Entregas Previstas{" "}
                        {isTapFieldMissing("entregas") && (
                          <span className="text-xs">
                            (obrigatório para TAP)
                          </span>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="space-y-3">
                        {tempEntregas.length === 0 ? (
                          <p className="text-sm text-gray-500 italic p-3 bg-gray-50 rounded">
                            Nenhuma entrega cadastrada.{" "}
                            {mode !== "view" &&
                              "Adicione usando o formulário abaixo."}
                          </p>
                        ) : (
                          <div className="text-sm text-green-600 mb-2">
                            {tempEntregas.length} entrega(s) cadastrada(s)
                          </div>
                        )}
                        {tempEntregas.map((entrega, idx) => {
                          const areaResp = areas.find(
                            (a) => a.id === entrega.area_responsavel_id,
                          );
                          const editingThis = editingEntregaIdx === idx;
                          if (editingThis && mode !== "view") {
                            return (
                              <div
                                key={idx}
                                className="p-3 border-2 border-blue-300 rounded-lg bg-blue-50 space-y-2"
                              >
                                <div className="flex gap-2 items-center flex-wrap">
                                  <Input
                                    placeholder="Nome da entrega"
                                    value={editEntregaDraft.nome}
                                    onChange={(e) =>
                                      setEditEntregaDraft({
                                        ...editEntregaDraft,
                                        nome: e.target.value,
                                      })
                                    }
                                    className="flex-1 bg-white min-w-[200px]"
                                  />
                                  <Input
                                    type="date"
                                    value={
                                      editEntregaDraft.prazo_estimado || ""
                                    }
                                    onChange={(e) =>
                                      setEditEntregaDraft({
                                        ...editEntregaDraft,
                                        prazo_estimado: e.target.value,
                                      })
                                    }
                                    className="w-[160px] bg-white"
                                    title="Prazo Estimado"
                                  />
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => {
                                      setEditingEntregaIdx(null);
                                    }}
                                  >
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      if (!editEntregaDraft.nome.trim()) {
                                        toast({
                                          title: "Atenção",
                                          description:
                                            "Digite o nome da entrega",
                                          variant: "destructive",
                                        });
                                        return;
                                      }
                                      setTempEntregas((prev) =>
                                        prev.map((e, i) =>
                                          i === idx
                                            ? {
                                                ...e,
                                                nome: editEntregaDraft.nome.trim(),
                                                area_responsavel_id:
                                                  editEntregaDraft.area_responsavel_id,
                                                prazo_estimado:
                                                  editEntregaDraft.prazo_estimado ||
                                                  null,
                                              }
                                            : e,
                                        ),
                                      );
                                      setEditingEntregaIdx(null);
                                    }}
                                    className="bg-blue-600 hover:bg-blue-700"
                                  >
                                    <Check className="h-4 w-4 mr-1" /> Salvar
                                  </Button>
                                </div>
                              </div>
                            );
                          }
                          return (
                            <div
                              key={idx}
                              className="p-3 bg-gray-50 rounded-lg border"
                            >
                              <div className="flex items-center gap-2">
                                <span className="flex-1 font-medium">
                                  {entrega.nome}
                                </span>
                                {areaResp && (
                                  <Badge variant="outline">
                                    {areaResp.diretoria} - {areaResp.nome_area}
                                  </Badge>
                                )}
                                {entrega.prazo_estimado && (
                                  <Badge variant="outline" className="text-xs">
                                    Prazo:{" "}
                                    {formatDatePtBr(entrega.prazo_estimado)}
                                  </Badge>
                                )}
                                {mode !== "view" && (
                                  <>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                      onClick={() => {
                                        setEditingEntregaIdx(idx);
                                        setEditEntregaDraft({
                                          nome: entrega.nome,
                                          area_responsavel_id:
                                            entrega.area_responsavel_id ?? null,
                                          prazo_estimado: entrega.prazo_estimado
                                            ? String(
                                                entrega.prazo_estimado,
                                              ).slice(0, 10)
                                            : "",
                                        });
                                      }}
                                      title="Editar entrega"
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() =>
                                        setTempEntregas(
                                          tempEntregas.filter(
                                            (_, i) => i !== idx,
                                          ),
                                        )
                                      }
                                      title="Remover entrega"
                                    >
                                      <XCircle className="h-4 w-4 text-red-500" />
                                    </Button>
                                  </>
                                )}
                              </div>
                            </div>
                          );
                        })}

                        {mode !== "view" && (
                          <div className="p-3 border-2 border-dashed rounded-lg bg-blue-50 space-y-2">
                            <div className="flex gap-2 items-center flex-wrap">
                              <Input
                                placeholder="Nome da entrega"
                                value={novaEntrega.nome}
                                onChange={(e) =>
                                  setNovaEntrega({
                                    ...novaEntrega,
                                    nome: e.target.value,
                                  })
                                }
                                className="flex-1 bg-white min-w-[200px]"
                              />
                              <Input
                                type="date"
                                value={novaEntrega.prazo_estimado}
                                onChange={(e) =>
                                  setNovaEntrega({
                                    ...novaEntrega,
                                    prazo_estimado: e.target.value,
                                  })
                                }
                                className="w-[160px] bg-white"
                                title="Prazo Estimado"
                              />
                            </div>
                            <div className="flex justify-end">
                              <Button
                                onClick={handleAddEntrega}
                                variant="outline"
                                className="bg-white"
                              >
                                <Plus className="h-4 w-4 mr-1" /> Adicionar
                                Entrega
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>

                  {/* FORMALIZAÇÃO */}
                  <AccordionItem value="formalizacao">
                    <AccordionTrigger className="bg-amber-50 px-4 rounded-t">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        Formalização
                      </div>
                    </AccordionTrigger>
                    <AccordionContent className="p-4 border border-t-0 rounded-b">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <Label
                            className={
                              isTapFieldMissing("tap_vinculado")
                                ? "text-red-600"
                                : ""
                            }
                          >
                            Nº do Proad
                          </Label>
                          <Input
                            value={formData.tap_vinculado}
                            onChange={(e) => {
                              setFormData({
                                ...formData,
                                tap_vinculado: e.target.value,
                              });
                              setTapMissingFields((prev) =>
                                prev.filter(
                                  (f) => tapFieldMap[f] !== "tap_vinculado",
                                ),
                              );
                            }}
                            disabled={mode === "view"}
                            placeholder="Número do Proad"
                            className={
                              isTapFieldMissing("tap_vinculado")
                                ? "border-red-500"
                                : ""
                            }
                          />
                        </div>
                        <div className="md:col-span-2">
                          <Label>Observações Gerais</Label>
                          <Textarea
                            value={formData.observacoes_gerais}
                            onChange={(e) =>
                              setFormData({
                                ...formData,
                                observacoes_gerais: e.target.value,
                              })
                            }
                            disabled={mode === "view"}
                            placeholder="Observações adicionais sobre o projeto"
                            rows={3}
                          />
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                </Accordion>
              </div>
            </>
          )}

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fechar
            </Button>
            {!slim && mode === "view" && selectedProjeto && (
              <Button
                onClick={() => onModeChange("edit")}
                className="bg-blue-500 hover:bg-blue-600"
              >
                <Edit className="mr-2 h-4 w-4" />
                Editar
              </Button>
            )}
            {!slim && mode !== "view" && (
              <>
                <Button
                  onClick={handleSave}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {mode === "create" ? "Criar Projeto" : "Salvar Alterações"}
                </Button>
                {/* Proposta TAP: indica os campos faltantes para o ciclo de geração do TAP.
                    Só aparece quando o TAP ainda não está vigente — após validado,
                    não há mais campos para checar. */}
                {!selectedProjeto?.tap_validado_patrocinador_em && (
                  <Button
                    onClick={handlePropostaTAP}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    Proposta TAP
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de versões do TAP */}
      <Dialog
        open={versoesDialogOpen}
        onOpenChange={(o) => {
          if (!o) setVersoesDialogOpen(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-blue-500" />
              Versões do TAP
            </DialogTitle>
          </DialogHeader>
          {loadingVersoes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : versoes.length === 0 ? (
            <p className="text-center text-gray-400 py-6 text-sm">
              Nenhuma versão encontrada.
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {versoes.map((v) => (
                <div
                  key={v.versao}
                  className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3"
                >
                  <div>
                    <span className="font-semibold text-emerald-700 font-mono">
                      v{v.versao}
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {v.validado_em
                        ? `Validado em ${new Date(v.validado_em).toLocaleDateString("pt-BR")}`
                        : "—"}
                      {v.validado_por_nome ? ` por ${v.validado_por_nome}` : ""}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handlePdfVersao(v.versao)}
                    disabled={loadingPdfVersao === v.versao}
                    className="gap-1.5"
                  >
                    {loadingPdfVersao === v.versao ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <FileDown className="h-4 w-4" />
                    )}
                    PDF
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Dialog de recusa do TAP */}
      <Dialog
        open={recusaDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRecusaDialogOpen(false);
            setRecusaCamada(null);
            setRecusaComentario("");
          }
        }}
      >
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-600" />
              Recusar TAP
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-gray-600">
              O TAP voltará para o gestor reiniciar o ciclo de validação. Todas
              as validações anteriores serão resetadas. Você pode incluir um
              comentário (opcional) para indicar o que precisa ser ajustado.
            </p>
            <div>
              <Label htmlFor="recusa-tap-comentario">
                Comentário (opcional)
              </Label>
              <Textarea
                id="recusa-tap-comentario"
                value={recusaComentario}
                onChange={(e) => setRecusaComentario(e.target.value)}
                placeholder="Ex: revisar escopo, ajustar entregas, etc."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRecusaDialogOpen(false)}
              disabled={recusandoTAP}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleRecusarTAP}
              disabled={recusandoTAP}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {recusandoTAP ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <XCircle className="h-4 w-4 mr-2" />
              )}
              Recusar TAP
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TAP validation dialog */}
      <Dialog
        open={tapValidationDialogOpen}
        onOpenChange={setTapValidationDialogOpen}
      >
        <DialogContent className="max-w-md">
          {tapMissingFields.length > 0 ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-red-600">
                  <AlertCircle className="h-5 w-5" />
                  Campos obrigatórios para emissão do TAP
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Os seguintes campos precisam ser preenchidos para gerar a
                  Proposta TAP:
                </p>
                <ul className="space-y-1.5">
                  {tapMissingFields.map((field, idx) => (
                    <li key={idx} className="flex items-center gap-2 text-sm">
                      <XCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                      <span className="text-gray-800">{field}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <DialogFooter>
                <Button onClick={() => setTapValidationDialogOpen(false)}>
                  Entendi
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-green-600">
                  <CheckCircle2 className="h-5 w-5" />
                  Proposta TAP pronta
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">
                  Todos os requisitos para a geração do TAP já estão
                  preenchidos. Salve o projeto para que o TAP entre no fluxo de
                  validação em 3 camadas.
                </p>
              </div>
              <DialogFooter>
                <Button onClick={() => setTapValidationDialogOpen(false)}>
                  OK
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
