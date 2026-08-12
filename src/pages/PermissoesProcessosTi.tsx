import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { VoltarCadastros } from "@/components/ui/VoltarCadastros";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  ShieldCheck,
  Plus,
  Trash2,
  Loader2,
  UserX,
  Search,
  ChevronsUpDown,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  permissoesProcessosTiApi,
  type PermissaoProcessosTi,
} from "@/services/permissoesProcessosTiApi";
import { getUsers } from "@/services/api";
import type { User as UserType } from "@/types";

export default function PermissoesProcessosTi() {
  const { toast } = useToast();

  const [permissoes, setPermissoes] = useState<PermissaoProcessosTi[]>([]);
  const [users, setUsers] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [busca, setBusca] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [saving, setSaving] = useState(false);
  const [comboOpen, setComboOpen] = useState(false);

  const [revogando, setRevogando] = useState<PermissaoProcessosTi | null>(null);

  const carregar = async () => {
    setLoading(true);
    const [permsRes, usersRes] = await Promise.allSettled([
      permissoesProcessosTiApi.listar(),
      getUsers(),
    ]);
    if (permsRes.status === "fulfilled") setPermissoes(permsRes.value);
    if (usersRes.status === "fulfilled") setUsers(usersRes.value);
    setLoading(false);
  };

  useEffect(() => {
    carregar();
  }, []);

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
        (p.user_email ?? "").toLowerCase().includes(q),
    );
  }, [permissoes, busca]);

  const handleConceder = async () => {
    const userId = Number(selectedUserId);
    if (!userId || Number.isNaN(userId)) {
      toast({ title: "Selecione um usuário", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await permissoesProcessosTiApi.conceder(userId);
      setModalOpen(false);
      setSelectedUserId("");
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSaving(false);
    }
  };

  const handleRevogar = async () => {
    if (!revogando) return;
    try {
      await permissoesProcessosTiApi.revogar(revogando.user_id);
      setRevogando(null);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    }
  };

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString("pt-BR");
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
                { label: "Cadastros", href: "/cadastros" },
                { label: "Permissões dos Processos (TI)" },
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
              Permissões dos Processos (TI)
            </h1>
            <p className="text-slate-500 mt-1 text-sm max-w-2xl">
              Conceda a usuários a permissão para editar e salvar os processos do
              Escritório de Processos do grupo{" "}
              <span className="font-medium text-slate-700">
                Tecnologia da Informação
              </span>{" "}
              que estejam novos ou em revisão. Não afeta o grupo Apoio Judiciário.
            </p>
          </div>

          {/* Toolbar */}
          <div className="flex items-center gap-3 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por nome ou e-mail..."
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
                    ? 'Nenhum usuário possui essa permissão. Clique em "Conceder permissão" para começar.'
                    : "Nenhum resultado para essa busca."}
                </p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">
                      Usuário
                    </th>
                    <th className="text-left font-semibold px-4 py-3">
                      E-mail
                    </th>
                    <th className="text-left font-semibold px-4 py-3">
                      Concedida em
                    </th>
                    <th className="text-left font-semibold px-4 py-3">
                      Concedida por
                    </th>
                    <th className="w-12"></th>
                  </tr>
                </thead>
                <tbody>
                  {permissoesFiltradas.map((p) => (
                    <tr
                      key={p.user_id}
                      className="border-t border-slate-100 hover:bg-slate-50"
                    >
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {p.user_nome}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.user_email ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {formatDate(p.granted_at)}
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {p.granted_by_nome ?? "—"}
                      </td>
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
            <DialogTitle>Conceder permissão dos Processos (TI)</DialogTitle>
            <DialogDescription>
              Escolha o usuário que poderá editar e salvar os processos de
              Tecnologia da Informação (novos ou em revisão).
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
                          const u = usuariosElegiveis.find(
                            (x) => String(x.id) === selectedUserId,
                          );
                          if (!u) return "Selecione um usuário...";
                          return `${u.name}${u.email ? ` — ${u.email}` : ""}`;
                        })()
                      : usuariosElegiveis.length === 0
                        ? "Todos os usuários ativos já possuem permissão"
                        : "Selecione um usuário..."}
                  </span>
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent
                className="w-[--radix-popover-trigger-width] p-0 z-[80]"
                align="start"
              >
                <Command>
                  <CommandInput placeholder="Buscar por nome ou e-mail..." />
                  <CommandList>
                    <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                    <CommandGroup>
                      {usuariosElegiveis.map((u) => (
                        <CommandItem
                          key={u.id}
                          value={`${u.name} ${u.email ?? ""}`}
                          onSelect={() => {
                            setSelectedUserId(String(u.id));
                            setComboOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedUserId === String(u.id)
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          <span className="truncate">
                            {u.name}
                            {u.email ? ` — ${u.email}` : ""}
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
            <Button
              variant="outline"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConceder}
              disabled={saving || !selectedUserId}
            >
              {saving ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
              Conceder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: confirmar revogação */}
      <Dialog
        open={!!revogando}
        onOpenChange={(open) => !open && setRevogando(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Revogar permissão</DialogTitle>
            <DialogDescription>
              {revogando ? (
                <>
                  Deseja remover a permissão de editar os processos de TI de{" "}
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
