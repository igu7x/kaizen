import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { useToast } from "@/hooks/use-toast";
import { useDirectorate } from "@/contexts/DirectorateContext";
import {
  ambientesApi,
  Ambiente,
  AmbienteAdmin,
  CreateAmbienteDto,
} from "@/services/ambientesApi";

// UI Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// Icons
import {
  Code,
  Plus,
  Building2,
  Users,
  Calendar,
  Loader2,
  FolderTree,
  LogIn,
  LogOut,
  Shield,
  X,
  UserPlus,
} from "lucide-react";

export default function Desenvolvimento() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const { devEnvironment, setDevEnvironment } = useDirectorate();

  // Estados principais
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Modal
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [formNome, setFormNome] = useState("");
  const [formCodigo, setFormCodigo] = useState("");
  const [formDescricao, setFormDescricao] = useState("");
  const [formSiglaRaiz, setFormSiglaRaiz] = useState("");
  const [formNomeRaiz, setFormNomeRaiz] = useState("");

  // Admin modal state
  const [adminModalOpen, setAdminModalOpen] = useState(false);
  const [adminModalCodigo, setAdminModalCodigo] = useState("");
  const [admins, setAdmins] = useState<AmbienteAdmin[]>([]);
  const [loadingAdmins, setLoadingAdmins] = useState(false);
  const [savingAdmin, setSavingAdmin] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState("");
  const [newAdminName, setNewAdminName] = useState("");

  // Carregar ambientes
  const carregarAmbientes = async () => {
    try {
      setLoading(true);
      const data = await ambientesApi.getAll();
      setAmbientes(data);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregarAmbientes();
  }, []);

  // Reset form
  const resetForm = () => {
    setFormNome("");
    setFormCodigo("");
    setFormDescricao("");
    setFormSiglaRaiz("");
    setFormNomeRaiz("");
  };

  // Abrir modal
  const handleNovoAmbiente = () => {
    resetForm();
    setModalOpen(true);
  };

  // Criar ambiente
  const handleCriar = async () => {
    if (
      !formNome.trim() ||
      !formCodigo.trim() ||
      !formSiglaRaiz.trim() ||
      !formNomeRaiz.trim()
    ) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha todos os campos obrigatorios.",
        variant: "destructive",
      });
      return;
    }

    try {
      setSaving(true);
      const dto: CreateAmbienteDto = {
        nome: formNome.trim(),
        codigo: formCodigo.trim().toUpperCase(),
        descricao: formDescricao.trim() || undefined,
        sigla_raiz: formSiglaRaiz.trim().toUpperCase(),
        nome_raiz: formNomeRaiz.trim(),
      };
      await ambientesApi.create(dto);
      toast({
        title: "Ambiente criado",
        description: `O ambiente "${dto.nome}" foi criado com sucesso.`,
      });
      setModalOpen(false);
      resetForm();
      await carregarAmbientes();
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  // Formatar data
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("pt-BR");
    } catch {
      return dateStr;
    }
  };

  // Abrir modal de admins
  const handleOpenAdmins = async (codigo: string) => {
    setAdminModalCodigo(codigo);
    setAdminModalOpen(true);
    setNewAdminEmail("");
    setNewAdminName("");
    try {
      setLoadingAdmins(true);
      const data = await ambientesApi.getAdmins(codigo);
      setAdmins(data);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingAdmins(false);
    }
  };

  // Adicionar admin
  const handleAddAdmin = async () => {
    if (!newAdminEmail.trim() || !newAdminName.trim()) {
      toast({
        title: "Campos obrigatorios",
        description: "Preencha email e nome.",
        variant: "destructive",
      });
      return;
    }
    try {
      setSavingAdmin(true);
      await ambientesApi.addAdmin(adminModalCodigo, {
        email: newAdminEmail.trim(),
        name: newAdminName.trim(),
      });
      setNewAdminEmail("");
      setNewAdminName("");
      // Recarregar lista
      const data = await ambientesApi.getAdmins(adminModalCodigo);
      setAdmins(data);
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSavingAdmin(false);
    }
  };

  // Remover admin
  const handleRemoveAdmin = async (userId: number) => {
    try {
      await ambientesApi.removeAdmin(adminModalCodigo, userId);

      const data = await ambientesApi.getAdmins(adminModalCodigo);
      setAdmins(data);
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-10">
          {/* Banner ambiente ativo */}
          {devEnvironment && (
            <div className="flex items-center justify-between bg-amber-500/15 border border-amber-500/30 rounded-lg px-4 py-3 mb-6">
              <div className="flex items-center gap-2">
                <Code className="h-4 w-4 text-amber-400" />
                <span className="text-sm text-amber-300">
                  Visualizando ambiente: <strong>{devEnvironment}</strong>
                </span>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setDevEnvironment(null);
                  navigate("/gestao-estrategica/execucao");
                }}
                className="text-amber-400 hover:text-amber-300 hover:bg-amber-500/20 h-7 text-xs"
              >
                <LogOut className="h-3 w-3 mr-1" />
                Sair do ambiente
              </Button>
            </div>
          )}

          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center">
                <Code className="h-5 w-5 text-violet-400" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">
                  Desenvolvimento
                </h1>
                <p className="text-sm text-white/50">
                  Gerenciamento de Ambientes
                </p>
              </div>
            </div>
            <Button
              onClick={handleNovoAmbiente}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              <Plus className="h-4 w-4 mr-2" />
              Novo Ambiente
            </Button>
          </div>

          {/* Loading */}
          {loading && (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="h-8 w-8 animate-spin text-white/50" />
            </div>
          )}

          {/* Empty state */}
          {!loading && ambientes.length === 0 && (
            <div className="text-center py-20">
              <Code className="h-12 w-12 text-white/20 mx-auto mb-4" />
              <p className="text-white/50 text-sm">
                Nenhum ambiente cadastrado.
              </p>
              <p className="text-white/30 text-xs mt-1">
                Clique em "Novo Ambiente" para criar o primeiro.
              </p>
            </div>
          )}

          {/* Lista de ambientes */}
          {!loading && ambientes.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {ambientes.map((ambiente) => (
                <Card
                  key={ambiente.id}
                  className="bg-white/5 border-white/10 hover:border-white/20 transition-colors"
                >
                  <CardContent className="p-5">
                    {/* Header do card */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-base font-semibold text-white truncate">
                            {ambiente.nome}
                          </h3>
                          <Badge
                            variant={ambiente.ativo ? "default" : "secondary"}
                            className={
                              ambiente.ativo
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-xs"
                                : "bg-red-500/20 text-red-400 border-red-500/30 text-xs"
                            }
                          >
                            {ambiente.ativo ? "Ativo" : "Inativo"}
                          </Badge>
                        </div>
                        <p className="text-xs text-white/40 font-mono">
                          {ambiente.codigo}
                        </p>
                      </div>
                    </div>

                    {/* Descricao */}
                    {ambiente.descricao && (
                      <p className="text-sm text-white/50 mb-3 line-clamp-2">
                        {ambiente.descricao}
                      </p>
                    )}

                    {/* Info grid */}
                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-white/10">
                      {/* Diretoria raiz */}
                      <div className="flex items-center gap-1.5">
                        <FolderTree className="h-3.5 w-3.5 text-white/30" />
                        <span className="text-xs text-white/50">
                          {ambiente.diretoria_raiz || "-"}
                        </span>
                      </div>

                      {/* Total areas */}
                      <div className="flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-white/30" />
                        <span className="text-xs text-white/50">
                          {ambiente.total_areas ?? 0} areas
                        </span>
                      </div>

                      {/* Total users */}
                      <div className="flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5 text-white/30" />
                        <span className="text-xs text-white/50">
                          {ambiente.total_users ?? 0} usuarios
                        </span>
                      </div>
                    </div>

                    {/* Admins button */}
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenAdmins(ambiente.codigo)}
                        className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/20 h-7 text-xs w-full justify-start"
                      >
                        <Shield className="h-3 w-3 mr-1.5" />
                        Gerenciar Superadmins
                      </Button>
                    </div>

                    {/* Data criacao */}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="h-3 w-3 text-white/20" />
                        <span className="text-[11px] text-white/30">
                          Criado em {formatDate(ambiente.created_at)}
                        </span>
                      </div>
                      {devEnvironment === ambiente.diretoria_raiz ? (
                        <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                          Visualizando
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setDevEnvironment(
                              ambiente.diretoria_raiz || ambiente.codigo,
                            );
                            toast({
                              title: `Ambiente "${ambiente.nome}" ativado`,
                            });
                            navigate("/gestao-estrategica/execucao");
                          }}
                          className="text-violet-400 hover:text-violet-300 hover:bg-violet-500/20 h-7 text-xs"
                        >
                          <LogIn className="h-3 w-3 mr-1" />
                          Acessar
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modal Novo Ambiente */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="bg-[#0a1929] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Ambiente</DialogTitle>
            <DialogDescription className="text-white/50">
              Crie um novo ambiente (dominio) no sistema. Uma diretoria raiz
              sera criada automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Nome do Ambiente */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">
                Nome do Ambiente *
              </Label>
              <Input
                value={formNome}
                onChange={(e) => setFormNome(e.target.value)}
                placeholder="Ex: Corregedoria-Geral da Justica"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>

            {/* Codigo */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">Codigo *</Label>
              <Input
                value={formCodigo}
                onChange={(e) =>
                  setFormCodigo(e.target.value.toUpperCase().replace(/\s/g, ""))
                }
                placeholder="Ex: CGJ"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
              />
              <p className="text-[11px] text-white/30">
                Identificador unico do dominio. Apenas letras maiusculas, sem
                espacos.
              </p>
            </div>

            {/* Descricao */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">Descricao</Label>
              <Textarea
                value={formDescricao}
                onChange={(e) => setFormDescricao(e.target.value)}
                placeholder="Descricao opcional do ambiente..."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 resize-none"
                rows={2}
              />
            </div>

            {/* Sigla da Diretoria Raiz */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">
                Sigla da Diretoria Raiz *
              </Label>
              <Input
                value={formSiglaRaiz}
                onChange={(e) =>
                  setFormSiglaRaiz(
                    e.target.value.toUpperCase().replace(/\s/g, ""),
                  )
                }
                placeholder="Ex: CGJ"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 font-mono"
              />
            </div>

            {/* Nome da Diretoria Raiz */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">
                Nome da Diretoria Raiz *
              </Label>
              <Input
                value={formNomeRaiz}
                onChange={(e) => setFormNomeRaiz(e.target.value)}
                placeholder="Ex: Corregedoria-Geral da Justica"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setModalOpen(false)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleCriar}
              disabled={saving}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Ambiente
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Gerenciar Superadmins */}
      <Dialog open={adminModalOpen} onOpenChange={setAdminModalOpen}>
        <DialogContent className="bg-[#0a1929] border-white/10 text-white max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-cyan-400" />
              Superadmins - {adminModalCodigo}
            </DialogTitle>
            <DialogDescription className="text-white/50">
              Gerencie os superadministradores deste ambiente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Lista de admins */}
            <div className="space-y-1.5">
              <Label className="text-white/70 text-sm">
                Superadmins atuais
              </Label>
              {loadingAdmins ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-white/50" />
                </div>
              ) : admins.length === 0 ? (
                <p className="text-xs text-white/30 py-2">
                  Nenhum admin cadastrado.
                </p>
              ) : (
                <div className="space-y-1 max-h-48 overflow-y-auto">
                  {admins.map((admin) => (
                    <div
                      key={admin.id}
                      className="flex items-center justify-between bg-white/5 rounded px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-white truncate">
                          {admin.name}
                        </p>
                        <p className="text-xs text-white/40 truncate">
                          {admin.email}
                        </p>
                      </div>
                      <button
                        onClick={() => handleRemoveAdmin(admin.id)}
                        className="ml-2 p-1 rounded hover:bg-red-500/20 text-white/30 hover:text-red-400 transition-colors"
                        title="Remover admin"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Formulario adicionar admin */}
            <div className="space-y-3 pt-3 border-t border-white/10">
              <Label className="text-white/70 text-sm flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" />
                Adicionar novo superadmin
              </Label>
              <Input
                value={newAdminEmail}
                onChange={(e) => setNewAdminEmail(e.target.value)}
                placeholder="Email"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <Input
                value={newAdminName}
                onChange={(e) => setNewAdminName(e.target.value)}
                placeholder="Nome"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30"
              />
              <Button
                onClick={handleAddAdmin}
                disabled={savingAdmin}
                size="sm"
                className="bg-cyan-600 hover:bg-cyan-700 text-white w-full"
              >
                {savingAdmin && (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                )}
                <UserPlus className="h-3.5 w-3.5 mr-1.5" />
                Adicionar Superadmin
              </Button>
              <p className="text-[11px] text-white/30">
                Se o usuario nao existir, sera criado com senha padrao (123456).
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setAdminModalOpen(false)}
              className="text-white/70 hover:text-white hover:bg-white/10"
            >
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
