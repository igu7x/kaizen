import { useNavigate } from "react-router-dom";
import {
  FileText,
  FolderKanban,
  Building2,
  Users,
  Target,
  ShieldCheck,
  ChevronRight,
} from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

const cadastroItems = [
  {
    title: "Planos / Programas",
    description: "Instrumentos de planejamento e programas estratégicos.",
    icon: FileText,
    path: "/cadastros/planos-programas",
  },
  {
    title: "Projetos",
    description: "Todos os projetos cadastrados no sistema.",
    icon: FolderKanban,
    path: "/cadastros/projetos",
  },
  {
    title: "Áreas",
    description: "Estrutura organizacional: diretorias, unidades e gestores.",
    icon: Building2,
    path: "/cadastros/areas",
  },
  {
    title: "Pessoas",
    description: "Colaboradores vinculados às áreas.",
    icon: Users,
    path: "/cadastros/pessoas",
  },
  {
    title: "OKRs / Metas",
    description: "Objetivos e resultados-chave institucionais.",
    icon: Target,
    path: "/cadastros/okrs-metas",
  },
  {
    title: "Permissões do TAP",
    description:
      "Conceder a usuários a edição dos campos do TAP em projetos da sua diretoria.",
    icon: ShieldCheck,
    path: "/cadastros/permissoes-tap",
  },
];

export default function CadastroHub() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <div className="mb-6 pl-2">
            <Breadcrumbs items={[{ label: "Cadastros" }]} />
          </div>

          {/* Header */}
          <div className="mb-10 text-left pl-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-1">
              Administração
            </p>
            <h1 className="text-3xl font-bold text-slate-900">Cadastros</h1>
            <p className="text-slate-500 mt-1 text-sm">
              Selecione um módulo para gerenciar.
            </p>
          </div>

          {/* Lista de módulos */}
          <div className="flex flex-col gap-2">
            {cadastroItems.map((item) => (
              <button
                key={item.path}
                onClick={() =>
                  navigate(item.path, { state: { fromCadastros: true } })
                }
                className="group flex items-center gap-5 w-full text-left px-5 py-4 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 hover:border-blue-300 hover:shadow-sm transition-all duration-150"
              >
                {/* Ícone */}
                <div className="flex-shrink-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-50 group-hover:bg-blue-100 flex items-center justify-center transition-colors">
                    <item.icon className="h-4 w-4 text-blue-600" />
                  </div>
                </div>

                {/* Texto */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {item.title}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    {item.description}
                  </p>
                </div>

                {/* Seta */}
                <ChevronRight className="h-4 w-4 text-slate-300 group-hover:text-blue-500 group-hover:translate-x-0.5 transition-all flex-shrink-0" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </Layout>
  );
}
