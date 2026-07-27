import React, { useState, useEffect } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { delegacaoApi, DelegacaoEdicaoDto } from "../../services/delegacaoApi";
import { getUsers } from "../../services/api";
import { User } from "../../types";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Shield, ShieldAlert, ShieldCheck, Trash2, UserPlus, Loader2, Info } from "lucide-react";
import { Alert, AlertDescription } from "../ui/alert";

interface PainelDelegacaoEdicaoProps {
  cicloId: number;
  estado: string;
  onDelegacaoChanged?: () => void;
}

export function PainelDelegacaoEdicao({
  cicloId,
  estado,
  onDelegacaoChanged,
}: PainelDelegacaoEdicaoProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [delegacoes, setDelegacoes] = useState<DelegacaoEdicaoDto[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  
  const [selectedUserId, setSelectedUserId] = useState<number | "">("");
  const [tipo, setTipo] = useState<"normal" | "especial">("normal");
  
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // O tipo de delegação será fixado em "normal" quando disparado o request.

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [delData, usersData] = await Promise.all([
        delegacaoApi.listar(cicloId, estado),
        getUsers() // O backend retornará todos do domínio. Filtraremos no front.
      ]);
      setDelegacoes(delData);
      
      const myArea = (user as any)?.cadastros_areas_id || (user as any)?.cadastrosAreasId;
      const myUnidade = (user as any)?.cadastros_unidades_id || (user as any)?.cadastrosUnidadesId;
      const isSuperadmin = (user as any)?.is_superadmin;

      // Filtra para exibir apenas pessoas da mesma área ou mesma unidade
      const filteredUsers = usersData.filter(u => {
        if (u.id === user?.id) return false;
        if (isSuperadmin) return true;
        
        const uArea = (u as any)?.cadastros_areas_id || (u as any)?.cadastrosAreasId;
        const uUnidade = (u as any)?.cadastros_unidades_id || (u as any)?.cadastrosUnidadesId;
        
        const sameArea = myArea != null && myArea === uArea;
        const sameUnidade = myUnidade != null && myUnidade === uUnidade;
        
        return sameArea || sameUnidade;
      });
      setUsers(filteredUsers);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar dados de delegação");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      loadData();
    }
  }, [open, cicloId, estado]);

  const handleDelegar = async () => {
    if (!selectedUserId) {
      toast.error("Selecione um usuário para delegar.");
      return;
    }
    
    setIsSubmitting(true);
    try {
      await delegacaoApi.criar(cicloId, {
        estado,
        delegadoId: Number(selectedUserId),
        tipo
      });
      toast.success("Edição delegada com sucesso!");
      setSelectedUserId("");
      setTipo("normal");
      loadData();
      if (onDelegacaoChanged) onDelegacaoChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao delegar edição.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevogar = async (id: number) => {
    if (!confirm("Tem certeza que deseja revogar esta delegação?")) return;
    
    try {
      await delegacaoApi.revogar(cicloId, id);
      toast.success("Delegação revogada!");
      loadData();
      if (onDelegacaoChanged) onDelegacaoChanged();
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Erro ao revogar delegação.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-indigo-700 border-indigo-200 hover:bg-indigo-50 bg-white">
          <Shield className="h-4 w-4 mr-2 text-indigo-500" />
          Delegar Edição
        </Button>
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-[600px] bg-white">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <ShieldCheck className="h-5 w-5 text-indigo-600" />
            Gerenciar Delegação de Edição
          </DialogTitle>
          <DialogDescription>
            Atribua temporariamente a capacidade de editar e excluir IFOs nesta etapa da formação para colegas da sua área. As delegações expiram automaticamente se a etapa mudar.
          </DialogDescription>
        </DialogHeader>

        {isLoading && !delegacoes.length ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : (
          <div className="space-y-6">
            
            {/* Formulário de Delegação */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-4">
              <h4 className="font-medium text-sm text-slate-700 flex items-center">
                <UserPlus className="h-4 w-4 mr-2" /> Nova Delegação
              </h4>
              
              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-slate-600 mb-1 block">Usuário da Área</label>
                    <select
                      className="w-full text-sm border-slate-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                      value={selectedUserId}
                      onChange={(e) => setSelectedUserId(e.target.value)}
                    >
                      <option value="">-- Selecione o usuário --</option>
                      {users.map(u => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </div>
                  
                </div>
                
                <div className="flex items-end">
                  <Button 
                    onClick={handleDelegar}
                    disabled={!selectedUserId || isSubmitting}
                    className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    {isSubmitting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : "Delegar"}
                  </Button>
                </div>
              </div>
              
            </div>

            {/* Lista de Delegações Ativas */}
            <div>
              <h4 className="font-medium text-sm text-slate-700 mb-3 flex items-center">
                <Shield className="h-4 w-4 mr-2" /> Delegações Ativas nesta Etapa
              </h4>
              
              {delegacoes.length === 0 ? (
                <div className="text-sm text-slate-500 text-center py-6 bg-slate-50 rounded-lg border border-slate-100 border-dashed">
                  Nenhuma delegação ativa no momento.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Delegado</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Tipo</th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-slate-500">Delegante</th>
                        <th className="px-4 py-2 text-right text-xs font-medium text-slate-500">Ação</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-slate-200">
                      {delegacoes.map((del) => (
                        <tr key={del.id}>
                          <td className="px-4 py-2 text-sm font-medium text-slate-900">
                            {del.delegadoNome}
                          </td>
                          <td className="px-4 py-2 text-sm">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                              del.tipo === 'especial' ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'
                            }`}>
                              {del.tipo}
                            </span>
                          </td>
                          <td className="px-4 py-2 text-xs text-slate-500">
                            {del.deleganteNome}
                          </td>
                          <td className="px-4 py-2 text-right">
                            {/* Apenas quem delegou (ou superadmin) pode revogar */}
                            {((user as any)?.is_superadmin || del.deleganteId === user?.id) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-red-600 hover:bg-red-50 hover:text-red-700"
                                onClick={() => handleRevogar(del.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
