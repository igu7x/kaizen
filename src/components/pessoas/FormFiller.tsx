import { useState, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formApi } from '@/services/formApi';
import { FormWithDetails, ResponseWithAnswers, FormField, FormFieldOption } from '@/types';
import { useAuth } from '@/contexts/AuthContext';
import { Layout } from '@/components/layout/Layout';

export function FormFiller() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [form, setForm] = useState<FormWithDetails | null>(null);
  const [response, setResponse] = useState<ResponseWithAnswers | null>(null);
  const [answers, setAnswers] = useState<Record<string, string | string[] | number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isReadOnly, setIsReadOnly] = useState(false);

  useEffect(() => {
    loadForm();
  }, [id]);

  const loadForm = async () => {
    if (!id) return;

    try {
      setLoading(true);
      const formData = await formApi.getFormById(id);
      if (!formData) {
        alert('Formulário não encontrado');
        navigate('/pessoas');
        return;
      }

      setForm(formData);

      // Verificar se existe resposta existente
      const responseId = searchParams.get('responseId');
      if (responseId) {
        const responses = await formApi.getUserResponses(user?.id || '');
        const existingResponse = responses.find(r => r.id === responseId);

        if (existingResponse) {
          setResponse(existingResponse);
          setIsReadOnly(existingResponse.status === 'SUBMITTED');

          // Carregar respostas existentes
          const answersMap: Record<string, string | string[] | number> = {};
          existingResponse.answers?.forEach(answer => {
            answersMap[answer.fieldId] = answer.value;
          });
          setAnswers(answersMap);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar formulário:', error);
      alert('Erro ao carregar formulário. Por favor, tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!form || !user) return;

    try {
      setSaving(true);

      // Preparar respostas
      const answersToSave = Object.entries(answers).map(([fieldId, value]) => ({
        fieldId,
        value
      }));

      // Enviar tudo junto (backend lida com update se já existir)
      const responseData = await formApi.createResponse({
        formId: form.id,
        userId: user.id,
        userName: user.name,
        status: 'DRAFT',
        answers: answersToSave
      });

      setResponse(responseData as any);
      alert('Rascunho salvo com sucesso!');
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
      alert('Erro ao salvar rascunho. Por favor, tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (!form || !user) {
      alert('Erro: Formulário ou usuário não encontrado.');
      return;
    }

    // Validar campos obrigatórios - usar String() para comparação consistente
    const requiredFields = form.fields.filter(f => f.required);
    const missingFields = requiredFields.filter(f => {
      const fieldId = String(f.id);
      const value = answers[fieldId];
      return !value || value === '' || (Array.isArray(value) && value.length === 0);
    });

    if (missingFields.length > 0) {
      alert(`Por favor, preencha todos os campos obrigatórios: ${missingFields.map(f => f.label).join(', ')}`);
      return;
    }

    if (!confirm('Tem certeza que deseja enviar este formulário? Após o envio, não será possível editar as respostas.')) {
      return;
    }

    try {
      setSaving(true);

      // ✅ Preparar respostas - garantir que fieldId seja string para o backend converter
      const answersToSave = Object.entries(answers)
        .filter(([_, value]) => value !== undefined && value !== null && value !== '')
        .map(([fieldId, value]) => ({
          fieldId: fieldId, // Será convertido para número no backend
          value: value
        }));

      console.log('[FormFiller] Enviando resposta:', {
        formId: form.id,
        userId: user.id,
        answersCount: answersToSave.length,
        answers: answersToSave
      });

      // Enviar tudo junto
      await formApi.createResponse({
        formId: form.id,
        userId: user.id,
        userName: user.name,
        status: 'SUBMITTED',
        submittedAt: new Date().toISOString(),
        answers: answersToSave
      });

      alert('Formulário enviado com sucesso!');
      navigate('/pessoas');
    } catch (error: any) {
      console.error('[FormFiller] Erro ao enviar formulário:', error);
      
      // Tratamento específico para diferentes tipos de erro
      if (error.status === 409 || error.message?.includes('409') || error.message?.includes('já respondeu')) {
        alert('Você já respondeu este formulário.');
      } else if (error.status === 400) {
        alert('Dados inválidos. Verifique as respostas e tente novamente.');
      } else if (error.status === 401) {
        alert('Sessão expirada. Faça login novamente.');
        navigate('/login');
      } else {
        // Mostrar detalhes do erro em desenvolvimento
        const errorDetails = error.message || 'Erro desconhecido';
        console.error('[FormFiller] Detalhes do erro:', errorDetails);
        alert(`Erro ao enviar formulário: ${errorDetails}`);
      }
    } finally {
      setSaving(false);
    }
  };

  const renderField = (field: FormField) => {
    // Normalizar o ID do campo (pode ser número ou string)
    const fieldId = String(field.id);
    const value = answers[fieldId];
    const isRequired = field.required;
    const optionalLabel = !isRequired ? ' (opcional)' : '';

    // ✅ CORREÇÃO: Normalizar o tipo do campo (aceita field.type OU field.fieldType OU field.field_type)
    const rawType = field.type || (field as any).fieldType || (field as any).field_type || '';
    const fieldType = rawType.toUpperCase();

    // Debug: log para verificar os dados do campo
    if (process.env.NODE_ENV === 'development') {
      console.log(`[FormFiller] Field: "${field.label}" | Type: "${fieldType}" | ID: ${fieldId}`, field);
    }

    switch (fieldType) {
      case 'SHORT_TEXT':
      case 'TEXT':
      case 'EMAIL':
      case 'PHONE':
      case 'URL':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200 min-h-[40px]">
                <span className="text-gray-800">{(value as string) || <em className="text-gray-400">Não respondido</em>}</span>
              </div>
            ) : (
              <Input
                type={fieldType === 'EMAIL' ? 'email' : fieldType === 'URL' ? 'url' : 'text'}
                value={(value as string) || ''}
                onChange={(e) => setAnswers({ ...answers, [fieldId]: e.target.value })}
                placeholder={field.config?.placeholder || 'Texto de resposta curta'}
                required={isRequired}
              />
            )}
          </div>
        );

      case 'LONG_TEXT':
      case 'TEXTAREA':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200 min-h-[80px] whitespace-pre-wrap">
                <span className="text-gray-800">{(value as string) || <em className="text-gray-400">Não respondido</em>}</span>
              </div>
            ) : (
              <Textarea
                value={(value as string) || ''}
                onChange={(e) => setAnswers({ ...answers, [fieldId]: e.target.value })}
                placeholder={field.config?.placeholder || 'Texto de resposta longa'}
                required={isRequired}
                rows={4}
              />
            )}
          </div>
        );

      case 'MULTIPLE_CHOICE':
      case 'RADIO':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200">
                {(() => {
                  const selectedOption = (field.config?.options || []).find((opt: FormFieldOption) => opt.value === value);
                  return selectedOption ? (
                    <span className="text-gray-800 flex items-center">
                      <span className="w-4 h-4 rounded-full bg-blue-500 mr-2 flex items-center justify-center">
                        <span className="w-2 h-2 rounded-full bg-white"></span>
                      </span>
                      {selectedOption.label}
                    </span>
                  ) : (
                    <em className="text-gray-400">Não respondido</em>
                  );
                })()}
              </div>
            ) : (
              <RadioGroup
                value={(value as string) || ''}
                onValueChange={(val) => setAnswers({ ...answers, [fieldId]: val })}
              >
                {(field.config?.options || []).map((option: FormFieldOption) => (
                  <div key={option.id} className="flex items-center space-x-2">
                    <RadioGroupItem value={option.value} id={`${fieldId}-${option.id}`} />
                    <Label htmlFor={`${fieldId}-${option.id}`} className="font-normal cursor-pointer">
                      {option.label}
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            )}
          </div>
        );

      case 'CHECKBOXES':
      case 'CHECKBOX':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200">
                {Array.isArray(value) && value.length > 0 ? (
                  <div className="space-y-1">
                    {value.map((val: string) => {
                      const option = (field.config?.options || []).find((opt: FormFieldOption) => opt.value === val);
                      return (
                        <div key={val} className="flex items-center text-gray-800">
                          <span className="w-4 h-4 rounded bg-blue-500 mr-2 flex items-center justify-center">
                            <span className="text-white text-xs">✓</span>
                          </span>
                          {option?.label || val}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <em className="text-gray-400">Não respondido</em>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {(field.config?.options || []).map((option: FormFieldOption) => {
                  const checked = Array.isArray(value) && value.includes(option.value);
                  return (
                    <div key={option.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`${fieldId}-${option.id}`}
                        checked={checked}
                        onCheckedChange={(checked) => {
                          const currentValues = Array.isArray(value) ? value : [];
                          const newValues = checked
                            ? [...currentValues, option.value]
                            : currentValues.filter((v: string) => v !== option.value);
                          setAnswers({ ...answers, [fieldId]: newValues });
                        }}
                      />
                      <Label htmlFor={`${fieldId}-${option.id}`} className="font-normal cursor-pointer">
                        {option.label}
                      </Label>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );

      case 'SCALE': {
        const minValue = field.config?.minValue || 1;
        const maxValue = field.config?.maxValue || 5;
        const options = Array.from({ length: maxValue - minValue + 1 }, (_, i) => minValue + i);

        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200">
                <div className="flex items-center gap-4">
                  {field.config?.minLabel && (
                    <span className="text-sm text-gray-600">{field.config.minLabel}</span>
                  )}
                  <div className="flex gap-2">
                    {options.map((num) => (
                      <div key={num} className="flex flex-col items-center">
                        <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                          value === num || value?.toString() === num.toString() 
                            ? 'bg-blue-500 text-white' 
                            : 'bg-gray-200 text-gray-400'
                        }`}>
                          {num}
                        </span>
                      </div>
                    ))}
                  </div>
                  {field.config?.maxLabel && (
                    <span className="text-sm text-gray-600">{field.config.maxLabel}</span>
                  )}
                </div>
                {!value && <em className="text-gray-400 block mt-2">Não respondido</em>}
              </div>
            ) : (
              <div className="flex items-center gap-4">
                {field.config?.minLabel && (
                  <span className="text-sm text-gray-600">{field.config.minLabel}</span>
                )}
                <RadioGroup
                  value={value?.toString() || ''}
                  onValueChange={(val) => setAnswers({ ...answers, [fieldId]: parseInt(val) })}
                  className="flex gap-2"
                >
                  {options.map((num) => (
                    <div key={num} className="flex flex-col items-center">
                      <RadioGroupItem value={num.toString()} id={`${fieldId}-${num}`} />
                      <Label htmlFor={`${fieldId}-${num}`} className="font-normal text-sm mt-1">
                        {num}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
                {field.config?.maxLabel && (
                  <span className="text-sm text-gray-600">{field.config.maxLabel}</span>
                )}
              </div>
            )}
          </div>
        );
      }

      case 'DATE':
      case 'DATETIME':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200">
                <span className="text-gray-800">
                  {value ? (
                    fieldType === 'DATETIME' 
                      ? new Date(value as string).toLocaleString('pt-BR')
                      : new Date(value as string).toLocaleDateString('pt-BR')
                  ) : (
                    <em className="text-gray-400">Não respondido</em>
                  )}
                </span>
              </div>
            ) : (
              <Input
                type={fieldType === 'DATETIME' ? 'datetime-local' : 'date'}
                value={(value as string) || ''}
                onChange={(e) => setAnswers({ ...answers, [fieldId]: e.target.value })}
                required={isRequired}
              />
            )}
          </div>
        );

      case 'NUMBER':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200">
                <span className="text-gray-800">{value !== undefined && value !== '' ? value : <em className="text-gray-400">Não respondido</em>}</span>
              </div>
            ) : (
              <Input
                type="number"
                value={(value as number) || ''}
                onChange={(e) => setAnswers({ ...answers, [fieldId]: parseFloat(e.target.value) })}
                placeholder={field.config?.placeholder}
                required={isRequired}
              />
            )}
          </div>
        );

      case 'DROPDOWN':
      case 'SELECT':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200">
                {(() => {
                  const selectedOption = (field.config?.options || []).find((opt: FormFieldOption) => opt.value === value);
                  return selectedOption ? (
                    <span className="text-gray-800">{selectedOption.label}</span>
                  ) : (
                    <em className="text-gray-400">Não respondido</em>
                  );
                })()}
              </div>
            ) : (
              <Select
                value={(value as string) || ''}
                onValueChange={(val) => setAnswers({ ...answers, [fieldId]: val })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione uma opção" />
                </SelectTrigger>
                <SelectContent>
                  {(field.config?.options || []).map((option: FormFieldOption) => (
                    <SelectItem key={option.id} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
        );

      case 'FILE':
      case 'IMAGE':
        return (
          <div key={fieldId} className="space-y-2">
            <Label className={isReadOnly ? 'text-gray-700 font-semibold' : ''}>
              {field.label}{!isReadOnly && optionalLabel} {!isReadOnly && isRequired && <span className="text-red-500">*</span>}
            </Label>
            {field.helpText && !isReadOnly && <p className="text-sm text-gray-600">{field.helpText}</p>}
            {isReadOnly ? (
              <div className="p-3 bg-gray-100 rounded-md border border-gray-200">
                <span className="text-gray-800">{value || <em className="text-gray-400">Não respondido</em>}</span>
              </div>
            ) : (
              <>
                <Input
                  type="file"
                  accept={fieldType === 'IMAGE' ? 'image/*' : undefined}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setAnswers({ ...answers, [fieldId]: file.name });
                    }
                  }}
                  required={isRequired}
                />
                <p className="text-xs text-gray-500">
                  Nota: Upload de arquivos será implementado em versão futura
                </p>
              </>
            )}
          </div>
        );

      default:
        console.warn(`[FormFiller] ⚠️ Unsupported field type: "${fieldType}" for field "${field.label}"`, field);
        return (
          <div key={fieldId} className="space-y-2 p-4 border border-red-200 rounded bg-red-50">
            <Label className="text-red-700">{field.label} (Tipo não suportado: {fieldType || 'vazio'})</Label>
            <p className="text-sm text-red-600">
              Este tipo de campo não é reconhecido. Dados do campo: type="{field.type}", fieldType="{(field as any).fieldType}", field_type="{(field as any).field_type}"
            </p>
          </div>
        );
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

  if (!form) {
    return (
      <Layout>
        <div className="flex items-center justify-center h-96">
          <div className="text-gray-500">Formulário não encontrado</div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/pessoas')} className="text-white hover:text-white/90">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          {!isReadOnly && (
            <div className="flex gap-2">
              <Button variant="outline" onClick={handleSaveDraft} disabled={saving} className="text-white border-white hover:bg-white/10 hover:text-white">
                <Save className="mr-2 h-4 w-4" />
                {saving ? 'Salvando...' : 'Salvar Rascunho'}
              </Button>
              <Button onClick={handleSubmit} disabled={saving} className="bg-green-600 hover:bg-green-700">
                <Send className="mr-2 h-4 w-4" />
                {saving ? 'Enviando...' : 'Enviar Formulário'}
              </Button>
            </div>
          )}
        </div>

        {/* Cabeçalho do Formulário */}
        <Card className={isReadOnly ? "bg-green-50 border-green-200" : "bg-blue-50"}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl">{form.title}</CardTitle>
              {isReadOnly && (
                <span className="px-3 py-1 bg-green-500 text-white text-sm font-semibold rounded-full">
                  ✓ Enviado
                </span>
              )}
            </div>
            {form.description && (
              <p className="text-gray-700 mt-2 whitespace-pre-wrap">{form.description}</p>
            )}
            {isReadOnly && response && (
              <div className="mt-4 p-4 bg-green-100 border border-green-300 rounded-lg">
                <p className="text-sm text-green-800 font-semibold mb-1">
                  📋 Este formulário já foi enviado
                </p>
                <p className="text-xs text-green-700">
                  Enviado em: {response.submittedAt 
                    ? new Date(response.submittedAt).toLocaleString('pt-BR') 
                    : new Date(response.createdAt || '').toLocaleString('pt-BR')}
                </p>
                <p className="text-xs text-green-600 mt-2">
                  As respostas abaixo são somente para visualização e não podem ser editadas.
                </p>
              </div>
            )}
          </CardHeader>
        </Card>

        {/* Campos sem seção */}
        {form.fields.filter(f => !f.sectionId || f.sectionId === 'undefined').length > 0 && (
          <Card>
            <CardContent className="pt-6 space-y-6">
              {form.fields
                .filter(f => !f.sectionId || f.sectionId === 'undefined')
                .sort((a, b) => (a.order || 0) - (b.order || 0))
                .map(renderField)}
            </CardContent>
          </Card>
        )}

        {/* Seções */}
        {form.sections.sort((a, b) => (a.order || 0) - (b.order || 0)).map((section) => {
          // Normalizar IDs para comparação (podem ser string ou number)
          const sectionId = String(section.id);
          const sectionFields = form.fields
            .filter(f => String(f.sectionId) === sectionId)
            .sort((a, b) => (a.order || 0) - (b.order || 0));

          if (process.env.NODE_ENV === 'development') {
            console.log(`[FormFiller] Section: "${section.title}" (ID: ${sectionId}) | Fields: ${sectionFields.length}`);
          }

          // Só renderizar seção se houver campos
          if (sectionFields.length === 0) {
            if (process.env.NODE_ENV === 'development') {
              console.warn(`[FormFiller] ⚠ Section "${section.title}" has NO fields`);
            }
            return null;
          }

          return (
            <Card key={section.id}>
              <CardHeader className="bg-blue-50">
                <CardTitle className="text-xl">{section.title}</CardTitle>
                {section.description && (
                  <p className="text-gray-700 mt-1">{section.description}</p>
                )}
              </CardHeader>
              <CardContent className="pt-6 space-y-6">
                {sectionFields.map(renderField)}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </Layout>
  );
}
