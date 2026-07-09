import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Header } from "./Header";
import { Sidebar } from "./Sidebar";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { useAuth } from "@/contexts/AuthContext";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { devEnvironment, setDevEnvironment } = useDirectorate();
  const showDevBanner =
    !!user?.is_developer &&
    devEnvironment &&
    location.pathname !== "/desenvolvimento";
  const isHomePage = location.pathname === "/";
  const isOKRPage = location.pathname === "/gestao-estrategica/okrs";
  const isExecucaoPage = location.pathname === "/gestao-estrategica/execucao";
  const isSprintsPage = location.pathname === "/gestao-estrategica/sprints";
  const isProcessosPage = location.pathname === "/gestao-estrategica/processos";
  const isPainelIndicadoresPage = location.pathname === "/painel-indicadores";
  const isComitesPage = location.pathname === "/comites";
  const isComiteDetalhe = location.pathname.startsWith("/comites/");
  const isContratacoesPage = location.pathname.startsWith("/contratacoes-ti") || location.pathname.startsWith("/pca");
  const isCompetenciasPage = location.pathname.includes("/competencias");
  const isPainelPessoas =
    location.pathname === "/pessoas" || location.pathname === "/pessoas/painel";
  const isPerfilPage = location.pathname === "/perfil";
  // Módulos de administração (fundo branco como nas páginas principais).
  // /contratos/* é caminho legado e redireciona para /cadastros/* (App.tsx); a flag
  // isContratosPage permanece só para que o fundo branco se aplique enquanto a
  // navegação acontece, durante o redirect.
  const isAdministracaoPage = location.pathname.startsWith("/administracao");
  const isCadastrosPage = location.pathname.startsWith("/cadastros");
  const isContratosPage = location.pathname.startsWith("/contratos");
  const isGerenciamentoPage = location.pathname.startsWith("/gerenciamento");
  const isCicloOrcamentarioPage = location.pathname.startsWith(
    "/ciclo-orcamentario",
  );

  const isPermissoesPage = location.pathname.startsWith("/permissoes");

  // Páginas com fundo branco (Home, OKRs, Execução, Sprints, Comitês, Contratações, Competências,
  // Painel de Pessoas, Perfil e módulos de administração)
  const isWhiteBgPage =
    isHomePage ||
    isOKRPage ||
    isExecucaoPage ||
    isSprintsPage ||
    isProcessosPage ||
    isPainelIndicadoresPage ||
    isComitesPage ||
    isComiteDetalhe ||
    isContratacoesPage ||
    isCompetenciasPage ||
    isPainelPessoas ||
    isPerfilPage ||
    isAdministracaoPage ||
    isCadastrosPage ||
    isContratosPage ||
    isGerenciamentoPage ||
    isCicloOrcamentarioPage ||
    isPermissoesPage;
  // Páginas sem padding (apenas comitês)
  const isNoPaddingPage = isComitesPage || isComiteDetalhe;

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <Header onMenuToggle={() => setSidebarOpen(!sidebarOpen)} />
      <div
        className={`flex flex-1 overflow-hidden ${isWhiteBgPage ? "bg-white" : "bg-[#0a2351]"}`}
      >
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <main
          className={`flex-1 overflow-auto transition-colors duration-300 ${isNoPaddingPage ? "p-0" : "p-4 lg:p-6 xl:p-8 2xl:p-10"} ${isWhiteBgPage ? "page-bg-white" : "page-bg-blue"}`}
        >
          {showDevBanner && (
            <div className="fixed top-[85px] left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 bg-violet-600 rounded-b-xl px-4 py-1.5 shadow-lg shadow-violet-600/30">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                <span className="text-xs font-semibold text-white">
                  {devEnvironment}
                </span>
              </div>
              <button
                onClick={() => {
                  setDevEnvironment(null);
                  navigate("/desenvolvimento");
                }}
                className="text-[11px] font-medium text-white/80 hover:text-white bg-white/15 hover:bg-white/25 px-2 py-0.5 rounded-md transition-colors"
              >
                Sair
              </button>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
