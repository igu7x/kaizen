import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Building2, Loader2, Plus, GripVertical } from 'lucide-react';
import { DragDropContext, Droppable, Draggable, DropResult } from 'react-beautiful-dnd';
import { colaboradoresApi } from '@/services/colaboradoresApi';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import CardGestor from './CardGestor';
import ModalGestor from './ModalGestor';
import './organograma.css';

interface OrganogramaProps {
  diretoria?: string;
  totalColaboradores: number;
  // Props para modo "áreas" (dados de cadastros_pessoas)
  useAreasMode?: boolean;
  areaId?: number;
  areaNome?: string;
  pessoasData?: GestorOrganograma[];
  onPessoaEdit?: (pessoa: any) => void;
  onPessoaCreate?: () => void;
}

export interface GestorOrganograma {
  id: number;
  nome_area: string;
  nome_exibicao?: string | null;
  nome_gestor: string;
  nome_cargo: string;
  foto_gestor: string | null;
  linha_organograma: number;
  subordinacao_id: number | null;
  cor_barra: string | null;
  diretoria: string;
  ordem_exibicao: number | null;
  caminho: number[];
  caminho_texto: string;
  profundidade: number;
}

const Organograma: React.FC<OrganogramaProps> = ({ 
  diretoria, 
  totalColaboradores,
  useAreasMode = false,
  areaId,
  areaNome,
  pessoasData,
  onPessoaEdit,
  onPessoaCreate
}) => {
  const { user } = useAuth();
  const [dados, setDados] = useState<GestorOrganograma[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [gestorEditar, setGestorEditar] = useState<any>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [zoom, setZoom] = useState(1);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const isAdmin = user?.role === 'ADMIN';
  const isManager = user?.role === 'MANAGER';
  const canEdit = isAdmin || isManager;

  useEffect(() => {
    if (useAreasMode && pessoasData) {
      // Modo áreas: usar dados externos
      setDados(pessoasData);
      setLoading(false);
    } else if (diretoria) {
      // Modo original: buscar do banco
      fetchOrganograma();
    }
  }, [diretoria, useAreasMode, pessoasData]);

  // Calcular escala por linha para preencher espaço (linhas com menos cards = cards maiores)
  const [escalasPorLinha, setEscalasPorLinha] = useState<Record<number, number>>({});
  
  useEffect(() => {
    const calcularEscalas = () => {
      if (!containerRef.current || isDragging || dados.length === 0) return;
      
      const container = containerRef.current;
      const containerWidth = container.clientWidth - 60; // padding
      
      // Organizar dados por linhas localmente
      const linhasOrganizadas: Record<number, typeof dados> = {};
      dados.forEach(gestor => {
        const linha = Math.min(4, Math.max(1, gestor.linha_organograma || 1));
        if (!linhasOrganizadas[linha]) {
          linhasOrganizadas[linha] = [];
        }
        linhasOrganizadas[linha].push(gestor);
      });
      
      // Largura base do card + gap
      const larguraCardBase = 280;
      const gap = 20;
      
      // Calcular escala para cada linha
      const novasEscalas: Record<number, number> = {};
      
      Object.keys(linhasOrganizadas).forEach(linhaStr => {
        const linha = parseInt(linhaStr);
        const qtdCards = linhasOrganizadas[linha]?.length || 0;
        
        if (qtdCards === 0) return;
        
        // Largura total necessária para essa linha (sem escala)
        const larguraNecessaria = (qtdCards * larguraCardBase) + ((qtdCards - 1) * gap);
        
        // Calcular escala para caber na largura do container
        let escala = 1;
        if (larguraNecessaria > containerWidth) {
          escala = containerWidth / larguraNecessaria;
        }
        
        // Limitar escala mínima para não ficar muito pequeno
        escala = Math.max(0.5, Math.min(1, escala));
        
        novasEscalas[linha] = escala;
      });
      
      setEscalasPorLinha(novasEscalas);
      setZoom(1);
      
      // Nunca scroll horizontal
      container.style.overflowX = 'hidden';
      container.style.overflowY = 'auto';
      
      console.log('Escalas por linha:', novasEscalas);
    };

    // Esperar renderização completa dos cards
    const timer1 = setTimeout(calcularEscalas, 100);
    const timer2 = setTimeout(calcularEscalas, 300);
    const timer3 = setTimeout(calcularEscalas, 600);

    window.addEventListener('resize', calcularEscalas);

    return () => {
      window.removeEventListener('resize', calcularEscalas);
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [dados, isDragging]);

  const fetchOrganograma = async () => {
    try {
      setLoading(true);
      const response = await colaboradoresApi.getOrganograma(diretoria !== 'Todas' ? diretoria : undefined);
      
      // Debug: mostrar dados recebidos da API
      console.log('[Organograma] Dados recebidos da API:', response.map((g: any) => ({
        id: g.id,
        nome_area: g.nome_area,
        nome_exibicao: g.nome_exibicao,
        nome_gestor: g.nome_gestor,
        foto_gestor: g.foto_gestor
      })));
      
      setDados(response);
    } catch (error) {
      console.error('Erro ao carregar organograma:', error);
      toast.error('Erro ao carregar organograma');
    } finally {
      setLoading(false);
    }
  };

  // Organizar dados por linhas (apenas 1-4)
  const organizarPorLinhas = useCallback(() => {
    const linhas: Record<number, GestorOrganograma[]> = {};
    
    dados.forEach(gestor => {
      // Garantir que linha seja entre 1 e 4
      const linha = Math.min(4, Math.max(1, gestor.linha_organograma || 1));
      
      if (!linhas[linha]) {
        linhas[linha] = [];
      }
      linhas[linha].push(gestor);
    });
    
    // Ordenar cada linha por ordem_exibicao
    Object.keys(linhas).forEach(linha => {
      linhas[parseInt(linha)].sort((a, b) => 
        (a.ordem_exibicao || 0) - (b.ordem_exibicao || 0)
      );
    });
    
    // Debug: mostrar organização
    console.log('Organização por linhas:', Object.keys(linhas).map(l => ({
      linha: l,
      gestores: linhas[parseInt(l)].map(g => `${g.nome_gestor} (linha_db: ${g.linha_organograma})`)
    })));
    
    return linhas;
  }, [dados]);

  const linhas = organizarPorLinhas();
  const niveis = Object.keys(linhas).sort((a, b) => parseInt(a) - parseInt(b));

  // Handler para Drag and Drop
  const handleDragEnd = async (result: DropResult) => {
    setIsDragging(false);
    
    const { destination, source, draggableId } = result;

    // Se não há destino ou é o mesmo lugar, ignorar
    if (!destination) return;
    if (destination.droppableId === source.droppableId && destination.index === source.index) {
      return;
    }

    // Verificar se está no mesmo nível (droppableId é o número da linha)
    if (destination.droppableId !== source.droppableId) {
      toast.error('Não é permitido mover entre níveis diferentes');
      return;
    }

    const linha = parseInt(source.droppableId.replace('linha-', ''));
    const gestoresDaLinha = [...linhas[linha]];
    
    // Reordenar localmente
    const [removed] = gestoresDaLinha.splice(source.index, 1);
    gestoresDaLinha.splice(destination.index, 0, removed);

    // Atualizar estado local imediatamente para feedback visual
    const novosDados = [...dados];
    gestoresDaLinha.forEach((gestor, index) => {
      const idx = novosDados.findIndex(g => g.id === gestor.id);
      if (idx >= 0) {
        novosDados[idx] = { ...novosDados[idx], ordem_exibicao: index + 1 };
      }
    });
    setDados(novosDados);

    // Persistir no backend (apenas modo original, não modo áreas)
    if (!useAreasMode) {
      try {
        const nova_ordem = gestoresDaLinha.map((gestor, index) => ({
          id: gestor.id,
          ordem: index + 1
        }));

        await colaboradoresApi.reordenarGestores(linha, nova_ordem);
        toast.success('Ordem atualizada com sucesso!');
      } catch (error) {
        console.error('Erro ao reordenar:', error);
        toast.error('Erro ao salvar nova ordem');
        // Reverter para dados originais
        fetchOrganograma();
      }
    } else {
      toast.success('Ordem atualizada!');
    }
  };

  const handleDragStart = () => {
    setIsDragging(true);
    setMostrarLinhas(false);
  };

  // Controle de visibilidade das linhas
  const [mostrarLinhas, setMostrarLinhas] = useState(true);
  const [linhasKey, setLinhasKey] = useState(0);
  
  useEffect(() => {
    if (!isDragging) {
      // Aguardar um tempo para os elementos se estabilizarem
      const timer = setTimeout(() => {
        setLinhasKey(prev => prev + 1);
        setMostrarLinhas(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isDragging]);

  // Recalcular linhas quando dados mudam
  useEffect(() => {
    setMostrarLinhas(false);
    const timer = setTimeout(() => {
      setLinhasKey(prev => prev + 1);
      setMostrarLinhas(true);
    }, 300);
    return () => clearTimeout(timer);
  }, [dados]);

  // Estado para armazenar as linhas calculadas
  const [linhasCalculadas, setLinhasCalculadas] = useState<JSX.Element[]>([]);

  // Calcular linhas de conexão
  const calcularLinhas = useCallback(() => {
    if (dados.length === 0 || !contentRef.current) {
      setLinhasCalculadas([]);
      return;
    }

    const linhasSVG: JSX.Element[] = [];
    const content = contentRef.current;
    const contentRect = content.getBoundingClientRect();

    // Cor das linhas
    const corLinha = '#94A3B8';

    // Desenhar curva individual para cada gestor que tem subordinacao_id
    dados.forEach(gestor => {
      if (!gestor.subordinacao_id) return;

      const elementoFilho = document.getElementById(`card-gestor-${gestor.id}`);
      const elementoPai = document.getElementById(`card-gestor-${gestor.subordinacao_id}`);
      
      if (!elementoFilho || !elementoPai) return;

      const filhoRect = elementoFilho.getBoundingClientRect();
      const paiRect = elementoPai.getBoundingClientRect();

      // Calcular posições relativas ao content (posições visuais reais)
      const paiX = paiRect.left + paiRect.width / 2 - contentRect.left;
      const paiY = paiRect.bottom - contentRect.top;
      const filhoX = filhoRect.left + filhoRect.width / 2 - contentRect.left;
      const filhoY = filhoRect.top - contentRect.top;

      // Desenhar curva Bezier suave do pai ao filho
      const distanciaVertical = filhoY - paiY;
      const controleY1 = paiY + distanciaVertical * 0.4;
      const controleY2 = filhoY - distanciaVertical * 0.4;

      // Curva Bezier cúbica
      const path = `M ${paiX},${paiY} C ${paiX},${controleY1} ${filhoX},${controleY2} ${filhoX},${filhoY}`;

      linhasSVG.push(
        <path
          key={`conexao-${gestor.subordinacao_id}-${gestor.id}`}
          d={path}
          stroke={corLinha}
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
        />
      );

      // Pequeno círculo no ponto de chegada
      linhasSVG.push(
        <circle
          key={`ponto-${gestor.id}`}
          cx={filhoX}
          cy={filhoY}
          r="3"
          fill={corLinha}
        />
      );
    });

    setLinhasCalculadas(linhasSVG);
  }, [dados]);

  // Recalcular linhas quando necessário
  useEffect(() => {
    if (mostrarLinhas && !isDragging) {
      // Múltiplos recálculos para garantir posicionamento correto após escala
      const timer1 = setTimeout(calcularLinhas, 150);
      const timer2 = setTimeout(calcularLinhas, 400);
      const timer3 = setTimeout(calcularLinhas, 700);
      return () => {
        clearTimeout(timer1);
        clearTimeout(timer2);
        clearTimeout(timer3);
      };
    }
  }, [mostrarLinhas, isDragging, calcularLinhas, linhasKey, escalasPorLinha, dados]);

  // Handlers - movidos para cima para serem usados em todos os returns
  const handleNovaArea = () => {
    if (useAreasMode && onPessoaCreate) {
      onPessoaCreate();
    } else {
      setGestorEditar(null);
      setIsModalOpen(true);
    }
  };

  const handleEditarGestor = (gestor: any) => {
    if (useAreasMode && onPessoaEdit) {
      onPessoaEdit(gestor);
    } else {
      setGestorEditar(gestor);
      setIsModalOpen(true);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-[650px]">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <h3 className="text-base font-bold text-white">Organograma</h3>
          <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
            {totalColaboradores} colab.
          </span>
        </div>
        <div className="flex-1 flex items-center justify-center p-12 bg-gray-50">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="w-12 h-12 text-blue-600 animate-spin" />
            <p className="text-gray-600">Carregando organograma...</p>
          </div>
        </div>
      </div>
    );
  }

  if (dados.length === 0) {
    return (
      <>
        <div className="flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-[650px]">
          <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 flex items-center justify-between rounded-t-lg flex-shrink-0">
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-white">Organograma</h3>
            </div>
            <div className="flex items-center gap-2">
              <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
                {totalColaboradores} colab.
              </span>
              {canEdit && (
                <Button
                  onClick={handleNovaArea}
                  className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-md h-7 px-2.5 text-xs"
                  size="sm"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" />
                  Criar
                </Button>
              )}
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center p-12 bg-gray-50">
            <div className="text-center">
              <div className="text-gray-300 mb-6">
                <Building2 className="w-24 h-24 mx-auto animate-float opacity-40" />
              </div>
              <p className="text-2xl font-bold text-gray-600 mb-2">Nenhum organograma cadastrado</p>
              <p className="text-gray-500">
                {diretoria !== 'Todas'
                  ? `Nenhuma estrutura encontrada para ${diretoria}`
                  : 'Adicione gestores para visualizar a estrutura'
                }
              </p>
            </div>
          </div>
        </div>

        {/* Modal de Criar - estado vazio */}
        <ModalGestor
          isOpen={isModalOpen}
          onClose={() => {
            setIsModalOpen(false);
            setGestorEditar(null);
          }}
          onSuccess={fetchOrganograma}
          gestorEditar={gestorEditar}
          diretoria={diretoria}
        />
      </>
    );
  }

  const handleExcluirGestor = async (id: number) => {
    // No modo áreas, a exclusão é feita pela tabela no PainelColaboradores
    if (useAreasMode) {
      toast.info('Use a tabela abaixo para excluir pessoas');
      return;
    }

    if (!window.confirm('Tem certeza que deseja excluir esta área? Esta ação não pode ser desfeita.')) {
      return;
    }

    try {
      console.log('Tentando excluir gestor:', id);
      await colaboradoresApi.deleteGestor(id);
      toast.success('Área excluída com sucesso!');
      fetchOrganograma();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      // Capturar mensagem do erro (ApiError tem .message)
      const mensagem = error?.message || 'Erro ao excluir área';
      toast.error(mensagem);
    }
  };

  return (
    <>
      <div className="flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden h-[650px]">
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-white">Organograma</h3>
            {canEdit && (
              <span className="text-white/70 text-[10px] bg-white/10 px-1.5 py-0.5 rounded">
                <GripVertical className="w-2.5 h-2.5 inline mr-0.5" />
                Arraste
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <span className="bg-white/20 text-white text-xs font-semibold px-2.5 py-1 rounded-full">
              {totalColaboradores} colab.
            </span>
            {canEdit && (
              <Button
                onClick={handleNovaArea}
                className="bg-white text-blue-600 hover:bg-blue-50 font-semibold shadow-md h-7 px-2.5 text-xs"
                size="sm"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Criar
              </Button>
            )}
          </div>
        </div>

        <div 
          className="flex-1 bg-gray-50 relative flex items-start justify-center" 
          ref={containerRef}
          style={{ overflowX: 'hidden', overflowY: 'auto', padding: '20px 30px' }}
        >
          <DragDropContext onDragEnd={handleDragEnd} onDragStart={handleDragStart}>
            {/* Conteúdo do organograma com escala por linha */}
            <div 
              ref={contentRef}
              className="relative flex flex-col gap-4 w-full"
              style={{ 
                zIndex: 2,
                padding: '20px 10px'
              }}
            >
              {niveis.map(nivel => {
                const nivelNum = parseInt(nivel);
                const gestoresDaLinha = linhas[nivelNum] || [];
                const escalaLinha = escalasPorLinha[nivelNum] || 1;
                
                return (
                  <div 
                    key={nivel} 
                    className="flex items-center justify-center w-full"
                    style={{
                      transform: `scale(${escalaLinha})`,
                      transformOrigin: 'top center',
                      marginBottom: escalaLinha < 1 ? `${(1 - escalaLinha) * -50}px` : '0',
                    }}
                  >
                    {/* Cards dos gestores com Drag and Drop */}
                    <Droppable 
                      droppableId={`linha-${nivel}`} 
                      direction="horizontal"
                      isDropDisabled={!canEdit}
                      isCombineEnabled={false}
                      ignoreContainerClipping={false}
                    >
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`flex gap-5 justify-center items-start min-h-[100px] p-3 rounded-lg transition-colors ${
                            snapshot.isDraggingOver ? 'bg-blue-50 border-2 border-dashed border-blue-300' : ''
                          }`}
                          style={{ overflow: 'visible' }}
                        >
                          {gestoresDaLinha.map((gestor, index) => (
                            <Draggable
                              key={gestor.id}
                              draggableId={`gestor-${gestor.id}`}
                              index={index}
                              isDragDisabled={!canEdit}
                            >
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`transition-all ${
                                    snapshot.isDragging 
                                      ? 'opacity-80 scale-105 shadow-2xl z-50' 
                                      : 'opacity-100'
                                  }`}
                                  style={{
                                    ...provided.draggableProps.style,
                                  }}
                                >
                                  <CardGestor 
                                    gestor={gestor}
                                    onRefresh={fetchOrganograma}
                                    onEdit={canEdit ? () => handleEditarGestor(gestor) : undefined}
                                    onDelete={canEdit ? () => handleExcluirGestor(gestor.id) : undefined}
                                    isDragging={snapshot.isDragging}
                                    canDrag={canEdit}
                                  />
                                </div>
                              )}
                            </Draggable>
                          ))}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                );
              })}

              {/* SVG para linhas de conexão */}
              {mostrarLinhas && !isDragging && linhasCalculadas.length > 0 && (
                <svg
                  className="absolute top-0 left-0 pointer-events-none"
                  width="100%"
                  height="100%"
                  style={{ zIndex: 1, overflow: 'visible' }}
                >
                  {linhasCalculadas}
                </svg>
              )}
            </div>
          </DragDropContext>
        </div>
      </div>

      {/* Modal de Criar/Editar */}
      <ModalGestor
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setGestorEditar(null);
        }}
        onSuccess={fetchOrganograma}
        gestorEditar={gestorEditar}
        diretoria={diretoria}
      />
    </>
  );
};

export default Organograma;
