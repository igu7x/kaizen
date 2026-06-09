import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, BookOpen, Users, UserCog, Eye, ClipboardCheck, UserCheck, Scale, GitCompare, ShieldAlert } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { areasApi } from '@/services/areasApi';
import { FormularioCompetencias, competenciasGestorApi } from '@/services/competenciasGestorApi';
import { AutoavaliacaoFormulario, autoavaliacaoApi } from '@/services/autoavaliacaoApi';
import { AvaliacaoGestorFormulario, avaliacaoGestorApi } from '@/services/avaliacaoGestorApi';
import { AvaliacaoIntegradaFormulario, avaliacaoIntegradaApi } from '@/services/avaliacaoIntegradaApi';
import { CompetenciasEquipeForm } from './CompetenciasEquipeForm';
import { CompetenciasGestorForm } from './CompetenciasGestorForm';
import { CompetenciasGestorResumo } from './CompetenciasGestorResumo';
import { CompetenciasGestorRespostas } from './CompetenciasGestorRespostas';
import { AutoavaliacaoForm } from './AutoavaliacaoForm';
import { AutoavaliacaoResumo } from './AutoavaliacaoResumo';
import { AutoavaliacaoRespostas } from './AutoavaliacaoRespostas';
import { AvaliacaoGestorForm } from './AvaliacaoGestorForm';
import { AvaliacaoGestorResumo } from './AvaliacaoGestorResumo';
import { AvaliacaoGestorRespostas } from './AvaliacaoGestorRespostas';
import { AvaliacaoIntegradaForm } from './AvaliacaoIntegradaForm';
import { AvaliacaoIntegradaResumo } from './AvaliacaoIntegradaResumo';
import { AvaliacaoIntegradaRespostas } from './AvaliacaoIntegradaRespostas';
import { CompetenciasPadraoAdmin } from './CompetenciasPadraoAdmin';
import { CompetenciasTecnicasAdmin } from './CompetenciasTecnicasAdmin';
import { CompetenciasPadraoView } from './CompetenciasPadraoView';
import { isCompetenciasPadraoEnabled } from '@/utils/environment';
import { Settings, Wrench } from 'lucide-react';

type View =
  | 'inventario'
  | 'referencial_home' | 'inventario_home'
  | 'inventario_equipe_home' | 'inventario_gestor_home'
  | 'equipe' | 'equipe_resumo' | 'equipe_respostas' | 'equipe_edit'
  | 'gestor' | 'gestor_resumo' | 'gestor_respostas' | 'gestor_edit'
  | 'autoavaliacao' | 'autoavaliacao_resumo' | 'autoavaliacao_respostas'
  | 'avgestor' | 'avgestor_resumo' | 'avgestor_respostas'
  | 'integrada' | 'integrada_resumo' | 'integrada_respostas'
  | 'inv_gestor_auto' | 'inv_gestor_auto_resumo' | 'inv_gestor_auto_respostas'
  | 'inv_gestor_lideranca' | 'inv_gestor_lideranca_resumo' | 'inv_gestor_lideranca_respostas'
  | 'inv_gestor_integrada' | 'inv_gestor_integrada_resumo' | 'inv_gestor_integrada_respostas'
  | 'competencias_padrao_admin' | 'competencias_tecnicas_admin'
  | 'competencias_padrao_view';

