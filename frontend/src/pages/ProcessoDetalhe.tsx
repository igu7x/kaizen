import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  FileDown,
  Loader2,
  Info,
  Users,
  Building2,
  ArrowRightLeft,
  Boxes,
  Wrench,
  BookMarked,
  Gauge,
  Workflow,
  Paperclip,
  Download,
  CalendarClock,
  ShieldCheck,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import {
  processosNegocioApi,
  ProcessoNegocio,
  DocumentoAnexado,
  TIPO_DOCUMENTO_BADGE,
  TIPO_DOCUMENTO_LABEL,
  COMITES_APROVACAO,
  getFluxograma,
  normalizeResponsavel,
  aprovacaoDoComite,
  isVigente,
  isK1,
  temDocumentoPrimario,
  proximaRevisao,
} from "@/services/processosNegocioApi";
import { areasApi } from "@/services/areasApi";
import { generateProcessoNegocioPDF } from "@/utils/generateProcessoNegocioPDF";

function formatData(v: string | null | undefined): string {
  if (!v) return "—";
  const m = v.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1]}`;
  const d = new Date(v);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

function formatDataHora(v: string | null | undefined): string {
  if (!v) return "—";
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return formatData(v);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const STATUS_INFO: Record<
  string,
  { label: string; className: string }
> = {
  em_elaboracao: {
    label: "Em elaboração",
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  },
  enviado: {
    label: "Enviado",
    className: "bg-amber-100 text-amber-700 ring-amber-200",
  },
  validado_autor: {
    label: "Validado (Responsável)",
    className: "bg-sky-100 text-sky-700 ring-sky-200",
  },
  validado_diretoria: {
    label: "Validado (Revisor)",
    className: "bg-indigo-100 text-indigo-700 ring-indigo-200",
  },
  validado_final: {
    label: "Vigente",
    className: "bg-emerald-100 text-emerald-700 ring-emerald-200",
  },
  recusado: {
    label: "Recusado",
    className: "bg-red-100 text-red-700 ring-red-200",
  },
};

export default function ProcessoDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [processo, setProcesso] = useState<ProcessoNegocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState(false);
  const [diretoriaNome, setDiretoriaNome] = useState<string>("");
  const [gerandoPdf, setGerandoPdf] = useState(false);
  const [baixandoDoc, setBaixandoDoc] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setErro(false);
    try {
      const p = await processosNegocioApi.getById(Number(id));
      setProcesso(p);
      // Nome amigável da diretoria (a partir da sigla), para cabeçalho e PDF.
      try {
        const areas = await areasApi.getAll();
        const area = areas.find((a) => a.sigla === p.diretoria);
        setDiretoriaNome(area?.nome || p.diretoria || "");
      } catch {
        setDiretoriaNome(p.diretoria || "");
      }
    } catch {
      setErro(true);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const baixarPdf = () => {
    if (!processo) return;
    setGerandoPdf(true);
    try {
      // Abre a aba no gesto do clique para não ser bloqueada como popup.
      const win = window.open("", "_blank");
      generateProcessoNegocioPDF(processo, diretoriaNome, win);
    } catch {
      toast.error("Não foi possível gerar o PDF do processo.");
    } finally {
      setGerandoPdf(false);
    }
  };

  const baixarDocumento = async (doc: DocumentoAnexado, idx: number) => {
    setBaixandoDoc(idx);
    try {
      if (!doc.data) {
        toast.error("Documento não disponível para download.");
        return;
      }
      const blob = await (await fetch(doc.data)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nome || `documento-${doc.tipo}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      toast.error("Não foi possível baixar o documento.");
    } finally {
      setBaixandoDoc(null);
    }
  };

  const responsaveis = useMemo(
    () =>
      (processo?.proprietarios || [])
        .map((r) => normalizeResponsavel(r))
        .filter((r) => r.cargo.trim())
        .map((r) => (r.area ? `${r.cargo} (${r.area})` : r.cargo)),
    [processo],
  );

  const ritoLinhas = useMemo(() => {
    if (!processo) return [];
    const exigidos = processo.apreciacao || [];
    return [
      {
        label: "Responsável",
        ok: !!processo.validado_autor_em,
        valor:
          processo.validado_autor_em && processo.validado_autor_nome
            ? `${processo.validado_autor_nome} — ${formatDataHora(processo.validado_autor_em)}`
            : "Pendente",
      },
      {
        label: "Revisor",
        ok: !!processo.validado_diretoria_em,
        valor:
          processo.validado_diretoria_em && processo.validado_diretoria_nome
            ? `${processo.validado_diretoria_nome} — ${formatDataHora(processo.validado_diretoria_em)}`
            : "Pendente",
      },
      {
        label: "Compliance Officer",
        ok: !!processo.validado_final_em,
        valor:
          processo.validado_final_em && processo.validado_final_nome
            ? `${processo.validado_final_nome} — ${formatDataHora(processo.validado_final_em)}`
            : "Pendente",
      },
      ...exigidos.map((comite) => {
        const aprov = aprovacaoDoComite(processo, comite);
        return {
          label: COMITES_APROVACAO[comite] || comite,
          ok: !!aprov,
          valor: aprov
            ? `Aprovado — Ata ${comite}${aprov.em ? ` - ${formatData(aprov.em)}` : ""}`
            : "Pendente",
        };
      }),
    ];
  }, [processo]);

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-32 text-slate-500">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Carregando processo…
        </div>
      </Layout>
    );
  }

  if (erro || !processo) {
    return (
      <Layout>
        <div className="max-w-2xl mx-auto py-24 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-red-50 flex items-center justify-center">
            <AlertTriangle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-lg font-bold text-slate-900">
            Processo não encontrado
          </h1>
          <p className="text-slate-500 text-sm mt-1">
            O processo pode ter sido removido ou o link está incorreto.
          </p>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => navigate("/gestao-estrategica/processos")}
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar ao Escritório de
            Processos
          </Button>
        </div>
      </Layout>
    );
  }

  const flux = getFluxograma(processo);
  const docs = processo.documentos_anexados || [];
  const status = STATUS_INFO[processo.status] || {
    label: processo.status,
    className: "bg-slate-100 text-slate-700 ring-slate-200",
  };
  const vigente = isVigente(processo);
  const modelo = isK1(processo)
    ? "Modelo K1"
    : temDocumentoPrimario(processo)
      ? "Doc. Primário"
      : "Em construção";
  const revisao = proximaRevisao(processo);

  return (
    <Layout>
      <div className="max-w-6xl mx-auto space-y-6 pb-16">
        {/* Barra de topo */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <button
            onClick={() => navigate("/gestao-estrategica/processos")}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" /> Escritório de Processos
          </button>
          <Button
            onClick={baixarPdf}
            disabled={gerandoPdf}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {gerandoPdf ? (
              <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
            ) : (
              <FileDown className="h-4 w-4 mr-1.5" />
            )}
            Baixar PDF da versão vigente
          </Button>
        </div>

        {/* Cabeçalho / Hero */}
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <span
              className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ring-1 ring-inset ${status.className}`}
            >
              {status.label}
            </span>
            {vigente && (
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200">
                <ShieldCheck className="h-3.5 w-3.5" /> {modelo} vigente
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-slate-900">
            {processo.nome_processo}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            {processo.macroprocesso || "—"}
          </p>

          <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            <MiniStat label="ID" value={processo.codigo || "—"} />
            <MiniStat label="Área" value={processo.diretoria || "—"} />
            <MiniStat label="Versão" value={processo.versao || "—"} />
            <MiniStat
              label="Data da versão"
              value={formatData(processo.periodo || processo.updated_at)}
            />
            <MiniStat
              label="Próxima revisão"
              value={revisao ? formatData(revisao.toISOString()) : "—"}
            />
          </div>
        </div>

        {/* Descrição */}
        <Secao icone={<Info className="h-4 w-4" />} titulo="Descrição do Processo">
          <Texto valor={processo.descricao} />
        </Secao>

        {/* Governança */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Secao icone={<Users className="h-4 w-4" />} titulo="Responsáveis">
            <ListaBullets itens={responsaveis} vazio="Sem responsáveis." />
          </Secao>
          <Secao
            icone={<Building2 className="h-4 w-4" />}
            titulo="Áreas Envolvidas"
          >
            <ListaBullets
              itens={processo.areas_responsaveis || []}
              vazio="Sem áreas envolvidas."
            />
          </Secao>
        </div>

        {/* Atores */}
        {(processo.atores || []).length > 0 && (
          <Secao icone={<Users className="h-4 w-4" />} titulo="Atores">
            <ListaBullets itens={processo.atores} vazio="—" />
          </Secao>
        )}

        {/* Entradas / Saídas */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Secao
            icone={<ArrowRightLeft className="h-4 w-4" />}
            titulo="Entradas"
          >
            <ListaBullets
              itens={processo.entradas || []}
              vazio="Sem entradas."
            />
          </Secao>
          <Secao icone={<Boxes className="h-4 w-4" />} titulo="Saídas">
            <ListaBullets itens={processo.saidas || []} vazio="Sem saídas." />
          </Secao>
        </div>

        {/* Estrutura */}
        <Secao
          icone={<Workflow className="h-4 w-4" />}
          titulo="Estrutura do Processo"
        >
          <Texto valor={processo.detalhamento} />
        </Secao>

        {/* Recursos */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Secao
            icone={<Wrench className="h-4 w-4" />}
            titulo="Sistemas / Ferramentas"
          >
            <ListaBullets
              itens={processo.sistemas_ferramentas || []}
              vazio="—"
            />
          </Secao>
          <Secao
            icone={<BookMarked className="h-4 w-4" />}
            titulo="Normativos / Referências"
          >
            <ListaBullets
              itens={processo.normativos_referencias || []}
              vazio="—"
            />
          </Secao>
        </div>

        {/* Indicadores */}
        <Secao icone={<Gauge className="h-4 w-4" />} titulo="Indicadores">
          <Texto valor={processo.indicadores} />
        </Secao>

        {/* Fluxograma */}
        <Secao
          icone={<Workflow className="h-4 w-4" />}
          titulo="Modelagem / Fluxograma"
        >
          {flux.data && flux.mime?.startsWith("image/") ? (
            <img
              src={flux.data}
              alt="Fluxograma do processo"
              className="mx-auto max-h-[520px] w-auto rounded-lg border border-slate-200 bg-white object-contain"
            />
          ) : flux.data ? (
            <p className="text-sm text-slate-600">
              Fluxograma anexado ({flux.filename || "arquivo"}). Use “Baixar PDF”
              ou os documentos anexados para visualizar.
            </p>
          ) : (
            <p className="text-sm text-slate-400">Nenhum fluxograma anexado.</p>
          )}
        </Secao>

        {/* Documentos anexados */}
        <Secao
          icone={<Paperclip className="h-4 w-4" />}
          titulo="Documentos Anexados"
        >
          {docs.length === 0 ? (
            <p className="text-sm text-slate-400">Nenhum documento anexado.</p>
          ) : (
            <ul className="space-y-2">
              {docs.map((doc, idx) => (
                <li
                  key={`${doc.tipo}-${idx}`}
                  className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/60 px-3 py-2"
                >
                  <span
                    className={`inline-block whitespace-nowrap text-[11px] font-semibold px-2 py-0.5 rounded border flex-shrink-0 ${TIPO_DOCUMENTO_BADGE[doc.tipo] || "bg-slate-100 text-slate-600 border-slate-200"}`}
                    title={TIPO_DOCUMENTO_LABEL[doc.tipo]}
                  >
                    {doc.tipo}
                  </span>
                  <span
                    className="flex-1 min-w-0 truncate text-sm text-slate-700"
                    title={doc.nome_exibicao || doc.nome}
                  >
                    {doc.nome_exibicao || doc.nome || "—"}
                  </span>
                  <button
                    onClick={() => baixarDocumento(doc, idx)}
                    disabled={baixandoDoc === idx}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors flex-shrink-0"
                    title="Baixar documento"
                  >
                    {baixandoDoc === idx ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Secao>

        {/* Revisão */}
        <Secao
          icone={<CalendarClock className="h-4 w-4" />}
          titulo="Revisão"
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Periodicidade
              </p>
              <p className="text-sm text-slate-700">
                {processo.periodicidade_revisao?.trim() ||
                  "Anual (ordinária) ou extraordinária, quando necessário."}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1">
                Próxima revisão
              </p>
              <p className="text-sm text-slate-700 tabular-nums">
                {revisao ? formatData(revisao.toISOString()) : "—"}
              </p>
            </div>
          </div>
        </Secao>

        {/* Rito de aprovação */}
        <Secao
          icone={<ShieldCheck className="h-4 w-4" />}
          titulo="Rito de Aprovação"
        >
          <ul className="divide-y divide-slate-100">
            {ritoLinhas.map((linha, i) => (
              <li
                key={i}
                className="flex items-start justify-between gap-4 py-2.5"
              >
                <span className="text-sm font-medium text-slate-700">
                  {linha.label}
                </span>
                <span
                  className={`text-sm text-right ${linha.ok ? "text-slate-700" : "text-amber-600"}`}
                >
                  {linha.valor}
                </span>
              </li>
            ))}
          </ul>
        </Secao>
      </div>
    </Layout>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-slate-900 truncate" title={value}>
        {value}
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
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-4 text-blue-700">
        {icone}
        <h2 className="text-sm font-bold uppercase tracking-wide">{titulo}</h2>
      </div>
      {children}
    </section>
  );
}

function Texto({ valor }: { valor: string | null | undefined }) {
  if (!valor?.trim()) {
    return <p className="text-sm text-slate-400">Não informado.</p>;
  }
  return (
    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-line [overflow-wrap:anywhere] text-justify">
      {valor}
    </p>
  );
}

function ListaBullets({
  itens,
  vazio,
}: {
  itens: string[];
  vazio: string;
}) {
  const limpos = (itens || []).map((i) => i?.trim()).filter(Boolean);
  if (limpos.length === 0) {
    return <p className="text-sm text-slate-400">{vazio}</p>;
  }
  return (
    <ul className="space-y-1.5">
      {limpos.map((item, i) => (
        <li key={i} className="flex gap-2 text-sm text-slate-700">
          <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-400" />
          <span className="[overflow-wrap:anywhere]">{item}</span>
        </li>
      ))}
    </ul>
  );
}
