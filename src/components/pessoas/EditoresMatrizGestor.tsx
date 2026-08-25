import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Plus, Trash2, UserCog, Search, Info } from "lucide-react";
import {
  competenciasGestorApi,
  AreaEditor,
  EditorMatriz,
} from "@/services/competenciasGestorApi";
import { getUsers } from "@/services/api";
import type { User } from "@/types";
import { toast } from "sonner";

/**
 * Editores da Matriz de Competências do Gestor.
 *
 * O diretor da área associa usuários que passam a PREENCHER a matriz do gestor de todas as
 * unidades daquela área — inclusive as criadas depois, já que o vínculo é por área e não por
 * unidade. O editor não valida: a camada 1 continua sendo referendada pelo gestor da unidade,
 * e as camadas de diretoria e final seguem intactas.
 */
export function EditoresMatrizGestor() {
  const [areas, setAreas] = useState<AreaEditor[]>([]);
  const [areaId, setAreaId] = useState<string>("");
  const [editores, setEditores] = useState<EditorMatriz[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      competenciasGestorApi.getAreasQueDirijo().catch(() => [] as AreaEditor[]),
      getUsers().catch(() => [] as User[]),
    ])
      .then(([areasData, usersData]) => {
        setAreas(areasData);
        setUsuarios(usersData);
        if (areasData.length === 1) setAreaId(String(areasData[0].id));
      })
      .finally(() => setCarregando(false));
  }, []);

  useEffect(() => {
    if (!areaId) {
      setEditores([]);
      return;
    }
    competenciasGestorApi
      .getEditores(Number(areaId))
      .then(setEditores)
      .catch(() => setEditores([]));
  }, [areaId]);

  const jaEditores = useMemo(
    () => new Set(editores.map((e) => Number(e.user_id))),
    [editores],
  );

  /** Candidatos: usuários que ainda não são editores da área selecionada. */
  const candidatos = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return usuarios
      .filter((u) => !jaEditores.has(Number(u.id)))
      .filter((u) =>
        !q
          ? true
          : `${u.name || ""} ${u.email || ""}`.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [usuarios, jaEditores, busca]);

  const associar = async (userId: number) => {
    if (!areaId) return;
    setSalvandoId(userId);
    try {
      setEditores(
        await competenciasGestorApi.addEditor(Number(areaId), userId),
      );
      setBusca("");
      toast.success("Editor associado.");
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvandoId(null);
    }
  };

  const remover = async (editor: EditorMatriz) => {
    setSalvandoId(editor.user_id);
    try {
      setEditores(
        await competenciasGestorApi.removeEditor(editor.id, Number(areaId)),
      );
      toast.success("Editor removido.");
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvandoId(null);
    }
  };

  if (carregando) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (areas.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        Você não dirige nenhuma macroárea, então não há editores a administrar.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="h-5 w-5 text-blue-600" />
            Editores da Matriz do Gestor
          </CardTitle>
          <p className="text-sm text-gray-500">
            O editor preenche a Matriz de Competências do Gestor de todas as
            unidades da área.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">Área</label>
              <Select value={areaId} onValueChange={setAreaId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a área" />
                </SelectTrigger>
                <SelectContent>
                  {areas.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.sigla ? `${a.sigla} — ` : ""}
                      {a.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deixa explícito o limite do papel — é a dúvida que aparece primeiro. */}
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-sm text-blue-900">
              O editor <strong>apenas preenche e salva</strong>. A validação
              continua a mesma: a primeira camada é do gestor da unidade, depois
              a diretoria e a validação final.
            </p>
          </div>
        </CardContent>
      </Card>

      {areaId && (
        <>
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Editores da área ({editores.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {editores.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-gray-500">
                  Nenhum editor associado. Use a busca abaixo para adicionar.
                </p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {editores.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between px-6 py-3"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {e.user_name || `Usuário ${e.user_id}`}
                        </p>
                        {e.user_email && (
                          <p className="text-xs text-gray-500">
                            {e.user_email}
                          </p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-500 hover:bg-red-50 hover:text-red-600"
                        disabled={salvandoId === e.user_id}
                        onClick={() => remover(e)}
                        aria-label={`Remover ${e.user_name || "editor"}`}
                      >
                        {salvandoId === e.user_id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Adicionar editor</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  placeholder="Buscar usuário por nome ou e-mail…"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  className="pl-9"
                />
              </div>
              {busca.trim() && candidatos.length === 0 && (
                <p className="py-4 text-center text-sm text-gray-500">
                  Nenhum usuário encontrado.
                </p>
              )}
              <div className="divide-y divide-gray-100">
                {candidatos.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between py-2.5"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {u.name}
                      </p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={salvandoId === Number(u.id)}
                      onClick={() => associar(Number(u.id))}
                    >
                      {salvandoId === Number(u.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Plus className="mr-1.5 h-4 w-4" /> Associar
                        </>
                      )}
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
