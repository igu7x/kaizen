import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  BookOpen,
  Users,
  UserCog,
  ClipboardCheck,
  UserCheck,
  Scale,
  GitCompare,
  ShieldAlert,
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
import { AvaliacaoIntegradaResumo } from "./AvaliacaoIntegradaResumo";
import { AvaliacaoIntegradaRespostas } from "./AvaliacaoIntegradaRespostas";
import { CompetenciasPadraoAdmin } from "./CompetenciasPadraoAdmin";
import { CompetenciasTecnicasAdmin } from "./CompetenciasTecnicasAdmin";
import { isCompetenciasPadraoEnabled } from "@/utils/environment";
import { Wrench } from "lucide-react";

// Paleta dos módulos e itens do hub. Cada ação mantém a cor que já tinha nas telas antigas.
const HUB_CORES = {
  blue: {
    icone: "bg-blue-100 text-blue-600",
    anel: "ring-blue-400",
    texto: "text-blue-700",
  },
  emerald: {
    icone: "bg-emerald-100 text-emerald-600",
    anel: "ring-emerald-400",
    texto: "text-emerald-700",
  },
  amber: {
    icone: "bg-amber-100 text-amber-600",
    anel: "ring-amber-400",
    texto: "text-amber-700",
  },
  violet: {
    icone: "bg-violet-100 text-violet-600",
    anel: "ring-violet-400",
    texto: "text-violet-700",
  },
  teal: {
    icone: "bg-teal-100 text-teal-600",
    anel: "ring-teal-400",
    texto: "text-teal-700",
  },
} as const;

type CorHub = keyof typeof HUB_CORES;

/**
 * Item de um módulo do hub. Vira um card-filtro: clicar seleciona e a `relacao`
 * aparece no painel abaixo, sem trocar de tela. Itens com `aoAbrir` fogem disso e
 * abrem uma tela dedicada (catálogos e formulários longos).
 */
type ItemHub = {
  key: string;
  titulo: string;
  descricao: string;
  icon: ReactNode;
  cor: CorHub;
  /** Selo curto no card (ex.: "3 aguardando sua validação"). */
  badge?: string;
  /** Botões do painel (preencher/revisar) — abrem o formulário em tela cheia. */
  acoes?: ReactNode;
  /** Tabela exibida no painel abaixo dos cards. */
  relacao?: ReactNode;
  /** Quando definido, clicar no card abre uma tela dedicada em vez de selecionar. */
  aoAbrir?: () => void;
};

type ModuloHub = {
  key: string;
  titulo: string;
  descricao: string;
  icon: ReactNode;
  cor: CorHub;
  itens: ItemHub[];
};

