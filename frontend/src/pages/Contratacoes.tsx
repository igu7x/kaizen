import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { EsteiraContratacoes } from "@/components/contratacoes/EsteiraContratacoes";
import { EsteiraRenovacoes } from "@/components/contratacoes/EsteiraRenovacoes";
import { FileText } from "lucide-react";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export default function Contratacoes() {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);

  const [anoSelecionado, setAnoSelecionado] = useState(2026);

  // Trigger animation on route change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Renderizar conteúdo baseado na URL
  const renderContent = () => {
    if (location.pathname.includes("/renovacoes")) {
      return <EsteiraRenovacoes anoSelecionado={anoSelecionado} setAnoSelecionado={setAnoSelecionado} />;
    }
    // Padrão: Novas Contratações
    return <EsteiraContratacoes anoSelecionado={anoSelecionado} setAnoSelecionado={setAnoSelecionado} />;
  };

  const isRenovacoes = location.pathname.includes("/renovacoes");

  return (
    <Layout>
      <div className="space-y-6">
        <Breadcrumbs
          items={[
            { label: "Contratações de TIC", to: "/pca" },
            { label: "Orçamento" },
            { label: isRenovacoes ? "Renovações" : "PCA" },
          ]}
        />
        {/* Header da página */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-600 rounded-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Plano de Contratações Anual {anoSelecionado}
            </h1>
            <p className="text-gray-500 text-sm">
              Gestão de contratações e renovações
            </p>
          </div>
        </div>

        {/* Conteúdo baseado na rota com animação */}
        <div
          key={location.pathname}
          className={`mt-6 ${isAnimating ? "page-transition-enter" : ""}`}
        >
          {renderContent()}
        </div>
      </div>
    </Layout>
  );
}
