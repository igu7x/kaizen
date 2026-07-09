import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Plus, ExternalLink, CheckCheck } from "lucide-react";
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
import { FaseBanner } from "@/components/ciclo/FaseBanner";
import { CampoLinkProad } from "@/components/ciclo/CampoLinkProad";

const IDX_FORMACAO: Record<string, number> = {
  aguardando_proad: 0,
  aberto_aguardando_proad: 0,
  aberto: 0,
  em_consulta: 1,
  retorno_areas: 2,
  consolidacao_cca: 2,
  validacao_gejut: 2,
  apreciacao_sgjt: 3,
  em_comites: 4,
  autorizado: 5,
  ajuste_pre_publicacao: 7,
  remessa_dg: 9,
  publicado: 10,
};

const PROXIMO_ATOR_LABELS: Record<string, string> = {
  aberto: "Encaminhar à Consulta",
  em_consulta: "Encaminhar ao Retorno das áreas",
  retorno_areas: "Encaminhar à Consolidação",
  consolidacao_cca: "Encaminhar à Validação (GEJUT)",
  validacao_gejut: "Encaminhar à Apreciação",
  apreciacao_sgjt: "Encaminhar aos Comitês",
  em_comites: "Encaminhar para Autorização",
  autorizado: "Encaminhar para Ajuste pré-publicação",
  ajuste_pre_publicacao: "Encaminhar para Remessa (DG)",
  remessa_dg: "Publicar (DG)",
};

const TAG_POR_ESTADO: Record<string, string> = {
  aberto: "PCA_ENCAMINHAR_CONSULTA",
  consolidacao_cca: "PCA_CONSOLIDAR_ENCAMINHAR_GEJUT",
  validacao_gejut: "PCA_ENCAMINHAR_SGJT",
  apreciacao_sgjt: "PCA_PAUTAR_COMITES",
  em_comites: "PCA_AUTORIZAR_COMITES",
  autorizado: "PCA_INSTRUIR_PRODUTO_FINAL",
  ajuste_pre_publicacao: "PCA_REMETER_DG",
  remessa_dg: "PCA_REGISTRAR_PUBLICACAO",
};

