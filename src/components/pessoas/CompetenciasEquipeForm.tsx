import { GRAUS_MINIMOS } from "@/constants/competencias";
import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { areasApi } from "@/services/areasApi";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  competenciasGestorApi,
  FormularioCompetencias,
  UnidadeAutorizada,
  FormularioPreenchido,
} from "@/services/competenciasGestorApi";
import {
  Plus,
  Trash2,
  Loader2,
  Send,
  Info,
  Pencil,
  ShieldCheck,
  Lock,
} from "lucide-react";
import { ValidacaoStatusBanners } from "./ValidacaoStatusBanners";

// Tipos
interface Competencia {
  nome: string;
  descricao: string;
  /** Nivel (1..5) que a pessoa precisa atingir para ser considerada apta. */
  grau_minimo_esperado: "" | "1" | "2" | "3" | "4" | "5";
  aplicabilidade: "" | "todos" | "parte";
  quantidade_pessoas: string;
}

interface FormState {
  nome_completo: string;
  matricula: string;
  cargo_funcao: string;
  email_institucional: string;
  unidade_id: string;
  qtd_colaboradores: string;
  competencias: Competencia[];
}

const COMPETENCIA_VAZIA: Competencia = {
  nome: "",
  descricao: "",
  grau_minimo_esperado: "",
  aplicabilidade: "",
  quantidade_pessoas: "",
};

const MIN_COMPETENCIAS = 8;

interface CompetenciasEquipeFormProps {
  onSubmitted?: (formulario: FormularioCompetencias) => void;
  editFormulario?: FormularioCompetencias;
  validationMode?: boolean;
  /**
   * Superior (Diretoria/Final) editando pelo resumo: ao salvar, JÁ valida essa camada — sem
   * devolver o formulário ao primeiro membro da cadeia.
   */
  validarCamadaAoSalvar?: "diretoria" | "final" | null;
}

