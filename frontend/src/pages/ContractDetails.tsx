import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Contract } from '@/types';
import { contractsApi } from '@/services/contractsApi';
import { formatCurrency } from '@/services/pcaApi';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Calendar,
  Building2,
  FileText,
  Loader2,
  AlertCircle,
  Briefcase,
  Layers,
  DollarSign,
  Info
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';

export function ContractDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContract = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const data = await contractsApi.getContractById(Number(id));
        setContract(data);
      } catch (err) {
        console.error('Error fetching contract details:', err);
        setError('Não foi possível carregar os detalhes do contrato.');
      } finally {
        setLoading(false);
      }
    };
    loadContract();
  }, [id]);

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex flex-col w-full h-full">
          <div className="flex h-[400px] items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        </div>
      </Layout>
    );
  }

  if (error || !contract) {
    return (
      <Layout>
        <div className="flex flex-col w-full h-full space-y-6">
          <Button variant="ghost" onClick={() => navigate('/contratos-ti')} className="mb-4 self-start">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Card className="border-red-200 bg-red-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-5 w-5" />
                <p>{error || 'Contrato não encontrado.'}</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex flex-col w-full h-full space-y-6 pb-12">
        {/* Header com Navegação */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <Button variant="ghost" onClick={() => navigate('/contratos-ti')} className="h-10 w-10 mt-1 p-0 rounded-full flex-shrink-0">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex flex-col gap-2">
            <div className="text-sm text-slate-500">
              Início {'>'} Contratações de TI {'>'} <span className="cursor-pointer hover:underline" onClick={() => navigate('/contratos-ti')}>Contratos de TIC</span> {'>'} Detalhes
            </div>
            <h1 className="text-2xl font-bold tracking-tight line-clamp-3" title={contract.objectName || 'Detalhes do Contrato'}>
              {contract.objectName || 'Detalhes do Contrato'}
            </h1>
            <div className="flex items-center gap-3 mt-1">
              {contract.contractType && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">
                    {contract.contractType}
                  </Badge>
                )}
              <p className="text-muted-foreground flex items-center gap-2 text-sm">
                <FileText className="h-4 w-4" /> 
                {contract.noticeNumber || `ID: ${contract.id}`}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Cards Financeiros (Destaque) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="bg-emerald-50 border-emerald-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-emerald-800">Valor Total Estimado</p>
                <p className="text-3xl font-bold text-emerald-900">
                  {formatCurrency(contract.totalValueCents || 0)}
                </p>
              </div>
              <div className="p-3 bg-emerald-100 rounded-full">
                <DollarSign className="h-5 w-5 text-emerald-700" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-blue-50 border-blue-100">
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-blue-800">Valor Mensal Estimado</p>
                <p className="text-3xl font-bold text-blue-900">
                  {formatCurrency(contract.monthlyValueCents || 0)}
                </p>
              </div>
              <div className="p-3 bg-blue-100 rounded-full">
                <DollarSign className="h-5 w-5 text-blue-700" />
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex justify-between items-start">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Valor Anual Estimado</p>
                <p className="text-3xl font-bold">
                  {formatCurrency(contract.yearValue || 0)}
                </p>
              </div>
              <div className="p-3 bg-muted rounded-full">
                <Calendar className="h-5 w-5 text-muted-foreground" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grid de Informações Detalhadas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Bloco 1: Informações Gerais */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Info className="h-5 w-5 text-primary" />
              Informações Gerais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Fornecedor / Empresa</p>
                <p className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground" />
                  {contract.supplier || '-'}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Modelo de Contratação</p>
                <p className="font-medium">{contract.contractModel || '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Processo (PROAD)</p>
                <p className="font-medium">
                  {contract.process ? (
                    <a
                      href={`https://proad-v2.tjgo.jus.br/proad/processo/cadastro?id=${contract.process.substring(9)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                      title="Abrir processo no PROAD"
                    >
                      {contract.process}
                    </a>
                  ) : (
                    '-'
                  )}
                </p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Unidade / Diretoria</p>
                <p className="font-medium">{contract.unidade || contract.directory || '-'}</p>
              </div>
            </div>
            
            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Objeto</p>
              <p className="text-sm leading-relaxed">{contract.objectName || 'Não especificado'}</p>
            </div>
            
            <div className="space-y-2 pt-4 border-t">
              <p className="text-sm font-medium text-muted-foreground">Descrição</p>
              <p className="text-sm leading-relaxed text-muted-foreground bg-muted/30 p-3 rounded-md">
                {contract.description || 'Nenhuma descrição fornecida.'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Bloco 2: Prazos e Vigência */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Prazos e Vigência
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Data de Início</p>
                <p className="font-medium">{formatDate(contract.startDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Data de Término</p>
                <p className="font-medium">{formatDate(contract.endDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Data Efetiva</p>
                <p className="font-medium">{formatDate(contract.effectiveDate)}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Data Limite</p>
                <p className="font-medium">{formatDate(contract.limitDate)}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 pt-4 border-t">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Termo Aditivo Efetivo</p>
                <p className="font-medium">{contract.effectiveAdditiveTerm ?? '-'}</p>
              </div>
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Tipo do Termo Aditivo</p>
                <p className="font-medium">{contract.additiveTermType ?? '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
    </Layout>
  );
}

export default ContractDetails;
