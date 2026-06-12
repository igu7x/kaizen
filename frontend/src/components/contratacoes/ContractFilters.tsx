import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ContractTypeEnum } from '@/types';
import { ContractFilters as ApiContractFilters } from '@/services/contractsApi';

const contractTypes: ContractTypeEnum[] = [
  'Armazenamento', 'Autenticação', 'Backup', 'Banco de Dados', 'Colaboração', 
  'Compliance', 'Desenvolvimento', 'Email', 'Fábrica de Software', 'Gestão', 
  'Help Desk', 'Impressão', 'Links de Dados', 'Material', 'Nuvem', 
  'Parque Computacior', 'Processamento', 'Redes', 'Residência', 
  'Software Prateleira', 'Segurança', 'Telefonia fixa', 'Telefonia móvel', 
  'Videoconferência', 'Voip'
];

interface ContractFiltersProps {
  onFilterChange: (filters: ApiContractFilters) => void;
}

export function ContractFilters({ onFilterChange }: ContractFiltersProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [contractType, setContractType] = useState<string>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchTerm(value);
    triggerFilterUpdate(value, contractType, startDate, endDate);
  };

  const handleTypeChange = (value: string) => {
    setContractType(value);
    triggerFilterUpdate(searchTerm, value, startDate, endDate);
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setStartDate(value);
    triggerFilterUpdate(searchTerm, contractType, value, endDate);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setEndDate(value);
    triggerFilterUpdate(searchTerm, contractType, startDate, value);
  };

  const triggerFilterUpdate = (search: string, type: string, start: string, end: string) => {
    onFilterChange({
      searchQuery: search || undefined,
      contractType: type === 'all' ? undefined : type,
      startDate: start || undefined,
      endDate: end || undefined
    });
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 mb-6">
      <div className="relative flex-1">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por número, empresa ou objeto..."
          className="pl-8"
          value={searchTerm}
          onChange={handleSearchChange}
        />
      </div>
      
      <Select value={contractType} onValueChange={handleTypeChange}>
        <SelectTrigger className="w-full sm:w-[200px]">
          <SelectValue placeholder="Tipo de Contrato" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">Todos os Tipos</SelectItem>
          {contractTypes.map((type) => (
            <SelectItem key={type} value={type}>{type}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="flex items-center gap-2">
        <Input 
          type="date" 
          value={startDate}
          onChange={handleStartDateChange}
          className="w-auto"
          title="Data Inicial"
        />
        <span className="text-muted-foreground">até</span>
        <Input 
          type="date" 
          value={endDate}
          onChange={handleEndDateChange}
          className="w-auto"
          title="Data Final"
        />
      </div>
    </div>
  );
}
