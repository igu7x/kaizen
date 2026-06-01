import { useEffect, useState } from 'react';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { useAuth } from '@/contexts/AuthContext';
import { Directorate } from '@/types';
import { areasApi, Area } from '@/services/areasApi';
import { isDomainRoot, isSuperAdmin } from '@/utils/domain';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2, Loader2 } from 'lucide-react';

export function DirectorateSelector() {
  const { selectedDirectorate, setSelectedDirectorate, devEnvironment } = useDirectorate();
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
          setAreas(data);
        }
      } catch (err) {
        console.error('Erro ao carregar áreas:', err);
      } finally {
        setLoading(false);
      }
    };
    loadAreas();
  }, [superAdmin, devEnvironment]);

  // Pegar diretoria do usuário de múltiplas fontes possíveis
  // diretoria_visibilidade sobrescreve para fins de visibilidade
  const userDiretoria = (
    (user as any)?.diretoria_visibilidade ||
    (user as any)?.diretoria ||
    (user as any)?.directorate_code
  ) as Directorate | undefined;

  // Domain root (SGJT, CGJ) pode ver o seletor de diretoria
  // Em dev mode, sempre mostra o seletor
  const isRoot = isDomainRoot(user, areas) || !!devEnvironment;

  // Forçar seleção da própria diretoria se não for domain root
  useEffect(() => {
    if (!isRoot && userDiretoria && selectedDirectorate !== userDiretoria) {
      setSelectedDirectorate(userDiretoria);
    }
  }, [isRoot, userDiretoria, selectedDirectorate, setSelectedDirectorate]);

  // Apenas domain root vê o seletor
  if (!isRoot) {
    return null;
  }

  const domainAreas = areas;

  // Extrair sigla da área: usa area.sigla, ou extrai do formato "SIGLA: Nome Completo"
  const getSigla = (area: Area): string => {
    if (area.sigla) return area.sigla;
    if (area.nome.includes(':')) return area.nome.split(':')[0].trim();
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
          value={selectedDirectorate}
          onValueChange={(value) => setSelectedDirectorate(value as Directorate)}
        >
          <SelectTrigger className="h-8 text-xs bg-white border border-gray-300 text-gray-700 w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {domainAreas.map((area) => {
              const sigla = getSigla(area);
              return (
                <SelectItem key={area.id} value={sigla}>
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
