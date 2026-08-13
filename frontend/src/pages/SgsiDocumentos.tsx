import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ChevronRight, Loader2, FileText, Search, FileClock } from "lucide-react";
import { cn } from "@/lib/utils";
import { Layout } from "@/components/layout/Layout";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  sgsiApi,
  SgsiDocumento,
  SgsiDocumentoStatus,
} from "@/services/sgsiApi";
import { SgsiDocumentoWorkflowDialog } from "@/components/sgsi/SgsiDocumentoWorkflowDialog";

const TODOS = "__todos__";

const TIPO_LABEL: Record<string, string> = {
  ATA_DE_HOMOLOGACAO_REUNIAO: "Ata de homologação/reunião",
  CHECKLIST: "Checklist",
  EVIDENCIA_REGISTRO_DE_CONFORMIDADE: "Evidência / registro",
  FLUXO_PROCESSO_INSTITUIDO: "Fluxo / processo",
  INDICADORES_PAINEL_DE_ACOMPANHAMENTO: "Indicadores / painel",
  INSTRUCAO_TECNICA_OPERACIONAL_ITO: "Instrução Técnica (ITO)",
  INVENTARIO_CATALOGO: "Inventário / catálogo",
  MATRIZ_RACI: "Matriz RACI",
  MINUTA_NORMATIVA: "Minuta normativa",
  PLANO: "Plano",
  PORTARIA_ATO_DE_DESIGNACAO: "Portaria / designação",
  PROCEDIMENTO_OPERACIONAL: "Procedimento operacional",
  QUADRO_MATRIZ: "Quadro / matriz",
  RELATORIO: "Relatório",
  RIPD_RELATORIO_DE_IMPACTO: "RIPD — Rel. de Impacto",
  TCI_TERMO_DE_CLASSIFICACAO: "TCI — Classificação",
  TERMO: "Termo",
};
const tipoLabel = (t: string) => TIPO_LABEL[t] ?? t;

