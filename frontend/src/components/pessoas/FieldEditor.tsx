import { useState } from 'react';
import { Trash2, Copy, ChevronDown, ChevronUp, Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FormField, FieldType, FormFieldOption } from '@/types';

interface FieldEditorProps {
  field: FormField;
  onUpdate: (updates: Partial<FormField>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
}

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'SHORT_TEXT', label: 'Texto curto' },
  { value: 'LONG_TEXT', label: 'Texto longo (parágrafo)' },
  { value: 'MULTIPLE_CHOICE', label: 'Múltipla escolha (uma opção)' },
  { value: 'CHECKBOXES', label: 'Caixas de seleção (várias opções)' },
  { value: 'SCALE', label: 'Escala numérica (1 a 5)' },
  { value: 'DATE', label: 'Data' },
  { value: 'NUMBER', label: 'Número' }
  // DROPDOWN removido da lista de criação
];

export function FieldEditor({ field, onUpdate, onDuplicate, onDelete }: FieldEditorProps) {
  const [expanded, setExpanded] = useState(true); // Sempre expandido por padrão

  const handleAddOption = () => {
    const options = field.config?.options || [];
    const newOption: FormFieldOption = {
      id: `opt-${Date.now()}`,
      label: `Opção ${options.length + 1}`,
      value: `option_${options.length + 1}`
    };
    onUpdate({
      config: {
        ...field.config,
        options: [...options, newOption]
      }
    });
  };

  const handleUpdateOption = (optionId: string, label: string) => {
    const options = field.config?.options || [];
    onUpdate({
      config: {
        ...field.config,
        options: options.map(opt => 
          opt.id === optionId ? { ...opt, label, value: label.toLowerCase().replace(/\s+/g, '_') } : opt
        )
      }
    });
  };

  const handleDeleteOption = (optionId: string) => {
    const options = field.config?.options || [];
    onUpdate({
      config: {
        ...field.config,
        options: options.filter(opt => opt.id !== optionId)
      }
    });
  };

  const needsOptions = ['MULTIPLE_CHOICE', 'CHECKBOXES', 'DROPDOWN'].includes(field.type);
  const needsScale = field.type === 'SCALE';

  // Obter o label do tipo de campo (incluindo DROPDOWN para campos existentes)
  const getFieldTypeLabel = (type: FieldType) => {
    if (type === 'DROPDOWN') return 'Lista suspensa (dropdown)';
    if (type === 'SCALE') return 'Escala numérica (1 a 5)';
    const fieldType = FIELD_TYPES.find(ft => ft.value === type);
    return fieldType?.label || type;
  };

  return (
    <Card className="p-4 border-l-4 border-blue-500">
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 space-y-3">
            <div>
              <Label htmlFor={`label-${field.id}`}>Rótulo do campo *</Label>
              <Input
                id={`label-${field.id}`}
                value={field.label}
                onChange={(e) => onUpdate({ label: e.target.value })}
                placeholder="Ex: Nome completo, Competência X, etc."
                className="font-semibold"
              />
            </div>
            <div>
              <Label htmlFor={`type-${field.id}`}>Tipo de campo</Label>
              <Select
                value={field.type}
                onValueChange={(value: FieldType) => onUpdate({ type: value })}
              >
                <SelectTrigger id={`type-${field.id}`} className="w-full">
                  <SelectValue>
                    {getFieldTypeLabel(field.type)}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {FIELD_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setExpanded(!expanded)}
              title={expanded ? 'Recolher' : 'Expandir'}
            >
              {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDuplicate}
              title="Duplicar campo"
            >
              <Copy className="h-4 w-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={onDelete}
              title="Excluir campo"
              className="text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Configurações sempre visíveis */}
        {expanded && (
          <div className="space-y-4 pt-3 border-t">
            <div>
              <Label htmlFor={`help-${field.id}`}>Texto de ajuda (opcional)</Label>
              <Input
                id={`help-${field.id}`}
                value={field.helpText || ''}
                onChange={(e) => onUpdate({ helpText: e.target.value })}
                placeholder="Texto explicativo para o usuário"
              />
            </div>

            {['SHORT_TEXT', 'LONG_TEXT', 'NUMBER'].includes(field.type) && (
              <div>
                <Label htmlFor={`placeholder-${field.id}`}>Placeholder (opcional)</Label>
                <Input
                  id={`placeholder-${field.id}`}
                  value={field.config?.placeholder || ''}
                  onChange={(e) => onUpdate({ 
                    config: { ...field.config, placeholder: e.target.value }
                  })}
                  placeholder="Texto de exemplo no campo"
                />
              </div>
            )}

            {needsOptions && (
              <div className="space-y-3">
                <Label>Opções *</Label>
                <p className="text-sm text-gray-600">Configure as opções que o usuário poderá selecionar:</p>
                {(field.config?.options || []).map((option, index) => (
                  <div key={option.id} className="flex gap-2 items-center">
                    <span className="text-sm text-gray-500 w-8">{index + 1}.</span>
                    <Input
                      value={option.label}
                      onChange={(e) => handleUpdateOption(option.id, e.target.value)}
                      placeholder={`Opção ${index + 1}`}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDeleteOption(option.id)}
                      className="text-red-600"
                      title="Remover opção"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <Button onClick={handleAddOption} variant="outline" size="sm" className="w-full">
                  <Plus className="mr-2 h-4 w-4" />
                  Adicionar Opção
                </Button>
                {(field.config?.options || []).length === 0 && (
                  <p className="text-sm text-amber-600">⚠️ Adicione pelo menos uma opção para este campo funcionar</p>
                )}
              </div>
            )}

            {needsScale && (
              <div className="space-y-3">
                <Label>Configuração da Escala</Label>
                <p className="text-sm text-gray-600">Defina os valores e rótulos da escala numérica:</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label htmlFor={`min-${field.id}`}>Valor mínimo</Label>
                    <Input
                      id={`min-${field.id}`}
                      type="number"
                      value={field.config?.minValue || 1}
                      onChange={(e) => onUpdate({
                        config: { ...field.config, minValue: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`max-${field.id}`}>Valor máximo</Label>
                    <Input
                      id={`max-${field.id}`}
                      type="number"
                      value={field.config?.maxValue || 5}
                      onChange={(e) => onUpdate({
                        config: { ...field.config, maxValue: parseInt(e.target.value) }
                      })}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`minlabel-${field.id}`}>Rótulo mínimo (opcional)</Label>
                    <Input
                      id={`minlabel-${field.id}`}
                      value={field.config?.minLabel || ''}
                      onChange={(e) => onUpdate({
                        config: { ...field.config, minLabel: e.target.value }
                      })}
                      placeholder="Ex: Baixo domínio"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`maxlabel-${field.id}`}>Rótulo máximo (opcional)</Label>
                    <Input
                      id={`maxlabel-${field.id}`}
                      value={field.config?.maxLabel || ''}
                      onChange={(e) => onUpdate({
                        config: { ...field.config, maxLabel: e.target.value }
                      })}
                      placeholder="Ex: Alto domínio"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex items-center justify-between pt-3 border-t">
              <div>
                <Label htmlFor={`required-${field.id}`} className="text-base">Campo obrigatório</Label>
                <p className="text-sm text-gray-600">O usuário deve preencher este campo</p>
              </div>
              <Switch
                id={`required-${field.id}`}
                checked={field.required}
                onCheckedChange={(checked) => onUpdate({ required: checked })}
              />
            </div>

            {/* Preview do campo */}
            <div className="pt-3 border-t">
              <Label className="text-sm text-gray-600 mb-2 block">Preview (como o usuário verá):</Label>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="space-y-2">
                  <Label className="font-semibold">
                    {field.label || 'Rótulo do campo'} {field.required && <span className="text-red-500">*</span>}
                  </Label>
                  {field.helpText && <p className="text-sm text-gray-600">{field.helpText}</p>}
                  
                  {field.type === 'SHORT_TEXT' && (
                    <Input placeholder={field.config?.placeholder || 'Texto de resposta curta'} disabled />
                  )}
                  
                  {field.type === 'LONG_TEXT' && (
                    <textarea 
                      className="w-full p-2 border rounded-md" 
                      placeholder={field.config?.placeholder || 'Texto de resposta longa'} 
                      rows={3}
                      disabled
                    />
                  )}
                  
                  {field.type === 'NUMBER' && (
                    <Input type="number" placeholder={field.config?.placeholder || '0'} disabled />
                  )}
                  
                  {field.type === 'DATE' && (
                    <Input type="date" disabled />
                  )}
                  
                  {field.type === 'MULTIPLE_CHOICE' && (
                    <div className="space-y-2">
                      {(field.config?.options || []).map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <input type="radio" disabled />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                      {(field.config?.options || []).length === 0 && (
                        <p className="text-sm text-gray-400 italic">Adicione opções acima</p>
                      )}
                    </div>
                  )}
                  
                  {field.type === 'CHECKBOXES' && (
                    <div className="space-y-2">
                      {(field.config?.options || []).map((option) => (
                        <div key={option.id} className="flex items-center space-x-2">
                          <input type="checkbox" disabled />
                          <span className="text-sm">{option.label}</span>
                        </div>
                      ))}
                      {(field.config?.options || []).length === 0 && (
                        <p className="text-sm text-gray-400 italic">Adicione opções acima</p>
                      )}
                    </div>
                  )}
                  
                  {field.type === 'SCALE' && (
                    <div className="flex items-center gap-4">
                      {field.config?.minLabel && (
                        <span className="text-sm text-gray-600">{field.config.minLabel}</span>
                      )}
                      <div className="flex gap-2">
                        {Array.from({ 
                          length: (field.config?.maxValue || 5) - (field.config?.minValue || 1) + 1 
                        }, (_, i) => (field.config?.minValue || 1) + i).map((num) => (
                          <div key={num} className="flex flex-col items-center">
                            <input type="radio" disabled />
                            <span className="text-sm mt-1">{num}</span>
                          </div>
                        ))}
                      </div>
                      {field.config?.maxLabel && (
                        <span className="text-sm text-gray-600">{field.config.maxLabel}</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}