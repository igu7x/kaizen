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
import Pdtic from "./pages/Pdtic";
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
import ProcessoDetalhe from "./pages/ProcessoDetalhe";
import ValidarProcesso from "./pages/ValidarProcesso";
import PainelIndicadores from "./pages/PainelIndicadores";
import OkrsMetas from "./pages/OkrsMetas";
import CadastroHub from "./pages/CadastroHub";
import PdticAcoes from "./pages/PdticAcoes";
import PermissoesTap from "./pages/PermissoesTap";
import PermissoesProcessosTi from "./pages/PermissoesProcessosTi";
import SgsiPainel from "./pages/SgsiPainel";
import SgsiInstrumentos from "./pages/SgsiInstrumentos";
import SgsiInstrumentoDetalhe from "./pages/SgsiInstrumentoDetalhe";
import SgsiDocumentos from "./pages/SgsiDocumentos";
import SgsiIndicadores from "./pages/SgsiIndicadores";
import SgsiFrameworks from "./pages/SgsiFrameworks";
import SgsiRiscos from "./pages/SgsiRiscos";
import SgsiMatriz from "./pages/SgsiMatriz";
import SgsiEmissoes from "./pages/SgsiEmissoes";
import SgsiRelatorios from "./pages/SgsiRelatorios";
import SgsiAtas from "./pages/SgsiAtas";
import SgsiProcessos from "./pages/SgsiProcessos";
import SgsiConfiguracoes from "./pages/SgsiConfiguracoes";
import SgsiAuditoria from "./pages/SgsiAuditoria";
import SgsiLeitura from "./pages/SgsiLeitura";
import SgsiEventos from "./pages/SgsiEventos";
import SgsiAlertas from "./pages/SgsiAlertas";
import SgsiIntegracao from "./pages/SgsiIntegracao";
import SgsiSbom from "./pages/SgsiSbom";
import CadastroContratacoesTic from "./pages/CadastroContratacoesTic";
import Desenvolvimento from "./pages/Desenvolvimento";
import Perfil from "./pages/Perfil";
import EmDesenvolvimento from "./pages/EmDesenvolvimento";
import PacCapacitacao from "./pages/PacCapacitacao";
import PlanejamentoContratacao from "./pages/PlanejamentoContratacao";
import CicloOrcamentario from "./pages/CicloOrcamentario";
import FormacaoPca from "./pages/FormacaoPca";
import RevisaoPca from "./pages/RevisaoPca";
import ParametrosContratacoesTic from "./pages/ParametrosContratacoesTic";
import PermissoesAcoes from "./pages/PermissoesAcoes";
import RiscosContratacoes from "./pages/RiscosContratacoes";
import RiscosContratacoesDetalhe from "./pages/RiscosContratacoesDetalhe";
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
                        <EscritorioProcessos grupo="ti" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica/processos-apoio"
                    element={
                      <ProtectedRoute>
                        <EscritorioProcessos grupo="apoio_judiciario" />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica/pdtic"
                    element={
                      // Rota PÚBLICA (ver utils/publicRoutes.ts): acessível sem login.
                      // Anônimo abre em modo público (sem menu, botão Entrar no header);
                      // logado vê normalmente. Por isso NÃO passa pelo ProtectedRoute.
                      <Pdtic />
                    }
                  />
                  <Route
                    path="/seguranca-informacao/painel"
                    element={
                      <ProtectedRoute>
                        <SgsiPainel />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/instrumentos"
                    element={
                      <ProtectedRoute>
                        <SgsiInstrumentos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/instrumentos/:codigo"
                    element={
                      <ProtectedRoute>
                        <SgsiInstrumentoDetalhe />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/documentos"
                    element={
                      <ProtectedRoute>
                        <SgsiDocumentos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/indicadores"
                    element={
                      <ProtectedRoute>
                        <SgsiIndicadores />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/frameworks"
                    element={
                      <ProtectedRoute>
                        <SgsiFrameworks />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/riscos"
                    element={
                      <ProtectedRoute>
                        <SgsiRiscos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/emissoes"
                    element={
                      <ProtectedRoute>
                        <SgsiEmissoes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/relatorios"
                    element={
                      <ProtectedRoute>
                        <SgsiRelatorios />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/atas"
                    element={
                      <ProtectedRoute>
                        <SgsiAtas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/processos"
                    element={
                      <ProtectedRoute>
                        <SgsiProcessos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/matriz"
                    element={
                      <ProtectedRoute>
                        <SgsiMatriz />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/configuracoes"
                    element={
                      <ProtectedRoute>
                        <SgsiConfiguracoes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/auditoria"
                    element={
                      <ProtectedRoute>
                        <SgsiAuditoria />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/leitura"
                    element={
                      <ProtectedRoute>
                        <SgsiLeitura />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/eventos"
                    element={
                      <ProtectedRoute>
                        <SgsiEventos />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/alertas"
                    element={
                      <ProtectedRoute>
                        <SgsiAlertas />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/integracao"
                    element={
                      <ProtectedRoute>
                        <SgsiIntegracao />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/seguranca-informacao/sbom"
                    element={
                      <ProtectedRoute>
                        <SgsiSbom />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/gestao-estrategica/processos/:id"
                    element={
                      <ProtectedRoute>
                        <ProcessoDetalhe />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/validar-processo"
                    element={
                      <ProtectedRoute>
                        <ValidarProcesso />
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
                        <Navigate to="/pca" replace />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pca"
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
                    path="/planejamento-contratacao"
                    element={
                      <ProtectedRoute>
                        <PlanejamentoContratacao />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/planejamento-contratacao/riscos-contratacoes"
                    element={
                      <ProtectedRoute>
                        <RiscosContratacoes />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/planejamento-contratacao/riscos-contratacoes/:id"
                    element={
                      <ProtectedRoute>
                        <RiscosContratacoesDetalhe />
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
                    path="/ciclo-orcamentario/formacao"
                    element={
                      <ProtectedRoute>
                        <FormacaoPca />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/ciclo-orcamentario/revisao"
                    element={
                      <ProtectedRoute>
                        <RevisaoPca />
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
                    path="/permissoes"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <PermissoesAcoes />
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
                        <Navigate to="/pessoas/competencias" replace />
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
                    path="/pessoas/pac/tecnologia-da-informacao"
                    element={
                      <ProtectedRoute>
                        <PacCapacitacao
                          titulo="Plano Anual de Capacitação — Tecnologia da Informação"
                          modulo="ti"
                        />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/pessoas/pac/apoio-judiciario"
                    element={
                      <ProtectedRoute>
                        <EmDesenvolvimento titulo="Plano Anual de Capacitação — Apoio Judiciário" />
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
                    path="/cadastros/pdtic-acoes"
                    element={
                      <ProtectedRoute>
                        <PdticAcoes />
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
                    path="/cadastros/permissoes-processos-ti"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <PermissoesProcessosTi />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros/contratacoes-tic"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]}>
                        <CadastroContratacoesTic />
                      </ProtectedRoute>
                    }
                  />
                  <Route
                    path="/cadastros/contratacoes-tic/parametros"
                    element={
                      <ProtectedRoute allowedRoles={["ADMIN"]} requireSuperadmin={true}>
                        <ParametrosContratacoesTic />
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
