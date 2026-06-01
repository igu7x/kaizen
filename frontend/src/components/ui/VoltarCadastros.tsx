import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from './button';

/**
 * Botão "← Cadastros" que aparece quando a página foi acessada via hub de Cadastros.
 * Basta adicionar <VoltarCadastros /> no topo do conteúdo da página.
 */
export function VoltarCadastros() {
  const location = useLocation();
  const navigate = useNavigate();

  if (!(location.state as any)?.fromCadastros) return null;

  return (
    <div className="mb-4">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => navigate('/cadastros')}
        className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 -ml-2"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Cadastros
      </Button>
    </div>
  );
}