/** Caixa de módulo (topo do hub). Fica sempre visível; a selecionada ganha anel. */
function ModuloBox({
  icon,
  cor,
  titulo,
  descricao,
  resumo,
  ativo,
  onClick,
}: {
  icon: ReactNode;
  cor: CorHub;
  titulo: string;
  descricao: string;
  resumo: string;
  ativo: boolean;
  onClick: () => void;
}) {
  const c = HUB_CORES[cor];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex h-full w-full flex-col rounded-2xl border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md ${
        ativo ? `ring-2 ring-offset-1 ${c.anel}` : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${c.icone}`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
          <p className="mt-0.5 text-xs leading-snug text-gray-500">
            {descricao}
          </p>
        </div>
      </div>
      <p className={`mt-3 text-sm font-semibold ${c.texto}`}>{resumo}</p>
    </button>
  );
}

/** Card de item: funciona como filtro do que aparece no painel abaixo. */
function ItemCard({
  item,
  ativo,
  onClick,
}: {
  item: ItemHub;
  ativo: boolean;
  onClick: () => void;
}) {
  const c = HUB_CORES[item.cor];
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={ativo}
      className={`flex h-full w-full items-start gap-3 rounded-xl border border-gray-200 bg-white p-4 text-left transition-all hover:border-gray-300 hover:shadow-sm ${
        ativo ? `ring-2 ring-offset-1 ${c.anel}` : ""
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${c.icone}`}
      >
        {item.icon}
      </div>
      <div className="min-w-0">
        <h4 className="text-sm font-semibold text-gray-800">{item.titulo}</h4>
        <p className="mt-0.5 text-xs leading-snug text-gray-500">
          {item.descricao}
        </p>
        {item.badge && (
          <span
            className={`mt-2 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold ${c.texto}`}
          >
            {item.badge}
          </span>
        )}
        {item.aoAbrir && (
          <span className="mt-2 flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <ChevronRight className="h-3.5 w-3.5" />
            Abre em tela própria
          </span>
        )}
      </div>
    </button>
  );
}

/** Painel abaixo dos cards: título, ações do item e a relação (tabela). */
function PainelItem({
  titulo,
  acoes,
  children,
}: {
  titulo: string;
  acoes?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-bold text-gray-900">{titulo}</h3>
        {acoes && <div className="ml-auto flex items-center gap-2">{acoes}</div>}
      </div>
      {children}
    </div>
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

/**
 * Views que caem no hub (nenhum return antecipado as intercepta). Qualquer outra é uma
 * tela dedicada, que ocupa a largura toda — a página usa isso pra alinhar o breadcrumb.
 */
const VIEWS_HUB: View[] = [
  "inventario",
  "referencial_home",
  "inventario_home",
  "inventario_equipe_home",
  "inventario_gestor_home",
];

export function GestaoCompetencias({
  onTelaCheiaChange,
}: {
  /** Avisa a página quando sai do hub (centralizado) para uma tela dedicada (full width). */
  onTelaCheiaChange?: (emTelaCheia: boolean) => void;
} = {}) {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<View>("inventario");

  useEffect(() => {
    onTelaCheiaChange?.(!VIEWS_HUB.includes(currentView));
  }, [currentView, onTelaCheiaChange]);
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
  const [diretoriaUsuario, setDiretoriaUsuario] = useState("");
  const [isDomainRoot, setIsDomainRoot] = useState(false);
  const [referencialAutorizado, setReferencialAutorizado] = useState<
    boolean | null
  >(null);
  const [isGestorDeUnidade, setIsGestorDeUnidade] = useState(false);
  const [integradaPendentes, setIntegradaPendentes] = useState<
    AvaliacaoIntegradaFormulario[]
  >([]);
  // Minha própria autoavaliação (equipe e gestor). O hub precisa disso pra saber se já
  // preenchi: sem isso o card fica eternamente em "Preencher" e o painel abaixo diz que
  // não há relação, mesmo com o formulário enviado e validado.
  const [minhaAutoEquipe, setMinhaAutoEquipe] =
    useState<AutoavaliacaoFormulario | null>(null);
  const [minhaAutoGestor, setMinhaAutoGestor] =
    useState<AutoavaliacaoFormulario | null>(null);
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

  // Seleção do hub: qual módulo está aberto e, dentro dele, qual item alimenta o
  // painel de baixo. Persiste enquanto o componente estiver montado, então voltar de
  // um formulário em tela cheia devolve o usuário exatamente onde ele estava.
  // `null` = ainda não escolheu; o render cai no primeiro módulo/item disponível.
  const [moduloAtivo, setModuloAtivo] = useState<string | null>(null);
  const [itemAtivo, setItemAtivo] = useState<Record<string, string>>({});

  // Verificar se há elegíveis para resultado final (1 chamada ao backend)
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
        // Resultado Final
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

  // Recarrega a minha autoavaliação toda vez que volto pro hub. O load principal roda uma
  // vez só (deps []), então sem isto o card não reflete o que acabei de preencher/validar.
  useEffect(() => {
    if (!VIEWS_HUB.includes(currentView)) return;
    let cancelado = false;
    (async () => {
      const [equipe, gestor] = await Promise.all([
        autoavaliacaoApi.getMeu("equipe").catch(() => null),
        autoavaliacaoApi.getMeu("gestor").catch(() => null),
      ]);
      if (cancelado) return;
      setMinhaAutoEquipe(equipe);
      setMinhaAutoGestor(gestor);
    })();
    return () => {
      cancelado = true;
    };
  }, [currentView]);

  /**
   * Painel de acompanhamento da PRÓPRIA autoavaliação. A relação existente
   * (`AutoavaliacaoRespostas`) é a visão de quem audita a diretoria inteira; quem preenche
   * precisa ver só o seu formulário.
   */
  const minhaAutoRelacao = (
    form: AutoavaliacaoFormulario | null,
    abrirResumo: (f: AutoavaliacaoFormulario) => void,
  ) =>
    form ? (
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-gray-200 p-4">
        <div className="space-y-1">
          <p className="text-sm font-semibold text-gray-900">
            {form.nome_completo}
          </p>
          <p className="text-xs text-gray-500">
            {form.status === "atualizacao_requisitada"
              ? "Atualização solicitada — revise e envie de novo."
              : form.validado_em
                ? `Validada em ${new Date(form.validado_em).toLocaleDateString("pt-BR")}`
                : "Enviada — falta você validar."}
            {form.total_respostas
              ? ` · ${form.total_respostas} competências`
              : ""}
          </p>
        </div>
        <Button variant="outline" onClick={() => abrirResumo(form)}>
          Ver minhas respostas
        </Button>
      </div>
    ) : undefined;

  /**
   * Selo do card. Só sai quando há PENDÊNCIA — `resumoModulo` conta itens com badge como
   * "com pendência", então formulário já validado não pode emitir selo. O estado "validada"
   * aparece na relação abaixo.
   */
  const minhaAutoBadge = (form: AutoavaliacaoFormulario | null) =>
    !form || form.validado_em
      ? undefined
      : form.status === "atualizacao_requisitada"
        ? "Atualização solicitada"
        : "Aguardando sua validação";

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

  // ── Resultado Final ──────────────────────────────────

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
            Resultado Final
          </h2>
        </div>
        <AvaliacaoIntegradaResumo
          formulario={integradaResumo}
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
            Resultado Final
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

  // ── Resultado Final do Gestor (Inventário Gestor) ──────────
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
            Resultado Final
          </h2>
        </div>
        <AvaliacaoIntegradaResumo
          formulario={integradaResumo}
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
            Resultado Final
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

  // ── Itens de cada módulo ───────────────────────────────────────────────
  // As condições abaixo são EXATAMENTE as mesmas dos cards antigos: cada item só
  // entra na lista se o gate do perfil permitir. Quem preenche ganha o botão de
  // ação; quem só acompanha recebe apenas a relação.

  // Matriz de Competências
  const itensMatriz: ItemHub[] = [];
  if (showMatriz) {
    itensMatriz.push({
      key: "matriz_equipe",
      titulo: "Competências da Equipe",
      descricao: "Mapeamento de competências dos colaboradores",
      icon: <Users className="h-5 w-5" />,
      cor: "blue",
      acoes: (
        <>
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
        </>
      ),
      relacao: (
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
      ),
    });

    if (isSGJT || isAvaliadorLideranca || ehGestorOuSubdiretorMacro) {
      itensMatriz.push({
        key: "matriz_gestor",
        titulo: "Competências do Gestor",
        descricao: "Mapeamento de competências dos gestores",
        icon: <UserCog className="h-5 w-5" />,
        cor: "blue",
        acoes: (
          <>
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
          </>
        ),
        relacao: (
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
        ),
      });
    }

    if (isGestorDeUnidade || ehGestorOuSubdiretorMacro || isSGJT) {
      itensMatriz.push({
        key: "matriz_padrao",
        titulo: "Competências Padrão",
        descricao: "Catálogo de competências padrão",
        icon: <BookOpen className="h-5 w-5" />,
        cor: "blue",
        aoAbrir: () => setCurrentView("competencias_padrao_view"),
      });
    }

    // Gerenciar Competências Técnicas — só superadmin, com referenciais preenchidos
    if (isSGJT && temReferencialGerenciavel && isCompetenciasPadraoEnabled()) {
      itensMatriz.push({
        key: "matriz_tecnicas",
        titulo: "Gerenciar Competências Técnicas",
        descricao: "Editar competências técnicas das suas unidades",
        icon: <Wrench className="h-5 w-5" />,
        cor: "blue",
        aoAbrir: () => setCurrentView("competencias_tecnicas_admin"),
      });
    }
  }

  // Inventário de Competências da Equipe
  const itensInvEquipe: ItemHub[] = [];
  if (showInvEquipe) {
    // Autoavaliação do Colaborador — apenas viewers (e admins/managers colaboradores de
    // unidade que NÃO sejam gestor de unidade nem avaliador da liderança); SGJT admins
    // só acompanham a relação.
    const autoEquipePreenche =
      (!isAdminOrManager || (temUnidadeColaborador && !isSGJTAdmin)) &&
      !isGestorDeUnidade &&
      !isAvaliadorLideranca;
    if (autoEquipePreenche || isSGJTAdmin) {
      itensInvEquipe.push({
        key: "auto_equipe",
        titulo: "Autoavaliação do Colaborador",
        descricao:
          "Registre sua autoavaliação das competências para a sua função.",
        icon: <ClipboardCheck className="h-5 w-5" />,
        cor: "emerald",
        badge: autoEquipePreenche ? minhaAutoBadge(minhaAutoEquipe) : undefined,
        acoes: autoEquipePreenche ? (
          <Button
            onClick={() => {
              // Formulário já enviado abre o resumo: reabrir o form cairia na tela de
              // bloqueio "Autoavaliação já enviada". Só 'atualizacao_requisitada' reabre.
              if (minhaAutoEquipe && minhaAutoEquipe.status !== "atualizacao_requisitada") {
                setAutoavaliacaoResumo(minhaAutoEquipe);
                setCurrentView("autoavaliacao_resumo");
              } else {
                setCurrentView("autoavaliacao");
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {!minhaAutoEquipe ? (
              <>
                <Plus className="h-4 w-4 mr-1.5" /> Preencher autoavaliação
              </>
            ) : minhaAutoEquipe.status === "atualizacao_requisitada" ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar autoavaliação
              </>
            ) : (
              <>
                <ClipboardCheck className="h-4 w-4 mr-1.5" /> Ver minha
                autoavaliação
              </>
            )}
          </Button>
        ) : undefined,
        relacao: isSGJTAdmin ? (
          <AutoavaliacaoRespostas
            diretoria={diretoriaUsuario}
            isDomainRoot={isDomainRoot}
            tipoInventario="equipe"
            onViewFormulario={(f) => {
              setAutoavaliacaoResumo(f);
              setCurrentView("autoavaliacao_resumo");
            }}
          />
        ) : (
          minhaAutoRelacao(minhaAutoEquipe, (f) => {
            setAutoavaliacaoResumo(f);
            setCurrentView("autoavaliacao_resumo");
          })
        ),
      });
    }

    // Resultado Final do próprio colaborador — não há mais validação, é só consulta.
    const integradaEquipePend = integradaPendentes.filter(
      (p) => (p.tipo_inventario || "equipe") === "equipe",
    );
    if (integradaEquipePend.length > 0 && !isGestorDeUnidade) {
      itensInvEquipe.push({
        key: "resultado_final_equipe_meu",
        titulo: "Meu Resultado Final",
        descricao:
          "Sua nota final: 70% da avaliação do gestor + 30% da sua autoavaliação.",
        icon: <Scale className="h-5 w-5" />,
        cor: "emerald",
        badge: `${integradaEquipePend.length} resultado${integradaEquipePend.length > 1 ? "s" : ""} disponível${integradaEquipePend.length > 1 ? "eis" : ""}`,
        aoAbrir: async () => {
          const target = integradaEquipePend[0];
          try {
            const fullForm = await avaliacaoIntegradaApi.getById(target.id);
            setIntegradaResumo(fullForm);
          } catch {
            setIntegradaResumo(target);
          }
          setCurrentView("integrada_resumo");
        },
      });
    }

    // Avaliação do Gestor — só quando há autoavaliações validadas ou já preenchidas
    if (temAvgestorEquipe && (isGestorDeUnidade || isSGJTAdmin)) {
      itensInvEquipe.push({
        key: "avgestor_equipe",
        titulo: "Avaliação do Gestor",
        descricao:
          "Registre as avaliações de competências dos colaboradores sob sua gestão.",
        icon: <UserCheck className="h-5 w-5" />,
        cor: "amber",
        acoes: isGestorDeUnidade ? (
          <Button
            onClick={() => setCurrentView("avgestor")}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Preencher avaliação
          </Button>
        ) : undefined,
        relacao: (
          <AvaliacaoGestorRespostas
            diretoria={diretoriaUsuario}
            isDomainRoot={isDomainRoot}
            tipoInventario="equipe"
            onViewFormulario={(f) => {
              setAvGestorResumo(f);
              setCurrentView("avgestor_resumo");
            }}
          />
        ),
      });
    }

    // Resultado Final (consenso da equipe)
    if (
      (isGestorDeUnidade && temElegiveisEquipe) ||
      (isSGJTAdmin && !isGestorDeUnidade)
    ) {
      itensInvEquipe.push({
        key: "resultado_final_equipe",
        titulo: "Resultado Final",
        descricao:
          "Calculado: 70% da avaliação do gestor + 30% da autoavaliação do colaborador.",
        icon: <Scale className="h-5 w-5" />,
        cor: "violet",
        relacao: (
          <AvaliacaoIntegradaRespostas
            diretoria={diretoriaUsuario}
            isDomainRoot={isDomainRoot}
            tipoInventario="equipe"
            onViewFormulario={(f) => {
              setIntegradaResumo(f);
              setCurrentView("integrada_resumo");
            }}
          />
        ),
      });
    }
  }

  // Inventário de Competências do Gestor
  const itensInvGestor: ItemHub[] = [];
  if (showInvGestor) {
    // Autoavaliação do Gestor — gestor de unidade SEMPRE preenche; admin/manager preenche
    // se não for avaliador da liderança; SGJT admins só acompanham.
    const autoGestorPreenche =
      ((isAdminOrManager && !isAvaliadorLideranca) || isGestorDeUnidade) &&
      !isSGJTAdmin;
    if (autoGestorPreenche || isSGJTAdmin) {
      itensInvGestor.push({
        key: "auto_gestor",
        titulo: "Autoavaliação do Gestor",
        descricao: "Registre sua autoavaliação das competências de gestão.",
        icon: <ClipboardCheck className="h-5 w-5" />,
        cor: "emerald",
        badge: autoGestorPreenche ? minhaAutoBadge(minhaAutoGestor) : undefined,
        acoes: autoGestorPreenche ? (
          <Button
            onClick={() => {
              // Formulário já enviado abre o resumo: reabrir o form cairia na tela de
              // bloqueio "Autoavaliação já enviada". Só 'atualizacao_requisitada' reabre.
              if (minhaAutoGestor && minhaAutoGestor.status !== "atualizacao_requisitada") {
                setAutoavaliacaoResumo(minhaAutoGestor);
                setCurrentView("inv_gestor_auto_resumo");
              } else {
                setCurrentView("inv_gestor_auto");
              }
            }}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {!minhaAutoGestor ? (
              <>
                <Plus className="h-4 w-4 mr-1.5" /> Preencher autoavaliação
              </>
            ) : minhaAutoGestor.status === "atualizacao_requisitada" ? (
              <>
                <RefreshCw className="h-4 w-4 mr-1.5" /> Atualizar autoavaliação
              </>
            ) : (
              <>
                <ClipboardCheck className="h-4 w-4 mr-1.5" /> Ver minha
                autoavaliação
              </>
            )}
          </Button>
        ) : undefined,
        relacao: isSGJTAdmin ? (
          <AutoavaliacaoRespostas
            diretoria={diretoriaUsuario}
            isDomainRoot={isDomainRoot}
            tipoInventario="gestor"
            onViewFormulario={(f) => {
              setAutoavaliacaoResumo(f);
              setCurrentView("inv_gestor_auto_resumo");
            }}
          />
        ) : (
          minhaAutoRelacao(minhaAutoGestor, (f) => {
            setAutoavaliacaoResumo(f);
            setCurrentView("inv_gestor_auto_resumo");
          })
        ),
      });
    }

    // Resultado Final (Gestor) — o gestor avaliado precisa validar
    const integradaGestorPend = integradaPendentes.filter(
      (p) => (p.tipo_inventario || "equipe") === "gestor",
    );
    if (integradaGestorPend.length > 0) {
      itensInvGestor.push({
        key: "resultado_final_gestor_meu",
        titulo: "Meu Resultado Final",
        descricao:
          "Sua nota final: 70% da avaliação da liderança + 30% da sua autoavaliação.",
        icon: <Scale className="h-5 w-5" />,
        cor: "emerald",
        badge: `${integradaGestorPend.length} resultado${integradaGestorPend.length > 1 ? "s" : ""} disponível${integradaGestorPend.length > 1 ? "eis" : ""}`,
        aoAbrir: async () => {
          const target = integradaGestorPend[0];
          try {
            const fullForm = await avaliacaoIntegradaApi.getById(target.id);
            setIntegradaResumo(fullForm);
          } catch {
            setIntegradaResumo(target);
          }
          setCurrentView("inv_gestor_integrada_resumo");
        },
      });
    }

    // Avaliação da Liderança — gestores/subdiretores de macroárea preenchem.
    // Sem exigir temAvgestorGestor: o avaliador pode avaliar o gestor da unidade ANTES
    // da autoavaliação existir. SGJT admin sem esse papel só acompanha, e só se houver dados.
    if (isAvaliadorLideranca || (isSGJTAdmin && temAvgestorGestor)) {
      itensInvGestor.push({
        key: "lideranca_gestor",
        titulo: "Avaliação da Liderança",
        descricao:
          "Registre as avaliações de competências dos líderes sob sua gestão.",
        icon: <ShieldAlert className="h-5 w-5" />,
        cor: "amber",
        acoes: isAvaliadorLideranca ? (
          <Button
            onClick={() => setCurrentView("inv_gestor_lideranca")}
            className="bg-amber-600 hover:bg-amber-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Preencher avaliação
          </Button>
        ) : undefined,
        relacao: (
          <AvaliacaoGestorRespostas
            diretoria={diretoriaUsuario}
            isDomainRoot={isDomainRoot}
            tipoInventario="gestor"
            onViewFormulario={(f) => {
              setAvGestorResumo(f);
              setCurrentView("inv_gestor_lideranca_resumo");
            }}
          />
        ),
      });
    }

    // Resultado Final (consenso dos gestores) — escondida quando há pendente acima
    if (
      integradaGestorPend.length === 0 &&
      temElegiveisGestor &&
      (isAdminOrManager || isAvaliadorLideranca || isSGJTAdmin)
    ) {
      itensInvGestor.push({
        key: "resultado_final_gestor",
        titulo: "Resultado Final",
        descricao:
          "Calculado: 70% da avaliação da liderança + 30% da autoavaliação do gestor.",
        icon: <Scale className="h-5 w-5" />,
        cor: "violet",
        relacao: (
          <AvaliacaoIntegradaRespostas
            diretoria={diretoriaUsuario}
            isDomainRoot={isDomainRoot}
            tipoInventario="gestor"
            onViewFormulario={(f) => {
              setIntegradaResumo(f);
              setCurrentView("inv_gestor_integrada_resumo");
            }}
          />
        ),
      });
    }
  }

  // ── Módulos visíveis (mesmos gates de antes; módulo sem item não aparece) ──
  const modulos: ModuloHub[] = ([
    showMatriz && {
      key: "matriz",
      titulo: "Matriz de Competências",
      descricao: "Mapeamento e catálogo de competências",
      icon: <BookOpen className="h-6 w-6" />,
      cor: "blue" as CorHub,
      itens: itensMatriz,
    },
    showInvEquipe && {
      key: "inv_equipe",
      titulo: "Inventário da Equipe",
      descricao: "Autoavaliação, avaliação do gestor e consenso dos colaboradores",
      icon: <Users className="h-6 w-6" />,
      cor: "teal" as CorHub,
      itens: itensInvEquipe,
    },
    showInvGestor && {
      key: "inv_gestor",
      titulo: "Inventário do Gestor",
      descricao: "Autoavaliação, avaliação da liderança e consenso dos gestores",
      icon: <UserCog className="h-6 w-6" />,
      cor: "violet" as CorHub,
      itens: itensInvGestor,
    },
  ] as (ModuloHub | false)[]).filter(
    (m): m is ModuloHub => !!m && m.itens.length > 0,
  );

  // Seleção resolvida no render: os gates chegam por chamadas assíncronas, então a
  // escolha do usuário só vale enquanto o módulo/item continuar disponível pra ele.
  const moduloSel =
    modulos.find((m) => m.key === moduloAtivo) ?? modulos[0] ?? null;
  const itensDoModulo = moduloSel?.itens ?? [];
  /** Item que abre painel abaixo (os com `aoAbrir` vão pra tela dedicada). */
  const selecionavel = (i: ItemHub): boolean => !i.aoAbrir;
  const itemSel = moduloSel
    ? (itensDoModulo.find(
        (i) => i.key === itemAtivo[moduloSel.key] && selecionavel(i),
      ) ??
      itensDoModulo.find(selecionavel) ??
      null)
    : null;

  const clicarItem = (item: ItemHub) => {
    if (item.aoAbrir) {
      item.aoAbrir();
      return;
    }
    if (!moduloSel) return;
    setItemAtivo((prev) => ({ ...prev, [moduloSel.key]: item.key }));
  };

  const resumoModulo = (m: ModuloHub) => {
    const acoes = `${m.itens.length} ${m.itens.length === 1 ? "ação disponível" : "ações disponíveis"}`;
    const pendentes = m.itens.filter((i) => i.badge).length;
    return pendentes > 0 ? `${acoes} · ${pendentes} com pendência` : acoes;
  };

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6 p-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900 border-l-4 border-blue-500 pl-4">
          Gestão por Competências
        </h2>
        <p className="text-sm text-gray-500 mt-2 pl-5">
          Escolha um módulo para ver as ações do seu perfil e a relação
          correspondente logo abaixo.
        </p>
      </div>

      {modulos.length === 0 ? (
        <p className="text-sm text-gray-500">
          Nenhum módulo de competências disponível para o seu perfil no momento.
        </p>
      ) : (
        <>
          {/* Módulos — sempre visíveis; o selecionado fica com anel */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {modulos.map((m) => (
              <ModuloBox
                key={m.key}
                icon={m.icon}
                cor={m.cor}
                titulo={m.titulo}
                descricao={m.descricao}
                resumo={resumoModulo(m)}
                ativo={moduloSel?.key === m.key}
                onClick={() => setModuloAtivo(m.key)}
              />
            ))}
          </div>

          {/* Itens do módulo ativo — funcionam como filtro do painel abaixo */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {itensDoModulo.map((item) => (
              <ItemCard
                key={item.key}
                item={item}
                ativo={itemSel?.key === item.key}
                onClick={() => clicarItem(item)}
              />
            ))}
          </div>

          {/* Relação do item selecionado */}
          {itemSel && (
            <PainelItem titulo={itemSel.titulo} acoes={itemSel.acoes}>
              {itemSel.relacao ?? (
                <p className="text-sm text-gray-500">
                  Não há relação para acompanhar aqui — use a ação acima para
                  preencher o formulário.
                </p>
              )}
            </PainelItem>
          )}
        </>
      )}
    </div>
  );
}
