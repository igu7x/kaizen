import { Contract } from '@/types';
import { formatCurrency } from '@/services/pcaApi';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { FileText, Building2, Calendar, Pencil, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';

interface ContractListProps {
  contracts: Contract[];
  onEdit?: (contract: Contract) => void;
  onDelete?: (contract: Contract) => void;
}

export function ContractList({ contracts, onEdit, onDelete }: ContractListProps) {
  const navigate = useNavigate();

  const handleRowClick = (id: number) => {
    navigate(`/contratos-ti/${id}`);
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR').format(date);
  };

  if (contracts.length === 0) {
    return (
      <div className="text-center p-8 text-muted-foreground border rounded-md bg-muted/20">
        Nenhum contrato encontrado.
      </div>
    );
  }

  return (
    <div className="border rounded-md overflow-hidden bg-white">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50 hover:bg-muted/50">
            <TableHead className="w-[180px]">Nº do Contrato</TableHead>
            <TableHead>Empresa (Fornecedor)</TableHead>
            <TableHead className="hidden md:table-cell">Objeto</TableHead>
            <TableHead>Modelo / Tipo</TableHead>
            <TableHead className="text-right">Valor Mensal</TableHead>
            <TableHead className="text-right">Valor Total do Contrato</TableHead>
            <TableHead className="w-[100px] text-center">Ações</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {contracts.map((contract) => (
            <TableRow
              key={contract.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => handleRowClick(contract.id!)}
            >
              <TableCell className="font-medium">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" />
                  {contract.noticeNumber || `ID: ${contract.id}`}
                </div>
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  <span title={contract.supplier || 'Não informado'}>
                    {contract.supplier || '-'}
                  </span>
                </div>
              </TableCell>
              <TableCell className="hidden md:table-cell">
                <p className="text-sm text-muted-foreground line-clamp-2" title={contract.objectName || 'Não informado'}>
                  {contract.objectName || '-'}
                </p>
              </TableCell>
              <TableCell>
                <div className="flex flex-col gap-1">
                  <span className="text-sm">{contract.contractModel || '-'}</span>
                  {contract.contractType && (
                    <Badge variant="outline" className="w-fit text-xs font-normal bg-blue-50 text-blue-700 border-blue-200">
                      {contract.contractType}
                    </Badge>
                  )}
                </div>
              </TableCell>
              <TableCell className="text-right text-sm font-medium">
                {formatCurrency((contract.monthlyValueCents || 0) / 100)}
              </TableCell>
              <TableCell className="text-right text-sm font-medium text-emerald-600">
                {formatCurrency((contract.totalValueCents || 0) / 100)}
              </TableCell>
              <TableCell className="text-center" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-center gap-1">
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => onEdit && onEdit(contract)}
                    className="h-8 w-8 text-slate-500 hover:text-blue-600 hover:bg-blue-50"
                    title="Editar Contrato"
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => onDelete && onDelete(contract)}
                    className="h-8 w-8 text-slate-500 hover:text-red-600 hover:bg-red-50"
                    title="Excluir Contrato"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

export default ContractList;
