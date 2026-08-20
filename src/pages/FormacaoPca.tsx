import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Plus, ExternalLink, CheckCheck, Pencil, Trash2, Link as LinkIcon, AlertTriangle, Check, X, Info, FileText, Upload, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CicloTimeline } from "@/components/contratacoes/ciclo/CicloTimeline";
import type { CicloTimelinePerna } from "@/components/contratacoes/ciclo/CicloTimeline";
import { NOS_FORMACAO_DEFAULT } from "@/components/contratacoes/ciclo/cicloConstants";
import { carregarFasesFormacaoTimeline } from "@/services/parametrosCicloApi";
import { cicloOrcamentarioApi, type Ciclo } from "@/services/cicloOrcamentarioApi";
import { contractsApi } from "@/services/contractsApi";
import { ifoApi, type Ifo } from "@/services/dfdApi";
import { Contract } from "@/types";
import { formatCurrency } from "@/services/pcaApi";
import { getApiBaseUrl } from "@/services/apiClient";
import { getAreaLabel } from "@/utils/formatters";
import { DialogNovoIfo } from "@/components/ciclo/DialogNovoIfo";
import { DialogEditarIfo } from "@/components/ciclo/DialogEditarIfo";
import { DialogVincularContratos } from "@/components/ciclo/DialogVincularContratos";
import { DialogCriarIfoViaContrato } from "@/components/ciclo/DialogCriarIfoViaContrato";
import { DialogImportarPca } from "@/components/ciclo/DialogImportarPca";
import { DialogEditarValorContratoIfo } from "@/components/ciclo/DialogEditarValorContratoIfo";
import { DialogMotivoNaoRenovacao } from "@/components/ciclo/DialogMotivoNaoRenovacao";
import { FaseBanner } from "@/components/ciclo/FaseBanner";
import { CampoLinkProad } from "@/components/ciclo/CampoLinkProad";
import { AtasComitesPanel } from "@/components/contratacoes/ciclo/AtasComitesPanel";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { delegacaoApi, type MinhaDelegacaoResponse } from "@/services/delegacaoApi";
import { PainelDelegacaoEdicao } from "@/components/ciclo/PainelDelegacaoEdicao";
import { useNavigate } from "react-router-dom";
const IDX_FORMACAO: Record<string, number> = {
  aguardando_proad: 0,
  aberto: 0,
  em_consulta_1: 1,
  em_consulta_2: 1,
  consolidacao_cca: 2,
  validacao_gejut: 2,
  apreciacao_sgjt: 3,
  em_comites: 4,
  remessa_dg: 5,
  publicado: 5,
};

const PROXIMO_ATOR_LABELS: Record<string, string> = {
  aberto: "Encaminhar à Consulta",
  em_consulta_1: "Encaminhar à 2° Validação",
  em_consulta_2: "Enviar à Consolidação",
  consolidacao_cca: "Encaminhar à Validação (GEJUT)",
  validacao_gejut: "Encaminhar à Apreciação",
  apreciacao_sgjt: "Encaminhar aos Comitês",
  em_comites: "Encaminhar para Remessa à DG",

};

const TAG_POR_ESTADO: Record<string, string> = {
  aberto: "PCA_FOR_ENCAMINHAR_CONSULTA",
  em_consulta_1: "PCA_FOR_VALIDAR_DEMANDA_1_CAMADA",
  em_consulta_2: "PCA_FOR_VALIDAR_DEMANDA_2_CAMADA",
  consolidacao_cca: "PCA_FOR_CONSOLIDAR_ENCAMINHAR_GEJUT",
  validacao_gejut: "PCA_FOR_ENCAMINHAR_SGJT",
  apreciacao_sgjt: "PCA_FOR_PAUTAR_COMITES",
  em_comites: "PCA_FOR_AUTORIZAR_COMITES",
  remessa_dg: "PCA_FOR_REMETER_DG",
};

const TAGS_ACESSO_POR_ESTADO: Record<string, string[]> = {
  aguardando_proad: ["PCA_FORMACAO_ABERTURA", "PCA_FOR_REGISTRAR_PROAD", "PCA_FOR_ENCAMINHAR_CONSULTA",
    "PCA_FOR_MODIFICAR_IFO_AGUARDANDO_PROAD", "PCA_FOR_VINCULAR_CONTRATOS_AGUARDANDO_PROAD"],
  aberto: ["PCA_FORMACAO_ABERTURA", "PCA_FOR_REGISTRAR_PROAD", "PCA_FOR_ENCAMINHAR_CONSULTA",
    "PCA_FOR_MODIFICAR_IFO_ABERTO", "PCA_FOR_VINCULAR_CONTRATOS_ABERTO"],
  em_consulta_1: ["PCA_FOR_VALIDAR_DEMANDA_1_CAMADA", "PCA_FOR_VALIDAR_DEMANDA_2_CAMADA", "PCA_FOR_REMETER_PARTICAO",
    "PCA_FOR_MODIFICAR_IFO_EM_CONSULTA_1", "PCA_FOR_VINCULAR_CONTRATOS_EM_CONSULTA_1"],
  em_consulta_2: ["PCA_FOR_VALIDAR_DEMANDA_1_CAMADA", "PCA_FOR_VALIDAR_DEMANDA_2_CAMADA", "PCA_FOR_REMETER_PARTICAO",
    "PCA_FOR_MODIFICAR_IFO_EM_CONSULTA_2", "PCA_FOR_VINCULAR_CONTRATOS_EM_CONSULTA_2"],
  consolidacao_cca: ["PCA_FOR_CONSOLIDAR_ENCAMINHAR_GEJUT",
    "PCA_FOR_MODIFICAR_IFO_CONSOLIDACAO_CCA", "PCA_FOR_VINCULAR_CONTRATOS_CONSOLIDACAO_CCA"],
  validacao_gejut: ["PCA_FOR_ENCAMINHAR_SGJT",
    "PCA_FOR_MODIFICAR_IFO_VALIDACAO_GEJUT", "PCA_FOR_VINCULAR_CONTRATOS_VALIDACAO_GEJUT"],
  apreciacao_sgjt: ["PCA_FOR_PAUTAR_COMITES",
    "PCA_FOR_MODIFICAR_IFO_APRECIACAO_SGJT", "PCA_FOR_VINCULAR_CONTRATOS_APRECIACAO_SGJT"],
  em_comites: ["PCA_FOR_AUTORIZAR_COMITES",
    "PCA_FOR_MODIFICAR_IFO_EM_COMITES", "PCA_FOR_VINCULAR_CONTRATOS_EM_COMITES"],
  remessa_dg: ["PCA_FOR_REMETER_DG",
    "PCA_FOR_MODIFICAR_IFO_REMESSA_DG", "PCA_FOR_VINCULAR_CONTRATOS_REMESSA_DG"],
  publicado: [], // Sem restrição
};

