import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Upload, FileText, Trash2, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { apiClient } from "@/services/apiClient";
import { useAuth } from "@/contexts/AuthContext";

interface ContractRiskAssessment {
  id: number;
  status: "IN_PROGRESS" | "COMPLETED" | "ERROR";
  body?: string;
  createdAt: string;
  updatedAt?: string;
}

export default function RiscosContratacoes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const hasPermission = user?.is_superadmin || (user?.tags_acesso && user.tags_acesso.includes("PC_AR_CRUD"));
  
  const [apiToken, setApiToken] = useState("");
  const [dodFile, setDodFile] = useState<File | null>(null);
  const [etpFile, setEtpFile] = useState<File | null>(null);
  const [trFile, setTrFile] = useState<File | null>(null);

  const [assessments, setAssessments] = useState<ContractRiskAssessment[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);

  const dodInputRef = useRef<HTMLInputElement>(null);
  const etpInputRef = useRef<HTMLInputElement>(null);
  const trInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const token = localStorage.getItem("google_flash_api_token");
    if (token) setApiToken(token);
    fetchAssessments();
  }, [page]);

  useEffect(() => {
    // Polling if there's any IN_PROGRESS assessment
    const hasInProgress = assessments.some(a => a.status === "IN_PROGRESS");
    let interval: NodeJS.Timeout;

    if (hasInProgress) {
      interval = setInterval(() => {
        fetchAssessments(false);
      }, 5000);
    }

    return () => clearInterval(interval);
  }, [assessments]);

  const fetchAssessments = async (showLoading = true) => {
    if (showLoading) setIsLoadingList(true);
    try {
      const url = new URL("/api/contract-risk-assessment", window.location.origin);
      url.searchParams.append("page", page.toString());
      url.searchParams.append("size", hasPermission ? "6" : "30");
      if (search.trim()) url.searchParams.append("search", search.trim());

      const data: any = await apiClient.get(url.pathname + url.search);
      setAssessments(data.content || []);
      setTotalPages(data.totalPages || 1);
    } catch (error) {
      console.error("Error fetching assessments", error);
    } finally {
      if (showLoading) setIsLoadingList(false);
    }
  };

  const handleTokenChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setApiToken(val);
    localStorage.setItem("google_flash_api_token", val);
  };

  const handleFileChange = (setter: React.Dispatch<React.SetStateAction<File | null>>) => (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        toast.error("Por favor, selecione apenas arquivos PDF.");
        return;
      }
      setter(file);
    }
  };

  const handleSubmit = async () => {
    if (!apiToken) {
      toast.error("API Token é obrigatório.");
      return;
    }
    if (!dodFile || !etpFile || !trFile) {
      toast.error("Por favor, envie os 3 arquivos (DOD, ETP, TR).");
      return;
    }

    const hasInProgress = assessments.some(a => a.status === "IN_PROGRESS");
    if (hasInProgress) {
      toast.error("Você já possui uma avaliação em andamento.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("apiToken", apiToken);
      formData.append("dod", dodFile);
      formData.append("etp", etpFile);
      formData.append("tr", trFile);

      await apiClient.post("/api/contract-risk-assessment", formData);

      toast.success("Avaliação iniciada com sucesso!");
      setDodFile(null);
      setEtpFile(null);
      setTrFile(null);
      if (dodInputRef.current) dodInputRef.current.value = '';
      if (etpInputRef.current) etpInputRef.current.value = '';
      if (trInputRef.current) trInputRef.current.value = '';
      fetchAssessments();
    } catch (error: any) {
      toast.error(error.message || "Erro de conexão ao iniciar avaliação.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/api/contract-risk-assessment/${id}`);
      toast.success("Avaliação excluída.");
      fetchAssessments();
    } catch (error) {
      toast.error("Erro de conexão ao excluir.");
    }
  };

  const parseTitle = (assessment: ContractRiskAssessment) => {
    if (!assessment.body) return "Avaliação de Riscos (Sem Título)";
    try {
      const data = JSON.parse(assessment.body);
      return data.titulo || "Avaliação de Riscos (Sem Título)";
    } catch (e) {
      return "Avaliação de Riscos (Sem Título)";
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(0);
    fetchAssessments();
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Avaliação de Riscos</h1>
          <p className="text-gray-500 mt-2">
            Envie os documentos de planejamento para gerar automaticamente uma matriz de riscos utilizando inteligência artificial.
          </p>
        </div>

        {hasPermission && (
        <Card className="border-gray-200 shadow-sm">
          <CardContent className="p-6 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Google API Token</label>
              <Input
                type="password"
                placeholder="Insira seu token da API..."
                value={apiToken}
                onChange={handleTokenChange}
                className="max-w-md bg-gray-50"
              />
              <p className="text-xs text-gray-500">
                Seu token não será armazenado no banco de dados.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-gray-100">
              {/* DOD Card */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={dodInputRef}
                  onChange={handleFileChange(setDodFile)}
                />
                <div className="mx-auto w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">DOD</h3>
                <p className="text-xs text-gray-500 mb-4">Doc. Oficialização Demanda</p>
                {dodFile ? (
                  <div className="text-sm text-green-600 font-medium truncate flex items-center justify-center gap-2">
                    {dodFile.name}
                    <button onClick={() => { setDodFile(null); if (dodInputRef.current) dodInputRef.current.value = ''; }} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => dodInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Anexar PDF
                  </Button>
                )}
              </div>

              {/* ETP Card */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={etpInputRef}
                  onChange={handleFileChange(setEtpFile)}
                />
                <div className="mx-auto w-12 h-12 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">ETP</h3>
                <p className="text-xs text-gray-500 mb-4">Estudo Técnico Preliminar</p>
                {etpFile ? (
                  <div className="text-sm text-green-600 font-medium truncate flex items-center justify-center gap-2">
                    {etpFile.name}
                    <button onClick={() => { setEtpFile(null); if (etpInputRef.current) etpInputRef.current.value = ''; }} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => etpInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Anexar PDF
                  </Button>
                )}
              </div>

              {/* TR Card */}
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center hover:bg-gray-50 transition-colors">
                <input
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  ref={trInputRef}
                  onChange={handleFileChange(setTrFile)}
                />
                <div className="mx-auto w-12 h-12 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center mb-4">
                  <FileText className="h-6 w-6" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">TR</h3>
                <p className="text-xs text-gray-500 mb-4">Termo de Referência</p>
                {trFile ? (
                  <div className="text-sm text-green-600 font-medium truncate flex items-center justify-center gap-2">
                    {trFile.name}
                    <button onClick={() => { setTrFile(null); if (trInputRef.current) trInputRef.current.value = ''; }} className="text-red-500 hover:text-red-700">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => trInputRef.current?.click()}>
                    <Upload className="h-4 w-4 mr-2" />
                    Anexar PDF
                  </Button>
                )}
              </div>
            </div>

            <div className="pt-4 flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={isSubmitting || !dodFile || !etpFile || !trFile || assessments.some(a => a.status === 'IN_PROGRESS')}
                className="bg-[#002547] hover:bg-[#001b33]"
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Iniciar Avaliação de Riscos
              </Button>
            </div>
          </CardContent>
        </Card>
        )}

        {/* Historico */}
        <div className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h2 className="text-xl font-bold text-gray-900">Histórico de Avaliações</h2>
            <form onSubmit={handleSearch} className="flex gap-2 w-full sm:w-auto">
              <Input
                placeholder="Buscar por título..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full sm:w-64"
              />
              <Button type="submit" variant="secondary" className="bg-gray-100 hover:bg-gray-200 text-gray-800">
                Buscar
              </Button>
            </form>
          </div>

          {isLoadingList ? (
            <div className="flex justify-center items-center p-8 min-h-[400px]">
              <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
            </div>
          ) : assessments.length === 0 ? (
            <div className="text-center p-12 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
              <AlertCircle className="mx-auto h-12 w-12 text-gray-400 mb-3" />
              <p className="text-gray-500 font-medium">Nenhuma avaliação encontrada.</p>
              <p className="text-gray-400 text-sm mt-1">Preencha os dados acima para gerar sua primeira avaliação.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {assessments.map((assessment) => (
                <Card key={assessment.id} className="overflow-hidden hover:shadow-md transition-shadow group">
                  <CardContent className="p-0">
                    <div className="p-5">
                      <div className="flex justify-between items-start mb-4">
                        <div className="flex-1 pr-4">
                          <h4 className="font-semibold text-gray-900 line-clamp-2" title={parseTitle(assessment)}>
                            {parseTitle(assessment)}
                          </h4>
                          <p className="text-xs text-gray-500 mt-1">
                            Última atualização: {format(new Date(assessment.updatedAt || assessment.createdAt), "dd 'de' MMMM, HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                        {hasPermission && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button
                              className="text-gray-400 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                              title="Excluir"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Excluir Avaliação?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Tem certeza que deseja excluir esta avaliação de riscos permanentemente? Esta ação não pode ser desfeita.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => handleDelete(assessment.id)} className="bg-red-600 hover:bg-red-700">
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                        )}
                      </div>

                      {assessment.status === 'IN_PROGRESS' && (
                        <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-3 py-2 rounded-lg text-sm font-medium">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span>Em Andamento...</span>
                        </div>
                      )}

                      {assessment.status === 'ERROR' && (
                        <div className="flex items-center gap-2 text-red-600 bg-red-50 px-3 py-2 rounded-lg text-sm font-medium">
                          <AlertCircle className="h-4 w-4" />
                          <span>Falha na Geração</span>
                        </div>
                      )}

                      {assessment.status === 'COMPLETED' && (
                        <Button
                          variant="secondary"
                          className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800"
                          onClick={() => navigate(`/planejamento-contratacao/riscos-contratacoes/${assessment.id}`)}
                        >
                          Visualizar Matriz
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Pagination */}
          {!isLoadingList && assessments.length > 0 && (
            <div className="flex justify-center items-center gap-4 mt-8">
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
              >
                Anterior
              </Button>
              <span className="text-sm text-gray-500">
                Página {page + 1} de {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
              >
                Próxima
              </Button>
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
