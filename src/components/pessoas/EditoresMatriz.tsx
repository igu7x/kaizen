import { useEffect, useMemo, useState, type ReactNode } from "react";
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
import { EditorMatriz } from "@/services/competenciasGestorApi";
import { getUsers } from "@/services/api";
import type { User } from "@/types";
import { toast } from "sonner";

/** Recorte sobre o qual o editor é associado: uma macroárea ou uma unidade. */
export interface EscopoEditor {
  id: number;
  sigla: string | null;
  nome: string | null;
}

export interface EditoresMatrizProps {
  titulo: string;
  descricao: string;
  /** Rótulo do seletor de recorte: "Área" ou "Unidade". */
  rotuloEscopo: string;
  placeholderEscopo: string;
  /** Mensagem de quando o usuário não administra nenhum recorte. */
  mensagemSemEscopo: string;
  /** Texto do aviso que delimita o papel — muda entre gestor e equipe. */
  aviso: ReactNode;
  carregarEscopos: () => Promise<EscopoEditor[]>;
  carregarEditores: (escopoId: number) => Promise<EditorMatriz[]>;
  associarEditor: (escopoId: number, userId: number) => Promise<EditorMatriz[]>;
  removerEditor: (
    editor: EditorMatriz,
    escopoId: number,
  ) => Promise<EditorMatriz[]>;
}

/**
 * Administração de editores de matriz de competências.
 *
 * Serve aos dois recortes que existem hoje — editor da matriz do GESTOR (vínculo por área, quem
 * associa é o diretor) e editor da matriz da EQUIPE (vínculo por unidade, quem associa é o gestor
 * da unidade). A tela é a mesma; o que muda é o recorte, os textos e as chamadas de API, todos
 * recebidos por prop. Ver `EditoresMatrizGestor` e `EditoresMatrizEquipe`.
 */
export function EditoresMatriz({
  titulo,
  descricao,
  rotuloEscopo,
  placeholderEscopo,
  mensagemSemEscopo,
  aviso,
  carregarEscopos,
  carregarEditores,
  associarEditor,
  removerEditor,
}: EditoresMatrizProps) {
  const [escopos, setEscopos] = useState<EscopoEditor[]>([]);
  const [escopoId, setEscopoId] = useState<string>("");
  const [editores, setEditores] = useState<EditorMatriz[]>([]);
  const [usuarios, setUsuarios] = useState<User[]>([]);
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);
  const [salvandoId, setSalvandoId] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      carregarEscopos().catch(() => [] as EscopoEditor[]),
      getUsers().catch(() => [] as User[]),
    ])
      .then(([escoposData, usersData]) => {
        setEscopos(escoposData);
        setUsuarios(usersData);
        if (escoposData.length === 1) setEscopoId(String(escoposData[0].id));
      })
      .finally(() => setCarregando(false));
    // Só na montagem: as funções vêm de props e recarregar a cada render zeraria a seleção.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!escopoId) {
      setEditores([]);
      return;
    }
    carregarEditores(Number(escopoId))
      .then(setEditores)
      .catch(() => setEditores([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopoId]);

  const jaEditores = useMemo(
    () => new Set(editores.map((e) => Number(e.user_id))),
    [editores],
  );

  /** Candidatos: usuários que ainda não são editores do recorte selecionado. */
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
    if (!escopoId) return;
    setSalvandoId(userId);
    try {
      setEditores(await associarEditor(Number(escopoId), userId));
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
      setEditores(await removerEditor(editor, Number(escopoId)));
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

  if (escopos.length === 0) {
    return (
      <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
        {mensagemSemEscopo}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <UserCog className="h-5 w-5 text-blue-600" />
            {titulo}
          </CardTitle>
          <p className="text-sm text-gray-500">{descricao}</p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                {rotuloEscopo}
              </label>
              <Select value={escopoId} onValueChange={setEscopoId}>
                <SelectTrigger>
                  <SelectValue placeholder={placeholderEscopo} />
                </SelectTrigger>
                <SelectContent>
                  {escopos.map((e) => (
                    <SelectItem key={e.id} value={String(e.id)}>
                      {e.sigla ? `${e.sigla} — ` : ""}
                      {e.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Deixa explícito o limite do papel — é a dúvida que aparece primeiro. */}
          <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
            <Info className="mt-0.5 h-4 w-4 flex-shrink-0 text-blue-600" />
            <p className="text-sm text-blue-900">{aviso}</p>
          </div>
        </CardContent>
      </Card>

      {escopoId && (
        <>
          <Card className="border border-gray-200 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">
                Editores ({editores.length})
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