export function GestaoCompetencias() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<View>('inventario');
  const [formularioResumo, setFormularioResumo] = useState<FormularioCompetencias | null>(null);
  const [formularioEdit, setFormularioEdit] = useState<FormularioCompetencias | null>(null);
  const [editFromResumo, setEditFromResumo] = useState(false);
  const [autoavaliacaoResumo, setAutoavaliacaoResumo] = useState<AutoavaliacaoFormulario | null>(null);
  const [autoavaliacaoEditMode, setAutoavaliacaoEditMode] = useState(false);
  const [avGestorResumo, setAvGestorResumo] = useState<AvaliacaoGestorFormulario | null>(null);
  const [avGestorEdit, setAvGestorEdit] = useState<AvaliacaoGestorFormulario | null>(null);
  const [integradaResumo, setIntegradaResumo] = useState<AvaliacaoIntegradaFormulario | null>(null);
  const [integradaEdit, setIntegradaEdit] = useState<AvaliacaoIntegradaFormulario | null>(null);
  const [diretoriaUsuario, setDiretoriaUsuario] = useState('');
  const [isDomainRoot, setIsDomainRoot] = useState(false);
  const [referencialAutorizado, setReferencialAutorizado] = useState<boolean | null>(null);
  const [isGestorDeUnidade, setIsGestorDeUnidade] = useState(false);
  const [integradaPendentes, setIntegradaPendentes] = useState<AvaliacaoIntegradaFormulario[]>([]);
  const [temUnidadeColaborador, setTemUnidadeColaborador] = useState(false);
  const [temElegiveisEquipe, setTemElegiveisEquipe] = useState(false);
  const [temElegiveisGestor, setTemElegiveisGestor] = useState(false);
  const [temNovosElegiveisEquipe, setTemNovosElegiveisEquipe] = useState(false);
  const [temNovosElegiveisGestor, setTemNovosElegiveisGestor] = useState(false);
  const [temAvgestorEquipe, setTemAvgestorEquipe] = useState(false);
  const [temAvgestorGestor, setTemAvgestorGestor] = useState(false);
  const [ehGestorOuSubdiretorMacro, setEhGestorOuSubdiretorMacro] = useState(false);
  const [temReferencialGerenciavel, setTemReferencialGerenciavel] = useState(false);

  // Verificar se há elegíveis para avaliação integrada (1 chamada ao backend)
  const checkElegiveis = async () => {
    try {
      const result = await avaliacaoIntegradaApi.temElegiveis();
      setTemElegiveisEquipe(result.equipe);
      setTemElegiveisGestor(result.gestor);
      setTemNovosElegiveisEquipe(result.equipeElegiveis);
      setTemNovosElegiveisGestor(result.gestorElegiveis);
      setTemAvgestorEquipe(result.avgestorEquipe);
      setTemAvgestorGestor(result.avgestorGestor);
    } catch {
      setTemElegiveisEquipe(false);
      setTemElegiveisGestor(false);
      setTemNovosElegiveisEquipe(false);
      setTemNovosElegiveisGestor(false);
      setTemAvgestorEquipe(false);
      setTemAvgestorGestor(false);
    }
  };

  // Re-verificar elegíveis quando voltar para os homes
  useEffect(() => {
    if (currentView === 'inventario_equipe_home' || currentView === 'inventario_gestor_home') {
      checkElegiveis();
    }
  }, [currentView]);

  // Deep-link: ao montar, lê query params na URL pra abrir direto a tela de resumo
  // específica (vindo da Home / Pendências). Sem esses params o componente segue o
  // fluxo padrão. Suporta:
  //   ?integradaId=X[&tipo=equipe|gestor]   → integrada (resumo)
  //   ?matrizId=X[&tipo=equipe|gestor]      → matriz de competências (resumo)
  //   ?autoavaliacaoId=X                    → autoavaliação (resumo)
  //   ?avgestorId=X                         → avaliação do gestor (resumo)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const integradaIdRaw = params.get('integradaId');
    const matrizIdRaw = params.get('matrizId');
    const autoavaliacaoIdRaw = params.get('autoavaliacaoId');
    const avgestorIdRaw = params.get('avgestorId');
    const tipoRaw = params.get('tipo');
    if (!integradaIdRaw && !matrizIdRaw && !autoavaliacaoIdRaw && !avgestorIdRaw) return;

    let cancelled = false;
    const clearParams = () => {
      const url = new URL(window.location.href);
      ['integradaId', 'matrizId', 'autoavaliacaoId', 'avgestorId', 'tipo'].forEach(p => url.searchParams.delete(p));
      window.history.replaceState({}, '', url.toString());
    };

    (async () => {
      try {
        // Avaliação Integrada
        if (integradaIdRaw) {
          const id = Number(integradaIdRaw);
          if (!Number.isFinite(id)) return;
          const tipo = (tipoRaw === 'gestor' ? 'gestor' : 'equipe') as 'equipe' | 'gestor';
          const form = await avaliacaoIntegradaApi.getById(id);
          if (cancelled || !form) return;
          setIntegradaResumo(form);
          setCurrentView(tipo === 'gestor' ? 'inv_gestor_integrada_resumo' : 'integrada_resumo');
          clearParams();
          return;
        }

        // Matriz de Competências
        if (matrizIdRaw) {
          const id = Number(matrizIdRaw);
          if (!Number.isFinite(id)) return;
          const form = await competenciasGestorApi.getById(id);
          if (cancelled || !form) return;
          // O `tipo` retornado pelo backend (equipe|gestor) também vem na URL
          // como fallback, mas o que vale é o do próprio formulário.
          const tipoForm = (form as any).tipo === 'gestor' ? 'gestor' : 'equipe';
          setFormularioResumo(form);
          setCurrentView(tipoForm === 'gestor' ? 'gestor_resumo' : 'equipe_resumo');
          clearParams();
          return;
        }

        // Autoavaliação
        if (autoavaliacaoIdRaw) {
          const id = Number(autoavaliacaoIdRaw);
          if (!Number.isFinite(id)) return;
          const form = await autoavaliacaoApi.getById(id);
          if (cancelled || !form) return;
          setAutoavaliacaoResumo(form);
          setCurrentView('autoavaliacao_resumo');
          clearParams();
          return;
        }

        // Avaliação do Gestor
        if (avgestorIdRaw) {
          const id = Number(avgestorIdRaw);
          if (!Number.isFinite(id)) return;
          const form = await avaliacaoGestorApi.getById(id);
          if (cancelled || !form) return;
          setAvGestorResumo(form);
          setCurrentView('avgestor_resumo');
          clearParams();
          return;
        }
      } catch (err) {
        console.warn('[GestaoCompetencias] Falha no deep-link:', err);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Buscar diretoria real do usuário (via cadastros_areas, fonte confiável)
  useEffect(() => {
    const load = async () => {
      try {
        const allAreas = await areasApi.getAll();
        // Usar user.diretoria para encontrar a área correta do usuário
        const userArea = allAreas.find(a => a.sigla === user?.diretoria)
          || allAreas.find(a => a.is_domain_root === true)
          || allAreas[0];
        const sigla = userArea?.sigla || userArea?.nome || '';
        setDiretoriaUsuario(sigla);
        setIsDomainRoot(!!userArea?.is_domain_root || (user as any)?.is_superadmin === true);

        // SUPERADMIN tem acesso total ao Referencial
        if ((user as any)?.is_superadmin === true) {
          setReferencialAutorizado(true);
        } else {
          const { autorizado } = await competenciasGestorApi.verificarAcesso();
          setReferencialAutorizado(autorizado);
        }

        // Detectar se é gestor de alguma unidade (responsavel_user_id) — pode preencher Avaliação do Gestor / Integrada
        try {
          const { ehGestor } = await competenciasGestorApi.ehGestorUnidade();
          setIsGestorDeUnidade(ehGestor);
        } catch {
          setIsGestorDeUnidade(false);
        }

        // Detectar se está cadastrado como colaborador em uma unidade NÃO-macroárea
        try {
          const { ehColaborador } = await competenciasGestorApi.ehColaboradorEquipe();
          setTemUnidadeColaborador(ehColaborador);
        } catch {
          setTemUnidadeColaborador(false);
        }

        // Detectar se é gestor ou sub-diretor de alguma macroárea
        try {
          const allAreas = await areasApi.getAll();
          const userIdNum = user?.id ? Number(user.id) : 0;
          const ehMacro = allAreas.some(a =>
            Number(a.gestor_user_id || 0) === userIdNum ||
            Number((a as any).subdiretor_user_id || 0) === userIdNum
          );
          setEhGestorOuSubdiretorMacro(ehMacro);
        } catch {
          setEhGestorOuSubdiretorMacro(false);
        }

        // Verificar se tem algum referencial gerenciável (para mostrar o card de gerenciar técnicas)
        try {
          const gerenciaveis = await competenciasGestorApi.listarUnidadesGerenciaveis();
          setTemReferencialGerenciavel(gerenciaveis.length > 0);
        } catch {
          setTemReferencialGerenciavel(false);
        }

        // Verificar elegíveis
        await checkElegiveis();

        // Carregar avaliações integradas pendentes de validação do colaborador
        try {
          const pendentes = await avaliacaoIntegradaApi.getPendentesColaborador();
          setIntegradaPendentes(pendentes);
        } catch {
          setIntegradaPendentes([]);
        }
      } catch {
        setReferencialAutorizado(false);
      }
    };
    load();
  }, []);

  const isAdminOrManager = user?.role === 'ADMIN' || user?.role === 'MANAGER';
  const isSGJT = (user as any)?.is_superadmin === true;
  const isSGJTAdmin = isSGJT && user?.role === 'ADMIN';

  // Avaliadores da Liderança = gestores e subdiretores de macroárea
  // (definido dinamicamente por cadastros_areas.gestor_user_id / subdiretor_user_id — ver ehGestorOuSubdiretorMacro acima)
  const currentUserId = user?.id ? parseInt(String(user.id)) : undefined;
  const isAvaliadorLideranca = ehGestorOuSubdiretorMacro;

  // ── Matriz de Competências da Equipe ──────────────────────────────────

  if (currentView === 'equipe') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('referencial_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Matriz de Competências da Equipe</h2>
        </div>
        <CompetenciasEquipeForm
          onSubmitted={(formulario) => {
            setFormularioResumo(formulario);
            setCurrentView('equipe_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'equipe_resumo' && formularioResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('referencial_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Matriz de Competências da Equipe</h2>
        </div>
        <CompetenciasGestorResumo
          formulario={formularioResumo}
          onValidated={(f) => setFormularioResumo(f)}
          onEdit={(f) => { setFormularioEdit(f); setEditFromResumo(true); setCurrentView('equipe_edit'); }}
        />
      </div>
    );
  }

  if (currentView === 'equipe_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('referencial_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Matriz de Competências da Equipe</h2>
        </div>
        <CompetenciasGestorRespostas
          tipo="equipe"
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          onViewFormulario={(f) => {
            setFormularioResumo(f);
            setCurrentView('equipe_resumo');
          }}
          onEditFormulario={(f) => {
            setFormularioEdit(f);
            setCurrentView('equipe_edit');
          }}
        />
      </div>
    );
  }

  if (currentView === 'equipe_edit' && formularioEdit) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setEditFromResumo(false); setCurrentView(editFromResumo ? 'equipe_resumo' : 'equipe_respostas'); }} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Editar — Matriz de Competências da Equipe</h2>
        </div>
        <CompetenciasEquipeForm
          editFormulario={formularioEdit}
          validationMode={!editFromResumo && formularioEdit.status === 'enviado'}
          onSubmitted={(formulario) => {
            setEditFromResumo(false);
            setFormularioResumo(formulario);
            setCurrentView('equipe_resumo');
          }}
        />
      </div>
    );
  }

  // ── Matriz de Competências do Gestor ──────────────────────────────────

  if (currentView === 'gestor') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('referencial_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Matriz de Competências do Gestor</h2>
        </div>
        <CompetenciasGestorForm
          onSubmitted={(formulario) => {
            setFormularioResumo(formulario);
            setCurrentView('gestor_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'gestor_resumo' && formularioResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('referencial_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Matriz de Competências do Gestor</h2>
        </div>
        <CompetenciasGestorResumo
          formulario={formularioResumo}
          onValidated={(f) => setFormularioResumo(f)}
          onEdit={(f) => { setFormularioEdit(f); setEditFromResumo(true); setCurrentView('gestor_edit'); }}
        />
      </div>
    );
  }

  if (currentView === 'gestor_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('referencial_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Matriz de Competências do Gestor</h2>
        </div>
        <CompetenciasGestorRespostas
          tipo="gestor"
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          onViewFormulario={(f) => {
            setFormularioResumo(f);
            setCurrentView('gestor_resumo');
          }}
          onEditFormulario={(f) => {
            setFormularioEdit(f);
            setCurrentView('gestor_edit');
          }}
        />
      </div>
    );
  }

  if (currentView === 'gestor_edit' && formularioEdit) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => { setEditFromResumo(false); setCurrentView(editFromResumo ? 'gestor_resumo' : 'gestor_respostas'); }} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Editar — Matriz de Competências do Gestor</h2>
        </div>
        <CompetenciasGestorForm
          editFormulario={formularioEdit}
          validationMode={!editFromResumo && formularioEdit.status === 'enviado'}
          onSubmitted={(formulario) => {
            setEditFromResumo(false);
            setFormularioResumo(formulario);
            setCurrentView('gestor_resumo');
          }}
        />
      </div>
    );
  }

  // ── Autoavaliação do Colaborador ──────────────────────────────

  if (currentView === 'autoavaliacao') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Autoavaliação do Colaborador</h2>
        </div>
        <AutoavaliacaoForm
          editMode={autoavaliacaoEditMode}
          onSubmitted={(formulario) => {
            setAutoavaliacaoEditMode(false);
            setAutoavaliacaoResumo(formulario);
            setCurrentView('autoavaliacao_resumo');
          }}
          onViewResposta={(formulario) => {
            setAutoavaliacaoResumo(formulario);
            setCurrentView('autoavaliacao_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'autoavaliacao_resumo' && autoavaliacaoResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Autoavaliação do Colaborador</h2>
        </div>
        <AutoavaliacaoResumo formulario={autoavaliacaoResumo} onValidated={(f) => setAutoavaliacaoResumo(f)} onEdit={() => { setAutoavaliacaoEditMode(true); setCurrentView('autoavaliacao'); }} currentUserId={currentUserId} />
      </div>
    );
  }

  if (currentView === 'autoavaliacao_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Autoavaliação do Colaborador</h2>
        </div>
        <AutoavaliacaoRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="equipe"
          onViewFormulario={(f) => {
            setAutoavaliacaoResumo(f);
            setCurrentView('autoavaliacao_resumo');
          }}
        />
      </div>
    );
  }

  // ── Avaliação do Gestor ──────────────────────────────────

  if (currentView === 'avgestor') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação do Gestor</h2>
        </div>
        <AvaliacaoGestorForm
          formularioEdit={avGestorEdit || undefined}
          onSubmitted={(formulario) => {
            setAvGestorEdit(null);
            setAvGestorResumo(formulario);
            setCurrentView('avgestor_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'avgestor_resumo' && avGestorResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação do Gestor</h2>
        </div>
        <AvaliacaoGestorResumo formulario={avGestorResumo} onValidated={(f) => setAvGestorResumo(f)} onEdit={() => { setAvGestorEdit(avGestorResumo); setCurrentView('avgestor'); }} currentUserId={currentUserId} />
      </div>
    );
  }

  if (currentView === 'avgestor_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Avaliação do Gestor</h2>
        </div>
        <AvaliacaoGestorRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="equipe"
          onViewFormulario={(f) => {
            setAvGestorResumo(f);
            setCurrentView('avgestor_resumo');
          }}
        />
      </div>
    );
  }

  // ── Avaliação Integrada ──────────────────────────────────

  if (currentView === 'integrada') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação Integrada</h2>
        </div>
        <AvaliacaoIntegradaForm
          formularioEdit={integradaEdit || undefined}
          onSubmitted={(formulario) => {
            setIntegradaEdit(null);
            setIntegradaResumo(formulario);
            setCurrentView('integrada_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'integrada_resumo' && integradaResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação Integrada</h2>
        </div>
        <AvaliacaoIntegradaResumo formulario={integradaResumo} onValidated={(f) => {
          setIntegradaResumo(f);
          setIntegradaPendentes(prev => prev.map(p => p.id === f.id ? f : p));
        }} onEdit={(f) => { setIntegradaEdit(f); setCurrentView('integrada'); }} currentUserId={currentUserId} />
      </div>
    );
  }

  if (currentView === 'integrada_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_equipe_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Avaliação Integrada</h2>
        </div>
        <AvaliacaoIntegradaRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="equipe"
          onViewFormulario={(f) => {
            setIntegradaResumo(f);
            setCurrentView('integrada_resumo');
          }}
        />
      </div>
    );
  }

  // ── Autoavaliação do Gestor (Inventário Gestor) ──────────────
  if (currentView === 'inv_gestor_auto') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Autoavaliação do Gestor</h2>
        </div>
        <AutoavaliacaoForm
          tipoInventario="gestor"
          editMode={autoavaliacaoEditMode}
          onSubmitted={(formulario) => {
            setAutoavaliacaoEditMode(false);
            setAutoavaliacaoResumo(formulario);
            setCurrentView('inv_gestor_auto_resumo');
          }}
          onViewResposta={(formulario) => {
            setAutoavaliacaoResumo(formulario);
            setCurrentView('inv_gestor_auto_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'inv_gestor_auto_resumo' && autoavaliacaoResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Autoavaliação do Gestor</h2>
        </div>
        <AutoavaliacaoResumo formulario={autoavaliacaoResumo} onValidated={(f) => setAutoavaliacaoResumo(f)} onEdit={() => { setAutoavaliacaoEditMode(true); setCurrentView('inv_gestor_auto'); }} currentUserId={currentUserId} />
      </div>
    );
  }

  if (currentView === 'inv_gestor_auto_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Autoavaliação do Gestor</h2>
        </div>
        <AutoavaliacaoRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="gestor"
          onViewFormulario={(f) => {
            setAutoavaliacaoResumo(f);
            setCurrentView('inv_gestor_auto_resumo');
          }}
        />
      </div>
    );
  }

  // ── Avaliação da Liderança (Inventário Gestor) ──────────────
  if (currentView === 'inv_gestor_lideranca') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação da Liderança</h2>
        </div>
        <AvaliacaoGestorForm
          tipoInventario="gestor"
          formularioEdit={avGestorEdit || undefined}
          onSubmitted={(formulario) => {
            setAvGestorEdit(null);
            setAvGestorResumo(formulario);
            setCurrentView('inv_gestor_lideranca_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'inv_gestor_lideranca_resumo' && avGestorResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação da Liderança</h2>
        </div>
        <AvaliacaoGestorResumo formulario={avGestorResumo} onValidated={(f) => setAvGestorResumo(f)} onEdit={() => { setAvGestorEdit(avGestorResumo); setCurrentView('inv_gestor_lideranca'); }} currentUserId={currentUserId} />
      </div>
    );
  }

  if (currentView === 'inv_gestor_lideranca_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Avaliação da Liderança</h2>
        </div>
        <AvaliacaoGestorRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="gestor"
          onViewFormulario={(f) => {
            setAvGestorResumo(f);
            setCurrentView('inv_gestor_lideranca_resumo');
          }}
        />
      </div>
    );
  }

  // ── Avaliação Integrada do Gestor (Inventário Gestor) ──────────
  if (currentView === 'inv_gestor_integrada') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação Integrada</h2>
        </div>
        <AvaliacaoIntegradaForm
          tipoInventario="gestor"
          formularioEdit={integradaEdit || undefined}
          onSubmitted={(formulario) => {
            setIntegradaEdit(null);
            setIntegradaResumo(formulario);
            setCurrentView('inv_gestor_integrada_resumo');
          }}
        />
      </div>
    );
  }

  if (currentView === 'inv_gestor_integrada_resumo' && integradaResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Avaliação Integrada</h2>
        </div>
        <AvaliacaoIntegradaResumo formulario={integradaResumo} onValidated={(f) => {
          setIntegradaResumo(f);
          setIntegradaPendentes(prev => prev.map(p => p.id === f.id ? f : p));
        }} onEdit={(f) => { setIntegradaEdit(f); setCurrentView('inv_gestor_integrada'); }} tipoInventario="gestor" currentUserId={currentUserId} />
      </div>
    );
  }

  if (currentView === 'inv_gestor_integrada_respostas') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_gestor_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Respostas — Avaliação Integrada</h2>
        </div>
        <AvaliacaoIntegradaRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="gestor"
          onViewFormulario={(f) => {
            setIntegradaResumo(f);
            setCurrentView('inv_gestor_integrada_resumo');
          }}
        />
      </div>
    );
  }

  // ── Matriz de Competências (sub-página) ─────────────────
  if (currentView === 'referencial_home') {
    // Acesso negado para usuários não autorizados (exceto SGJT)
    if (!isSGJT && referencialAutorizado === false) {
      return (
        <div className="p-6 space-y-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario')} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
              <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
            </Button>
            <h2 className="text-2xl font-bold text-gray-900">Matriz de Competências</h2>
          </div>
          <Card className="border border-red-200 bg-red-50">
            <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
                <ShieldAlert className="h-8 w-8 text-red-500" />
              </div>
              <h3 className="text-xl font-bold text-red-700">Acesso Negado</h3>
              <p className="text-red-600 max-w-md">
                Você não possui autorização para acessar o Matriz de Competências.
                Entre em contato com a SGJT caso acredite que deveria ter acesso.
              </p>
            </CardContent>
          </Card>
        </div>
      );
    }

    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario')} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Matriz de Competências</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Matriz de Competências da Equipe */}
          <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('equipe')}>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center group-hover:bg-emerald-200 transition-colors">
                  <Users className="h-6 w-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                    Matriz de Competências da Equipe
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Mapeamento de competências dos colaboradores</p>
                </div>
              </div>
              {(isAdminOrManager || isSGJT) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('equipe_respostas'); }}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all ml-16 border border-transparent hover:border-blue-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              )}
            </CardContent>
          </Card>

          {/* Matriz de Competências do Gestor — gestor/sub-diretor da macroárea, SGJT ou avaliador da liderança podem preencher */}
          {(isSGJT || isAvaliadorLideranca || ehGestorOuSubdiretorMacro) && <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('gestor')}>
            <CardContent className="p-6 space-y-3">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-100 flex items-center justify-center group-hover:bg-violet-200 transition-colors">
                  <UserCog className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                    Matriz de Competências do Gestor
                  </h3>
                  <p className="text-sm text-gray-500 mt-0.5">Mapeamento de competências dos gestores</p>
                </div>
              </div>
              {(isAdminOrManager || isSGJT) && (
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('gestor_respostas'); }}
                  className="flex items-center gap-2 text-sm text-violet-600 hover:text-violet-800 hover:bg-violet-50 px-3 py-1.5 rounded-lg transition-all ml-16 border border-transparent hover:border-violet-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              )}
            </CardContent>
          </Card>}

          {/* Gerenciar Competências Técnicas (versionamento/edição) — dev/staging only, só com referenciais preenchidos */}
          {temReferencialGerenciavel && isCompetenciasPadraoEnabled() && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-orange-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('competencias_tecnicas_admin')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                    <Wrench className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg group-hover:text-orange-600 transition-colors">
                      Gerenciar Competências Técnicas
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Editar competências técnicas das suas unidades</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Visualizar Competências Padrão — disponível para gestores e diretores. Read-only.
              Diretor/subdiretor da macroárea pode alternar entre padrão da equipe (comportamentais)
              e padrão do gestor (comportamentais + estratégicas + gerenciais). */}
          {(isGestorDeUnidade || ehGestorOuSubdiretorMacro || isSGJT) && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('competencias_padrao_view')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                    <BookOpen className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-lg group-hover:text-blue-600 transition-colors">
                      Visualizar Competências Padrão
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      {ehGestorOuSubdiretorMacro
                        ? 'Catálogo dos formulários de equipe e gestor'
                        : 'Catálogo do formulário da equipe'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── Visualizar Competências Padrão (read-only) ─────────────────
  if (currentView === 'competencias_padrao_view') {
    return (
      <CompetenciasPadraoView
        podeAlternarTipo={ehGestorOuSubdiretorMacro}
        onVoltar={() => setCurrentView('referencial_home')}
      />
    );
  }

  // ── Inventário de Competências — HOME (2 cards) ─────────────────
  if (currentView === 'inventario_home') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario')} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Inventário de Competências</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {(() => {
            // Mostra "Matriz de Competências da Equipe" apenas se:
            // - Está cadastrado como colaborador em alguma unidade (pode preencher autoavaliação)
            // - É gestor de alguma unidade (pode preencher avaliação do gestor / integrada)
            // - É admin SGJT (visualiza tudo)
            // - Tem alguma avaliação integrada tipo='equipe' pendente para validar
            const temIntegradaEquipePendente = integradaPendentes.some(p => (p.tipo_inventario || 'equipe') === 'equipe');
            return temUnidadeColaborador || isGestorDeUnidade || isSGJTAdmin || temIntegradaEquipePendente;
          })() && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inventario_equipe_home')}>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                  <Users className="h-6 w-6 text-teal-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                    Inventário de Competências da Equipe
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Inventário de competências técnicas e comportamentais.</p>
                </div>
              </CardContent>
            </Card>
          )}

          {(() => {
            // Mostra "Matriz de Competências do Gestor" apenas se:
            // - É avaliador da liderança (preenche para outros gestores)
            // - É admin SGJT (visualiza tudo)
            // - Tem alguma avaliação integrada tipo='gestor' pendente para validar
            const temIntegradaGestorPendente = integradaPendentes.some(p => (p.tipo_inventario || 'equipe') === 'gestor');
            return isAvaliadorLideranca || isSGJTAdmin || isGestorDeUnidade || temIntegradaGestorPendente;
          })() && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inventario_gestor_home')}>
              <CardContent className="p-6 flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                  <UserCog className="h-6 w-6 text-violet-600" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                    Inventário de Competências do Gestor
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">Inventário de competências técnicas, comportamentais, estratégicas e gerenciais.</p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── Inventário → Matriz de Competências da Equipe (3 cards) ──────────────
  if (currentView === 'inventario_equipe_home') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_home')} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Inventário de Competências da Equipe</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Autoavaliação do Colaborador — apenas viewers (e admins/managers colaboradores de unidade que NÃO sejam gestor de unidade nem avaliador da liderança); SGJT admins têm card próprio */}
          {(!isAdminOrManager || (temUnidadeColaborador && !isSGJTAdmin)) && !isGestorDeUnidade && !isAvaliadorLideranca && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('autoavaliacao')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                    <ClipboardCheck className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Autoavaliação do Colaborador
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre sua autoavaliação das competências para a sua função.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {isSGJTAdmin && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('autoavaliacao_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                    <ClipboardCheck className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Autoavaliação do Colaborador
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre sua autoavaliação das competências para a sua função.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}

          {/* Avaliação Integrada — colaborador visualiza/valida quando o gestor já validou (apenas tipo equipe) */}
          {(() => {
            const integradaPendentesEquipe = integradaPendentes.filter(p => (p.tipo_inventario || 'equipe') === 'equipe');
            return integradaPendentesEquipe.length > 0 && !isGestorDeUnidade;
          })() && (() => {
            const integradaPendentesEquipe = integradaPendentes.filter(p => (p.tipo_inventario || 'equipe') === 'equipe');
            const pendentes = integradaPendentesEquipe.filter(p => !p.validado_colaborador_em);
            const todasValidadas = pendentes.length === 0;
            return (
              <Card className={`shadow-sm hover:shadow-md transition-all group cursor-pointer ${
                todasValidadas
                  ? 'bg-emerald-50 border border-emerald-300 hover:border-emerald-500'
                  : 'bg-violet-50 border border-violet-300 hover:border-violet-500'
              }`} onClick={async () => {
                const target = pendentes[0] || integradaPendentesEquipe[0];
                try {
                  const fullForm = await avaliacaoIntegradaApi.getById(target.id);
                  setIntegradaResumo(fullForm);
                  setCurrentView('integrada_resumo');
                } catch {
                  setIntegradaResumo(target);
                  setCurrentView('integrada_resumo');
                }
              }}>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      todasValidadas
                        ? 'bg-emerald-100 group-hover:bg-emerald-200'
                        : 'bg-violet-100 group-hover:bg-violet-200'
                    }`}>
                      <Scale className={`h-5 w-5 ${todasValidadas ? 'text-emerald-700' : 'text-violet-700'}`} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg transition-colors ${
                        todasValidadas
                          ? 'text-gray-800 group-hover:text-emerald-700'
                          : 'text-gray-800 group-hover:text-violet-700'
                      }`}>
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {todasValidadas
                          ? `Validada — ${integradaPendentesEquipe.length} avaliação${integradaPendentesEquipe.length > 1 ? 'ões' : ''} concluída${integradaPendentesEquipe.length > 1 ? 's' : ''}.`
                          : `Você tem ${pendentes.length} avaliação${pendentes.length > 1 ? 'ões' : ''} aguardando sua validação.`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Avaliação do Gestor — só aparece quando há autoavaliações validadas ou já preenchidas */}
          {isGestorDeUnidade && temAvgestorEquipe && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('avgestor')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <UserCheck className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação do Gestor
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre as avaliações de competências dos colaboradores sob sua gestão.</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('avgestor_respostas'); }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {isSGJTAdmin && !isGestorDeUnidade && temAvgestorEquipe && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('avgestor_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <UserCheck className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação do Gestor
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre as avaliações de competências dos colaboradores sob sua gestão.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}

          {/* Avaliação Integrada — visualizar respostas quando já preenchida (sem novos elegíveis) */}
          {isGestorDeUnidade && temElegiveisEquipe && !temNovosElegiveisEquipe && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('integrada_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Avaliação de Consenso.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}

          {/* Avaliação Integrada — preencher quando há novos elegíveis */}
          {isGestorDeUnidade && temElegiveisEquipe && temNovosElegiveisEquipe && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('integrada')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Avaliação de Consenso.</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('integrada_respostas'); }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {isSGJTAdmin && !isGestorDeUnidade && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('integrada_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Avaliação de Consenso.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── Inventário → Matriz de Competências do Gestor (3 cards) ──────────────
  if (currentView === 'inventario_gestor_home') {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario_home')} className="text-gray-600 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Inventário de Competências do Gestor</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Autoavaliação do Gestor — gestor de unidade SEMPRE preenche (mesmo se também for avaliador da liderança); admin/manager preenche se não for avaliador da liderança; SGJT admins só visualizam */}
          {((isAdminOrManager && !isAvaliadorLideranca) || isGestorDeUnidade) && !isSGJTAdmin && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_auto')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                    <ClipboardCheck className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Autoavaliação do Gestor
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre sua autoavaliação das competências de gestão.</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
          {isSGJTAdmin && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_auto_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center flex-shrink-0 group-hover:bg-teal-100 transition-colors">
                    <ClipboardCheck className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Autoavaliação do Gestor
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre sua autoavaliação das competências de gestão.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}

          {/* Avaliação Integrada (Gestor) — quando o gestor da unidade já validou e o gestor avaliado precisa validar */}
          {(() => {
            const integradaPendentesGestor = integradaPendentes.filter(p => (p.tipo_inventario || 'equipe') === 'gestor');
            return integradaPendentesGestor.length > 0;
          })() && (() => {
            const integradaPendentesGestor = integradaPendentes.filter(p => (p.tipo_inventario || 'equipe') === 'gestor');
            const pendentes = integradaPendentesGestor.filter(p => !p.validado_colaborador_em);
            const todasValidadas = pendentes.length === 0;
            return (
              <Card className={`shadow-sm hover:shadow-md transition-all group cursor-pointer ${
                todasValidadas
                  ? 'bg-emerald-50 border border-emerald-300 hover:border-emerald-500'
                  : 'bg-violet-50 border border-violet-300 hover:border-violet-500'
              }`} onClick={async () => {
                const target = pendentes[0] || integradaPendentesGestor[0];
                try {
                  const fullForm = await avaliacaoIntegradaApi.getById(target.id);
                  setIntegradaResumo(fullForm);
                  setCurrentView('inv_gestor_integrada_resumo');
                } catch {
                  setIntegradaResumo(target);
                  setCurrentView('inv_gestor_integrada_resumo');
                }
              }}>
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                      todasValidadas
                        ? 'bg-emerald-100 group-hover:bg-emerald-200'
                        : 'bg-violet-100 group-hover:bg-violet-200'
                    }`}>
                      <Scale className={`h-5 w-5 ${todasValidadas ? 'text-emerald-700' : 'text-violet-700'}`} />
                    </div>
                    <div>
                      <h3 className={`font-bold text-lg transition-colors ${
                        todasValidadas
                          ? 'text-gray-800 group-hover:text-emerald-700'
                          : 'text-gray-800 group-hover:text-violet-700'
                      }`}>
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-600 mt-0.5">
                        {todasValidadas
                          ? `Validada — ${integradaPendentesGestor.length} avaliação${integradaPendentesGestor.length > 1 ? 'ões' : ''} concluída${integradaPendentesGestor.length > 1 ? 's' : ''}.`
                          : `Você tem ${pendentes.length} avaliação${pendentes.length > 1 ? 'ões' : ''} aguardando sua validação.`}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Avaliação da Liderança — 4 superusuários preenchem, SGJT admins só visualizam */}
          {isAvaliadorLideranca && !isSGJTAdmin && temAvgestorGestor && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_lideranca')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação da Liderança
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre as avaliações de competências dos líderes sob sua gestão.</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('inv_gestor_lideranca_respostas'); }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {isAvaliadorLideranca && isSGJTAdmin && temAvgestorGestor && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_lideranca')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação da Liderança
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre as avaliações de competências dos líderes sob sua gestão.</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('inv_gestor_lideranca_respostas'); }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {isSGJTAdmin && !isAvaliadorLideranca && temAvgestorGestor && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_lideranca_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação da Liderança
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Registre as avaliações de competências dos líderes sob sua gestão.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}

          {/* Avaliação Integrada — superusuários preenchem, gestores validam, SGJT admins só visualizam */}
          {/* Esconde quando há pendentes tipo gestor (já há o card novo) */}
          {(() => {
            const temIntegradaGestorPendente = integradaPendentes.some(p => (p.tipo_inventario || 'equipe') === 'gestor');
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() && isAdminOrManager && !isSGJTAdmin && !isAvaliadorLideranca && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_integrada_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Avaliação de Consenso — visualize e valide.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar e validar
                </span>
              </CardContent>
            </Card>
          )}
          {(() => {
            const temIntegradaGestorPendente = integradaPendentes.some(p => (p.tipo_inventario || 'equipe') === 'gestor');
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() && isAvaliadorLideranca && !isSGJTAdmin && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_integrada')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Avaliação de Consenso.</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('inv_gestor_integrada_respostas'); }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {(() => {
            const temIntegradaGestorPendente = integradaPendentes.some(p => (p.tipo_inventario || 'equipe') === 'gestor');
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() && isAvaliadorLideranca && isSGJTAdmin && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_integrada')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Avaliação de Consenso.</p>
                  </div>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setCurrentView('inv_gestor_integrada_respostas'); }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {(() => {
            const temIntegradaGestorPendente = integradaPendentes.some(p => (p.tipo_inventario || 'equipe') === 'gestor');
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() && isSGJTAdmin && !isAvaliadorLideranca && (
            <Card className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer" onClick={() => setCurrentView('inv_gestor_integrada_respostas')}>
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-800 text-lg group-hover:text-teal-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">Avaliação de Consenso.</p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    );
  }

  // ── Competências Padrão (admin) ─────────────────────
  if (currentView === 'competencias_padrao_admin') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('inventario')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Editar Competências Padrão</h2>
        </div>
        <CompetenciasPadraoAdmin />
      </div>
    );
  }

  // ── Competências Técnicas (admin por unidade) ─────────────────────
  if (currentView === 'competencias_tecnicas_admin') {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setCurrentView('referencial_home')} className="text-gray-700 hover:text-gray-900 hover:bg-gray-100">
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">Gerenciar Competências Técnicas</h2>
        </div>
        <CompetenciasTecnicasAdmin />
      </div>
    );
  }

  // ── Inventário (view principal — 2 cards) ─────────────────────

  return (
    <div className="p-6 space-y-10">
      <h2 className="text-2xl font-bold text-gray-800 border-l-4 border-blue-500 pl-4">Gestão por Competências</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Matriz de Competências — só aparece para quem tem permissão ou SGJT */}
        {(isSGJT || referencialAutorizado) && (
          <Card
            className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => setCurrentView('referencial_home')}
          >
            <CardContent className="p-8 flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                <BookOpen className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-xl group-hover:text-blue-600 transition-colors">
                  Matriz de Competências
                </h3>
                <p className="text-sm text-gray-500 mt-1">Competências da equipe e do gestor</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inventário de Competências */}
        <Card
          className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-lg transition-all cursor-pointer group"
          onClick={() => setCurrentView('inventario_home')}
        >
          <CardContent className="p-8 flex items-center gap-5">
            <div className="w-14 h-14 rounded-xl bg-teal-100 flex items-center justify-center group-hover:bg-teal-200 transition-colors">
              <ClipboardCheck className="h-7 w-7 text-teal-600" />
            </div>
            <div>
              <h3 className="font-bold text-gray-800 text-xl group-hover:text-teal-600 transition-colors">
                Inventário de Competências
              </h3>
              <p className="text-sm text-gray-500 mt-1">Autoavaliação, avaliação do gestor e integrada</p>
            </div>
          </CardContent>
        </Card>

        {/* Competências Padrão — superadmin + dev/staging only */}
        {isSGJT && isCompetenciasPadraoEnabled() && (
          <Card
            className="bg-gray-50 border border-gray-300 shadow-sm hover:border-purple-400 hover:shadow-lg transition-all cursor-pointer group"
            onClick={() => setCurrentView('competencias_padrao_admin')}
          >
            <CardContent className="p-8 flex items-center gap-5">
              <div className="w-14 h-14 rounded-xl bg-purple-100 flex items-center justify-center group-hover:bg-purple-200 transition-colors">
                <Settings className="h-7 w-7 text-purple-600" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800 text-xl group-hover:text-purple-600 transition-colors">
                  Editar Competências Padrão
                </h3>
                <p className="text-sm text-gray-500 mt-1">Gerenciar competências comportamentais, estratégicas e gerenciais</p>
              </div>
            </CardContent>
          </Card>
        )}

      </div>
    </div>
  );
}
