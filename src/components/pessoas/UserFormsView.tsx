import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, CheckCircle, Clock, Circle, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formApi } from '@/services/formApi';
import { Form, FormResponse } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { useDirectorate } from '@/contexts/DirectorateContext';

export function UserFormsView() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { selectedDirectorate } = useDirectorate();
  const [forms, setForms] = useState<Form[]>([]);
  const [filteredForms, setFilteredForms] = useState<Form[]>([]);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [selectedDirectorate]);

  useEffect(() => {
    filterForms();
  }, [forms, searchQuery]);

  const loadData = async () => {
    try {
      setLoading(true);

      console.log('[UserFormsView] Loading forms for directorate:', selectedDirectorate);
      console.log('[UserFormsView] Current user:', user);

      const [formsData, responsesData] = await Promise.all([
        formApi.getForms(selectedDirectorate, { filterByVisibility: true, isAdmin: false }),
        user ? formApi.getUserResponses(user.id, selectedDirectorate) : []
      ]);

      console.log('[UserFormsView] Forms received from API:', formsData.length);

      const publishedForms = formsData.filter(f => f.status === 'PUBLISHED');
      console.log('[UserFormsView] Published forms:', publishedForms.length);

      setForms(publishedForms);
      setResponses(responsesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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
    const filtered = forms.filter(form => {
      const titleMatch = form.title.toLowerCase().includes(query);
      const descriptionMatch = form.description?.toLowerCase().includes(query);
      return titleMatch || descriptionMatch;
    });
    setFilteredForms(filtered);
  };

  const getFormStatus = (formId: string) => {
    // ✅ CORREÇÃO CRÍTICA: Converter IDs para string para garantir comparação correta
    const response = responses.find(r => String(r.formId) === String(formId));

    console.log(`[DEBUG] Getting status for form ${formId} (${typeof formId})`);
    if (response) {
      console.log(`[DEBUG] Found response with formId: ${response.formId} (${typeof response.formId}), status: ${response.status}`);
    }

    if (!response) return 'NOT_STARTED';
    if (response.status === 'SUBMITTED') return 'SUBMITTED';
    return 'IN_PROGRESS';
  };

  const getStatusBadge = (formId: string) => {
    const status = getFormStatus(formId);
    const config = {
      NOT_STARTED: {
        label: 'Não iniciado',
        className: 'bg-gray-400 hover:bg-gray-500 text-white border-0',
        icon: Circle
      },
      IN_PROGRESS: {
        label: 'Em andamento',
        className: 'bg-yellow-400 hover:bg-yellow-500 text-gray-900 border-0',
        icon: Clock
      },
      SUBMITTED: {
        label: 'Enviado',
        className: 'bg-green-500 hover:bg-green-600 text-white border-0',
        icon: CheckCircle
      }
    };
    const { label, className, icon: Icon } = config[status];
    return (
      <Badge className={className}>
        <Icon className="h-3 w-3 mr-1" />
        {label}
      </Badge>
    );
  };

  const handleOpenForm = (formId: string) => {
    // ✅ CORREÇÃO CRÍTICA: Converter IDs para string
    const response = responses.find(r => String(r.formId) === String(formId));

    // ✅ VALIDAÇÃO: Se já foi submetido, apenas visualizar (read-only)
    if (response && response.status === 'SUBMITTED') {
      navigate(`/pessoas/responder/${formId}?responseId=${response.id}`);
    } else if (response) {
      navigate(`/pessoas/responder/${formId}?responseId=${response.id}`);
    } else {
      navigate(`/pessoas/responder/${formId}`);
    }
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
      <div>
        <h1 className="text-2xl lg:text-3xl font-bold text-white">Formulários Disponíveis</h1>
        <p className="text-sm text-white/80 mt-1">Preencha os formulários solicitados pela sua diretoria</p>
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
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum formulário disponível</h3>
            <p className="text-sm text-gray-600">Não há formulários publicados no momento</p>
          </CardContent>
        </Card>
      ) : filteredForms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Search className="h-16 w-16 text-gray-300 mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum formulário encontrado</h3>
            <p className="text-sm text-gray-600">Tente pesquisar com outros termos</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredForms.map((form) => {
            const status = getFormStatus(form.id);
            const isSubmitted = status === 'SUBMITTED';

            return (
              <Card key={form.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg font-bold text-gray-900">{form.title}</CardTitle>
                      {form.description && (
                        <p className="text-sm text-gray-600 mt-1">{form.description}</p>
                      )}
                    </div>
                    {getStatusBadge(form.id)}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-gray-600">
                      {isSubmitted ? (
                        <span>Enviado em: {new Date(responses.find(r => String(r.formId) === String(form.id))?.submittedAt || '').toLocaleDateString('pt-BR')}</span>
                      ) : (
                        <span>Clique para {status === 'IN_PROGRESS' ? 'continuar' : 'iniciar'} o preenchimento</span>
                      )}
                    </div>
                    <Button
                      onClick={() => handleOpenForm(form.id)}
                      className={isSubmitted ? 'bg-gray-600 hover:bg-gray-700' : 'bg-blue-600 hover:bg-blue-700'}
                    >
                      {isSubmitted ? 'Ver Respostas' : status === 'IN_PROGRESS' ? 'Continuar' : 'Responder'}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}