function EsteiraControls({
  ciclo,
  onAvancar,
  onRetroceder,
  disabled,
  podeAvancar = true,
  hideRetornar = false,
  leftActions,
}: {
  ciclo: Ciclo;
  onAvancar: () => void;
  onRetroceder: () => void;
  disabled?: boolean;
  podeAvancar?: boolean;
  hideRetornar?: boolean;
  leftActions?: React.ReactNode;
}) {
  const { user } = useAuth();
  const tags = user?.tags_acesso ?? [];
  const isSuperadmin = (user as any)?.is_superadmin;

  const tagNecessaria = TAG_POR_ESTADO[ciclo.estado];
  const temPermissaoDeTag = isSuperadmin || !tagNecessaria || tags.includes(tagNecessaria);
  const podeAvancarFinal = podeAvancar && temPermissaoDeTag;

  const labelBotaoAvancar = PROXIMO_ATOR_LABELS[ciclo.estado] || "Encaminhar ao próximo ator";
  return (
    <div className="flex justify-end gap-2 mt-4">
      {leftActions}
      {!hideRetornar && (
        <Button variant="outline" size="sm" onClick={onRetroceder} disabled={disabled}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retornar
        </Button>
      )}
      {podeAvancarFinal && (
        <Button
          size="sm"
          onClick={onAvancar}
          disabled={disabled}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <ArrowRight className="h-4 w-4 mr-1.5" />
          {labelBotaoAvancar}
        </Button>
      )}
    </div>
  );
}



