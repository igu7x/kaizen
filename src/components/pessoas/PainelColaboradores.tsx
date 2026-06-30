import { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useDirectorate } from "@/contexts/DirectorateContext";
import { areasApi, Area, Unidade } from "@/services/areasApi";
import { pessoasApi, Pessoa, CreatePessoaDto } from "@/services/pessoasApi";
import { api } from "@/services/api";
import { User as UserType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Command as CommandPrimitive } from "cmdk";
import {
  Plus,
  Check,
  X as XIcon,
  Users,
  Loader2,
  Building2,
  User,
  Eye,
  ShieldCheck,
  ArrowRightLeft,
  Star,
  Briefcase,
  GraduationCap,
  BookOpen,
  Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import OrganogramaUnidades from "./OrganogramaUnidades";
import PerfilPessoaModal from "./PerfilPessoaModal";

// Situações funcionais disponíveis
const SITUACOES_FUNCIONAIS = [
  "ESTATUTÁRIO",
  "CEDIDO",
  "NOMEADO EM COMISSÃO - INSS",
  "TERCEIRIZADO",
  "RESIDENTE",
  "ESTAGIÁRIO",
];

interface FormData {
  user_id: number | null;
  nome: string;
  email: string;
  nome_exibicao: string;
  unidade_id: number | null;
  situacao: string;
  cc_fc: string;
  cc_fc_classe: string;
  cargo_efetivo: string;
  cargo_efetivo_classe: string;
  linha_organograma: number;
}

const initialFormData: FormData = {
  user_id: null,
  nome: "",
  email: "",
  nome_exibicao: "",
  unidade_id: null,
  situacao: "ESTATUTÁRIO",
  cc_fc: "",
  cc_fc_classe: "",
  cargo_efetivo: "",
  cargo_efetivo_classe: "",
  linha_organograma: 4,
};

export function PainelColaboradores() {
  const { user } = useAuth();
  const { devEnvironment } = useDirectorate();
  const [areas, setAreas] = useState<Area[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selectedAreaId, setSelectedAreaId] = useState<number | null>(null);
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<number | null>(
    null,
  );
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [filteredPessoas, setFilteredPessoas] = useState<Pessoa[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPessoas, setLoadingPessoas] = useState(false);
  const [loadingUnidades, setLoadingUnidades] = useState(false);
  const [usuarios, setUsuarios] = useState<UserType[]>([]);
  const [userSearch, setUserSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [editandoId, setEditandoId] = useState<number | "novo" | null>(null);
  const [openUserSelect, setOpenUserSelect] = useState(false);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Quando true, o organograma mostra só as unidades em que o usuário logado
  // é responsável (gestor da unidade) + descendentes hierárquicos.
  const [showOnlySubordinated, setShowOnlySubordinated] = useState(false);
  // Modal de visualização de perfil (gestor visualizando dados de cada
  // colaborador subordinado). Só aparece em modo "subordinadas a mim".
  const [perfilModalPessoaId, setPerfilModalPessoaId] = useState<number | null>(
    null,
  );

  const formRowRef = useRef<HTMLTableRowElement>(null);
  const tableRef = useRef<HTMLDivElement>(null);
  const userSelectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userSelectRef.current && !userSelectRef.current.contains(event.target as Node)) {
        setOpenUserSelect(false);
      }
    };
    if (openUserSelect) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [openUserSelect]);

  const isAdmin = user?.role === "ADMIN";
  const isManager = user?.role === "MANAGER";
  const canEdit = isAdmin || isManager;

  // Carregar áreas ao montar ou quando devEnvironment muda
  useEffect(() => {
    loadAreas();
  }, [devEnvironment]);

  // Carregar unidades quando área muda; também limpa unidade selecionada (volta pra visão da macroárea)
  useEffect(() => {
    if (selectedAreaId) {
      loadUnidades(selectedAreaId);
      setSelectedUnidadeId(null);
    } else {
      setUnidades([]);
      setSelectedUnidadeId(null);
      setPessoas([]);
      setFilteredPessoas([]);
    }
  }, [selectedAreaId]);

  // Filtrar pessoas por busca
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredPessoas(pessoas);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const filtered = pessoas.filter(
      (p) =>
        p.nome.toLowerCase().includes(query) ||
        p.situacao?.toLowerCase().includes(query) ||
        p.cc_fc?.toLowerCase().includes(query) ||
        p.cargo_efetivo?.toLowerCase().includes(query),
    );
    setFilteredPessoas(filtered);
  }, [pessoas, searchQuery]);

  const loadAreas = async () => {
    try {
      setLoading(true);
      setError(null);
      // Carregar áreas do domínio (ou do devEnvironment)
      const allAreas = devEnvironment
        ? await areasApi.getByDominio(devEnvironment)
        : await areasApi.getAll();
      setAreas(allAreas);
      
      // Carregar todos os usuários do domínio (para o dropdown)
      const dominio = devEnvironment || (user as any)?.dominio || undefined;
      const allUsers = await api.getUsers(dominio);
      setUsuarios(allUsers.filter(u => u.status === "ACTIVE"));
      
      // Selecionar primeira área automaticamente
      if (allAreas.length > 0 && !selectedAreaId) {
        setSelectedAreaId(allAreas[0].id);
      }
    } catch (err) {
      setError("Erro ao carregar áreas. Tente novamente.");
    } finally {
      setLoading(false);
    }
  };

  const loadPessoas = async (areaId: number) => {
    try {
      setLoadingPessoas(true);
      setError(null);
      const data = await pessoasApi.getByAreaId(areaId);
      // Ordenar colaboradores alfabeticamente por nome
      const sortedData = [...data].sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
      );
      setPessoas(sortedData);
      setFilteredPessoas(sortedData);
    } catch (err) {
      setError("Erro ao carregar pessoas. Tente novamente.");
    } finally {
      setLoadingPessoas(false);
    }
  };

  const loadPessoasByUnidade = async (unidadeId: number) => {
    try {
      setLoadingPessoas(true);
      setError(null);
      const data = await pessoasApi.getByUnidadeId(unidadeId);
      // Ordenar colaboradores alfabeticamente por nome
      const sortedData = [...data].sort((a, b) =>
        (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
      );
      setPessoas(sortedData);
      setFilteredPessoas(sortedData);
    } catch (err) {
      setError("Erro ao carregar pessoas. Tente novamente.");
    } finally {
      setLoadingPessoas(false);
    }
  };

  const loadUnidades = async (areaId: number) => {
    try {
      setLoadingUnidades(true);
      const data = await areasApi.getUnidades(areaId);
      setUnidades(data);
    } catch (err) {
      setUnidades([]);
    } finally {
      setLoadingUnidades(false);
    }
  };

  const selectedArea = areas.find((a) => a.id === selectedAreaId);
  const selectedUnidade = unidades.find((u) => u.id === selectedUnidadeId);

  // Identifica a unidade raiz (a que representa a macroárea) — clicar nela mostra a "visão geral".
  // Tenta casar primeiro por nome completo, depois pela sigla da macroárea
  // (algumas áreas cadastraram a unidade-raiz só com a sigla — ex.: "GEJUT").
  const rootUnidadeId = useMemo(() => {
    if (!selectedArea || unidades.length === 0) return null;
    const norm = (s?: string) => (s || "").toLowerCase().trim();
    const nomeAlvo = norm(selectedArea.nome);
    const siglaAlvo = norm(selectedArea.sigla);
    const raizPreferida =
      unidades.find((u) => norm(u.nome) === nomeAlvo) ||
      (siglaAlvo
        ? unidades.find((u) => norm(u.nome) === siglaAlvo)
        : undefined);
    if (raizPreferida) return raizPreferida.id;
    const semSuperior = unidades.filter((u) => !u.unidade_superior_id);
    return semSuperior[0]?.id ?? null;
  }, [unidades, selectedArea]);

  // IDs das unidades em que o usuário logado é responsável (gestor da unidade)
  const minhasUnidadesIds = useMemo(() => {
    if (!user?.id) return new Set<number>();
    const uid = Number(user.id);
    return new Set(
      unidades
        .filter((u) => Number(u.responsavel_user_id || 0) === uid)
        .map((u) => u.id),
    );
  }, [unidades, user?.id]);

  // Lista de unidades a passar pro organograma: padrão é tudo da área; no modo
  // "subordinadas a mim" filtra para as unidades do gestor + descendentes (qualquer
  // unidade cujo unidade_superior_id remonta a uma das unidades do gestor). Pra que
  // o organograma renderize com as unidades do gestor como raiz, o `unidade_superior_id`
  // dessas raízes é zerado na cópia que mando pro componente.
  const unidadesParaOrganograma = useMemo(() => {
    if (!showOnlySubordinated || minhasUnidadesIds.size === 0) return unidades;
    const incluidos = new Set<number>(minhasUnidadesIds);
    let changed = true;
    while (changed) {
      changed = false;
      for (const u of unidades) {
        const sup = u.unidade_superior_id;
        if (sup != null && incluidos.has(sup) && !incluidos.has(u.id)) {
          incluidos.add(u.id);
          changed = true;
        }
      }
    }
    return unidades
      .filter((u) => incluidos.has(u.id))
      .map((u) =>
        minhasUnidadesIds.has(u.id) ? { ...u, unidade_superior_id: null } : u,
      );
  }, [unidades, showOnlySubordinated, minhasUnidadesIds]);

  // Carrega pessoas baseado no recorte atual:
  // - Modo "Unidades subordinadas a mim": só carrega quando uma unidade é selecionada.
  //   Sem unidade clicada → tabela vazia (não puxa todos da macroárea).
  // - Modo normal sem unidade selecionada (ou unidade raiz selecionada): macroárea inteira (visão "geral").
  // - Modo normal com unidade interna selecionada: só as pessoas daquela unidade.
  // Em qualquer clique no organograma rola até a tabela.
  useEffect(() => {
    if (!selectedAreaId) return;

    if (showOnlySubordinated) {
      if (selectedUnidadeId) {
        loadPessoasByUnidade(selectedUnidadeId);
        const timer = setTimeout(() => {
          tableRef.current?.scrollIntoView({
            behavior: "smooth",
            block: "center",
          });
        }, 120);
        return () => clearTimeout(timer);
      }
      // Modo subordinadas sem unidade clicada: zera a tabela
      setPessoas([]);
      setFilteredPessoas([]);
      return;
    }

    const isRootSelected =
      selectedUnidadeId !== null && selectedUnidadeId === rootUnidadeId;
    const showMacroView = !selectedUnidadeId || isRootSelected;

    if (showMacroView) {
      loadPessoas(selectedAreaId);
    } else {
      loadPessoasByUnidade(selectedUnidadeId!);
    }

    if (selectedUnidadeId) {
      const timer = setTimeout(() => {
        tableRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }, 120);
      return () => clearTimeout(timer);
    }
  }, [selectedAreaId, selectedUnidadeId, rootUnidadeId, showOnlySubordinated]);

  // Calcular estatísticas
  const estatisticas = {
    total: pessoas.length,
    estatutarios: pessoas.filter((p) => p.situacao === "ESTATUTÁRIO").length,
    cedidos: pessoas.filter((p) => p.situacao === "CEDIDO").length,
    comissionados: pessoas.filter(
      (p) => p.situacao === "NOMEADO EM COMISSÃO - INSS",
    ).length,
    terceirizados: pessoas.filter((p) => p.situacao === "TERCEIRIZADO").length,
    residentes: pessoas.filter((p) => p.situacao === "RESIDENTE").length,
    estagiarios: pessoas.filter((p) => p.situacao === "ESTAGIÁRIO").length,
  };

  const calcPercentual = (valor: number) => {
    if (estatisticas.total === 0) return 0;
    return Math.round((valor / estatisticas.total) * 100);
  };

  const handleAdicionar = () => {
    setEditandoId("novo");
    setFormData({ ...initialFormData, unidade_id: null, linha_organograma: 4, user_id: null, email: "" });
    setTimeout(() => {
      formRowRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 100);
  };

  const handleEditar = (pessoa: Pessoa) => {
    setEditandoId(pessoa.id);
    setFormData({
      nome: pessoa.nome,
      email: pessoa.email || "",
      nome_exibicao: pessoa.nome_exibicao || "",
      unidade_id: pessoa.unidade_id || null,
      situacao: pessoa.situacao || "ESTATUTÁRIO",
      cc_fc: pessoa.cc_fc || "",
      cc_fc_classe: pessoa.cc_fc_classe || "",
      cargo_efetivo: pessoa.cargo_efetivo || "",
      cargo_efetivo_classe: pessoa.cargo_efetivo_classe || "",
      linha_organograma: pessoa.linha_organograma || 4,
      user_id: pessoa.user_id || null,
    });
  };

  const handleVoltarParaUnidades = () => {
    setSelectedUnidadeId(null);
    setPessoas([]);
    setFilteredPessoas([]);
  };

  const handleUnidadeReorder = async (unidadeId: number, newOrdem: number) => {
    if (!selectedAreaId) return;

    try {
      // Encontrar a unidade sendo movida
      const unidadeMovida = unidades.find((u) => u.id === unidadeId);
      if (!unidadeMovida) return;

      // Encontrar todas as unidades no mesmo nível (mesmo unidade_superior_id)
      const unidadesNoNivel = unidades
        .filter(
          (u) => u.unidade_superior_id === unidadeMovida.unidade_superior_id,
        )
        .sort((a, b) => (a.ordem || 0) - (b.ordem || 0));

      // Encontrar a unidade alvo (a que tem a ordem = newOrdem)
      const unidadeAlvo = unidadesNoNivel.find((u) => u.ordem === newOrdem);
      if (!unidadeAlvo || unidadeAlvo.id === unidadeId) return;

      // Trocar as posições
      const ordemOriginal = unidadeMovida.ordem || 0;
      const ordenacao = [
        { id: unidadeMovida.id, ordem: newOrdem },
        { id: unidadeAlvo.id, ordem: ordemOriginal },
      ];

      await areasApi.reorderUnidades(selectedAreaId, ordenacao);
      // Recarregar unidades
      await loadUnidades(selectedAreaId);
    } catch (err: any) {
      setError(err.message || "Erro ao reordenar unidades");
      throw err;
    }
  };

  const handleSalvar = async () => {
    if (!formData.nome.trim()) {
      setError("Nome é obrigatório");
      return;
    }

    if (!selectedAreaId || !selectedUnidadeId) {
      setError("Selecione uma área e unidade");
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const data: CreatePessoaDto = {
        area_id: selectedAreaId,
        unidade_id: selectedUnidadeId,
        nome: formData.nome.trim(),
        nome_exibicao: formData.nome_exibicao.trim() || undefined,
        situacao: formData.situacao || undefined,
        cc_fc: formData.cc_fc.trim() || undefined,
        cc_fc_classe: formData.cc_fc_classe.trim() || undefined,
        cargo_efetivo: formData.cargo_efetivo.trim() || undefined,
        cargo_efetivo_classe: formData.cargo_efetivo_classe.trim() || undefined,
        linha_organograma: formData.linha_organograma,
        user_id: formData.user_id,
        email: formData.email,
      };

      if (editandoId === "novo") {
        await pessoasApi.create(data);
      } else if (typeof editandoId === "number") {
        await pessoasApi.update(editandoId, {
          nome: data.nome,
          nome_exibicao: data.nome_exibicao,
          unidade_id: data.unidade_id,
          situacao: data.situacao,
          cc_fc: data.cc_fc,
          cc_fc_classe: data.cc_fc_classe,
          cargo_efetivo: data.cargo_efetivo,
          cargo_efetivo_classe: data.cargo_efetivo_classe,
          linha_organograma: data.linha_organograma,
          user_id: data.user_id,
          email: data.email,
        });
      }

      await loadPessoasByUnidade(selectedUnidadeId);
      setEditandoId(null);
      setFormData(initialFormData);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar pessoa");
    } finally {
      setSaving(false);
    }
  };

  const handleCancelar = () => {
    setEditandoId(null);
    setFormData(initialFormData);
    setError(null);
  };

  const handleExcluir = async (id: number) => {
    if (!window.confirm("Tem certeza que deseja excluir esta pessoa?")) {
      return;
    }

    try {
      setError(null);
      await pessoasApi.remove(id);
      if (selectedUnidadeId) {
        await loadPessoasByUnidade(selectedUnidadeId);
      }
    } catch (err: any) {
      setError(err.message || "Erro ao excluir pessoa");
    }
  };

  const getSituacaoBadgeStyle = (situacao?: string) => {
    switch (situacao) {
      case "ESTATUTÁRIO":
        return "bg-green-100 text-green-800 border border-green-300";
      case "CEDIDO":
        return "bg-orange-100 text-orange-800 border border-orange-300";
      case "NOMEADO EM COMISSÃO - INSS":
        return "bg-purple-100 text-purple-800 border border-purple-300";
      case "TERCEIRIZADO":
        return "bg-blue-100 text-blue-800 border border-blue-300";
      case "RESIDENTE":
        return "bg-cyan-100 text-cyan-800 border border-cyan-300";
      case "ESTAGIÁRIO":
        return "bg-rose-100 text-rose-800 border border-rose-300";
      default:
        return "bg-gray-100 text-gray-800 border border-gray-300";
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 text-blue-500 animate-spin mb-4" />
        <p className="text-gray-600">Carregando áreas...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 min-h-0 h-full">
      {/* Erro Global */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg flex items-center justify-between flex-shrink-0">
          <span className="text-sm">{error}</span>
          <button
            onClick={() => setError(null)}
            className="text-red-700 hover:text-red-900 transition-colors"
          >
            <XIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ===== BARRA DE FILTRO POR ÁREA (sem box) ===== */}
      <div className="flex items-center justify-between gap-3 px-1">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-600">Áreas:</span>
          <Select
            value={selectedAreaId?.toString() || ""}
            onValueChange={(value) => setSelectedAreaId(parseInt(value))}
          >
            <SelectTrigger className="w-64 h-8 text-xs bg-white border-gray-300">
              <SelectValue placeholder="Selecione uma área" />
            </SelectTrigger>
            <SelectContent>
              {areas.map((area) => (
                <SelectItem
                  key={area.id}
                  value={area.id.toString()}
                  className="text-xs"
                >
                  {area.nome}
                </SelectItem>
              ))}
              {areas.length === 0 && (
                <SelectItem value="_empty" disabled>
                  Nenhuma área cadastrada
                </SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {minhasUnidadesIds.size > 0 && (
            <Button
              onClick={() => {
                // Ao alternar o modo, sempre limpa a unidade selecionada pra
                // forçar o usuário a clicar de novo (tabela parte vazia no modo
                // "subordinadas a mim" e na visão geral também).
                setSelectedUnidadeId(null);
                setShowOnlySubordinated((prev) => !prev);
              }}
              variant={showOnlySubordinated ? "default" : "outline"}
              className={`h-8 px-3 text-xs ${
                showOnlySubordinated
                  ? "bg-violet-600 hover:bg-violet-700 text-white"
                  : "border-violet-300 text-violet-700 hover:bg-violet-50"
              }`}
            >
              <Building2 className="mr-1.5 h-3.5 w-3.5" />
              {showOnlySubordinated
                ? "Ver todas as unidades"
                : "Unidades subordinadas a mim"}
            </Button>
          )}
        </div>
      </div>

      {/* Mensagem se não houver áreas */}
      {areas.length === 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
          <Building2 className="h-12 w-12 mx-auto text-yellow-500 mb-2" />
          <p className="text-yellow-700 font-medium">Nenhuma área cadastrada</p>
          <p className="text-yellow-600 text-sm">
            Cadastre áreas em Cadastros → Áreas primeiro
          </p>
        </div>
      )}

      {/* ===== ORGANOGRAMA DE UNIDADES ===== */}
      {selectedArea && (
        <div
          className={`flex gap-3 flex-1 min-w-0 overflow-hidden ${selectedUnidadeId ? "" : ""}`}
        >
          {/* Organograma */}
          <div className="flex-1 min-w-0 overflow-hidden">
            <OrganogramaUnidades
              unidades={unidadesParaOrganograma}
              areaNome={
                showOnlySubordinated ? "Minhas Unidades" : selectedArea.nome
              }
              areaSigla={showOnlySubordinated ? undefined : selectedArea.sigla}
              loading={loadingUnidades}
              onUnidadeClick={(unidade) => setSelectedUnidadeId(unidade.id)}
              onUnidadeReorder={
                showOnlySubordinated ? undefined : handleUnidadeReorder
              }
              selectedUnidadeId={selectedUnidadeId}
              canEdit={canEdit && !showOnlySubordinated}
              forceVerticalLayout={showOnlySubordinated}
            />
          </div>

          {/* Estatísticas — sempre visíveis quando há área; reflete a macroárea ou a unidade selecionada */}
          {selectedArea && (
            <div className="w-[230px] space-y-2 flex-shrink-0">
              {/* Total em destaque */}
              <div className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-lg px-4 py-3 shadow-md">
                <div className="text-xs font-semibold uppercase tracking-wider text-white/60">
                  Total
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-4xl font-bold text-white leading-none">
                    {estatisticas.total}
                  </span>
                  <span className="text-xs text-white/70">
                    {estatisticas.total === 1 ? "colaborador" : "colaboradores"}
                  </span>
                </div>
              </div>

              {/* Categorias por situação funcional — badge com ícone temático por categoria */}
              {[
                {
                  label: "Estatutários",
                  value: estatisticas.estatutarios,
                  Icon: ShieldCheck,
                  bg: "bg-emerald-50",
                  fg: "text-emerald-600",
                },
                {
                  label: "Cedidos",
                  value: estatisticas.cedidos,
                  Icon: ArrowRightLeft,
                  bg: "bg-amber-50",
                  fg: "text-amber-600",
                },
                {
                  label: "Comissionados",
                  value: estatisticas.comissionados,
                  Icon: Star,
                  bg: "bg-violet-50",
                  fg: "text-violet-600",
                },
                {
                  label: "Terceirizados",
                  value: estatisticas.terceirizados,
                  Icon: Briefcase,
                  bg: "bg-sky-50",
                  fg: "text-sky-600",
                },
                {
                  label: "Residentes",
                  value: estatisticas.residentes,
                  Icon: GraduationCap,
                  bg: "bg-teal-50",
                  fg: "text-teal-600",
                },
                {
                  label: "Estagiários",
                  value: estatisticas.estagiarios,
                  Icon: BookOpen,
                  bg: "bg-pink-50",
                  fg: "text-pink-600",
                },
              ].map((stat) => {
                const Icon = stat.Icon;
                return (
                  <div
                    key={stat.label}
                    className="bg-white border border-gray-200 rounded-lg px-3 py-2.5 flex items-center gap-3 shadow-sm hover:shadow hover:border-gray-300 transition"
                  >
                    <div
                      className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg ${stat.bg} ${stat.fg}`}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs text-gray-500 leading-tight truncate">
                        {stat.label}
                      </div>
                      <div className="text-lg font-bold text-gray-900 leading-tight">
                        {stat.value}
                      </div>
                    </div>
                    <div className="text-xs font-semibold text-gray-400 tabular-nums">
                      {calcPercentual(stat.value)}%
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ===== TABELA DE PESSOAS ===== Macroárea inteira por padrão; só da unidade quando uma é clicada */}
      {selectedArea && (
        <div
          ref={tableRef}
          className="rounded-2xl overflow-hidden shadow-2xl max-h-[400px] flex flex-col"
        >
          <div className="overflow-auto flex-1">
            <table className="w-full">
              <thead className="sticky top-0 z-10">
                <tr className="bg-gradient-to-r from-slate-700 to-slate-800">
                  <th className="px-5 py-3 text-left text-sm font-bold text-white uppercase tracking-wide">
                    <div className="flex items-center gap-3">
                      <span>Colaborador(a)</span>
                      <div className="relative flex-1 max-w-xs">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-white/50 pointer-events-none" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Buscar por nome..."
                          className="h-7 w-full pl-8 pr-7 rounded-md bg-white/10 border border-white/20 text-xs font-normal text-white placeholder:text-white/50 normal-case tracking-normal focus:outline-none focus:bg-white/15 focus:border-white/40 transition-colors"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-white/60 hover:text-white transition-colors"
                            title="Limpar busca"
                          >
                            <XIcon className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">
                    Situação Funcional
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">
                    CC/FC
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">
                    Código
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">
                    Cargo Efetivo
                  </th>
                  <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">
                    Classe
                  </th>
                  {showOnlySubordinated && (
                    <th className="px-5 py-4 text-center text-sm font-bold text-white uppercase tracking-wide">
                      Ações
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-100">
                {/* Linha de Adição/Edição */}
                {editandoId !== null && (
                  <tr ref={formRowRef} className="bg-blue-50/80">
                    <td className="px-5 py-3">
                      <div className="relative w-full" ref={userSelectRef}>
                        <Command className="overflow-visible bg-transparent">
                          <div 
                            className={cn(
                              "flex items-center border rounded-md px-3 bg-white h-9",
                              editandoId !== "novo" ? "bg-gray-100 cursor-not-allowed border-gray-200 opacity-50" : "border-blue-300 focus-within:ring-1 focus-within:ring-ring"
                            )}
                            onClick={() => {
                              if (editandoId === "novo") {
                                setOpenUserSelect(true);
                              }
                            }}
                          >
                            <CommandPrimitive.Input 
                              value={userSearch}
                              onValueChange={(val) => {
                                setUserSearch(val);
                                if (!openUserSelect) setOpenUserSelect(true);
                              }}
                              onFocus={() => {
                                if (editandoId === "novo") setOpenUserSelect(true);
                              }}
                              disabled={editandoId !== "novo"}
                              placeholder={
                                formData.user_id 
                                  ? (usuarios.find((u) => u.id === formData.user_id)?.name || formData.nome)
                                  : "Buscar usuário..."
                              }
                              className="border-none focus:ring-0 w-full h-full bg-transparent px-0 disabled:cursor-not-allowed text-sm"
                            />
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </div>
                          {openUserSelect && (
                            <div className="absolute top-full left-0 z-50 mt-1 w-[300px] rounded-md border bg-popover shadow-md outline-none animate-in fade-in-0 zoom-in-95">
                              <CommandList>
                                <CommandEmpty>Nenhum usuário encontrado.</CommandEmpty>
                                <CommandGroup>
                                  {usuarios.map((u) => (
                                    <CommandItem
                                      key={u.id}
                                      value={u.name}
                                      onSelect={() => {
                                        setFormData({
                                          ...formData,
                                          user_id: u.id,
                                          nome: u.name,
                                          email: u.email,
                                          situacao: u.situacao_funcional || "ESTATUTÁRIO",
                                          cc_fc: u.nome_cc_fc || "",
                                          cc_fc_classe: u.classe_cc_fc || "",
                                          cargo_efetivo: u.cargo_efetivo || "",
                                          cargo_efetivo_classe: u.classe_efetivo || "",
                                        });
                                        setOpenUserSelect(false);
                                      }}
                                    >
                                      <Check
                                        className={cn(
                                          "mr-2 h-4 w-4",
                                          formData.user_id === u.id ? "opacity-100" : "opacity-0"
                                        )}
                                      />
                              {u.name} ({u.dominio})
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </div>
                  )}
                </Command>
              </div>
                    </td>
                    <td className="px-5 py-3">
                      <Input
                        type="text"
                        value={formData.situacao}
                        readOnly
                        disabled
                        className="h-9 bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Input
                        type="text"
                        value={formData.cc_fc}
                        readOnly
                        disabled
                        placeholder="Opcional"
                        className="h-9 bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Input
                        type="text"
                        value={formData.cc_fc_classe}
                        readOnly
                        disabled
                        placeholder="Opcional"
                        className="h-9 bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <Input
                        type="text"
                        value={formData.cargo_efetivo}
                        readOnly
                        disabled
                        placeholder="Opcional"
                        className="h-9 bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed"
                      />
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2">
                        <Input
                          type="text"
                          value={formData.cargo_efetivo_classe}
                          readOnly
                          disabled
                          placeholder="Opcional"
                          className="h-9 bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed flex-1"
                        />
                        <button
                          onClick={handleSalvar}
                          disabled={saving}
                          className="p-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors disabled:opacity-50"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Check className="h-4 w-4" />
                          )}
                        </button>
                        <button
                          onClick={handleCancelar}
                          disabled={saving}
                          className="p-2 rounded-lg bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors disabled:opacity-50"
                        >
                          <XIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Linhas de Dados */}
                {filteredPessoas.map((pessoa, index) => (
                  <tr
                    key={pessoa.id}
                    className={`${index % 2 === 0 ? "bg-white" : "bg-gray-50/50"} hover:bg-blue-50/50 transition-colors`}
                  >
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        {pessoa.foto_perfil ? (
                          <img
                            src={pessoa.foto_perfil}
                            alt={pessoa.nome}
                            className="h-10 w-10 rounded-full object-cover ring-1 ring-gray-200 flex-shrink-0"
                          />
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-gray-100 ring-1 ring-gray-200 flex items-center justify-center flex-shrink-0">
                            <User className="h-5 w-5 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="font-semibold text-gray-900 truncate">
                            {pessoa.nome}
                          </p>
                          {pessoa.nome_exibicao && (
                            <p className="text-gray-400 text-xs truncate">
                              ({pessoa.nome_exibicao})
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span
                        className={cn(
                          "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold",
                          getSituacaoBadgeStyle(pessoa.situacao),
                        )}
                      >
                        {pessoa.situacao || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-gray-600">
                        {pessoa.cc_fc || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-gray-600">
                        {pessoa.cc_fc_classe || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-gray-600">
                        {pessoa.cargo_efetivo || "—"}
                      </span>
                    </td>
                    <td className="px-5 py-4 text-center">
                      <span className="text-gray-600">
                        {pessoa.cargo_efetivo_classe || "—"}
                      </span>
                    </td>
                    {showOnlySubordinated && (
                      <td className="px-5 py-4 text-center">
                        <button
                          onClick={() => setPerfilModalPessoaId(pessoa.id)}
                          className="inline-flex items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-700 transition-colors hover:bg-violet-100 hover:border-violet-300"
                          title="Visualizar perfil deste colaborador"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Visualizar Perfil
                        </button>
                      </td>
                    )}
                  </tr>
                ))}

                {/* Tabela Vazia */}
                {filteredPessoas.length === 0 && editandoId === null && (
                  <tr>
                    <td
                      colSpan={showOnlySubordinated ? 7 : 6}
                      className="h-40 text-center bg-white"
                    >
                      <div className="flex flex-col items-center justify-center text-gray-500">
                        <Users className="h-12 w-12 text-gray-300 mb-3" />
                        <p className="text-lg font-medium">
                          Nenhuma pessoa encontrada
                        </p>
                        {searchQuery ? (
                          <p className="text-sm text-gray-400 mt-1">
                            Tente ajustar os termos da pesquisa
                          </p>
                        ) : (
                          canEdit && (
                            <p className="text-sm text-gray-400 mt-1">
                              Clique em "Adicionar" para começar
                            </p>
                          )
                        )}
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Rodapé da Tabela */}
          {filteredPessoas.length > 0 && (
            <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-sm text-gray-600">
              <span className="font-semibold">{filteredPessoas.length}</span> de{" "}
              <span className="font-semibold">{pessoas.length}</span> pessoas
              {searchQuery && " (filtrado)"}
            </div>
          )}
        </div>
      )}

      {/* Modal de visualização de perfil — só aparece em modo "subordinadas a mim". */}
      <PerfilPessoaModal
        pessoaId={perfilModalPessoaId}
        open={perfilModalPessoaId !== null}
        onOpenChange={(open) => {
          if (!open) setPerfilModalPessoaId(null);
        }}
      />
    </div>
  );
}
