import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Plus, Save, Eye, Trash2, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formApi } from "@/services/formApi";
import { Form, FormSection, FormField, Directorate } from "@/types";
import { areasApi, Area } from "@/services/areasApi";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { FieldEditor } from "./FieldEditor";
import { Layout } from "@/components/layout/Layout";

export function FormBuilder() {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const { selectedDirectorate } = useDirectorate();

  const [form, setForm] = useState<Form | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<FormSection[]>([]);
  const [fields, setFields] = useState<FormField[]>([]);
  const [allowedDirectorates, setAllowedDirectorates] = useState<
    (Directorate | "ALL")[]
  >(["ALL"]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [areas, setAreas] = useState<Area[]>([]);

  useEffect(() => {
    areasApi.getAll().then(setAreas).catch(console.error);
  }, []);

  useEffect(() => {
    if (id) {
      loadForm();
    }
  }, [id]);

  const loadForm = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const data = await formApi.getFormById(id);
      if (data) {
        setForm(data);
        setTitle(data.title);
        setDescription(data.description || "");
        setSections(data.sections || []);
        setFields(data.fields || []);
        setAllowedDirectorates(data.allowedDirectorates || ["ALL"]);
      }
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (publish = false) => {
    if (!title.trim()) {
      toast.warning("Por favor, informe o título do formulário");
      return;
    }

    // Validar diretorias (apenas para ADMIN)
    if (user?.role === "ADMIN" && allowedDirectorates.length === 0) {
      toast.warning(
        'Por favor, selecione pelo menos uma diretoria ou "Todas as diretorias"',
      );
      return;
    }

    // Validar campos
    for (const field of fields) {
      if (!field.label.trim()) {
        toast.warning(
          "Todos os campos devem ter um rótulo. Por favor, preencha os rótulos vazios.",
        );
        return;
      }

      // Validar opções para campos que precisam delas
      if (["MULTIPLE_CHOICE", "CHECKBOXES", "DROPDOWN"].includes(field.type)) {
        if (!field.config?.options || field.config.options.length === 0) {
          toast.warning(
            `O campo "${field.label}" precisa ter pelo menos uma opção configurada.`,
          );
          return;
        }
      }
    }

    try {
      setSaving(true);

      let formId = id;

      if (!formId) {
        // Criar novo formulário
        const newForm = await formApi.createForm({
          title: title.trim(),
          description: description.trim(),
          status: publish ? "PUBLISHED" : "DRAFT",
          createdBy: user?.id || "",
          directorate: selectedDirectorate,
          allowedDirectorates:
            user?.role === "ADMIN" ? allowedDirectorates : ["ALL"],
        });
        formId = newForm.id;
      } else {
        // Atualizar formulário existente
        await formApi.updateForm(formId, {
          title: title.trim(),
          description: description.trim(),
          status: publish ? "PUBLISHED" : form?.status,
          allowedDirectorates:
            user?.role === "ADMIN"
              ? allowedDirectorates
              : form?.allowedDirectorates,
        });
      }

      // Salvar seções e campos em batch
      await formApi.saveSectionsAndFields(formId, sections, fields);

      navigate("/pessoas");
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setSaving(false);
    }
  };

  const handleAddSection = () => {
    const newSection: FormSection = {
      id: `temp-${Date.now()}`,
      formId: id || "temp",
      title: `Seção ${sections.length + 1}`,
      description: "",
      order: sections.length,
    };
    setSections([...sections, newSection]);
  };

  const handleUpdateSection = (
    sectionId: string,
    updates: Partial<FormSection>,
  ) => {
    setSections(
      sections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s)),
    );
  };

  const handleDeleteSection = (sectionId: string) => {
    if (
      confirm(
        "Tem certeza que deseja excluir esta seção e todos os seus campos?",
      )
    ) {
      setSections(sections.filter((s) => s.id !== sectionId));
      setFields(fields.filter((f) => f.sectionId !== sectionId));
    }
  };

  const handleAddField = (sectionId?: string) => {
    const newField: FormField = {
      id: `temp-${Date.now()}`,
      formId: id || "temp",
      sectionId,
      type: "SHORT_TEXT",
      label: "Novo campo",
      required: false,
      order: fields.filter((f) => f.sectionId === sectionId).length,
    };
    setFields([...fields, newField]);
  };

  const handleUpdateField = (fieldId: string, updates: Partial<FormField>) => {
    setFields(fields.map((f) => (f.id === fieldId ? { ...f, ...updates } : f)));
  };

  const handleDuplicateField = (fieldId: string) => {
    const field = fields.find((f) => f.id === fieldId);
    if (field) {
      const newField: FormField = {
        ...JSON.parse(JSON.stringify(field)), // Deep clone
        id: `temp-${Date.now()}`,
        label: `${field.label} (cópia)`,
        order: fields.filter((f) => f.sectionId === field.sectionId).length,
      };
      setFields([...fields, newField]);
    }
  };

  const handleDeleteField = (fieldId: string) => {
    if (confirm("Tem certeza que deseja excluir este campo?")) {
      setFields(fields.filter((f) => f.id !== fieldId));
    }
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Carregando formulário...</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate("/pessoas")}
            className="text-white hover:text-white/90"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => handleSave(false)}
              disabled={saving}
              className="text-white border-white hover:bg-white/10 hover:text-white"
            >
              <Save className="mr-2 h-4 w-4" />
              {saving ? "Salvando..." : "Salvar Rascunho"}
            </Button>
            <Button
              onClick={() => handleSave(true)}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700"
            >
              <Eye className="mr-2 h-4 w-4" />
              {saving ? "Publicando..." : "Publicar"}
            </Button>
          </div>
        </div>

        {/* Informações do Formulário */}
        <Card>
          <CardHeader>
            <CardTitle>Informações do Formulário</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="title">Título do Formulário *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex: Autoavaliação do colaborador"
                className="text-lg font-semibold"
              />
            </div>
            <div>
              <Label htmlFor="description">Descrição / Objetivo</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Descreva o objetivo deste formulário..."
                rows={3}
              />
            </div>

            {/* Controle de Visibilidade - Apenas para ADMIN */}
            {user?.role === "ADMIN" && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Label>Visibilidade do Formulário *</Label>
                  <Info className="h-4 w-4 text-gray-400" />
                </div>
                <p className="text-sm text-gray-500 mb-3">
                  Selecione para quais diretorias este formulário estará
                  visível. Usuários de outras diretorias não poderão visualizar
                  ou preencher este formulário.
                </p>

                <div className="space-y-2">
                  {/* Opção "Todas as Diretorias" */}
                  <label className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded">
                    <input
                      type="checkbox"
                      checked={allowedDirectorates.includes("ALL")}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setAllowedDirectorates(["ALL"]);
                        } else {
                          setAllowedDirectorates([]);
                        }
                      }}
                      className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="font-medium">Todas as diretorias</span>
                  </label>

                  {/* Diretorias específicas */}
                  <div className="pl-6 space-y-2 border-l-2 border-gray-200">
                    {areas.map((area) => {
                      const sigla = area.sigla || area.nome;
                      return (
                        <label
                          key={area.id}
                          className="flex items-center space-x-2 cursor-pointer p-2 hover:bg-gray-50 rounded"
                        >
                          <input
                            type="checkbox"
                            checked={
                              allowedDirectorates.includes(sigla) &&
                              !allowedDirectorates.includes("ALL")
                            }
                            disabled={allowedDirectorates.includes("ALL")}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setAllowedDirectorates([
                                  ...allowedDirectorates.filter(
                                    (d) => d !== "ALL",
                                  ),
                                  sigla,
                                ]);
                              } else {
                                setAllowedDirectorates(
                                  allowedDirectorates.filter(
                                    (d) => d !== sigla,
                                  ),
                                );
                              }
                            }}
                            className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
                          />
                          <span
                            className={
                              allowedDirectorates.includes("ALL")
                                ? "text-gray-400"
                                : ""
                            }
                          >
                            {sigla}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {allowedDirectorates.length === 0 && (
                  <p className="text-sm text-red-600 mt-2">
                    ⚠ Selecione pelo menos uma opção
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Seções e Campos */}
        <div className="space-y-4">
          {sections.length === 0 &&
            fields.filter((f) => !f.sectionId).length === 0 && (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <p className="text-gray-600 mb-4">
                    Nenhum campo adicionado ainda
                  </p>
                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleAddSection()}
                      variant="outline"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Seção
                    </Button>
                    <Button onClick={() => handleAddField()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Campo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Campos sem seção */}
          {fields.filter((f) => !f.sectionId).length > 0 && (
            <Card>
              <CardContent className="pt-6 space-y-4">
                {fields
                  .filter((f) => !f.sectionId)
                  .sort((a, b) => a.order - b.order)
                  .map((field) => (
                    <FieldEditor
                      key={field.id}
                      field={field}
                      onUpdate={(updates) =>
                        handleUpdateField(field.id, updates)
                      }
                      onDuplicate={() => handleDuplicateField(field.id)}
                      onDelete={() => handleDeleteField(field.id)}
                    />
                  ))}
                <Button
                  onClick={() => handleAddField()}
                  variant="outline"
                  className="w-full"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Campo
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Seções com campos */}
          {sections
            .sort((a, b) => a.order - b.order)
            .map((section) => (
              <Card key={section.id}>
                <CardHeader className="bg-blue-50">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Input
                        value={section.title}
                        onChange={(e) =>
                          handleUpdateSection(section.id, {
                            title: e.target.value,
                          })
                        }
                        className="text-lg font-bold border-0 bg-transparent focus-visible:ring-0"
                      />
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSection(section.id)}
                        className="text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <Textarea
                      value={section.description || ""}
                      onChange={(e) =>
                        handleUpdateSection(section.id, {
                          description: e.target.value,
                        })
                      }
                      placeholder="Descrição da seção (opcional)"
                      className="border-0 bg-transparent focus-visible:ring-0 text-sm"
                      rows={2}
                    />
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  {fields
                    .filter((f) => f.sectionId === section.id)
                    .sort((a, b) => a.order - b.order)
                    .map((field) => (
                      <FieldEditor
                        key={field.id}
                        field={field}
                        onUpdate={(updates) =>
                          handleUpdateField(field.id, updates)
                        }
                        onDuplicate={() => handleDuplicateField(field.id)}
                        onDelete={() => handleDeleteField(field.id)}
                      />
                    ))}
                  <Button
                    onClick={() => handleAddField(section.id)}
                    variant="outline"
                    className="w-full"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Adicionar Campo
                  </Button>
                </CardContent>
              </Card>
            ))}

          {/* Botão Adicionar Seção */}
          <Button
            onClick={handleAddSection}
            variant="outline"
            className="w-full text-white border-white hover:bg-white/10 hover:text-white"
          >
            <Plus className="mr-2 h-4 w-4" />
            Adicionar Nova Seção
          </Button>
        </div>
      </div>
    </Layout>
  );
}
