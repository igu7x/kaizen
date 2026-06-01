import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { Objective, KeyResult, Initiative, Program, ProgramInitiative, ExecutionControl } from '@/types';
import { api } from '@/services/api';
import Storage from '@/utils/storage';
import { NetworkError, ApiError } from '@/services/apiClient';

interface GestaoContextType {
  objectives: Objective[];
  keyResults: KeyResult[];
  initiatives: Initiative[];
  programs: Program[];
  programInitiatives: ProgramInitiative[];
  executionControls: ExecutionControl[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  clearError: () => void;
  // Métodos de atualização otimista
  updateKeyResultOptimistic: (id: string, updates: Partial<KeyResult>) => Promise<void>;
  updateInitiativeOptimistic: (id: string, updates: Partial<Initiative>) => Promise<void>;
}

const GestaoContext = createContext<GestaoContextType | undefined>(undefined);

export function GestaoProvider({ children }: { children: ReactNode }) {
  // Carrega dados em cache do localStorage
  const [objectives, setObjectives] = useState<Objective[]>(() => Storage.load('gestao_objectives', []));
  const [keyResults, setKeyResults] = useState<KeyResult[]>(() => Storage.load('gestao_keyResults', []));
  const [initiatives, setInitiatives] = useState<Initiative[]>(() => Storage.load('gestao_initiatives', []));
  const [programs, setPrograms] = useState<Program[]>(() => Storage.load('gestao_programs', []));
  const [programInitiatives, setProgramInitiatives] = useState<ProgramInitiative[]>(() => Storage.load('gestao_programInitiatives', []));
  const [executionControls, setExecutionControls] = useState<ExecutionControl[]>(() => Storage.load('gestao_executionControls', []));
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const refreshData = useCallback(async () => {
    console.log('[GestaoContext] refreshData chamado');
    setLoading(true);
    setError(null);

    try {
      // Carregar cada tipo de dado separadamente para ser resiliente a erros
      const loadData = async <T,>(
        fetcher: () => Promise<T[]>,
        name: string,
        fallback: T[]
      ): Promise<T[]> => {
        try {
          const data = await fetcher();
          console.log(`[GestaoContext] ${name}: ${data.length} registros`);
          return data;
        } catch (err) {
          console.warn(`[GestaoContext] Erro ao carregar ${name}:`, err);
          return fallback;
        }
      };

      const [objData, krData, initData, progData, progInitData, execData] = await Promise.all([
        loadData(api.getObjectives, 'Objectives', []),
        loadData(api.getKeyResults, 'KeyResults', []),
        loadData(api.getInitiatives, 'Initiatives', []),
        loadData(api.getPrograms, 'Programs', []),
        loadData(api.getProgramInitiatives, 'ProgramInitiatives', []),
        loadData(api.getExecutionControls, 'ExecutionControls', [])
      ]);

      console.log('[GestaoContext] Dados carregados:', {
        objectives: objData.length,
        keyResults: krData.length,
        initiatives: initData.length,
        programs: progData.length,
        programInitiatives: progInitData.length,
        executionControls: execData.length
      });

      // Debug: mostrar objetivos e suas diretorias
      if (objData.length > 0) {
        console.log('[GestaoContext] Objetivos:', objData.map(o => ({ id: o.id, code: o.code, directorate: o.directorate })));
      }
      if (krData.length > 0) {
        console.log('[GestaoContext] KeyResults:', krData.map(kr => ({ id: kr.id, code: kr.code, directorate: kr.directorate, objectiveId: kr.objectiveId })));
      }

      // Atualiza estados e salva em cache
      setObjectives(objData);
      setKeyResults(krData);
      setInitiatives(initData);
      setPrograms(progData);
      setProgramInitiatives(progInitData);
      setExecutionControls(execData);

      Storage.save('gestao_objectives', objData);
      Storage.save('gestao_keyResults', krData);
      Storage.save('gestao_initiatives', initData);
      Storage.save('gestao_programs', progData);
      Storage.save('gestao_programInitiatives', progInitData);
      Storage.save('gestao_executionControls', execData);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
      
      // Definir mensagem de erro amigável
      if (err instanceof NetworkError) {
        setError('Erro de conexão. Usando dados em cache.');
      } else if (err instanceof ApiError) {
        setError(`Erro ao carregar dados: ${err.message}`);
      } else {
        setError('Erro ao carregar dados. Tente novamente.');
      }

      // Se tiver dados em cache, usar eles
      const cachedObjectives = Storage.load<Objective[]>('gestao_objectives', []);
      const cachedKeyResults = Storage.load<KeyResult[]>('gestao_keyResults', []);
      const cachedInitiatives = Storage.load<Initiative[]>('gestao_initiatives', []);
      const cachedPrograms = Storage.load<Program[]>('gestao_programs', []);
      const cachedProgramInitiatives = Storage.load<ProgramInitiative[]>('gestao_programInitiatives', []);
      const cachedExecutionControls = Storage.load<ExecutionControl[]>('gestao_executionControls', []);

      if (cachedObjectives.length > 0) {
        setObjectives(cachedObjectives);
        setKeyResults(cachedKeyResults);
        setInitiatives(cachedInitiatives);
        setPrograms(cachedPrograms);
        setProgramInitiatives(cachedProgramInitiatives);
        setExecutionControls(cachedExecutionControls);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Atualização otimista de Key Result
   * Atualiza o estado local imediatamente e sincroniza com o servidor
   */
  const updateKeyResultOptimistic = useCallback(async (id: string, updates: Partial<KeyResult>) => {
    // Guardar estado anterior para rollback
    const previousKeyResults = [...keyResults];
    
    // Atualizar estado local imediatamente (otimístico)
    setKeyResults(prev => prev.map(kr => 
      String(kr.id) === String(id) ? { ...kr, ...updates } : kr
    ));

    try {
      // Enviar ao servidor
      await api.updateKeyResult(id, updates);
      
      // Recarregar dados para garantir sincronização
      await refreshData();
    } catch (err) {
      // Rollback em caso de erro
      setKeyResults(previousKeyResults);
      
      console.error('Erro ao atualizar KR:', err);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao salvar alterações. Tente novamente.');
      }
      
      throw err;
    }
  }, [keyResults, refreshData]);

  /**
   * Atualização otimista de Initiative
   */
  const updateInitiativeOptimistic = useCallback(async (id: string, updates: Partial<Initiative>) => {
    const previousInitiatives = [...initiatives];
    
    setInitiatives(prev => prev.map(init => 
      String(init.id) === String(id) ? { ...init, ...updates } : init
    ));

    try {
      await api.updateInitiative(id, updates);
      await refreshData();
    } catch (err) {
      setInitiatives(previousInitiatives);
      
      console.error('Erro ao atualizar Iniciativa:', err);
      
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Erro ao salvar alterações. Tente novamente.');
      }
      
      throw err;
    }
  }, [initiatives, refreshData]);

  // Carregar dados iniciais
  useEffect(() => {
    refreshData();
  }, [refreshData]);

  return (
    <GestaoContext.Provider
      value={{
        objectives,
        keyResults,
        initiatives,
        programs,
        programInitiatives,
        executionControls,
        loading,
        error,
        refreshData,
        clearError,
        updateKeyResultOptimistic,
        updateInitiativeOptimistic
      }}
    >
      {children}
    </GestaoContext.Provider>
  );
}

export function useGestao() {
  const context = useContext(GestaoContext);
  if (context === undefined) {
    throw new Error('useGestao must be used within a GestaoProvider');
  }
  return context;
}