export function CompetenciasEquipeForm({
  onSubmitted,
  editFormulario,
  validationMode,
  validarCamadaAoSalvar,
}: CompetenciasEquipeFormProps) {
  const { user } = useAuth();

  const [unidadesAutorizadas, setUnidadesAutorizadas] = useState<
    UnidadeAutorizada[]
  >([]);
  const [formulariosPreenchidos, setFormulariosPreenchidos] = useState<
    FormularioPreenchido[]
  >([]);
  const [loadingUnidades, setLoadingUnidades] = useState(true);
  const [loadingEdit, setLoadingEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [diretoriaUsuario, setDiretoriaUsuario] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingUnidadeNome, setEditingUnidadeNome] = useState<string>("");

  const [form, setForm] = useState<FormState>({
    nome_completo: user?.name || "",
    matricula: "",
    cargo_funcao: "",
    email_institucional: user?.email || "",
    unidade_id: "",
    qtd_colaboradores: "",
    competencias: Array.from({ length: MIN_COMPETENCIAS }, () => ({
      ...COMPETENCIA_VAZIA,
    })),
  });

  // Carregar formulário externo (vindo de "Visualizar respostas" → Editar)
  useEffect(() => {
    if (!editFormulario) return;
    setEditingId(editFormulario.id);
    setEditingUnidadeNome(editFormulario.unidade_nome || "");
    setForm({
      nome_completo: editFormulario.nome_completo || "",
      matricula: editFormulario.matricula || "",
      cargo_funcao: editFormulario.cargo_funcao || "",
      email_institucional: editFormulario.email_institucional || "",
      unidade_id: editFormulario.unidade_id
        ? String(editFormulario.unidade_id)
        : "",
      qtd_colaboradores: editFormulario.qtd_colaboradores
        ? String(editFormulario.qtd_colaboradores)
        : "",
      competencias: (editFormulario.competencias || []).map((c) => ({
        nome: c.nome || "",
        descricao: c.descricao || "",
        grau_minimo_esperado: String(
          c.grau_minimo_esperado ?? 3,
        ) as Competencia["grau_minimo_esperado"],
        aplicabilidade: (c.aplicabilidade || "") as "" | "todos" | "parte",
        quantidade_pessoas: c.quantidade_pessoas
          ? String(c.quantidade_pessoas)
          : "",
      })),
    });
  }, [editFormulario]);

  // Carregar áreas (para diretoria), unidades autorizadas e formulários preenchidos
  useEffect(() => {
    const load = async () => {
      try {
        // Carregar diretoria do usuário (usar user.diretoria, não domain root)
        const allAreas = await areasApi.getAll();
        if (allAreas.length > 0) {
          const userArea =
            allAreas.find((a) => a.sigla === user?.diretoria) ||
            allAreas.find((a) => a.is_domain_root === true) ||
            allAreas[0];
          const diretoria = userArea?.sigla || userArea?.nome || "";
          setDiretoriaUsuario(diretoria);
        }

        // Carregar unidades autorizadas (já filtra as já preenchidas) + formulários preenchidos
        const [autorizadas, preenchidos] = await Promise.all([
          competenciasGestorApi.getUnidadesAutorizadas(),
          competenciasGestorApi.getMeusPreenchidos(),
        ]);
        setUnidadesAutorizadas(autorizadas);
        setFormulariosPreenchidos(preenchidos);
      } catch (err) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        setLoadingUnidades(false);
      }
    };
    load();
  }, []);

  // Carregar formulário para edição
  const handleEdit = async (formularioId: number, unidadeNome: string) => {
    setLoadingEdit(true);
    try {
      const formulario = await competenciasGestorApi.getById(formularioId);
      if (!formulario) {
        toast.error("Formulário não encontrado.");
        return;
      }
      setEditingId(formularioId);
      setEditingUnidadeNome(unidadeNome);
      setForm({
        nome_completo: formulario.nome_completo || "",
        matricula: formulario.matricula || "",
        cargo_funcao: formulario.cargo_funcao || "",
        email_institucional: formulario.email_institucional || "",
        unidade_id: formulario.unidade_id ? String(formulario.unidade_id) : "",
        qtd_colaboradores: formulario.qtd_colaboradores
          ? String(formulario.qtd_colaboradores)
          : "",
        competencias: (formulario.competencias || []).map((c) => ({
          nome: c.nome || "",
          descricao: c.descricao || "",
          grau_minimo_esperado: String(
            c.grau_minimo_esperado ?? 3,
          ) as Competencia["grau_minimo_esperado"],
          aplicabilidade: (c.aplicabilidade || "") as "" | "todos" | "parte",
          quantidade_pessoas: c.quantidade_pessoas
            ? String(c.quantidade_pessoas)
            : "",
        })),
      });
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoadingEdit(false);
    }
  };

  // Cancelar edição e resetar formulário
  const handleCancelEdit = () => {
    setEditingId(null);
    setEditingUnidadeNome("");
    setForm({
      nome_completo: user?.name || "",
      matricula: "",
      cargo_funcao: "",
      email_institucional: user?.email || "",
      unidade_id: "",
      qtd_colaboradores: "",
      competencias: Array.from({ length: MIN_COMPETENCIAS }, () => ({
        ...COMPETENCIA_VAZIA,
      })),
    });
  };

  // Handlers
  const updateField = (
    field: Exclude<keyof FormState, "competencias">,
    value: string,
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateCompetencia = (
    index: number,
    field: keyof Competencia,
    value: string,
  ) => {
    setForm((prev) => {
      const competencias = [...prev.competencias];
      competencias[index] = { ...competencias[index], [field]: value };
      // Limpar quantidade se mudar aplicabilidade para "todos"
      if (field === "aplicabilidade" && value === "todos") {
        competencias[index].quantidade_pessoas = "";
      }
      return { ...prev, competencias };
    });
  };

  const addCompetencia = () => {
    setForm((prev) => ({
      ...prev,
      competencias: [...prev.competencias, { ...COMPETENCIA_VAZIA }],
    }));
  };

  const removeCompetencia = (index: number) => {
    if (form.competencias.length <= MIN_COMPETENCIAS) {
      toast.error(`O mínimo é ${MIN_COMPETENCIAS} competências.`);
      return;
    }
    setForm((prev) => ({
      ...prev,
      competencias: prev.competencias.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async () => {
    // Validação
    if (!form.nome_completo.trim())
      return toast.error("Informe o nome completo.");
    if (!form.unidade_id) return toast.error("Selecione a unidade.");
    if (!form.qtd_colaboradores.trim())
      return toast.error("Informe a quantidade de colaboradores.");

    // Salvaguarda anti-perda: nunca enviar a matriz vazia/incompleta. O backend recria os itens
    // a partir deste payload, então uma lista abaixo do mínimo apagaria a matriz-referencial.
    if (form.competencias.length < MIN_COMPETENCIAS) {
      return toast.error(`Informe ao menos ${MIN_COMPETENCIAS} competências.`);
    }

    for (let i = 0; i < form.competencias.length; i++) {
      const c = form.competencias[i];
      if (!c.nome.trim())
        return toast.error(`Informe o nome da competência nº ${i + 1}.`);
      if (!c.descricao.trim())
        return toast.error(`Informe a descrição da competência nº ${i + 1}.`);
      if (!c.grau_minimo_esperado)
        return toast.error(
          `Selecione o grau mínimo esperado da competência nº ${i + 1}.`,
        );
      if (!c.aplicabilidade)
        return toast.error(
          `Selecione a aplicabilidade da competência nº ${i + 1}.`,
        );
      if (c.aplicabilidade === "parte") {
        if (!c.quantidade_pessoas.trim()) {
          return toast.error(
            `Informe a quantidade de pessoas para a competência nº ${i + 1}.`,
          );
        }
        const qtdPessoas = Number(c.quantidade_pessoas);
        if (qtdPessoas < 1) {
          return toast.error(
            `A quantidade de pessoas da competência nº ${i + 1} deve ser no mínimo 1.`,
          );
        }
        const totalColab = Number(form.qtd_colaboradores);
        if (totalColab > 0 && qtdPessoas > totalColab) {
          return toast.error(
            `A quantidade de pessoas da competência nº ${i + 1} não pode exceder o total de colaboradores (${totalColab}).`,
          );
        }
      }
    }

    setSaving(true);
    try {
      const payload = {
        nome_completo: form.nome_completo.trim(),
        matricula: form.matricula.trim(),
        cargo_funcao: form.cargo_funcao.trim(),
        email_institucional: form.email_institucional.trim(),
        diretoria: diretoriaUsuario,
        unidade_id: form.unidade_id ? Number(form.unidade_id) : undefined,
        qtd_colaboradores: Number(form.qtd_colaboradores),
        competencias: form.competencias.map((c) => ({
          nome: c.nome.trim(),
          descricao: c.descricao.trim(),
          grau_minimo_esperado: Number(c.grau_minimo_esperado),
          aplicabilidade: c.aplicabilidade as "todos" | "parte",
          quantidade_pessoas:
            c.aplicabilidade === "parte" && c.quantidade_pessoas
              ? Number(c.quantidade_pessoas)
              : undefined,
        })),
      };

      let result: FormularioCompetencias;
      if (editingId) {
        result = await competenciasGestorApi.update(editingId, payload);
        if (validarCamadaAoSalvar === "diretoria") {
          result = await competenciasGestorApi.validarDiretoria(editingId);
        } else if (validarCamadaAoSalvar === "final") {
          result = await competenciasGestorApi.validarFinal(editingId);
        } else if (validationMode) {
          result = await competenciasGestorApi.validarAutor(editingId);
        }
      } else {
        result = await competenciasGestorApi.create(payload);
      }
      if (onSubmitted && result) onSubmitted(result);
    } catch (err: any) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Banners de validação (quando editando formulário existente) */}
      {editFormulario && <ValidacaoStatusBanners formulario={editFormulario} />}

      {/* Texto Introdutório */}
      <div className="rounded-xl bg-blue-50 border border-blue-200 p-8">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="h-5 w-5 text-blue-600" />
          </div>
          <div className="text-base text-gray-700 space-y-4">
            <p>
              <strong className="text-gray-900">Objetivo:</strong> Este
              formulário tem como finalidade identificar as competências
              essenciais para o bom desempenho da equipe sob sua gestão.
            </p>
            <p>
              Registre as competências que considera indispensáveis para todos
              os colaboradores da sua equipe ou para grupos específicos.
            </p>
            <p>Cada competência deve ser classificada de acordo com:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>
                <strong className="text-gray-900">Grau mínimo esperado:</strong>{" "}
                nível que o colaborador precisa atingir para ser considerado
                apto na competência.
              </li>
              <li>
                <strong className="text-gray-900">Aplicabilidade:</strong>{" "}
                número de colaboradores que precisam possuir essa competência.
              </li>
            </ul>
            <p className="text-gray-400 italic text-sm">
              Essas informações serão{" "}
              <strong className="text-gray-500">
                validadas pela Diretoria
              </strong>{" "}
              e, em nível institucional, pela{" "}
              <strong className="text-gray-500">
                Secretaria de Governança Judiciária e Tecnológica
              </strong>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Seção 1 - Diretoria (automática) */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Diretoria</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200">
            <span className="text-sm text-gray-500">
              Identificação da Diretoria
            </span>
            <p className="font-medium text-gray-800 mt-0.5">
              {diretoriaUsuario || "Carregando..."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Formulários já preenchidos (para edição) */}
      {!loadingUnidades && formulariosPreenchidos.length > 0 && !editingId && (
        <Card className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">
              Formulários já preenchidos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {formulariosPreenchidos.map((fp) => (
                <div
                  key={fp.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-200 hover:border-blue-300 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-800">
                      {fp.unidade_nome}
                    </p>
                    <p className="text-xs text-gray-500">
                      {fp.total_competencias} competência(s) &middot; Preenchido
                      em {new Date(fp.created_at).toLocaleDateString("pt-BR")}
                      {fp.updated_at !== fp.created_at && (
                        <>
                          {" "}
                          &middot; Atualizado em{" "}
                          {new Date(fp.updated_at).toLocaleDateString("pt-BR")}
                        </>
                      )}
                    </p>
                  </div>
                  {fp.status === "validado_diretoria" ||
                  fp.status === "validado_final" ? (
                    <span className="flex items-center gap-1 text-xs text-gray-400">
                      <Lock className="h-4 w-4" />
                      {fp.status === "validado_final"
                        ? "Validado"
                        : "Em validação final"}
                    </span>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(fp.id, fp.unidade_nome)}
                      disabled={loadingEdit}
                      className="text-blue-600 border-blue-300 hover:bg-blue-50"
                    >
                      {loadingEdit ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Pencil className="h-4 w-4 mr-1" />
                          Editar
                        </>
                      )}
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Banner de edição */}
      {editingId && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold text-gray-900">
                Editando formulário: {editingUnidadeNome}
              </p>
              <p className="text-sm text-gray-500">
                Altere os dados abaixo e clique em "Atualizar formulário".
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleCancelEdit}
              className="text-gray-600 border-gray-300"
            >
              Cancelar edição
            </Button>
          </div>
        </div>
      )}

      {/* Seção 3 - Unidade */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Unidade</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <Label>
              Identificação da Unidade <span className="text-red-500">*</span>
            </Label>
            {loadingUnidades ? (
              <div className="flex items-center gap-2 mt-2 text-sm text-gray-500">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando unidades...
              </div>
            ) : editingId ? (
              /* Modo edição: unidade fixa (read-only) */
              <div className="bg-gray-50 rounded-lg px-4 py-3 border border-gray-200 mt-1">
                <p className="font-medium text-gray-800">
                  {editingUnidadeNome}
                </p>
              </div>
            ) : unidadesAutorizadas.length === 0 ? (
              <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 mt-2">
                <p className="text-sm text-amber-800">
                  {formulariosPreenchidos.length > 0
                    ? "Todos os formulários autorizados já foram preenchidos. Use a seção acima para editar um formulário existente."
                    : "Não há unidades disponíveis para preenchimento. Todos os formulários já foram preenchidos ou você não possui unidades atribuídas."}
                </p>
              </div>
            ) : (
              <>
                <Select
                  value={form.unidade_id}
                  onValueChange={(v) => updateField("unidade_id", v)}
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Selecione a unidade" />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px]">
                    {unidadesAutorizadas.map((u) => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                {form.unidade_id && (
                  <p className="text-xs text-emerald-600 mt-1">
                    Unidade selecionada:{" "}
                    {
                      unidadesAutorizadas.find(
                        (u) => String(u.id) === form.unidade_id,
                      )?.nome
                    }
                  </p>
                )}
              </>
            )}
          </div>
          <div>
            <Label>
              Quantidade de colaboradores na unidade (sem considerar o gestor){" "}
              <span className="text-red-500">*</span>
            </Label>
            <Input
              type="number"
              min="0"
              value={form.qtd_colaboradores}
              onChange={(e) => updateField("qtd_colaboradores", e.target.value)}
              placeholder="Informe o número de colaboradores"
              className="mt-1 max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Orientações para competências técnicas */}
      <div className="rounded-xl bg-amber-50 border border-amber-200 p-8">
        <div className="flex gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Info className="h-5 w-5 text-amber-600" />
          </div>
          <div className="text-base text-gray-700 space-y-4">
            <p className="font-semibold text-gray-900 text-lg">
              Orientações para preenchimento das competências técnicas
            </p>
            <p>
              Indique entre{" "}
              <strong className="text-gray-900">
                8 e 12 competências técnicas essenciais
              </strong>{" "}
              para a sua área. Essas competências devem refletir os
              conhecimentos e habilidades fundamentais para o bom desempenho da
              equipe.
            </p>
            <p>Para cada competência, informe de forma objetiva:</p>
            <ul className="list-disc ml-6 space-y-2">
              <li>
                <strong className="text-gray-900">Descrição:</strong> breve
                explicação da competência;
              </li>
              <li>
                <strong className="text-gray-900">Grau mínimo esperado:</strong>{" "}
                de 1 a 5, o nível exigido na competência;
              </li>
              <li>
                <strong className="text-gray-900">Aplicabilidade:</strong> se
                deve ser exigida de todos os colaboradores ou apenas de parte da
                equipe;
              </li>
              <li>
                <strong className="text-gray-900">Quantidade:</strong> número de
                colaboradores que precisam possuir essa competência (quando
                aplicável).
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Competências */}
      {form.competencias.map((comp, index) => (
        <Card key={index} className="border border-gray-200 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">
                <span className="text-blue-600 font-bold mr-2">
                  {index + 1}.
                </span>
                Competência Técnica
              </CardTitle>
              {form.competencias.length > MIN_COMPETENCIAS && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCompetencia(index)}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remover
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>
                Nome da competência nº {index + 1}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                value={comp.nome}
                onChange={(e) =>
                  updateCompetencia(index, "nome", e.target.value)
                }
                placeholder="Ex: Gestão de processos judiciais"
                className="mt-1"
              />
            </div>
            <div>
              <Label>
                Descrição objetiva <span className="text-red-500">*</span>
              </Label>
              <Textarea
                value={comp.descricao}
                onChange={(e) =>
                  updateCompetencia(index, "descricao", e.target.value)
                }
                placeholder="Breve explicação da competência"
                className="mt-1"
                rows={3}
              />
            </div>
            {/* Grau mínimo esperado: o nível que o colaborador precisa atingir nesta competência
                para ser considerado apto. É o corte que o relatório de Lacunas usa. */}
            <div>
              <Label>
                Grau mínimo esperado <span className="text-red-500">*</span>
              </Label>
              <p className="mt-0.5 text-xs text-gray-500">
                Nível que o colaborador precisa atingir para ser considerado
                apto nesta competência.
              </p>
              <div className="mt-2 space-y-2">
                {GRAUS_MINIMOS.map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name={`grau-minimo-${index}`}
                      value={opt.value}
                      checked={comp.grau_minimo_esperado === opt.value}
                      onChange={() =>
                        updateCompetencia(
                          index,
                          "grau_minimo_esperado",
                          opt.value,
                        )
                      }
                      className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label>
                Aplicabilidade <span className="text-red-500">*</span>
              </Label>
              <div className="mt-2 space-y-2">
                {[
                  { value: "todos", label: "Todos os colaboradores" },
                  { value: "parte", label: "Apenas parte da equipe" },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className="flex items-start gap-3 cursor-pointer group"
                  >
                    <input
                      type="radio"
                      name={`aplicabilidade-${index}`}
                      value={opt.value}
                      checked={comp.aplicabilidade === opt.value}
                      onChange={() =>
                        updateCompetencia(index, "aplicabilidade", opt.value)
                      }
                      className="mt-0.5 h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 group-hover:text-gray-900">
                      {opt.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            {comp.aplicabilidade === "parte" && (
              <div className="ml-7 border-l-2 border-blue-200 pl-4">
                <Label>
                  Quantidade de pessoas necessárias para esta competência{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  type="number"
                  min="1"
                  max={
                    form.qtd_colaboradores
                      ? Number(form.qtd_colaboradores)
                      : undefined
                  }
                  value={comp.quantidade_pessoas}
                  onChange={(e) =>
                    updateCompetencia(
                      index,
                      "quantidade_pessoas",
                      e.target.value,
                    )
                  }
                  placeholder="Informe a quantidade"
                  className="mt-1 max-w-xs"
                />
                {form.qtd_colaboradores && (
                  <p className="text-xs text-gray-400 mt-1">
                    Máximo: {form.qtd_colaboradores} colaboradores
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {/* Botão Adicionar Competência (máximo 12) */}
      {form.competencias.length < 12 && (
        <div className="flex justify-center">
          <Button
            variant="outline"
            onClick={addCompetencia}
            className="border-dashed border-2 border-gray-300 text-gray-700 hover:border-gray-400 hover:text-gray-900 hover:bg-gray-50 px-6"
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar competência ({form.competencias.length}/12)
          </Button>
        </div>
      )}

      {/* Botão Enviar / Atualizar / Validar */}
      <div className="flex justify-end pb-6">
        <Button
          onClick={handleSubmit}
          disabled={saving}
          className={
            validationMode || validarCamadaAoSalvar
              ? "bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 text-base"
              : "bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 text-base"
          }
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              {validationMode || validarCamadaAoSalvar
                ? "Validando..."
                : editingId
                  ? "Atualizando..."
                  : "Enviando..."}
            </>
          ) : validarCamadaAoSalvar ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-2" />
              {validarCamadaAoSalvar === "final"
                ? "Salvar e Validação Final"
                : "Salvar e Validar Diretoria"}
            </>
          ) : validationMode ? (
            <>
              <ShieldCheck className="h-4 w-4 mr-2" />
              Validar Formulário
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {editingId ? "Atualizar formulário" : "Enviar formulário"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
