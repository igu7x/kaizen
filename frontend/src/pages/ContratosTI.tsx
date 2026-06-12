import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Contract } from '@/types';
import { contractsApi, ContractFilters as ApiContractFilters } from '@/services/contractsApi';
import { ContractList } from '@/components/contratacoes/ContractList';
import { ContractFilters } from '@/components/contratacoes/ContractFilters';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2, Search } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export function ContratosTI() {
  const { user } = useAuth();
  
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filtros
  const [filters, setFilters] = useState<ApiContractFilters>({});

  const fetchContracts = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await contractsApi.getContracts(filters);
      setContracts(data);
    } catch (err) {
      console.error('Error fetching contracts:', err);
      setError('Não foi possível carregar os contratos. Tente novamente mais tarde.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchContracts();
  }, [filters]);

  return (
    <Layout>
      <div className="flex flex-col w-full h-full">
        {/* Breadcrumb simples */}
        <div className="text-sm text-slate-500 mb-2">
          Início {'>'} Contratações de TI {'>'} Contratos de TIC
        </div>

        {/* Título e Subtítulo */}
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Contratos de TIC</h1>
          <p className="text-sm text-slate-500 mb-6">
            Gestão e acompanhamento dos contratos de tecnologia
          </p>
        </div>

        <div className="space-y-6">

        <Card>
          <CardContent className="pt-6">
            <ContractFilters onFilterChange={setFilters} />

            <div className="mt-6">
              {error ? (
                <div className="flex items-center gap-2 text-red-800 p-4 bg-red-50 border border-red-200 rounded-md">
                  <AlertCircle className="h-5 w-5" />
                  <p>{error}</p>
                </div>
              ) : loading ? (
                <div className="flex justify-center items-center min-h-[400px]">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <ContractList contracts={contracts} />
              )}
            </div>
          </CardContent>
        </Card>
        </div>
      </div>
    </Layout>
  );
}

export default ContratosTI;
