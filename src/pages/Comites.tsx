/**
 * Página de Seleção de Comitês
 * Exibe os comitês disponíveis para seleção, filtrados por domínio
 */

import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { comitesApi } from "@/services/comitesApi";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { useAuth } from "@/contexts/AuthContext";
import type { Comite } from "@/types";
import {
  Megaphone,
  Users,
  Shield,
  ShieldCheck,
  Workflow,
  AlertTriangle,
  Lightbulb,
  Scale,
  ChevronRight,
  Network,
  Loader2,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

// Mapeamento de ícones
const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  megafone: Megaphone,
  pessoas: Users,
  "pessoa-escudo": ShieldCheck,
  escudo: Shield,
  diagrama: Workflow,
  "relogio-alerta": AlertTriangle,
  lampada: Lightbulb,
  balanca: Scale,
  rede: Network,
};

const iconOptions = [
  { value: "megafone", label: "Megafone" },
  { value: "pessoas", label: "Pessoas" },
  { value: "pessoa-escudo", label: "Pessoa com Escudo" },
  { value: "escudo", label: "Escudo" },
  { value: "diagrama", label: "Diagrama" },
  { value: "relogio-alerta", label: "Alerta" },
  { value: "lampada", label: "Lâmpada" },
  { value: "balanca", label: "Balança" },
  { value: "rede", label: "Rede" },
];

const colorPresets = [
  "#1565C0",
  "#0277BD",
  "#00838F",
  "#00695C",
  "#2E7D32",
  "#558B2F",
  "#F57F17",
  "#EF6C00",
  "#D84315",
  "#AD1457",
  "#6A1B9A",
  "#4527A0",
  "#283593",
  "#37474F",
];