const STATUS: Record<SgsiDocumentoStatus, { label: string; cls: string }> = {
  PENDENTE: { label: "Pendente", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
  EM_ELABORACAO: { label: "Em elaboração", cls: "bg-blue-50 text-blue-700 ring-blue-200" },
  EM_REVISAO: { label: "Em revisão", cls: "bg-indigo-50 text-indigo-700 ring-indigo-200" },
  EM_ASSINATURA: { label: "Em assinatura", cls: "bg-amber-50 text-amber-700 ring-amber-200" },
  ASSINADO: { label: "Assinado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  PUBLICADO: { label: "Publicado", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  CANCELADO: { label: "Cancelado", cls: "bg-red-50 text-red-600 ring-red-200" },
};
const STATUS_ORDEM: SgsiDocumentoStatus[] = [
  "PENDENTE",
  "EM_ELABORACAO",
  "EM_REVISAO",
  "EM_ASSINATURA",
  "ASSINADO",
  "PUBLICADO",
  "CANCELADO",
];

const prazo = (d: SgsiDocumento) => {
  if (d.prazo_data) {
    const m = d.prazo_data.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d.prazo_data;
  }
  return d.prazo_marco != null ? `M+${d.prazo_marco}` : "—";
};

export default function SgsiDocumentos() {
  const [docs, setDocs] = useState<SgsiDocumento[]>([]);
  const [loading, setLoading] = useState(true);
  const [fInstr, setFInstr] = useState(TODOS);
  const [fStatus, setFStatus] = useState(TODOS);
  const [fTipo, setFTipo] = useState(TODOS);
  const [busca, setBusca] = useState("");
  const [aberta, setAberta] = useState<number | null>(null);

  useEffect(() => {
    sgsiApi
      .listarDocumentos()
      .then(setDocs)
      .catch(() => {
        /* erro tratado no apiClient */
      })
      .finally(() => setLoading(false));
  }, []);

  const instrumentos = useMemo(() => {
    const map = new Map<string, string>();
    docs.forEach((d) => {
      if (d.instrumento_codigo)
        map.set(d.instrumento_codigo, d.instrumento_sigla || d.instrumento_codigo);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [docs]);

  const tipos = useMemo(
    () =>
      Array.from(new Set(docs.map((d) => d.tipo))).sort((a, b) =>
        tipoLabel(a).localeCompare(tipoLabel(b)),
      ),
    [docs],
  );

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return docs.filter((d) => {
      if (fInstr !== TODOS && d.instrumento_codigo !== fInstr) return false;
      if (fStatus !== TODOS && d.status !== fStatus) return false;
      if (fTipo !== TODOS && d.tipo !== fTipo) return false;
      if (
        q &&
        ![d.nome, d.referencia, d.responsavel].some((c) =>
          (c || "").toLowerCase().includes(q),
        )
      )
        return false;
      return true;
    });
  }, [docs, fInstr, fStatus, fTipo, busca]);

  const onAtualizado = (d: SgsiDocumento) =>
    setDocs((prev) => prev.map((x) => (x.id === d.id ? d : x)));

  return (
    <Layout>
      <div className="page-transition-enter min-h-full">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <Breadcrumbs
            items={[
              {
                label: "Segurança da Informação",
                to: "/seguranca-informacao/instrumentos",
              },
              { label: "Obrigações Documentais" },
            ]}
          />

          {/* Header */}
          <div className="mt-4 mb-6 flex items-center gap-4">
            <div
              className="w-1.5 h-12 rounded-full"
              style={{
                background: "linear-gradient(180deg, #0A2547 0%, #1565C0 100%)",
              }}
            />
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-600 mb-0.5">
                Segurança da Informação
              </p>
              <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
                <FileText className="h-6 w-6 text-blue-600" />
                Obrigações Documentais
              </h1>
              <p className="text-slate-500 mt-1 text-sm">
                Documentos exigidos pelos instrumentos normativos, com a
                referência que os impõe e a tarefa 5W2H de origem.
              </p>
            </div>
          </div>

          {/* Filtros */}
          <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FiltroSelect
              label="Instrumento"
              value={fInstr}
              onChange={setFInstr}
              options={instrumentos.map(([codigo, sigla]) => ({
                value: codigo,
                label: sigla,
              }))}
              todosLabel="Todos os instrumentos"
            />
            <FiltroSelect
              label="Tipo"
              value={fTipo}
              onChange={setFTipo}
              options={tipos.map((t) => ({ value: t, label: tipoLabel(t) }))}
              todosLabel="Todos os tipos"
            />
            <FiltroSelect
              label="Status"
              value={fStatus}
              onChange={setFStatus}
              options={STATUS_ORDEM.map((s) => ({
                value: s,
                label: STATUS[s].label,
              }))}
              todosLabel="Todos os status"
            />
            <div className="flex flex-col">
              <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Buscar
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Nome, referência…"
                  className="pl-9 h-10 bg-white"
                />
              </div>
            </div>
          </div>

          {/* Lista */}
          <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
            <div className="grid grid-cols-[32px_1fr_110px_170px_90px_130px] items-center gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-slate-500">
              <span></span>
              <span>Documento</span>
              <span>Instrumento</span>
              <span>Tipo</span>
              <span className="text-center">Prazo</span>
              <span className="text-center">Status</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16 text-slate-500">
                <Loader2 className="h-5 w-5 animate-spin mr-2" />
                Carregando obrigações…
              </div>
            ) : filtrados.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-slate-500">
                <FileText className="h-8 w-8 text-slate-300 mb-2" />
                <p className="text-sm">
                  Nenhuma obrigação para os filtros selecionados.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-slate-100">
                {filtrados.map((d) => (
                  <DocumentoLinha
                    key={d.id}
                    doc={d}
                    aberta={aberta === d.id}
                    onToggle={() =>
                      setAberta((cur) => (cur === d.id ? null : d.id))
                    }
                    onAtualizado={onAtualizado}
                  />
                ))}
              </ul>
            )}
          </div>

          <p className="mt-3 text-xs text-slate-400">
            {filtrados.length} de {docs.length} obrigaç
            {docs.length === 1 ? "ão" : "ões"}
          </p>
        </div>
      </div>
    </Layout>
  );
}

