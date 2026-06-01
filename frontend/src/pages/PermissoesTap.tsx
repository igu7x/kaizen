import { useEffect, useMemo, useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { VoltarCadastros } from '@/components/ui/VoltarCadastros';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { ShieldCheck, Plus, Trash2, Loader2, UserX, Search, ChevronsUpDown, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { permissoesTapApi, type PermissaoTap } from '@/services/permissoesTapApi';
import { getUsers } from '@/services/api';
import type { User as UserType } from '@/types';

export default function PermissoesTap() {
  const { toast } = useToast();

  const [permissoes, setPermissoes] = useState<PermissaoTap[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState('');

  // Modal conceder
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  // Modal confirmar revogação
  const [revogando, setRevogando] = useState<PermissaoTap | null>(null);

  const carregar = async () => {
    setLoading(true);
    // Carregar em paralelo, mas sem deixar uma falha derrubar a outra
    const [permsRes, usersRes] = await Promise.allSettled([
      permissoesTapApi.listar(),
      getUsers(),
    ]);

    if (permsRes.status === 'fulfilled') {
      setPermissoes(permsRes.value);
    } else {
      console.error('[PermissoesTap] erro ao listar permissões:', permsRes.reason);
      toast({
        title: 'Erro ao carregar permissões',
        description: permsRes.reason?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }

    if (usersRes.status === 'fulfilled') {
      console.log('[PermissoesTap] usuários carregados:', usersRes.value.length);
      setUsers(usersRes.value);
    } else {
      console.error('[PermissoesTap] erro ao listar usuários:', usersRes.reason);
      toast({
        title: 'Erro ao carregar usuários',
        description: usersRes.reason?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }

    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

  // Usuários elegíveis (sem permissão ainda).
  // O backend já filtra is_deleted=FALSE em GET /api/users, então não precisamos
  // filtrar status no cliente — qualquer usuário retornado é elegível.
  const usuariosElegiveis = useMemo(() => {
    const jaTem = new Set(permissoes.map((p) => p.user_id));
    return users
      .filter((u) => !jaTem.has(Number(u.id)))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [users, permissoes]);

  const permissoesFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    if (!q) return permissoes;
    return permissoes.filter(
      (p) =>
        p.user_nome.toLowerCase().includes(q) ||
        (p.user_email ?? '').toLowerCase().includes(q) ||
        (p.user_diretoria ?? '').toLowerCase().includes(q),
    );
  }, [permissoes, busca]);

  const handleConceder = async () => {
    const userId = Number(selectedUserId);
    if (!userId || Number.isNaN(userId)) {
      toast({ title: 'Selecione um usuário', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await permissoesTapApi.conceder(userId);
      toast({ title: 'Permissão concedida com sucesso' });
      setModalOpen(false);
      setSelectedUserId('');
      await carregar();
    } catch (err: any) {
      toast({
        title: 'Erro ao conceder permissão',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRevogar = async () => {
    if (!revogando) return;
    try {
      await permissoesTapApi.revogar(revogando.user_id);
      toast({ title: 'Permissão revogada' });
      setRevogando(null);
      await carregar();
    } catch (err: any) {
      toast({
        title: 'Erro ao revogar',
        description: err?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('pt-BR');
    } catch {
      return iso;
    }
  };

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-4 pl-2 flex items-center justify-between">
            <Breadcrumbs
              items={[
                { label: 'Cadastros', href: '/cadastros' },
                { label: 'Permissões do TAP' },
              ]}
            />
            <VoltarCadastros />
          </div>

          {/* Header */}
          <div className="mb-8 pl-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
              Cadastros
            </p>
            <h1 className="text-3xl font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="h-7 w-7 text-blue-600" />
              Permissões do TAP
            </h1>
            <p className="text-slate-500 mt-1 text-sm max-w-2xl">
              Conceda a usuários a permissão para editar os campos do TAP (Termo de Abertura
              do Projeto) em projetos da sua própria diretoria. A permissão é restrita aos
              campos do TAP e ao escopo da diretoria do usuário.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome, e-mail ou diretoria..."
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <Button onClick={() => setModalOpen(true)}>
              <Plus className="h-4 w-4 mr-1" />
              Conceder permissão
            </Button>
          </div>

          {/* Lista */}
          <div className="border border-slate-200 rounded-xl bg-white overflow-hidden">
            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando permissões...
              </div>
            ) : permissoesFiltradas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-slate-500">
                <UserX className="h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm">
                  {permissoes.length === 0
                    ? 'Nenhum usuário possui permissão TAP. Clique em "Conceder permissão" para começar.'
                    : 'Nenhum resultado para essa busca.'}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Usuário</th>
                    <th className="text-left font-semibold px-4 py-3">E-mail</th>
                    <th className="text-left font-semibold px-4 py-3">Diretoria</th>
                    <th className="text-left font-semibold px-4 py-3">Concedida em</th>
                    <th className="text-left font-semibold px-4 py-3">Concedida por</th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {permissoesFiltradas.map((p) => (
                    <tr key={p.user_id} className="border-t border-slate-100 hover:bg-slate-50">
                      <td className="px-4 py-3 font-medium text-slate-900">{p.user_nome}</td>
                      <td className="px-4 py-3 text-slate-600">{p.user_email ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{p.user_diretoria ?? '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatDate(p.granted_at)}</td>
                      <td className="px-4 py-3 text-slate-600">{p.granted_by_nome ?? '—'}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setRevogando(p)}
                          title="Revogar permissão"
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Modal: conceder */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Conceder permissão do TAP</DialogTitle>
            <DialogDescription>
              Escolha o usuário que poderá editar os campos do TAP em projetos da sua
              própria diretoria.
            </DialogDescription>
          </DialogHeader>

          <div className="py-2">
            <Popover open={comboOpen} onOpenChange={setComboOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={comboOpen}
                  className="w-full justify-between font-normal"
                  disabled={usuariosElegiveis.length === 0}
                >
                  <span className="truncate">
                    {selectedUserId
                      ? (() => {
                          const u = usuariosElegiveis.find((x) => String(x.id) === selectedUserId);
                          if (!u) return 'Selecione um usuário...';
                          return `${u.name}${u.diretoria ? ` — ${u.diretoria}` : ''}`;
                        })()
                      : usuariosElegiveis.length === 0
                        ? 'Todos os usuários ativos já possuem permissão'
                        : 'Selecione um usuário...'}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-[80]" align="start">
                <Command>
                  <CommandInput placeholder="Buscar por nome, e-mail ou diretoria..." />
                  <CommandList>
                    <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                    <CommandGroup>
                      {usuariosElegiveis.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={`${u.name} ${u.email ?? ''} ${u.diretoria ?? ''}`}
                          onSelect={() => {
                            setSelectedUserId(String(u.id));
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              selectedUserId === String(u.id) ? 'opacity-100' : 'opacity-0',
                            )}
                          />
                          <span className="truncate">
                            {u.name}
                            {u.diretoria ? ` — ${u.diretoria}` : ''}
                          </span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={handleConceder} disabled={saving || !selectedUserId}>
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Conceder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: confirmar revogação */}
      <Dialog open={!!revogando} onOpenChange={(open) => !open && setRevogando(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar permissão do TAP</DialogTitle>
            <DialogDescription>
              {revogando ? (
                <>
                  Deseja remover a permissão de editar o TAP de{' '}
                  <strong>{revogando.user_nome}</strong>?
                </>
              ) : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRevogando(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleRevogar}>
              Revogar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
