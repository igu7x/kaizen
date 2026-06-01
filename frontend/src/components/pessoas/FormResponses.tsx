import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Download, Eye, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Layout } from '@/components/layout/Layout';
import { formApi } from '@/services/formApi';
import { FormWithDetails, ResponseWithAnswers, FormField } from '@/types';

export function FormResponses() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState<FormWithDetails | null>(null);
  const [responses, setResponses] = useState<ResponseWithAnswers[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedResponse, setSelectedResponse] = useState<ResponseWithAnswers | null>(null);

  useEffect(() => {
    if (id) {
      loadData(id);
    }
  }, [id]);

  const loadData = async (formId: string) => {
    try {
      setLoading(true);
      const [formData, responsesData] = await Promise.all([
        formApi.getFormById(formId),
        formApi.getFormResponses(formId)
      ]);

      if (formData) {
        setForm(formData);
      }
      setResponses(responsesData);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    if (!form || responses.length === 0) return;

    // Criar cabeçalhos
    const headers = ['Usuário', 'Data de Envio', ...form.fields.map(f => f.label)];

    // Criar linhas
    const rows = responses
      .filter(r => r.status === 'SUBMITTED')
      .map(response => {
        const row = [
          response.userName,
          response.submittedAt ? new Date(response.submittedAt).toLocaleString('pt-BR') : ''
        ];

        form.fields.forEach(field => {
          // ✅ CORREÇÃO: Converter IDs para string para garantir comparação correta
          const answer = response.answers.find(a => String(a.fieldId) === String(field.id));
          let value = '';

          if (answer) {
            // ✅ CORREÇÃO: Respeitar o tipo do campo
            const fieldType = (field.type || (field as any).field_type || '').toUpperCase();

            switch (fieldType) {
              case 'CHECKBOXES':
              case 'CHECKBOX':
                // Múltiplas opções selecionadas
                if (Array.isArray(answer.value)) {
                  value = answer.value.join('; ');
                } else {
                  value = String(answer.value);
                }
                break;

              case 'DATE':
                try {
                  value = new Date(answer.value as string).toLocaleDateString('pt-BR');
                } catch {
                  value = String(answer.value);
                }
                break;

              default:
                // Texto simples
                if (Array.isArray(answer.value)) {
                  value = answer.value.join('; ');
                } else {
                  value = String(answer.value);
                }
                break;
            }
          }

          // Escapar aspas duplas e envolver em aspas
          row.push(`"${String(value).replace(/"/g, '""')}"`);
        });

        return row.join(',');
      });

    // Juntar tudo
    const csvContent = [
      headers.join(','),
      ...rows
    ].join('\n');

    // Criar blob e baixar (com BOM para Excel)
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `respostas_${form.title}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getFieldValue = (field: FormField, response: ResponseWithAnswers): string => {
    // ✅ CORREÇÃO CRÍTICA: Converter IDs para string para garantir comparação correta
    const answer = response.answers.find(a => String(a.fieldId) === String(field.id));

    if (!answer) {
      return '(não respondido)';
    }

    if (Array.isArray(answer.value)) {
      return answer.value.join(', ');
    }

    if (field.type === 'SCALE' || field.type === 'NUMBER') {
      return String(answer.value);
    }

    if (field.type === 'DATE') {
      try {
        return new Date(answer.value as string).toLocaleDateString('pt-BR');
      } catch {
        return String(answer.value);
      }
    }

    return String(answer.value);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Carregando respostas...</div>
        </div>
      </Layout>
    );
  }

  if (!form) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Formulário não encontrado</div>
        </div>
      </Layout>
    );
  }

  const submittedResponses = responses.filter(r => r.status === 'SUBMITTED');

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" onClick={() => navigate('/pessoas')} className="text-white hover:text-white/90 hover:bg-white/10">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-white">{form.title}</h1>
              <p className="text-sm text-white">Respostas recebidas</p>
            </div>
          </div>
          {submittedResponses.length > 0 && (
            <Button onClick={handleExportCSV} variant="outline" className="text-white border-white hover:bg-white/10 hover:text-white">
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          )}
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-blue-600">{responses.length}</div>
                <div className="text-sm text-gray-600">Total de respostas</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{submittedResponses.length}</div>
                <div className="text-sm text-gray-600">Enviadas</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-yellow-600">
                  {responses.filter(r => r.status === 'DRAFT').length}
                </div>
                <div className="text-sm text-gray-600">Em rascunho</div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Lista de Respostas */}
        {submittedResponses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Eye className="h-16 w-16 text-gray-300 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhuma resposta enviada</h3>
              <p className="text-sm text-gray-600">Aguardando usuários responderem o formulário</p>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Respostas Enviadas</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Data de Envio</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submittedResponses.map((response) => (
                      <TableRow key={response.id}>
                        <TableCell className="font-medium">{response.userName}</TableCell>
                        <TableCell>
                          {response.submittedAt
                            ? new Date(response.submittedAt).toLocaleString('pt-BR')
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <Badge className="bg-green-500 hover:bg-green-600 text-white border-0">
                            Enviado
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedResponse(response)}
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            Ver Detalhes
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Modal de Detalhes da Resposta */}
        <Dialog open={!!selectedResponse} onOpenChange={() => setSelectedResponse(null)}>
          <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <div className="flex items-center justify-between">
                <DialogTitle>Detalhes da Resposta</DialogTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedResponse(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </DialogHeader>

            {selectedResponse && (
              <div className="space-y-6">
                {/* Informações do Respondente */}
                <Card className="bg-blue-50">
                  <CardContent className="pt-6">
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <p className="text-sm text-gray-600">Usuário</p>
                        <p className="font-semibold">{selectedResponse.userName}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Data de Envio</p>
                        <p className="font-semibold">
                          {selectedResponse.submittedAt
                            ? new Date(selectedResponse.submittedAt).toLocaleString('pt-BR')
                            : '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Data de Atualização</p>
                        <p className="font-semibold">
                          {selectedResponse.updatedAt
                            ? new Date(selectedResponse.updatedAt).toLocaleString('pt-BR')
                            : '-'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Respostas por Seção */}
                {form.fields.filter(f => !f.sectionId).length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Campos Gerais</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {form.fields
                        .filter(f => !f.sectionId)
                        .sort((a, b) => a.order - b.order)
                        .map((field) => (
                          <div key={field.id} className="border-b pb-3 last:border-b-0">
                            <p className="text-sm font-semibold text-gray-700 mb-1">
                              {field.label} (ID: {field.id}) {field.required && <span className="text-red-500">*</span>}
                            </p>
                            <p className="text-gray-900">
                              {getFieldValue(field, selectedResponse)}
                            </p>
                          </div>
                        ))}
                    </CardContent>
                  </Card>
                )}

                {form.sections.sort((a, b) => a.order - b.order).map((section) => {
                  const sectionFields = form.fields
                    .filter(f => f.sectionId === section.id)
                    .sort((a, b) => a.order - b.order);

                  if (sectionFields.length === 0) return null;

                  return (
                    <Card key={section.id}>
                      <CardHeader className="bg-blue-50">
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                        {section.description && (
                          <p className="text-sm text-gray-600 mt-1">{section.description}</p>
                        )}
                      </CardHeader>
                      <CardContent className="space-y-4 pt-6">
                        {sectionFields.map((field) => (
                          <div key={field.id} className="border-b pb-3 last:border-b-0">
                            <p className="text-sm font-semibold text-gray-700 mb-1">
                              {field.label} (ID: {field.id}) {field.required && <span className="text-red-500">*</span>}
                            </p>
                            <p className="text-gray-900">
                              {getFieldValue(field, selectedResponse)}
                            </p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </Layout>
  );
}