function FiltroSelect({
  label,
  value,
  onChange,
  options,
  todosLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  todosLabel: string;
}) {
  return (
    <div className="flex flex-col">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
        {label}
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-10 bg-white">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>{todosLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function DocumentoLinha({
  doc,
  aberta,
  onToggle,
  onAtualizado,
}: {
  doc: SgsiDocumento;
  aberta: boolean;
  onToggle: () => void;
  onAtualizado: (d: SgsiDocumento) => void;
}) {
  const st = STATUS[doc.status] ?? STATUS.PENDENTE;
  return (
    <li>
      <div
        role="button"
        tabIndex={0}
        aria-expanded={aberta}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="grid grid-cols-[32px_1fr_110px_170px_90px_130px] items-center gap-3 px-4 py-3 hover:bg-slate-50/60 cursor-pointer"
      >
        <span className="flex items-center justify-center text-slate-400">
          <ChevronRight
            className={cn("h-4 w-4 transition-transform", aberta && "rotate-90")}
          />
        </span>
        <p className="min-w-0 truncate text-sm text-slate-800">{doc.nome}</p>
        <span className="truncate text-sm text-slate-600">
          {doc.instrumento_sigla || doc.instrumento_codigo || "—"}
        </span>
        <span className="truncate text-xs text-slate-500">
          {tipoLabel(doc.tipo)}
        </span>
        <span className="text-center text-sm tabular-nums text-slate-600">
          {prazo(doc)}
        </span>
        <div className="flex justify-center">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
              st.cls,
            )}
          >
            {st.label}
          </span>
        </div>
      </div>
      {aberta && <DocumentoDetalhe doc={doc} onAtualizado={onAtualizado} />}
    </li>
  );
}

function DocumentoDetalhe({
  doc,
  onAtualizado,
}: {
  doc: SgsiDocumento;
  onAtualizado: (d: SgsiDocumento) => void;
}) {
  const [status, setStatus] = useState<SgsiDocumentoStatus>(doc.status);
  const [salvando, setSalvando] = useState(false);
  const [workflowAberto, setWorkflowAberto] = useState(false);

  const campos: [string, string | null][] = [
    ["Referência normativa", doc.referencia],
    ["Responsável", doc.responsavel],
    ["Atividade (5W2H)", doc.atividade],
    [
      "Tarefa de origem",
      doc.tarefa_numero != null
        ? `${doc.instrumento_sigla || doc.instrumento_codigo} · tarefa ${doc.tarefa_numero}`
        : null,
    ],
    ["Origem", doc.origem === "PLANO_5W2H" ? "Plano 5W2H" : "Registro manual"],
  ];

  const salvar = async () => {
    setSalvando(true);
    try {
      const upd = await sgsiApi.atualizarStatusDocumento(doc.id, status);
      onAtualizado(upd);
      toast.success("Status atualizado.");
    } catch {
      /* erro tratado no apiClient */
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="border-t border-slate-100 bg-slate-50/50 px-4 py-4 pl-11">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {campos
          .filter(([, v]) => v && v.trim())
          .map(([titulo, valor]) => (
            <div key={titulo}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400 mb-0.5">
                {titulo}
              </p>
              <p className="text-sm text-slate-700 whitespace-pre-wrap">
                {valor}
              </p>
            </div>
          ))}
      </div>

      <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-3">
          Situação do documento
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[220px_auto] sm:items-end">
          <div>
            <Label className="mb-1.5 block">Status</Label>
            <Select
              value={status}
              onValueChange={(v) => setStatus(v as SgsiDocumentoStatus)}
            >
              <SelectTrigger className="h-9 bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_ORDEM.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS[s].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button
            onClick={salvar}
            disabled={salvando || status === doc.status}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {salvando && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
            Salvar
          </Button>
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3">
          <p className="text-xs text-slate-500">
            {doc.versao_atual ? `v${doc.versao_atual}` : "sem versão"} ·{" "}
            {doc.assinaturas ?? 0} assinatura(s)
            {doc.checkout_id != null && doc.checkout_nome
              ? ` · em edição por ${doc.checkout_nome}`
              : ""}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setWorkflowAberto(true)}
          >
            <FileClock className="h-3.5 w-3.5 mr-1.5" />
            Elaborar / assinar
          </Button>
        </div>
      </div>

      <SgsiDocumentoWorkflowDialog
        doc={doc}
        open={workflowAberto}
        onOpenChange={setWorkflowAberto}
        onAtualizado={onAtualizado}
      />
    </div>
  );
}
