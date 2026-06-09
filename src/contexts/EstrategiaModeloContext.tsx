import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { useDirectorate } from './DirectorateContext';

type ModeloEstrategia = 'okrs' | 'metas';

interface EstrategiaModeloContextType {
  modelo: ModeloEstrategia;
  setModelo: (m: ModeloEstrategia) => void;
}

const EstrategiaModeloContext = createContext<EstrategiaModeloContextType | undefined>(undefined);

const STORAGE_PREFIX = 'estrategia-modelo-';

function getModeloForDiretoria(diretoria: string): ModeloEstrategia {
  const saved = localStorage.getItem(STORAGE_PREFIX + diretoria);
  return saved === 'metas' ? 'metas' : 'okrs';
}

export function EstrategiaModeloProvider({ children }: { children: ReactNode }) {
  const { selectedDirectorate } = useDirectorate();

  const [modelo, setModeloState] = useState<ModeloEstrategia>(() =>
    getModeloForDiretoria(selectedDirectorate)
  );

  // When directorate changes, load that directorate's saved model
  useEffect(() => {
    setModeloState(getModeloForDiretoria(selectedDirectorate));
  }, [selectedDirectorate]);

  const setModelo = useCallback((m: ModeloEstrategia) => {
    setModeloState(m);
    localStorage.setItem(STORAGE_PREFIX + selectedDirectorate, m);
  }, [selectedDirectorate]);

  return (
    <EstrategiaModeloContext.Provider value={{ modelo, setModelo }}>
      {children}
    </EstrategiaModeloContext.Provider>
  );
}

export function useEstrategiaModelo() {
  const ctx = useContext(EstrategiaModeloContext);
  if (!ctx) {
    throw new Error('useEstrategiaModelo must be used within EstrategiaModeloProvider');
  }
  return ctx;
}
