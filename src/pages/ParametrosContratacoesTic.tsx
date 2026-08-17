import { useEffect, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { VoltarCadastros } from "@/components/ui/VoltarCadastros";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  Settings2,
  Save,
  Loader2,
  CalendarDays,
  RotateCcw,
  AlertTriangle,
  ArrowLeft,
} from "lucide-react";
import {
  parametrosCicloApi,
  type FaseFormacaoParam,
  type JanelaRevisaoParam,
} from "@/services/parametrosCicloApi";
import { useNavigate } from "react-router-dom";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ============================================================
// UTILITÁRIOS
// ============================================================

const mascaraData = (valor: string) => {
  const digitos = valor.replace(/\D/g, "").slice(0, 4);
  if (digitos.length >= 3) {
    return `${digitos.slice(0, 2)}/${digitos.slice(2)}`;
  }
  return digitos;
};

// ============================================================
// VALIDAÇÕES (espelho do backend)
// ============================================================

function parseDdMm(ddmm: string): { day: number; month: number } | null {
  const m = ddmm.trim().match(/^(\d{1,2})\/(\d{1,2})$/);
  if (!m) return null;
  const day = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return { day, month };
}

function toComparable(ddmm: string): number {
  const p = parseDdMm(ddmm);
  if (!p) return -1;
  return p.month * 100 + p.day;
}

function validarFasesFormacao(fases: FaseFormacaoParam[]): string | null {
  if (!fases.length) return "Pelo menos uma fase é obrigatória.";
  for (let i = 0; i < fases.length; i++) {
    const f = fases[i];
    if (!f.fase.trim()) return `Fase ${i + 1}: nome é obrigatório.`;
    if (!f.area.trim()) return `Fase ${i + 1}: área é obrigatória.`;
    if (!parseDdMm(f.data_limite)) return `Fase ${i + 1}: data inválida (use DD/MM).`;
    if (i > 0) {
      if (toComparable(f.data_limite) < toComparable(fases[i - 1].data_limite)) {
        return `Fase ${i + 1}: a data (${f.data_limite}) deve ser posterior ou igual à fase anterior (${fases[i - 1].data_limite}).`;
      }
    }
  }
  return null;
}

function validarJanelasRevisao(janelas: JanelaRevisaoParam[]): string | null {
  if (!janelas.length) return "Pelo menos uma janela de revisão é obrigatória.";
  for (let i = 0; i < janelas.length; i++) {
    const j = janelas[i];
    if (!parseDdMm(j.janela_fim)) return `Janela ${i + 1}: data de fim inválida.`;
    if (!parseDdMm(j.rito_sgjt)) return `Janela ${i + 1}: data do rito SGJT inválida.`;
    if (!parseDdMm(j.comites)) return `Janela ${i + 1}: data de comitês inválida.`;
    if (!parseDdMm(j.remessa_dg)) return `Janela ${i + 1}: data de remessa DG inválida.`;

    if (j.janela_inicio && !parseDdMm(j.janela_inicio)) {
      return `Janela ${i + 1}: data de início inválida.`;
    }

    // Cronologia interna: fim < sgjt < comites < remessaDg
    const fim = toComparable(j.janela_fim);
    const sgjt = toComparable(j.rito_sgjt);
    const comites = toComparable(j.comites);
    const remDg = toComparable(j.remessa_dg);

    if (j.janela_inicio) {
      const ini = toComparable(j.janela_inicio);
      if (fim < ini) return `Janela ${i + 1}: fim (${j.janela_fim}) deve ser posterior ou igual ao início (${j.janela_inicio}).`;
    }
    if (sgjt < fim) return `Janela ${i + 1}: rito SGJT (${j.rito_sgjt}) deve ser posterior ou igual ao fim da janela (${j.janela_fim}).`;
    if (comites < sgjt) return `Janela ${i + 1}: comitês (${j.comites}) deve ser posterior ou igual ao rito SGJT (${j.rito_sgjt}).`;
    if (remDg < comites) return `Janela ${i + 1}: remessa DG (${j.remessa_dg}) deve ser posterior ou igual à data de comitês (${j.comites}).`;

    // Sem sobreposição com janela anterior
    if (i > 0 && j.janela_inicio) {
      const fimAnt = toComparable(janelas[i - 1].janela_fim);
      const ini = toComparable(j.janela_inicio);
      if (ini < fimAnt) {
        return `Janela ${i + 1}: início (${j.janela_inicio}) se sobrepõe ao fim da janela anterior (${janelas[i - 1].janela_fim}).`;
      }
    }
  }
  return null;
}

