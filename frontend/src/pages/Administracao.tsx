import { useState, useEffect, useMemo } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Pencil, Trash2, UserCheck, UserX, Search, X } from 'lucide-react';
import { isLocalLoginEnabled, isProduction } from '@/utils/environment';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { User, UserRole } from '@/types';
import { DIRETORIAS_LABELS, Diretoria } from '@/services/permissoesApi';
import { areasApi, Area } from '@/services/areasApi';
import { isDomainRoot } from '@/utils/domain';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export default function Administracao() {
  const { user: currentUser } = useAuth();
  const { devEnvironment } = useDirectorate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ACTIVE');
  const [diretoriaFilter, setDiretoriaFilter] = useState<string>('ALL');

  // Determinar diretoria do admin logado
  const adminDiretoria = ((currentUser as any)?.diretoria || 'SGJT') as Diretoria;

  // Areas do domínio do admin (para filtro de segurança)
  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const [domainAreas, setDomainAreas] = useState<Area[]>([]);
  // Todas as áreas globais (para dropdown de diretoria — admin SGJT pode atribuir qualquer diretoria)
  const [globalAreas, setGlobalAreas] = useState<Area[]>([]);

  // Domain root (SGJT, CGJ) pode selecionar diretoria
  const canSelectDiretoria = isDomainRoot(currentUser, allAreas);

  useEffect(() => {
    // Em dev mode, carregar áreas do ambiente ativo; senão do domínio do usuário
    const loadAreas = devEnvironment ? areasApi.getByDominio(devEnvironment) : areasApi.getAll();
    loadAreas.then(areas => {
      setAllAreas(areas);
      setDomainAreas(areas);
    }).catch(err => console.error('Erro ao carregar áreas:', err));

    // Dropdown de diretoria: em dev mode só mostra áreas do ambiente; senão todas (admin SGJT)
    const loadGlobal = devEnvironment ? areasApi.getByDominio(devEnvironment) : areasApi.getAllGlobal();
    loadGlobal.then(areas => {
      setGlobalAreas(areas);
    }).catch(err => console.error('Erro ao carregar áreas globais:', err));
  }, [currentUser, adminDiretoria, devEnvironment]);

  // Áreas disponíveis no dropdown: domain root vê todas, outros veem só do domínio
  const areasParaDropdown = canSelectDiretoria ? globalAreas : domainAreas;

  // Siglas das diretorias do domínio do admin (para filtro de segurança client-side)
  const domainSiglas = useMemo(() => {
    return new Set(domainAreas.map(a => a.sigla || a.nome));
  }, [domainAreas]);

  // Helper: obter label da diretoria (usa nome global se disponível, senão domínio, senão label)
  const getAreaLabel = (sigla: string) => {
    const area = globalAreas.find(a => (a.sigla || a.nome) === sigla)
      || domainAreas.find(a => (a.sigla || a.nome) === sigla);
    return area?.nome !== sigla && area?.nome ? area.nome : (DIRETORIAS_LABELS[sigla] || '');
  };

  // Filtrar usuários: por domínio (segurança) + status + busca por nome/email
  const filteredUsers = useMemo(() => {
    let result = users;

    // Filtro de segurança client-side: domain root vê todos, outros veem só do domínio
    if (!canSelectDiretoria && domainSiglas.size > 0) {
      result = result.filter(u =>
        domainSiglas.has((u as any).diretoria)
      );
    }

    // Filtro de status
    if (statusFilter !== 'ALL') {
      result = result.filter(u => u.status === statusFilter);
    }

    // Filtro de diretoria
    if (diretoriaFilter !== 'ALL') {
      result = result.filter(u => (u as any).diretoria === diretoriaFilter);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(user =>
        user.name.toLowerCase().includes(term) ||
        user.email.toLowerCase().includes(term)
      );
    }

    return result;
  }, [users, searchTerm, statusFilter, diretoriaFilter, domainSiglas]);

  // Diretorias únicas presentes nos usuários (para filtro)
  const diretoriasDisponiveis = useMemo(() => {
    const dirs = new Set<string>();
    users.forEach(u => {
      const dir = (u as any).diretoria;
      if (dir) dirs.add(dir);
    });
    return Array.from(dirs).sort();
  }, [users]);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      // Sempre filtrar por domínio: devEnvironment (dev mode) ou domínio do usuário logado
      const dominio = devEnvironment || ((currentUser as any)?.dominio) || undefined;
      const data = await api.getUsers(dominio);
      setUsers(data);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    const data: any = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      role: formData.get('role') as UserRole,
      status: (formData.get('status') as 'ACTIVE' | 'INACTIVE') || 'ACTIVE',
      // Domain root pode escolher diretoria do domínio, outros ficam na própria
      diretoria: canSelectDiretoria ? ((formData.get('diretoria') as Diretoria) || adminDiretoria) : adminDiretoria
    };

    // Adicionar senha se foi fornecida
    const password = formData.get('password') as string;
    if (password && password.trim()) {
      // Hash SHA-256 da senha (compatível com backend)
      const encoder = new TextEncoder();
      const passwordData = encoder.encode(password);
      const hashBuffer = await crypto.subtle.digest('SHA-256', passwordData);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      data.password = hashHex;
    }

    try {
      if (editingUser) {
        await api.updateUser(editingUser.id, data);
      } else {
        await api.createUser(data);
      }
      await loadUsers();
      setDialogOpen(false);
      setEditingUser(null);
    } catch (error) {
      console.error('Erro ao salvar usuário:', error);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
      await api.updateUser(user.id, { status: newStatus });
      await loadUsers();
    } catch (error) {
      console.error('Erro ao alterar status:', error);
    }
  };

  const handleDeleteUser = async (id: string) => {
    if (confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        await api.deleteUser(id);
        await loadUsers();
      } catch (error) {
        console.error('Erro ao excluir usuário:', error);
      }
    }
  };

  const getRoleBadge = (role: UserRole) => {
    const variants: Record<UserRole, BadgeVariant> = {
      ADMIN: 'destructive',
      MANAGER: 'default',
      VIEWER: 'secondary'
    };
    const labels = {
      ADMIN: 'Administrador',
      MANAGER: 'Gestor',
      VIEWER: 'Visualizador'
    };
    return <Badge variant={variants[role]}>{labels[role]}</Badge>;
  };

  const getStatusBadge = (status: 'ACTIVE' | 'INACTIVE') => {
    return status === 'ACTIVE' ? (
      <Badge className="bg-green-100 text-green-800">Ativo</Badge>
    ) : (
      <Badge className="bg-red-100 text-red-800">Inativo</Badge>
    );
  };

  if (loading) {
    return (
      <Layout>
        <div>Carregando...</div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 page-transition-enter">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Administração de Usuários</h1>
            <p className="text-slate-600 mt-2">
              Gerencie usuários e permissões da plataforma
            </p>
          </div>
          <Button onClick={() => { setEditingUser(null); setDialogOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" />
            Novo Usuário
          </Button>
        </div>

        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <CardTitle>Usuários Cadastrados</CardTitle>
              <div className="flex items-center gap-3">
                {/* Filtro de Status */}
                <div className="flex rounded-lg border overflow-hidden">
                  <button
                    onClick={() => setStatusFilter('ACTIVE')}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors ${statusFilter === 'ACTIVE' ? 'bg-green-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Ativos
                  </button>
                  <button
                    onClick={() => setStatusFilter('INACTIVE')}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${statusFilter === 'INACTIVE' ? 'bg-red-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Inativos
                  </button>
                  <button
                    onClick={() => setStatusFilter('ALL')}
                    className={`px-3 py-1.5 text-sm font-medium transition-colors border-l ${statusFilter === 'ALL' ? 'bg-blue-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
                  >
                    Todos
                  </button>
                </div>
                {/* Filtro de Diretoria */}
                <Select value={diretoriaFilter} onValueChange={setDiretoriaFilter}>
                  <SelectTrigger className="w-[160px] h-9">
                    <SelectValue placeholder="Diretoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Todas Diretorias</SelectItem>
                    {diretoriasDisponiveis.map(dir => (
                      <SelectItem key={dir} value={dir}>{dir}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {/* Campo de Busca */}
                <div className="relative w-full sm:w-72">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Pesquisar por nome ou email..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-10"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Contagem de resultados */}
            <p className="text-sm text-gray-500 mt-2">
              {filteredUsers.length} usuário{filteredUsers.length !== 1 ? 's' : ''}
              {statusFilter === 'ACTIVE' ? ' ativo' : statusFilter === 'INACTIVE' ? ' inativo' : ''}
              {filteredUsers.length !== 1 ? 's' : ''}
              {searchTerm && <> para "<strong>{searchTerm}</strong>"</>}
            </p>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-4">Nome</th>
                    <th className="text-left p-4">E-mail</th>
                    <th className="text-left p-4">Diretoria</th>
                    <th className="text-left p-4">Perfil</th>
                    <th className="text-left p-4">Status</th>
                    <th className="text-left p-4">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-8 text-center text-gray-500">
                        {searchTerm ? (
                          <>
                            Nenhum usuário encontrado para "{searchTerm}"
                            <button
                              onClick={() => setSearchTerm('')}
                              className="ml-2 text-blue-600 hover:underline"
                            >
                              Limpar busca
                            </button>
                          </>
                        ) : (
                          'Nenhum usuário cadastrado'
                        )}
                      </td>
                    </tr>
                  ) : filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b hover:bg-gray-50">
                      <td className="p-4">{user.name}</td>
                      <td className="p-4">{user.email}</td>
                      <td className="p-4">
                        <Badge variant="outline" className="font-medium">
                          {(user as any).diretoria || 'SGJT'}
                        </Badge>
                      </td>
                      <td className="p-4">{getRoleBadge(user.role)}</td>
                      <td className="p-4">{getStatusBadge(user.status)}</td>
                      <td className="p-4">
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => { setEditingUser(user); setDialogOpen(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleToggleStatus(user)}
                          >
                            {user.status === 'ACTIVE' ? (
                              <UserX className="h-4 w-4" />
                            ) : (
                              <UserCheck className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleDeleteUser(user.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Dialog para Usuário */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent>
            <form onSubmit={handleSaveUser}>
              <DialogHeader>
                <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
                <DialogDescription>
                  Preencha os dados do usuário
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <Label htmlFor="name">Nome</Label>
                  <Input id="name" name="name" defaultValue={editingUser?.name} required />
                </div>
                <div>
                  <Label htmlFor="email">E-mail</Label>
                  <Input id="email" name="email" type="email" defaultValue={editingUser?.email} required />
                </div>

                {!isProduction() && (
                  <div>
                    <Label htmlFor="password">Senha (opcional para login local)</Label>
                    <Input
                      id="password"
                      name="password"
                      type="password"
                      placeholder={editingUser ? 'Deixe em branco para manter a senha atual' : 'Defina uma senha para login local'}
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {editingUser
                        ? 'Deixe em branco se não quiser alterar a senha'
                        : 'Se não definir uma senha, o usuário só poderá fazer login via SSO'}
                    </p>
                  </div>
                )}

                <div>
                  <Label htmlFor="role">Perfil</Label>
                  <Select name="role" defaultValue={editingUser?.role || 'VIEWER'} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="VIEWER">Visualizador</SelectItem>
                      <SelectItem value="MANAGER">Gestor</SelectItem>
                      <SelectItem value="ADMIN">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {canSelectDiretoria ? (
                  <div>
                    <Label htmlFor="diretoria">Diretoria</Label>
                    <Select name="diretoria" defaultValue={(editingUser as any)?.diretoria || adminDiretoria} required>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {areasParaDropdown.map(area => {
                          const sigla = area.sigla || area.nome;
                          return (
                            <SelectItem key={area.id} value={sigla}>
                              {sigla}{area.nome !== sigla ? ` - ${area.nome}` : (DIRETORIAS_LABELS[sigla] ? ` - ${DIRETORIAS_LABELS[sigla]}` : '')}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div>
                    <Label>Diretoria</Label>
                    <Input value={`${adminDiretoria}${getAreaLabel(adminDiretoria) ? ` - ${getAreaLabel(adminDiretoria)}` : ''}`} disabled />
                  </div>
                )}
                <div>
                  <Label htmlFor="status">Status</Label>
                  <Select name="status" defaultValue={editingUser?.status || 'ACTIVE'} required>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ACTIVE">Ativo</SelectItem>
                      <SelectItem value="INACTIVE">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit">Salvar</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
