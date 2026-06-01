import { useState } from 'react';
import { Layout } from '@/components/layout/Layout';
import { Button } from '@/components/ui/button';
import {
  BarChart3,
  ExternalLink,
  Maximize2,
  Loader2,
  Headphones,
  Printer,
  MonitorSmartphone,
  ClipboardCheck,
  Target,
  BookOpen,
  LucideIcon,
} from 'lucide-react';

// ============================================================
// Painéis publicados no Power BI ("Publicar na web").
// Cada item troca o src do iframe — a navegação acontece dentro
// do Kaizen, sem abrir aba nova.
// ============================================================
interface Dashboard {
  id: string;
  nome: string;
  icon: LucideIcon;
  url: string;
}

// Proporção do iframe do Power BI. Os relatórios da CSTI são desenhados em 16:9 —
// dando ao iframe essa proporção, o Power BI encaixa o relatório na largura cheia
// (sem barra horizontal) e o conteúdo que sobra desce em rolagem vertical.
const IFRAME_ASPECT = '16 / 9';

const DASHBOARDS: Dashboard[] = [
  {
    id: 'suporte-tecnico',
    nome: 'Acompanhamento do Contrato de Suporte Técnico',
    icon: Headphones,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiZDAzMmMxODItZjc3NS00YTIwLTllNGEtNThkMWE5ZDU5MmVjIiwidCI6IjdjNDQ3OGVlLTcxNWItNGFjMC1hNjAwLWY4MWI2ZGM2M2JjZCJ9',
  },
  {
    id: 'outsourcing-impressao',
    nome: 'Acompanhamento do Contrato de Outsourcing de Impressão',
    icon: Printer,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiNTc2MmU0ZjAtMDFmZS00NWNmLWFiYjUtNTI0NDc0ZGY3ZjY0IiwidCI6IjdjNDQ3OGVlLTcxNWItNGFjMC1hNjAwLWY4MWI2ZGM2M2JjZCJ9',
  },
  {
    id: 'parque-computacional',
    nome: 'Gerenciamento do Parque Computacional',
    icon: MonitorSmartphone,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiZGE2ZDRmMzctODQ1OS00MzFiLThhM2EtZmFiZDliYTEzYjM1IiwidCI6IjdjNDQ3OGVlLTcxNWItNGFjMC1hNjAwLWY4MWI2ZGM2M2JjZCJ9',
  },
  {
    id: 'solicitacao-equipamentos',
    nome: 'Controle de Solicitação de Equipamentos de TI',
    icon: ClipboardCheck,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiMWI3NDI4NmQtZjZhYy00NjZjLTgzMDAtMTY4MTYwY2Q3MWYwIiwidCI6IjdjNDQ3OGVlLTcxNWItNGFjMC1hNjAwLWY4MWI2ZGM2M2JjZCJ9',
  },
  {
    id: 'acoes-contratacoes',
    nome: 'Controle das Ações e Contratações da CSTI',
    icon: Target,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiMmYwOTIyZWYtNzNhNy00ZmJmLWEyMjEtOWNlMDc4NmQzMzJmIiwidCI6IjdjNDQ3OGVlLTcxNWItNGFjMC1hNjAwLWY4MWI2ZGM2M2JjZCJ9',
  },
  {
    id: 'conhecimento-procedimentos',
    nome: 'Gestão de Conhecimento e Procedimentos',
    icon: BookOpen,
    url: 'https://app.powerbi.com/view?r=eyJrIjoiNzAzN2JiNWQtNjIzMS00MGFkLWI2MDMtNmJkYTM4NzgzY2Y2IiwidCI6IjdjNDQ3OGVlLTcxNWItNGFjMC1hNjAwLWY4MWI2ZGM2M2JjZCJ9',
  },
];

export default function PainelIndicadores() {
  const [selecionado, setSelecionado] = useState<Dashboard>(DASHBOARDS[0]);
  const [loading, setLoading] = useState(true);

  const handleSelecionar = (d: Dashboard) => {
    if (d.id === selecionado.id) return;
    setLoading(true);
    setSelecionado(d);
  };

  return (
    <Layout>
      <div className="space-y-5 page-transition-enter">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-gradient-to-br from-cyan-500 to-blue-600 rounded-xl shadow-lg">
              <BarChart3 className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Suporte de T.I</h1>
              <p className="text-sm text-slate-600">
                Acompanhe os indicadores estratégicos da instituição em tempo real.
              </p>
            </div>
          </div>

          <Button asChild variant="outline" className="shadow-sm">
            <a href={selecionado.url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="h-4 w-4 mr-2" />
              Abrir em nova aba
            </a>
          </Button>
        </div>

        {/* Menu de painéis — cada botão troca o iframe */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {DASHBOARDS.map((d) => {
            const Icon = d.icon;
            const ativo = d.id === selecionado.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => handleSelecionar(d)}
                className={`flex items-center gap-3 text-left rounded-xl border p-3.5 transition-all ${
                  ativo
                    ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200 shadow-sm'
                    : 'border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm'
                }`}
              >
                <div
                  className={`flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center ${
                    ativo ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={`text-sm font-medium leading-tight ${
                    ativo ? 'text-blue-900' : 'text-slate-700'
                  }`}
                >
                  {d.nome}
                </span>
              </button>
            );
          })}
        </div>

        {/* Power BI embutido — o iframe ocupa 100% da largura (sem rolagem lateral)
            e tem proporção 16:9; o conteúdo que ultrapassa a altura visível desce
            em rolagem vertical. */}
        <div className="relative bg-white border border-slate-200 rounded-2xl shadow-sm overflow-y-auto overflow-x-hidden h-[calc(100vh-380px)] min-h-[560px]">
          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white z-10">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              <p className="mt-3 text-sm text-slate-500">Carregando painel…</p>
            </div>
          )}

          <iframe
            key={selecionado.id}
            title={selecionado.nome}
            src={selecionado.url}
            allowFullScreen
            onLoad={() => setLoading(false)}
            style={{
              width: '100%',
              aspectRatio: IFRAME_ASPECT,
              border: 0,
              display: 'block',
            }}
          />
        </div>

        {/* Rodapé com dica de tela cheia */}
        <p className="flex items-center gap-1.5 text-xs text-slate-400">
          <Maximize2 className="h-3.5 w-3.5" />
          Use o botão de tela cheia no canto inferior direito do painel para uma visualização ampliada.
        </p>
      </div>
    </Layout>
  );
}
