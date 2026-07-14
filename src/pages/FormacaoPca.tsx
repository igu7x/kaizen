import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Plus, ExternalLink, CheckCheck, Pencil, Trash2, Link as LinkIcon, AlertTriangle, Check, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { CicloTimeline } from "@/components/contratacoes/ciclo/CicloTimeline";
import { NOS_FORMACAO } from "@/components/contratacoes/ciclo/cicloConstants";
import { cicloOrcamentarioApi, type Ciclo } from "@/services/cicloOrcamentarioApi";
import { contractsApi } from "@/services/contractsApi";
import { ifoApi, type Ifo } from "@/services/dfdApi";
import { Contract } from "@/types";
import { formatCurrency } from "@/services/pcaApi";
import { DialogNovoIfo } from "@/components/ciclo/DialogNovoIfo";
import { DialogEditarIfo } from "@/components/ciclo/DialogEditarIfo";
import { DialogVincularContratos } from "@/components/ciclo/DialogVincularContratos";
import { FaseBanner } from "@/components/ciclo/FaseBanner";
import { CampoLinkProad } from "@/components/ciclo/CampoLinkProad";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const IDX_FORMACAO: Record<string, number> = {
  aguardando_proad: 0,
  aberto_aguardando_proad: 0,
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
  remessa_dg: "Publicar",
};

const TAG_POR_ESTADO: Record<string, string> = {
  aberto: "PCA_ENCAMINHAR_CONSULTA",
  em_consulta_1: "PCA_VALIDAR_DEMANDA_1_CAMADA",
  em_consulta_2: "PCA_VALIDAR_DEMANDA_2_CAMADA",
  consolidacao_cca: "PCA_CONSOLIDAR_ENCAMINHAR_GEJUT",
  validacao_gejut: "PCA_ENCAMINHAR_SGJT",
  apreciacao_sgjt: "PCA_PAUTAR_COMITES",
  em_comites: "PCA_AUTORIZAR_COMITES",
  remessa_dg: "PCA_REMETER_DG",
};

const TAGS_ACESSO_POR_ESTADO: Record<string, string[]> = {
  aguardando_proad: ["PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA"],
  aberto_aguardando_proad: ["PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA"],
  aberto: ["PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA"],
  em_consulta_1: ["PCA_VALIDAR_DEMANDA_1_CAMADA", "PCA_VALIDAR_DEMANDA_2_CAMADA", "PCA_REMETER_PARTICAO"],
  em_consulta_2: ["PCA_VALIDAR_DEMANDA_1_CAMADA", "PCA_VALIDAR_DEMANDA_2_CAMADA", "PCA_REMETER_PARTICAO"],
  consolidacao_cca: ["PCA_CONSOLIDAR_ENCAMINHAR_GEJUT"],
  validacao_gejut: ["PCA_ENCAMINHAR_SGJT"],
  apreciacao_sgjt: ["PCA_PAUTAR_COMITES"],
  em_comites: ["PCA_AUTORIZAR_COMITES"],
  remessa_dg: ["PCA_REMETER_DG"],
  publicado: [], // Sem restrição
};

function EsteiraControls({
  ciclo,
  onAvancar,
  onRetroceder,
  disabled,
  podeAvancar = true,
}: {
  ciclo: Ciclo;
  onAvancar: () => void;
  onRetroceder: () => void;
  disabled?: boolean;
  podeAvancar?: boolean;
}) {
  const { user } = useAuth();
  const tags = user?.tags_acesso ?? [];
  const isSuperadmin = (user as any)?.is_superadmin;

  const tagNecessaria = TAG_POR_ESTADO[ciclo.estado];
  const temPermissaoDeTag = isSuperadmin || !tagNecessaria || tags.includes(tagNecessaria);
  const podeAvancarFinal = podeAvancar && temPermissaoDeTag;

  const labelBotaoAvancar = PROXIMO_ATOR_LABELS[ciclo.estado] || "Encaminhar ao próximo ator";
  return (
    <div className="flex items-center gap-4 py-2 border-t mt-4">
      <span className="text-sm font-medium text-slate-700">
        Próxima ação:
      </span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetroceder} disabled={disabled}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          Retornar
        </Button>
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
    </div>
  );
}

