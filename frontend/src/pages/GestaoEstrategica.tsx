import { useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Breadcrumbs } from '@/components/ui/Breadcrumbs';
import { DirectorateSelector } from '@/components/gestao/DirectorateSelector';
import { MonitoramentoOKRs } from '@/components/gestao/MonitoramentoOKRs';
import { ControleExecucaoNovo } from '@/components/gestao/ControleExecucaoNovo';
import { EscritorioProjetos } from '@/components/gestao/EscritorioProjetos';
import { SprintAtualNovo } from '@/components/gestao/SprintAtualNovo';
import { useDirectorate } from '@/contexts/DirectorateContext';
import { useEstrategiaModelo } from '@/contexts/EstrategiaModeloContext';

export default function GestaoEstrategica() {
  const location = useLocation();
  const { selectedDirectorate } = useDirectorate();
  const { modelo } = useEstrategiaModelo();
  const [isAnimating, setIsAnimating] = useState(false);

  // Trigger animation on route change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Obter título e subtítulo baseado na rota
  const getPageInfo = () => {
    if (location.pathname === '/gestao-estrategica/okrs') {
      return { subtitle: modelo === 'metas' ? 'Monitoramento de Metas' : 'Monitoramento de OKRs' };
    }
    if (location.pathname === '/gestao-estrategica/execucao') {
      return { subtitle: 'Escritório de Projetos' };
    }
    if (location.pathname === '/gestao-estrategica/sprint') {
      return { subtitle: 'Sprint Atual' };
    }
    // Padrão
    return { subtitle: modelo === 'metas' ? 'Monitoramento de Metas' : 'Monitoramento de OKRs' };
  };

  const { subtitle } = getPageInfo();

  const isWhiteBgPage = location.pathname === '/gestao-estrategica/okrs' || location.pathname === '/gestao-estrategica/execucao';

  // Renderizar conteúdo baseado na URL
  const renderContent = () => {
    if (location.pathname === '/gestao-estrategica/okrs') {
      return <MonitoramentoOKRs key={location.key}  />;
    }
    if (location.pathname === '/gestao-estrategica/execucao') {
      return <ControleExecucaoNovo key={selectedDirectorate} />;
    }
    if (location.pathname === '/gestao-estrategica/sprint') {
      return <SprintAtualNovo />;
    }
    // Padrão: Monitoramento de OKRs
    return <MonitoramentoOKRs key={location.key}  />;
  };

  const breadcrumbItems = location.pathname === '/gestao-estrategica/okrs'
    ? [{ label: 'Gestão Estratégica', to: '/gestao-estrategica' }, { label: 'Monitoramento de OKRs' }]
    : location.pathname === '/gestao-estrategica/execucao'
    ? [{ label: 'Gestão Estratégica', to: '/gestao-estrategica' }, { label: 'Escritório de Projetos' }]
    : location.pathname === '/gestao-estrategica/sprint'
    ? [{ label: 'Gestão Estratégica', to: '/gestao-estrategica' }, { label: 'Controle de Execução' }]
    : [{ label: 'Gestão Estratégica' }];

  return (
    <Layout>
      <div className="space-y-4 lg:space-y-6">
        <Breadcrumbs items={breadcrumbItems} className={isWhiteBgPage ? '' : '[&_*]:!text-white/70 [&_a:hover]:!text-white'} />
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            <div
              className="w-1.5 h-12 rounded-full"
              style={{ background: 'linear-gradient(180deg, #0A2547 0%, #1565C0 100%)' }}
            />
            <div>
              <p className={`text-xs font-medium uppercase tracking-wider ${isWhiteBgPage ? 'text-slate-400' : 'text-white/50'}`}>
                Gestão Estratégica
              </p>
              <h1 className={`text-2xl font-bold ${isWhiteBgPage ? 'text-slate-800' : 'text-white'}`}>
                {subtitle}
              </h1>
            </div>
          </div>

          {/* Seletor de Diretoria - canto superior direito */}
          <DirectorateSelector />
        </div>

        {/* Conteúdo baseado na rota com animação */}
        <div
          key={location.key}
          className={`space-y-4 lg:space-y-6 ${isAnimating ? 'page-transition-enter' : ''}`}
        >
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
