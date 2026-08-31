import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Trash2, Download, Edit, ArrowLeft, Search, ArrowUp, ArrowDown, ArrowUpDown, FileText, RefreshCw } from "lucide-react";
import { useEffect, useState, useRef } from "react";
import { contractPlanService } from "@/services/contractPlanService";
import pcaApi from "@/services/pcaApi";
import { ContractPlan, ContractPlanAttachment, ContractPlanNote, PcaItem } from "@/types";
import { toast } from "sonner";
import Storage from "@/utils/storage";
import { User } from "@/types";

export default function PlanejamentoContratacao() {
  const [plans, setPlans] = useState<ContractPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState("Todas as unidades");

  const currentUser = Storage.load<User | null>("user", null);
  const isSuperAdmin = currentUser?.role === "ADMIN";

  // SPA State
  const [activeScreen, setActiveScreen] = useState<"lista" | "detalhe">("lista");
  const [selectedPlanId, setSelectedPlanId] = useState<number | null>(null);

  // Detail State
  const [activePlan, setActivePlan] = useState<ContractPlan | null>(null);
  const [attachments, setAttachments] = useState<ContractPlanAttachment[]>([]);
  interface PendingAttachment {
    id: string;
    file: File | null;
    documentType: string;
    originalAttachmentId?: number;
    isEditingTypeOnly?: boolean;
    originalFileName?: string;
  }
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [deletedAttachmentIds, setDeletedAttachmentIds] = useState<number[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [pcaItems, setPcaItems] = useState<PcaItem[]>([]);
  const [modalProad, setModalProad] = useState("");
  const [modalSelectedPca, setModalSelectedPca] = useState<string>("");
  const [creating, setCreating] = useState(false);
  const [pcaSearchQuery, setPcaSearchQuery] = useState("");
  const [isPcaDropdownOpen, setIsPcaDropdownOpen] = useState(false);
  const [isConfirmBackOpen, setIsConfirmBackOpen] = useState(false);
  const [isConfirmRemoveOpen, setIsConfirmRemoveOpen] = useState(false);
  const [attachmentToRemove, setAttachmentToRemove] = useState<number | null>(null);

  // Deletion state
  const [isConfirmDeletePlanOpen, setIsConfirmDeletePlanOpen] = useState(false);
  const [deletePlanId, setDeletePlanId] = useState<number | null>(null);

  // Demanda State
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [tempEstimatedValue, setTempEstimatedValue] = useState<string>("");
  const [savingValue, setSavingValue] = useState(false);
  const [savingAttachmentId, setSavingAttachmentId] = useState<string | null>(null);
  const [isSavingRemaining, setIsSavingRemaining] = useState(false);

  // Notes (Interlocução) State
  const [notes, setNotes] = useState<ContractPlanNote[]>([]);
  const [newRecordText, setNewRecordText] = useState("");
  const [newRecordLocation, setNewRecordLocation] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);

  // Situação State
  const [tempSituation, setTempSituation] = useState<string>("");

  // Busca e Ordenação
  const [searchQuery, setSearchQuery] = useState("");
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const notesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (notesContainerRef.current) {
      notesContainerRef.current.scrollTop = notesContainerRef.current.scrollHeight;
    }
  }, [notes]);

  useEffect(() => {
    window.scrollTo(0, 0);
    if (activeScreen === "lista") {
      loadPlans();
    } else if (activeScreen === "detalhe" && selectedPlanId) {
      loadPlanDetails(selectedPlanId);
    }
  }, [activeScreen, selectedPlanId]);

  const loadPlans = async () => {
    try {
      setLoading(true);
      const data = await contractPlanService.getAll();
      setPlans(data);
    } catch (error) {
      console.error("Erro ao carregar planos de contratação", error);
      toast.error("Erro ao carregar a lista de planejamentos.");
    } finally {
      setLoading(false);
    }
  };

  const loadPlanDetails = async (planId: number) => {
    try {
      setLoading(true);
      const data = await contractPlanService.getById(planId);
      setActivePlan(data);
      const atts = await contractPlanService.getAttachments(planId);
      setAttachments(atts || []);
      const fetchedNotes = await contractPlanService.getNotes(planId);
      setNotes(fetchedNotes || []);
    } catch (error) {
      console.error("Erro ao carregar plano", error);
      toast.error("Erro ao carregar os dados.");
      setActiveScreen("lista");
    } finally {
      setLoading(false);
    }
  };

  const loadPcaItems = async () => {
    try {
      const year = new Date().getFullYear();
      // Fetch only alive PCA items (without versionNumber) for the current year
      const items = await pcaApi.getPcaItems(year);
      setPcaItems(items);
    } catch (error) {
      console.error("Erro ao carregar itens de PCA", error);
      toast.error("Erro ao buscar itens do PCA-TIC.");
    }
  };

  const openCreateModal = () => {
    setIsModalOpen(true);
    setModalProad("");
    setModalSelectedPca("");
    setPcaSearchQuery("");
    setIsPcaDropdownOpen(false);
    if (pcaItems.length === 0) {
      loadPcaItems();
    }
  };

  const closeCreateModal = () => {
    setIsModalOpen(false);
  };

  const handleCreatePlan = async () => {
    if (!modalProad || !modalSelectedPca) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    const pca = pcaItems.find(p => String(p.id) === String(modalSelectedPca));

    if (!pca) {
      toast.error("Item do PCA não encontrado. Recarregue a página e tente novamente.");
      return;
    }

    try {
      setCreating(true);

      const payload = {
        pcaId: pca.id,
        objectName: pca.objeto,
        cadastrosAreasId: pca.cadastrosAreasId || pca.cadastros_areas_id || null,
        cadastrosUnidadesId: pca.cadastrosUnidadesId || pca.cadastros_unidades_id || null,
        description: "",
        justification: "",
        estimatedValueCents: pca.valor_estimado ? Math.round(pca.valor_estimado * 100) : 0,
        proadNumber: modalProad
      };

      const newPlan = await contractPlanService.create(payload);
      toast.success("Contratação iniciada com sucesso!");
      closeCreateModal();

      // Go to detail screen
      setSelectedPlanId(newPlan.id);
      setActiveScreen("detalhe");
    } catch (error) {
      console.error("Erro ao criar planejamento", error);
      toast.error("Erro ao iniciar a contratação.");
    } finally {
      setCreating(false);
    }
  };

  const handleDeletePlan = async () => {
    if (!deletePlanId) return;
    try {
      await contractPlanService.delete(deletePlanId);
      toast.success("IPC excluído com sucesso.");
      loadPlans();
    } catch (error) {
      console.error("Erro ao excluir IPC", error);
      toast.error("Erro ao excluir IPC.");
    } finally {
      setIsConfirmDeletePlanOpen(false);
      setDeletePlanId(null);
    }
  };

  const handleSaveEstimatedValue = async () => {
    if (!activePlan) return;

    try {
      setSavingValue(true);

      const parsedValue = parseFloat(tempEstimatedValue.replace(/\./g, '').replace(',', '.'));
      if (isNaN(parsedValue)) {
        toast.error("Valor inválido.");
        return;
      }

      const cents = Math.round(parsedValue * 100);
      const payload = {
        objectName: activePlan.objectName || "",
        cadastrosAreasId: activePlan.cadastrosAreasId,
        cadastrosUnidadesId: activePlan.cadastrosUnidadesId,
        description: activePlan.description || "",
        justification: activePlan.justification || "",
        estimatedValueCents: cents,
        priorityLevel: activePlan.priorityLevel || 0,
        estimatedDate: activePlan.estimatedDate,
        loaReference: activePlan.loaReference || "",
        situation: tempSituation || activePlan.situation || 'Em Instrução'
      };

      const updatedPlan = await contractPlanService.update(activePlan.id, payload);
      setActivePlan(updatedPlan);
      setIsEditingValue(false);
      toast.success("Dados da demanda atualizados!");
    } catch (error) {
      console.error("Erro ao atualizar dados:", error);
      toast.error("Erro ao atualizar dados da demanda.");
    } finally {
      setSavingValue(false);
    }
  };

  const handleSavePendingAttachment = async (pendingAtt: PendingAttachment) => {
    if (!activePlan) return;
    if (!pendingAtt.isEditingTypeOnly && !pendingAtt.file) return;

    try {
      setSavingAttachmentId(pendingAtt.id);

      if (pendingAtt.isEditingTypeOnly && pendingAtt.originalAttachmentId) {
        await contractPlanService.updateAttachmentType(activePlan.id, pendingAtt.originalAttachmentId, pendingAtt.documentType);
        // Remove from deleted array since we just updated its type and it's no longer "pending edit"
        setDeletedAttachmentIds(prev => prev.filter(id => id !== pendingAtt.originalAttachmentId));
      } else {
        if (pendingAtt.originalAttachmentId) {
          await contractPlanService.deleteAttachment(activePlan.id, pendingAtt.originalAttachmentId);
          setDeletedAttachmentIds(prev => prev.filter(id => id !== pendingAtt.originalAttachmentId));
        }
        await contractPlanService.uploadAttachment(activePlan.id, pendingAtt.file!, pendingAtt.documentType);
      }

      const atts = await contractPlanService.getAttachments(activePlan.id);
      setAttachments(atts || []);

      setPendingAttachments(prev => prev.filter(p => p.id !== pendingAtt.id));

      toast.success("Anexo salvo com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar anexo:", error);
      toast.error("Erro ao salvar o anexo.");
    } finally {
      setSavingAttachmentId(null);
    }
  };

  const handleSaveAllRemaining = async () => {
    setIsSavingRemaining(true);
    try {
      if (isEditingValue) {
        await handleSaveEstimatedValue();
      }
      for (const att of pendingAttachments) {
        if (att.file) {
          await handleSavePendingAttachment(att);
        }
      }
      toast.success("Modificações salvas com sucesso!");
      setActiveScreen("lista");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar algumas modificações.");
    } finally {
      setIsSavingRemaining(false);
      setIsConfirmBackOpen(false);
    }
  };

  const handleAddNote = async () => {
    if (!activePlan || !newRecordText.trim()) return;
    try {
      setSavingNote(true);
      await contractPlanService.addNoteRecord(activePlan.id, newRecordText.trim(), newRecordLocation.trim() || undefined);
      setNewRecordText("");
      setNewRecordLocation("");
      const fetchedNotes = await contractPlanService.getNotes(activePlan.id);
      setNotes(fetchedNotes || []);
      toast.success("Registro adicionado com sucesso.");
    } catch (error) {
      console.error("Erro ao adicionar registro", error);
      toast.error("Erro ao adicionar registro de interlocução.");
    } finally {
      setSavingNote(false);
    }
  };

  const handleDownload = async (attId: number, fileName: string) => {
    if (!selectedPlanId) return;
    try {
      const url = contractPlanService.getAttachmentDownloadUrl(selectedPlanId, attId);
      const user = Storage.load<User | null>("user", null);
      const token = localStorage.getItem("auth_token");
      const headers: any = {};
      if (user) headers["x-user-id"] = String(user.id);
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const response = await fetch(url, { headers });
      if (!response.ok) throw new Error("Erro no download");

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objectUrl;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(objectUrl);
      a.remove();
    } catch (error) {
      toast.error("Erro ao baixar arquivo.");
    }
  };

  const getSituationTag = (situation?: string) => {
    if (situation === 'Concluído') return <span className="inline-block text-[11px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap bg-[#e8f5e9] text-[#2e7d32]">Concluído</span>;
    return <span className="inline-block text-[11px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap bg-[#e3f2fd] text-[#1565c0]">Em Instrução</span>;
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
  const formatDateTime = (d?: string) => {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const baseFilteredPlans = plans.filter(p => selectedUnit === "Todas as unidades" || p.unidadeNome === selectedUnit || p.areaSigla === selectedUnit);

  let processedPlans = [...baseFilteredPlans];
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    processedPlans = processedPlans.filter(p =>
      (p.ipcCode || `IPC-${p.pcaYear || "2026"}-00${p.id}`).toLowerCase().includes(q) ||
      (p.objectName || "").toLowerCase().includes(q)
    );
  }

  if (sortConfig !== null) {
    processedPlans.sort((a, b) => {
      let aValue: any = a[sortConfig.key as keyof ContractPlan];
      let bValue: any = b[sortConfig.key as keyof ContractPlan];

      if (sortConfig.key === 'ipcCode') {
        aValue = a.ipcCode || `IPC-${a.pcaYear || "2026"}-00${a.id}`;
        bValue = b.ipcCode || `IPC-${b.pcaYear || "2026"}-00${b.id}`;
      }

      if (!aValue) aValue = '';
      if (!bValue) bValue = '';

      if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const filteredPlans = processedPlans;

  const formatCurrency = (cents?: number) => {
    if (cents === undefined || cents === null) return "R$ 0,00";
    return `R$ ${(cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const handleCurrencyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let value = e.target.value.replace(/\D/g, "");
    if (!value) {
      setTempEstimatedValue("");
      return;
    }
    const cents = parseInt(value, 10);
    const formatted = (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    setTempEstimatedValue(formatted);
  };

  const emInstrucaoCount = plans.filter(p => !p.situation || p.situation === 'Em Instrução').length;
  const concluidoCount = plans.filter(p => p.situation === 'Concluído').length;

  const renderSortIcon = (key: string) => {
    if (sortConfig?.key !== key) return <ArrowUpDown className="inline-block ml-1 h-3 w-3 text-[#a5c8a7]" />;
    return sortConfig.direction === 'asc'
      ? <ArrowUp className="inline-block ml-1 h-3 w-3 text-[#2e7d32]" />
      : <ArrowDown className="inline-block ml-1 h-3 w-3 text-[#2e7d32]" />;
  };

  return (
    <Layout>
      <div className="w-full h-full p-6 flex flex-col text-[#26313d] font-sans">

        {/* --- TELA: FILA CCA --- */}
        {activeScreen === "lista" && (
          <div className="animate-in fade-in duration-300">
            <Breadcrumbs items={[{ label: "Planejamento da Contratação" }]} className="mb-2.5" />
            <div className="flex justify-between items-center mb-6">
              <div className="flex-1"></div>
              <div className="flex items-center gap-4">
                <select
                  className="h-10 w-44 bg-white border border-[#dde4ec] text-[13px] text-[#26313d] rounded-[10px] px-3 outline-none focus:border-[#2e7d32] focus:ring-1 focus:ring-[#2e7d32] transition-all shadow-sm"
                  value={selectedUnit}
                  onChange={e => setSelectedUnit(e.target.value)}
                >
                  <option>Todas as unidades</option>
                  <option>DITI</option>
                  <option>DSTI</option>
                  <option>GEJUT</option>
                  <option>SGJT</option>
                </select>
                {isSuperAdmin && (
                  <button
                    onClick={openCreateModal}
                    className="bg-[#2e7d32] border-0 rounded-xl px-5 py-2.5 text-sm text-white font-semibold cursor-pointer hover:bg-[#276b2b] transition-colors shadow-sm"
                  >
                    + Instruir Planejamento
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="bg-white border border-[#dde4ec] rounded-[10px] p-4 shadow-sm">
                <div className="text-2xl font-bold text-[#1565c0]">{emInstrucaoCount}</div>
                <div className="text-xs text-[#5b6b7c] mt-1">Em Instrução</div>
              </div>
              <div className="bg-white border border-[#dde4ec] rounded-[10px] p-4 shadow-sm">
                <div className="text-2xl font-bold text-[#2e7d32]">{concluidoCount}</div>
                <div className="text-xs text-[#5b6b7c] mt-1">Concluídos</div>
              </div>
            </div>

            <div className="bg-gray-300 rounded-2xl border border-gray-400 overflow-hidden shadow-sm">
              <div className="px-6 py-4 bg-gray-200 border-b border-gray-400">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-800">Instruções de Planejamento da Contratação</h3>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Buscar IPC ou objeto..."
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        className="pl-10 pr-4 h-10 w-60 bg-white border border-gray-300 text-sm rounded-xl focus:border-slate-500 focus:ring-slate-500 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="hidden lg:flex items-center text-sm font-bold text-gray-800">
                    <span className="w-32 text-center cursor-pointer hover:text-gray-600 select-none whitespace-nowrap" onClick={() => handleSort('areaSigla')}>Demandante {renderSortIcon('areaSigla')}</span>
                    <span className="w-28 text-center cursor-pointer hover:text-gray-600 select-none whitespace-nowrap" onClick={() => handleSort('pcaCode')}>Item de PCA {renderSortIcon('pcaCode')}</span>
                    <span className="w-28 text-center cursor-pointer hover:text-gray-600 select-none whitespace-nowrap" onClick={() => handleSort('estimatedDate')}>Recebida em {renderSortIcon('estimatedDate')}</span>
                    <span className="w-28 text-center cursor-pointer hover:text-gray-600 select-none whitespace-nowrap" onClick={() => handleSort('situation')}>Situação {renderSortIcon('situation')}</span>
                    <span className="w-64 text-center select-none">Acompanhamento</span>
                    <span className="w-8"></span>
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="text-center py-16 text-gray-400 bg-white">
                  Carregando demandas...
                </div>
              ) : filteredPlans.length === 0 ? (
                <div className="py-20 text-center bg-white">
                  <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <FileText className="h-10 w-10 text-gray-400" />
                  </div>
                  <p className="text-gray-700 font-semibold text-lg">
                    Nenhuma demanda encontrada
                  </p>
                </div>
              ) : (
                <div className="bg-white">
                  {filteredPlans.map((plan, index) => (
                    <div
                      key={plan.id}
                      className={`group flex items-center justify-between px-6 py-5 hover:bg-slate-50 transition-all cursor-pointer ${index !== filteredPlans.length - 1 ? "border-b border-gray-100" : ""}`}
                      onClick={() => {
                        setSelectedPlanId(plan.id);
                        setActiveScreen("detalhe");
                      }}
                    >
                      <div className="flex items-center gap-4 min-w-0 flex-1">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg ${
                          plan.pcaContractType === "Renovação" 
                            ? "bg-gradient-to-br from-emerald-500 to-emerald-700 shadow-emerald-500/30" 
                            : "bg-gradient-to-br from-blue-600 to-blue-800 shadow-blue-600/30"
                        }`}>
                          {plan.pcaContractType === "Renovação" ? (
                            <RefreshCw className="h-6 w-6 text-white" />
                          ) : (
                            <FileText className="h-6 w-6 text-white" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="text-gray-900 font-semibold text-base truncate group-hover:text-blue-600 transition-colors">
                            {plan.ipcCode || `IPC-${plan.pcaYear || "2026"}-00${plan.id}`}
                          </h4>
                          <span className="text-sm text-gray-500 truncate block mt-1">
                            {plan.objectName || "Sem Objeto"}
                          </span>
                        </div>
                      </div>

                      <div className="hidden lg:flex items-center text-sm">
                        <div className="w-32 text-center text-gray-700 font-medium">{plan.areaSigla || plan.cadastrosAreasId || "-"}</div>
                        <div className="w-28 text-center text-gray-700 font-medium">Item {plan.pcaCode}/{plan.pcaYear}</div>
                        <div className="w-28 text-center text-gray-500">{plan.estimatedDate ? new Date(plan.estimatedDate).toLocaleDateString('pt-BR') : '14/08/2026'}</div>
                        <div className="w-28 flex justify-center">{getSituationTag(plan.situation)}</div>
                        <div className="w-64 px-4" onClick={(e) => e.stopPropagation()}>
                          {(() => {
                            const lastNote = plan.lastUserNote;
                            if (!lastNote) return <span className="text-[12px] text-gray-400 italic">Sem registros</span>;
                            return (
                              <div className="w-full">
                                <div className="flex items-center gap-1.5 mb-1 truncate">
                                  <span className="font-semibold text-gray-800 text-[11px]">{lastNote.createdBy || "Usuário"}</span>
                                  <span className="text-[10.5px] text-gray-500">- {formatDateTime(lastNote.createdAt)}</span>
                                </div>
                                <p className="text-[12px] text-gray-700 truncate" title={lastNote.message}>
                                  {lastNote.message}
                                </p>
                                {lastNote.location && (
                                  <p className="text-[11px] text-gray-500 mt-0.5 truncate" title={`Localização: ${lastNote.location}`}>
                                    Localização: <span className="font-medium text-gray-700">{lastNote.location}</span>
                                  </p>
                                )}
                              </div>
                            );
                          })()}
                        </div>
                        <div className="w-8 flex justify-end">
                          {isSuperAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletePlanId(plan.id);
                                setIsConfirmDeletePlanOpen(true);
                              }}
                              className="text-red-500 hover:bg-red-50 p-1.5 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                              title="Excluir"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TELA: DETALHE CCA --- */}
        {activeScreen === "detalhe" && activePlan && (
          <div className="animate-in fade-in duration-300 max-w-[1200px] mx-auto w-full">
            <Breadcrumbs items={[
              {
                label: "Planejamento da Contratação", onClick: () => {
                  if (pendingAttachments.length > 0 || deletedAttachmentIds.length > 0 || isEditingValue) {
                    setIsConfirmBackOpen(true);
                  } else {
                    setActiveScreen("lista");
                  }
                }
              },
              { label: activePlan.ipcCode || `IPC-${activePlan.pcaYear || "2026"}-00${activePlan.id}` }
            ]} className="mb-3" />

            <div className="flex items-center gap-4 mb-6 flex-wrap mt-2">
              <button
                onClick={() => {
                  if (pendingAttachments.length > 0 || deletedAttachmentIds.length > 0 || isEditingValue) {
                    setIsConfirmBackOpen(true);
                  } else {
                    setActiveScreen("lista");
                  }
                }}
                className="flex items-center gap-2 border border-[#dde4ec] bg-white rounded-[7px] px-[12px] py-[8px] text-[13.5px] text-[#16324f] font-semibold cursor-pointer hover:bg-[#f4f7fa] transition-colors shadow-sm"
              >
                <ArrowLeft size={16} /> Voltar
              </button>
              <h1 className="text-[20px] text-[#16324f] font-[650] tracking-tight">{activePlan.ipcCode || `IPC-${activePlan.pcaYear || "2026"}-00${activePlan.id}`} — {activePlan.objectName || "Sem Objeto"}</h1>
              {getSituationTag(activePlan.situation)}
              <div className="flex-1"></div>
            </div>

            <div className="bg-white border border-[#dde4ec] rounded-[10px] mb-6 shadow-sm">
              <header className="px-6 py-4 border-b border-[#dde4ec] flex items-center justify-between">
                <h3 className="text-[15px] text-[#16324f] font-semibold">Dados da demanda</h3>
                {isSuperAdmin && (
                  <div>
                    {!isEditingValue ? (
                      <button
                        onClick={() => {
                          setTempEstimatedValue(formatCurrency(activePlan.estimatedValueCents).replace('R$ ', ''));
                          setTempSituation(activePlan.situation || 'Em Instrução');
                          setIsEditingValue(true);
                        }}
                        className="px-3 py-1.5 border border-[#5b6b7c] text-[#5b6b7c] rounded-[5px] font-medium hover:bg-[#f4f7fa] text-[12.5px] bg-transparent cursor-pointer transition-colors"
                      >
                        Editar
                      </button>
                    ) : (
                      <div className="flex gap-2">
                        <button
                          onClick={() => setIsEditingValue(false)}
                          className="px-3 py-1.5 border border-[#5b6b7c] text-[#5b6b7c] rounded-[5px] font-medium hover:bg-[#f4f7fa] text-[12.5px] bg-transparent cursor-pointer transition-colors"
                          disabled={savingValue}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={handleSaveEstimatedValue}
                          disabled={savingValue}
                          className="px-3 py-1.5 border border-[#2e7d32] text-white bg-[#2e7d32] rounded-[5px] font-medium hover:bg-[#276b2b] text-[12.5px] cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {savingValue ? "Salvando..." : "Salvar"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </header>
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-5">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">Unidade demandante</label>
                    <input value={activePlan.areaSigla || activePlan.cadastrosAreasId || "-"} readOnly className="w-full border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[14px] bg-[#f4f7fa] text-[#43546a] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">Item de PCA</label>
                    <input value={`Item ${activePlan.pcaCode}/${activePlan.pcaYear}`} readOnly className="w-full border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[14px] bg-[#f4f7fa] text-[#43546a] outline-none" />
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">PROAD</label>
                    <input value={activePlan.proadNumber || "-"} readOnly className="w-full border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[14px] bg-[#f4f7fa] text-[#43546a] outline-none" />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">Valor estimado</label>
                    {!isEditingValue ? (
                      <input value={formatCurrency(activePlan.estimatedValueCents)} readOnly className="w-full border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[14px] bg-[#f4f7fa] text-[#43546a] outline-none" />
                    ) : (
                      <input
                        value={tempEstimatedValue}
                        onChange={handleCurrencyChange}
                        className="w-full border border-[#2e7d32] rounded-[7px] px-4 py-3 text-[14px] bg-white text-[#26313d] outline-none focus:ring-2 focus:ring-[#a5c8a7]"
                        placeholder="0,00"
                      />
                    )}
                  </div>
                  <div>
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">Situação</label>
                    <select
                      value={isEditingValue ? tempSituation : (activePlan.situation || 'Em Instrução')}
                      onChange={(e) => setTempSituation(e.target.value)}
                      disabled={!isEditingValue}
                      className="w-full border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[14px] bg-white text-[#26313d] outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#a5c8a7] disabled:bg-[#f4f7fa] disabled:text-[#43546a] disabled:cursor-not-allowed cursor-pointer"
                    >
                      <option value="Em Instrução">Em Instrução</option>
                      <option value="Concluído">Concluído</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>

            {/* Documentos do Planejamento */}
            <div className="bg-white border border-[#dde4ec] rounded-[10px] mb-6 shadow-sm">
              <header className="px-6 py-4 border-b border-[#dde4ec] flex items-center justify-between">
                <h3 className="text-[15px] text-[#16324f] font-semibold">Documentos do Planejamento</h3>
                {isSuperAdmin && (
                  <button
                    onClick={() => setPendingAttachments([...pendingAttachments, { id: crypto.randomUUID(), file: null, documentType: 'DOD' }])}
                    className="border border-[#dde4ec] bg-white rounded-[7px] px-[12px] py-[6px] text-[13px] text-[#16324f] font-semibold cursor-pointer hover:bg-[#f4f7fa] transition-colors"
                  >
                    + Adicionar Anexo
                  </button>
                )}
              </header>
              <div className="p-6">
                <div className="flex flex-col gap-2">
                  {/* Saved Attachments (not deleted) */}
                  {attachments.filter(att => !deletedAttachmentIds.includes(att.id)).map(att => (
                    <div key={att.id} className="flex items-center gap-3 bg-[#f6f8fb] border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[13.5px]">
                      <div className="min-w-[45px] h-[28px] rounded-[5px] bg-[#16324f] flex items-center justify-center text-[10.5px] font-bold text-white tracking-[0.5px] px-1.5">
                        {att.documentType ? att.documentType.toUpperCase() : "PDF"}
                      </div>
                      <span className="text-[#26313d]">{att.fileName} <span className="text-[#5b6b7c]">— juntado em {formatDate(att.uploadedAt)}</span></span>
                      <div className="flex-1"></div>
                      <div className="flex gap-2">
                        <button onClick={() => handleDownload(att.id, att.fileName)} className="p-1.5 text-[#1565c0] hover:bg-[#e3f2fd] rounded-[5px] cursor-pointer transition-colors" title="Baixar"><Download size={16} /></button>
                        {isSuperAdmin && (
                          <>
                            <button onClick={() => {
                              setDeletedAttachmentIds(prev => [...prev, att.id]);
                              setPendingAttachments([...pendingAttachments, { id: crypto.randomUUID(), file: null, documentType: att.documentType || 'DOD', originalAttachmentId: att.id, isEditingTypeOnly: true, originalFileName: att.fileName }]);
                            }} className="p-1.5 text-[#5b6b7c] hover:bg-[#f4f7fa] rounded-[5px] cursor-pointer transition-colors" title="Editar"><Edit size={16} /></button>
                            <button onClick={() => {
                              setAttachmentToRemove(att.id);
                              setIsConfirmRemoveOpen(true);
                            }} className="p-1.5 text-[#b3261e] hover:bg-[#fdecea] rounded-[5px] cursor-pointer transition-colors" title="Remover"><Trash2 size={16} /></button>
                          </>
                        )}
                      </div>
                    </div>
                  ))}

                  {/* Pending Attachments */}
                  {pendingAttachments.map((pendingAtt, idx) => (
                    <div key={pendingAtt.id} className="flex items-center gap-3 bg-white border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[13.5px] shadow-sm">
                      <select
                        value={pendingAtt.documentType}
                        onChange={e => {
                          const newArr = [...pendingAttachments];
                          newArr[idx].documentType = e.target.value;
                          setPendingAttachments(newArr);
                        }}
                        className="border border-[#dde4ec] rounded-[5px] px-2 py-1.5 text-[12.5px] bg-[#f4f7fa] outline-none min-w-[90px] focus:border-[#2e7d32]"
                      >
                        <option value="DOD">DOD</option>
                        <option value="ETP">ETP</option>
                        <option value="TR">TR</option>
                        <option value="MGR">MGR</option>
                        <option value="AM">AM</option>
                        <option value="Outros">Outros</option>
                      </select>

                      <div className="flex-1 flex items-center">
                        {pendingAtt.isEditingTypeOnly ? (
                          <span className="text-[#5b6b7c] font-medium text-[13px] truncate max-w-[400px]">
                            {pendingAtt.originalFileName} (Editando tipo)
                          </span>
                        ) : (
                          <>
                            <input
                              type="file"
                              id={`file-${pendingAtt.id}`}
                              className="hidden"
                              accept=".pdf,.doc,.docx"
                              onChange={e => {
                                const file = e.target.files?.[0];
                                const allowedTypes = ["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"];
                                if (file && !allowedTypes.includes(file.type)) {
                                  toast.error("Apenas arquivos PDF, DOC ou DOCX são permitidos.");
                                  return;
                                }
                                const newArr = [...pendingAttachments];
                                newArr[idx].file = file || null;
                                setPendingAttachments(newArr);
                              }}
                            />
                            <label htmlFor={`file-${pendingAtt.id}`} className="cursor-pointer text-[#1565c0] font-medium hover:underline text-[13px] truncate max-w-[400px]">
                              {pendingAtt.file ? pendingAtt.file.name : "Selecionar arquivo PDF"}
                            </label>
                          </>
                        )}
                      </div>

                      <div className="flex gap-2 ml-3">
                        <button
                          onClick={() => handleSavePendingAttachment(pendingAtt)}
                          disabled={(!pendingAtt.isEditingTypeOnly && !pendingAtt.file) || savingAttachmentId === pendingAtt.id}
                          className="px-3 py-1.5 border border-[#2e7d32] text-white bg-[#2e7d32] rounded-[5px] font-medium hover:bg-[#276b2b] text-[12.5px] cursor-pointer transition-colors disabled:opacity-50"
                        >
                          {savingAttachmentId === pendingAtt.id ? "Salvando..." : "Salvar"}
                        </button>
                        <button onClick={() => {
                          if (pendingAtt.originalAttachmentId) {
                            setDeletedAttachmentIds(prev => prev.filter(id => id !== pendingAtt.originalAttachmentId));
                          }
                          const newArr = [...pendingAttachments];
                          newArr.splice(idx, 1);
                          setPendingAttachments(newArr);
                        }} className="px-3 py-1.5 border border-[#b3261e] text-[#b3261e] rounded-[5px] font-medium hover:bg-[#fdecea] text-[12.5px] bg-transparent cursor-pointer transition-colors">
                          {pendingAtt.originalAttachmentId ? "Cancelar" : "Remover"}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Interlocução */}
            <div className="bg-white border border-[#dde4ec] rounded-[10px] mb-8 shadow-sm">
              <header className="px-6 py-4 border-b border-[#dde4ec] flex items-center">
                <h3 className="text-[15px] text-[#16324f] font-semibold">Interlocução e andamento</h3>
              </header>
              <div className="p-6">
                <div ref={notesContainerRef} className="max-h-[300px] overflow-y-auto pr-2 mb-4 scrollbar-thin scrollbar-thumb-[#dde4ec] scrollbar-track-transparent">
                  <ul className="list-none ml-3">
                    {notes.map(note => (
                      <li key={note.id} className={`relative pl-9 pb-6 before:content-[''] before:absolute before:-left-[9px] before:top-1 before:w-[16px] before:h-[16px] before:rounded-full before:bg-white before:border-[4px] ${note.isSystemEvent ? 'before:border-gray-400' : 'before:border-[#2e7d32]'} after:content-[''] after:absolute after:-left-[2px] after:top-[20px] after:w-[2px] after:h-[calc(100%-16px)] after:bg-[#dde4ec] last:after:hidden`}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#16324f] text-[13.5px]">{note.isSystemEvent ? "Sistema" : note.createdBy || "Usuário"}</span>
                          <span className="text-[12px] text-[#5b6b7c]">{formatDateTime(note.createdAt)}</span>
                        </div>
                        <p className="text-[14px] mt-1.5 text-[#26313d] whitespace-pre-wrap">{note.message}</p>
                        {note.location && (
                          <p className="text-[12.5px] mt-1 text-[#5b6b7c]">
                            Localização: <span className="font-medium text-[#16324f]">{note.location}</span>
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>
                  <div ref={notesEndRef} />
                </div>

                {isSuperAdmin && (
                  <div className="mt-2 mb-6 relative">
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">Novo registro</label>
                    <div className="relative mb-3">
                      <textarea
                        value={newRecordText}
                        onChange={(e) => setNewRecordText(e.target.value)}
                        maxLength={300}
                        className="w-full border border-[#dde4ec] rounded-[7px] px-4 pt-3 pb-8 text-[14px] bg-white text-[#26313d] outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#a5c8a7] min-h-[100px] resize-y"
                        placeholder="Registrar despacho, solicitação ao demandante ou anotação de análise..."
                      ></textarea>
                      <div className="absolute bottom-2 right-3 text-[11px] text-gray-400 pointer-events-none">
                        {newRecordText.length}/300
                      </div>
                    </div>
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">Localização do Processo</label>
                    <div className="relative">
                      <input
                        value={newRecordLocation}
                        onChange={(e) => setNewRecordLocation(e.target.value)}
                        maxLength={100}
                        className="w-full border border-[#dde4ec] rounded-[7px] px-4 py-3 pr-24 text-[14px] bg-white text-[#26313d] outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#a5c8a7]"
                        placeholder="Indique a localização do processo, a exemplo: (CCA/GEJUT)"
                      />
                      <div className="absolute top-1/2 -translate-y-1/2 right-3 text-[11px] text-gray-400 pointer-events-none">
                        {newRecordLocation.length}/100
                      </div>
                    </div>
                    <div className="flex justify-end mt-2">
                      <button onClick={handleAddNote} disabled={savingNote || !newRecordText.trim()} className="border-0 bg-[#2e7d32] rounded-[7px] px-[16px] py-[8px] text-[13px] text-white font-semibold cursor-pointer hover:bg-[#276b2b] transition-colors disabled:opacity-50">
                        {savingNote ? "Registrando..." : "Registrar"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

          </div>
        )}

      </div>

      {/* --- MODAL: CONFIRMAR VOLTAR --- */}
      {isConfirmBackOpen && (
        <div className="fixed inset-0 bg-[#16324f]/45 flex items-start justify-center pt-[15vh] z-[100]" onClick={() => setIsConfirmBackOpen(false)}>
          <div className="bg-white rounded-[12px] w-[420px] shadow-[0_18px_50px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-[#dde4ec] flex items-center">
              <h3 className="text-[15px] text-[#16324f] font-semibold m-0">Alterações não salvas</h3>
              <button
                className="ml-auto border-0 bg-transparent text-[18px] text-[#5b6b7c] cursor-pointer hover:text-[#16324f]"
                onClick={() => setIsConfirmBackOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="p-6 text-[14px] text-[#26313d]">
              Você deseja salvar as modificações?
            </div>
            <footer className="px-5 py-3.5 border-t border-[#dde4ec] flex justify-end gap-2.5 bg-[#fafcfe] rounded-b-[12px]">
              <button
                onClick={() => setIsConfirmBackOpen(false)}
                className="border border-[#dde4ec] bg-white rounded-[7px] px-[12px] py-[8px] text-[13px] text-[#16324f] font-semibold cursor-pointer hover:bg-[#f4f7fa] transition-colors"
                disabled={isSavingRemaining}
              >
                Cancelar
              </button>
              <button
                onClick={() => {
                  setPendingAttachments([]);
                  setDeletedAttachmentIds([]);
                  setIsConfirmBackOpen(false);
                  setActiveScreen("lista");
                }}
                className="border border-[#dde4ec] bg-white rounded-[7px] px-[12px] py-[8px] text-[13px] text-[#b3261e] font-semibold cursor-pointer hover:bg-[#fdecea] transition-colors"
                disabled={isSavingRemaining}
              >
                Não
              </button>
              <button
                onClick={handleSaveAllRemaining}
                className="border-0 bg-[#2e7d32] rounded-[7px] px-[14px] py-[8px] text-[13px] text-white font-semibold cursor-pointer hover:bg-[#276b2b] transition-colors disabled:opacity-50"
                disabled={isSavingRemaining}
              >
                {isSavingRemaining ? "Salvando..." : "Sim"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMAR REMOÇÃO --- */}
      {isConfirmRemoveOpen && (
        <div className="fixed inset-0 bg-[#16324f]/45 flex items-start justify-center pt-[15vh] z-[100]" onClick={() => setIsConfirmRemoveOpen(false)}>
          <div className="bg-white rounded-[12px] w-[420px] shadow-[0_18px_50px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-[#dde4ec] flex items-center">
              <h3 className="text-[15px] text-[#16324f] font-semibold m-0">Remover Documento</h3>
              <button
                className="ml-auto border-0 bg-transparent text-[18px] text-[#5b6b7c] cursor-pointer hover:text-[#16324f]"
                onClick={() => setIsConfirmRemoveOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="p-6 text-[14px] text-[#26313d]">
              Tem certeza que deseja remover este documento do planejamento?
            </div>
            <footer className="px-5 py-3.5 border-t border-[#dde4ec] flex justify-end gap-2.5 bg-[#fafcfe] rounded-b-[12px]">
              <button
                onClick={() => setIsConfirmRemoveOpen(false)}
                className="border border-[#dde4ec] bg-white rounded-[7px] px-[12px] py-[8px] text-[13px] text-[#16324f] font-semibold cursor-pointer hover:bg-[#f4f7fa] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  if (attachmentToRemove && activePlan) {
                    try {
                      await contractPlanService.deleteAttachment(activePlan.id, attachmentToRemove);
                      setAttachments(prev => prev.filter(a => a.id !== attachmentToRemove));
                      toast.success("Documento removido com sucesso!");
                    } catch (error) {
                      console.error("Erro ao remover documento:", error);
                      toast.error("Erro ao remover documento.");
                    }
                  }
                  setIsConfirmRemoveOpen(false);
                  setAttachmentToRemove(null);
                }}
                className="border-0 bg-[#b3261e] rounded-[7px] px-[14px] py-[8px] text-[13px] text-white font-semibold cursor-pointer hover:bg-[#8c1d18] transition-colors"
              >
                Remover
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* --- MODAL: INICIAR PLANEJAMENTO --- */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-[#16324f]/45 flex items-start justify-center pt-[9vh] z-[100]" onClick={() => setIsPcaDropdownOpen(false)}>
          <div className="bg-white rounded-[12px] w-[520px] max-w-[94vw] shadow-[0_18px_50px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-[#dde4ec] flex items-center">
              <h3 className="text-[15px] text-[#16324f] font-semibold m-0">Iniciar Planejamento</h3>
              <button
                className="ml-auto border-0 bg-transparent text-[18px] text-[#5b6b7c] cursor-pointer hover:text-[#16324f]"
                onClick={closeCreateModal}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="p-5">
              <div className="mb-5">
                <label className="block text-[12px] font-semibold text-[#16324f] mb-1.5">Nº do PROAD <span className="text-[#b3261e]">*</span></label>
                <input
                  value={modalProad}
                  onChange={e => setModalProad(e.target.value)}
                  placeholder="Ex: 202605000760104"
                  className="w-full border border-[#dde4ec] rounded-[7px] px-3 py-2.5 text-[13.5px] bg-white text-[#26313d] outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#a5c8a7]"
                />
              </div>
              <div className="relative">
                <label className="block text-[12px] font-semibold text-[#16324f] mb-1.5">Item de PCA <span className="text-[#b3261e]">*</span></label>
                <div
                  className="w-full border border-[#dde4ec] rounded-[7px] px-3 py-2.5 text-[13.5px] bg-white text-[#26313d] outline-none focus-within:border-[#2e7d32] focus-within:ring-2 focus-within:ring-[#a5c8a7] cursor-text flex items-center"
                  onClick={() => setIsPcaDropdownOpen(true)}
                >
                  <input
                    value={pcaSearchQuery}
                    onChange={e => {
                      setPcaSearchQuery(e.target.value);
                      setIsPcaDropdownOpen(true);
                      if (modalSelectedPca) setModalSelectedPca(""); // clear selection if they type
                    }}
                    onFocus={() => setIsPcaDropdownOpen(true)}
                    placeholder="Pesquise por número ou objeto..."
                    className="w-full bg-transparent border-0 outline-none p-0 text-[13.5px]"
                  />
                  <div className="text-[#5b6b7c] cursor-pointer" onClick={() => setIsPcaDropdownOpen(!isPcaDropdownOpen)}>▼</div>
                </div>

                {isPcaDropdownOpen && (
                  <div className="absolute z-[10] mt-1 w-full bg-white border border-[#dde4ec] rounded-[7px] shadow-lg max-h-60 overflow-y-auto">
                    {pcaItems
                      .filter(item => {
                        const term = pcaSearchQuery.toLowerCase();
                        const pCode = item.itemPca || item.item_pca || "";
                        return String(item.id).includes(term) || String(pCode).toLowerCase().includes(term) || (item.objeto || "").toLowerCase().includes(term);
                      })
                      .map(item => {
                        const pCodeRaw = item.itemPca || item.item_pca;
                        const label = pCodeRaw ? `Item ${pCodeRaw.replace(/^0+/, '')}` : `PCA ${item.id}`;
                        const display = `${label} — ${item.objeto} · ${formatCurrency(item.valor_estimado ? item.valor_estimado * 100 : 0)}`;
                        return (
                          <div
                            key={item.id}
                            className="px-3 py-2 hover:bg-[#f4f7fa] cursor-pointer text-[13px] text-[#26313d] border-b border-[#f4f7fa] last:border-0"
                            onClick={() => {
                              setModalSelectedPca(String(item.id));
                              setPcaSearchQuery(display);
                              setIsPcaDropdownOpen(false);
                            }}
                          >
                            {display}
                          </div>
                        );
                      })}
                    {pcaItems.filter(item => {
                      const term = pcaSearchQuery.toLowerCase();
                      const pCode = item.itemPca || item.item_pca || "";
                      return String(item.id).includes(term) || String(pCode).toLowerCase().includes(term) || (item.objeto || "").toLowerCase().includes(term);
                    }).length === 0 && (
                        <div className="px-3 py-3 text-center text-[#5b6b7c] text-[12.5px]">Nenhum item encontrado.</div>
                      )}
                  </div>
                )}
              </div>
            </div>
            <footer className="px-5 py-3.5 border-t border-[#dde4ec] flex justify-end gap-2.5 bg-[#fafcfe] rounded-b-[12px]">
              <button
                onClick={closeCreateModal}
                className="border border-[#dde4ec] bg-white rounded-[7px] px-[12px] py-[8px] text-[13px] text-[#16324f] font-semibold cursor-pointer hover:bg-[#f4f7fa] transition-colors"
                disabled={creating}
              >
                Cancelar
              </button>
              <button
                onClick={handleCreatePlan}
                className="border-0 bg-[#2e7d32] rounded-[7px] px-[14px] py-[8px] text-[13px] text-white font-semibold cursor-pointer hover:bg-[#276b2b] transition-colors disabled:opacity-50"
                disabled={creating || !modalProad || !modalSelectedPca}
              >
                {creating ? "Iniciando..." : "Iniciar Planejamento"}
              </button>
            </footer>
          </div>
        </div>
      )}

      {/* --- MODAL: CONFIRMAR EXCLUSÃO IPC --- */}
      {isConfirmDeletePlanOpen && (
        <div className="fixed inset-0 bg-[#16324f]/45 flex items-start justify-center pt-[15vh] z-[100]" onClick={() => setIsConfirmDeletePlanOpen(false)}>
          <div className="bg-white rounded-[12px] w-[420px] shadow-[0_18px_50px_rgba(0,0,0,0.25)] animate-in fade-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <header className="px-5 py-4 border-b border-[#dde4ec] flex items-center">
              <h3 className="text-[15px] text-[#16324f] font-semibold m-0">Excluir Planejamento</h3>
              <button
                className="ml-auto border-0 bg-transparent text-[18px] text-[#5b6b7c] cursor-pointer hover:text-[#16324f]"
                onClick={() => setIsConfirmDeletePlanOpen(false)}
                aria-label="Fechar"
              >
                ×
              </button>
            </header>
            <div className="p-6 text-[14px] text-[#26313d]">
              Tem certeza que deseja excluir permanentemente esta Instrução de Planejamento da Contratação?
            </div>
            <footer className="px-5 py-3.5 border-t border-[#dde4ec] flex justify-end gap-2.5 bg-[#fafcfe] rounded-b-[12px]">
              <button
                onClick={() => setIsConfirmDeletePlanOpen(false)}
                className="border border-[#dde4ec] bg-white rounded-[7px] px-[12px] py-[8px] text-[13px] text-[#16324f] font-semibold cursor-pointer hover:bg-[#f4f7fa] transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleDeletePlan}
                className="border border-[#dde4ec] bg-[#b3261e] rounded-[7px] px-[12px] py-[8px] text-[13px] text-white font-semibold cursor-pointer hover:bg-[#9a2119] transition-colors"
              >
                Excluir
              </button>
            </footer>
          </div>
        </div>
      )}

    </Layout>
  );
}
