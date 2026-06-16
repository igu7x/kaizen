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

// Diretoria agora é uma string dinâmica (carregada de cadastros_areas)
type Directorate = string;

interface DirectorateContextType {
  selectedDirectorate: Directorate;
  setSelectedDirectorate: (directorate: Directorate) => void;
  devEnvironment: string | null;
  setDevEnvironment: (env: string | null) => void;
}

const DirectorateContext = createContext<DirectorateContextType | undefined>(
  undefined,
);

export function DirectorateProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);

  // Dev environment override — permite ao dev acessar qualquer ambiente
  const [devEnvironment, setDevEnvironmentRaw] = useLocalStorage<string | null>(
    "devEnvironment",
    null,
  );

  const setDevEnvironment = (env: string | null) => {
    setDevEnvironmentRaw(env);
    if (env) {
      // Ao entrar em um ambiente, setar a diretoria selecionada para a raiz dele
      setSelectedDirectorate(env);
    }
  };

  // Carregar áreas para determinar isDomainRoot corretamente
  useEffect(() => {
    if (user) {
      areasApi.getAll().then(setAreas).catch(console.error);
    }
  }, [user]);

  // Determina a diretoria inicial baseada no usuário
  // diretoria_visibilidade sobrescreve diretoria para fins de visualização
  const getUserDefaultDirectorate = (): Directorate => {
    const userDiretoria = ((user as any)?.diretoria_visibilidade ||
      (user as any)?.diretoria) as Directorate | undefined;
    if (userDiretoria) {
      return userDiretoria;
    }
    // Se não tem diretoria definida, usar SGJT para admins
    if (user?.role === "ADMIN") {
      return "SGJT";
    }
    // Fallback para SGJT
    return "SGJT";
  };

  // Usa useLocalStorage para persistir a diretoria selecionada
  const [selectedDirectorate, setSelectedDirectorate] =
    useLocalStorage<Directorate>(
      "selectedDirectorate",
      getUserDefaultDirectorate(),
    );

  // Verificar se é o dev
  const isDev = !!user?.is_developer;

  // Força a diretoria correta quando o usuário muda ou faz login
  useEffect(() => {
    // Se o dev está em um ambiente override, não forçar nada
    if (isDev && devEnvironment) return;

    const userDiretoria = ((user as any)?.diretoria_visibilidade ||
      (user as any)?.diretoria) as Directorate | undefined;
    // Usa areas para detecção correta de domain root (SGJT e CGJ)
    const isRoot = isDomainRoot(user, areas);

    // Só forçar depois que as áreas carregaram (para não forçar incorretamente antes de saber se é root)
    if (
      areas.length > 0 &&
      userDiretoria &&
      !isRoot &&
      selectedDirectorate !== userDiretoria
    ) {
      setSelectedDirectorate(userDiretoria);
    }

    // Domain root: garantir que selectedDirectorate está dentro do seu domínio
    // (previne valor stale do localStorage de outro domínio, ex: SGJT salvo quando user é CGJ)
    if (areas.length > 0 && isRoot && userDiretoria) {
      const domainSiglas = areas.map((a) => a.sigla || a.nome);
      if (!domainSiglas.includes(selectedDirectorate)) {
        setSelectedDirectorate(userDiretoria);
      }
    }

    // Limpar valor inválido do localStorage (ex: "SGJT: Secretaria de..." salvo por bug anterior)
    if (selectedDirectorate && selectedDirectorate.includes(":")) {
      const sigla = selectedDirectorate.split(":")[0].trim();

      setSelectedDirectorate(sigla);
    }
  }, [
    user,
    areas,
    selectedDirectorate,
    setSelectedDirectorate,
    isDev,
    devEnvironment,
  ]);

  return (
    <DirectorateContext.Provider
      value={{
        selectedDirectorate,
        setSelectedDirectorate,
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
