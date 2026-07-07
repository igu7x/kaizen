import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Loader2, CheckCircle2, Plus } from "lucide-react";
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
        <Button
          size="sm"
          onClick={onAvancar}
          disabled={disabled || !podeAvancar}
          className="bg-blue-600 hover:bg-blue-700 text-white"
        >
          <ArrowRight className="h-4 w-4 mr-1.5" />
          {labelBotaoAvancar}
        </Button>
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
  const [contratosRenovacao, setContratosRenovacao] = useState<Contract[]>([]);
  const [ifos, setIfos] = useState<Ifo[]>([]);
  const [loadingBlocos, setLoadingBlocos] = useState(false);
  const [isNovoIfoOpen, setIsNovoIfoOpen] = useState(false);

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

      // Bloco 1: Renovação (contratos com limite de vigência >= anoAtual + 1)
      const allContracts = await contractsApi.getContracts({
        minhasDemandas: isEmConsulta ? true : undefined
      });
      const emRenovacao = allContracts.filter((c) => {
        if (!c.endDate) return false;
        const year = new Date(c.endDate).getFullYear();
        return year >= anoFormacao;
      });
      setContratosRenovacao(emRenovacao);

      // Bloco 2: Nova Contratação (IFOs criados para esta formação)
      const ifosData = await ifoApi.listar(anoFormacao, ciclo.id, isEmConsulta ? true : undefined);
      // Filtramos apenas os de nova_contratacao para o Bloco 2
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

  const formacaoEstado = ciclo?.finalidade === "formacao" ? ciclo.estado : null;
  const aguardandoProad = (formacaoEstado === "aguardando_proad" || formacaoEstado === "aberto_aguardando_proad") && !ciclo?.proad;

  const isGestorCCA = (user as any)?.is_superadmin || (user?.role === "MANAGER" && user?.unidade_nome === "Coordenadoria de Contratações e Orçamento de TIC");
  const podeAvancarParaConsulta = formacaoEstado !== "aberto" || isGestorCCA;

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
              Formação PCA – {anoFormacao}
            </h1>
            <p className="text-slate-500 mt-1">
              CCA · gera PCA-TIC {anoFormacao} · Versão 1
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

            {aguardandoProad && (
              <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-6 shadow-sm">
                <h3 className="text-base font-semibold text-slate-800 mb-2">
                  Instruir o ciclo
                </h3>
                <p className="text-sm text-slate-600 mb-4 max-w-2xl">
                  A formação de {anoFormacao} já está aberta. Informe o PROAD de instrução
                  para carregar os quatro blocos do Documento de Formalização da Demanda (DFD).
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

            {!aguardandoProad && (
              <EsteiraControls
                ciclo={ciclo}
                onAvancar={avancarEsteira}
                onRetroceder={retrocederEsteira}
                disabled={acaoEmCurso}
                podeAvancar={podeAvancarParaConsulta}
              />
            )}
          </section>
        )}

        {/* Blocos só aparecem se já tiver PROAD instruído (ou seja, se a consulta foi liberada) */}
        {ciclo && ciclo.proad && (
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
                  {contratosRenovacao.length} Contratos
                </span>
              </div>
              <div className="p-0">
                {loadingBlocos ? (
                  <div className="p-8 flex justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
                  </div>
                ) : contratosRenovacao.length === 0 ? (
                  <div className="p-8 text-center text-sm text-slate-500">
                    Nenhum contrato em renovação encontrado para {anoFormacao}.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="bg-slate-50 border-b text-slate-500">
                        <tr>
                          <th className="px-5 py-3 font-medium">Contrato</th>
                          <th className="px-5 py-3 font-medium">Natureza</th>
                          <th className="px-5 py-3 font-medium">Nat. despesa</th>
                          <th className="px-5 py-3 font-medium text-right">Valor anual</th>
                          <th className="px-5 py-3 font-medium">Vigência</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {contratosRenovacao.map((c) => (
                          <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                            <td className="px-5 py-3 font-medium text-slate-900">
                              {c.noticeNumber || "-"}
                            </td>
                            <td className="px-5 py-3 text-slate-600">
                              continuada
                            </td>
                            <td className="px-5 py-3 text-slate-600">
                              {(c as any).expenseNature || "-"}
                            </td>
                            <td className="px-5 py-3 text-right text-slate-700 font-medium">
                              {formatCurrency(c.totalValueCents || 0)}
                            </td>
                            <td className="px-5 py-3 text-slate-600">
                              {c.endDate ? `até ${new Date(c.endDate).toLocaleDateString('pt-BR')}` : "-"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
    </Layout>
  );
}
