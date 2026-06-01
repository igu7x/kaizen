import React, { useState, useEffect, useCallback } from 'react';
import { X, Save, AlertCircle, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { colaboradoresApi } from '@/services/colaboradoresApi';
import { toast } from 'sonner';
import { API_BASE_URL } from '@/services/apiClient';

interface ModalGestorProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  gestorEditar?: any;
  diretoria?: string;
}

interface PossiveliPai {
  id: number;
  nome_area: string;
  nome_gestor: string;
  nome_cargo: string;
  diretoria: string;
  linha_organograma: number;
}

const getNomeNivel = (linha: number): string => {
  const nomes: Record<number, string> = {
    1: 'Diretoria',
    2: 'Coordenadoria',
    3: 'Divisão',
    4: 'Núcleo'
  };
  return nomes[linha] || `Nível ${linha}`;
};

export const ModalGestor: React.FC<ModalGestorProps> = ({ isOpen, onClose, onSuccess, gestorEditar, diretoria }) => {
  const [formData, setFormData] = useState({
    nome_area: '',
    nome_exibicao: '',
    nome_gestor: '',
    nome_cargo: '',
    linha_organograma: 1,
    subordinacao_id: null as number | null,
  });
  
  const [semGestor, setSemGestor] = useState(false);

  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [fotoRemovida, setFotoRemovida] = useState(false);
  const [possiveisPais, setPossiveisPais] = useState<PossiveliPai[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingPais, setLoadingPais] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isInitialized, setIsInitialized] = useState(false);

  // Função para buscar possíveis pais (todos os níveis superiores)
  // Agora filtra pela diretoria atual
  const fetchPossiveisPais = useCallback(async (linha: number, diretoriaFiltro?: string): Promise<PossiveliPai[]> => {
    if (linha <= 1) {
      setPossiveisPais([]);
      return [];
    }
    
    setLoadingPais(true);
    try {
      // Usar a diretoria passada, ou a diretoria do gestor sendo editado, ou a diretoria prop
      const dir = diretoriaFiltro || gestorEditar?.diretoria || diretoria;
      const response = await colaboradoresApi.getPossiveisPais(linha, dir);
      console.log('Possíveis pais carregados para linha', linha, 'diretoria', dir, ':', response);
      setPossiveisPais(response || []);
      return response || [];
    } catch (error) {
      console.error('Erro ao buscar possíveis pais:', error);
      toast.error('Erro ao carregar áreas superiores');
      setPossiveisPais([]);
      return [];
    } finally {
      setLoadingPais(false);
    }
  }, [gestorEditar?.diretoria, diretoria]);

  // Reset quando modal fecha
  useEffect(() => {
    if (!isOpen) {
      setIsInitialized(false);
    }
  }, [isOpen]);

  // Efeito para carregar dados do gestor ao editar
  useEffect(() => {
    const carregarDadosEdicao = async () => {
      if (!isOpen || isInitialized) return;
      
      if (gestorEditar) {
        console.log('Carregando dados para edição:', gestorEditar);
        
        // Se é linha > 1, primeiro carregar os possíveis pais
        if (gestorEditar.linha_organograma > 1) {
          await fetchPossiveisPais(gestorEditar.linha_organograma);
        }
        
        // Agora carregar o formData
        setFormData({
          nome_area: gestorEditar.nome_area || '',
          nome_exibicao: gestorEditar.nome_exibicao || '',
          nome_gestor: gestorEditar.nome_gestor || '',
          nome_cargo: gestorEditar.nome_cargo || '',
          linha_organograma: gestorEditar.linha_organograma || 1,
          subordinacao_id: gestorEditar.subordinacao_id || null,
        });
        
        // Verificar se é "sem gestor" (nome_gestor vazio ou igual a "Sem gestor")
        const isSemGestor = !gestorEditar.nome_gestor || gestorEditar.nome_gestor.trim() === '' || gestorEditar.nome_gestor === 'Sem gestor';
        setSemGestor(isSemGestor);
        
        // Carregar preview da foto existente
        if (gestorEditar.foto_gestor) {
          // Se já é uma URL completa (http/https ou data:), usar diretamente
          if (gestorEditar.foto_gestor.startsWith('http') || gestorEditar.foto_gestor.startsWith('data:')) {
            setFotoPreview(gestorEditar.foto_gestor);
          } else {
            // Adicionar URL base da API
            setFotoPreview(`${API_BASE_URL}${gestorEditar.foto_gestor}`);
          }
        }
      } else {
        // Modo criação - resetar form
        setFormData({
          nome_area: '',
          nome_exibicao: '',
          nome_gestor: '',
          nome_cargo: '',
          linha_organograma: 1,
          subordinacao_id: null,
        });
        setPossiveisPais([]);
        setSemGestor(false);
      }
      
      setIsInitialized(true);
    };

    carregarDadosEdicao();
  }, [gestorEditar, isOpen, isInitialized, fetchPossiveisPais]);

  // Handler para mudar linha do organograma
  const handleLinhaChange = async (value: string) => {
    const novaLinha = parseInt(value);
    
    // Limpar subordinação se mudar para linha 1
    if (novaLinha === 1) {
      setFormData(prev => ({ 
        ...prev, 
        linha_organograma: novaLinha,
        subordinacao_id: null 
      }));
      setPossiveisPais([]);
    } else {
      // Mudar a linha e buscar novos possíveis pais
      setFormData(prev => ({ 
        ...prev, 
        linha_organograma: novaLinha,
        subordinacao_id: null // Limpar subordinação ao mudar de nível
      }));
      await fetchPossiveisPais(novaLinha);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validar tamanho (máximo 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo 2MB');
      return;
    }

    // Validar tipo
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Apenas imagens JPG, JPEG e PNG são permitidas');
      return;
    }

    setFotoFile(file);
    setFotoRemovida(false); // Resetar flag de remoção quando nova foto é selecionada

    // Gerar preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setFotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.nome_area.trim()) {
      newErrors.nome_area = 'Nome da área é obrigatório';
    }
    // Só validar nome_gestor e nome_cargo se NÃO for "sem gestor"
    if (!semGestor) {
      if (!formData.nome_gestor.trim()) {
        newErrors.nome_gestor = 'Nome do gestor é obrigatório';
      }
      if (!formData.nome_cargo.trim()) {
        newErrors.nome_cargo = 'Nome do cargo é obrigatório';
      }
    }
    if (formData.linha_organograma < 1 || formData.linha_organograma > 4) {
      newErrors.linha_organograma = 'Linha deve estar entre 1 e 4';
    }
    if (formData.linha_organograma > 1 && !formData.subordinacao_id) {
      newErrors.subordinacao_id = 'Subordinação é obrigatória para níveis 2+';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    setLoading(true);

    try {
      // Preparar FormData para incluir arquivo de foto
      const formDataToSend = new FormData();
      formDataToSend.append('nome_area', formData.nome_area);
      // Nome de exibição (opcional) - usado no card do organograma
      if (formData.nome_exibicao?.trim()) {
        formDataToSend.append('nome_exibicao', formData.nome_exibicao.trim());
      }
      // Se "sem gestor", enviar valores vazios
      formDataToSend.append('nome_gestor', semGestor ? '' : formData.nome_gestor);
      formDataToSend.append('nome_cargo', semGestor ? '' : formData.nome_cargo);
      formDataToSend.append('linha_organograma', formData.linha_organograma.toString());
      
      // Adicionar diretoria (se não for "Todas")
      if (diretoria && diretoria !== 'Todas') {
        formDataToSend.append('diretoria', diretoria);
      } else if (gestorEditar?.diretoria) {
        // Manter a diretoria existente ao editar
        formDataToSend.append('diretoria', gestorEditar.diretoria);
      }
      
      if (formData.subordinacao_id) {
        formDataToSend.append('subordinacao_id', formData.subordinacao_id.toString());
      }
      
      // Se "sem gestor", sempre remover foto; senão, enviar se houver
      if (semGestor) {
        formDataToSend.append('remover_foto', 'true');
      } else if (fotoFile) {
        formDataToSend.append('foto', fotoFile);
      } else if (fotoRemovida) {
        // Indicar ao backend que a foto deve ser removida
        formDataToSend.append('remover_foto', 'true');
      }

      if (gestorEditar) {
        await colaboradoresApi.updateGestor(gestorEditar.id, formDataToSend);
        toast.success('Área atualizada com sucesso!');
      } else {
        await colaboradoresApi.createGestor(formDataToSend);
        toast.success('Área criada com sucesso!');
      }
      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.response?.data?.error || 'Erro ao salvar área');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      nome_area: '',
      nome_exibicao: '',
      nome_gestor: '',
      nome_cargo: '',
      linha_organograma: 1,
      subordinacao_id: null,
    });
    setFotoFile(null);
    setFotoPreview(null);
    setFotoRemovida(false);
    setErrors({});
    setPossiveisPais([]);
    setIsInitialized(false);
    setSemGestor(false);
    onClose();
  };

  if (!isOpen) return null;

  // Filtrar pais válidos (com nome)
  const paisValidos = possiveisPais.filter(pai => pai.nome_gestor && pai.nome_gestor.trim() !== '');

  // Valor atual do Select - só definir se os pais já foram carregados E existe o item correspondente
  const itemExiste = paisValidos.some(p => p.id === formData.subordinacao_id);
  const selectValue = (formData.subordinacao_id && itemExiste) ? formData.subordinacao_id.toString() : undefined;
  
  // Encontrar o pai atual para mostrar no trigger quando o Select não encontrar o item
  const paiAtual = paisValidos.find(p => p.id === formData.subordinacao_id);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4" style={{ zIndex: 9999 }}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col" style={{ zIndex: 10000 }}>
        {/* Header - Sempre visível */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-4 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <h2 className="text-xl font-bold text-white">
            {gestorEditar ? 'Editar Área/Gestor' : 'Nova Área/Gestor'}
          </h2>
          <button
            onClick={handleClose}
            className="w-8 h-8 flex items-center justify-center text-white hover:bg-white/20 rounded-full transition-colors"
            type="button"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body - Scrollável */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* Informações da Área */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 border-b-2 border-gray-200 pb-2">Informações da Área</h3>

            <div>
              <Label htmlFor="nome_area">Nome da Área *</Label>
              <Input
                id="nome_area"
                value={formData.nome_area}
                onChange={(e) => setFormData({ ...formData, nome_area: e.target.value })}
                placeholder="Ex: Coordenadoria de Desenvolvimento"
                className={errors.nome_area ? 'border-red-500' : ''}
              />
              {errors.nome_area && (
                <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  {errors.nome_area}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="nome_exibicao">Nome de Exibição (Card)</Label>
              <Input
                id="nome_exibicao"
                value={formData.nome_exibicao}
                onChange={(e) => setFormData({ ...formData, nome_exibicao: e.target.value })}
                placeholder="Ex: CODESG (será exibido no card do organograma)"
              />
              <p className="text-xs text-gray-500 mt-1">
                Se preenchido, este nome será exibido no card do organograma em vez do nome completo da área.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="linha_organograma">Linha do Organograma *</Label>
                <Select
                  value={formData.linha_organograma.toString()}
                  onValueChange={handleLinhaChange}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="z-[10001]">
                    <SelectItem value="1">Linha 1</SelectItem>
                    <SelectItem value="2">Linha 2</SelectItem>
                    <SelectItem value="3">Linha 3</SelectItem>
                    <SelectItem value="4">Linha 4</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="subordinacao_id">
                  Subordinação {formData.linha_organograma > 1 && <span className="text-red-600">*</span>}
                </Label>
                {/* Usar key para forçar re-render quando pais são carregados */}
                <Select
                  key={`subordinacao-${paisValidos.length}-${formData.subordinacao_id}`}
                  value={selectValue}
                  onValueChange={(value) => setFormData({ ...formData, subordinacao_id: parseInt(value) })}
                  disabled={formData.linha_organograma === 1 || loadingPais}
                >
                  <SelectTrigger 
                    className={errors.subordinacao_id ? 'border-red-500' : ''}
                    disabled={formData.linha_organograma === 1 || loadingPais}
                  >
                    {/* Mostrar valor manualmente quando selecionado */}
                    {formData.linha_organograma === 1 ? (
                      <span className="text-muted-foreground">(Sem subordinação)</span>
                    ) : loadingPais ? (
                      <span className="text-muted-foreground">Carregando...</span>
                    ) : paiAtual ? (
                      <span>{paiAtual.nome_gestor} ({paiAtual.nome_area})</span>
                    ) : (
                      <span className="text-muted-foreground">Selecione o gestor superior</span>
                    )}
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="z-[10001]">
                    {paisValidos.map(pai => (
                      <SelectItem 
                        key={pai.id} 
                        value={pai.id.toString()}
                        textValue={`${pai.nome_gestor} (${pai.nome_area})`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded font-medium">
                            {getNomeNivel(pai.linha_organograma)}
                          </span>
                          <span className="font-medium">{pai.nome_gestor}</span>
                          <span className="text-xs text-gray-500">
                            ({pai.nome_area})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                    {formData.linha_organograma > 1 && paisValidos.length === 0 && !loadingPais && (
                      <div className="px-2 py-3 text-sm text-gray-500 text-center">
                        Nenhum gestor de nível superior cadastrado
                      </div>
                    )}
                  </SelectContent>
                </Select>
                {errors.subordinacao_id && (
                  <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-4 h-4" />
                    {errors.subordinacao_id}
                  </p>
                )}
                {formData.linha_organograma > 1 && paisValidos.length === 0 && !loadingPais && (
                  <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    Cadastre primeiro um gestor de nível superior
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Informações do Gestor */}
          <div className="space-y-4">
            <h3 className="font-semibold text-gray-900 border-b-2 border-gray-200 pb-2">Informações do Gestor</h3>

            {/* Checkbox Sem Gestor */}
            <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
              <input
                type="checkbox"
                id="sem_gestor"
                checked={semGestor}
                onChange={(e) => {
                  setSemGestor(e.target.checked);
                  if (e.target.checked) {
                    // Limpar campos do gestor quando marcar "Sem gestor"
                    setFormData(prev => ({
                      ...prev,
                      nome_gestor: '',
                      nome_cargo: ''
                    }));
                    setFotoFile(null);
                    setFotoPreview(null);
                  }
                }}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              <Label htmlFor="sem_gestor" className="cursor-pointer text-gray-700 font-medium">
                Gerido pela unidade superior
              </Label>
            </div>

            {/* Campos do gestor - só mostrar se NÃO for "sem gestor" */}
            {!semGestor && (
              <>
                <div>
                  <Label htmlFor="nome_gestor">Nome do Gestor *</Label>
                  <Input
                    id="nome_gestor"
                    value={formData.nome_gestor}
                    onChange={(e) => setFormData({ ...formData, nome_gestor: e.target.value })}
                    placeholder="Ex: João Silva"
                    className={errors.nome_gestor ? 'border-red-500' : ''}
                  />
                  {errors.nome_gestor && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.nome_gestor}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="nome_cargo">Cargo do Gestor *</Label>
                  <Input
                    id="nome_cargo"
                    value={formData.nome_cargo}
                    onChange={(e) => setFormData({ ...formData, nome_cargo: e.target.value })}
                    placeholder="Ex: Coordenador, Diretor, Chefe de Divisão"
                    className={errors.nome_cargo ? 'border-red-500' : ''}
                  />
                  {errors.nome_cargo && (
                    <p className="text-sm text-red-600 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      {errors.nome_cargo}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="foto">Foto do Gestor</Label>
                  <div className="flex flex-col items-center gap-4 p-6 bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
                    {/* Preview da foto */}
                    <div className="relative">
                      {fotoPreview ? (
                        <>
                          <img 
                            src={fotoPreview} 
                            alt="Preview da foto"
                            className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-lg"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setFotoFile(null);
                              setFotoPreview(null);
                              setFotoRemovida(true); // Marcar que foto foi removida
                              const input = document.getElementById('foto-input') as HTMLInputElement;
                              if (input) input.value = '';
                            }}
                            className="absolute -top-1 -right-1 w-6 h-6 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center shadow-lg transition-colors text-sm font-bold"
                            title="Remover foto"
                          >
                            ×
                          </button>
                        </>
                      ) : (
                        <div className="w-28 h-28 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center border-4 border-white shadow-lg">
                          <span className="text-white text-3xl font-bold">
                            {formData.nome_gestor ? formData.nome_gestor.charAt(0).toUpperCase() : '?'}
                          </span>
                        </div>
                      )}
                    </div>
                    
                    {/* Botão de upload */}
                    <div>
                      <label
                        htmlFor="foto-input"
                        className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg cursor-pointer transition-colors font-medium text-sm shadow-sm"
                      >
                        <Upload className="w-4 h-4" />
                        {fotoPreview ? 'Alterar foto' : 'Escolher foto'}
                      </label>
                      <input
                        id="foto-input"
                        type="file"
                        accept="image/jpeg,image/jpg,image/png"
                        onChange={handleFileChange}
                        className="hidden"
                      />
                    </div>
                    
                    <p className="text-xs text-gray-500 text-center">
                      JPG, JPEG ou PNG • Máximo 2MB
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 pt-4 border-t">
            <Button
              type="button"
              onClick={handleClose}
              variant="outline"
              className="flex-1"
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              className="flex-1 bg-blue-600 hover:bg-blue-700"
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Salvando...' : (gestorEditar ? 'Atualizar' : 'Criar')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ModalGestor;
