import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, ArrowLeft, Plus, Trash2, Save, Target, Edit, Info, Printer } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";

interface AcaoMitigacao {
  melhoria: string;
  responsavel: string;
  previsao_inicio: string;
  previsao_fim: string;
  comunicar: string;
  frequencia: string;
}

interface Risco {
  evento: string;
  causas: string[];
  consequencias: string[];
  probabilidade: number;
  impacto: number;
  controles: string[];
  nivel_controle: number;
  resposta: string;
  acao?: AcaoMitigacao;
}

interface AvaliacaoData {
  titulo: string;
  objetivos: string[];
  riscos: Risco[];
  equipe?: number[];
}

interface UserSummary {
  id: number;
  name: string;
  matricula: string;
}

const probMap: Record<number, string> = { 2: "MUITO BAIXA", 4: "BAIXA", 6: "MÉDIA", 8: "ALTA", 10: "MUITO ALTA" };
const impactoMap: Record<number, string> = { 2: "INSIGNIFICANTE", 4: "POUCO RELEVANTE", 6: "RELEVANTE", 8: "MUITO RELEVANTE", 10: "EXTREMO" };
const controleMap: Record<number, string> = { 100: "INEXISTENTE", 80: "FRACO", 60: "MEDIANO", 40: "SATISFATÓRIO", 20: "FORTE" };

const freqOptions = ["Ad Hoc", "Diária", "Semanal", "Quinzenal", "Mensal", "Bimestral", "Semestral", "Anual", "Bienal"];

const formatDateForInput = (dateStr?: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("/");
  if (parts.length === 3) return `${parts[2]}-${parts[1]}-${parts[0]}`;
  return dateStr;
};

const formatDateForState = (dateStr: string) => {
  if (!dateStr) return "";
  const parts = dateStr.split("-");
  if (parts.length === 3) return `${parts[2]}/${parts[1]}/${parts[0]}`;
  return dateStr;
};

