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
  PacCertificado,
  progressoCapacitacao,
  vagasEfetivas,
  PacParametros,
} from "@/services/pacCapacitacaoApi";
import { getColaboradores, Colaborador } from "@/services/colaboradoresApi";
import { PacMetasCards } from "@/components/pessoas/PacMetasCards";
import { areasApi, Area } from "@/services/areasApi";
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
  Award,
  Download,
  Upload,
  FileText,
  CheckCircle2,
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

interface CertForm {
  colaborador_id: number | null;
  nome_servidor: string;
  diretoria: string;
  arquivo_nome: string;
  arquivo_data: string;
}
const CERT_VAZIO: CertForm = {
  colaborador_id: null,
  nome_servidor: "",
  diretoria: "",
  arquivo_nome: "",
  arquivo_data: "",
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
  const [parametros, setParametros] = useState<PacParametros | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandido, setExpandido] = useState<number | null>(null);

  const [busca, setBusca] = useState("");
  const [filtroArea, setFiltroArea] = useState("todas");
  const [filtroStatus, setFiltroStatus] = useState("todos");

  const [dialogAberto, setDialogAberto] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState<PacCapacitacaoInput>(FORM_VAZIO);
  const [salvando, setSalvando] = useState(false);
  const [excluir, setExcluir] = useState<PacCapacitacaoItem | null>(null);

  // Certificados
  const [certsPorItem, setCertsPorItem] = useState<
    Record<number, PacCertificado[]>
  >({});
  const [loadingCerts, setLoadingCerts] = useState<Record<number, boolean>>({});
  const [colaboradores, setColaboradores] = useState<Colaborador[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [certDialogItem, setCertDialogItem] =
    useState<PacCapacitacaoItem | null>(null);
  const [certForm, setCertForm] = useState<CertForm>(CERT_VAZIO);
  const [salvandoCert, setSalvandoCert] = useState(false);
  const [excluirCert, setExcluirCert] = useState<{
    cert: PacCertificado;
    capacitacaoId: number;
  } | null>(null);

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

  /** Recarrega os números da Meta 2 (total de servidores + capacitados). */
  const carregarParametros = () => {
    pacCapacitacaoApi
      .getParametros(modulo)
      .then(setParametros)
      .catch(() => setParametros(null));
  };

  const salvarTotalServidores = async (valor: number) => {
    try {
      const atualizado = await pacCapacitacaoApi.salvarParametros(
        modulo,
        valor,
      );
      setParametros(atualizado);
    } catch {
      /* erro tratado no apiClient */
    }
  };

  useEffect(() => {
    carregar();
    carregarParametros();
    getColaboradores()
      .then(setColaboradores)
      .catch(() => setColaboradores([]));
    areasApi
      .getAll()
      .then(setAreas)
      .catch(() => setAreas([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modulo]);

  const carregarCerts = async (capacitacaoId: number) => {
    setLoadingCerts((p) => ({ ...p, [capacitacaoId]: true }));
    try {
      const certs = await pacCapacitacaoApi.listCertificados(capacitacaoId);
      setCertsPorItem((p) => ({ ...p, [capacitacaoId]: certs }));
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setLoadingCerts((p) => ({ ...p, [capacitacaoId]: false }));
    }
  };

  const toggleExpand = (it: PacCapacitacaoItem) => {
    const abrindo = expandido !== it.id;
    setExpandido(abrindo ? it.id : null);
    if (abrindo && certsPorItem[it.id] === undefined) carregarCerts(it.id);
  };

  /** Áreas demandantes efetivamente cadastradas nos itens da matriz. */
  const areasDemandantes = useMemo(
    () =>
      Array.from(
        new Set(
          itens.map((it) => (it.area_demandante || "").trim()).filter(Boolean),
        ),
      ).sort((a, b) => a.localeCompare(b)),
    [itens],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return itens.filter((it) => {
      if (filtroArea !== "todas" && (it.area_demandante || "") !== filtroArea)
        return false;
      // Status deriva do progresso: 100% dos certificados = concluído; abaixo disso, pendente.
      if (filtroStatus !== "todos") {
        const concluido = progressoCapacitacao(it) >= 100;
        if (concluido !== (filtroStatus === "concluido")) return false;
      }
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
  }, [itens, busca, filtroArea, filtroStatus]);

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

  // ---- Certificados ----
  const abrirCertDialog = (it: PacCapacitacaoItem) => {
    setCertDialogItem(it);
    setCertForm(CERT_VAZIO);
  };

  const onSelecionarPdf = (file: File | undefined) => {
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Anexe um arquivo PDF.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      setCertForm((f) => ({
        ...f,
        arquivo_data: String(reader.result || ""),
        arquivo_nome: file.name,
      }));
    reader.readAsDataURL(file);
  };

  const salvarCert = async () => {
    if (!certDialogItem) return;
    if (!certForm.nome_servidor.trim()) {
      toast.error("Selecione o servidor.");
      return;
    }
    if (!certForm.arquivo_data) {
      toast.error("Anexe o PDF do certificado.");
      return;
    }
    setSalvandoCert(true);
    try {
      await pacCapacitacaoApi.addCertificado(certDialogItem.id, {
        colaborador_id: certForm.colaborador_id,
        nome_servidor: certForm.nome_servidor.trim(),
        diretoria: certForm.diretoria.trim() || null,
        arquivo_nome: certForm.arquivo_nome || null,
        arquivo_data: certForm.arquivo_data || null,
      });
      toast.success("Certificado adicionado.");
      const capId = certDialogItem.id;
      setCertDialogItem(null);
      // Certificado mexe no progresso do item E no total de servidores capacitados (Meta 2).
      await Promise.all([carregarCerts(capId), carregar()]);
      carregarParametros();
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvandoCert(false);
    }
  };

  const baixarCert = async (cert: PacCertificado) => {
    try {
      const { arquivo_data, arquivo_nome } =
        await pacCapacitacaoApi.getCertificadoArquivo(cert.id);
      if (!arquivo_data) {
        toast.warning("Certificado sem arquivo anexado.");
        return;
      }
      const blob = await (await fetch(arquivo_data)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = arquivo_nome || `certificado-${cert.nome_servidor}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      toast.warning("Não foi possível baixar o certificado.");
    }
  };

  const confirmarExclusaoCert = async () => {
    if (!excluirCert) return;
    try {
      await pacCapacitacaoApi.removeCertificado(excluirCert.cert.id);
      toast.success("Certificado removido.");
      const capId = excluirCert.capacitacaoId;
      setExcluirCert(null);
      // Certificado mexe no progresso do item E no total de servidores capacitados (Meta 2).
      await Promise.all([carregarCerts(capId), carregar()]);
      carregarParametros();
    } catch {
      /* erro tratado no apiClient */
    }
  };

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
                ver detalhes e certificados.
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
          <Select value={filtroArea} onValueChange={setFiltroArea}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Área Demandante" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Área Demandante</SelectItem>
              {areasDemandantes.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filtroStatus} onValueChange={setFiltroStatus}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Status</SelectItem>
              <SelectItem value="concluido">Concluído</SelectItem>
              <SelectItem value="pendente">Pendente</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Metas e status — calculados sobre TODOS os itens do módulo, não sobre `filtrados`:
            é o desempenho do plano, não da busca em tela. */}
        <PacMetasCards
          totalAcoes={itens.length}
          acoesConcluidas={
            itens.filter((it) => progressoCapacitacao(it) >= 100).length
          }
          totalServidores={parametros?.total_servidores ?? 0}
          servidoresCapacitados={parametros?.servidores_capacitados ?? 0}
          onSalvarTotalServidores={salvarTotalServidores}
        />

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
                  <th className="px-3 py-3 min-w-[150px]">Progresso</th>
                  <th className="px-3 py-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={10} className="px-3 py-16 text-center">
                      <Loader2 className="h-6 w-6 animate-spin text-gray-400 mx-auto" />
                    </td>
                  </tr>
                ) : filtrados.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="px-3 py-16 text-center text-gray-500"
                    >
                      Nenhum item encontrado.
                    </td>
                  </tr>
                ) : (
                  filtrados.map((it) => (
                    <FragmentRow
                      key={it.id}
                      it={it}
                      aberto={expandido === it.id}
                      onToggle={() => toggleExpand(it)}
                      onEdit={() => abrirEdicao(it)}
                      onDelete={() => setExcluir(it)}
                      certs={certsPorItem[it.id]}
                      loadingCerts={!!loadingCerts[it.id]}
                      onAddCert={() => abrirCertDialog(it)}
                      onDownloadCert={baixarCert}
                      onDeleteCert={(cert) =>
                        setExcluirCert({ cert, capacitacaoId: it.id })
                      }
                    />
                  ))
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
              {editId
                ? "Editar item de capacitação"
                : "Novo item de capacitação"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-6 py-2">
            <Secao
              icone={<Layers className="h-4 w-4" />}
              titulo="Identificação"
            >
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
                        e.target.value === "" ? null : Number(e.target.value),
                      )
                    }
                    placeholder="Em branco = 1 vaga no progresso"
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

      {/* Dialog Adicionar Certificado */}
      <Dialog
        open={!!certDialogItem}
        onOpenChange={(o) => !o && setCertDialogItem(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Adicionar certificado</DialogTitle>
          </DialogHeader>
          {certDialogItem && (
            <p className="text-sm text-gray-500 -mt-2 mb-1">
              {certDialogItem.codigo ? `${certDialogItem.codigo} — ` : ""}
              {certDialogItem.evento_capacitacao}
            </p>
          )}
          <div className="space-y-4 py-1 min-w-0">
            <div className="min-w-0">
              <Label className="mb-1.5 block">
                Servidor <span className="text-red-500">*</span>
              </Label>
              <ColaboradorPicker
                colaboradores={colaboradores}
                nomeSelecionado={certForm.nome_servidor}
                onSelecionar={(c) =>
                  setCertForm((f) => ({
                    ...f,
                    colaborador_id: c.id,
                    nome_servidor: c.colaborador,
                    diretoria: (c.diretoria as unknown as string) || "",
                  }))
                }
                onLimpar={() => setCertForm(CERT_VAZIO)}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">Diretoria</Label>
              <DiretoriaPicker
                areas={areas}
                value={certForm.diretoria}
                onChange={(v) => setCertForm((f) => ({ ...f, diretoria: v }))}
              />
            </div>
            <div>
              <Label className="mb-1.5 block">
                Certificado (PDF) <span className="text-red-500">*</span>
              </Label>
              {certForm.arquivo_data ? (
                <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm">
                  <FileText className="h-4 w-4 text-emerald-600 flex-shrink-0" />
                  <span
                    className="flex-1 min-w-0 truncate text-emerald-900"
                    title={certForm.arquivo_nome}
                  >
                    {certForm.arquivo_nome}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setCertForm((f) => ({
                        ...f,
                        arquivo_data: "",
                        arquivo_nome: "",
                      }))
                    }
                    className="text-emerald-600 hover:text-red-600 flex-shrink-0"
                    title="Remover"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <label className="flex items-center justify-center gap-2 rounded-md border border-dashed border-gray-300 px-3 py-3 text-sm text-gray-500 cursor-pointer hover:border-emerald-400 hover:text-emerald-600 transition-colors">
                  <Upload className="h-4 w-4" />
                  Selecionar PDF do certificado
                  <input
                    type="file"
                    accept="application/pdf"
                    className="hidden"
                    onChange={(e) => onSelecionarPdf(e.target.files?.[0])}
                  />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCertDialogItem(null)}
              disabled={salvandoCert}
            >
              Cancelar
            </Button>
            <Button
              onClick={salvarCert}
              disabled={salvandoCert}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {salvandoCert && (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              )}
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação de exclusão do item */}
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

      {/* Confirmação de exclusão de certificado */}
      <AlertDialog
        open={!!excluirCert}
        onOpenChange={(o) => !o && setExcluirCert(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover certificado</AlertDialogTitle>
            <AlertDialogDescription>
              Remover o certificado de{" "}
              <span className="font-semibold">
                {excluirCert?.cert.nome_servidor}
              </span>
              ? O progresso será recalculado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmarExclusaoCert}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Layout>
  );
}

/** Linha da tabela + painel de detalhes (colunas azuis) e certificados ao expandir. */
function FragmentRow({
  it,
  aberto,
  onToggle,
  onEdit,
  onDelete,
  certs,
  loadingCerts,
  onAddCert,
  onDownloadCert,
  onDeleteCert,
}: {
  it: PacCapacitacaoItem;
  aberto: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  certs: PacCertificado[] | undefined;
  loadingCerts: boolean;
  onAddCert: () => void;
  onDownloadCert: (cert: PacCertificado) => void;
  onDeleteCert: (cert: PacCertificado) => void;
}) {
  const progresso = progressoCapacitacao(it);
  const total = vagasEfetivas(it.numero_vagas);
  const feitos = it.certificados_count ?? 0;
  const completo = progresso >= 100;

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
          <div className="flex items-center gap-2 min-w-[130px]">
            <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  completo ? "bg-emerald-500" : "bg-blue-500"
                }`}
                style={{ width: `${progresso}%` }}
              />
            </div>
            <span
              className={`text-xs font-semibold tabular-nums ${
                completo ? "text-emerald-600" : "text-gray-600"
              }`}
            >
              {progresso}%
            </span>
          </div>
          <span className="text-[11px] text-gray-400">
            {feitos}/{total} certificado{total > 1 ? "s" : ""}
          </span>
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
          <td colSpan={10} className="px-4 py-5">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Detalhes (colunas azuis) */}
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
                    label="Competências"
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

              {/* Certificados dos participantes */}
              <div className="rounded-xl border border-emerald-100 bg-white p-5">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2 text-emerald-700">
                    <Award className="h-4 w-4" />
                    <span className="text-sm font-semibold">
                      Certificados dos participantes
                      {certs ? ` (${certs.length})` : ""}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={onAddCert}
                    className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar
                  </Button>
                </div>

                {loadingCerts ? (
                  <div className="flex items-center gap-2 text-sm text-gray-400 py-4">
                    <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
                  </div>
                ) : !certs || certs.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">
                    Nenhum certificado lançado ainda.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {certs.map((cert) => (
                      <li
                        key={cert.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2"
                      >
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 truncate">
                            {cert.nome_servidor}
                          </p>
                          {cert.diretoria && (
                            <p className="text-xs text-gray-500">
                              {cert.diretoria}
                            </p>
                          )}
                        </div>
                        {cert.tem_arquivo && (
                          <button
                            onClick={() => onDownloadCert(cert)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors"
                            title="Baixar certificado"
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        <button
                          onClick={() => onDeleteCert(cert)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

/** Autocomplete de colaborador cadastrado (nome + diretoria vêm do cadastro). */
function ColaboradorPicker({
  colaboradores,
  nomeSelecionado,
  onSelecionar,
  onLimpar,
}: {
  colaboradores: Colaborador[];
  nomeSelecionado: string;
  onSelecionar: (c: Colaborador) => void;
  onLimpar: () => void;
}) {
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState(false);

  const q = busca.trim().toLowerCase();
  const filtrados = colaboradores
    .filter((c) => !q || c.colaborador.toLowerCase().includes(q))
    .slice(0, 50);

  if (nomeSelecionado) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
        <Users className="h-4 w-4 text-blue-600 flex-shrink-0" />
        <span
          className="flex-1 min-w-0 truncate text-blue-900"
          title={nomeSelecionado}
        >
          {nomeSelecionado}
        </span>
        <button
          type="button"
          onClick={() => {
            onLimpar();
            setBusca("");
          }}
          className="text-blue-500 hover:text-red-600 flex-shrink-0"
          title="Trocar servidor"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    );
  }

  // Dropdown inline (não usa Popover em portal): dentro de um Dialog modal do Radix, o
  // portal do Popover cai fora do foco/pointer-events do modal e a lista não aparece.
  return (
    <div className="relative">
      <Input
        placeholder="Digite o nome do servidor…"
        value={busca}
        onChange={(e) => {
          setBusca(e.target.value);
          setAberto(true);
        }}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {/* Só mostra a lista quando o usuário começa a digitar. */}
      {aberto && q.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtrados.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-500">
              Nenhum servidor encontrado.
            </div>
          ) : (
            filtrados.map((c) => (
              <div
                key={c.id}
                className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                onMouseDown={() => {
                  onSelecionar(c);
                  setBusca("");
                  setAberto(false);
                }}
              >
                <span className="font-medium text-gray-800">
                  {c.colaborador}
                </span>
                <span className="text-gray-400">
                  {" "}
                  — {(c.diretoria as unknown as string) || "—"}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

/** Combobox de diretoria: lista as áreas cadastradas ao digitar; aceita valor livre. */
function DiretoriaPicker({
  areas,
  value,
  onChange,
}: {
  areas: Area[];
  value: string;
  onChange: (v: string) => void;
}) {
  const [aberto, setAberto] = useState(false);
  const q = value.trim().toLowerCase();
  const filtrados = areas
    .filter(
      (a) =>
        !q ||
        (a.sigla || "").toLowerCase().includes(q) ||
        (a.nome || "").toLowerCase().includes(q),
    )
    .slice(0, 50);

  return (
    <div className="relative">
      <Input
        placeholder="Selecione ou digite a diretoria…"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setAberto(true);
        }}
        onFocus={() => setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
      />
      {aberto && filtrados.length > 0 && (
        <div className="absolute z-50 mt-1 w-full max-h-60 overflow-y-auto rounded-md border border-gray-200 bg-white shadow-lg">
          {filtrados.map((a) => (
            <div
              key={a.id}
              className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
              onMouseDown={() => {
                onChange(a.sigla || a.nome);
                setAberto(false);
              }}
            >
              <span className="font-medium text-gray-800">
                {a.sigla || a.nome}
              </span>
              {a.sigla && a.nome && (
                <span className="text-gray-400"> — {a.nome}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
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