const TAGS_ACESSO_POR_ESTADO: Record<string, string[]> = {
  aguardando_proad: ["PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA"],
  aberto_aguardando_proad: ["PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA"],
  aberto: ["PCA_FORMACAO_ABERTURA", "PCA_REGISTRAR_PROAD", "PCA_ENCAMINHAR_CONSULTA"],
  em_consulta: ["PCA_VALIDAR_DEMANDA_1_CAMADA", "PCA_VALIDAR_DEMANDA_2_CAMADA", "PCA_REMETER_PARTICAO"],
  retorno_areas: ["PCA_CONSOLIDAR_ENCAMINHAR_GEJUT"],
  consolidacao_cca: ["PCA_CONSOLIDAR_ENCAMINHAR_GEJUT"],
  validacao_gejut: ["PCA_ENCAMINHAR_SGJT"],
  apreciacao_sgjt: ["PCA_PAUTAR_COMITES"],
  em_comites: ["PCA_AUTORIZAR_COMITES"],
  autorizado: ["PCA_INSTRUIR_PRODUTO_FINAL"],
  ajuste_pre_publicacao: ["PCA_REMETER_DG"],
  remessa_dg: ["PCA_REGISTRAR_PUBLICACAO"],
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
  const [ifosRenovacao, setIfosRenovacao] = useState<Ifo[]>([]);
  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [ifos, setIfos] = useState<Ifo[]>([]);
  const [loadingBlocos, setLoadingBlocos] = useState(false);
  const [isNovoIfoOpen, setIsNovoIfoOpen] = useState(false);
  
  // Publicação DG
  const [isPublicarOpen, setIsPublicarOpen] = useState(false);
  const [dataPublicacao, setDataPublicacao] = useState("");

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
      // Se o ciclo está na fase de "em_consulta", restringimos a visibilidade
      const isEmConsulta = ciclo.estado === "em_consulta";

      const fetchedContracts = await contractsApi.getContracts({
        minhasDemandas: isEmConsulta ? true : undefined
      });
      setAllContracts(fetchedContracts);

      const ifosData = await ifoApi.listar(anoFormacao, ciclo.id, isEmConsulta ? true : undefined);
      
      const emRenovacao = ifosData.filter((i) => i.bloco === "renovacao");
      setIfosRenovacao(emRenovacao);

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

  const isGestorCCA = (user as any)?.is_superadmin || (user?.role === "MANAGER" && user?.unidade_nome === "Coordenadoria de Contratações e Orçamento de TIC");
  const podeAvancarParaConsulta = formacaoEstado !== "aberto" || isGestorCCA;

  const temAcessoFaseAtual = useMemo(() => {
    if (!formacaoEstado) return false;
    if (formacaoEstado === "publicado") return true;
    if ((user as any)?.is_superadmin) return true;
    
    const tagsPermitidas = TAGS_ACESSO_POR_ESTADO[formacaoEstado] || [];
    return tagsPermitidas.some(tag => user?.tags_acesso?.includes(tag));
  }, [formacaoEstado, user]);

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

                    {/* Fase: Comitês (CGTIC · CGovTIC) */}
                    {formacaoEstado === "em_comites" && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            Deliberação nos Comitês
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-3">
                          As atas de deliberação dos comitês CGTIC e CGovTIC devem ser juntadas ao PROAD.
                        </p>
                        <div className="text-xs text-slate-400 italic mb-2">
                          As atas são registradas diretamente no PROAD (ato externo ao Kaizen).
                        </div>
                        <CampoLinkProad
                          cicloId={ciclo.id}
                          campo="proad_ata_comites"
                          valorOriginal={ciclo.proadAtaComites}
                          estadoAtual={formacaoEstado}
                          estadoEditavel="em_comites"
                          label="PROAD da Ata dos Comitês"
                          onSaved={(c) => setCiclo(c)}
                        />
                      </div>
                    )}

                    {/* Fase: Autorizado / Ajuste pré-publicação (Remessa V1) */}
                    {(formacaoEstado === "autorizado" || formacaoEstado === "ajuste_pre_publicacao") && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            {formacaoEstado === "autorizado" ? "Produto final do DFD" : "Ajuste pré-publicação"}
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          {formacaoEstado === "autorizado"
                            ? "O DFD foi autorizado pelos comitês. Instrua o produto final no PROAD e encaminhe para ajuste pré-publicação."
                            : "Realize os ajustes finais no PROAD antes da remessa à Diretoria-Geral."}
                        </p>
                        <CampoLinkProad
                          cicloId={ciclo.id}
                          campo="proad_produto_final"
                          valorOriginal={ciclo.proadProdutoFinal}
                          estadoAtual={formacaoEstado}
                          estadoEditavel="autorizado"
                          label="PROAD do Produto Final"
                          onSaved={(c) => setCiclo(c)}
                        />
                      </div>
                    )}

                    {/* Fase: Remessa DG */}
                    {formacaoEstado === "remessa_dg" && ciclo.proad && (
                      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold text-slate-800">
                            Publicação no DOU
                          </h3>
                        </div>
                        <p className="text-xs text-slate-500 mb-2">
                          A publicação foi realizada no PROAD pela Diretoria-Geral. Informe os links abaixo antes de registrar a publicação.
                        </p>
                        <div className="flex flex-col gap-2">
                          <CampoLinkProad
                            cicloId={ciclo.id}
                            campo="proad_publicacao"
                            valorOriginal={ciclo.proadPublicacao}
                            estadoAtual={formacaoEstado}
                            estadoEditavel="remessa_dg"
                            label="PROAD da Publicação"
                            onSaved={setCiclo}
                          />
                          <CampoLinkProad
                            cicloId={ciclo.id}
                            campo="link_dou"
                            valorOriginal={ciclo.linkDou}
                            estadoAtual={formacaoEstado}
                            estadoEditavel="remessa_dg"
                            label="Link DOU"
                            onSaved={setCiclo}
                          />
                        </div>
                      </div>
                    )}

                    {/* Fase: Publicado — resumo final */}
                    {formacaoEstado === "publicado" && (
                      <div className="rounded-xl border border-green-200 bg-green-50/50 p-6 shadow-sm text-center flex flex-col items-center">
                        <CheckCheck className="h-10 w-10 text-green-500 mb-3" />
                        <h3 className="text-lg font-semibold text-slate-800 mb-1">
                          PCA-TIC {anoFormacao} — Versão 1 publicada
                        </h3>
                        <p className="text-sm text-slate-600 mb-4 max-w-md">
                          O Documento de Formalização da Demanda foi concluído e o PCA-TIC foi publicado. A versão está congelada.
                        </p>
                        <div className="flex flex-col gap-2 items-center text-left w-full max-w-sm bg-white p-4 rounded-lg border border-green-100">
                          <CampoLinkProad
                            cicloId={ciclo.id}
                            campo="proad_publicacao"
                            valorOriginal={ciclo.proadPublicacao}
                            estadoAtual={formacaoEstado}
                            estadoEditavel="NONE"
                            label="PROAD da Publicação"
                            onSaved={(c) => setCiclo(c)}
                          />
                          <CampoLinkProad
                            cicloId={ciclo.id}
                            campo="link_dou"
                            valorOriginal={ciclo.linkDou}
                            estadoAtual={formacaoEstado}
                            estadoEditavel="NONE"
                            label="Link DOU"
                            onSaved={(c) => setCiclo(c)}
                          />
                        </div>
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
            {/* Bloco 1: Renovação */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                    Bloco 1
                  </span>
                  <h2 className="text-base font-semibold text-slate-800">Renovação</h2>
                </div>
                <span className="text-sm text-slate-500 font-medium">
                  {ifosRenovacao.length} {ifosRenovacao.length === 1 ? 'IFO' : 'IFOs'}
                </span>
              </div>
              <div className="p-0">
                {loadingBlocos ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : ifosRenovacao.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Nenhum IFO de renovação encontrado para {anoFormacao}.
                  </div>
                ) : (
                  <div className="p-4 space-y-6">
                    {ifosRenovacao.map((ifo) => (
                      <div key={ifo.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        {/* IFO Header */}
                        <div className="bg-slate-50 border-b border-slate-200 px-4 py-3 flex flex-wrap justify-between items-center gap-4">
                          <div className="flex flex-col">
                            <span className="font-mono text-sm font-semibold text-slate-700">{ifo.codigo}</span>
                            <span className="text-sm text-slate-900 font-medium">{ifo.objeto || "-"}</span>
                          </div>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>área <b className="text-slate-800">{ifo.areaDemandante || "-"}</b></span>
                            <span className="font-semibold text-slate-800">{formatCurrency(ifo.valorEstimado ? ifo.valorEstimado * 100 : 0)}</span>
                          </div>
                        </div>
                        {/* Contratos Table */}
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
                                    <td className="px-4 py-2 text-slate-600">
                                      continuada
                                    </td>
                                    <td className="px-4 py-2 text-slate-600">
                                      {(c as any).expenseNature || "-"}
                                    </td>
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

            {/* Bloco 2: Nova Contratação */}
            <div className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
              <div className="flex items-center justify-between border-b bg-slate-50 px-5 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                    Bloco 2
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
                              <td className="px-5 py-3 text-slate-600">
                                {ifo.areaDemandante || "-"}
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

      {/* Modal de Publicação DG */}
      {isPublicarOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b bg-slate-50 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                📋 Registrar Publicação (DG)
              </h2>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-sm text-slate-600">
                A publicação foi realizada no PROAD pela Diretoria-Geral. 
                Confirma a publicação do PCA-TIC {anoFormacao}?
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
              <Button onClick={processarAvanco} disabled={acaoEmCurso || !proadPublicacao || !dataPublicacao} className="bg-blue-600 hover:bg-blue-700 text-white">
                {acaoEmCurso ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Registrar Publicação
              </Button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