export default function RiscosContratacoesDetalhe() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasPermission = user?.is_superadmin || (user?.tags_acesso && user.tags_acesso.includes("PC_AR_CRUD"));

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const [isEditContextMode, setIsEditContextMode] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [data, setData] = useState<AvaliacaoData | null>(null);
  const [originalData, setOriginalData] = useState<AvaliacaoData | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [allUsers, setAllUsers] = useState<UserSummary[]>([]);
  const [equipeSearch, setEquipeSearch] = useState("");
  const [showEquipeDropdown, setShowEquipeDropdown] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);

  useEffect(() => {
    fetchUsers();
    if (id === "novo") {
      const newAssessment: AvaliacaoData = {
        titulo: "Nova Avaliação de Riscos",
        objetivos: [""],
        riscos: [],
        equipe: []
      };
      setData(newAssessment);
      setOriginalData(newAssessment);
      setIsEditMode(true);
      setIsEditContextMode(true);
      setIsLoading(false);
    } else {
      fetchAssessment();
    }
  }, [id]);

  const fetchUsers = async () => {
    try {
      const data: any = await apiClient.get("/api/users");
      setAllUsers(data || []);
    } catch (e) {
      console.error("Error fetching users");
    }
  };

  const fetchAssessment = async () => {
    try {
      const response: any = await apiClient.get(`/api/contract-risk-assessment/${id}`);
      setMetadata(response);
      if (response.body) {
        const parsed = JSON.parse(response.body);
        parsed.objetivos = parsed.objetivos || [];
        parsed.equipe = parsed.equipe || [];
        parsed.riscos = parsed.riscos?.map((r: any) => ({
          ...r,
          causas: r.causas || [],
          consequencias: r.consequencias || [],
          controles: r.controles || [],
          resposta: r.resposta || ""
        })) || [];
        setData(parsed);
        setOriginalData(parsed);
      } else {
        toast.error("JSON de avaliação não encontrado.");
      }
    } catch (error) {
      toast.error("Avaliação não encontrada ou erro de conexão.");
      navigate("/planejamento-contratacao/riscos-contratacoes");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!data) return;
    setIsSaving(true);
    try {
      const cleanedData = {
        ...data,
        riscos: data.riscos.map(r => {
          if (r.resposta !== "MITIGAR/MELHORAR") {
            const { acao, ...rest } = r;
            return rest;
          }
          return r;
        })
      };

      if (id === "novo") {
        const response: any = await apiClient.post(`/api/contract-risk-assessment`, cleanedData);
        toast.success("Avaliação salva com sucesso!");
        navigate(`/planejamento-contratacao/riscos-contratacoes/${response.id}`, { replace: true });
        return;
      }

      await apiClient.put(`/api/contract-risk-assessment/${id}`, cleanedData);
      toast.success("Alterações salvas com sucesso!");
      setData(cleanedData);
      setOriginalData(cleanedData);
      setMetadata({ ...metadata, validatedAt: null, validatedById: null });
      setIsEditMode(false);
      setIsEditContextMode(false);
    } catch (error) {
      toast.error("Erro ao salvar alterações no servidor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidate = async () => {
    setIsValidating(true);
    try {
      await apiClient.post(`/api/contract-risk-assessment/${id}/validate`, {});
      toast.success("Avaliação validada com sucesso!");
      fetchAssessment();
    } catch (e) {
      toast.error("Erro ao validar avaliação.");
    } finally {
      setIsValidating(false);
    }
  };

  const handleRecover = async () => {
    setIsRecovering(true);
    try {
      await apiClient.post(`/api/contract-risk-assessment/${id}/recover-validation`, {});
      toast.success("Versão validada recuperada com sucesso!");
      fetchAssessment();
    } catch (e) {
      toast.error("Erro ao recuperar versão validada.");
    } finally {
      setIsRecovering(false);
    }
  };

  const handleCancel = () => {
    setData(originalData);
    setIsEditMode(false);
  };

  const handleCancelContext = () => {
    setData(originalData);
    setIsEditContextMode(false);
    setIsEditMode(false);
  };

  const updateData = (newData: AvaliacaoData) => {
    setData(newData);
  };

  const handleExportPDF = () => {
    const style = document.createElement('style');
    style.innerHTML = `
      @media print {
        body * {
          visibility: hidden;
        }
        #pdf-content-wrapper, #pdf-content-wrapper * {
          visibility: visible;
        }
        #pdf-content-wrapper {
          position: absolute;
          left: 0;
          top: 0;
          width: 100%;
          margin: 0;
          padding: 0;
        }
        .export-hide {
          display: none !important;
        }
        @page {
          margin: 10mm;
        }
      }
    `;
    document.head.appendChild(style);
    
    // Pequeno atraso para garantir que o CSS seja aplicado
    setTimeout(() => {
      window.print();
      document.head.removeChild(style);
    }, 100);
  };

  const handleRiscoChange = (index: number, field: keyof Risco, value: any) => {
    if (!data) return;
    const newRiscos = [...data.riscos];
    newRiscos[index] = { ...newRiscos[index], [field]: value };
    updateData({ ...data, riscos: newRiscos });
  };

  const handleAcaoChange = (index: number, field: keyof AcaoMitigacao, value: string) => {
    if (!data) return;
    const newRiscos = [...data.riscos];
    const acaoAtual = newRiscos[index].acao || { melhoria: "", responsavel: "", previsao_inicio: "", previsao_fim: "", comunicar: "", frequencia: "" };
    newRiscos[index] = { ...newRiscos[index], acao: { ...acaoAtual, [field]: value } };
    updateData({ ...data, riscos: newRiscos });
  };

  const handleArrayChange = (rIndex: number, field: "causas" | "consequencias" | "controles", itemIndex: number, value: string) => {
    if (!data) return;
    const newRiscos = [...data.riscos];
    const newArray = [...newRiscos[rIndex][field]];
    newArray[itemIndex] = value;
    newRiscos[rIndex] = { ...newRiscos[rIndex], [field]: newArray };
    updateData({ ...data, riscos: newRiscos });
  };

  const addItemToArray = (rIndex: number, field: "causas" | "consequencias" | "controles") => {
    if (!data) return;
    const newRiscos = [...data.riscos];
    newRiscos[rIndex] = { ...newRiscos[rIndex], [field]: [...newRiscos[rIndex][field], ""] };
    updateData({ ...data, riscos: newRiscos });
  };

  const removeItemFromArray = (rIndex: number, field: "causas" | "consequencias" | "controles", itemIndex: number) => {
    if (!data) return;
    const newRiscos = [...data.riscos];
    const newArray = newRiscos[rIndex][field].filter((_, i) => i !== itemIndex);
    newRiscos[rIndex] = { ...newRiscos[rIndex], [field]: newArray };
    updateData({ ...data, riscos: newRiscos });
  };

  const removeRisco = (rIndex: number) => {
    if (!data) return;
    const newRiscos = data.riscos.filter((_, i) => i !== rIndex);
    updateData({ ...data, riscos: newRiscos });
  };

  const addRisco = () => {
    if (!data) return;
    updateData({
      ...data,
      riscos: [
        ...data.riscos,
        { evento: "", causas: [""], consequencias: [""], probabilidade: 2, impacto: 2, controles: [""], nivel_controle: 100, resposta: "" }
      ]
    });
  };

  const getRiskLevelColor = (value: number) => {
    if (value >= 49) return "bg-red-500 text-white border-red-600";
    if (value >= 25) return "bg-orange-500 text-white border-orange-600";
    if (value >= 9) return "bg-yellow-400 text-black border-yellow-500";
    return "bg-green-500 text-white border-green-600";
  };

  const getRiskLevelLabel = (value: number) => {
    if (value >= 49) return "EXTREMO";
    if (value >= 25) return "ALTO";
    if (value >= 9) return "MÉDIO";
    return "BAIXO";
  };

  if (isLoading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-full min-h-[60vh]">
          <Loader2 className="h-8 w-8 animate-spin text-[#002547]" />
        </div>
      </Layout>
    );
  }

  if (!data) return null;

  const mitigatedRisks = data.riscos.map((r, i) => ({ risco: r, index: i })).filter(r => r.risco.resposta === "MITIGAR/MELHORAR");

  return (
    <Layout>
      <div className="space-y-6" id="pdf-content-wrapper">
        <div className="flex items-center justify-between mb-4 export-hide">
          <Button variant="ghost" onClick={() => navigate("/planejamento-contratacao/riscos-contratacoes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            {isEditContextMode ? (
              <>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                      Cancelar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancelar edição?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja cancelar a edição? Todas as alterações não salvas serão perdidas.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Voltar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleCancelContext} className="bg-red-600 hover:bg-red-700 text-white">
                        Confirmar Cancelamento
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button className="bg-[#002547] hover:bg-[#001b33] text-white" disabled={isSaving}>
                      {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                      Salvar
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Salvar alterações?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Tem certeza que deseja salvar as alterações realizadas nesta avaliação de riscos?
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction onClick={handleSave} className="bg-[#002547] hover:bg-[#001b33] text-white">
                        Salvar
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            ) : (
              <>
                {id !== "novo" && hasPermission && !metadata?.validatedAt && metadata?.hasPreviousValidation && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="border-gray-300 text-gray-700" disabled={isRecovering}>
                        {isRecovering ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : "Recuperar Validação"}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Recuperar Versão Validada?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Isso reverterá a avaliação atual para a última versão validada, descartando as edições mais recentes. Tem certeza?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleRecover} className="bg-gray-800 text-white">Recuperar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {id !== "novo" && hasPermission && !metadata?.validatedAt && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button className="bg-green-600 hover:bg-green-700 text-white" disabled={isValidating}>
                        {isValidating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                        Validar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Validar Avaliação?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza que deseja registrar a validação desta versão da avaliação?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={handleValidate} className="bg-green-600 hover:bg-green-700 text-white">Validar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}

                {(id === "novo" || metadata?.validatedAt) && (
                  <Button onClick={handleExportPDF} variant="outline" className="bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                    <Printer className="mr-2 h-4 w-4" /> Imprimir
                  </Button>
                )}

                {hasPermission && (
                  <Button onClick={() => { setIsEditContextMode(true); setIsEditMode(true); }} className="bg-[#002547] hover:bg-[#001b33] text-white">
                    <Edit className="h-4 w-4 mr-2" /> Editar
                  </Button>
                )}
              </>
            )}
          </div>
        </div>

        <Card className="border-gray-200 shadow-sm">
          <CardHeader className="bg-gray-50 border-b border-gray-100 pb-4 flex flex-row items-center justify-between gap-4">
            {isEditContextMode ? (
              <Input
                value={data.titulo}
                onChange={(e) => updateData({ ...data, titulo: e.target.value })}
                className="text-2xl font-semibold text-[#002547] h-auto py-1.5 px-3 max-w-2xl bg-white"
              />
            ) : (
              <CardTitle className="text-2xl text-[#002547]">
                {data.titulo}
              </CardTitle>
            )}

          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-4">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  Objetivos da Contratação
                </h3>
                {isEditContextMode ? (
                  <div className="space-y-2 w-full">
                    {data.objetivos.map((obj, i) => (
                      <div key={i} className="flex gap-2">
                        <Input
                          value={obj}
                          onChange={(e) => {
                            const newObjs = [...data.objetivos];
                            newObjs[i] = e.target.value;
                            updateData({ ...data, objetivos: newObjs });
                          }}
                          className="flex-1 bg-white"
                          placeholder="Descreva o objetivo..."
                        />
                        <Button
                          variant="ghost" size="icon"
                          className="text-red-400 hover:text-red-600 flex-shrink-0"
                          onClick={() => {
                            const newObjs = data.objetivos.filter((_, index) => index !== i);
                            updateData({ ...data, objetivos: newObjs });
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost" size="sm"
                      className="text-blue-600 hover:bg-blue-50 mt-2"
                      onClick={() => updateData({ ...data, objetivos: [...data.objetivos, ""] })}
                    >
                      <Plus className="h-4 w-4 mr-2" /> Adicionar Objetivo
                    </Button>
                  </div>
                ) : (
                  <ul className="list-disc list-inside space-y-1 text-gray-600 ml-2">
                    {data.objetivos.filter(o => o.trim() !== "").map((obj, i) => (
                      <li key={i}>{obj}</li>
                    ))}
                  </ul>
                )}
              </div>

              {isEditContextMode && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                    Equipe
                  </h3>
                  <div className="space-y-2 w-full">
                    <div className="relative">
                      <Input
                        placeholder="Buscar usuário para equipe (digite o nome ou matrícula)..."
                        value={equipeSearch}
                        onChange={(e) => {
                          setEquipeSearch(e.target.value);
                          setShowEquipeDropdown(true);
                        }}
                        onFocus={() => setShowEquipeDropdown(true)}
                        onBlur={() => setTimeout(() => setShowEquipeDropdown(false), 200)}
                        className="bg-white w-full"
                      />
                      {showEquipeDropdown && equipeSearch && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-auto">
                          {(() => {
                            const filteredUsers = allUsers.filter(u => 
                              !(data.equipe || []).includes(u.id) && 
                              (u.name.toLowerCase().includes(equipeSearch.toLowerCase()) || 
                               (u.matricula && u.matricula.toLowerCase().includes(equipeSearch.toLowerCase())))
                            );
                            
                            return filteredUsers.length === 0 ? (
                              <div className="p-2 text-sm text-gray-500">Nenhum usuário encontrado.</div>
                            ) : (
                              filteredUsers.map(u => (
                                <div
                                  key={u.id}
                                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                                  onClick={() => {
                                    updateData({ ...data, equipe: [...(data.equipe || []), u.id] });
                                    setEquipeSearch("");
                                    setShowEquipeDropdown(false);
                                  }}
                                >
                                  {u.name} ({u.matricula || '-'})
                                </div>
                              ))
                            );
                          })()}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 mt-2">
                      {(data.equipe || []).map(uid => {
                        const user = allUsers.find(u => u.id === uid);
                        return (
                          <div key={uid} className="flex items-center justify-between bg-gray-50 border rounded-md px-3 py-2 text-sm">
                            <span>{user ? `${user.name} (${user.matricula || '-'})` : `Usuário ID: ${uid}`}</span>
                            <Button variant="ghost" size="icon" className="h-6 w-6 text-red-400 hover:text-red-600" onClick={() => {
                              updateData({ ...data, equipe: (data.equipe || []).filter(id => id !== uid) });
                            }}>
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-lg text-gray-900">Avaliação de Riscos</h3>
              {isEditMode && (
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-blue-600 hover:bg-blue-100" title="Escala de Níveis de Risco">
                      <Info className="h-4 w-4" />
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-xl border-0 [&>button]:hidden">
                    <div className="bg-[#002547] text-white text-center py-4 text-sm font-bold tracking-wider">
                      ESCALA DE NÍVEIS DE RISCO
                    </div>
                    <div className="flex flex-col">
                      <div className="flex justify-between items-center px-6 py-4 bg-red-500 text-white font-bold text-base">
                        <span>EXTREMO</span>
                        <span>49 ≤ x ≤ 100</span>
                      </div>
                      <div className="flex justify-between items-center px-6 py-4 bg-orange-500 text-white font-bold text-base">
                        <span>ALTO</span>
                        <span>25 ≤ x ≤ 48</span>
                      </div>
                      <div className="flex justify-between items-center px-6 py-4 bg-yellow-400 text-black font-bold text-base">
                        <span>MÉDIO</span>
                        <span>9 ≤ x ≤ 24</span>
                      </div>
                      <div className="flex justify-between items-center px-6 py-4 bg-green-500 text-white font-bold text-base">
                        <span>BAIXO</span>
                        <span>1 ≤ x ≤ 8</span>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </div>
            <div className="flex gap-3 export-hide">
              {isEditMode && (
                <Button onClick={addRisco} size="sm" variant="outline" className="text-[#002547] border-[#002547] hover:bg-gray-100">
                  <Plus className="mr-2 h-4 w-4" /> Novo Risco
                </Button>
              )}
            </div>
          </div>

          <div className="overflow-x-auto w-full">
            <table className="w-full text-sm text-left border-collapse min-w-[1200px]">
              <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-3 w-12 text-center">ID</th>
                  <th className="px-3 py-3 w-48">Causas</th>
                  <th className="px-3 py-3 w-48">Evento de Risco</th>
                  <th className="px-3 py-3 w-48">Consequências</th>
                  <th className="px-3 py-3 w-28 text-center">Probabilidade</th>
                  <th className="px-3 py-3 w-28 text-center">Impacto</th>
                  <th className="px-3 py-3 w-24 text-center">Risco Inerente</th>
                  <th className="px-3 py-3 w-48">Controles Existentes</th>
                  <th className="px-3 py-3 w-28 text-center">Fator Controle</th>
                  <th className="px-3 py-3 w-24 text-center">Risco Residual</th>
                  <th className="px-3 py-3 w-36 text-center">Resposta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {data.riscos.map((risco, rIndex) => {
                  const riscoInerente = risco.probabilidade * risco.impacto;
                  const riscoResidual = riscoInerente * (risco.nivel_controle / 100);

                  return (
                    <tr key={rIndex} className="hover:bg-gray-50/50 align-top">
                      <td className="px-3 py-4 text-center">
                        <div className="flex flex-col items-center gap-2">
                          <span className="font-medium text-gray-500">R{rIndex + 1}</span>
                          {isEditMode && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-gray-400 hover:text-red-600 hover:bg-red-50"
                              onClick={() => removeRisco(rIndex)}
                              title="Remover Risco"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>

                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <div className="space-y-2">
                            {risco.causas.map((c, i) => (
                              <div key={i} className="flex gap-1">
                                <Input
                                  value={c}
                                  onChange={(e) => handleArrayChange(rIndex, "causas", i, e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Causa..."
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 flex-shrink-0" onClick={() => removeItemFromArray(rIndex, "causas", i)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" className="h-7 text-xs w-full text-blue-600 hover:bg-blue-50" onClick={() => addItemToArray(rIndex, "causas")}>
                              <Plus className="h-3 w-3 mr-1" /> Adicionar Causa
                            </Button>
                          </div>
                        ) : (
                          <ol className="list-decimal list-inside space-y-1 text-gray-700 text-xs marker:font-bold">
                            {risco.causas.filter(c => c.trim() !== "").map((c, i) => <li key={i}>{c}</li>)}
                          </ol>
                        )}
                      </td>

                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <textarea
                            value={risco.evento}
                            onChange={(e) => handleRiscoChange(rIndex, "evento", e.target.value)}
                            className="w-full min-h-[80px] p-2 text-xs border rounded-md focus:ring-1 focus:ring-blue-500 outline-none resize-y"
                            placeholder="Descreva o evento..."
                          />
                        ) : (
                          <div className="text-xs text-gray-700 whitespace-pre-wrap">{risco.evento}</div>
                        )}
                      </td>

                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <div className="space-y-2">
                            {risco.consequencias.map((c, i) => (
                              <div key={i} className="flex gap-1">
                                <Input
                                  value={c}
                                  onChange={(e) => handleArrayChange(rIndex, "consequencias", i, e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Consequência..."
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 flex-shrink-0" onClick={() => removeItemFromArray(rIndex, "consequencias", i)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" className="h-7 text-xs w-full text-blue-600 hover:bg-blue-50" onClick={() => addItemToArray(rIndex, "consequencias")}>
                              <Plus className="h-3 w-3 mr-1" /> Adicionar
                            </Button>
                          </div>
                        ) : (
                          <ol className="list-decimal list-inside space-y-1 text-gray-700 text-xs marker:font-bold">
                            {risco.consequencias.filter(c => c.trim() !== "").map((c, i) => <li key={i}>{c}</li>)}
                          </ol>
                        )}
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        {isEditMode ? (
                          <Select value={String(risco.probabilidade)} onValueChange={(v) => handleRiscoChange(rIndex, "probabilidade", Number(v))}>
                            <SelectTrigger className="h-8 text-xs font-semibold w-full min-w-max [&>span]:line-clamp-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">MUITO BAIXA</SelectItem>
                              <SelectItem value="4">BAIXA</SelectItem>
                              <SelectItem value="6">MÉDIA</SelectItem>
                              <SelectItem value="8">ALTA</SelectItem>
                              <SelectItem value="10">MUITO ALTA</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-xs font-semibold text-gray-700">{probMap[risco.probabilidade] || risco.probabilidade}</div>
                        )}
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        {isEditMode ? (
                          <Select value={String(risco.impacto)} onValueChange={(v) => handleRiscoChange(rIndex, "impacto", Number(v))}>
                            <SelectTrigger className="h-8 text-xs font-semibold w-full min-w-max [&>span]:line-clamp-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="2">INSIGNIFICANTE</SelectItem>
                              <SelectItem value="4">POUCO RELEVANTE</SelectItem>
                              <SelectItem value="6">RELEVANTE</SelectItem>
                              <SelectItem value="8">MUITO RELEVANTE</SelectItem>
                              <SelectItem value="10">EXTREMO</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-xs font-semibold text-gray-700">{impactoMap[risco.impacto] || risco.impacto}</div>
                        )}
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        <div className={`inline-flex flex-col items-center justify-center w-full py-2 px-1 rounded border shadow-sm ${getRiskLevelColor(riscoInerente)}`}>
                          <span className={`font-bold tracking-wider opacity-90 ${isEditMode ? 'text-[10px]' : 'text-xs'}`}>{getRiskLevelLabel(riscoInerente)}</span>
                          {isEditMode && <span className="text-lg font-black leading-none mt-1">{riscoInerente}</span>}
                        </div>
                      </td>

                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <div className="space-y-2">
                            {risco.controles.map((c, i) => (
                              <div key={i} className="flex gap-1">
                                <Input
                                  value={c}
                                  onChange={(e) => handleArrayChange(rIndex, "controles", i, e.target.value)}
                                  className="h-8 text-xs"
                                  placeholder="Controle..."
                                />
                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-400 hover:text-red-600 flex-shrink-0" onClick={() => removeItemFromArray(rIndex, "controles", i)}>
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            <Button variant="ghost" size="sm" className="h-7 text-xs w-full text-blue-600 hover:bg-blue-50" onClick={() => addItemToArray(rIndex, "controles")}>
                              <Plus className="h-3 w-3 mr-1" /> Adicionar
                            </Button>
                          </div>
                        ) : (
                          <ol className="list-decimal list-inside space-y-1 text-gray-700 text-xs marker:font-bold">
                            {risco.controles.filter(c => c.trim() !== "").map((c, i) => <li key={i}>{c}</li>)}
                          </ol>
                        )}
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        {isEditMode ? (
                          <Select value={String(risco.nivel_controle)} onValueChange={(v) => handleRiscoChange(rIndex, "nivel_controle", Number(v))}>
                            <SelectTrigger className="h-8 text-xs font-semibold w-full min-w-max [&>span]:line-clamp-none">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="100">INEXISTENTE</SelectItem>
                              <SelectItem value="80">FRACO</SelectItem>
                              <SelectItem value="60">MEDIANO</SelectItem>
                              <SelectItem value="40">SATISFATÓRIO</SelectItem>
                              <SelectItem value="20">FORTE</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-xs font-semibold text-gray-700">{controleMap[risco.nivel_controle] || risco.nivel_controle}</div>
                        )}
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        <div className={`inline-flex flex-col items-center justify-center w-full py-2 px-1 rounded border shadow-sm ${getRiskLevelColor(riscoResidual)}`}>
                          <span className={`font-bold tracking-wider opacity-90 ${isEditMode ? 'text-[10px]' : 'text-xs'}`}>{getRiskLevelLabel(riscoResidual)}</span>
                          {isEditMode && <span className="text-lg font-black leading-none mt-1">{Math.round(riscoResidual)}</span>}
                        </div>
                      </td>

                      <td className="px-3 py-4 text-center align-middle">
                        {isEditMode ? (
                          <Select value={risco.resposta} onValueChange={(v) => handleRiscoChange(rIndex, "resposta", v)}>
                            <SelectTrigger className="h-8 text-xs font-semibold w-full min-w-max [&>span]:line-clamp-none">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="ACEITAR">ACEITAR</SelectItem>
                              <SelectItem value="EVITAR/EXPLORAR">EVITAR/EXPLORAR</SelectItem>
                              <SelectItem value="MITIGAR/MELHORAR">MITIGAR/MELHORAR</SelectItem>
                              <SelectItem value="COMPARTILHAR">COMPARTILHAR</SelectItem>
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-xs font-semibold text-gray-700">{risco.resposta || "-"}</div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mitigations Table */}
        {mitigatedRisks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mt-6">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <h3 className="font-bold text-lg text-gray-900">Ações de Mitigação</h3>
            </div>
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm text-left border-collapse min-w-[1000px]">
                <thead className="text-xs text-gray-700 uppercase bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-3 py-3 w-16 text-center">ID</th>
                    <th className="px-3 py-3">Ação de Mitigação/Melhoria</th>
                    <th className="px-3 py-3 w-48">Responsável</th>
                    <th className="px-3 py-3 w-40">Previsão Início</th>
                    <th className="px-3 py-3 w-40">Previsão Término</th>
                    <th className="px-3 py-3 w-48">Quem Comunicar</th>
                    <th className="px-3 py-3 w-40">Frequência</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {mitigatedRisks.map(({ risco, index }) => (
                    <tr key={index} className="hover:bg-gray-50/50 align-top">
                      <td className="px-3 py-4 text-center font-medium text-gray-500">
                        R{index + 1}
                      </td>
                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <textarea
                            value={risco.acao?.melhoria || ""}
                            onChange={(e) => handleAcaoChange(index, "melhoria", e.target.value)}
                            placeholder="Descrição da ação..."
                            className="w-full min-h-[60px] p-2 text-xs border rounded-md focus:ring-1 focus:ring-blue-500 outline-none resize-y"
                          />
                        ) : (
                          <div className="text-xs text-gray-700 whitespace-pre-wrap">{risco.acao?.melhoria || "-"}</div>
                        )}
                      </td>
                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <textarea
                            value={risco.acao?.responsavel || ""}
                            onChange={(e) => handleAcaoChange(index, "responsavel", e.target.value)}
                            placeholder="Responsável..."
                            className="w-full min-h-[60px] p-2 text-xs border rounded-md focus:ring-1 focus:ring-blue-500 outline-none resize-y"
                          />
                        ) : (
                          <div className="text-xs text-gray-700 whitespace-pre-wrap">{risco.acao?.responsavel || "-"}</div>
                        )}
                      </td>
                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formatDateForInput(risco.acao?.previsao_inicio || "")}
                            onChange={(e) => handleAcaoChange(index, "previsao_inicio", formatDateForState(e.target.value))}
                            className="text-xs h-8"
                          />
                        ) : (
                          <div className="text-xs text-gray-700">{risco.acao?.previsao_inicio || "-"}</div>
                        )}
                      </td>
                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <Input
                            type="date"
                            value={formatDateForInput(risco.acao?.previsao_fim || "")}
                            onChange={(e) => handleAcaoChange(index, "previsao_fim", formatDateForState(e.target.value))}
                            className="text-xs h-8"
                          />
                        ) : (
                          <div className="text-xs text-gray-700">{risco.acao?.previsao_fim || "-"}</div>
                        )}
                      </td>
                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <textarea
                            value={risco.acao?.comunicar || ""}
                            onChange={(e) => handleAcaoChange(index, "comunicar", e.target.value)}
                            placeholder="Quem comunicar..."
                            className="w-full min-h-[60px] p-2 text-xs border rounded-md focus:ring-1 focus:ring-blue-500 outline-none resize-y"
                          />
                        ) : (
                          <div className="text-xs text-gray-700 whitespace-pre-wrap">{risco.acao?.comunicar || "-"}</div>
                        )}
                      </td>
                      <td className="px-3 py-4 align-middle">
                        {isEditMode ? (
                          <Select
                            value={risco.acao?.frequencia || ""}
                            onValueChange={(v) => handleAcaoChange(index, "frequencia", v)}
                          >
                            <SelectTrigger className="h-8 text-xs w-full min-w-max [&>span]:line-clamp-none">
                              <SelectValue placeholder="Selecione..." />
                            </SelectTrigger>
                            <SelectContent>
                              {freqOptions.map(f => (
                                <SelectItem key={f} value={f}>{f}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <div className="text-xs text-gray-700">{risco.acao?.frequencia || "-"}</div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
