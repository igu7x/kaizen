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
  Info,
  Link as LinkIcon,
  Plus,
  Trash2,
  CheckCircle,
  Search
} from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { pcaApi } from '@/services/pcaApi';
import { useToast } from '@/hooks/use-toast';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ContractDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [contract, setContract] = useState<Contract | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // PCA states
  const [pcas, setPcas] = useState<any[]>([]);
  const [allPcas, setAllPcas] = useState<any[]>([]);
  const [isPcaModalOpen, setIsPcaModalOpen] = useState(false);
  const [selectedPcas, setSelectedPcas] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedYear, setSelectedYear] = useState<string>(new Date().getFullYear().toString());
  const [savingLink, setSavingLink] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [pcaToDelete, setPcaToDelete] = useState<any | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadContract = async () => {
      if (!id) return;
      try {
        setLoading(true);
        setError(null);
        const [data, pcasData] = await Promise.all([
          contractsApi.getContractById(Number(id)),
          contractsApi.getContractPcas(Number(id))
        ]);
        setContract(data);
        setPcas(pcasData);
      } catch (err) {
        console.error('Error fetching contract details:', err);
        setError('Não foi possível carregar os detalhes do contrato.');
      } finally {
        setLoading(false);
      }
    };
    loadContract();
  }, [id]);

  const openPcaModal = async () => {
    setIsPcaModalOpen(true);
    setSelectedPcas([]);
    setSearchQuery('');
    try {
      const p = await pcaApi.getPcaItems();
      setAllPcas(p);
    } catch (err) {
      console.error(err);
      toast({ title: 'Erro ao carregar PCAs', variant: 'destructive' });
    }
  };

  const togglePcaSelection = (pcaId: number) => {
    setSelectedPcas(prev =>
      prev.includes(pcaId) ? prev.filter(id => id !== pcaId) : [...prev, pcaId]
    );
  };

  const handleLinkPcas = async () => {
    if (!id || selectedPcas.length === 0) return;
    try {
      setSavingLink(true);
      await contractsApi.linkPcas(Number(id), selectedPcas);
      toast({ title: 'Vínculos estabelecidos com sucesso!' });
      setIsPcaModalOpen(false);

      // Reload PCAs
      const pcasData = await contractsApi.getContractPcas(Number(id));
      setPcas(pcasData);
    } catch (err) {
      toast({ title: 'Erro ao vincular PCAs', variant: 'destructive' });
    } finally {
      setSavingLink(false);
    }
  };

  const executeUnlinkPca = async () => {
    if (!id || !pcaToDelete) return;

    try {
      await contractsApi.unlinkPca(Number(id), pcaToDelete.id);
      toast({ title: 'Vínculo removido.' });
      setPcas(prev => prev.filter(p => p.id !== pcaToDelete.id));
      setIsDeleteDialogOpen(false);
      setPcaToDelete(null);
    } catch (err) {
      toast({ title: 'Erro ao remover vínculo', variant: 'destructive' });
    }
  };

  const filteredAllPcas = allPcas.filter(p => {
    const pcaYear = String(p.ano || p.year || '');
    const matchesYear = selectedYear === 'Todos' || pcaYear === selectedYear;
    
    if (!matchesYear) return false;

    if (!searchQuery) return true;
    const term = searchQuery.toLowerCase();
    return (p.item_pca && String(p.item_pca).toLowerCase().includes(term)) ||
      (p.objeto && p.objeto.toLowerCase().includes(term)) ||
      (p.code && String(p.code).toLowerCase().includes(term)) ||
      (p.object_name && p.object_name.toLowerCase().includes(term));
  });

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Se for um mês por extenso (ex: "Janeiro"), retorna a string pura
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
          <Button type="button" variant="ghost" onClick={() => navigate('/contratos-ti')} className="mb-4 self-start">
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
            <Button type="button" variant="ghost" onClick={() => navigate('/contratos-ti')} className="h-10 w-10 mt-1 p-0 rounded-full flex-shrink-0">
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
                  <p className="text-sm font-medium text-emerald-800">Valor Total do Contrato</p>
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
                  <p className="text-sm font-medium text-blue-800">Valor Mensal</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Valor Anual do Contrato</p>
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
                  <p className="text-sm font-medium text-muted-foreground">Início Vigência Atual</p>
                  <p className="font-medium">{formatDate(contract.startDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Fim Vigência Atual</p>
                  <p className="font-medium">{formatDate(contract.endDate)}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Data Efetiva</p>
                  <p className="font-medium">{formatDate(contract.effectiveDate)}</p>
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

        {/* Bloco 3: PCAs Relacionados */}
        <Card className="col-span-1 lg:col-span-2 mt-6">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2" style={{ color: "#0A2547" }}>
              <LinkIcon className="h-5 w-5" />
              PCAs Relacionados
            </CardTitle>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="hover:bg-slate-50"
              style={{ borderColor: "#0A2547", color: "#0A2547" }}
              onClick={openPcaModal}
            >
              <Plus className="h-4 w-4 mr-2" />
              Estabelecer Vínculo
            </Button>
          </CardHeader>
          <CardContent>
            {pcas.length === 0 ? (
              <div className="text-center text-gray-500 py-8 bg-gray-50 rounded-lg border border-dashed border-gray-200">
                Nenhum PCA vinculado a este contrato
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow style={{ backgroundColor: "#0A2547" }}>
                    <TableHead className="text-white font-bold">Código</TableHead>
                    <TableHead className="text-white font-bold">Objeto</TableHead>
                    <TableHead className="text-white font-bold">Ano</TableHead>
                    <TableHead className="text-white font-bold">Prazo Estimado</TableHead>
                    <TableHead className="text-white font-bold w-24 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pcas.map((pca) => (
                    <TableRow
                      key={pca.id}
                      className="hover:bg-slate-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/contratacoes-ti/item/${pca.id}`)}
                    >
                      <TableCell className="font-medium">PCA {pca.item_pca || pca.id}</TableCell>
                      <TableCell className="max-w-md truncate" title={pca.objeto || pca.object_name}>{pca.objeto || pca.object_name || 'Não especificado'}</TableCell>
                      <TableCell>{pca.ano || pca.year || '-'}</TableCell>
                      <TableCell>{formatDate(pca.data_estimada_contratacao || pca.estimated_date)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={(e) => {
                            e.stopPropagation();
                            setPcaToDelete(pca);
                            setIsDeleteDialogOpen(true);
                          }}
                          title="Remover vínculo"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Modal: Estabelecer Vínculo */}
        <Dialog open={isPcaModalOpen} onOpenChange={setIsPcaModalOpen}>
          <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col">
            <DialogHeader>
              <DialogTitle>Estabelecer Vínculo com PCAs</DialogTitle>
              <DialogDescription>
                Selecione os PCAs que deseja vincular a este contrato.
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center gap-4 py-4">
              <div className="flex items-center gap-2 flex-1">
                <Search className="h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar por código ou objeto..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="max-w-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-700">Ano:</span>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="w-[120px]">
                    <SelectValue placeholder="Selecione o ano" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Todos">Todos</SelectItem>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="overflow-y-auto flex-1 border rounded-md min-h-[300px]">
              <Table>
                <TableHeader className="sticky top-0 bg-white z-10 shadow-sm">
                  <TableRow>
                    <TableHead className="w-12"></TableHead>
                    <TableHead>Código</TableHead>
                    <TableHead>Objeto</TableHead>
                    <TableHead>Ano</TableHead>
                    <TableHead>Prazo Estimado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAllPcas.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        Nenhum PCA encontrado.
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredAllPcas.map((pca) => (
                      <TableRow
                        key={pca.id}
                        className="hover:bg-gray-50 cursor-pointer"
                        onClick={() => togglePcaSelection(pca.id)}
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedPcas.includes(pca.id)}
                            onCheckedChange={() => togglePcaSelection(pca.id)}
                            onClick={(e) => e.stopPropagation()}
                          />
                        </TableCell>
                        <TableCell className="font-medium">PCA {pca.item_pca || pca.code}</TableCell>
                        <TableCell className="max-w-md truncate">{pca.objeto || pca.object_name}</TableCell>
                        <TableCell>{pca.ano || pca.year || '-'}</TableCell>
                        <TableCell>{formatDate(pca.data_estimada_contratacao || pca.estimated_date)}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsPcaModalOpen(false)}>Cancelar</Button>
              <Button type="button" onClick={handleLinkPcas} disabled={savingLink || selectedPcas.length === 0}>
                {savingLink ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Adicionar Vínculo(s) ({selectedPcas.length})
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                Confirmar Remoção de Vínculo
              </AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover o vínculo do{' '}
                <strong>PCA {pcaToDelete?.item_pca || pcaToDelete?.id}</strong> deste contrato?
                <br /><br />
                Esta ação desvinculará o PCA, mas não o excluirá do sistema.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={executeUnlinkPca}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                Confirmar Remoção
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Layout>
  );
}

export default ContractDetails;
