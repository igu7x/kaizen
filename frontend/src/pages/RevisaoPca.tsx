import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import {
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CalendarClock,
  FileDown,
  Check,
  X,
  FileText,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { CicloTimeline } from "@/components/contratacoes/ciclo/CicloTimeline";
import { RevisaoItens } from "@/components/contratacoes/ciclo/RevisaoItens";
import { nosRevisao, rotuloVersao } from "@/components/contratacoes/ciclo/cicloConstants";
import {
  cicloOrcamentarioApi,
  resolverJanelaRevisao,
  type Ciclo,
} from "@/services/cicloOrcamentarioApi";
import { getPcaComparison, getPcaVersoesInfo } from "@/services/pcaApi";
import { generateRevisaoPcaPDF } from "@/utils/generateRevisaoPcaPDF";
import { AtasComitesPanel } from "@/components/contratacoes/ciclo/AtasComitesPanel";
import { EditoresPanel } from "@/components/contratacoes/ciclo/EditoresPanel";

const IDX_REVISAO: Record<string, number> = {
  em_consulta_1: 0,
  em_consulta_2: 0,
  consolidacao_cca: 1,
  validacao_gejut: 1,
  em_comites: 2,
  remessa_dg: 3,
  publicado: 3,
};

const ESTADO_LABEL: Record<string, string> = {
  em_consulta_1: "1ª Validação Demandante",
  em_consulta_2: "2ª Validação Demandante",
  consolidacao_cca: "Consolidação CCA",
  validacao_gejut: "Validação GEJUT",
  em_comites: "Em comitês",
  remessa_dg: "Remessa à DG",
  publicado: "Publicado",
};

function estadoLabel(e?: string | null): string {
  return e ? ESTADO_LABEL[e] ?? e : "";
}

const ATOR_ESTADO: Record<string, string> = {
  em_consulta_1: "Demandantes (1ª Validação)",
  em_consulta_2: "Demandantes (2ª Validação)",
  consolidacao_cca: "CCA",
  validacao_gejut: "GEJUT",
  em_comites: "Comitês",
  remessa_dg: "DG",
  publicado: "—",
};

const TAG_POR_ESTADO: Record<string, string> = {
  em_consulta_1: "PCA_RN_VALIDAR_DEMANDA_1_CAMADA",
  em_consulta_2: "PCA_RN_VALIDAR_DEMANDA_2_CAMADA",
  consolidacao_cca: "PCA_RN_CONSOLIDAR_ENCAMINHAR_GEJUT",
  validacao_gejut: "PCA_RN_PAUTAR_COMITES",
  em_comites: "PCA_RN_AUTORIZAR_COMITES",
  remessa_dg: "PCA_RN_REMETER_DG",
};

const TAGS_ACESSO_POR_ESTADO: Record<string, string[]> = {
  em_consulta_1: ["PCA_RN_VALIDAR_DEMANDA_1_CAMADA", "PCA_RN_VALIDAR_DEMANDA_2_CAMADA", "PCA_RN_MODIFICAR_ITEM"],
  em_consulta_2: ["PCA_RN_VALIDAR_DEMANDA_1_CAMADA", "PCA_RN_VALIDAR_DEMANDA_2_CAMADA", "PCA_RN_MODIFICAR_ITEM"],
  consolidacao_cca: ["PCA_RN_CONSOLIDAR_ENCAMINHAR_GEJUT", "PCA_RN_MODIFICAR_ITEM"],
  validacao_gejut: ["PCA_RN_PAUTAR_COMITES", "PCA_RN_MODIFICAR_ITEM"],
  em_comites: ["PCA_RN_AUTORIZAR_COMITES", "PCA_RN_MODIFICAR_ITEM"],
  remessa_dg: ["PCA_RN_REMETER_DG", "PCA_RN_MODIFICAR_ITEM"],
  publicado: [],
};

const PROXIMO_ATOR_LABELS: Record<string, string> = {
  em_consulta_1: "Encaminhar à 2ª Validação",
  em_consulta_2: "Enviar à Consolidação",
  consolidacao_cca: "Encaminhar à Validação (GEJUT)",
  validacao_gejut: "Encaminhar aos Comitês",
  em_comites: "Encaminhar para Remessa à DG",
};

const RETORNAR_LABELS: Record<string, string> = {
  em_consulta_1: "Retornar",
  em_consulta_2: "Retornar à 1ª Validação",
  consolidacao_cca: "Retornar à 2ª Validação",
  validacao_gejut: "Retornar à Consolidação",
  em_comites: "Retornar à Validação (GEJUT)",
  remessa_dg: "Retornar aos Comitês",
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
  disabled: boolean;
  podeAvancar?: boolean;
}) {
  const { user } = useAuth();
  const tags = user?.tags_acesso ?? [];
  const isSuperadmin = (user as any)?.is_superadmin;

  const tagNecessaria = TAG_POR_ESTADO[ciclo.estado];
  const temPermissaoDeTag = isSuperadmin || !tagNecessaria || tags.includes(tagNecessaria);
  const podeAvancarFinal = podeAvancar && temPermissaoDeTag;
  if (ciclo.estado === "publicado") {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 mt-4">
        Ciclo publicado — versão gravada no PCA-TIC.
      </div>
    );
  }
  const proximaPublicacao = ciclo.estado === "remessa_dg";
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 mt-4">
      <span className="text-xs text-slate-500">
        Aguardando: <b className="text-slate-700">{ATOR_ESTADO[ciclo.estado] ?? "—"}</b>
      </span>
      <div className="ml-auto flex gap-2">
        <Button variant="outline" size="sm" onClick={onRetroceder} disabled={disabled}>
          <ArrowLeft className="h-4 w-4 mr-1.5" />
          {RETORNAR_LABELS[ciclo.estado] || "Retornar"}
        </Button>
        {podeAvancarFinal && (
          <Button
            size="sm"
            onClick={onAvancar}
            disabled={disabled}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <ArrowRight className="h-4 w-4 mr-1.5" />
            {proximaPublicacao ? "Publicar (DG)" : (PROXIMO_ATOR_LABELS[ciclo.estado] || "Encaminhar ao próximo ator")}
          </Button>
        )}
      </div>
    </div>
  );
}

