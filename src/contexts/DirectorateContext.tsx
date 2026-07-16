import {
  createContext,
  useContext,
  ReactNode,
  useEffect,
  useState,
} from "react";
import { useLocalStorage } from "@/utils/storage";
import { useAuth } from "@/contexts/AuthContext";
import { isDomainRoot } from "@/utils/domain";
import { areasApi, Area } from "@/services/areasApi";

interface DirectorateContextType {
  selectedAreaId: number | null;
  setSelectedAreaId: (id: number) => void;
  selectedArea: Area | null;
  devEnvironment: string | null;
  setDevEnvironment: (env: string | null) => void;
}

const DirectorateContext = createContext<DirectorateContextType | undefined>(
  undefined,
);

export function DirectorateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);

  // Dev environment override — permite ao dev acessar qualquer ambiente (pela sigla, p/ facilitar digitação)
  const [devEnvironment, setDevEnvironmentRaw] = useLocalStorage<string | null>(
    "devEnvironment",
    null,
  );

  const setDevEnvironment = (env: string | null) => {
    setDevEnvironmentRaw(env);
    if (env && areas.length > 0) {
      const area = areas.find((a) => a.sigla === env);
      if (area) {
        setSelectedAreaId(area.id);
      }
    }
  };

  // Carregar áreas para determinar domínios e root corretamente
  useEffect(() => {
    if (user) {
      areasApi.getAll().then(setAreas).catch(console.error);
    }
  }, [user]);

  // Determina a ID inicial baseada no usuário
  const getUserDefaultAreaId = (): number | null => {
    const userAreaId = user?.cadastrosAreasId || null;
    if (userAreaId) {
      return userAreaId;
    }
    // Fallback: se o usuário é ADMIN e não tem area vinculada, tenta achar o ID da SGJT
    if (user?.role === "ADMIN" && areas.length > 0) {
      const sgjt = areas.find((a) => a.sigla === "SGJT");
      return sgjt ? sgjt.id : null;
    }
    return null;
  };

  // Usa useLocalStorage para persistir a área selecionada
  const [selectedAreaId, setSelectedAreaId] = useLocalStorage<number | null>(
    "selectedAreaId",
    getUserDefaultAreaId(),
  );

  // Verificar se é o dev
  const isDev = !!user?.is_developer;

  // Força a área correta quando o usuário muda ou faz login
  useEffect(() => {
    if (areas.length === 0) return;

    // Se o dev está em um ambiente override, forçar o ID desse ambiente
    if (isDev && devEnvironment) {
      const devArea = areas.find((a) => a.sigla === devEnvironment);
      if (devArea && selectedAreaId !== devArea.id) {
        setSelectedAreaId(devArea.id);
      }
      return;
    }

    // O fallback prioriza a primeira área cadastrada se disponível (V4)
    const userAreaId = user?.cadastrosAreasId;
    const isRoot = isDomainRoot(user, areas);

    // Se o usuário não é root, fixar a área dele
    if (userAreaId && !isRoot && selectedAreaId !== userAreaId) {
      setSelectedAreaId(userAreaId);
    }

    // Domain root: garantir que selectedAreaId está dentro do seu domínio
    if (isRoot && userAreaId) {
      const userArea = areas.find((a) => a.id === userAreaId);
      const currentSelectedArea = areas.find((a) => a.id === selectedAreaId);
      
      if (userArea && currentSelectedArea) {
        // Se a área atualmente selecionada não pertencer ao mesmo domínio da área do usuário root, resetar.
        if (currentSelectedArea.dominio !== userArea.dominio) {
          setSelectedAreaId(userAreaId);
        }
      } else if (!currentSelectedArea) {
        setSelectedAreaId(userAreaId);
      }
    }
    
    // Se o initial load do localStorage veio nulo e agora temos as areas, 
    // ou se o selectedAreaId não existe nas areas carregadas
    if (selectedAreaId === null || (selectedAreaId !== null && !areas.some(a => a.id === selectedAreaId))) {
      const def = getUserDefaultAreaId();
      if (def) setSelectedAreaId(def);
    }
  }, [
    user,
    areas,
    selectedAreaId,
    setSelectedAreaId,
    isDev,
    devEnvironment,
  ]);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) || null;

  return (
    <DirectorateContext.Provider
      value={{
        selectedAreaId,
        setSelectedAreaId,
        selectedArea,
        devEnvironment,
        setDevEnvironment,
      }}
    >
      {children}
    </DirectorateContext.Provider>
  );
}

export function useDirectorate() {
  const context = useContext(DirectorateContext);
  if (!context) {
    throw new Error("useDirectorate must be used within DirectorateProvider");
  }
  return context;
}
