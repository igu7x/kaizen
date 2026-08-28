import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Trash2, Download, Edit, ArrowLeft } from "lucide-react";
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
  const [savingNote, setSavingNote] = useState(false);
  const notesEndRef = useRef<HTMLDivElement>(null);

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

      const pCodeRaw = pca.itemPca || pca.item_pca;
      const payload = {
        pcaCode: pCodeRaw ? pCodeRaw.replace(/^0+/, '') : String(pca.id),
        pcaYear: String(new Date().getFullYear()),
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
        loaReference: activePlan.loaReference || ""
      };

      const updatedPlan = await contractPlanService.update(activePlan.id, payload);
      setActivePlan(updatedPlan);
      setIsEditingValue(false);
      toast.success("Valor estimado atualizado!");
    } catch (error) {
      console.error("Erro ao atualizar valor:", error);
      toast.error("Erro ao atualizar o valor estimado.");
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
      await contractPlanService.addNoteRecord(activePlan.id, newRecordText.trim());
      setNewRecordText("");
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

  const getStatusTag = (step: number = 0) => {
    if (step === 0) return <span className="inline-block text-[11px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap bg-[#e3f2fd] text-[#1565c0]">Submetida à CCA</span>;
    if (step === 1) return <span className="inline-block text-[11px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap bg-[#ede7f6] text-[#5e35b1]">Em Análise Preliminar</span>;
    if (step === 2) return <span className="inline-block text-[11px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap bg-[#fdecea] text-[#b3261e]">Devolvida ao Demandante</span>;
    return <span className="inline-block text-[11px] font-semibold rounded-full px-2.5 py-0.5 whitespace-nowrap bg-[#e8f5e9] text-[#2e7d32]">Em Instrução</span>;
  };

  const formatDate = (d?: string) => d ? new Date(d).toLocaleDateString('pt-BR') : '-';
  const formatDateTime = (d?: string) => {
    if (!d) return '-';
    const date = new Date(d);
    return `${date.toLocaleDateString('pt-BR')} ${date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`;
  };

  const filteredPlans = plans.filter(p => selectedUnit === "Todas as unidades" || p.unidadeNome === selectedUnit || p.areaSigla === selectedUnit);

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

  const recebidasCount = plans.filter(p => p.step === 0).length;
  const analiseCount = plans.filter(p => p.step === 1).length;
  const devolvidasCount = plans.filter(p => p.step === 2).length;
  const instrucaoCount = plans.filter(p => p.step === 3 || (p.step !== 0 && p.step !== 1 && p.step !== 2)).length;

  return (
    <Layout>
      <div className="w-full h-full p-6 flex flex-col text-[#26313d] font-sans">

        {/* --- TELA: FILA CCA --- */}
        {activeScreen === "lista" && (
          <div className="animate-in fade-in duration-300">
            <Breadcrumbs items={[{ label: "Planejamento da Contratação" }]} className="mb-2.5" />
            <div className="flex items-center gap-4 mb-6 flex-wrap">
              <div className="flex-1"></div>
              <select
                className="border border-[#dde4ec] rounded-[7px] px-2.5 py-2 text-[13px] bg-white outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#a5c8a7] transition-all"
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
                  className="border-0 bg-[#2e7d32] rounded-[7px] px-[18px] py-[10px] text-[13.5px] text-white font-semibold cursor-pointer hover:bg-[#276b2b] transition-colors shadow-sm"
                >
                  + Iniciar Contratação
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-white border border-[#dde4ec] rounded-[10px] p-4 shadow-sm">
                <div className="text-2xl font-bold text-[#1565c0]">{recebidasCount}</div>
                <div className="text-xs text-[#5b6b7c] mt-1">Recebidas — aguardando análise</div>
              </div>
              <div className="bg-white border border-[#dde4ec] rounded-[10px] p-4 shadow-sm">
                <div className="text-2xl font-bold text-[#b26a00]">{analiseCount}</div>
                <div className="text-xs text-[#5b6b7c] mt-1">Em análise preliminar</div>
              </div>
              <div className="bg-white border border-[#dde4ec] rounded-[10px] p-4 shadow-sm">
                <div className="text-2xl font-bold text-[#16324f]">{devolvidasCount}</div>
                <div className="text-xs text-[#5b6b7c] mt-1">Devolvidas ao demandante</div>
              </div>
              <div className="bg-white border border-[#dde4ec] rounded-[10px] p-4 shadow-sm">
                <div className="text-2xl font-bold text-[#2e7d32]">{instrucaoCount}</div>
                <div className="text-xs text-[#5b6b7c] mt-1">Em instrução</div>
              </div>
            </div>

            <div className="bg-white border border-[#dde4ec] rounded-[10px] overflow-hidden shadow-sm">
              <header className="px-6 py-4 border-b border-[#dde4ec] flex items-center">
                <h3 className="text-[14.5px] text-[#16324f] font-semibold">Instruções de Planejamento da Contratação</h3>
              </header>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[13px]">
                  <thead>
                    <tr>
                      <th className="text-[11.5px] uppercase tracking-[.5px] text-[#5b6b7c] px-3 py-2.5 border-b border-[#dde4ec] font-semibold bg-white">IPC</th>
                      <th className="text-[11.5px] uppercase tracking-[.5px] text-[#5b6b7c] px-3 py-2.5 border-b border-[#dde4ec] font-semibold bg-white">Objeto</th>
                      <th className="text-[11.5px] uppercase tracking-[.5px] text-[#5b6b7c] px-3 py-2.5 border-b border-[#dde4ec] font-semibold bg-white">Unidade</th>
                      <th className="text-[11.5px] uppercase tracking-[.5px] text-[#5b6b7c] px-3 py-2.5 border-b border-[#dde4ec] font-semibold bg-white">Item de PCA</th>
                      <th className="text-[11.5px] uppercase tracking-[.5px] text-[#5b6b7c] px-3 py-2.5 border-b border-[#dde4ec] font-semibold bg-white">Recebida em</th>
                      <th className="text-[11.5px] uppercase tracking-[.5px] text-[#5b6b7c] px-3 py-2.5 border-b border-[#dde4ec] font-semibold bg-white">Situação</th>
                      <th className="text-[11.5px] uppercase tracking-[.5px] text-[#5b6b7c] px-3 py-2.5 border-b border-[#dde4ec] font-semibold bg-white"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-[#5b6b7c]">
                          <div className="flex justify-center"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-[#2e7d32]"></div></div>
                        </td>
                      </tr>
                    ) : filteredPlans.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="px-3 py-8 text-center text-[#5b6b7c]">Nenhuma demanda encontrada na fila.</td>
                      </tr>
                    ) : (
                      filteredPlans.map(plan => (
                        <tr key={plan.id} className="hover:bg-[#f8fafc] group transition-colors cursor-pointer" onClick={() => {
                          setSelectedPlanId(plan.id);
                          setActiveScreen("detalhe");
                        }}>
                          <td className="px-3 py-2.5 border-b border-[#eef2f6] font-bold text-[#16324f] whitespace-nowrap">
                            {plan.ipcCode || `IPC-${plan.pcaYear || "2026"}-00${plan.id}`}
                          </td>
                          <td className="px-3 py-2.5 border-b border-[#eef2f6] text-[#26313d]">{plan.objectName || "Sem Objeto"}</td>
                          <td className="px-3 py-2.5 border-b border-[#eef2f6] text-[#26313d]">{plan.areaSigla || plan.cadastrosAreasId || "-"}</td>
                          <td className="px-3 py-2.5 border-b border-[#eef2f6] text-[#5b6b7c] text-[12px]">
                            Item {plan.pcaCode}/{plan.pcaYear}
                          </td>
                          <td className="px-3 py-2.5 border-b border-[#eef2f6] text-[#5b6b7c] text-[12px]">
                            {plan.estimatedDate ? new Date(plan.estimatedDate).toLocaleDateString('pt-BR') : '14/08/2026'}
                          </td>
                          <td className="px-3 py-2.5 border-b border-[#eef2f6]">
                            {getStatusTag(plan.step)}
                          </td>
                          <td className="px-3 py-2.5 border-b border-[#eef2f6] text-right">
                            <div className="flex gap-2 justify-end">
                              {isSuperAdmin && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeletePlanId(plan.id);
                                    setIsConfirmDeletePlanOpen(true);
                                  }}
                                  className="text-[#b3261e] hover:bg-[#fdecea] p-1.5 rounded-full transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 size={18} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
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
              {getStatusTag(activePlan.step)}
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
                      <li key={note.id} className="relative pl-9 pb-6 before:content-[''] before:absolute before:-left-[9px] before:top-1 before:w-[16px] before:h-[16px] before:rounded-full before:bg-white before:border-[4px] before:border-[#2e7d32] after:content-[''] after:absolute after:-left-[2px] after:top-[20px] after:w-[2px] after:h-[calc(100%-16px)] after:bg-[#dde4ec] last:after:hidden">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-[#16324f] text-[13.5px]">{note.isSystemEvent ? "Sistema" : note.createdBy || "Usuário"}</span>
                          <span className="text-[12px] text-[#5b6b7c]">{formatDateTime(note.createdAt)}</span>
                        </div>
                        <p className="text-[14px] mt-1.5 text-[#26313d] whitespace-pre-wrap">{note.message}</p>
                      </li>
                    ))}
                  </ul>
                  <div ref={notesEndRef} />
                </div>

                {isSuperAdmin && (
                  <div className="mt-2 mb-6 relative">
                    <label className="block text-[13px] font-semibold text-[#16324f] mb-2">Novo registro</label>
                    <textarea
                      value={newRecordText}
                      onChange={(e) => setNewRecordText(e.target.value)}
                      className="w-full border border-[#dde4ec] rounded-[7px] px-4 py-3 text-[14px] bg-white text-[#26313d] outline-none focus:border-[#2e7d32] focus:ring-2 focus:ring-[#a5c8a7] min-h-[100px] resize-y"
                      placeholder="Registrar despacho, solicitação ao demandante ou anotação de análise..."
                    ></textarea>
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
                onClick={() => {
                  if (attachmentToRemove) {
                    setDeletedAttachmentIds(prev => [...prev, attachmentToRemove]);
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