export default function FormacaoPca() {
  const hoje = useMemo(() => new Date(), []);
  const anoVigente = hoje.getFullYear();
  const anoFormacao = anoVigente + 1;
  const { user } = useAuth();
  const navigate = useNavigate();

  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [acaoEmCurso, setAcaoEmCurso] = useState(false);
  const [proadInput, setProadInput] = useState("");
  const [pernasFormacao, setPernasFormacao] = useState<CicloTimelinePerna[]>(NOS_FORMACAO_DEFAULT);

  // Dados dos blocos
  const [ifosEncerramento, setIfosEncerramento] = useState<Ifo[]>([]);
  const [ifosRenovacao, setIfosRenovacao] = useState<Ifo[]>([]);
  const [ifosPlurianual, setIfosPlurianual] = useState<Ifo[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [ifos, setIfos] = useState<Ifo[]>([]);
  const [loadingBlocos, setLoadingBlocos] = useState(false);
  const [isNovoIfoOpen, setIsNovoIfoOpen] = useState(false);
  const [criarIfoBloco, setCriarIfoBloco] = useState<string | null>(null);
  const [blocosAbertos, setBlocosAbertos] = useState<Record<string, boolean>>({});
  
  const toggleBloco = (b: string) => setBlocosAbertos(prev => ({...prev, [b]: !prev[b]}));

  const orfaosPorBloco = useMemo(() => {
    const result: Record<string, number> = { plurianual: 0, renovacao: 0, encerramento: 0 };
    if (!allContracts.length) return result;
    
    const todosIfos = [...ifosEncerramento, ...ifosRenovacao, ...ifosPlurianual, ...ifos];
    const linkedIds = new Set(todosIfos.flatMap(i => (i.contratos || []).map(String)));
    
    allContracts.forEach(c => {
      if (!c.limitDate) return;
      const limitAno = new Date(c.limitDate).getFullYear();
      if (limitAno < anoFormacao) return;
      if (linkedIds.has(String(c.id))) return;
      
      if (c.endDate) {
        const fimAno = new Date(c.endDate).getFullYear();
        if (fimAno > anoFormacao) {
          result.plurianual++;
        } else if (new Date(c.limitDate) > new Date(c.endDate)) {
          result.renovacao++;
        } else {
          result.encerramento++;
        }
      } else {
         result.plurianual++;
      }
    });
    return result;
  }, [allContracts, ifos, ifosEncerramento, ifosRenovacao, ifosPlurianual, anoFormacao]);
  const [isImportarPcaOpen, setIsImportarPcaOpen] = useState(false);
  const [minhaDelegacao, setMinhaDelegacao] = useState<MinhaDelegacaoResponse | null>(null);

  // Modals de edição
  const [ifoEditing, setIfoEditing] = useState<Ifo | null>(null);
  const [ifoLinking, setIfoLinking] = useState<Ifo | null>(null);
  const [ifoDeleting, setIfoDeleting] = useState<Ifo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingContractVal, setEditingContractVal] = useState<{ ifoId: number; contractId: number; initialValue: number | null } | null>(null);

  // Justificativa
  const [isMotivoDialogOpen, setIsMotivoDialogOpen] = useState(false);
  const [motivoContractId, setMotivoContractId] = useState<number | null>(null);
  const [motivoIfoId, setMotivoIfoId] = useState<number | null>(null);

  // Validações de fase
  const [validacaoDfd, setValidacaoDfd] = useState<"V" | "X" | null>(null);
  const [validacaoComites, setValidacaoComites] = useState<"V" | "X" | null>(null);

  // Remessa DG — novo fluxo
  const [validacaoDg, setValidacaoDg] = useState<"V" | "X" | null>(null);
  const [dfdBaixado, setDfdBaixado] = useState<boolean>(() => {
    return localStorage.getItem(`dfdBaixado_${anoFormacao}`) === "true";
  });

  // Reinício do ciclo
  const [isReiniciarOpen, setIsReiniciarOpen] = useState(false);
  const [isReiniciando, setIsReiniciando] = useState(false);

  const handleReiniciarFormacao = async () => {
    setIsReiniciando(true);
    try {
      await cicloOrcamentarioApi.reiniciarFormacao(anoFormacao);
      toast.success("Formação do PCA reiniciada com sucesso.");
      setIsReiniciarOpen(false);
      window.location.reload();
    } catch {
      toast.error("Erro ao tentar reiniciar a formação.");
    } finally {
      setIsReiniciando(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    setAcaoEmCurso(true);
    cicloOrcamentarioApi
      .getOuAbrirFormacao(anoFormacao)
      .then((c) => {
        if (!cancelled) {
          setCiclo(c);
          setProadInput(c.proad ?? "");
        }
      })
      .catch(() => { })
      .finally(() => {
        if (!cancelled) setAcaoEmCurso(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anoFormacao]);

  // Carrega fases dinâmicas da Formação (parametros_ciclo_formacao)
  useEffect(() => {
    carregarFasesFormacaoTimeline().then(setPernasFormacao);
  }, []);

  const loadBlocos = async () => {
    if (!ciclo) return;
    setLoadingBlocos(true);
    try {
      // Se o ciclo está na fase de Consulta, restringimos a visibilidade
      const isSuper = (user as any)?.is_superadmin;
      const hasSpecialAccess = user?.tags_acesso?.includes("PCA_FOR_MODIFICACAO_ESPECIAL") || user?.tags_acesso?.includes("PCA_FOR_MODIFICACAO_CCA");
      const isEmConsulta = ciclo.estado === "em_consulta_1" || ciclo.estado === "em_consulta_2";
      const deveFiltrarMinhasDemandas = isEmConsulta && !isSuper && !hasSpecialAccess;

      const fetchedContracts = await contractsApi.getContracts({
        minhasDemandas: deveFiltrarMinhasDemandas ? true : undefined
      });
      setAllContracts(fetchedContracts);

      const ifosData = await ifoApi.listar(anoFormacao, ciclo.id, deveFiltrarMinhasDemandas ? true : undefined);

      const emEncerramento = ifosData.filter((i) => i.bloco === "encerramento");
      setIfosEncerramento(emEncerramento);

      const emRenovacao = ifosData.filter((i) => i.bloco === "renovacao");
      setIfosRenovacao(emRenovacao);

      const emPlurianual = ifosData.filter((i) => i.bloco === "plurianual");
      setIfosPlurianual(emPlurianual);

      const novasContratacoes = ifosData.filter((i) => i.bloco === "nova_contratacao");
      setIfos(novasContratacoes);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados dos blocos.");
    } finally {
      setLoadingBlocos(false);
    }
  };

  // Fetch independente de minhaDelegacao — roda assim que ciclo estiver disponível,
  // ANTES de loadBlocos, para que temAcessoFaseAtual já tenha a informação correta.
  useEffect(() => {
    if (!ciclo) return;
    let cancelled = false;
    delegacaoApi.minhaDelegacao(ciclo.id, ciclo.estado)
      .then((d) => { if (!cancelled) setMinhaDelegacao(d); })
      .catch((err) => console.warn("Erro ao buscar delegações:", err));
    return () => { cancelled = true; };
  }, [ciclo]);

  useEffect(() => {
    if (ciclo && ciclo.proad) {
      loadBlocos();
    }
  }, [ciclo]);

  const registrarProad = async () => {
    if (!ciclo || !proadInput.trim()) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.informarProad(
        ciclo.id,
        proadInput.trim(),
      );
      setCiclo(c);
      toast.success("PROAD registrado. Ciclo instruído.");
      loadBlocos();
    } catch {
      toast.error("Não foi possível registrar o PROAD.");
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const avancarEsteira = async () => {
    if (!ciclo) return;
    await processarAvanco();
  };

  const processarAvanco = async () => {
    if (!ciclo) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.avancar(ciclo.id);
      setCiclo(c);
      toast.success("Encaminhado ao próximo ator.");
    } catch {
      toast.error("Não foi possível encaminhar (verifique o estado atual).");
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const retrocederEsteira = async () => {
    if (!ciclo) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.retroceder(ciclo.id);
      setCiclo(c);
      toast.success("Retornado ao ator anterior.");
    } catch {
      toast.error("Não foi possível retroceder.");
    } finally {
      setAcaoEmCurso(false);
    }
  };

  const formacaoEstado = ciclo?.finalidade === "formacao" ? ciclo.estado : null;
  const aguardandoProad = formacaoEstado === "aguardando_proad" && !ciclo?.proad;

  const podeAvancarParaConsulta = true; // Validação ocorre integralmente por TAG no EsteiraControls

  const temAcessoFaseAtual = useMemo(() => {
    if (!formacaoEstado) return false;
    if (formacaoEstado === "publicado") return true;
    if ((user as any)?.is_superadmin) return true;

    // Delegação ou herança por tag de transição
    if (minhaDelegacao?.tem_delegacao || minhaDelegacao?.tem_tag_transicao) return true;

    // Tags de transição OU edição para o estado
    const tagsPermitidas = TAGS_ACESSO_POR_ESTADO[formacaoEstado] || [];
    return tagsPermitidas.some(tag => user?.tags_acesso?.includes(tag));
  }, [formacaoEstado, user, minhaDelegacao]);

  const hasEditTag = (prefix: string) => {
    if (!formacaoEstado) return false;
    if (formacaoEstado === "publicado") return false;
    if ((user as any)?.is_superadmin) return true;

    if (formacaoEstado === "apreciacao_sgjt" || formacaoEstado === "em_comites" || formacaoEstado === "remessa_dg") {
      return false;
    }

    // Caminho 1: Herança por tag de transição
    if (minhaDelegacao?.tem_tag_transicao) return true;

    // Caminho 2: Delegação ativa
    if (minhaDelegacao?.tem_delegacao) {
      if (minhaDelegacao.tipo === 'especial' && (prefix === 'MODIFICAR_IFO' || prefix === 'VINCULAR_CONTRATOS')) return true;
      if (minhaDelegacao.tipo === 'normal') return true;
    }

    // Caminho 3: Tag granular explícita
    const estadoMap = formacaoEstado === "aguardando_proad" ? "AGUARDANDO_PROAD" : formacaoEstado.toUpperCase();
    const tagNecessaria = `PCA_FOR_${prefix}_${estadoMap}`;
    return user?.tags_acesso?.includes(tagNecessaria) ?? false;
  };

  const temModificacaoEspecial =
    (formacaoEstado !== "apreciacao_sgjt" && formacaoEstado !== "em_comites" && formacaoEstado !== "remessa_dg") && (
      user?.tags_acesso?.includes("PCA_FOR_MODIFICACAO_ESPECIAL") ||
      user?.tags_acesso?.includes("PCA_FOR_MODIFICACAO_CCA") ||
      minhaDelegacao?.tipo === "especial"
    );

  const podeEditarIfo = hasEditTag("MODIFICAR_IFO") || temModificacaoEspecial;
  const podeVincularContratos = hasEditTag("VINCULAR_CONTRATOS");
  const podeDeletarIfo = hasEditTag("DELETAR_IFO");

  const handleDeleteIfo = async () => {
    if (!ifoDeleting) return;
    setIsDeleting(true);
    try {
      await ifoApi.excluir(ifoDeleting.id);
      toast.success("IFO excluído com sucesso.");
      setIfoDeleting(null);
      loadBlocos();
    } catch {
      toast.error("Não foi possível excluir o IFO. Verifique as dependências.");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleDefinirInteresseContrato = async (ifoId: number, contractId: number, interesse: boolean, motivo?: string) => {
    try {
      await ifoApi.definirInteresseRenovacaoContrato(ifoId, contractId, interesse, motivo);
      toast.success(interesse ? "Renovação confirmada para o contrato." : "Contrato marcado para Encerramento.");
      loadBlocos();
    } catch {
      toast.error("Erro ao registrar interesse na renovação do contrato.");
    }
  };

  const renderPainelDelegacao = () => {
    if (!ciclo) return null;
    const isSuper = (user as any)?.is_superadmin;
    const isFaseBloqueada = ciclo.estado === "em_comites" || ciclo.estado === "remessa_dg";
    const podeDelegar = isSuper || (!isFaseBloqueada && minhaDelegacao?.tem_tag_transicao);

    if (!podeDelegar) return null;
    return (
      <PainelDelegacaoEdicao
        cicloId={ciclo.id}
        estado={ciclo.estado}
        onDelegacaoChanged={loadBlocos}
      />
    );
  };

  return (
    <Layout>
      <div className="space-y-6 page-transition-enter pb-10">
        <Breadcrumbs
          items={[
            { label: "Contratações de TIC", to: "/pca" },
            { label: "Ciclo Orçamentário", to: "/ciclo-orcamentario" },
            { label: `Formação PCA - ${anoFormacao}` },
          ]}
        />

        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
              Formação do DFD — PCA-TIC {anoFormacao}
            </h1>
            <p className="text-slate-500 mt-1">
              Documento de Formalização da Demanda · gera Versão 1 do PCA-TIC {anoFormacao}
            </p>
          </div>
        </div>

        {ciclo && (
          <section className="space-y-4">
            <CicloTimeline
              pernas={pernasFormacao}
              activeIndex={formacaoEstado != null ? IDX_FORMACAO[formacaoEstado] ?? 0 : 0}
              showMarcoLegend
            />

            {!temAcessoFaseAtual ? (
              <div className="mt-8 rounded-xl border border-amber-100 bg-amber-50/50 p-6 shadow-sm text-center">
                <h3 className="text-base font-semibold text-slate-800 mb-2">
                  Acesso Restrito
                </h3>
                <p className="text-sm text-slate-600">
                  A fase atual da Formação do PCA é de visualização restrita aos atores responsáveis. Você pode acompanhar o andamento pelo fluxo acima, mas os detalhes desta fase não estão disponíveis.
                </p>
              </div>
            ) : (
              <>
                {/* Banner contextual da fase atual */}
                {formacaoEstado && formacaoEstado !== "em_comites" && (
                  <FaseBanner estado={formacaoEstado} ano={anoFormacao} />
                )}

                {/* Fase: Abertura — PROAD */}
                {aguardandoProad && (
                  <div className="rounded-xl border border-blue-100 bg-white p-6 shadow-sm">
                    <h3 className="text-base font-semibold text-slate-800 mb-2">
                      Instruir o ciclo
                    </h3>
                    <p className="text-sm text-slate-600 mb-4 max-w-2xl">
                      Informe o PROAD de instrução para carregar os blocos do DFD-Consulta.
                    </p>
                    <div className="flex flex-col gap-4 max-w-xl">
                      <div className="space-y-1.5 w-full">
                        <label className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                          Número do PROAD de instrução
                        </label>
                        <Input
                          placeholder="202700004821"
                          value={proadInput}
                          onChange={(e) => setProadInput(e.target.value)}
                          className="bg-white border-slate-200 w-full"
                        />
                      </div>
                      <div>
                        <Button
                          onClick={registrarProad}
                          disabled={!proadInput.trim() || acaoEmCurso}
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                        >
                          {acaoEmCurso ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4 mr-2" />
                          )}
                          Iniciar DFD
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Fases pós-abertura: conteúdo específico + controles da esteira */}
                {!aguardandoProad && (
                  <>
                    {/* Fase: Consolidação (consolidacao_cca / validacao_gejut) — listagem consolidada */}
                    {/* Painel de Referência PROAD / Despacho GEJUT removido */}

                    {/* Fase: Apreciação SGJT */}
                    {formacaoEstado === "apreciacao_sgjt" && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mb-4">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-800">
                            Proposta DFD
                          </h3>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setValidacaoDfd('V')}
                              variant={validacaoDfd === 'V' ? 'default' : 'outline'}
                              size="sm"
                              className={validacaoDfd === 'V' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'}
                            >
                              <Check className="h-4 w-4 mr-2" /> Aprovar
                            </Button>
                            <Button
                              onClick={() => setValidacaoDfd('X')}
                              variant={validacaoDfd === 'X' ? 'default' : 'outline'}
                              size="sm"
                              className={validacaoDfd === 'X' ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600' : 'text-rose-700 border-rose-200 hover:bg-rose-50'}
                            >
                              <X className="h-4 w-4 mr-2" /> Rejeitar
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Fase: Comitês e Autorização (CGTIC · CGovTIC · SGJT) */}
                    {formacaoEstado === "em_comites" && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center gap-3 flex-wrap">
                          <h3 className="text-sm font-semibold text-slate-800">
                            Proposta DFD
                          </h3>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => setValidacaoComites('V')}
                              variant={validacaoComites === 'V' ? 'default' : 'outline'}
                              size="sm"
                              className={validacaoComites === 'V' ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600' : 'text-emerald-700 border-emerald-200 hover:bg-emerald-50'}
                            >
                              <Check className="h-4 w-4 mr-2" /> Aprovar
                            </Button>
                            <Button
                              onClick={() => setValidacaoComites('X')}
                              variant={validacaoComites === 'X' ? 'default' : 'outline'}
                              size="sm"
                              className={validacaoComites === 'X' ? 'bg-rose-600 hover:bg-rose-700 text-white border-rose-600' : 'text-rose-700 border-rose-200 hover:bg-rose-50'}
                            >
                              <X className="h-4 w-4 mr-2" /> Rejeitar
                            </Button>
                          </div>
                        </div>

                        {validacaoComites === 'V' && (
                          <div className="mt-4 p-4 border rounded-lg bg-slate-50">
                            <h4 className="text-sm font-semibold text-slate-800 mb-3">Inserir Ata</h4>
                            <div className="flex flex-col gap-3">


                              <AtasComitesPanel cicloId={ciclo.id} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}



                    {/* Fase: Publicado — resumo final */}
                    {formacaoEstado === "publicado" && (
                      <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 shadow-sm text-center flex flex-col items-center">
                        <CheckCheck className="h-10 w-10 text-green-500 mb-3" />
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">
                          PCA-TIC {anoFormacao} — Publicado
                        </h3>
                        <p className="text-sm text-slate-600 max-w-md">
                          O Documento de Formalização da Demanda foi concluído e o PCA-TIC foi publicado. A versão está congelada.
                        </p>
                      </div>
                    )}

                    {formacaoEstado === "apreciacao_sgjt" ? (
                      <div className="flex justify-end gap-2 mt-4">
                        {renderPainelDelegacao()}
                        {validacaoDfd === 'V' && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" size="sm">
                                <FileText className="h-4 w-4 mr-1.5" />
                                Baixar Proposta de DFD TIC
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                window.open(`${getApiBaseUrl()}/api/ciclo-orcamentario/formacao/${anoFormacao}/pdf`, "_blank");
                                setDfdBaixado(true);
                                localStorage.setItem(`dfdBaixado_${anoFormacao}`, "true");
                              }}>
                                Documento PDF
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                window.open(`${getApiBaseUrl()}/api/ciclo-orcamentario/formacao/${anoFormacao}/xlsx`, "_blank");
                                setDfdBaixado(true);
                                localStorage.setItem(`dfdBaixado_${anoFormacao}`, "true");
                              }}>
                                Planilha (.xlsx)
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}

                        {validacaoDfd === 'X' && (
                          <Button variant="outline" size="sm" onClick={retrocederEsteira} disabled={acaoEmCurso}>
                            <ArrowLeft className="h-4 w-4 mr-1.5" />
                            Retornar à Consolidação
                          </Button>
                        )}

                        {validacaoDfd === 'V' && (
                          <TooltipProvider delayDuration={200}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span tabIndex={!dfdBaixado ? 0 : undefined}>
                                  <Button
                                    size="sm"
                                    onClick={avancarEsteira}
                                    disabled={acaoEmCurso || !dfdBaixado}
                                    className="bg-blue-600 hover:bg-blue-700 text-white"
                                  >
                                    <ArrowRight className="h-4 w-4 mr-1.5" />
                                    Encaminhar aos Comitês
                                  </Button>
                                </span>
                              </TooltipTrigger>
                              {!dfdBaixado && (
                                <TooltipContent>
                                  Baixe a Proposta de DFD TIC antes de encaminhar
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        )}
                      </div>
                    ) : formacaoEstado === "em_comites" ? (
                      <div className="flex justify-end gap-2 mt-4">
                        {renderPainelDelegacao()}
                        {validacaoComites === 'X' && (
                          <Button variant="outline" size="sm" onClick={retrocederEsteira} disabled={acaoEmCurso}>
                            <ArrowLeft className="h-4 w-4 mr-1.5" />
                            Encaminhar à SGJT
                          </Button>
                        )}

                        {validacaoComites === 'V' && (
                          <Button
                            size="sm"
                            onClick={avancarEsteira}
                            disabled={acaoEmCurso}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            <ArrowRight className="h-4 w-4 mr-1.5" />
                            Encaminhar ao CCA
                          </Button>
                        )}
                      </div>
                    ) : formacaoEstado === "remessa_dg" ? (
                      <>
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mt-4">
                          <h3 className="text-sm font-semibold text-slate-800 mb-4">
                            Validação da Diretoria-Geral
                          </h3>
                          <div className="space-y-4">
                            {/* Validação DG — aparece após download */}
                            {dfdBaixado && (
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-sm font-medium text-slate-700">Validado pela DG?</span>
                                <div className="flex gap-2">
                                  <Button
                                    onClick={() => setValidacaoDg('V')}
                                    variant={validacaoDg === 'V' ? 'default' : 'outline'}
                                    className={validacaoDg === 'V' ? "bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600" : "text-emerald-700 border-emerald-200 hover:bg-emerald-50"}
                                    size="sm"
                                  >
                                    <Check className="h-4 w-4 mr-1.5" /> Sim
                                  </Button>
                                  <Button
                                    onClick={() => setValidacaoDg('X')}
                                    variant={validacaoDg === 'X' ? 'default' : 'outline'}
                                    className={validacaoDg === 'X' ? "bg-rose-600 hover:bg-rose-700 text-white border-rose-600" : "text-rose-700 border-rose-200 hover:bg-rose-50"}
                                    size="sm"
                                  >
                                    <X className="h-4 w-4 mr-1.5" /> Não
                                  </Button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex justify-end gap-2 mt-4">
                          {renderPainelDelegacao()}
                          {validacaoDg !== 'V' && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <FileText className="h-4 w-4 mr-1.5" />
                                  Baixar DFD TIC
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => {
                                  window.open(`${getApiBaseUrl()}/api/ciclo-orcamentario/formacao/${anoFormacao}/pdf`, "_blank");
                                  setDfdBaixado(true);
                                  localStorage.setItem(`dfdBaixado_${anoFormacao}`, "true");
                                  setValidacaoDg(null);
                                }}>
                                  Documento PDF
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => {
                                  window.open(`${getApiBaseUrl()}/api/ciclo-orcamentario/formacao/${anoFormacao}/xlsx`, "_blank");
                                  setDfdBaixado(true);
                                  localStorage.setItem(`dfdBaixado_${anoFormacao}`, "true");
                                  setValidacaoDg(null);
                                }}>
                                  Planilha (.xlsx)
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          )}
                          {validacaoDg === 'X' && (
                            <Button variant="outline" size="sm" onClick={retrocederEsteira} disabled={acaoEmCurso}>
                              <ArrowLeft className="h-4 w-4 mr-1.5" />
                              Retornar aos Comitês
                            </Button>
                          )}
                          {validacaoDg === 'V' && (
                            <Button
                              size="sm"
                              onClick={() => setIsImportarPcaOpen(true)}
                              className="bg-blue-600 hover:bg-blue-700 text-white"
                            >
                              <Upload className="h-4 w-4 mr-1.5" />
                              Importar PCA
                            </Button>
                          )}
                        </div>
                      </>
                    ) : formacaoEstado === "publicado" ? null : (
                      <EsteiraControls
                        ciclo={ciclo}
                        onAvancar={avancarEsteira}
                        onRetroceder={retrocederEsteira}
                        disabled={acaoEmCurso}
                        podeAvancar={podeAvancarParaConsulta}
                        hideRetornar={formacaoEstado === "aguardando_proad" || formacaoEstado === "aberto"}
                        leftActions={renderPainelDelegacao()}
                      />
                    )}
                  </>
                )}
              </>
            )}
          </section>
        )}

        {editingContractVal && (
          <DialogEditarValorContratoIfo
            open={true}
            onOpenChange={(open) => {
              if (!open) setEditingContractVal(null);
            }}
            ifoId={editingContractVal.ifoId}
            contractId={editingContractVal.contractId}
            initialValueCents={editingContractVal.initialValue}
            onSuccess={() => {
              setEditingContractVal(null);
              loadBlocos();
            }}
          />
        )}

        {/* Blocos só aparecem se já tiver PROAD instruído (ou seja, se a consulta foi liberada) e se tiver acesso à fase atual */}
        {ciclo && ciclo.proad && temAcessoFaseAtual && (
          <div className="space-y-8 mt-8">
            {/* Helper para renderizar blocos continuados */}
            {(() => {
              const renderBlocoContinuado = (
                titulo: string,
                numeroBloco: number,
                ifosList: Ifo[],
                corTexto: string,
                corBg: string,
                blocoId: string,
                isNovaContratacao?: boolean
              ) => {
                const isOpen = !!blocosAbertos[blocoId];
                const qtdOrfaos = orfaosPorBloco[blocoId] || 0;
                const hasEmptyIfo = ifosList.some(ifo => !ifo.contratos || ifo.contratos.length === 0);
                
                return (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div 
                    className="flex items-center justify-between border-b bg-slate-50 px-5 py-3 cursor-pointer select-none hover:bg-slate-100 transition-colors"
                    onClick={() => toggleBloco(blocoId)}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${corTexto} ${corBg} px-2 py-0.5 rounded`}>
                        Bloco {numeroBloco}
                      </span>
                      <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-slate-500 font-medium">
                        {ifosList.length} {ifosList.length === 1 ? 'IFO' : 'IFOs'}
                      </span>
                      <ChevronDown className={`h-5 w-5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                  {isOpen && (
                  <div className="p-0">
                    {qtdOrfaos > 0 && (
                      <div className="bg-amber-50 px-5 py-3 border-b border-amber-100 flex items-center gap-2 text-amber-700 text-sm font-medium">
                        <AlertTriangle className="h-4 w-4" />
                        <span><strong>Atenção:</strong> Existem {qtdOrfaos} contrato(s) com perfil deste bloco que ainda não estão vinculados a nenhum IFO.</span>
                      </div>
                    )}
                    {loadingBlocos ? (
                      <div className="p-8 flex justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                      </div>
                    ) : ifosList.length === 0 ? (
                      <div className="p-8 text-center text-sm text-slate-500">
                        Nenhum IFO de {titulo.toLowerCase()} encontrado para {anoFormacao}.
                      </div>
                    ) : (
                      <div className="p-4 space-y-6">
                        {ifosList.map((ifo) => (
                          <div key={ifo.id} className="border border-slate-200 rounded-lg overflow-hidden">
                            <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap justify-between items-center gap-4">
                              <div className="flex flex-col">
                                <span className="font-mono text-sm font-semibold text-slate-700">{ifo.codigo}</span>
                                <span className="text-sm text-slate-900 font-medium">{ifo.description || ifo.objeto || "-"}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span><b className="text-slate-800">{getAreaLabel(ifo)}</b></span>
                                <span className="font-semibold text-slate-800">{formatCurrency(ifo.valorEstimado || 0)}</span>
                                <div className="flex items-center gap-1">

                                  {podeVincularContratos && ifo.bloco !== "nova_contratacao" && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => setIfoLinking(ifo)}>
                                      <LinkIcon className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {podeEditarIfo && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => setIfoEditing(ifo)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {podeDeletarIfo && ifo.bloco === "nova_contratacao" && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => setIfoDeleting(ifo)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            
                            {(!ifo.contratos || ifo.contratos.length === 0) && ifo.bloco !== "nova_contratacao" && (
                              <div className="bg-amber-50 px-4 py-2 border-b border-amber-100 flex items-center gap-2 text-amber-700 text-sm font-medium">
                                <AlertTriangle className="h-4 w-4" />
                                <span>Este IFO será removido automaticamente ao avançar a etapa por não possuir contratos vinculados.</span>
                              </div>
                            )}

                            {ifo.contratos && ifo.contratos.length > 0 && (
                              <div className="overflow-x-auto">
                                <table className="w-full text-sm text-left">
                                  <thead className="bg-white border-b text-slate-500">
                                    <tr>
                                      <th className="px-4 py-2 font-medium">Contrato</th>
                                      <th className="px-4 py-2 font-medium">Nat. despesa</th>
                                      <th className="px-4 py-2 font-medium text-right">Valor anual</th>
                                      <th className="px-4 py-2 font-medium">Vigência</th>
                                      {ifo.bloco === "renovacao" && (formacaoEstado === "em_consulta_1" || formacaoEstado === "em_consulta_2") && (
                                        <th className="px-4 py-2 font-medium text-center">Pretende renovar?</th>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {ifo.contratos.map((contractId) => {
                                      const c = allContracts.find(ac => String(ac.id) === String(contractId));
                                      if (!c) return null;

                                      const detalhe = ifo.ifoContratosDetalhes?.find(d => String(d.contractId) === String(contractId));
                                      const interesseRenovacao = detalhe?.interesseRenovacao ?? true;

                                      return (
                                        <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                          <td
                                            className="px-4 py-2 font-medium text-blue-600 cursor-pointer hover:underline font-mono"
                                            onClick={() => navigate(`/contratos-ti/${c.id}`)}
                                          >
                                            <div className="flex items-center gap-1.5">
                                              {`${c.noticeNumber} - ${c.objectName}`}
                                              {ifo.bloco === "encerramento" && formacaoEstado && ["consolidacao_cca", "validacao_gejut", "apreciacao_sgjt", "em_comites", "remessa_dg", "publicado"].includes(formacaoEstado) && interesseRenovacao === false && (
                                                <TooltipProvider delayDuration={200}>
                                                  <Tooltip>
                                                    <TooltipTrigger asChild>
                                                      <div className="flex items-center">
                                                        <Info className="h-4 w-4 text-blue-500 cursor-help" />
                                                      </div>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="top" className="max-w-[300px] text-xs text-center break-words break-all whitespace-normal">
                                                      <strong>Sem interesse na renovação. Motivo: </strong>
                                                      <br />
                                                      {detalhe?.motivoReclassificacao}
                                                    </TooltipContent>
                                                  </Tooltip>
                                                </TooltipProvider>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2 text-slate-600">{(c as any).expenseNature || "-"}</td>
                                          <td className="px-4 py-2 text-right text-slate-700 font-medium whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-2">
                                              <span>{formatCurrency(((detalhe?.valorContratoCents != null ? detalhe.valorContratoCents : c.totalValueCents) || 0) / 100)}</span>
                                              {podeEditarIfo && (
                                                <Button
                                                  variant="ghost"
                                                  size="icon"
                                                  className="h-6 w-6 text-slate-400 hover:text-blue-600"
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    setEditingContractVal({
                                                      ifoId: ifo.id,
                                                      contractId: c.id,
                                                      initialValue: detalhe?.valorContratoCents != null ? detalhe.valorContratoCents : (c.totalValueCents || 0)
                                                    });
                                                  }}
                                                >
                                                  <Pencil className="h-3 w-3" />
                                                </Button>
                                              )}
                                            </div>
                                          </td>
                                          <td className="px-4 py-2 text-slate-600">
                                            {c.endDate ? `até ${new Date(c.endDate).toLocaleDateString('pt-BR')}` : "-"}
                                          </td>
                                          {ifo.bloco === "renovacao" && (formacaoEstado === "em_consulta_1" || formacaoEstado === "em_consulta_2") && (
                                            <td className="px-4 py-2 text-center">
                                              {podeEditarIfo ? (
                                                <div className="flex items-center justify-center gap-1">
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-6 w-6 rounded-full ${interesseRenovacao ? 'bg-green-100 text-green-700' : 'text-slate-400 hover:text-green-600 hover:bg-green-50'}`}
                                                    onClick={() => handleDefinirInteresseContrato(ifo.id, contractId, true)}
                                                    title="Renovar"
                                                  >
                                                    <Check className="h-4 w-4" />
                                                  </Button>
                                                  <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className={`h-6 w-6 rounded-full ${!interesseRenovacao ? 'bg-red-100 text-red-700' : 'text-slate-400 hover:text-red-600 hover:bg-red-50'}`}
                                                    onClick={() => {
                                                      setMotivoIfoId(ifo.id);
                                                      setMotivoContractId(contractId);
                                                      setIsMotivoDialogOpen(true);
                                                    }}
                                                    title="Não Renovar"
                                                  >
                                                    <X className="h-4 w-4" />
                                                  </Button>
                                                </div>
                                              ) : (
                                                <span className="text-xs text-slate-500">{interesseRenovacao ? "Sim" : "Não"}</span>
                                              )}
                                            </td>
                                          )}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {isNovaContratacao && podeEditarIfo && (
                      <div className="p-4 bg-slate-50/50 border-t border-slate-200">
                        <Button
                          variant="outline"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => setIsNovoIfoOpen(true)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo IFO
                        </Button>
                      </div>
                    )}
                    {!isNovaContratacao && podeEditarIfo && !hasEmptyIfo && (
                      <div className="p-4 bg-slate-50/50 border-t border-slate-200">
                        <Button
                          variant="outline"
                          className="text-blue-600 border-blue-200 hover:bg-blue-50"
                          onClick={() => setCriarIfoBloco(blocoId)}
                        >
                          <Plus className="h-4 w-4 mr-2" />
                          Novo IFO
                        </Button>
                      </div>
                    )}
                  </div>
                  )}
                </div>
              );
            };

              return (
                <>
                  {renderBlocoContinuado("Encerramento", 1, ifosEncerramento, "text-red-700", "bg-red-100", "encerramento")}
                  {renderBlocoContinuado("Renovação", 2, ifosRenovacao, "text-blue-700", "bg-blue-100", "renovacao")}
                  {renderBlocoContinuado("Plurianual", 3, ifosPlurianual, "text-purple-700", "bg-purple-100", "plurianual")}
                  {renderBlocoContinuado("Nova Contratação", 4, ifos, "text-emerald-700", "bg-emerald-100", "nova_contratacao", true)}
                </>
              );
            })()}
          </div>
        )}

        {(user as any)?.is_superadmin && (
          <div className="mt-12 pt-6 border-t border-slate-200 flex justify-end">
            <Button
              variant="outline"
              className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => setIsReiniciarOpen(true)}
            >
              <AlertTriangle className="h-4 w-4 mr-2" />
              Reiniciar Formação
            </Button>
          </div>
        )}
      </div>

      <DialogNovoIfo
        open={isNovoIfoOpen}
        onOpenChange={setIsNovoIfoOpen}
        ano={anoFormacao}
        cicloId={ciclo?.id}
        proad={ciclo?.proad}
        onSuccess={loadBlocos}
      />



      {/* Modais de Edição e Vínculo */}
      <DialogEditarIfo
        open={!!ifoEditing}
        onOpenChange={(open) => !open && setIfoEditing(null)}
        ifo={ifoEditing}
        onSuccess={loadBlocos}
      />

      <DialogVincularContratos
        open={!!ifoLinking}
        onOpenChange={(open) => !open && setIfoLinking(null)}
        ifo={ifoLinking}
        allContracts={allContracts}
        onSuccess={loadBlocos}
      />

      <DialogCriarIfoViaContrato
        open={!!criarIfoBloco}
        onOpenChange={(open) => !open && setCriarIfoBloco(null)}
        bloco={criarIfoBloco as any}
        ano={anoFormacao}
        cicloId={ciclo?.id || 0}
        allContracts={allContracts}
        onSuccess={loadBlocos}
      />

      {/* Modal de Confirmação de Exclusão */}
      <Dialog open={!!ifoDeleting} onOpenChange={(open) => !open && setIfoDeleting(null)}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Confirmar Exclusão
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              Tem certeza que deseja excluir o IFO <span className="font-semibold text-slate-700">{ifoDeleting?.codigo}</span>?
              <br /><br />
              Esta ação é irreversível e o item será removido permanentemente do planejamento.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIfoDeleting(null)} disabled={isDeleting}>
              Cancelar
            </Button>
            <Button onClick={handleDeleteIfo} disabled={isDeleting} className="bg-red-600 hover:bg-red-700 text-white">
              {isDeleting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Trash2 className="h-4 w-4 mr-2" />}
              Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {ciclo && (
        <DialogImportarPca
          open={isImportarPcaOpen}
          onOpenChange={setIsImportarPcaOpen}
          ifos={[...ifosEncerramento, ...ifosRenovacao, ...ifosPlurianual, ...ifos]}
          anoFormacao={anoFormacao}
          onEditIfo={setIfoEditing}
          onConfirm={async (importacoes, arquivoPca) => {
            setAcaoEmCurso(true);
            try {
              const c = await cicloOrcamentarioApi.publicar(ciclo.id, importacoes, arquivoPca);
              setCiclo(c);
              toast.success("Ciclo publicado e itens de PCA gerados com sucesso!");
              loadBlocos();
            } catch (err) {
              console.error(err);
              toast.error("Não foi possível importar os PCAs.");
              throw err;
            } finally {
              setAcaoEmCurso(false);
            }
          }}
        />
      )}

      {/* Modal de Reiniciar Formação */}
      <Dialog open={isReiniciarOpen} onOpenChange={setIsReiniciarOpen}>
        <DialogContent className="sm:max-w-[425px] bg-white">
          <DialogHeader>
            <DialogTitle className="text-xl font-semibold text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Reiniciar Formação
            </DialogTitle>
            <DialogDescription className="text-slate-500">
              você realmente pretende reiniciar a formação PCA?
              <br /><br />
              Isso excluirá os IFOs e os dados desta formação, permitindo iniciar o ciclo novamente.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setIsReiniciarOpen(false)} disabled={isReiniciando}>
              Cancelar
            </Button>
            <Button onClick={handleReiniciarFormacao} disabled={isReiniciando} className="bg-red-600 hover:bg-red-700 text-white">
              {isReiniciando ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <AlertTriangle className="h-4 w-4 mr-2" />}
              Reiniciar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DialogMotivoNaoRenovacao
        open={isMotivoDialogOpen}
        onOpenChange={setIsMotivoDialogOpen}
        ifoId={motivoIfoId}
        contractId={motivoContractId}
        onConfirm={async (ifoId, contractId, motivo) => {
          await handleDefinirInteresseContrato(ifoId, contractId, false, motivo);
        }}
      />
    </Layout>
  );
}
