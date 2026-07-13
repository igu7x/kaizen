import { useEffect, useMemo, useState } from "react";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  pacCapacitacaoApi,
  PacCapacitacaoItem,
  PacCapacitacaoInput,
} from "@/services/pacCapacitacaoApi";
import {
  GraduationCap,
  Plus,
  Search,
  ChevronDown,
  Pencil,
  Trash2,
  Loader2,
  Users,
  Target,
  ClipboardList,
  Info,
  Building2,
  Layers,
} from "lucide-react";
import { toast } from "sonner";

const CATEGORIAS = ["Curso", "Evento"];
const PRIORIDADES = ["Alta", "Média", "Baixa"];
const MODALIDADES = ["EAD", "Presencial"];
const COMPETENCIAS = [
  "Competência Técnica",
  "Competência Gerencial",
  "Competência Estratégica",
  "Competência Comportamental",
];

const prioridadeCor: Record<string, string> = {
  Alta: "bg-red-100 text-red-700 border-red-200",
  Média: "bg-amber-100 text-amber-700 border-amber-200",
  Baixa: "bg-slate-100 text-slate-600 border-slate-200",
};
const modalidadeCor: Record<string, string> = {
  EAD: "bg-blue-100 text-blue-700 border-blue-200",
  Presencial: "bg-violet-100 text-violet-700 border-violet-200",
};

const FORM_VAZIO: PacCapacitacaoInput = {
  codigo: "",
  area_demandante: "",
  categoria: "",
  tema: "",
  evento_capacitacao: "",
  objetivo_justificativa: "",
  publico_alvo: "",
  prioridade: "",
  numero_vagas: null,
  competencias: "",
  modalidade: "",
  estimativa_custo: "",
  observacoes: "",
};

interface PacCapacitacaoProps {
  titulo: string;
  modulo?: string;
}

