import { useEffect, useState } from "react";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { useAuth } from "@/contexts/AuthContext";
import { areasApi, Area } from "@/services/areasApi";
import { isDomainRoot, isSuperAdmin } from "@/utils/domain";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Building2, Loader2 } from "lucide-react";

export function DirectorateSelector() {
  const { selectedAreaId, setSelectedAreaId, devEnvironment } = useDirectorate();
  const { user } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);

  const superAdmin = isSuperAdmin(user);

  // Carregar áreas — do domínio do devEnvironment ou do domínio do usuário
  useEffect(() => {
    const loadAreas = async () => {
      try {
        setLoading(true);
        if (devEnvironment) {
          // Dev mode: carregar áreas do domínio do ambiente ativo
          const data = await areasApi.getByDominio(devEnvironment);
          setAreas(data);
        } else {
          const data = await areasApi.getAll();
          
          if (superAdmin) {
            setAreas(data);
          } else {
            // Filtrar apenas áreas do mesmo domínio (is_domain_root = true da árvore do usuário)
            // Para simplificar, backend já filtra ou aqui usamos domainApi se houver
            // Neste app, o backend pode retornar tudo, então filtramos no frontend pelo domínio do user
            const userAreaId = user?.cadastrosAreasId;
            const userArea = data.find(a => a.id === userAreaId);
            if (userArea) {
              setAreas(data.filter(a => a.dominio === userArea.dominio));
            } else {
              setAreas(data);
            }
          }
        }
      } catch (error) {
        console.error("Erro ao carregar áreas:", error);
      } finally {
        setLoading(false);
      }
    };
    loadAreas();
  }, [superAdmin, devEnvironment, user]);

  const userAreaId = user?.cadastrosAreasId;

  // Domain root (SGJT, CGJ) pode ver o seletor de diretoria
  // Em dev mode, sempre mostra o seletor
  const isRoot = isDomainRoot(user, areas) || !!devEnvironment;

  // Forçar seleção da própria diretoria se não for domain root
  useEffect(() => {
    if (!isRoot && userAreaId && selectedAreaId !== userAreaId) {
      setSelectedAreaId(userAreaId);
    }
  }, [isRoot, userAreaId, selectedAreaId, setSelectedAreaId]);

  // Apenas domain root vê o seletor
  if (!isRoot) {
    return null;
  }

  const domainAreas = areas;

  // Extrair sigla da área: usa area.sigla, ou extrai do formato "SIGLA: Nome Completo"
  const getSigla = (area: Area): string => {
    if (area.sigla) return area.sigla;
    if (area.nome.includes(":")) return area.nome.split(":")[0].trim();
    return area.nome;
  };

  return (
    <div className="bg-gray-200 rounded-lg shadow-lg p-3 w-fit">
      <div className="flex items-center gap-2 text-gray-700 mb-2">
        <Building2 className="h-3 w-3" />
        <span className="text-xs font-semibold">Diretoria</span>
      </div>
      {loading ? (
        <div className="flex items-center justify-center h-8 w-[140px]">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        </div>
      ) : (
        <Select
          value={selectedAreaId ? String(selectedAreaId) : undefined}
          onValueChange={(value) =>
            setSelectedAreaId(Number(value))
          }
        >
          <SelectTrigger className="h-8 text-xs bg-white border border-gray-300 text-gray-700 w-[140px]">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {domainAreas.map((area) => {
              const sigla = getSigla(area);
              return (
                <SelectItem key={area.id} value={String(area.id)}>
                  {sigla}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}