export default function Comites() {
  const navigate = useNavigate();
  const { selectedAreaId, selectedArea } = useDirectorate();
  const { user } = useAuth();
  const [comites, setComites] = useState<Comite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Dialog state for new comite
  const [dialogOpen, setDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newComite, setNewComite] = useState({
    nome: "",
    sigla: "",
    descricao: "",
    cor: "#1565C0",
    icone: "megafone",
  });

  // Edit dialog state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingComite, setEditingComite] = useState<Comite | null>(null);

  const isAdmin = user?.role === "ADMIN";

  const handleEditComite = (e: React.MouseEvent, comite: Comite) => {
    e.stopPropagation();
    setEditingComite(comite);
    setNewComite({
      nome: comite.nome,
      sigla: comite.sigla,
      descricao: comite.descricao || "",
      cor: comite.cor || "#1565C0",
      icone: comite.icone || "megafone",
    });
    setEditDialogOpen(true);
  };

  const handleSaveEdit = async () => {
    if (!editingComite || !newComite.nome.trim() || !newComite.sigla.trim())
      return;
    try {
      setCreating(true);
      await comitesApi.update(editingComite.id, {
        nome: newComite.nome.trim(),
        descricao: newComite.descricao.trim() || undefined,
        cor: newComite.cor,
        icone: newComite.icone,
      });
      setEditDialogOpen(false);
      setEditingComite(null);
      setNewComite({
        nome: "",
        sigla: "",
        descricao: "",
        cor: "#1565C0",
        icone: "megafone",
      });
      await loadComites();
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteComite = async (e: React.MouseEvent, comite: Comite) => {
    e.stopPropagation();
    if (!confirm(`Excluir o comitê "${comite.nome}"?`)) return;
    try {
      await comitesApi.remove(comite.id);
      await loadComites();
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  useEffect(() => {
    loadComites();
  }, [selectedAreaId]);

  const loadComites = async () => {
    try {
      setLoading(true);
      const data = await comitesApi.getAll(selectedArea?.dominio || undefined);
      setComites(data);
      setError(null);
    } catch (err: any) {
      setError("Erro ao carregar comitês. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const handleComiteClick = (comite: Comite) => {
    navigate(`/comites/${comite.sigla.toLowerCase()}`);
  };

  const getIcon = (icone: string | null) => {
    if (!icone) return Megaphone;
    return iconMap[icone] || Megaphone;
  };

  const handleCreateComite = async () => {
    if (!newComite.nome.trim() || !newComite.sigla.trim()) return;

    try {
      setCreating(true);
      await comitesApi.create({
        nome: newComite.nome.trim(),
        sigla: newComite.sigla.trim().toUpperCase(),
        descricao: newComite.descricao.trim() || undefined,
        cor: newComite.cor,
        icone: newComite.icone,
        dominio: selectedArea?.dominio || undefined,
      });
      setDialogOpen(false);
      setNewComite({
        nome: "",
        sigla: "",
        descricao: "",
        cor: "#1565C0",
        icone: "megafone",
      });
      await loadComites();
    } catch (err: any) {
      setError(err.message || "Erro ao criar comitê.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Layout>
      <div className="min-h-screen bg-white page-transition-enter">
        <div className="mx-auto px-6 py-8 max-w-[1600px]">
          <div className="mb-10 flex items-center justify-between">
            <div className="flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-blue-600 flex items-center justify-center">
                <Megaphone className="h-7 w-7 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 leading-tight">
                  Comitês
                </h2>
                <p className="text-sm text-gray-600 mt-1">
                  Selecione um comitê para acessar
                </p>
              </div>
            </div>

            {isAdmin && (
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="gap-2">
                    <Plus className="h-4 w-4" />
                    Novo Comitê
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[500px]">
                  <DialogHeader>
                    <DialogTitle>Novo Comitê</DialogTitle>
                    <DialogDescription>
                      Preencha os dados para criar um novo comitê.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="nome">Nome *</Label>
                      <Input
                        id="nome"
                        value={newComite.nome}
                        onChange={(e) =>
                          setNewComite((prev) => ({
                            ...prev,
                            nome: e.target.value,
                          }))
                        }
                        placeholder="Ex: Comitê de Governança"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="sigla">Sigla *</Label>
                      <Input
                        id="sigla"
                        value={newComite.sigla}
                        onChange={(e) =>
                          setNewComite((prev) => ({
                            ...prev,
                            sigla: e.target.value.toUpperCase(),
                          }))
                        }
                        placeholder="Ex: CGOV"
                        maxLength={20}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="descricao">Descrição</Label>
                      <Input
                        id="descricao"
                        value={newComite.descricao}
                        onChange={(e) =>
                          setNewComite((prev) => ({
                            ...prev,
                            descricao: e.target.value,
                          }))
                        }
                        placeholder="Descrição do comitê (opcional)"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Ícone</Label>
                      <Select
                        value={newComite.icone}
                        onValueChange={(value) =>
                          setNewComite((prev) => ({ ...prev, icone: value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione um ícone" />
                        </SelectTrigger>
                        <SelectContent>
                          {iconOptions.map((opt) => {
                            const IconComp = iconMap[opt.value] || Megaphone;
                            return (
                              <SelectItem key={opt.value} value={opt.value}>
                                <div className="flex items-center gap-2">
                                  <IconComp className="h-4 w-4" />
                                  <span>{opt.label}</span>
                                </div>
                              </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label>Cor</Label>
                      <div className="flex flex-wrap gap-2">
                        {colorPresets.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() =>
                              setNewComite((prev) => ({ ...prev, cor: color }))
                            }
                            className={`w-8 h-8 rounded-lg border-2 transition-all ${newComite.cor === color
                                ? "border-gray-900 scale-110"
                                : "border-transparent"
                              }`}
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                    {/* Preview */}
                    {newComite.nome && (
                      <div className="mt-2">
                        <Label className="text-xs text-gray-500 mb-1 block">
                          Pré-visualização
                        </Label>
                        <div
                          className="rounded-lg p-4 text-white flex items-center gap-3"
                          style={{ backgroundColor: newComite.cor }}
                        >
                          {(() => {
                            const PreviewIcon =
                              iconMap[newComite.icone] || Megaphone;
                            return <PreviewIcon className="h-6 w-6" />;
                          })()}
                          <div>
                            <div className="font-semibold text-sm">
                              {newComite.nome}
                            </div>
                            {newComite.sigla && (
                              <span className="text-xs bg-white/20 px-2 py-0.5 rounded-full">
                                {newComite.sigla}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setDialogOpen(false)}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleCreateComite}
                      disabled={
                        creating ||
                        !newComite.nome.trim() ||
                        !newComite.sigla.trim()
                      }
                    >
                      {creating && (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      )}
                      Criar Comitê
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6 text-sm">
              {error}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center min-h-[400px]">
              <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
            </div>
          ) : comites.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-[400px] text-gray-400">
              <Megaphone className="h-12 w-12 mb-4 text-gray-300" />
              <p className="text-lg font-medium text-gray-500">
                Nenhum comitê cadastrado
              </p>
              <p className="text-sm mt-1">
                {isAdmin
                  ? 'Clique em "Novo Comitê" para criar o primeiro.'
                  : "Solicite ao administrador a criação de comitês."}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-5">
              {comites.map((comite) => {
                const Icon = getIcon(comite.icone);
                const cor = comite.cor || "#1565C0";
                return (
                  <Card
                    key={comite.id}
                    onClick={() => handleComiteClick(comite)}
                    className="group cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-xl hover:-translate-y-0.5 border-0"
                    style={{ backgroundColor: cor }}
                  >
                    <div className="p-5 flex flex-col gap-3 text-white">
                      <div className="flex items-center justify-between">
                        <div className="flex-shrink-0 rounded-lg p-2.5 bg-white/15 group-hover:bg-white/25 transition-colors">
                          <Icon className="h-6 w-6" />
                        </div>
                        <span className="text-xs font-bold tracking-wide px-2.5 py-1 rounded-full bg-white/20">
                          {comite.sigla}
                        </span>
                      </div>
                      <div className="flex items-end justify-between gap-3">
                        <h3 className="font-semibold text-[15px] leading-snug">
                          {comite.nome}
                        </h3>
                        <div className="flex items-center gap-1 flex-shrink-0 mb-0.5">
                          {isAdmin && (
                            <>
                              <button
                                onClick={(e) => handleEditComite(e, comite)}
                                className="p-1 rounded hover:bg-white/20 transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5 text-white/60 hover:text-white" />
                              </button>
                              <button
                                onClick={(e) => handleDeleteComite(e, comite)}
                                className="p-1 rounded hover:bg-white/20 transition-colors"
                              >
                                <Trash2 className="h-3.5 w-3.5 text-white/60 hover:text-white" />
                              </button>
                            </>
                          )}
                          <ChevronRight className="h-5 w-5 text-white/50 group-hover:text-white group-hover:translate-x-0.5 transition-all" />
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </div>
      {/* Modal Editar Comitê */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Comitê</DialogTitle>
            <DialogDescription>Altere os dados do comitê.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label>Nome *</Label>
              <Input
                value={newComite.nome}
                onChange={(e) =>
                  setNewComite((prev) => ({ ...prev, nome: e.target.value }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Sigla *</Label>
              <Input
                value={newComite.sigla}
                onChange={(e) =>
                  setNewComite((prev) => ({
                    ...prev,
                    sigla: e.target.value.toUpperCase(),
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Descrição</Label>
              <Input
                value={newComite.descricao}
                onChange={(e) =>
                  setNewComite((prev) => ({
                    ...prev,
                    descricao: e.target.value,
                  }))
                }
              />
            </div>
            <div className="grid gap-2">
              <Label>Ícone</Label>
              <Select
                value={newComite.icone}
                onValueChange={(v) =>
                  setNewComite((prev) => ({ ...prev, icone: v }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {iconOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Cor</Label>
              <div className="flex flex-wrap gap-2">
                {colorPresets.map((c) => (
                  <button
                    key={c}
                    onClick={() =>
                      setNewComite((prev) => ({ ...prev, cor: c }))
                    }
                    className={`w-7 h-7 rounded-full border-2 ${newComite.cor === c ? "border-gray-900 scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveEdit} disabled={creating}>
              {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
