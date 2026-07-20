import { useState, useEffect, type ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  Users,
  UserCog,
  Eye,
  ClipboardCheck,
  UserCheck,
  Scale,
  GitCompare,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { areasApi } from "@/services/areasApi";
import {
  FormularioCompetencias,
  competenciasGestorApi,
} from "@/services/competenciasGestorApi";
import {
  AutoavaliacaoFormulario,
  autoavaliacaoApi,
} from "@/services/autoavaliacaoApi";
import {
  AvaliacaoGestorFormulario,
  avaliacaoGestorApi,
} from "@/services/avaliacaoGestorApi";
import {
  AvaliacaoIntegradaFormulario,
  avaliacaoIntegradaApi,
} from "@/services/avaliacaoIntegradaApi";
import { CompetenciasEquipeForm } from "./CompetenciasEquipeForm";
import { CompetenciasGestorForm } from "./CompetenciasGestorForm";
import { CompetenciasGestorResumo } from "./CompetenciasGestorResumo";
import { CompetenciasGestorRespostas } from "./CompetenciasGestorRespostas";
import { AutoavaliacaoForm } from "./AutoavaliacaoForm";
import { AutoavaliacaoResumo } from "./AutoavaliacaoResumo";
import { AutoavaliacaoRespostas } from "./AutoavaliacaoRespostas";
import { AvaliacaoGestorForm } from "./AvaliacaoGestorForm";
import { AvaliacaoGestorResumo } from "./AvaliacaoGestorResumo";
import { AvaliacaoGestorRespostas } from "./AvaliacaoGestorRespostas";
import { AvaliacaoIntegradaForm } from "./AvaliacaoIntegradaForm";
import { AvaliacaoIntegradaResumo } from "./AvaliacaoIntegradaResumo";
import { AvaliacaoIntegradaRespostas } from "./AvaliacaoIntegradaRespostas";
import { CompetenciasPadraoAdmin } from "./CompetenciasPadraoAdmin";
import { CompetenciasTecnicasAdmin } from "./CompetenciasTecnicasAdmin";
import { isCompetenciasPadraoEnabled } from "@/utils/environment";
import { Settings, Wrench } from "lucide-react";

/** Corpo colapsável animado (grid-rows 0fr→1fr para transição de altura suave). */
function Collapsible({ open, children }: { open: boolean; children: ReactNode }) {
  return (
    <div
      className={`grid transition-all duration-300 ease-out ${
        open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">{children}</div>
    </div>
  );
}

/** Seção principal do hub (módulo que se desdobra). */
function HubSection({
  open,
  onToggle,
  icon,
  iconBg,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  iconBg: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left hover:bg-gray-50 transition-colors"
      >
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-lg">{title}</h3>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <Collapsible open={open}>
        <div className="px-5 pb-5">{children}</div>
      </Collapsible>
    </div>
  );
}

/** Sub-seção do hub (nível aninhado dentro de uma seção). */
function HubSubSection({
  open,
  onToggle,
  icon,
  iconBg,
  title,
  children,
}: {
  open: boolean;
  onToggle: () => void;
  icon: ReactNode;
  iconBg: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-100/70 transition-colors"
      >
        <div
          className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${iconBg}`}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="font-semibold text-gray-800">{title}</h4>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-gray-400 transition-transform duration-300 flex-shrink-0 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>
      <Collapsible open={open}>
        <div className="p-4 pt-0">{children}</div>
      </Collapsible>
    </div>
  );
}

// Paleta dos cards. Azul é o padrão; as demais cores ficam só nos 3 cards do
// Inventário de Competências do Gestor.
const CARD_CORES = {
  blue: "bg-blue-100 text-blue-600",
  teal: "bg-teal-100 text-teal-600",
  amber: "bg-amber-100 text-amber-600",
  violet: "bg-violet-100 text-violet-600",
} as const;

/** Card padronizado do hub: mesmo layout, tamanho, espaçamento e fontes em todos. */
function HubCard({
  icon,
  cor = "blue",
  title,
  description,
  onClick,
}: {
  icon: ReactNode;
  cor?: keyof typeof CARD_CORES;
  title: string;
  description: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="h-full w-full text-left rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group flex items-start gap-4"
    >
      <div
        className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${CARD_CORES[cor]}`}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-500 mt-1 leading-snug">{description}</p>
      </div>
    </button>
  );
}

type View =
  | "inventario"
  | "referencial_home"
  | "inventario_home"
  | "inventario_equipe_home"
  | "inventario_gestor_home"
  | "equipe"
  | "equipe_resumo"
  | "equipe_respostas"
  | "equipe_edit"
  | "gestor"
  | "gestor_resumo"
  | "gestor_respostas"
  | "gestor_edit"
  | "autoavaliacao"
  | "autoavaliacao_resumo"
  | "autoavaliacao_respostas"
  | "avgestor"
  | "avgestor_resumo"
  | "avgestor_respostas"
  | "integrada"
  | "integrada_resumo"
  | "integrada_respostas"
  | "inv_gestor_auto"
  | "inv_gestor_auto_resumo"
  | "inv_gestor_auto_respostas"
  | "inv_gestor_lideranca"
  | "inv_gestor_lideranca_resumo"
  | "inv_gestor_lideranca_respostas"
  | "inv_gestor_integrada"
  | "inv_gestor_integrada_resumo"
  | "inv_gestor_integrada_respostas"
  | "competencias_padrao_admin"
  | "competencias_tecnicas_admin"
  | "competencias_padrao_view";

export function GestaoCompetencias() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<View>("inventario");
  const [formularioResumo, setFormularioResumo] =
    useState<FormularioCompetencias | null>(null);
  const [formularioEdit, setFormularioEdit] =
    useState<FormularioCompetencias | null>(null);
  const [editFromResumo, setEditFromResumo] = useState(false);
  // Camada que o superior (Diretoria/Final) validará ao salvar a edição feita pelo resumo.
  const [validarCamadaEdit, setValidarCamadaEdit] = useState<
    "diretoria" | "final" | null
  >(null);
  const [autoavaliacaoResumo, setAutoavaliacaoResumo] =
    useState<AutoavaliacaoFormulario | null>(null);
  const [autoavaliacaoEditMode, setAutoavaliacaoEditMode] = useState(false);
  const [avGestorResumo, setAvGestorResumo] =
    useState<AvaliacaoGestorFormulario | null>(null);
  const [avGestorEdit, setAvGestorEdit] =
    useState<AvaliacaoGestorFormulario | null>(null);
  const [integradaResumo, setIntegradaResumo] =
    useState<AvaliacaoIntegradaFormulario | null>(null);
  const [integradaEdit, setIntegradaEdit] =
    useState<AvaliacaoIntegradaFormulario | null>(null);
  const [diretoriaUsuario, setDiretoriaUsuario] = useState("");
  const [isDomainRoot, setIsDomainRoot] = useState(false);
  const [referencialAutorizado, setReferencialAutorizado] = useState<
    boolean | null
  >(null);
  const [isGestorDeUnidade, setIsGestorDeUnidade] = useState(false);
  const [integradaPendentes, setIntegradaPendentes] = useState<
    AvaliacaoIntegradaFormulario[]
  >([]);
  const [temUnidadeColaborador, setTemUnidadeColaborador] = useState(false);
  const [temElegiveisEquipe, setTemElegiveisEquipe] = useState(false);
  const [temElegiveisGestor, setTemElegiveisGestor] = useState(false);
  const [temNovosElegiveisEquipe, setTemNovosElegiveisEquipe] = useState(false);
  const [temNovosElegiveisGestor, setTemNovosElegiveisGestor] = useState(false);
  const [temAvgestorEquipe, setTemAvgestorEquipe] = useState(false);
  const [temAvgestorGestor, setTemAvgestorGestor] = useState(false);
  const [ehGestorOuSubdiretorMacro, setEhGestorOuSubdiretorMacro] =
    useState(false);
  const [temReferencialGerenciavel, setTemReferencialGerenciavel] =
    useState(false);

  // Estado do acordeão do hub. Persiste enquanto o componente estiver montado,
  // então voltar de um formulário mantém a seção aberta. Tudo aberto por padrão:
  // é uma página única onde os módulos já vêm desdobrados.
  const [openSections, setOpenSections] = useState<Set<string>>(
    () => new Set(["matriz", "inventario", "inv_equipe", "inv_gestor"]),
  );
  const toggleSection = (key: string) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

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
    if (
      currentView === "inventario_equipe_home" ||
      currentView === "inventario_gestor_home"
    ) {
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
    const integradaIdRaw = params.get("integradaId");
    const matrizIdRaw = params.get("matrizId");
    const autoavaliacaoIdRaw = params.get("autoavaliacaoId");
    const avgestorIdRaw = params.get("avgestorId");
    const tipoRaw = params.get("tipo");
    if (
      !integradaIdRaw &&
      !matrizIdRaw &&
      !autoavaliacaoIdRaw &&
      !avgestorIdRaw
    )
      return;

    let cancelled = false;
    const clearParams = () => {
      const url = new URL(window.location.href);
      [
        "integradaId",
        "matrizId",
        "autoavaliacaoId",
        "avgestorId",
        "tipo",
      ].forEach((p) => url.searchParams.delete(p));
      window.history.replaceState({}, "", url.toString());
    };

    (async () => {
      try {
        // Avaliação Integrada
        if (integradaIdRaw) {
          const id = Number(integradaIdRaw);
          if (!Number.isFinite(id)) return;
          const tipo = (tipoRaw === "gestor" ? "gestor" : "equipe") as
            | "equipe"
            | "gestor";
          const form = await avaliacaoIntegradaApi.getById(id);
          if (cancelled || !form) return;
          setIntegradaResumo(form);
          setCurrentView(
            tipo === "gestor"
              ? "inv_gestor_integrada_resumo"
              : "integrada_resumo",
          );
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
          const tipoForm =
            (form as any).tipo === "gestor" ? "gestor" : "equipe";
          setFormularioResumo(form);
          setCurrentView(
            tipoForm === "gestor" ? "gestor_resumo" : "equipe_resumo",
          );
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
          setCurrentView("autoavaliacao_resumo");
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
          setCurrentView("avgestor_resumo");
          clearParams();
          return;
        }
      } catch (err) {
        console.warn("[GestaoCompetencias] Falha no deep-link:", err);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Buscar diretoria real do usuário (via cadastros_areas, fonte confiável)
  useEffect(() => {
    const load = async () => {
      try {
        const allAreas = await areasApi.getAll();
        // Usar user.diretoria para encontrar a área correta do usuário
        const userArea =
          allAreas.find((a) => a.sigla === user?.diretoria) ||
          allAreas.find((a) => a.is_domain_root === true) ||
          allAreas[0];
        const sigla = userArea?.sigla || userArea?.nome || "";
        setDiretoriaUsuario(sigla);
        setIsDomainRoot(
          !!userArea?.is_domain_root || (user as any)?.is_superadmin === true,
        );

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
          const { ehColaborador } =
            await competenciasGestorApi.ehColaboradorEquipe();
          setTemUnidadeColaborador(ehColaborador);
        } catch {
          setTemUnidadeColaborador(false);
        }

        // Detectar se é gestor ou sub-diretor de alguma macroárea
        try {
          const allAreas = await areasApi.getAll();
          const userIdNum = user?.id ? Number(user.id) : 0;
          const ehMacro = allAreas.some(
            (a) =>
              Number(a.gestor_user_id || 0) === userIdNum ||
              Number((a as any).subdiretor_user_id || 0) === userIdNum,
          );
          setEhGestorOuSubdiretorMacro(ehMacro);
        } catch {
          setEhGestorOuSubdiretorMacro(false);
        }

        // Verificar se tem algum referencial gerenciável (para mostrar o card de gerenciar técnicas)
        try {
          const gerenciaveis =
            await competenciasGestorApi.listarUnidadesGerenciaveis();
          setTemReferencialGerenciavel(gerenciaveis.length > 0);
        } catch {
          setTemReferencialGerenciavel(false);
        }

        // Verificar elegíveis
        await checkElegiveis();

        // Carregar avaliações integradas pendentes de validação do colaborador
        try {
          const pendentes =
            await avaliacaoIntegradaApi.getPendentesColaborador();
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

  const isAdminOrManager = user?.role === "ADMIN" || user?.role === "MANAGER";
  const isSGJT = (user as any)?.is_superadmin === true;
  const isSGJTAdmin = isSGJT && user?.role === "ADMIN";

  // Avaliadores da Liderança = gestores e subdiretores de macroárea
  // (definido dinamicamente por cadastros_areas.gestor_user_id / subdiretor_user_id — ver ehGestorOuSubdiretorMacro acima)
  const currentUserId = user?.id ? parseInt(String(user.id)) : undefined;
  const isAvaliadorLideranca = ehGestorOuSubdiretorMacro;

  // ── Matriz de Competências da Equipe ──────────────────────────────────

  if (currentView === "equipe") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("referencial_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Matriz de Competências da Equipe
          </h2>
        </div>
        <CompetenciasEquipeForm
          onSubmitted={(formulario) => {
            setFormularioResumo(formulario);
            setCurrentView("equipe_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "equipe_resumo" && formularioResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("referencial_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Matriz de Competências da Equipe
          </h2>
        </div>
        <CompetenciasGestorResumo
          formulario={formularioResumo}
          onValidated={(f) => setFormularioResumo(f)}
          onEdit={(f, validarCamada) => {
            setFormularioEdit(f);
            setEditFromResumo(true);
            setValidarCamadaEdit(validarCamada ?? null);
            setCurrentView("equipe_edit");
          }}
        />
      </div>
    );
  }

  if (currentView === "equipe_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("referencial_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Matriz de Competências da Equipe
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentView("equipe")}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" /> Revisar Matriz
            </Button>
            <Button
              onClick={() => setCurrentView("equipe")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Nova Matriz
            </Button>
          </div>
        </div>
        <CompetenciasGestorRespostas
          tipo="equipe"
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          onViewFormulario={(f) => {
            setFormularioResumo(f);
            setCurrentView("equipe_resumo");
          }}
          onEditFormulario={(f) => {
            setFormularioEdit(f);
            setValidarCamadaEdit(null);
            setCurrentView("equipe_edit");
          }}
        />
      </div>
    );
  }

  if (currentView === "equipe_edit" && formularioEdit) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const voltarPara = editFromResumo
                ? "equipe_resumo"
                : "equipe_respostas";
              setEditFromResumo(false);
              setValidarCamadaEdit(null);
              setCurrentView(voltarPara);
            }}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Editar — Matriz de Competências da Equipe
          </h2>
        </div>
        <CompetenciasEquipeForm
          editFormulario={formularioEdit}
          validationMode={
            !editFromResumo && formularioEdit.status === "enviado"
          }
          validarCamadaAoSalvar={validarCamadaEdit}
          onSubmitted={(formulario) => {
            setEditFromResumo(false);
            setValidarCamadaEdit(null);
            setFormularioResumo(formulario);
            setCurrentView("equipe_resumo");
          }}
        />
      </div>
    );
  }

  // ── Matriz de Competências do Gestor ──────────────────────────────────

  if (currentView === "gestor") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("referencial_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Matriz de Competências do Gestor
          </h2>
        </div>
        <CompetenciasGestorForm
          onSubmitted={(formulario) => {
            setFormularioResumo(formulario);
            setCurrentView("gestor_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "gestor_resumo" && formularioResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("referencial_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Matriz de Competências do Gestor
          </h2>
        </div>
        <CompetenciasGestorResumo
          formulario={formularioResumo}
          onValidated={(f) => setFormularioResumo(f)}
          onEdit={(f, validarCamada) => {
            setFormularioEdit(f);
            setEditFromResumo(true);
            setValidarCamadaEdit(validarCamada ?? null);
            setCurrentView("gestor_edit");
          }}
        />
      </div>
    );
  }

  if (currentView === "gestor_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 flex-wrap">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("referencial_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Matriz de Competências do Gestor
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setCurrentView("gestor")}
              className="border-blue-200 text-blue-700 hover:bg-blue-50"
            >
              <RefreshCw className="h-4 w-4 mr-1.5" /> Revisar Matriz
            </Button>
            <Button
              onClick={() => setCurrentView("gestor")}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="h-4 w-4 mr-1.5" /> Nova Matriz
            </Button>
          </div>
        </div>
        <CompetenciasGestorRespostas
          tipo="gestor"
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          onViewFormulario={(f) => {
            setFormularioResumo(f);
            setCurrentView("gestor_resumo");
          }}
          onEditFormulario={(f) => {
            setFormularioEdit(f);
            setValidarCamadaEdit(null);
            setCurrentView("gestor_edit");
          }}
        />
      </div>
    );
  }

  if (currentView === "gestor_edit" && formularioEdit) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const voltarPara = editFromResumo
                ? "gestor_resumo"
                : "gestor_respostas";
              setEditFromResumo(false);
              setValidarCamadaEdit(null);
              setCurrentView(voltarPara);
            }}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Editar — Matriz de Competências do Gestor
          </h2>
        </div>
        <CompetenciasGestorForm
          editFormulario={formularioEdit}
          validationMode={
            !editFromResumo && formularioEdit.status === "enviado"
          }
          validarCamadaAoSalvar={validarCamadaEdit}
          onSubmitted={(formulario) => {
            setEditFromResumo(false);
            setValidarCamadaEdit(null);
            setFormularioResumo(formulario);
            setCurrentView("gestor_resumo");
          }}
        />
      </div>
    );
  }

  // ── Autoavaliação do Colaborador ──────────────────────────────

  if (currentView === "autoavaliacao") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Autoavaliação do Colaborador
          </h2>
        </div>
        <AutoavaliacaoForm
          editMode={autoavaliacaoEditMode}
          onSubmitted={(formulario) => {
            setAutoavaliacaoEditMode(false);
            setAutoavaliacaoResumo(formulario);
            setCurrentView("autoavaliacao_resumo");
          }}
          onViewResposta={(formulario) => {
            setAutoavaliacaoResumo(formulario);
            setCurrentView("autoavaliacao_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "autoavaliacao_resumo" && autoavaliacaoResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Autoavaliação do Colaborador
          </h2>
        </div>
        <AutoavaliacaoResumo
          formulario={autoavaliacaoResumo}
          onValidated={(f) => setAutoavaliacaoResumo(f)}
          onEdit={() => {
            setAutoavaliacaoEditMode(true);
            setCurrentView("autoavaliacao");
          }}
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  if (currentView === "autoavaliacao_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Respostas — Autoavaliação do Colaborador
          </h2>
        </div>
        <AutoavaliacaoRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="equipe"
          onViewFormulario={(f) => {
            setAutoavaliacaoResumo(f);
            setCurrentView("autoavaliacao_resumo");
          }}
        />
      </div>
    );
  }

  // ── Avaliação do Gestor ──────────────────────────────────

  if (currentView === "avgestor") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação do Gestor
          </h2>
        </div>
        <AvaliacaoGestorForm
          formularioEdit={avGestorEdit || undefined}
          onSubmitted={(formulario) => {
            setAvGestorEdit(null);
            setAvGestorResumo(formulario);
            setCurrentView("avgestor_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "avgestor_resumo" && avGestorResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação do Gestor
          </h2>
        </div>
        <AvaliacaoGestorResumo
          formulario={avGestorResumo}
          onValidated={(f) => setAvGestorResumo(f)}
          onEdit={() => {
            setAvGestorEdit(avGestorResumo);
            setCurrentView("avgestor");
          }}
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  if (currentView === "avgestor_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Respostas — Avaliação do Gestor
          </h2>
        </div>
        <AvaliacaoGestorRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="equipe"
          onViewFormulario={(f) => {
            setAvGestorResumo(f);
            setCurrentView("avgestor_resumo");
          }}
        />
      </div>
    );
  }

  // ── Avaliação Integrada ──────────────────────────────────

  if (currentView === "integrada") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação Integrada
          </h2>
        </div>
        <AvaliacaoIntegradaForm
          formularioEdit={integradaEdit || undefined}
          onSubmitted={(formulario) => {
            setIntegradaEdit(null);
            setIntegradaResumo(formulario);
            setCurrentView("integrada_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "integrada_resumo" && integradaResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação Integrada
          </h2>
        </div>
        <AvaliacaoIntegradaResumo
          formulario={integradaResumo}
          onValidated={(f) => {
            setIntegradaResumo(f);
            setIntegradaPendentes((prev) =>
              prev.map((p) => (p.id === f.id ? f : p)),
            );
          }}
          onEdit={(f) => {
            setIntegradaEdit(f);
            setCurrentView("integrada");
          }}
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  if (currentView === "integrada_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_equipe_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Respostas — Avaliação Integrada
          </h2>
        </div>
        <AvaliacaoIntegradaRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="equipe"
          onViewFormulario={(f) => {
            setIntegradaResumo(f);
            setCurrentView("integrada_resumo");
          }}
        />
      </div>
    );
  }

  // ── Autoavaliação do Gestor (Inventário Gestor) ──────────────
  if (currentView === "inv_gestor_auto") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Autoavaliação do Gestor
          </h2>
        </div>
        <AutoavaliacaoForm
          tipoInventario="gestor"
          editMode={autoavaliacaoEditMode}
          onSubmitted={(formulario) => {
            setAutoavaliacaoEditMode(false);
            setAutoavaliacaoResumo(formulario);
            setCurrentView("inv_gestor_auto_resumo");
          }}
          onViewResposta={(formulario) => {
            setAutoavaliacaoResumo(formulario);
            setCurrentView("inv_gestor_auto_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "inv_gestor_auto_resumo" && autoavaliacaoResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Autoavaliação do Gestor
          </h2>
        </div>
        <AutoavaliacaoResumo
          formulario={autoavaliacaoResumo}
          onValidated={(f) => setAutoavaliacaoResumo(f)}
          onEdit={() => {
            setAutoavaliacaoEditMode(true);
            setCurrentView("inv_gestor_auto");
          }}
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  if (currentView === "inv_gestor_auto_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Respostas — Autoavaliação do Gestor
          </h2>
        </div>
        <AutoavaliacaoRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="gestor"
          onViewFormulario={(f) => {
            setAutoavaliacaoResumo(f);
            setCurrentView("inv_gestor_auto_resumo");
          }}
        />
      </div>
    );
  }

  // ── Avaliação da Liderança (Inventário Gestor) ──────────────
  if (currentView === "inv_gestor_lideranca") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação da Liderança
          </h2>
        </div>
        <AvaliacaoGestorForm
          tipoInventario="gestor"
          formularioEdit={avGestorEdit || undefined}
          onSubmitted={(formulario) => {
            setAvGestorEdit(null);
            setAvGestorResumo(formulario);
            setCurrentView("inv_gestor_lideranca_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "inv_gestor_lideranca_resumo" && avGestorResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação da Liderança
          </h2>
        </div>
        <AvaliacaoGestorResumo
          formulario={avGestorResumo}
          onValidated={(f) => setAvGestorResumo(f)}
          onEdit={() => {
            setAvGestorEdit(avGestorResumo);
            setCurrentView("inv_gestor_lideranca");
          }}
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  if (currentView === "inv_gestor_lideranca_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Respostas — Avaliação da Liderança
          </h2>
        </div>
        <AvaliacaoGestorRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="gestor"
          onViewFormulario={(f) => {
            setAvGestorResumo(f);
            setCurrentView("inv_gestor_lideranca_resumo");
          }}
        />
      </div>
    );
  }

  // ── Avaliação Integrada do Gestor (Inventário Gestor) ──────────
  if (currentView === "inv_gestor_integrada") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação Integrada
          </h2>
        </div>
        <AvaliacaoIntegradaForm
          tipoInventario="gestor"
          formularioEdit={integradaEdit || undefined}
          onSubmitted={(formulario) => {
            setIntegradaEdit(null);
            setIntegradaResumo(formulario);
            setCurrentView("inv_gestor_integrada_resumo");
          }}
        />
      </div>
    );
  }

  if (currentView === "inv_gestor_integrada_resumo" && integradaResumo) {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Avaliação Integrada
          </h2>
        </div>
        <AvaliacaoIntegradaResumo
          formulario={integradaResumo}
          onValidated={(f) => {
            setIntegradaResumo(f);
            setIntegradaPendentes((prev) =>
              prev.map((p) => (p.id === f.id ? f : p)),
            );
          }}
          onEdit={(f) => {
            setIntegradaEdit(f);
            setCurrentView("inv_gestor_integrada");
          }}
          tipoInventario="gestor"
          currentUserId={currentUserId}
        />
      </div>
    );
  }

  if (currentView === "inv_gestor_integrada_respostas") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("inventario_gestor_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Respostas — Avaliação Integrada
          </h2>
        </div>
        <AvaliacaoIntegradaRespostas
          diretoria={diretoriaUsuario}
          isDomainRoot={isDomainRoot}
          tipoInventario="gestor"
          onViewFormulario={(f) => {
            setIntegradaResumo(f);
            setCurrentView("inv_gestor_integrada_resumo");
          }}
        />
      </div>
    );
  }

  // ── Matriz de Competências (cards padronizados, azul; clique vai para a tabela de Respostas) ──
  const matrizCards = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-stretch">
      <HubCard
        icon={<Users className="h-6 w-6" />}
        title="Competências da Equipe"
        description="Mapeamento de competências dos colaboradores"
        onClick={() => setCurrentView("equipe_respostas")}
      />

      {(isSGJT || isAvaliadorLideranca || ehGestorOuSubdiretorMacro) && (
        <HubCard
          icon={<UserCog className="h-6 w-6" />}
          title="Competências do Gestor"
          description="Mapeamento de competências dos gestores"
          onClick={() => setCurrentView("gestor_respostas")}
        />
      )}

      {(isGestorDeUnidade || ehGestorOuSubdiretorMacro || isSGJT) && (
        <HubCard
          icon={<BookOpen className="h-6 w-6" />}
          title="Competências Padrão"
          description="Catálogo de competências padrão"
          onClick={() => setCurrentView("competencias_padrao_view")}
        />
      )}

      {/* Gerenciar Competências Técnicas — só superadmin, com referenciais preenchidos */}
      {isSGJT && temReferencialGerenciavel && isCompetenciasPadraoEnabled() && (
        <HubCard
          icon={<Wrench className="h-6 w-6" />}
          title="Gerenciar Competências Técnicas"
          description="Editar competências técnicas das suas unidades"
          onClick={() => setCurrentView("competencias_tecnicas_admin")}
        />
      )}
    </div>
  );

  // ── Visualizar Competências Padrão (read-only) ─────────────────
  if (currentView === "competencias_padrao_view") {
    // Tela unificada: todos visualizam + Gerar PDF; superadmin também edita/publica.
    return (
      <CompetenciasPadraoAdmin
        isSuperadmin={isSGJT}
        onVoltar={() => setCurrentView("referencial_home")}
      />
    );
  }

  // ── Inventário de Competências — HOME (2 cards) ─────────────────
  // ── Inventário → Matriz de Competências da Equipe (cards) ──────────────
  const invEquipeCards = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Autoavaliação do Colaborador — apenas viewers (e admins/managers colaboradores de unidade que NÃO sejam gestor de unidade nem avaliador da liderança); SGJT admins têm card próprio */}
          {(!isAdminOrManager || (temUnidadeColaborador && !isSGJTAdmin)) &&
            !isGestorDeUnidade &&
            !isAvaliadorLideranca && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("autoavaliacao")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                        Autoavaliação do Colaborador
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Registre sua autoavaliação das competências para a sua
                        função.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          {isSGJTAdmin && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("autoavaliacao_respostas")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                      Autoavaliação do Colaborador
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Registre sua autoavaliação das competências para a sua
                      função.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-blue-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}

          {/* Avaliação Integrada — colaborador visualiza/valida quando o gestor já validou (apenas tipo equipe) */}
          {(() => {
            const integradaPendentesEquipe = integradaPendentes.filter(
              (p) => (p.tipo_inventario || "equipe") === "equipe",
            );
            return integradaPendentesEquipe.length > 0 && !isGestorDeUnidade;
          })() &&
            (() => {
              const integradaPendentesEquipe = integradaPendentes.filter(
                (p) => (p.tipo_inventario || "equipe") === "equipe",
              );
              const pendentes = integradaPendentesEquipe.filter(
                (p) => !p.validado_colaborador_em,
              );
              const todasValidadas = pendentes.length === 0;
              return (
                <Card
                  className={`shadow-sm hover:shadow-md transition-all group cursor-pointer ${
                    todasValidadas
                      ? "bg-emerald-50 border border-emerald-300 hover:border-emerald-500"
                      : "bg-violet-50 border border-violet-300 hover:border-violet-500"
                  }`}
                  onClick={async () => {
                    const target = pendentes[0] || integradaPendentesEquipe[0];
                    try {
                      const fullForm = await avaliacaoIntegradaApi.getById(
                        target.id,
                      );
                      setIntegradaResumo(fullForm);
                      setCurrentView("integrada_resumo");
                    } catch {
                      setIntegradaResumo(target);
                      setCurrentView("integrada_resumo");
                    }
                  }}
                >
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          todasValidadas
                            ? "bg-emerald-100 group-hover:bg-emerald-200"
                            : "bg-violet-100 group-hover:bg-violet-200"
                        }`}
                      >
                        <Scale
                          className={`h-5 w-5 ${todasValidadas ? "text-emerald-700" : "text-violet-700"}`}
                        />
                      </div>
                      <div>
                        <h3
                          className={`font-bold text-lg transition-colors ${
                            todasValidadas
                              ? "text-gray-800 group-hover:text-emerald-700"
                              : "text-gray-800 group-hover:text-violet-700"
                          }`}
                        >
                          Avaliação Integrada
                        </h3>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {todasValidadas
                            ? `Validada — ${integradaPendentesEquipe.length} avaliação${integradaPendentesEquipe.length > 1 ? "ões" : ""} concluída${integradaPendentesEquipe.length > 1 ? "s" : ""}.`
                            : `Você tem ${pendentes.length} avaliação${pendentes.length > 1 ? "ões" : ""} aguardando sua validação.`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

          {/* Avaliação do Gestor — só aparece quando há autoavaliações validadas ou já preenchidas */}
          {isGestorDeUnidade && temAvgestorEquipe && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("avgestor")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <UserCheck className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                      Avaliação do Gestor
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Registre as avaliações de competências dos colaboradores
                      sob sua gestão.
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView("avgestor_respostas");
                  }}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-blue-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {isSGJTAdmin && !isGestorDeUnidade && temAvgestorEquipe && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("avgestor_respostas")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <UserCheck className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                      Avaliação do Gestor
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Registre as avaliações de competências dos colaboradores
                      sob sua gestão.
                    </p>
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
          {isGestorDeUnidade &&
            temElegiveisEquipe &&
            !temNovosElegiveisEquipe && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("integrada_respostas")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                      <Scale className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Avaliação de Consenso.
                      </p>
                    </div>
                  </div>
                  <span className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-blue-200">
                    <Eye className="h-4 w-4" />
                    Visualizar respostas
                  </span>
                </CardContent>
              </Card>
            )}

          {/* Avaliação Integrada — preencher quando há novos elegíveis */}
          {isGestorDeUnidade &&
            temElegiveisEquipe &&
            temNovosElegiveisEquipe && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("integrada")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                      <Scale className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Avaliação de Consenso.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentView("integrada_respostas");
                    }}
                    className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-blue-200"
                  >
                    <Eye className="h-4 w-4" />
                    Visualizar respostas
                  </button>
                </CardContent>
              </Card>
            )}
          {isSGJTAdmin && !isGestorDeUnidade && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-blue-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("integrada_respostas")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <Scale className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-blue-600 transition-colors">
                      Avaliação Integrada
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Avaliação de Consenso.
                    </p>
                  </div>
                </div>
                <span className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-blue-200">
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </span>
              </CardContent>
            </Card>
          )}
    </div>
  );

  // ── Inventário → Matriz de Competências do Gestor (cards) ──────────────
  const invGestorCards = (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Autoavaliação do Gestor — gestor de unidade SEMPRE preenche (mesmo se também for avaliador da liderança); admin/manager preenche se não for avaliador da liderança; SGJT admins só visualizam */}
          {((isAdminOrManager && !isAvaliadorLideranca) || isGestorDeUnidade) &&
            !isSGJTAdmin && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("inv_gestor_auto")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                      <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                        Autoavaliação do Gestor
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Registre sua autoavaliação das competências de gestão.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          {isSGJTAdmin && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("inv_gestor_auto_respostas")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 transition-colors">
                    <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                      Autoavaliação do Gestor
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Registre sua autoavaliação das competências de gestão.
                    </p>
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
            const integradaPendentesGestor = integradaPendentes.filter(
              (p) => (p.tipo_inventario || "equipe") === "gestor",
            );
            return integradaPendentesGestor.length > 0;
          })() &&
            (() => {
              const integradaPendentesGestor = integradaPendentes.filter(
                (p) => (p.tipo_inventario || "equipe") === "gestor",
              );
              const pendentes = integradaPendentesGestor.filter(
                (p) => !p.validado_colaborador_em,
              );
              const todasValidadas = pendentes.length === 0;
              return (
                <Card
                  className={`shadow-sm hover:shadow-md transition-all group cursor-pointer ${
                    todasValidadas
                      ? "bg-emerald-50 border border-emerald-300 hover:border-emerald-500"
                      : "bg-violet-50 border border-violet-300 hover:border-violet-500"
                  }`}
                  onClick={async () => {
                    const target = pendentes[0] || integradaPendentesGestor[0];
                    try {
                      const fullForm = await avaliacaoIntegradaApi.getById(
                        target.id,
                      );
                      setIntegradaResumo(fullForm);
                      setCurrentView("inv_gestor_integrada_resumo");
                    } catch {
                      setIntegradaResumo(target);
                      setCurrentView("inv_gestor_integrada_resumo");
                    }
                  }}
                >
                  <CardContent className="p-6 space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors ${
                          todasValidadas
                            ? "bg-emerald-100 group-hover:bg-emerald-200"
                            : "bg-violet-100 group-hover:bg-violet-200"
                        }`}
                      >
                        <Scale
                          className={`h-5 w-5 ${todasValidadas ? "text-emerald-700" : "text-violet-700"}`}
                        />
                      </div>
                      <div>
                        <h3
                          className={`font-bold text-lg transition-colors ${
                            todasValidadas
                              ? "text-gray-800 group-hover:text-emerald-700"
                              : "text-gray-800 group-hover:text-violet-700"
                          }`}
                        >
                          Avaliação Integrada
                        </h3>
                        <p className="text-sm text-gray-600 mt-0.5">
                          {todasValidadas
                            ? `Validada — ${integradaPendentesGestor.length} avaliação${integradaPendentesGestor.length > 1 ? "ões" : ""} concluída${integradaPendentesGestor.length > 1 ? "s" : ""}.`
                            : `Você tem ${pendentes.length} avaliação${pendentes.length > 1 ? "ões" : ""} aguardando sua validação.`}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })()}

          {/* Avaliação da Liderança — gestores/subdiretores de macroárea preenchem.
              Sem exigir temAvgestorGestor: o avaliador pode avaliar o gestor da unidade ANTES
              da autoavaliação existir (o form lista o gestor da unidade). */}
          {isAvaliadorLideranca && !isSGJTAdmin && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("inv_gestor_lideranca")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                      Avaliação da Liderança
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Registre as avaliações de competências dos líderes sob sua
                      gestão.
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView("inv_gestor_lideranca_respostas");
                  }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {isAvaliadorLideranca && isSGJTAdmin && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("inv_gestor_lideranca")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                      Avaliação da Liderança
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Registre as avaliações de competências dos líderes sob sua
                      gestão.
                    </p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentView("inv_gestor_lideranca_respostas");
                  }}
                  className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                >
                  <Eye className="h-4 w-4" />
                  Visualizar respostas
                </button>
              </CardContent>
            </Card>
          )}
          {isSGJTAdmin && !isAvaliadorLideranca && temAvgestorGestor && (
            <Card
              className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
              onClick={() => setCurrentView("inv_gestor_lideranca_respostas")}
            >
              <CardContent className="p-6 space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 transition-colors">
                    <ShieldAlert className="h-5 w-5 text-amber-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                      Avaliação da Liderança
                    </h3>
                    <p className="text-sm text-gray-500 mt-0.5">
                      Registre as avaliações de competências dos líderes sob sua
                      gestão.
                    </p>
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
            const temIntegradaGestorPendente = integradaPendentes.some(
              (p) => (p.tipo_inventario || "equipe") === "gestor",
            );
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() &&
            isAdminOrManager &&
            !isSGJTAdmin &&
            !isAvaliadorLideranca && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("inv_gestor_integrada_respostas")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                      <Scale className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Avaliação de Consenso — visualize e valide.
                      </p>
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
            const temIntegradaGestorPendente = integradaPendentes.some(
              (p) => (p.tipo_inventario || "equipe") === "gestor",
            );
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() &&
            isAvaliadorLideranca &&
            !isSGJTAdmin && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("inv_gestor_integrada")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                      <Scale className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Avaliação de Consenso.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentView("inv_gestor_integrada_respostas");
                    }}
                    className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                  >
                    <Eye className="h-4 w-4" />
                    Visualizar respostas
                  </button>
                </CardContent>
              </Card>
            )}
          {(() => {
            const temIntegradaGestorPendente = integradaPendentes.some(
              (p) => (p.tipo_inventario || "equipe") === "gestor",
            );
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() &&
            isAvaliadorLideranca &&
            isSGJTAdmin && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("inv_gestor_integrada")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                      <Scale className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Avaliação de Consenso.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentView("inv_gestor_integrada_respostas");
                    }}
                    className="flex items-center gap-2 text-sm text-teal-600 hover:text-teal-800 hover:bg-teal-50 px-3 py-1.5 rounded-lg transition-all ml-10 border border-transparent hover:border-teal-200"
                  >
                    <Eye className="h-4 w-4" />
                    Visualizar respostas
                  </button>
                </CardContent>
              </Card>
            )}
          {(() => {
            const temIntegradaGestorPendente = integradaPendentes.some(
              (p) => (p.tipo_inventario || "equipe") === "gestor",
            );
            return !temIntegradaGestorPendente && temElegiveisGestor;
          })() &&
            isSGJTAdmin &&
            !isAvaliadorLideranca && (
              <Card
                className="bg-gray-50 border border-gray-300 shadow-sm hover:border-teal-400 hover:shadow-md transition-all group cursor-pointer"
                onClick={() => setCurrentView("inv_gestor_integrada_respostas")}
              >
                <CardContent className="p-6 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                      <Scale className="h-5 w-5 text-violet-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800 text-base group-hover:text-teal-600 transition-colors">
                        Avaliação Integrada
                      </h3>
                      <p className="text-sm text-gray-500 mt-0.5">
                        Avaliação de Consenso.
                      </p>
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
  );

  // ── Competências Padrão (tela unificada) ─────────────────────
  if (currentView === "competencias_padrao_admin") {
    return (
      <CompetenciasPadraoAdmin
        isSuperadmin={isSGJT}
        onVoltar={() => setCurrentView("inventario")}
      />
    );
  }

  // ── Competências Técnicas (admin por unidade) ─────────────────────
  if (currentView === "competencias_tecnicas_admin") {
    return (
      <div className="bg-white rounded-xl p-6 space-y-6 shadow-sm border border-gray-200">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentView("referencial_home")}
            className="text-gray-700 hover:text-gray-900 hover:bg-gray-100"
          >
            <ArrowLeft className="h-4 w-4 mr-1" /> Voltar
          </Button>
          <h2 className="text-2xl font-bold text-gray-900">
            Gerenciar Competências Técnicas
          </h2>
        </div>
        <CompetenciasTecnicasAdmin />
      </div>
    );
  }

  // ── Hub (página única — módulos se desdobram em acordeão) ─────────────
  // Todas as regras de visibilidade são idênticas às das antigas telas de menu:
  // cada seção/sub-seção só aparece se o gate correspondente for verdadeiro.
  const showMatriz = isSGJT || referencialAutorizado;
  const temIntegradaEquipePendente = integradaPendentes.some(
    (p) => (p.tipo_inventario || "equipe") === "equipe",
  );
  const temIntegradaGestorPendente = integradaPendentes.some(
    (p) => (p.tipo_inventario || "equipe") === "gestor",
  );
  const showInvEquipe =
    temUnidadeColaborador ||
    isGestorDeUnidade ||
    isSGJTAdmin ||
    temIntegradaEquipePendente;
  const showInvGestor =
    isAvaliadorLideranca ||
    isSGJTAdmin ||
    isGestorDeUnidade ||
    temIntegradaGestorPendente;

  return (
    <div className="p-6 space-y-6 max-w-7xl">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 border-l-4 border-blue-500 pl-4">
          Gestão por Competências
        </h2>
        <p className="text-sm text-gray-500 mt-2 pl-5">
          Selecione um módulo para expandir e acessar as ações disponíveis para
          o seu perfil.
        </p>
      </div>

      <div className="space-y-4">
        {/* Matriz de Competências — só para quem tem permissão ou SGJT */}
        {showMatriz && (
          <HubSection
            open={openSections.has("matriz")}
            onToggle={() => toggleSection("matriz")}
            icon={<BookOpen className="h-6 w-6 text-blue-600" />}
            iconBg="bg-blue-100"
            title="Matriz de Competências"
          >
            {matrizCards}
          </HubSection>
        )}

        {/* Inventário de Competências */}
        <HubSection
          open={openSections.has("inventario")}
          onToggle={() => toggleSection("inventario")}
          icon={<ClipboardCheck className="h-6 w-6 text-blue-600" />}
          iconBg="bg-blue-100"
          title="Inventário de Competências"
        >
          <div className="space-y-4">
            {showInvEquipe && (
              <HubSubSection
                open={openSections.has("inv_equipe")}
                onToggle={() => toggleSection("inv_equipe")}
                icon={<Users className="h-5 w-5 text-blue-600" />}
                iconBg="bg-blue-100"
                title="Inventário de Competências da Equipe"
              >
                {invEquipeCards}
              </HubSubSection>
            )}
            {showInvGestor && (
              <HubSubSection
                open={openSections.has("inv_gestor")}
                onToggle={() => toggleSection("inv_gestor")}
                icon={<UserCog className="h-5 w-5 text-blue-600" />}
                iconBg="bg-blue-100"
                title="Inventário de Competências do Gestor"
              >
                {invGestorCards}
              </HubSubSection>
            )}
            {!showInvEquipe && !showInvGestor && (
              <p className="text-sm text-gray-500 px-1 py-2">
                Nenhum inventário disponível para o seu perfil no momento.
              </p>
            )}
          </div>
        </HubSection>
      </div>
    </div>
  );
}