export default function RevisaoPca() {
  const hoje = useMemo(() => new Date(), []);
  const anoVigente = hoje.getFullYear();
  const janela = useMemo(
    () => resolverJanelaRevisao(hoje, anoVigente),
    [hoje, anoVigente],
  );

  const [ciclo, setCiclo] = useState<Ciclo | null>(null);
  const [acaoEmCurso, setAcaoEmCurso] = useState(false);
  const [loading, setLoading] = useState(true);

  const { user } = useAuth();
  const [validacaoComites, setValidacaoComites] = useState<"V" | "X" | null>(null);
  const [validacaoDg, setValidacaoDg] = useState<"V" | "X" | null>(null);
  const [dfdBaixado, setDfdBaixado] = useState(false);

  const tags = user?.tags_acesso ?? [];
  const isSuperadmin = (user as any)?.is_superadmin;
  const temModificacaoEspecial = tags.includes("PCA_RN_MODIFICACAO_ESPECIAL") || tags.includes("PCA_RN_MODIFICACAO_CCA");
  
  const podeEditarItem = isSuperadmin || tags.includes("PCA_RN_MODIFICAR_ITEM") || temModificacaoEspecial;
  const podeAdicionar = isSuperadmin || ((ciclo?.estado === "em_consulta_1" || ciclo?.estado === "em_consulta_2") && podeEditarItem);

  const temAcessoFaseAtual = useMemo(() => {
    if (!ciclo?.estado) return false;
    if (ciclo.estado === "publicado") return true;
    if ((user as any)?.is_superadmin) return true;

    const tagsPermitidas = TAGS_ACESSO_POR_ESTADO[ciclo.estado] || [];
    return tagsPermitidas.some(tag => tags.includes(tag));
  }, [ciclo?.estado, tags]);

  useEffect(() => {
    let cancelled = false;
    if (!janela.ativa) {
      setLoading(false);
      return;
    }

    setLoading(true);
    cicloOrcamentarioApi
      .getOuAbrirRevisao(anoVigente)
      .then((c) => {
        if (!cancelled) {
          setCiclo(c);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [anoVigente, janela.ativa]);

  const avancarEsteira = async () => {
    if (!ciclo) return;
    setAcaoEmCurso(true);
    try {
      const c = await cicloOrcamentarioApi.avancar(ciclo.id);
      setCiclo(c);
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

  const gerarRevisaoPdf = async () => {
    if (!ciclo) return;
    try {
      const versoes = await getPcaVersoesInfo(anoVigente).catch(() => []);
      const ultima = versoes.length ? Math.max(...versoes.map((v) => v.versao)) : undefined;
      const cmp = await getPcaComparison(anoVigente, undefined, ultima);
      generateRevisaoPcaPDF({
        ano: anoVigente,
        versao: ciclo.versaoGerada ?? janela.calendario.versao,
        proad: ciclo.proad,
        incluidos: cmp.incluidos,
        alterados: cmp.alterados,
        excluidos: cmp.excluidos,
      });
    } catch {
      toast.error("Não foi possível gerar a Proposta de Revisão.");
    }
  };

  return (
    <Layout>
      <div className="space-y-6 page-transition-enter">
        <Breadcrumbs
          items={[
            { label: "Contratações de TIC", to: "/pca" },
            { label: "Ciclo Orçamentário", to: "/ciclo-orcamentario" },
            { label: "Revisão PCA" },
          ]}
        />

        <div className="flex items-center gap-3">
          <div className="p-2 bg-emerald-600 rounded-lg text-white">
            <RefreshCw className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Revisão PCA – {anoVigente}
            </h1>
            <p className="text-gray-500 text-sm">
              Revisão do plano vigente. Três janelas ordinárias ao ano; cada publicação gera a próxima versão.
            </p>
          </div>
        </div>

        <section className="space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap border-b pb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">
              {janela.ativa
                ? `Rito da ${janela.calendario.ordem}ª revisão · gera ${rotuloVersao(janela.calendario.versao)}`
                : "Revisão · nenhuma janela aberta"}
            </h2>
            <div className="flex items-center gap-2">
              {ciclo && (
                <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                  {estadoLabel(ciclo.estado)}
                </span>
              )}
              {ciclo && (
                <Button variant="outline" size="sm" onClick={gerarRevisaoPdf}>
                  <FileDown className="h-4 w-4 mr-1.5" />
                  Proposta de Revisão
                </Button>
              )}
            </div>
          </div>

          {janela.ativa ? (
            <>
              {loading ? (
                <div className="text-sm text-slate-500 py-8 text-center">Carregando rito...</div>
              ) : (
                <>
                  <CicloTimeline
                    pernas={nosRevisao(janela.calendario)}
                    activeIndex={ciclo ? IDX_REVISAO[ciclo.estado] ?? 0 : 0}
                  />
                  <p className="text-xs text-slate-400">
                    Rito ágil: dias 07 → 15 → 20 do mês de apuração (RF-70/RF-78).
                  </p>

                  {ciclo && !temAcessoFaseAtual ? (
                    <div className="mt-8 rounded-xl border border-amber-100 bg-amber-50/50 p-6 shadow-sm text-center">
                      <h3 className="text-base font-semibold text-slate-800 mb-2">
                        Acesso Restrito
                      </h3>
                      <p className="text-sm text-slate-600">
                        A fase atual da Revisão do PCA é de visualização restrita aos atores responsáveis. Você pode acompanhar o andamento pelo fluxo acima, mas os detalhes desta fase não estão disponíveis.
                      </p>
                    </div>
                  ) : ciclo && (
                    <>
                      {ciclo.estado === "em_comites" ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mt-4">
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="text-sm font-semibold text-slate-800">
                              Proposta de Revisão
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

                          <AtasComitesPanel cicloId={ciclo.id} />
                          {validacaoComites && (
                            <div className="flex items-center gap-4 py-2 border-t mt-4">
                              <span className="text-sm font-medium text-slate-700">
                                Próxima ação:
                              </span>
                              <div className="ml-auto flex gap-2">
                                {validacaoComites === 'X' && (
                                  <Button variant="outline" size="sm" onClick={retrocederEsteira} disabled={acaoEmCurso}>
                                    <ArrowLeft className="h-4 w-4 mr-1.5" />
                                    Retornar à Consolidação
                                  </Button>
                                )}

                                {validacaoComites === 'V' && (
                                  <Button
                                    size="sm"
                                    onClick={avancarEsteira}
                                    disabled={acaoEmCurso}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                                  >
                                    <ArrowRight className="h-4 w-4 mr-1.5" />
                                    Encaminhar à DG
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : ciclo.estado === "remessa_dg" ? (
                        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm mt-4">
                          <h3 className="text-sm font-semibold text-slate-800 mb-4">
                            Validação da Diretoria-Geral
                          </h3>
                          <div className="space-y-4">
                            {validacaoDg !== 'V' && (
                              <div>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    gerarRevisaoPdf();
                                    setDfdBaixado(true);
                                    setValidacaoDg(null);
                                  }}
                                >
                                  <FileText className="h-4 w-4 mr-1.5" />
                                  Baixar Proposta de Revisão
                                </Button>
                              </div>
                            )}

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
                                {validacaoDg === 'X' && (
                                  <div className="ml-auto">
                                    <Button variant="outline" size="sm" onClick={retrocederEsteira} disabled={acaoEmCurso}>
                                      <ArrowLeft className="h-4 w-4 mr-1.5" />
                                      Retornar aos Comitês
                                    </Button>
                                  </div>
                                )}
                                {validacaoDg === 'V' && (
                                  <div className="ml-auto">
                                    <Button
                                      size="sm"
                                      onClick={avancarEsteira}
                                      disabled={acaoEmCurso}
                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                    >
                                      Gerar novo PCA
                                    </Button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      ) : (
                        <EsteiraControls
                          ciclo={ciclo}
                          onAvancar={avancarEsteira}
                          onRetroceder={retrocederEsteira}
                          disabled={acaoEmCurso}
                        />
                      )}

                      <div className="pt-4">
                        <RevisaoItens
                          anoVigente={anoVigente}
                          podeEditarItem={podeEditarItem}
                          podeAdicionar={podeAdicionar}
                          estadoCiclo={ciclo.estado}
                        />
                      </div>
                    </>
                  )}
                </>
              )}
            </>
          ) : (
            <div className="rounded-xl border border-slate-200 bg-white">
              <div className="flex flex-col items-center justify-center text-center px-6 py-12">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
                  <CalendarClock className="h-6 w-6" />
                </div>
                <h3 className="text-base font-semibold text-slate-800">
                  A próxima janela de revisão abre em{" "}
                  {janela.proximaAberturaEm ?? "—"}
                </h3>
                <p className="mt-1 max-w-md text-sm text-slate-500">
                  Fora das janelas, os itens permanecem como na versão vigente do PCA-TIC. 
                  Cronograma das ordinárias: 1ª · pub→31/01 (V2) · 2ª · 01–30/04 (V3) · 3ª · 01–31/07 (V4).
                </p>
              </div>
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}
