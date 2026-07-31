import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Contract } from '@/types';
import { contractsApi, ContractFilters as ApiContractFilters } from '@/services/contractsApi';
import { areasApi } from '@/services/areasApi';
import type { Area, Unidade } from '@/services/areasApi';
import { ContractList } from '@/components/contratacoes/ContractList';
import { ContractFilters } from '@/components/contratacoes/ContractFilters';
import { Card, CardContent } from '@/components/ui/card';
import { AlertCircle, Loader2, Plus, Save } from 'lucide-react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

export function ContratosTI() {
  const { user } = useAuth();

  const [contracts, setContracts] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Áreas/Unidades State
  const [areasList, setAreasList] = useState<Area[]>([]);
  const [unidadesList, setUnidadesList] = useState<Unidade[]>([]);

  // Modal State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [contractToEdit, setContractToEdit] = useState<Contract | null>(null);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);

  // Form State
  const [formData, setFormData] = useState<Partial<Contract>>({
    supplier: '',
    contractModel: '',
    process: '',
    contractType: '',
    objectName: '',
    description: '',
    noticeNumber: '',
    startDate: '',
    endDate: '',
    effectiveDate: '',
    limitDate: '',

    cadastroAreaId: undefined as number | undefined,
    cadastroUnidadeId: undefined as number | undefined,
    monthlyValueCents: 0,
    totalValueCents: 0,
    yearValue: 0,
    yearDurationStandard: undefined as number | undefined
  });

  useEffect(() => {
    if (formData.cadastroAreaId) {
      areasApi
        .getUnidades(formData.cadastroAreaId)
        .then(setUnidadesList)
        .catch(() => setUnidadesList([]));
    } else {
      setUnidadesList([]);
    }
  }, [formData.cadastroAreaId]);

  const formatCurrencyInput = (value: number | undefined | null) => {
    if (value === undefined || value === null) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value / 100);
  };

  const parseCurrencyInput = (value: string) => {
    const numbersOnly = value.replace(/\D/g, '');
    return numbersOnly ? parseInt(numbersOnly, 10) : 0;
  };

  const openNewContractModal = () => {
    setContractToEdit(null);
    setFormData({
      supplier: '',
      contractModel: '',
      process: '',
      contractType: '',
      objectName: '',
      description: '',
      noticeNumber: '',
      startDate: '',
      endDate: '',
      effectiveDate: '',
      limitDate: '',

      cadastroAreaId: undefined,
      cadastroUnidadeId: undefined,
      monthlyValueCents: 0,
      totalValueCents: 0,
      yearValue: 0
    });
    setIsAddModalOpen(true);
  };

  const handleEdit = (contract: Contract) => {
    setContractToEdit(contract);
    setFormData({ ...contract });
    setIsAddModalOpen(true);
  };

  const openDeleteDialog = (contract: Contract) => {
    setContractToDelete(contract);
    setIsDeleteDialogOpen(true);
  };

  const executeDelete = async () => {
    if (!contractToDelete || !contractToDelete.id) return;
    try {
      setLoading(true);
      await contractsApi.deleteContract(contractToDelete.id);
      setIsDeleteDialogOpen(false);
      setContractToDelete(null);
      fetchContracts();
    } catch (err) {
      console.error('Erro ao excluir contrato:', err);
      setError('Erro ao excluir o contrato. Tente novamente.');
      setLoading(false);
    }
  };

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

  useEffect(() => {
    areasApi.getAll().then(setAreasList).catch(() => {});
  }, []);

  const handleInputChange = (field: keyof Contract, value: string | number) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddSubmit = async () => {
    try {
      setModalLoading(true);
      setModalError(null);

      if (!formData.supplier || !formData.objectName || !formData.startDate || !formData.endDate || !formData.cadastroAreaId || !formData.cadastroUnidadeId) {
        throw new Error('Preencha os campos obrigatórios: Fornecedor, Objeto, Data Início, Data Término, Diretoria e Área Demandante.');
      }

      const dateFields = [formData.startDate, formData.endDate, formData.effectiveDate];
      for (const date of dateFields) {
        if (date && date.length > 10) {
          throw new Error('Data inválida (ano deve conter no máximo 4 dígitos).');
        }
      }

      if (contractToEdit && contractToEdit.id) {
        await contractsApi.updateContract(contractToEdit.id, formData);
      } else {
        await contractsApi.createContract(formData);
      }
      setIsAddModalOpen(false);
      setFormData({});
      fetchContracts();
    } catch (err: any) {
      console.error('Erro ao criar contrato:', err);
      setModalError(err.message || 'Erro ao salvar o contrato.');
    } finally {
      setModalLoading(false);
    }
  };

  return (
    <Layout>
      <div className="flex flex-col w-full h-full">
        <div className="text-sm text-slate-500 mb-2">
          Início {'>'} Contratações de TIC {'>'} Gestão Contratual
        </div>

        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Contratos de TIC</h1>
            <p className="text-sm text-slate-500">
              Gestão e acompanhamento dos contratos de tecnologia
            </p>
          </div>
          <Button onClick={openNewContractModal} className="flex items-center gap-2">
            <Plus className="h-4 w-4" />
            Novo Contrato
          </Button>
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
                  <ContractList 
                    contracts={contracts} 
                    onEdit={handleEdit} 
                    onDelete={openDeleteDialog} 
                  />
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{contractToEdit ? 'Editar Contrato' : 'Novo Contrato'}</DialogTitle>
            <DialogDescription>
              {contractToEdit 
                ? 'Atualize os detalhes do contrato de TI selecionado.'
                : 'Preencha os detalhes para cadastrar um novo contrato de TI.'}
            </DialogDescription>
          </DialogHeader>

          {modalError && (
            <div className="bg-red-50 border border-red-200 text-red-800 p-3 rounded flex items-center gap-2">
              <AlertCircle className="h-4 w-4" />
              <p className="text-sm font-medium">{modalError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Fornecedor (Empresa) <span className="text-red-500">*</span></Label>
              <Input
                value={formData.supplier || ''}
                onChange={(e) => handleInputChange('supplier', e.target.value)}
                placeholder="Ex: Empresa X LTDA"
              />
            </div>

            <div className="space-y-2">
              <Label>Nº do Contrato / Edital</Label>
              <Input
                value={formData.noticeNumber || ''}
                onChange={(e) => handleInputChange('noticeNumber', e.target.value)}
                placeholder="Ex: 123/2026"
              />
            </div>

            <div className="space-y-2">
              <Label>Processo (PROAD)</Label>
              <Input
                value={formData.process || ''}
                onChange={(e) => handleInputChange('process', e.target.value)}
                placeholder="Ex: 20260000123456"
              />
            </div>

            <div className="space-y-2">
              <Label>Modelo de Contratação</Label>
              <Input
                value={formData.contractModel || ''}
                onChange={(e) => handleInputChange('contractModel', e.target.value)}
                placeholder="Ex: Pregão Eletrônico"
              />
            </div>

            <div className="space-y-2">
              <Label>Tipo de Contrato</Label>
              <Select onValueChange={(v) => handleInputChange('contractType', v)}>
                <SelectTrigger>
                  <SelectValue placeholder={formData.contractType || "Selecione o tipo..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Armazenamento">Armazenamento</SelectItem>
                  <SelectItem value="Autenticação">Autenticação</SelectItem>
                  <SelectItem value="Backup">Backup</SelectItem>
                  <SelectItem value="Banco de Dados">Banco de Dados</SelectItem>
                  <SelectItem value="Colaboração">Colaboração</SelectItem>
                  <SelectItem value="Compliance">Compliance</SelectItem>
                  <SelectItem value="Desenvolvimento">Desenvolvimento</SelectItem>
                  <SelectItem value="Email">Email</SelectItem>
                  <SelectItem value="Fábrica de Software">Fábrica de Software</SelectItem>
                  <SelectItem value="Gestão">Gestão</SelectItem>
                  <SelectItem value="Help Desk">Help Desk</SelectItem>
                  <SelectItem value="Impressão">Impressão</SelectItem>
                  <SelectItem value="Links de Dados">Links de Dados</SelectItem>
                  <SelectItem value="Material">Material</SelectItem>
                  <SelectItem value="Nuvem">Nuvem</SelectItem>
                  <SelectItem value="Parque Computacior">Parque Computacional</SelectItem>
                  <SelectItem value="Processamento">Processamento</SelectItem>
                  <SelectItem value="Redes">Redes</SelectItem>
                  <SelectItem value="Residência">Residência</SelectItem>
                  <SelectItem value="Software Prateleira">Software Prateleira</SelectItem>
                  <SelectItem value="Segurança">Segurança</SelectItem>
                  <SelectItem value="Telefonia fixa">Telefonia fixa</SelectItem>
                  <SelectItem value="Telefonia móvel">Telefonia móvel</SelectItem>
                  <SelectItem value="Videoconferência">Videoconferência</SelectItem>
                  <SelectItem value="Voip">Voip</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Natureza (Orçamento de TIC)</Label>
              <Select
                value={formData.situation || ""}
                onValueChange={(v) => handleInputChange("situation", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a natureza..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="continuada">Continuada</SelectItem>
                  <SelectItem value="pontual">Pontual</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Diretoria <span className="text-red-500">*</span></Label>
              <Select
                value={formData.cadastroAreaId ? String(formData.cadastroAreaId) : undefined}
                onValueChange={(v) => {
                  const dirId = parseInt(v, 10);
                  const dir = areasList.find((d) => d.id === dirId);
                  setFormData(prev => ({
                    ...prev,
                    cadastroAreaId: dirId,
                    cadastroUnidadeId: undefined
                  }));
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a diretoria..." />
                </SelectTrigger>
                <SelectContent>
                  {areasList.map((dir) => (
                    <SelectItem key={dir.id} value={String(dir.id)}>
                      {dir.sigla ? `${dir.sigla} - ${dir.nome}` : dir.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Área Demandante <span className="text-red-500">*</span></Label>
              <Select
                value={formData.cadastroUnidadeId ? String(formData.cadastroUnidadeId) : undefined}
                onValueChange={(v) => {
                  const unidId = parseInt(v, 10);
                  setFormData(prev => ({
                    ...prev,
                    cadastroUnidadeId: unidId
                  }));
                }}
                disabled={!formData.cadastroAreaId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a área demandante..." />
                </SelectTrigger>
                <SelectContent>
                  {unidadesList.map((u) => {
                    const dir = areasList.find(
                      (d) => d.id === formData.cadastroAreaId
                    );
                    const sigla = dir?.sigla || dir?.nome;
                    return (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.nome} {sigla ? `(${sigla})` : ""}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Objeto <span className="text-red-500">*</span></Label>
              <Input
                value={formData.objectName || ''}
                onChange={(e) => handleInputChange('objectName', e.target.value)}
                placeholder="Resumo do objeto contratado"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label>Descrição Completa</Label>
              <Textarea
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descrição detalhada do contrato..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label>Início Vigência Atual <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                max="9999-12-31"
                value={formData.startDate || ''}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fim Vigência Atual <span className="text-red-500">*</span></Label>
              <Input
                type="date"
                max="9999-12-31"
                value={formData.endDate || ''}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Data de Início (Contrato Base)</Label>
              <Input
                type="date"
                max="9999-12-31"
                value={formData.effectiveDate || ''}
                onChange={(e) => handleInputChange('effectiveDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Fim da Vigência Global</Label>
              <Input
                type="date"
                max="9999-12-31"
                value={formData.limitDate || ''}
                onChange={(e) => handleInputChange('limitDate', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Mensal</Label>
              <Input
                type="text"
                value={formatCurrencyInput(formData.monthlyValueCents)}
                onChange={(e) => handleInputChange('monthlyValueCents', parseCurrencyInput(e.target.value))}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Anual do Contrato</Label>
              <Input
                type="text"
                value={formatCurrencyInput(formData.yearValue)}
                onChange={(e) => handleInputChange('yearValue', parseCurrencyInput(e.target.value))}
                placeholder="R$ 0,00"
              />
            </div>

            <div className="space-y-2">
              <Label>Valor Total do Contrato</Label>
              <Input
                type="text"
                value={formatCurrencyInput(formData.totalValueCents)}
                onChange={(e) => handleInputChange('totalValueCents', parseCurrencyInput(e.target.value))}
                placeholder="R$ 0,00"
              />
            </div>

          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" onClick={() => setIsAddModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddSubmit} disabled={modalLoading}>
              {modalLoading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
              Salvar Contrato
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-600" />
              Confirmar Exclusão
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o contrato{' '}
              <strong>{contractToDelete?.noticeNumber || contractToDelete?.objectName || `ID: ${contractToDelete?.id}`}</strong>?
              <br /><br />
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeDelete}
              disabled={loading}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Exclusão
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </Layout>
  );
}

export default ContratosTI;
