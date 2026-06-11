import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Layout } from "@/components/layout/Layout";
import { Shield, Check, Loader2, AlertTriangle, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  permissoesApi,
  TodasPermissoes,
  Diretoria,
  DIRETORIAS_LABELS,
} from "@/services/permissoesApi";
import { areasApi, Area } from "@/services/areasApi";
import { isDomainRoot, isSuperAdmin } from "@/utils/domain";

export default function Gerenciamento() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [dados, setDados] = useState<TodasPermissoes | null>(null);
  const [permissoesEditadas, setPermissoesEditadas] = useState<
    Record<
      string,
      Record<
        string,
        {
          pode_acessar: boolean;
          apenas_propria_diretoria: boolean;
        }
      >
    >
  >({});

  // Areas do domínio do usuário
  const [domainAreas, setDomainAreas] = useState<Area[]>([]);

  // Estados para adicionar módulos
  const [dialogOpen, setDialogOpen] = useState(false);
  const [modulosDisponiveis, setModulosDisponiveis] = useState<
    Array<{ codigo: string; nome: string; descricao: string }>
  >([]);
  const [modulosSelecionados, setModulosSelecionados] = useState<Set<string>>(
    new Set(),
  );
  const [carregandoModulos, setCarregandoModulos] = useState(false);
  const [adicionandoModulos, setAdicionandoModulos] = useState(false);

  // Estado para animação de troca de aba
  const [activeTab, setActiveTab] = useState("");
  const [isAnimating, setIsAnimating] = useState(false);

  const [allAreas, setAllAreas] = useState<Area[]>([]);
  const isRoot = isDomainRoot(user, allAreas);
  const userDiretoria = (user as any)?.diretoria;

  useEffect(() => {
    const loadData = async () => {
      try {
        // Backend GET /api/areas retorna áreas do domínio do usuário logado
        // Permissões são por domínio, não globais
        const areas = await areasApi.getAll();

        setAllAreas(areas);
        setDomainAreas(areas);

        // Definir aba inicial (primeira diretoria que não é a do admin logado)
        const nonRootAreas = areas.filter((a) => {
          const sigla = a.sigla || a.nome;
          return sigla !== userDiretoria;
        });

        if (nonRootAreas.length > 0) {
          setActiveTab(nonRootAreas[0].sigla || nonRootAreas[0].nome);
        }
      } catch (err) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    };
    loadData();
    carregarPermissoes();
  }, []);

  // Trigger animation on tab change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [activeTab]);

  // Diretorias do domínio que podem ter permissões editadas (excluir a root)
  const diretoriasEditaveis = domainAreas
    .map((a) => a.sigla || a.nome)
    .filter((sigla) => sigla !== userDiretoria);

  const carregarPermissoes = async () => {
    try {
      setLoading(true);
      const data = await permissoesApi.getTodasPermissoes();
      setDados(data);

      // Inicializar estado de edição
      const inicial: Record<string, Record<string, any>> = {};
      data.permissoes_por_diretoria.forEach(({ diretoria, permissoes }) => {
        inicial[diretoria] = {};
        permissoes.forEach((p) => {
          inicial[diretoria][p.aba_codigo] = {
            pode_acessar: p.pode_acessar,
            apenas_propria_diretoria: p.apenas_propria_diretoria,
          };
        });
      });
      setPermissoesEditadas(inicial);
    } catch (error: any) {
      toast.warning("Erro ao carregar permissões. Verifique as migrations.");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleAcesso = (diretoria: string, abaCodigo: string) => {
    setPermissoesEditadas((prev) => ({
      ...prev,
      [diretoria]: {
        ...prev[diretoria],
        [abaCodigo]: {
          ...prev[diretoria]?.[abaCodigo],
          pode_acessar: !prev[diretoria]?.[abaCodigo]?.pode_acessar,
        },
      },
    }));
  };

  const handleToggleApenasPropria = (diretoria: string, abaCodigo: string) => {
    setPermissoesEditadas((prev) => ({
      ...prev,
      [diretoria]: {
        ...prev[diretoria],
        [abaCodigo]: {
          ...prev[diretoria]?.[abaCodigo],
          apenas_propria_diretoria:
            !prev[diretoria]?.[abaCodigo]?.apenas_propria_diretoria,
        },
      },
    }));
  };

  const salvarPermissoes = async (diretoria: string) => {
    try {
      setSaving(diretoria);

      const permissoesParaDiretoria = permissoesEditadas[diretoria] || {};
      const permissoes = Object.entries(permissoesParaDiretoria).map(
        ([aba_codigo, valores]) => ({
          aba_codigo,
          pode_acessar: valores.pode_acessar,
          apenas_propria_diretoria: valores.apenas_propria_diretoria,
        }),
      );

      if (permissoes.length === 0) {
        toast.error("Nenhuma permissão para salvar.");
        return;
      }

      await permissoesApi.atualizarPermissoesDiretoria(
        diretoria as Diretoria,
        permissoes,
      );

      await new Promise((resolve) => setTimeout(resolve, 2000));
      await carregarPermissoes();
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(null);
    }
  };

  const carregarModulosDisponiveis = async () => {
    try {
      setCarregandoModulos(true);
      const modulos = await permissoesApi.getModulosNaoAdicionados();
      setModulosDisponiveis(modulos);
      setModulosSelecionados(new Set());
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setCarregandoModulos(false);
    }
  };

  const handleAbrirDialog = async () => {
    setDialogOpen(true);
    await carregarModulosDisponiveis();
  };

  const handleToggleModulo = (codigo: string) => {
    const novaSele = new Set(modulosSelecionados);
    if (novaSele.has(codigo)) {
      novaSele.delete(codigo);
    } else {
      novaSele.add(codigo);
    }
    setModulosSelecionados(novaSele);
  };

  const handleSelecionarTodos = () => {
    if (modulosSelecionados.size === modulosDisponiveis.length) {
      setModulosSelecionados(new Set());
    } else {
      setModulosSelecionados(new Set(modulosDisponiveis.map((m) => m.codigo)));
    }
  };

  const adicionarModulosSelecionados = async () => {
    if (modulosSelecionados.size === 0) {
      toast.error("Selecione pelo menos um módulo");
      return;
    }

    try {
      setAdicionandoModulos(true);
      const codigos = Array.from(modulosSelecionados);
      await permissoesApi.adicionarModulosExistentes(codigos);

      setDialogOpen(false);
      setModulosSelecionados(new Set());
      await carregarPermissoes();
    } catch (error: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setAdicionandoModulos(false);
    }
  };

  if (allAreas.length > 0 && !isRoot) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertTriangle className="w-16 h-16 text-yellow-500" />
                <h2 className="text-xl font-bold">Acesso Restrito</h2>
                <p className="text-muted-foreground">
                  Esta página é exclusiva para administradores de domínio.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center min-h-[400px]">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl shadow-lg">
              <Shield className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">
                Painel de Gerenciamento
              </h1>
              <p className="text-slate-600">
                Gerenciar permissões de acesso por diretoria
              </p>
            </div>
          </div>
          <Button
            onClick={handleAbrirDialog}
            className="bg-green-600 hover:bg-green-700"
          >
            <Plus className="w-4 h-4 mr-2" />
            Adicionar Módulos
          </Button>
        </div>

        {/* Tabs por Diretoria (do mesmo domínio, exceto a raiz) */}
        {diretoriasEditaveis.length > 0 ? (
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="w-full"
          >
            <TabsList
              className={`grid w-full mb-6`}
              style={{
                gridTemplateColumns: `repeat(${Math.min(diretoriasEditaveis.length, 7)}, 1fr)`,
              }}
            >
              {diretoriasEditaveis.map((dir) => (
                <TabsTrigger key={dir} value={dir} className="text-sm">
                  {dir}
                </TabsTrigger>
              ))}
            </TabsList>

            {diretoriasEditaveis.map((diretoria) => (
              <TabsContent key={diretoria} value={diretoria}>
                <div className={isAnimating ? "page-transition-enter" : ""}>
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="text-lg px-3 py-1"
                            >
                              {diretoria}
                            </Badge>
                          </CardTitle>
                          <CardDescription className="mt-2">
                            {domainAreas.find(
                              (a) => (a.sigla || a.nome) === diretoria,
                            )?.nome ||
                              DIRETORIAS_LABELS[diretoria] ||
                              diretoria}
                          </CardDescription>
                        </div>
                        <Button
                          onClick={() => salvarPermissoes(diretoria)}
                          disabled={saving === diretoria}
                          className="bg-blue-600 hover:bg-blue-700"
                        >
                          {saving === diretoria ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Salvando...
                            </>
                          ) : (
                            "Salvar Alterações"
                          )}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-3 px-4 font-semibold">
                                Aba/Módulo
                              </th>
                              <th className="text-center py-3 px-4 font-semibold">
                                Pode Acessar
                              </th>
                              <th className="text-center py-3 px-4 font-semibold">
                                Apenas Própria Diretoria
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {dados?.abas
                              .filter(
                                (a) =>
                                  a.codigo !== "sgjt" &&
                                  a.codigo !== "administracao",
                              )
                              .map((aba) => {
                                const perm =
                                  permissoesEditadas[diretoria]?.[aba.codigo];
                                return (
                                  <tr
                                    key={aba.codigo}
                                    className="border-b hover:bg-gray-50"
                                  >
                                    <td className="py-3 px-4">
                                      <div className="flex flex-col">
                                        <span className="font-medium">
                                          {aba.nome}
                                        </span>
                                        {aba.descricao && (
                                          <span className="text-sm text-gray-500">
                                            {aba.descricao}
                                          </span>
                                        )}
                                      </div>
                                    </td>
                                    <td className="text-center py-3 px-4">
                                      <div className="flex justify-center">
                                        <Checkbox
                                          checked={perm?.pode_acessar ?? false}
                                          onCheckedChange={() =>
                                            handleToggleAcesso(
                                              diretoria,
                                              aba.codigo,
                                            )
                                          }
                                          className="h-5 w-5"
                                        />
                                      </div>
                                    </td>
                                    <td className="text-center py-3 px-4">
                                      <div className="flex justify-center">
                                        <Checkbox
                                          checked={
                                            perm?.apenas_propria_diretoria ??
                                            true
                                          }
                                          onCheckedChange={() =>
                                            handleToggleApenasPropria(
                                              diretoria,
                                              aba.codigo,
                                            )
                                          }
                                          disabled={!perm?.pode_acessar}
                                          className="h-5 w-5"
                                        />
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              Nenhuma sub-diretoria encontrada no seu domínio.
            </CardContent>
          </Card>
        )}

        {/* Legenda */}
        <Card className="bg-blue-50 border-blue-200">
          <CardContent className="pt-4">
            <h3 className="font-semibold text-blue-900 mb-2">Legenda:</h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>
                  <strong>Pode Acessar:</strong> Se marcado, usuários da
                  diretoria podem ver esta aba
                </span>
              </li>
              <li className="flex items-center gap-2">
                <Check className="w-4 h-4 text-green-600" />
                <span>
                  <strong>Apenas Própria Diretoria:</strong> Se marcado,
                  usuários só veem dados da própria diretoria
                </span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* Dialog para Adicionar Módulos */}
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
            <DialogHeader>
              <DialogTitle>
                Adicionar Módulos ao Sistema de Permissões
              </DialogTitle>
              <DialogDescription>
                Selecione os módulos que existem no código mas ainda não foram
                adicionados ao gerenciamento de permissões.
              </DialogDescription>
            </DialogHeader>

            {carregandoModulos ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : modulosDisponiveis.length === 0 ? (
              <div className="py-8 text-center">
                <p className="text-gray-500">
                  Todos os módulos já foram adicionados!
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-2 border-b">
                  <Checkbox
                    checked={
                      modulosSelecionados.size === modulosDisponiveis.length &&
                      modulosDisponiveis.length > 0
                    }
                    onCheckedChange={handleSelecionarTodos}
                    className="h-5 w-5"
                  />
                  <Label
                    className="font-semibold cursor-pointer"
                    onClick={handleSelecionarTodos}
                  >
                    Selecionar Todos ({modulosSelecionados.size}/
                    {modulosDisponiveis.length})
                  </Label>
                </div>

                <div className="max-h-[400px] overflow-y-auto space-y-2 pr-2">
                  {modulosDisponiveis.map((modulo) => (
                    <div
                      key={modulo.codigo}
                      className="flex items-start gap-3 p-3 rounded-lg border hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => handleToggleModulo(modulo.codigo)}
                    >
                      <Checkbox
                        checked={modulosSelecionados.has(modulo.codigo)}
                        onCheckedChange={() =>
                          handleToggleModulo(modulo.codigo)
                        }
                        className="h-5 w-5 mt-0.5"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">
                          {modulo.nome}
                        </div>
                        <div className="text-sm text-gray-500">
                          {modulo.descricao}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          Código:{" "}
                          <code className="bg-gray-100 px-1 rounded">
                            {modulo.codigo}
                          </code>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={adicionandoModulos}
              >
                Cancelar
              </Button>
              <Button
                onClick={adicionarModulosSelecionados}
                disabled={
                  adicionandoModulos ||
                  modulosSelecionados.size === 0 ||
                  modulosDisponiveis.length === 0
                }
                className="bg-green-600 hover:bg-green-700"
              >
                {adicionandoModulos ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Adicionando...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Adicionar{" "}
                    {modulosSelecionados.size > 0
                      ? `(${modulosSelecionados.size})`
                      : ""}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}
