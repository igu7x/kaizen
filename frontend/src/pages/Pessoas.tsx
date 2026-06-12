import { useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { Layout } from "@/components/layout/Layout";
import { PainelColaboradores } from "@/components/pessoas/PainelColaboradores";
import { AdminFormsView } from "@/components/pessoas/AdminFormsView";
import { GestaoCompetencias } from "@/components/pessoas/GestaoCompetencias";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";

export default function Pessoas() {
  const location = useLocation();
  const [isAnimating, setIsAnimating] = useState(false);
  // Força remount do conteúdo ao clicar no breadcrumb "Pessoas" (reseta estado interno)
  const [refreshKey, setRefreshKey] = useState(0);

  // Trigger animation on route change
  useEffect(() => {
    setIsAnimating(true);
    const timer = setTimeout(() => setIsAnimating(false), 400);
    return () => clearTimeout(timer);
  }, [location.pathname]);

  // Determinar qual view mostrar baseado na rota
  const isFormularios = location.pathname.includes("/formularios");
  const isCompetencias = location.pathname.includes("/competencias");

  const renderContent = () => {
    if (isCompetencias) return <GestaoCompetencias />;
    if (isFormularios) return <AdminFormsView />;
    return <PainelColaboradores />;
  };

  // "Pessoas" reseta a view atual (módulo painel não existe em produção)
  const handleRefresh = () => setRefreshKey((k) => k + 1);
  const breadcrumbItems = isCompetencias
    ? [
        { label: "Pessoas", onClick: handleRefresh },
        { label: "Gestão por Competências" },
      ]
    : isFormularios
      ? [{ label: "Pessoas", onClick: handleRefresh }, { label: "Formulários" }]
      : [{ label: "Pessoas", onClick: handleRefresh }, { label: "Painel" }];

  return (
    <Layout>
      <div className="-mt-2 mb-2">
        <Breadcrumbs items={breadcrumbItems} />
      </div>
      <div
        key={`${location.pathname}-${refreshKey}`}
        className={isAnimating ? "page-transition-enter" : ""}
      >
        {renderContent()}
      </div>
    </Layout>
  );
}
