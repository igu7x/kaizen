import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from "react";
import { useDirectorate } from "./DirectorateContext";

type ModeloEstrategia = "okrs" | "metas";

interface EstrategiaModeloContextType {
  modelo: ModeloEstrategia;
  setModelo: (m: ModeloEstrategia) => void;
}

const EstrategiaModeloContext = createContext<
  EstrategiaModeloContextType | undefined
>(undefined);

const STORAGE_PREFIX = "estrategia-modelo-";

function getModeloForArea(areaId: number | null): ModeloEstrategia {
  if (!areaId) return "okrs";
  const saved = localStorage.getItem(STORAGE_PREFIX + areaId);
  return saved === "metas" ? "metas" : "okrs";
}

export function EstrategiaModeloProvider({
  children,
}: {
  children: ReactNode;
}) {
  const { selectedAreaId, selectedArea } = useDirectorate();

  const [modelo, setModeloState] = useState<ModeloEstrategia>(() =>
    getModeloForArea(selectedAreaId),
  );

  // When area changes, load that area's saved model
  useEffect(() => {
    setModeloState(getModeloForArea(selectedAreaId));
  }, [selectedAreaId]);

  const setModelo = useCallback(
    (m: ModeloEstrategia) => {
      setModeloState(m);
      if (selectedAreaId) {
        localStorage.setItem(STORAGE_PREFIX + selectedAreaId, m);
      }
    },
    [selectedAreaId],
  );

  return (
    <EstrategiaModeloContext.Provider value={{ modelo, setModelo }}>
      {children}
    </EstrategiaModeloContext.Provider>
  );
}

export function useEstrategiaModelo() {
  const ctx = useContext(EstrategiaModeloContext);
  if (!ctx) {
    throw new Error(
      "useEstrategiaModelo must be used within EstrategiaModeloProvider",
    );
  }
  return ctx;
}
