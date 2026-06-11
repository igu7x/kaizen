import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus,
  Pencil,
  Eye,
  Archive,
  FileText,
  Trash2,
  Search,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formApi } from "@/services/formApi";
import { Form, FormStatus, Directorate } from "@/types";
import { areasApi, Area } from "@/services/areasApi";
import { useDirectorate } from "@/contexts/DirectorateContext";

export function AdminFormsView() {
  const navigate = useNavigate();
  const { selectedDirectorate } = useDirectorate();
  const [forms, setForms] = useState<Form[]>([]);
  const [filteredForms, setFilteredForms] = useState<Form[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [areas, setAreas] = useState<Area[]>([]);

  useEffect(() => {
    loadForms();
    loadAreas();
  }, [selectedDirectorate]);

  useEffect(() => {
    filterForms();
  }, [forms, searchQuery]);

  const loadAreas = async () => {
    try {
      const data = await areasApi.getAll();
      setAreas(data);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const getAreaLabel = (code: string) => {
    const area = areas.find((a) => a.sigla === code || a.nome === code);
    return area ? area.sigla || area.nome : code;
  };

  const loadForms = async () => {
    try {
      setLoading(true);

      // ADMIN vê todos os formulários da diretoria (filtrado por diretoria do criador)
      const data = await formApi.getForms(selectedDirectorate, {
        isAdmin: true,
      });

      setForms(data);
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setLoading(false);
    }
  };

  const filterForms = () => {
    if (!searchQuery.trim()) {
      setFilteredForms(forms);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = forms.filter((form) => {
      const titleMatch = form.title.toLowerCase().includes(query);
      const descriptionMatch = form.description?.toLowerCase().includes(query);
      return titleMatch || descriptionMatch;
    });
    setFilteredForms(filtered);
  };

  const handleCreateForm = () => {
    navigate("/pessoas/criar");
  };

  const handleEditForm = (id: string) => {
    navigate(`/pessoas/editar/${id}`);
  };

  const handleViewResponses = (id: string) => {
    navigate(`/pessoas/respostas/${id}`);
  };

  const handleToggleStatus = async (form: Form) => {
    try {
      const newStatus: FormStatus =
        form.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      await formApi.updateForm(form.id, { status: newStatus });
      await loadForms();
    } catch (error) {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    }
  };

  const handleArchiveForm = async (id: string) => {
    if (confirm("Tem certeza que deseja arquivar este formulário?")) {
      try {
        await formApi.updateForm(id, { status: "ARCHIVED" });
        await loadForms();
      } catch (error) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    }
  };

  const handleDeleteForm = async (id: string) => {
    if (
      confirm(
        "Tem certeza que deseja excluir este formulário? Esta ação não pode ser desfeita e todas as respostas serão perdidas.",
      )
    ) {
      try {
        await formApi.deleteForm(id);

        await loadForms();
      } catch (error: any) {
        // Tratamento específico de erros
        if (error.status === 404) {
          toast.warning(
            "Formulário não encontrado. Pode já ter sido excluído.",
          );
          await loadForms(); // Recarregar lista
        } else if (error.status === 403) {
          toast.warning("Você não tem permissão para excluir este formulário.");
        } else if (error.status === 401) {
          toast.warning("Sessão expirada. Faça login novamente.");
        } else {
          const errorMessage = error.message || "Erro desconhecido";
        }
      }
    }
  };

  const getStatusBadge = (status: FormStatus) => {
    const config = {
      DRAFT: {
        label: "Rascunho",
        className: "bg-gray-400 hover:bg-gray-500 text-white border-0",
      },
      PUBLISHED: {
        label: "Publicado",
        className: "bg-green-500 hover:bg-green-600 text-white border-0",
      },
      ARCHIVED: {
        label: "Arquivado",
        className: "bg-orange-400 hover:bg-orange-500 text-white border-0",
      },
    };

    // ✅ CORREÇÃO: Verificação de segurança para evitar destructuring de undefined
    const statusConfig = config[status];
    if (!statusConfig) {
      console.warn(`Status inválido: ${status}, usando fallback`);
      return (
        <Badge className="bg-gray-400 hover:bg-gray-500 text-white border-0">
          Desconhecido
        </Badge>
      );
    }

    const { label, className } = statusConfig;
    return <Badge className={className}>{label}</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-white/70">Carregando formulários...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl lg:text-3xl font-bold text-white">
            Gerenciar Formulários
          </h1>
          <p className="text-sm text-white/80 mt-1">
            Crie e gerencie formulários para a equipe
          </p>
        </div>
        <Button
          onClick={handleCreateForm}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <Plus className="mr-2 h-4 w-4" />
          Criar Novo Formulário
        </Button>
      </div>

      {/* Campo de Pesquisa */}
      {forms.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            type="text"
            placeholder="Pesquisar formulários por título ou descrição..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {/* Lista de Formulários */}
      {forms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum formulário criado
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Comece criando seu primeiro formulário
            </p>
            <Button
              onClick={handleCreateForm}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Plus className="mr-2 h-4 w-4" />
              Criar Formulário
            </Button>
          </CardContent>
        </Card>
      ) : filteredForms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              Nenhum formulário encontrado
            </h3>
            <p className="text-sm text-gray-600">
              Tente pesquisar com outros termos
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredForms.map((form) => (
            <Card key={form.id} className="hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-bold text-gray-900">
                      {form.title}
                    </CardTitle>
                    {form.description && (
                      <p className="text-sm text-gray-600 mt-1 line-clamp-2">
                        {form.description}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(form.status)}
                  </div>
                </div>

                {/* Badges de Visibilidade */}
                <div className="mt-3 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-gray-500 font-medium">
                    Visível para:
                  </span>
                  {form.allowedDirectorates?.includes("ALL") ||
                  !form.allowedDirectorates ? (
                    <Badge className="bg-purple-500 hover:bg-purple-600 text-white border-0 text-xs">
                      Todas as diretorias
                    </Badge>
                  ) : (
                    form.allowedDirectorates.map((dir) => (
                      <Badge key={dir} variant="outline" className="text-xs">
                        {getAreaLabel(dir)}
                      </Badge>
                    ))
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4 text-sm text-gray-600">
                    <span>
                      Criado em:{" "}
                      {new Date(form.createdAt).toLocaleDateString("pt-BR")}
                    </span>
                    <span>
                      Atualizado:{" "}
                      {new Date(form.updatedAt).toLocaleDateString("pt-BR")}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEditForm(form.id)}
                      title="Editar formulário"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleViewResponses(form.id)}
                      title="Ver respostas"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleToggleStatus(form)}
                      title={
                        form.status === "PUBLISHED" ? "Despublicar" : "Publicar"
                      }
                      className={
                        form.status === "PUBLISHED"
                          ? "text-orange-600"
                          : "text-green-600"
                      }
                    >
                      {form.status === "PUBLISHED" ? "Despublicar" : "Publicar"}
                    </Button>
                    {form.status !== "ARCHIVED" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleArchiveForm(form.id)}
                        title="Arquivar"
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteForm(form.id)}
                      title="Excluir"
                      className="text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
