import { useNavigate } from "react-router-dom";
import { Settings2, ChevronRight } from "lucide-react";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { VoltarCadastros } from "@/components/ui/VoltarCadastros";

const contratacoesItems = [
  {
    title: "Parâmetros",
    description: "Configurações do Ciclo Orçamentário de Contratações de TIC.",
    icon: Settings2,
    path: "/cadastros/contratacoes-tic/parametros",
  },
];

export default function CadastroContratacoesTic() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-5xl mx-auto px-6 py-10">
          <VoltarCadastros />
          <div className="mb-6 pl-2">
            <Breadcrumbs
              items={[
                { label: "Cadastros", to: "/cadastros" },
                { label: "Contratações de TIC" },
              ]}
            />
          </div>

          {/* Header */}
          <div className="mb-10 text-left pl-2">
            <div className="flex items-center gap-3 mb-2">
               <div className="p-2 bg-blue-600 rounded-lg text-white">
                  <Settings2 className="h-6 w-6" />
                </div>
                <h1 className="text-3xl font-bold text-slate-900">
                  Contratações de TIC
                </h1>
            </div>
            <p className="text-slate-500 mt-1 text-sm">
              Cadastros e configurações do módulo de Contratações de TIC.
            </p>
          </div>

          {/* Lista de módulos */}
          <div className="flex flex-col gap-2">
            {contratacoesItems.map((item) => (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
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