export default function PacCapacitacao({
  titulo,
  modulo = "ti",
}: PacCapacitacaoProps) {
  const [itens, setItens] = useState<PacCapacitacaoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroPrioridade, setFiltroPrioridade] = useState("todas");
  const [filtroModalidade, setFiltroModalidade] = useState("todas");

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PacCapacitacaoInput>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<PacCapacitacaoItem | null>(null);

  const carregar = async () => {
    setLoading(true);
    try {
      const data = await pacCapacitacaoApi.list(modulo);
      setItens(data);
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    carregar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((it) => {
      if (filtroPrioridade !== "todas" && it.prioridade !== filtroPrioridade)
        return false;
      if (filtroModalidade !== "todas" && it.modalidade !== filtroModalidade)
        return false;
      if (!q) return true;
      return [
        it.codigo,
        it.area_demandante,
        it.evento_capacitacao,
        it.tema,
        it.publico_alvo,
        it.competencias,
        it.objetivo_justificativa,
      ]
        .filter(Boolean)
        .some((v) => String(v).toLowerCase().includes(q));
    });
  }, [itens, busca, filtroPrioridade, filtroModalidade]);

  const abrirNovo = () => {
    setEditId(null);
    setForm(FORM_VAZIO);
    setDialogAberto(true);
  };

  const abrirEdicao = (it: PacCapacitacaoItem) => {
    setEditId(it.id);
    setForm({
      codigo: it.codigo ?? "",
      area_demandante: it.area_demandante ?? "",
      categoria: it.categoria ?? "",
      tema: it.tema ?? "",
      evento_capacitacao: it.evento_capacitacao ?? "",
      objetivo_justificativa: it.objetivo_justificativa ?? "",
      publico_alvo: it.publico_alvo ?? "",
      prioridade: it.prioridade ?? "",
      numero_vagas: it.numero_vagas,
      competencias: it.competencias ?? "",
      modalidade: it.modalidade ?? "",
      estimativa_custo: it.estimativa_custo ?? "",
      observacoes: it.observacoes ?? "",
    });
    setDialogAberto(true);
  };

  const salvar = async () => {
    if (!form.evento_capacitacao?.trim()) {
      toast.error("Informe o evento de capacitação/treinamento.");
      return;
    }
    setSalvando(true);
    try {
      const payload: PacCapacitacaoInput = { ...form, modulo };
      if (editId) {
        await pacCapacitacaoApi.update(editId, payload);
        toast.success("Item atualizado com sucesso.");
      } else {
        await pacCapacitacaoApi.create(payload);
        toast.success("Item criado com sucesso.");
      }
      setDialogAberto(false);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvando(false);
    }
  };

  const confirmarExclusao = async () => {
    if (!excluir) return;
    try {
      await pacCapacitacaoApi.remove(excluir.id);
      toast.success("Item excluído com sucesso.");
      setExcluir(null);
      await carregar();
    } catch {
      /* erro tratado no apiClient */
    }
  };

  const set = (campo: keyof PacCapacitacaoInput, valor: unknown) =>
    setForm((prev) => ({ ...prev, [campo]: valor }));

  return (
    <Layout>
      <div className="space-y-6">
        {/* Cabeçalho */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
              <GraduationCap className="h-6 w-6 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{titulo}</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Matriz de Capacitação — {itens.length}{" "}
                {itens.length === 1 ? "item" : "itens"}. Clique numa linha para
                ver os detalhes.
              </p>
            </div>
          </div>
          <Button
            onClick={abrirNovo}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Novo item
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar por código, área, evento, tema, público…"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filtroPrioridade} onValueChange={setFiltroPrioridade}>
            <SelectTrigger className="w-full sm:w-44">
              <SelectValue placeholder="Prioridade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as prioridades</SelectItem>
              {PRIORIDADES.map((p) => (
                <SelectItem key={p} value={p}>
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroModalidade} onValueChange={setFiltroModalidade}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Modalidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas modalidades</SelectItem>
              {MODALIDADES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Tabela */}
        <div className="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="w-10 px-3 py-3"></th>
                  <th className="px-3 py-3">Código</th>
                  <th className="px-3 py-3 min-w-[220px]">Área Demandante</th>
                  <th className="px-3 py-3 min-w-[240px]">
                    Evento de Capacitação
                  </th>
                  <th className="px-3 py-3">Prioridade</th>
                  <th className="px-3 py-3 text-center">Vagas</th>
                  <th className="px-3 py-3">Modalidade</th>
                  <th className="px-3 py-3">Estimativa de custo</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={9} className="px-3 py-16 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={9}
                      className="px-3 py-16 text-center text-gray-500"
                    >
                      Nenhum item encontrado.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((it) => {
                    const aberto = expandido === it.id;
                    return (
                      <FragmentRow
                        key={it.id}
                        it={it}
                        aberto={aberto}
                        onToggle={() =>
                          setExpandido(aberto ? null : it.id)
                        }
                        onEdit={() => abrirEdicao(it)}
                        onDelete={() => setExcluir(it)}
                      />
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Dialog Criar/Editar */}
      <Dialog open={dialogAberto} onOpenChange={setDialogAberto}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editId ? "Editar item de capacitação" : "Novo item de capacitação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            {/* Identificação */}
            <Secao icone={<Layers className="h-4 w-4" />} titulo="Identificação">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Código">
                  <Input
                    value={form.codigo ?? ""}
                    onChange={(e) => set("codigo", e.target.value)}
                    placeholder="Ex.: PC38"
                  />
                </Campo>
                <Campo label="Categoria">
                  <Select
                    value={form.categoria || ""}
                    onValueChange={(v) => set("categoria", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label="Área Demandante" full>
                  <Input
                    value={form.area_demandante ?? ""}
                    onChange={(e) => set("area_demandante", e.target.value)}
                    placeholder="Ex.: Coordenadoria de Infraestrutura Tecnológica"
                  />
                </Campo>
                <Campo label="Tema" full>
                  <Input
                    value={form.tema ?? ""}
                    onChange={(e) => set("tema", e.target.value)}
                    placeholder="Ex.: Segurança da Informação"
                  />
                </Campo>
                <Campo label="Evento de Capacitação/Treinamento" full required>
                  <Input
                    value={form.evento_capacitacao ?? ""}
                    onChange={(e) => set("evento_capacitacao", e.target.value)}
                    placeholder="Ex.: Curso Zabbix 7"
                  />
                </Campo>
                <Campo label="Objetivo / Justificativa" full>
                  <Textarea
                    value={form.objetivo_justificativa ?? ""}
                    onChange={(e) =>
                      set("objetivo_justificativa", e.target.value)
                    }
                    rows={3}
                    placeholder="Descreva o objetivo e a justificativa da capacitação"
                  />
                </Campo>
              </div>
            </Secao>

            {/* Planejamento */}
            <Secao icone={<Target className="h-4 w-4" />} titulo="Planejamento">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Campo label="Público-Alvo">
                  <Input
                    value={form.publico_alvo ?? ""}
                    onChange={(e) => set("publico_alvo", e.target.value)}
                    placeholder="Ex.: Servidores da CITEC"
                  />
                </Campo>
                <Campo label="Prioridade">
                  <Select
                    value={form.prioridade || ""}
                    onValueChange={(v) => set("prioridade", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORIDADES.map((p) => (
                        <SelectItem key={p} value={p}>
                          {p}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label="Número de vagas">
                  <Input
                    type="number"
                    min={0}
                    value={form.numero_vagas ?? ""}
                    onChange={(e) =>
                      set(
                        "numero_vagas",
                        e.target.value === ""
                          ? null
                          : Number(e.target.value),
                      )
                    }
                    placeholder="Deixe em branco se não se aplica"
                  />
                </Campo>
                <Campo label="Competências a desenvolver">
                  <Select
                    value={form.competencias || ""}
                    onValueChange={(v) => set("competencias", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPETENCIAS.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label="Modalidade">
                  <Select
                    value={form.modalidade || ""}
                    onValueChange={(v) => set("modalidade", v)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {MODALIDADES.map((m) => (
                        <SelectItem key={m} value={m}>
                          {m}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Campo>
                <Campo label="Estimativa de custos (por pessoa)">
                  <Input
                    value={form.estimativa_custo ?? ""}
                    onChange={(e) => set("estimativa_custo", e.target.value)}
                    placeholder="Ex.: R$ 1.750,00 ou Ainda não definido"
                  />
                </Campo>
                <Campo label="Observações" full>
                  <Textarea
                    value={form.observacoes ?? ""}
                    onChange={(e) => set("observacoes", e.target.value)}
                    rows={2}
                    placeholder="Ex.: Curso na plataforma Udemy"
                  />
                </Campo>
              </div>
            </Secao>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogAberto(false)}
              disabled={salvando}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvar}
              disabled={salvando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
              {editId ? "Salvar alterações" : "Criar item"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão */}
      <AlertDialog
        open={!!excluir}
        onOpenChange={(o) => !o && setExcluir(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir{" "}
              <span className="font-semibold">
                {excluir?.codigo ? `${excluir.codigo} — ` : ""}
                {excluir?.evento_capacitacao}
              </span>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusao}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

/** Linha da tabela + painel de detalhes (colunas azuis) ao expandir. */
function FragmentRow({
  it,
  aberto,
  onToggle,
  onEdit,
  onDelete,
}: {
  it: PacCapacitacaoItem;
  aberto: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-gray-100 cursor-pointer transition-colors ${
          aberto ? "bg-emerald-50/50" : "hover:bg-gray-50"
        }`}
        onClick={onToggle}
      >
        <td className="px-3 py-3">
          <ChevronDown
            className={`h-4 w-4 text-gray-400 transition-transform ${
              aberto ? "rotate-180" : ""
            }`}
          />
        </td>
        <td className="px-3 py-3 font-semibold text-gray-700 whitespace-nowrap">
          {it.codigo || "—"}
        </td>
        <td className="px-3 py-3 text-gray-700">{it.area_demandante || "—"}</td>
        <td className="px-3 py-3 font-medium text-gray-900">
          {it.evento_capacitacao || "—"}
        </td>
        <td className="px-3 py-3">
          {it.prioridade ? (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                prioridadeCor[it.prioridade] ||
                "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {it.prioridade}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-3 text-center text-gray-700">
          {it.numero_vagas ?? "—"}
        </td>
        <td className="px-3 py-3">
          {it.modalidade ? (
            <span
              className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${
                modalidadeCor[it.modalidade] ||
                "bg-gray-100 text-gray-600 border-gray-200"
              }`}
            >
              {it.modalidade}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-3 py-3 text-gray-700 whitespace-nowrap">
          {it.estimativa_custo || "—"}
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center justify-end gap-1">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
              title="Editar"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
              title="Excluir"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
      {aberto && (
        <tr className="bg-emerald-50/30 border-b border-gray-100">
          <td colSpan={9} className="px-4 py-5">
            <div className="rounded-xl border border-emerald-100 bg-white p-5">
              <div className="flex items-center gap-2 mb-4 text-emerald-700">
                <Info className="h-4 w-4" />
                <span className="text-sm font-semibold">
                  Detalhes da capacitação
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4">
                <Detalhe
                  icone={<Layers className="h-4 w-4" />}
                  label="Categoria"
                  valor={it.categoria}
                />
                <Detalhe
                  icone={<ClipboardList className="h-4 w-4" />}
                  label="Tema"
                  valor={it.tema}
                />
                <Detalhe
                  icone={<Users className="h-4 w-4" />}
                  label="Público-Alvo"
                  valor={it.publico_alvo}
                />
                <Detalhe
                  icone={<Target className="h-4 w-4" />}
                  label="Competências a serem desenvolvidas"
                  valor={it.competencias}
                />
                <Detalhe
                  icone={<Info className="h-4 w-4" />}
                  label="Objetivo / Justificativa"
                  valor={it.objetivo_justificativa}
                  full
                />
                <Detalhe
                  icone={<Building2 className="h-4 w-4" />}
                  label="Observações"
                  valor={it.observacoes}
                  full
                />
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function Detalhe({
  icone,
  label,
  valor,
  full,
}: {
  icone: React.ReactNode;
  label: string;
  valor: string | null;
  full?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">
        <span className="text-gray-400">{icone}</span>
        {label}
      </div>
      <p className="text-sm text-gray-800 whitespace-pre-line [overflow-wrap:anywhere]">
        {valor?.trim() ? valor : "—"}
      </p>
    </div>
  );
}

function Secao({
  icone,
  titulo,
  children,
}: {
  icone: React.ReactNode;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3 text-emerald-700">
        {icone}
        <h3 className="text-sm font-semibold">{titulo}</h3>
      </div>
      {children}
    </div>
  );
}

function Campo({
  label,
  children,
  full,
  required,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
  required?: boolean;
}) {
  return (
    <div className={full ? "md:col-span-2" : ""}>
      <Label className="mb-1.5 block">
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      {children}
    </div>
  );
}
