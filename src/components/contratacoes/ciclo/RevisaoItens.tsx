import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Loader2, Lock, Plus, Search as SearchIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { pcaApi } from "@/services/pcaApi";
import { areasApi, type Area, type Unidade } from "@/services/areasApi";
import { cicloOrcamentarioApi, type EdicaoItemRevisao } from "@/services/cicloOrcamentarioApi";
import type { PcaItem } from "@/types";
import { MESES_ORDENADOS } from "@/types";

const STATUS_OPCOES = ["Não Iniciada", "Em andamento", "Concluída"];
const TODAS = "todas";

function formatValueBRL(val?: number | string) {
  if (val === undefined || val === null || val === "") return "";
  const num = Number(val);
  if (isNaN(num)) return "";
  return num.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizePriority(val?: string) {
  if (!val) return "";
  const v = val.toUpperCase();
  if (v === "ALTO" || v === "1") return "Alto";
  if (v === "MEDIO" || v === "MÉDIO" || v === "2") return "Médio";
  if (v === "BAIXO" || v === "3") return "Baixo";
  return val;
}

function normalizeStep(val?: string) {
  if (!val) return "";
  const v = val.toUpperCase();
  if (v === "PLANEJAMENTO_DA_CONTRATACAO" || v === "PLANEJAMENTO DA CONTRATAÇÃO") return "Planejamento da Contratação";
  if (v === "SELECAO_DE_FORNECEDOR" || v === "SELEÇÃO DE FORNECEDOR") return "Seleção de Fornecedor";
  if (v === "GESTAO_DO_CONTRATO" || v === "GESTÃO DO CONTRATO") return "Gestão do Contrato";
  return val;
}

function normalizeResourceType(val?: string) {
  if (!val) return "";
  const v = val.toUpperCase();
  if (v === "CUSTEIO") return "Custeio";
  if (v === "INVESTIMENTO") return "Investimento";
  return val;
}

export function RevisaoItens({
  anoVigente,
  podeEditarItem,
  podeAdicionar,
  estadoCiclo,
}: {
  anoVigente: number;
  podeEditarItem: boolean;
  podeAdicionar: boolean;
  estadoCiclo?: string;
}) {
  const [itens, setItens] = useState<PcaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [area, setArea] = useState<string>(TODAS);
  const [searchTerm, setSearchTerm] = useState("");

  const [diretoriasList, setDiretoriasList] = useState<Area[]>([]);
  const [unidadesList, setUnidadesList] = useState<Unidade[]>([]);

  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editando, setEditando] = useState<PcaItem | null>(null);

  const [formData, setFormData] = useState<EdicaoItemRevisao & { item_pca?: string; ano?: number }>({});
  const [formErrors, setFormErrors] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const carregar = useCallback(async () => {
    setLoading(true);
    try {
      setItens(await pcaApi.getPcaItems(anoVigente));
    } catch {
      setItens([]);
    } finally {
      setLoading(false);
    }
  }, [anoVigente]);

  useEffect(() => {
    carregar();
    areasApi.getAll().then(setDiretoriasList).catch(() => {});
  }, [carregar]);

  useEffect(() => {
    if (formData.id_diretoria) {
      areasApi.getUnidades(formData.id_diretoria).then(setUnidadesList).catch(() => setUnidadesList([]));
    } else {
      setUnidadesList([]);
    }
  }, [formData.id_diretoria]);

  const areas = useMemo(
    () => Array.from(new Set(itens.map((i) => i.area_demandante).filter(Boolean))).sort(),
    [itens],
  );

  const visiveis = useMemo(() => {
    let list = area === TODAS ? itens : itens.filter((i) => i.area_demandante === area);
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(
        (i) =>
          i.item_pca?.toLowerCase().includes(term) ||
          i.description?.toLowerCase().includes(term) ||
          i.objeto?.toLowerCase().includes(term) ||
          i.area_demandante?.toLowerCase().includes(term)
      );
    }
    return list;
  }, [itens, area, searchTerm]);

  function formatPcaCode(code?: string) {
    if (!code) return "—";
    const num = parseInt(code, 10);
    return isNaN(num) ? code : `PCA ${num}`;
  }

  function handleCurrencyChange(field: "valor_estimado" | "valor_formalizado", value: string) {
    const numericStr = value.replace(/\D/g, "");
    const numericValue = numericStr ? parseInt(numericStr, 10) / 100 : 0;
    setFormData((prev) => ({ ...prev, [field]: numericValue }));
  }

  function resetForm() {
    setFormData({
      item_pca: "",
      tipo: "Contratação",
      area_demandante: "",
      id_diretoria: undefined,
      id_area_demandante: undefined,
      objeto: "",
      valor_estimado: 0,
      valor_formalizado: 0,
      data_estimada_contratacao: "",
      status: "Não Iniciada",
      ano: anoVigente,
      process: "",
      description: "",
      justification: "",
      financial_resource_type: "",
      priority: "",
      step: "",
    });
    setFormErrors([]);
  }

  function openAddModal() {
    resetForm();
    setIsAddModalOpen(true);
  }

  function openEditModal(item: PcaItem) {
    setEditando(item);
    setFormData({
      item_pca: item.code || item.item_pca,
      tipo: item.contract_type || item.tipo || "Contratação",
      area_demandante: item.directory_acronym || item.area_demandante,
      id_diretoria: item.cadastros_areas_id ?? item.cadastrosAreasId ?? undefined,
      id_area_demandante: item.cadastros_unidades_id ?? item.cadastrosUnidadesId ?? undefined,
      objeto: item.object_name || item.objeto,
      valor_estimado: item.estimated_value_cents ? item.estimated_value_cents / 100 : item.valor_estimado,
      valor_formalizado: item.valor_formalizado || 0,
      data_estimada_contratacao: item.estimated_date || item.data_estimada_contratacao,
      status: item.status?.toString() || "Não Iniciada",
      process: item.process || "",
      description: item.description || "",
      justification: item.justification || "",
      financial_resource_type: normalizeResourceType(item.financial_resource_type) || "",
      priority: normalizePriority(item.priority) || "",
      step: normalizeStep(item.step) || "",
    });
    setFormErrors([]);
    setIsEditModalOpen(true);
  }

  function validateForm(isEdit: boolean): boolean {
    const errors: string[] = [];
    if (!formData.item_pca?.trim()) {
      errors.push("Item do PCA é obrigatório");
    } else if (formData.item_pca.length > 50) {
      errors.push("Item do PCA deve ter no máximo 50 caracteres");
    }
    if (!formData.valor_estimado || formData.valor_estimado <= 0) {
      errors.push("Valor anual estimado deve ser maior que zero");
    }
    if (!formData.data_estimada_contratacao) {
      errors.push("Data estimada de contratação é obrigatória");
    }
    setFormErrors(errors);
    return errors.length === 0;
  }

  async function handleAdd() {
    if (!validateForm(false)) return;
    setSalvando(true);
    try {
      const created = await cicloOrcamentarioApi.adicionarItemRevisao(formData as Partial<PcaItem>);
      setItens((prev) => [...prev, created]);
      toast.success("Novo item PCA adicionado.");
      setIsAddModalOpen(false);
    } catch {
      toast.error("Não foi possível adicionar o item PCA.");
    } finally {
      setSalvando(false);
    }
  }

  async function handleEdit() {
    if (!editando || !validateForm(true)) return;
    setSalvando(true);
    try {
      const atualizado = await cicloOrcamentarioApi.editarItemRevisao(editando.id, formData);
      setItens((prev) => prev.map((i) => (i.id === atualizado.id ? { ...i, ...atualizado } : i)));
      toast.success("Item revisado.");
      setIsEditModalOpen(false);
      setEditando(null);
    } catch {
      toast.error("Não foi possível salvar a revisão deste item.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* Header com filtros e botões */}
      <div className="flex flex-col gap-4 bg-gray-100 p-4 rounded-xl border border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-800">
              Itens do PCA-TIC {anoVigente}
            </h3>
            {!podeEditarItem && (
              <span className="ml-2 inline-flex items-center gap-1 text-xs font-normal text-slate-400">
                <Lock className="h-3 w-3" /> somente leitura
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative w-[240px]">
              <SearchIcon className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Pesquisar itens..."
                className="pl-9 h-9 bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={area} onValueChange={setArea}>
              <SelectTrigger className="w-[200px] h-9 bg-white">
                <SelectValue placeholder="Área" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={TODAS}>Todas as áreas</SelectItem>
                {areas.map((a) => (
                  <SelectItem key={a} value={a}>
                    {a}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {podeAdicionar && (
              <Button onClick={openAddModal} className="h-9 bg-blue-600 hover:bg-blue-700 text-white">
                <Plus className="h-4 w-4 mr-2" />
                Adicionar
              </Button>
            )}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <LoadingSpinner />
        </div>
      ) : visiveis.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 py-12 text-center text-gray-500">
          <p className="text-sm">Nenhum item encontrado para esta revisão.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {visiveis.map((item) => {
            const isRenovacao = item.tipo === "Renovação" || item.contract_type === "Renovação";
            return (
              <div
                key={item.id}
                className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:border-blue-100 hover:shadow-md transition-all duration-200"
              >

                <div className="flex-1 min-w-0 flex gap-4">
                  {/* Left Column: PCA Badge and Area */}
                  <div className="w-24 shrink-0 flex flex-col gap-1 items-center justify-center">
                    <Badge variant="secondary" className="font-mono bg-gray-100 text-gray-700 hover:bg-gray-200">
                      {formatPcaCode(item.item_pca || item.code)}
                    </Badge>
                    <span className="text-xs font-bold text-gray-700 text-center">{item.area_demandante}</span>
                  </div>

                  {/* Right Column: Object and Status */}
                  <div className="flex-1 min-w-0 flex flex-col gap-1">
                    <span className="text-sm font-semibold text-gray-900 truncate pt-0.5">
                      {item.description || item.objeto || "Sem objeto"}
                    </span>
                    <div className="flex items-center gap-3 text-xs text-gray-500">
                      <span>Status: {typeof item.status === "string" ? item.status : "Não Iniciada"}</span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col items-end gap-1 px-4">
                  <span className="text-sm font-bold text-gray-900">
                    {formatValueBRL(item.valor_estimado)}
                  </span>
                  <span className="text-xs text-slate-500 mt-1">
                    Prazo: {item.data_estimada_contratacao || "Não definido"}
                  </span>
                </div>

                {podeEditarItem && (
                  <div className="pl-4 border-l border-gray-100">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => openEditModal(item)}>
                      <Pencil className="h-4 w-4 text-gray-500" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL (Adicionar/Editar) reutiliza os mesmos campos */}
      <Dialog
        open={isAddModalOpen || isEditModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsAddModalOpen(false);
            setIsEditModalOpen(false);
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-white">
          <DialogHeader>
            <DialogTitle>{isAddModalOpen ? "Adicionar Item PCA" : `Editar Item ${formatPcaCode(editando?.item_pca)}`}</DialogTitle>
            <DialogDescription>
              Preencha os dados do item. Campos com * são obrigatórios.
            </DialogDescription>
          </DialogHeader>

          {formErrors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4">
              <p className="text-sm font-medium text-red-800">Corrija os erros abaixo:</p>
              <ul className="list-disc list-inside text-sm text-red-700 mt-1">
                {formErrors.map((error, index) => (
                  <li key={index}>{error}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 py-4">
            {/* Linha 1 - 4 colunas */}
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="item_pca">Item do PCA *</Label>
                <Input
                  id="item_pca"
                  placeholder="Ex: 0230"
                  value={formData.item_pca || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setFormData({ ...formData, item_pca: val });
                  }}
                  disabled={isEditModalOpen} // não permite alterar o código se for edição (só backend pode autorizar em tese, mas seguimos o padrão)
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ano">Ano *</Label>
                <Input id="ano" type="number" value={formData.ano || anoVigente} disabled />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <Select
                  value={formData.tipo || "Contratação"}
                  onValueChange={(v) => setFormData({ ...formData, tipo: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Contratação">Nova</SelectItem>
                    <SelectItem value="Renovação">Renovação</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_estimada">Prazo Estimado (Mês) *</Label>
                <Select
                  value={formData.data_estimada_contratacao || ""}
                  onValueChange={(value) => setFormData({ ...formData, data_estimada_contratacao: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Mês" /></SelectTrigger>
                  <SelectContent>
                    {MESES_ORDENADOS.map((mes) => (
                      <SelectItem key={mes} value={mes}>{mes}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Linha 2 e 3 - Diretoria e Área */}
            <div className="space-y-2">
              <Label htmlFor="id_diretoria">Diretoria</Label>
              <Select
                value={formData.id_diretoria ? String(formData.id_diretoria) : undefined}
                onValueChange={(v) => {
                  const dirId = parseInt(v, 10);
                  const unidade = diretoriasList.find(d => d.id === dirId);
                  setFormData({
                    ...formData,
                    id_diretoria: dirId,
                    area_demandante: unidade?.nome || "",
                    id_area_demandante: undefined
                  });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione a Diretoria" /></SelectTrigger>
                <SelectContent>
                  {diretoriasList.map(dir => (
                    <SelectItem key={dir.id} value={String(dir.id)}>
                      {dir.sigla ? `${dir.sigla} - ${dir.nome}` : dir.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="id_area_demandante">Área Demandante</Label>
              <Select
                value={formData.id_area_demandante ? String(formData.id_area_demandante) : undefined}
                onValueChange={(v) => setFormData({ ...formData, id_area_demandante: parseInt(v, 10) })}
                disabled={!formData.id_diretoria}
              >
                <SelectTrigger><SelectValue placeholder="Selecionar área responsável..." /></SelectTrigger>
                <SelectContent>
                  {unidadesList.map(u => {
                    const dir = diretoriasList.find(d => d.id === formData.id_diretoria);
                    const sigla = dir?.sigla || dir?.nome;
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome} {sigla ? `(${sigla})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            {/* Outros campos de texto */}
            <div className="space-y-2">
              <Label htmlFor="objeto">Objeto</Label>
              <Input
                id="objeto"
                placeholder="Descrição detalhada da contratação"
                value={formData.objeto || ""}
                onChange={(e) => setFormData({ ...formData, objeto: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Demanda da Unidade</Label>
              <Textarea
                id="description"
                rows={2}
                value={formData.description || ""}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="justification">Justificativa</Label>
              <Textarea
                id="justification"
                rows={2}
                value={formData.justification || ""}
                onChange={(e) => setFormData({ ...formData, justification: e.target.value })}
              />
            </div>

            {/* Linha Recurso / Prioridade */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Recurso</Label>
                <Select
                  value={formData.financial_resource_type || undefined}
                  onValueChange={(value) => setFormData({ ...formData, financial_resource_type: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Investimento">Investimento</SelectItem>
                    <SelectItem value="Custeio">Custeio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select
                  value={formData.priority || undefined}
                  onValueChange={(value) => setFormData({ ...formData, priority: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Alto">Alto</SelectItem>
                    <SelectItem value="Médio">Médio</SelectItem>
                    <SelectItem value="Baixo">Baixo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Valores */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Valor Global Estimado (R$) *</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <Input
                    className="pl-9"
                    value={formData.valor_estimado ? formatValueBRL(formData.valor_estimado).replace("R$", "").trim() : ""}
                    onChange={(e) => handleCurrencyChange("valor_estimado", e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Valor {anoVigente} (R$)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-medium">R$</span>
                  <Input
                    className="pl-9"
                    value={formData.valor_formalizado ? formatValueBRL(formData.valor_formalizado).replace("R$", "").trim() : ""}
                    onChange={(e) => handleCurrencyChange("valor_formalizado", e.target.value)}
                  />
                </div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>PROAD</Label>
                <Input
                  value={formData.process || ""}
                  onChange={(e) => setFormData({ ...formData, process: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select
                  value={formData.status || "Não Iniciada"}
                  onValueChange={(value) => setFormData({ ...formData, status: value })}
                >
                  <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPCOES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddModalOpen(false);
                setIsEditModalOpen(false);
              }}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button onClick={isAddModalOpen ? handleAdd : handleEdit} disabled={salvando} className="bg-blue-600 hover:bg-blue-700 text-white">
              {salvando && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
