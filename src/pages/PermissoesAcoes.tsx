import { useEffect, useState, useMemo } from "react";
import { toast } from "sonner";
import { Trash2, Plus, Key, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { permissoesAcoesApi, PermissaoAcaoList, TagAcao, CreatePermissaoAcaoReq } from "@/services/permissoesAcoesApi";
import { areasApi, Area, Unidade } from "@/services/areasApi";
import { pessoasApi, Pessoa } from "@/services/pessoasApi";
import { Badge } from "@/components/ui/badge";
import { Layout } from "@/components/layout/Layout";

export default function PermissoesAcoes() {
  const [permissoes, setPermissoes] = useState<PermissaoAcaoList[]>([]);
  const [tags, setTags] = useState<TagAcao[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);

  const [initialLoad, setInitialLoad] = useState(true);
  const [loading, setLoading] = useState(false);
  const [openModal, setOpenModal] = useState(false);

  // Formulário
  const [tagId, setTagId] = useState<string>("");
  const [areaId, setAreaId] = useState<string>("");
  const [unidadeId, setUnidadeId] = useState<string>("none");
  const [userId, setUserId] = useState<string>("none");

  // Estados dos dropdowns (Combobox)
  const [openArea, setOpenArea] = useState(false);
  const [openUnidade, setOpenUnidade] = useState(false);
  const [openUser, setOpenUser] = useState(false);

  useEffect(() => {
    loadData(true);
  }, []);

  useEffect(() => {
    async function fetchUnidades() {
      if (areaId && areaId !== "none") {
        try {
          const res = await areasApi.getUnidades(Number(areaId));
          setUnidades(res);
        } catch (err) {
          console.error("Erro ao buscar unidades", err);
          setUnidades([]);
        }
      } else {
        setUnidades([]);
      }
    }
    fetchUnidades();
  }, [areaId]);

  const loadData = async (isInitial = false) => {
    if (isInitial) setInitialLoad(true);
    setLoading(true);
    try {
      const [permList, tagsList, areasList, pessoasList] = await Promise.all([
        permissoesAcoesApi.listarTodas(),
        permissoesAcoesApi.listarTags(),
        areasApi.getAll(),
        pessoasApi.getAll(),
      ]);

      setPermissoes(permList);
      setTags(tagsList);
      setAreas(areasList);
      setPessoas(pessoasList);
    } catch (error) {
      console.error(error);
    } finally {
      setLoading(false);
      if (isInitial) setInitialLoad(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await permissoesAcoesApi.remover(id);
      loadData(false);
    } catch (error) {
      console.error(error);
    }
  };

  const handleOpenModal = (tagToSet: string) => {
    resetForm();
    setTagId(tagToSet);
    setOpenModal(true);
  };

  const handleCreate = async () => {
    if (!tagId || !areaId || areaId === "none") {
      toast.error("Área é um campo obrigatório.");
      return;
    }

    const payload: CreatePermissaoAcaoReq = {
      tagAcoesId: tagId,
      areaId: Number(areaId),
      unidadeId: unidadeId !== "none" ? Number(unidadeId) : null,
      userId: userId !== "none" ? Number(userId) : null,
    };

    try {
      await permissoesAcoesApi.adicionar(payload);
      setOpenModal(false);
      resetForm();
      loadData(false);
    } catch (error) {
      console.error(error);
    }
  };

  const resetForm = () => {
    setTagId("");
    setAreaId("");
    setUnidadeId("none");
    setUserId("none");
  };

  const permissoesPorTag = useMemo(() => {
    const mapa = new Map<string, PermissaoAcaoList[]>();
    tags.forEach(t => mapa.set(t.id, []));
    
    permissoes.forEach(p => {
      if (mapa.has(p.tagId)) {
        mapa.get(p.tagId)!.push(p);
      } else {
        mapa.set(p.tagId, [p]);
      }
    });
    return mapa;
  }, [permissoes, tags]);

  const usuariosOpcoes = useMemo(() => {
    let filtradas = pessoas;
    if (unidadeId && unidadeId !== "none") {
      filtradas = pessoas.filter(p => p.unidade_id === Number(unidadeId));
    } else if (areaId && areaId !== "none") {
      filtradas = pessoas.filter(p => p.area_id === Number(areaId));
    }
    
    // Garantir unicidade pelo user_id para o dropdown
    const mapa = new Map<number, Pessoa>();
    filtradas.forEach(p => {
      if (p.user_id != null && !mapa.has(p.user_id)) {
        mapa.set(p.user_id, p);
      }
    });
    return Array.from(mapa.values());
  }, [pessoas, areaId, unidadeId]);

  const tagSelecionadaNome = tags.find(t => t.id === tagId)?.name || "";

  return (
    <Layout>
      <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
            <Key className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Permissões de Ações
            </h1>
            <p className="text-slate-600">
              Gerencie as permissões de acesso baseadas em escopo (Área, Unidade e Usuário).
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="p-4">
        {initialLoad ? (
          <div className="text-center py-10 text-gray-500">
            Carregando ações...
          </div>
        ) : tags.length === 0 ? (
          <div className="text-center py-10 text-gray-500">
            Nenhuma ação cadastrada no sistema.
          </div>
        ) : (
          <Accordion type="multiple" className="w-full space-y-2">
            {tags.map((tag) => {
              const perms = permissoesPorTag.get(tag.id) || [];
              
              return (
                <AccordionItem key={tag.id} value={tag.id} className="border rounded-md px-4 data-[state=open]:bg-gray-50/50 transition-colors">
                  <AccordionTrigger className="hover:no-underline py-4">
                    <div className="flex items-center gap-4 text-left flex-1">
                      <div>
                        <div className="font-semibold text-gray-900">{tag.name}</div>
                        <div className="text-xs text-gray-400 font-mono mt-0.5">{tag.id}</div>
                      </div>
                      <Badge variant="secondary" className="ml-auto mr-4">
                        {perms.length} {perms.length === 1 ? 'regra' : 'regras'}
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="pt-2 pb-4">
                    <div className="mb-4 flex justify-end">
                      <Button size="sm" onClick={() => handleOpenModal(tag.id)} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Nova Permissão
                      </Button>
                    </div>
                    
                    <div className="border rounded-md overflow-hidden bg-white">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-50">
                            <TableHead>Área</TableHead>
                            <TableHead>Unidade</TableHead>
                            <TableHead>Usuário Específico</TableHead>
                            <TableHead className="w-[100px] text-center">Excluir</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {perms.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center py-6 text-gray-500">
                                Nenhuma permissão configurada para esta ação.
                              </TableCell>
                            </TableRow>
                          ) : (
                            perms.map((p) => (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.areaNome}</TableCell>
                                <TableCell>
                                  {p.unidadeNome ? (
                                    p.unidadeNome
                                  ) : (
                                    <span className="text-gray-400 italic">Todas</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {p.userNome ? (
                                    p.userNome
                                  ) : (
                                    <span className="text-gray-400 italic">Todos do escopo</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 h-8 w-8"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent>
                                      <AlertDialogHeader>
                                        <AlertDialogTitle>Você tem certeza?</AlertDialogTitle>
                                        <AlertDialogDescription>
                                          Deseja realmente remover esta permissão de acesso? Esta ação não pode ser desfeita.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                                        <AlertDialogAction 
                                          className="bg-red-600 hover:bg-red-700 text-white" 
                                          onClick={() => handleDelete(p.id)}
                                        >
                                          Sim, excluir
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
        </CardContent>
      </Card>

      <Dialog open={openModal} onOpenChange={(open) => {
        setOpenModal(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle>Conceder Permissão</DialogTitle>
            <DialogDescription>
              Adicionar nova regra de acesso para a ação <strong className="text-gray-900">{tagSelecionadaNome}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="area">Área *</Label>
              <Popover open={openArea} onOpenChange={setOpenArea}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      !areaId && "text-muted-foreground"
                    )}
                  >
                    {areaId && areaId !== "none"
                      ? areas.find((a) => a.id.toString() === areaId)?.nome
                      : "Selecione uma Área"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0 z-[100]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar área..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma área encontrada.</CommandEmpty>
                      <CommandGroup>
                        {areas.map((a) => (
                          <CommandItem
                            key={a.id}
                            value={a.nome}
                            onSelect={() => {
                              setAreaId(a.id.toString());
                              setUnidadeId("none");
                              setUserId("none");
                              setOpenArea(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                areaId === a.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {a.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="unidade">Unidade (Opcional)</Label>
              <Popover open={openUnidade} onOpenChange={setOpenUnidade}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    disabled={!areaId || areaId === "none"}
                    className={cn(
                      "w-full justify-between",
                      !unidadeId || unidadeId === "none" ? "text-muted-foreground" : ""
                    )}
                  >
                    {unidadeId && unidadeId !== "none"
                      ? unidades.find((u) => u.id.toString() === unidadeId)?.nome
                      : "Todas as Unidades"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0 z-[100]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar unidade..." />
                    <CommandList>
                      <CommandEmpty>Nenhuma unidade encontrada.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="Todas as Unidades"
                          onSelect={() => {
                            setUnidadeId("none");
                            setOpenUnidade(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", unidadeId === "none" ? "opacity-100" : "opacity-0")} />
                          Todas as Unidades
                        </CommandItem>
                        {unidades.map((u) => (
                          <CommandItem
                            key={u.id}
                            value={u.nome}
                            onSelect={() => {
                              setUnidadeId(u.id.toString());
                              setUserId("none");
                              setOpenUnidade(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                unidadeId === u.id.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {u.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="user">Usuário Específico (Opcional)</Label>
              <Popover open={openUser} onOpenChange={setOpenUser}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className={cn(
                      "w-full justify-between",
                      !userId || userId === "none" ? "text-muted-foreground" : ""
                    )}
                  >
                    {userId && userId !== "none"
                      ? usuariosOpcoes.find((p) => p.user_id!.toString() === userId)?.nome
                      : "Todos os Usuários do Escopo"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[380px] p-0 z-[100]" align="start">
                  <Command>
                    <CommandInput placeholder="Buscar usuário..." />
                    <CommandList>
                      <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="Todos os Usuários do Escopo"
                          onSelect={() => {
                            setUserId("none");
                            setOpenUser(false);
                          }}
                        >
                          <Check className={cn("mr-2 h-4 w-4", userId === "none" ? "opacity-100" : "opacity-0")} />
                          Todos os Usuários do Escopo
                        </CommandItem>
                        {usuariosOpcoes.map((p) => (
                          <CommandItem
                            key={p.user_id!}
                            value={p.nome}
                            onSelect={() => {
                              setUserId(p.user_id!.toString());
                              setOpenUser(false);
                            }}
                          >
                            <Check
                              className={cn(
                                "mr-2 h-4 w-4",
                                userId === p.user_id!.toString() ? "opacity-100" : "opacity-0"
                              )}
                            />
                            {p.nome}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleCreate}>
              Conceder Permissão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </Layout>
  );
}
