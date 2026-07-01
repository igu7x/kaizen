import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import { GestaoProvider } from "./contexts/GestaoContext";
import { DirectorateProvider } from "./contexts/DirectorateContext";
import { EstrategiaModeloProvider } from "./contexts/EstrategiaModeloContext";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { SessionRedirect } from "./components/auth/SessionRedirect";
import { isProduction } from "./utils/environment";
import Login from "./pages/Login";
import AuthCallback from "./pages/AuthCallback";
import Home from "./pages/Home";
import GestaoEstrategica from "./pages/GestaoEstrategica";
import Contratacoes from "./pages/Contratacoes";
import Cadastros from "./pages/Cadastros";
import PlanosProgramas from "./pages/PlanosProgramas";
import Areas from "./pages/Areas";
import Pessoas from "./pages/Pessoas";
import CadastroPessoasAreas from "./pages/CadastroPessoasAreas";
import PcaItemDetailsPage from "./pages/PcaItemDetailsPage";
import RenovacaoDetailsPage from "./pages/RenovacaoDetailsPage";
import ContratosTI from "./pages/ContratosTI";
import ContractDetails from "./pages/ContractDetails";
import Administracao from "./pages/Administracao";
import Placeholder from "./pages/Placeholder";
import Comites from "./pages/Comites";
import ComiteMonitoramento from "./pages/ComiteMonitoramento";
import SGJT from "./pages/SGJT";
import Gerenciamento from "./pages/Gerenciamento";
import Sprints from "./pages/Sprints";
import EscritorioProcessos from "./pages/EscritorioProcessos";
import PainelIndicadores from "./pages/PainelIndicadores";
import OkrsMetas from "./pages/OkrsMetas";
import CadastroHub from "./pages/CadastroHub";
import PermissoesTap from "./pages/PermissoesTap";
import Desenvolvimento from "./pages/Desenvolvimento";
import Perfil from "./pages/Perfil";
import Dfd from "./pages/Dfd";
import PlanejamentoContratacao from "./pages/PlanejamentoContratacao";
import CicloOrcamentario from "./pages/CicloOrcamentario";
import DfdConsulta from "./pages/DfdConsulta";
import { FormBuilder } from "./components/pessoas/FormBuilder";
import { FormFiller } from "./components/pessoas/FormFiller";
import { FormResponses } from "./components/pessoas/FormResponses";
import { Toaster } from "sonner";

function App() {
  return (
    <AuthProvider>
      <DirectorateProvider>
        <EstrategiaModeloProvider>
          <GestaoProvider>
            <BrowserRouter>
              <SessionRedirect>
                <Routes>
                  <Route path="/login" element={<Login />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Home />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica"
                    element={
                      <ProtectedRoute>
                        <Navigate to="/gestao-estrategica/okrs" replace />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica/okrs"
                    element={
                      <ProtectedRoute>
                        <GestaoEstrategica />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica/execucao"
                    element={
                      <ProtectedRoute>
                        <GestaoEstrategica />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica/sprints"
                    element={
                      <ProtectedRoute>
                        {isProduction() ? (
                          <Navigate to="/" replace />
                        ) : (
                          <Sprints />
                        )}
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica/processos"
                    element={
                      <ProtectedRoute>
                        <EscritorioProcessos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/painel-indicadores"
                    element={
                      <ProtectedRoute>
                        <PainelIndicadores />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratacoes-ti"
                    element={
                      <ProtectedRoute>
                        <Navigate to="/contratacoes-ti/novas" replace />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratacoes-ti/novas"
                    element={
                      <ProtectedRoute>
                        <Contratacoes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratacoes-ti/renovacoes"
                    element={
                      <ProtectedRoute>
                        <Contratacoes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratacoes-ti/item/:id"
                    element={
                      <ProtectedRoute>
                        <PcaItemDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratacoes-ti/renovacoes/item/:id"
                    element={
                      <ProtectedRoute>
                        <RenovacaoDetailsPage />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dfd"
                    element={
                      <ProtectedRoute>
                        <Dfd />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/planejamento-contratacao"
                    element={
                      <ProtectedRoute>
                        <PlanejamentoContratacao />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ciclo-orcamentario"
                    element={
                      <ProtectedRoute>
                        <CicloOrcamentario />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/dfd-consulta"
                    element={
                      <ProtectedRoute>
                        <DfdConsulta />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratos-ti"
                    element={
                      <ProtectedRoute>
                        <ContratosTI />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/contratos-ti/:id"
                    element={
                      <ProtectedRoute>
                        <ContractDetails />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/administracao"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <Administracao />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gerenciamento"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <Gerenciamento />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <CadastroHub />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/sgjt"
                    element={<Navigate to="/gerenciamento" replace />}
                  />
                  <Route
                    path="/pessoas"
                    element={
                      <ProtectedRoute>
                        <Navigate to="/pessoas/painel" replace />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/painel"
                    element={
                      <ProtectedRoute>
                        <Pessoas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/formularios"
                    element={
                      <ProtectedRoute>
                        <Pessoas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/competencias"
                    element={
                      <ProtectedRoute>
                        <Pessoas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/criar"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <FormBuilder />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/editar/:id"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <FormBuilder />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/responder/:id"
                    element={
                      <ProtectedRoute>
                        <FormFiller />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/respostas/:id"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <FormResponses />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/comites"
                    element={
                      <ProtectedRoute>
                        <Comites />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/comites/:sigla"
                    element={
                      <ProtectedRoute>
                        <ComiteMonitoramento />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/comites/:sigla/reuniao/:reuniaoId"
                    element={
                      <ProtectedRoute>
                        <ComiteMonitoramento />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros/projetos"
                    element={
                      <ProtectedRoute>
                        <Cadastros />
                      </ProtectedRoute>
                    }
                  />
                  {/* Compatibilidade com bookmarks antigos /contratos/* */}
                  <Route
                    path="/contratos"
                    element={<Navigate to="/cadastros/projetos" replace />}
                  />
                  <Route
                    path="/contratos/projetos"
                    element={<Navigate to="/cadastros/projetos" replace />}
                  />
                  <Route
                    path="/cadastros/planos-programas"
                    element={
                      <ProtectedRoute>
                        <PlanosProgramas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros/areas"
                    element={
                      <ProtectedRoute>
                        <Areas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros/pessoas"
                    element={
                      <ProtectedRoute>
                        <CadastroPessoasAreas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros/okrs-metas"
                    element={
                      <ProtectedRoute>
                        <OkrsMetas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros/permissoes-tap"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <PermissoesTap />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/desenvolvimento"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <Desenvolvimento />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/perfil"
                    element={
                      <ProtectedRoute>
                        <Perfil />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/proad-acervo"
                    element={
                      <ProtectedRoute>
                        <Placeholder title="PROAD - Acervo" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/financeira/*"
                    element={
                      <ProtectedRoute>
                        <Placeholder title="Diretoria Financeira" />
                      </ProtectedRoute>
                    }
                  />
                </Routes>
              </SessionRedirect>
            </BrowserRouter>
            <Toaster richColors position="bottom-right" />
          </GestaoProvider>
        </EstrategiaModeloProvider >
      </DirectorateProvider >
    </AuthProvider >
  );
}

export default App;