export default function FormacaoPca() {
  const hoje = useMemo(() => new Date(), []);
  const anoVigente = hoje.getFullYear();
  const anoFormacao = anoVigente + 1;
  const { user } = useAuth();

  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [acaoEmCurso, setAcaoEmCurso] = useState(false);
  const [proadInput, setProadInput] = useState("");

  // Dados dos blocos
  const [ifosEncerramento, setIfosEncerramento] = useState<Ifo[]>([]);
  const [ifosRenovacao, setIfosRenovacao] = useState<Ifo[]>([]);
  const [ifosPlurianual, setIfosPlurianual] = useState<Ifo[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [ifos, setIfos] = useState<Ifo[]>([]);
  const [loadingBlocos, setLoadingBlocos] = useState(false);
  const [isNovoIfoOpen, setIsNovoIfoOpen] = useState(false);

  // Modals de edição
  const [ifoEditing, setIfoEditing] = useState<Ifo | null>(null);
  const [ifoLinking, setIfoLinking] = useState<Ifo | null>(null);
  const [ifoDeleting, setIfoDeleting] = useState<Ifo | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Publicação DG
  const [isPublicarOpen, setIsPublicarOpen] = useState(false);

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

  const loadBlocos = async () => {
    if (!ciclo) return;
    setLoadingBlocos(true);
    try {
      // Se o ciclo está na fase de Consulta, restringimos a visibilidade
      const isEmConsulta = ciclo.estado === "em_consulta_1" || ciclo.estado === "em_consulta_2";

      const fetchedContracts = await contractsApi.getContracts({
        minhasDemandas: isEmConsulta ? true : undefined
      });
      setAllContracts(fetchedContracts);

      const ifosData = await ifoApi.listar(anoFormacao, ciclo.id, isEmConsulta ? true : undefined);

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
    if (ciclo.estado === "remessa_dg") {
      setIsPublicarOpen(true);
      return;
    }
    await processarAvanco();
  };

  const processarAvanco = async () => {
    if (!ciclo) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.avancar(ciclo.id);
      setCiclo(c);
      setIsPublicarOpen(false);
      toast.success(
        c.estado === "publicado" ? "Publicado. Versão gravada no PCA-TIC." : "Encaminhado ao próximo ator.",
      );
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
  const aguardandoProad = (formacaoEstado === "aguardando_proad" || formacaoEstado === "aberto_aguardando_proad") && !ciclo?.proad;

  const podeAvancarParaConsulta = true; // Validação ocorre integralmente por TAG no EsteiraControls

  const temAcessoFaseAtual = useMemo(() => {
    if (!formacaoEstado) return false;
    if (formacaoEstado === "publicado") return true;
    if ((user as any)?.is_superadmin) return true;

    const tagsPermitidas = TAGS_ACESSO_POR_ESTADO[formacaoEstado] || [];
    return tagsPermitidas.some(tag => user?.tags_acesso?.includes(tag));
  }, [formacaoEstado, user]);

  const hasEditTag = (prefix: string) => {
    if (!formacaoEstado) return false;
    if (formacaoEstado === "publicado") return false;
    if ((user as any)?.is_superadmin) return true;
    const estadoMap = formacaoEstado === "aberto_aguardando_proad" ? "AGUARDANDO_PROAD" : formacaoEstado.toUpperCase();
    const tagNecessaria = `PCA_${prefix}_${estadoMap}`;
    return user?.tags_acesso?.includes(tagNecessaria) ?? false;
  };

  const podeEditarIfo = hasEditTag("MODIFICAR_IFO");
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

  const handleDefinirInteresse = async (ifoId: number, interesse: boolean) => {
    try {
      await ifoApi.definirInteresseRenovacao(ifoId, interesse);
      toast.success(interesse ? "Renovação confirmada." : "IFO movido para Encerramento.");
      loadBlocos();
    } catch {
      toast.error("Erro ao registrar interesse na renovação.");
    }
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
          {ciclo && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              {ciclo.estado.replace(/_/g, " ")}
            </span>
          )}
        </div>

        {ciclo && (
          <section className="space-y-4">
            <CicloTimeline
              pernas={NOS_FORMACAO}
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
                {formacaoEstado && (
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
                    {(formacaoEstado === "consolidacao_cca" || formacaoEstado === "validacao_gejut") && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            Referência no PROAD
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          {formacaoEstado === "consolidacao_cca"
                            ? "O DFD consolidado está sendo organizado pela CCA para encaminhamento à GEJUT."
                            : "A GEJUT está analisando a conformidade jurídica do DFD consolidado."}
                        </p>
                        <CampoLinkProad
                          cicloId={ciclo.id}
                          campo="proad_gejut"
                          valorOriginal={ciclo.proadGejut}
                          estadoAtual={formacaoEstado}
                          estadoEditavel="validacao_gejut"
                          label="PROAD do Despacho GEJUT"
                          onSaved={(c) => setCiclo(c)}
                        />
                      </div>
                    )}

                    {/* Fase: Apreciação SGJT */}
                    {formacaoEstado === "apreciacao_sgjt" && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            DFD em apreciação pela SGJT
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          A SGJT aprecia o DFD validado pela GEJUT e prepara o pautamento para os comitês CGTIC e CGovTIC.
                        </p>
                        <CampoLinkProad
                          cicloId={ciclo.id}
                          campo="proad_sgjt"
                          valorOriginal={ciclo.proadSgjt}
                          estadoAtual={formacaoEstado}
                          estadoEditavel="apreciacao_sgjt"
                          label="PROAD do Despacho SGJT"
                          onSaved={(c) => setCiclo(c)}
                        />
                      </div>
                    )}

                    {/* Fase: Comitês e Autorização (CGTIC · CGovTIC · SGJT) */}
                    {formacaoEstado === "em_comites" && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            Deliberação nos Comitês e Autorização
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          Os comitês CGTIC e CGovTIC deliberam e autorizam o DFD. As atas de deliberação devem ser juntadas ao PROAD. Instrua também o produto final do DFD nesta fase.
                        </p>
                        <div className="text-xs text-slate-400 italic mb-2">
                          As atas são registradas diretamente no PROAD (ato externo ao Kaizen).
                        </div>
                        <div className="flex flex-col gap-2">
                          <CampoLinkProad
                            cicloId={ciclo.id}
                            campo="proad_ata_comites"
                            valorOriginal={ciclo.proadAtaComites}
                            estadoAtual={formacaoEstado}
                            estadoEditavel="em_comites"
                            label="PROAD da Ata dos Comitês"
                            onSaved={(c) => setCiclo(c)}
                          />
                          <CampoLinkProad
                            cicloId={ciclo.id}
                            campo="proad_produto_final"
                            valorOriginal={ciclo.proadProdutoFinal}
                            estadoAtual={formacaoEstado}
                            estadoEditavel="em_comites"
                            label="PROAD do Produto Final"
                            onSaved={(c) => setCiclo(c)}
                          />
                        </div>
                      </div>
                    )}

                    {/* Fase: Remessa à DG */}
                    {formacaoEstado === "remessa_dg" && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            Remessa à Diretoria-Geral
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          O DFD foi remetido à Diretoria-Geral. Utilize o botão "Publicar" para registrar a publicação oficial do PCA-TIC {anoFormacao}.
                        </p>
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

                    <EsteiraControls
                      ciclo={ciclo}
                      onAvancar={avancarEsteira}
                      onRetroceder={retrocederEsteira}
                      disabled={acaoEmCurso}
                      podeAvancar={podeAvancarParaConsulta}
                    />
                  </>
                )}
              </>
            )}
          </section>
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
                corBg: string
              ) => (
                <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
                  <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-semibold ${corTexto} ${corBg} px-2 py-0.5 rounded`}>
                        Bloco {numeroBloco}
                      </span>
                      <h2 className="text-base font-semibold text-slate-800">{titulo}</h2>
                    </div>
                    <span className="text-sm text-slate-500 font-medium">
                      {ifosList.length} {ifosList.length === 1 ? 'IFO' : 'IFOs'}
                    </span>
                  </div>
                  <div className="p-0">
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
                                <span className="text-sm text-slate-900 font-medium">{ifo.objeto || "-"}</span>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-slate-600">
                                <span><b className="text-slate-800">{ifo.areaDemandante || "-"}</b></span>
                                <span className="font-semibold text-slate-800">{formatCurrency(ifo.valorEstimado ? ifo.valorEstimado * 100 : 0)}</span>
                                <div className="flex items-center gap-1">
                                  {ifo.bloco === "renovacao" && !ifo.interesseRenovacaoConfirmado && podeEditarIfo ? (
                                    <div className="flex items-center gap-2 mr-2 bg-blue-50 px-2 py-1 rounded-md border border-blue-100">
                                      <span className="text-xs font-medium text-blue-800">Pretende renovar?</span>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-green-600 hover:text-green-700 hover:bg-green-100" onClick={() => handleDefinirInteresse(ifo.id, true)}>
                                        <Check className="h-4 w-4" />
                                      </Button>
                                      <Button variant="ghost" size="icon" className="h-6 w-6 text-red-600 hover:text-red-700 hover:bg-red-100" onClick={() => handleDefinirInteresse(ifo.id, false)}>
                                        <X className="h-4 w-4" />
                                      </Button>
                                    </div>
                                  ) : null}
                                  {podeVincularContratos && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => setIfoLinking(ifo)}>
                                      <LinkIcon className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {podeEditarIfo && !(ifo.bloco === "renovacao" && !ifo.interesseRenovacaoConfirmado) && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-blue-600" onClick={() => setIfoEditing(ifo)}>
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                  )}
                                  {podeDeletarIfo && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-500 hover:text-red-600" onClick={() => setIfoDeleting(ifo)}>
                                      <Trash2 className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-sm text-left">
                                <thead className="bg-white border-b text-slate-500">
                                  <tr>
                                    <th className="px-4 py-2 font-medium">Contrato</th>
                                    <th className="px-4 py-2 font-medium">Natureza</th>
                                    <th className="px-4 py-2 font-medium">Nat. despesa</th>
                                    <th className="px-4 py-2 font-medium text-right">Valor anual</th>
                                    <th className="px-4 py-2 font-medium">Vigência</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {ifo.contratos && ifo.contratos.map((contractId) => {
                                    const c = allContracts.find(ac => ac.id === contractId);
                                    if (!c) return null;
                                    return (
                                      <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-2 font-medium text-blue-600 cursor-pointer hover:underline font-mono">
                                          {c.noticeNumber ? `CT ${c.noticeNumber}` : `CT ${c.id}`}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">continuada</td>
                                        <td className="px-4 py-2 text-slate-600">{(c as any).expenseNature || "-"}</td>
                                        <td className="px-4 py-2 text-right text-slate-700 font-medium">
                                          {formatCurrency(c.totalValueCents || 0)}
                                        </td>
                                        <td className="px-4 py-2 text-slate-600">
                                          {c.endDate ? `até ${new Date(c.endDate).toLocaleDateString('pt-BR')}` : "-"}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );

              return (
                <>
                  {renderBlocoContinuado("Encerramento", 1, ifosEncerramento, "text-red-700", "bg-red-100")}
                  {renderBlocoContinuado("Renovação", 2, ifosRenovacao, "text-blue-700", "bg-blue-100")}
                  {renderBlocoContinuado("Plurianual", 3, ifosPlurianual, "text-purple-700", "bg-purple-100")}
                </>
              );
            })()}
            {/* Bloco 4: Nova Contratação */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Bloco 4
                  </span>
                  <h2 className="text-base font-semibold text-slate-800">Nova Contratação</h2>
                </div>
                <span className="text-sm text-slate-500 font-medium">
                  {ifos.length} IFOs do PCA {anoFormacao}
                </span>
              </div>
              <div className="p-0">
                {loadingBlocos ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left border-b">
                      <thead className="bg-slate-50 border-b text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-medium">IFO</th>
                          <th className="px-5 py-3 font-medium">Objeto</th>
                          <th className="px-5 py-3 font-medium text-right">Valor estimado</th>
                          <th className="px-5 py-3 font-medium">Área demandante</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {ifos.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                              Nenhum IFO cadastrado. Clique no botão abaixo para adicionar.
                            </td>
                          </tr>
                        ) : (
                          ifos.map((ifo) => (
                            <tr key={ifo.id} className="hover:bg-slate-50 transition-colors">
                              <td className="px-5 py-3 font-medium text-slate-900 font-mono text-xs">
                                {ifo.codigo}
                              </td>
                              <td className="px-5 py-3 text-slate-700">
                                {ifo.objeto}
                              </td>
                              <td className="px-5 py-3 text-right text-slate-700 font-medium">
                                {formatCurrency(ifo.valorEstimado || 0)}
                              </td>
                              <td className="px-5 py-3 text-slate-600 flex items-center justify-between">
                                <span>{ifo.areaDemandante || "-"}</span>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {podeVincularContratos && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-blue-600" onClick={() => setIfoLinking(ifo)}>
                                      <LinkIcon className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {podeEditarIfo && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-blue-600" onClick={() => setIfoEditing(ifo)}>
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                  {podeDeletarIfo && (
                                    <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-500 hover:text-red-600" onClick={() => setIfoDeleting(ifo)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="p-4 bg-slate-50/50">
                  <Button
                    variant="outline"
                    className="text-blue-600 border-blue-200 hover:bg-blue-50"
                    onClick={() => setIsNovoIfoOpen(true)}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Novo IFO
                  </Button>
                </div>
              </div>
            </div>
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

      {/* Modal de Publicação */}
      {isPublicarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                📋 Publicar PCA-TIC {anoFormacao}
              </h2>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                Confirma a publicação do PCA-TIC {anoFormacao}? O DFD será finalizado e a Versão 1 do PCA-TIC será gerada.
              </p>

              <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-lg text-sm flex gap-2 items-start mt-4">
                <span className="text-xl">⚠️</span>
                <div>
                  <strong>Atenção:</strong> Esta ação é irreversível. O PCA-TIC será versionado e congelado.
                </div>
              </div>
            </div>

            <div className="px-6 py-4 border-t bg-slate-50 flex justify-end gap-3">
              <Button variant="outline" onClick={() => setIsPublicarOpen(false)} disabled={acaoEmCurso}>
                Cancelar
              </Button>
              <Button onClick={processarAvanco} disabled={acaoEmCurso} className="bg-blue-600 hover:bg-blue-700 text-white">
                {acaoEmCurso ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Publicar
              </Button>
            </div>
          </div>
        </div>
      )}

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
    </Layout>
  );
}