// ============================================================
// COMPONENTE PRINCIPAL
// ============================================================

export default function ParametrosContratacoesTic() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Dados editáveis
  const [fasesFormacao, setFasesFormacao] = useState<FaseFormacaoParam[]>([]);
  const [janelasRevisao, setJanelasRevisao] = useState<JanelaRevisaoParam[]>([]);

  // Dados originais (para reset)
  const [fasesOriginal, setFasesOriginal] = useState<FaseFormacaoParam[]>([]);
  const [janelasOriginal, setJanelasOriginal] = useState<JanelaRevisaoParam[]>([]);

  // Dirty tracking
  const [fasesModified, setFasesModified] = useState(false);
  const [janelasModified, setJanelasModified] = useState(false);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    try {
      const data = await parametrosCicloApi.getTodos();
      setFasesFormacao(data.formacao);
      setFasesOriginal(JSON.parse(JSON.stringify(data.formacao)));
      setJanelasRevisao(data.revisao);
      setJanelasOriginal(JSON.parse(JSON.stringify(data.revisao)));
      setFasesModified(false);
      setJanelasModified(false);
    } catch {
      toast.error("Erro ao carregar parâmetros do ciclo.");
    } finally {
      setLoading(false);
    }
  };

  // ==================== HANDLERS DE EDIÇÃO ====================

  const updateFase = (idx: number, field: keyof FaseFormacaoParam, value: string) => {
    setFasesFormacao((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setFasesModified(true);
  };

  const updateJanela = (idx: number, field: keyof JanelaRevisaoParam, value: string | null) => {
    setJanelasRevisao((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
    setJanelasModified(true);
  };

  // ==================== SAVE ====================

  const salvarFormacao = async () => {
    const err = validarFasesFormacao(fasesFormacao);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const saved = await parametrosCicloApi.salvarFasesFormacao(fasesFormacao);
      setFasesFormacao(saved);
      setFasesOriginal(JSON.parse(JSON.stringify(saved)));
      setFasesModified(false);
      toast.success("Fases da Formação salvas com sucesso.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar fases da Formação.");
    } finally {
      setSaving(false);
    }
  };

  const salvarRevisao = async () => {
    const err = validarJanelasRevisao(janelasRevisao);
    if (err) {
      toast.error(err);
      return;
    }
    setSaving(true);
    try {
      const saved = await parametrosCicloApi.salvarJanelasRevisao(janelasRevisao);
      setJanelasRevisao(saved);
      setJanelasOriginal(JSON.parse(JSON.stringify(saved)));
      setJanelasModified(false);
      toast.success("Janelas de Revisão salvas com sucesso.");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar janelas de Revisão.");
    } finally {
      setSaving(false);
    }
  };

  // ==================== RESET ====================

  const resetFormacao = () => {
    setFasesFormacao(JSON.parse(JSON.stringify(fasesOriginal)));
    setFasesModified(false);
  };
  const resetRevisao = () => {
    setJanelasRevisao(JSON.parse(JSON.stringify(janelasOriginal)));
    setJanelasModified(false);
  };

  // ==================== RENDER ====================

  return (
    <Layout>
      <div className="space-y-6 page-transition-enter pb-10">
        {/* Botão Voltar */}
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/cadastros/contratacoes-tic", { state: { fromCadastros: true } })}
            className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Contratações de TIC
          </Button>
        </div>

        <Breadcrumbs
          items={[
            { label: "Cadastros", to: "/cadastros" },
            { label: "Contratações de TIC", to: "/cadastros/contratacoes-tic" },
            { label: "Parâmetros" },
          ]}
        />

        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg text-white">
            <Settings2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Parâmetros
            </h1>
            <p className="text-slate-500 text-sm">
              Configurações do Ciclo Orçamentário de Contratações de TIC.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            <span className="ml-2 text-sm text-slate-500">Carregando parâmetros…</span>
          </div>
        ) : (
          <Tabs defaultValue="ciclo" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="ciclo" className="gap-1.5">
                <CalendarDays className="h-4 w-4" />
                Ciclo Orçamentário
              </TabsTrigger>
            </TabsList>

            <TabsContent value="ciclo" className="space-y-6">
              {/* CARD: Fases da Formação */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">
                      Formação do PCA
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Fases da esteira de formação e datas-limite (DD/MM).
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {fasesModified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetFormacao}
                        disabled={saving}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Desfazer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={salvarFormacao}
                      disabled={!fasesModified || saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-12">
                          #
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Fase
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                          Área / Ator
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-28">
                          Data-Limite
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {fasesFormacao.map((fase, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-2 px-3 text-slate-400 font-mono text-xs">
                            {fase.ordem}
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={fase.fase}
                              onChange={(e) =>
                                updateFase(idx, "fase", e.target.value)
                              }
                              className="h-8 text-sm border-slate-200"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={fase.area}
                              onChange={(e) =>
                                updateFase(idx, "area", e.target.value)
                              }
                              className="h-8 text-sm border-slate-200"
                            />
                          </td>
                          <td className="py-2 px-3">
                            {idx === 1 ? (
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <div>
                                      <Input
                                        value={fase.data_limite}
                                        onChange={(e) =>
                                          updateFase(idx, "data_limite", mascaraData(e.target.value))
                                        }
                                        placeholder="DD/MM"
                                        className="h-8 text-sm border-slate-200 font-mono w-20"
                                      />
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Alterar esse campo definirá a data limite da Consulta aos Demandantes</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <Input
                                value={fase.data_limite}
                                onChange={(e) =>
                                  updateFase(idx, "data_limite", mascaraData(e.target.value))
                                }
                                placeholder="DD/MM"
                                className="h-8 text-sm border-slate-200 font-mono w-20"
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* CARD: Janelas de Revisão */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-base font-semibold text-slate-800">
                      Revisão do PCA — Janelas Ordinárias
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Três janelas ordinárias com datas de início/fim e rito (DD/MM).
                    </p>
                  </div>
                  <div className="flex gap-2">
                    {janelasModified && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={resetRevisao}
                        disabled={saving}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Desfazer
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={salvarRevisao}
                      disabled={!janelasModified || saving}
                      className="bg-blue-600 hover:bg-blue-700 text-white"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      ) : (
                        <Save className="h-3.5 w-3.5 mr-1.5" />
                      )}
                      Salvar
                    </Button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                          Janela
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-16">
                          Versão
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                          Abertura (Janela)
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-32">
                          Fechamento (Janela)
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                          Rito SGJT
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                          Comitês
                        </th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-slate-500 uppercase tracking-wider w-24">
                          Remessa DG
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {janelasRevisao.map((jan, idx) => (
                        <tr
                          key={idx}
                          className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors"
                        >
                          <td className="py-2 px-3 text-slate-600 font-semibold">
                            {jan.ordem}ª
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                              V{jan.versao}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            {jan.ordem === 1 ? (
                              <span className="text-xs text-slate-400 italic">
                                (publicação)
                              </span>
                            ) : (
                              <Input
                                value={jan.janela_inicio ?? ""}
                                onChange={(e) =>
                                  updateJanela(
                                    idx,
                                    "janela_inicio",
                                    e.target.value ? mascaraData(e.target.value) : null,
                                  )
                                }
                                placeholder="DD/MM"
                                className="h-8 text-sm border-slate-200 font-mono w-20"
                              />
                            )}
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={jan.janela_fim}
                              onChange={(e) =>
                                updateJanela(idx, "janela_fim", mascaraData(e.target.value))
                              }
                              placeholder="DD/MM"
                              className="h-8 text-sm border-slate-200 font-mono w-20"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={jan.rito_sgjt}
                              onChange={(e) =>
                                updateJanela(idx, "rito_sgjt", mascaraData(e.target.value))
                              }
                              placeholder="DD/MM"
                              className="h-8 text-sm border-slate-200 font-mono w-20"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={jan.comites}
                              onChange={(e) =>
                                updateJanela(idx, "comites", mascaraData(e.target.value))
                              }
                              placeholder="DD/MM"
                              className="h-8 text-sm border-slate-200 font-mono w-20"
                            />
                          </td>
                          <td className="py-2 px-3">
                            <Input
                              value={jan.remessa_dg}
                              onChange={(e) =>
                                updateJanela(idx, "remessa_dg", mascaraData(e.target.value))
                              }
                              placeholder="DD/MM"
                              className="h-8 text-sm border-slate-200 font-mono w-20"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Aviso sobre impacto (mantido do card removido) */}
              <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                <AlertTriangle className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-700">
                  <strong>Atenção:</strong> alterações nos parâmetros afetam
                  diretamente as regras de negócio do sistema. As datas
                  controlam quando janelas de revisão abrem/fecham, quando a
                  consulta demandante é encerrada, e quando a Renovação PCA
                  deixa de ser exibida.
                </p>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </Layout>
  );
}
