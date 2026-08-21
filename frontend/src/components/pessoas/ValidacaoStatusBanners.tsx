import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Lock,
  AlertCircle,
  XCircle,
  Eye,
  Loader2,
  Plus,
  Pencil,
  Minus,
} from "lucide-react";
import { FormularioCompetencias } from "@/services/competenciasGestorApi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  competenciasPadraoApi,
  CompetenciaPadrao,
} from "@/services/competenciasPadraoApi";

interface ValidacaoStatusBannersProps {
  formulario: FormularioCompetencias;
  /**
   * A camada 1 (autor) faz parte do fluxo deste formulário? Sempre verdadeiro na matriz da equipe.
   * Na matriz do GESTOR depende de quem preencheu: gestor da unidade e sub-diretor validam a
   * própria camada antes de a matriz subir (3 camadas); o diretor da área não (2 camadas).
   * Espelha CompetenciasGestorService.requerValidacaoAutor no backend.
   */
  requerValidacaoAutor?: boolean;
}

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Com camada de autor: matriz da equipe e matriz do gestor preenchida por quem não é o diretor.
const STATUS_ORDER_COM_AUTOR = [
  "enviado",
  "validado_autor",
  "validado_diretoria",
  "validado_final",
];
// Sem camada de autor: matriz do gestor preenchida pelo próprio diretor da área.
const STATUS_ORDER_SEM_AUTOR = [
  "enviado",
  "validado_diretoria",
  "validado_final",
];

function getStatusIndex(status: string, order: string[]): number {
  const idx = order.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export function ValidacaoStatusBanners({
  formulario,
  requerValidacaoAutor = true,
}: ValidacaoStatusBannersProps) {
  const [mudancasOpen, setMudancasOpen] = useState(false);
  const isGestor = formulario.tipo === "gestor";
  // Só a matriz do gestor preenchida pelo diretor pula a camada de autor. Nos demais casos o
  // stepper tem as 3 camadas — inclusive na matriz do gestor preenchida pelo gestor da unidade.
  const comCamadaAutor = !isGestor || requerValidacaoAutor;
  const statusOrder = comCamadaAutor
    ? STATUS_ORDER_COM_AUTOR
    : STATUS_ORDER_SEM_AUTOR;
  const statusIdx = getStatusIndex(formulario.status, statusOrder);

  const layers = comCamadaAutor
    ? [
        {
          label: "Validação do Autor",
          done: statusIdx >= 1,
          pending: statusIdx === 0,
          nome: formulario.validado_por_autor_nome,
          data: formulario.validado_por_autor_em,
        },
        {
          label: "Validação da Diretoria",
          done: statusIdx >= 2,
          pending: statusIdx === 1,
          nome: formulario.validado_por_diretoria_nome,
          data: formulario.validado_por_diretoria_em,
        },
        {
          label: "Validação Final",
          done: statusIdx >= 3,
          pending: statusIdx === 2,
          nome: formulario.validado_final_nome,
          data: formulario.validado_final_em,
        },
      ]
    : [
        {
          label: "Validação da Diretoria",
          done: statusIdx >= 1,
          pending: statusIdx === 0,
          nome: formulario.validado_por_diretoria_nome,
          data: formulario.validado_por_diretoria_em,
        },
        {
          label: "Validação Final",
          done: statusIdx >= 2,
          pending: statusIdx === 1,
          nome: formulario.validado_final_nome,
          data: formulario.validado_final_em,
        },
      ];

  // Tipos de padrão afetados (em pt-BR para mostrar no banner)
  const tiposLabel: Record<string, string> = {
    comportamental: "Comportamentais",
    estrategica: "Estratégicas",
    gerencial: "Gerenciais",
  };
  const tiposAfetados = Array.isArray(formulario.padroes_tipos_afetados)
    ? formulario.padroes_tipos_afetados
        .map((t) => tiposLabel[t] || t)
        .join(", ")
    : "";

  // Banner de recusa: aparece se houver registro de recusa pendente
  // (formulário voltou para 'enviado' após uma recusa)
  const mostrarRecusa =
    !!formulario.recusado_em && formulario.status === "enviado";
  const camadaRecusa =
    formulario.recusado_camada === "final"
      ? "Validação Final"
      : formulario.recusado_camada === "diretoria"
        ? "Validação da Diretoria"
        : "camada de validação";

  return (
    <div className="space-y-2">
      {/* Banner: formulário foi recusado e voltou para o autor */}
      {mostrarRecusa && (
        <div className="flex items-start gap-3 rounded-lg bg-red-50 border border-red-300 px-4 py-3">
          <XCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-900">
              Formulário recusado pela {camadaRecusa}
            </p>
            <p className="text-xs text-red-700 mt-0.5">
              Recusado por {formulario.recusado_por_nome || "validador"}
              {formulario.recusado_em
                ? `, em ${formatDate(formulario.recusado_em)}`
                : ""}
              . Ajuste o que for necessário e valide novamente.
            </p>
            {formulario.recusado_comentario && (
              <p className="text-sm text-red-800 mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] bg-white/70 border border-red-200 rounded-md px-3 py-2">
                <span className="font-medium">Comentário:</span>{" "}
                {formulario.recusado_comentario}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Banner: mudanças de competências padrão exigem re-validação */}
      {formulario.padroes_propagacao_pendente && (
        <div className="flex items-start gap-3 rounded-lg bg-purple-50 border border-purple-300 px-4 py-3">
          <AlertCircle className="h-5 w-5 text-purple-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-purple-900">
                  Mudanças em competências padrão
                </p>
                <p className="text-xs text-purple-700 mt-0.5">
                  {tiposAfetados
                    ? `As competências padrão (${tiposAfetados}) foram atualizadas. `
                    : "As competências padrão foram atualizadas. "}
                  Como elas constam neste referencial, ele precisa passar
                  novamente pelas camadas de validação para ter sua versão
                  atualizada.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="border-purple-300 text-purple-700 hover:bg-purple-100 flex-shrink-0"
                onClick={() => setMudancasOpen(true)}
              >
                <Eye className="h-4 w-4 mr-1.5" />
                Visualizar alteração
              </Button>
            </div>
          </div>
        </div>
      )}

      <MudancasPadraoDialog
        open={mudancasOpen}
        onClose={() => setMudancasOpen(false)}
        tiposAfetados={
          Array.isArray(formulario.padroes_tipos_afetados)
            ? formulario.padroes_tipos_afetados
            : []
        }
      />

      {/* fim dos banners de mudanças padrão */}

      {layers.map((layer, i) => {
        if (layer.done) {
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-emerald-50 border border-emerald-200 px-4 py-3"
            >
              <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-emerald-800">
                  {layer.label}
                </p>
                <p className="text-xs text-emerald-600">
                  Validado por {layer.nome || "usuário"}, em{" "}
                  {layer.data ? formatDate(layer.data) : "-"}
                </p>
              </div>
            </div>
          );
        }
        if (layer.pending) {
          return (
            <div
              key={i}
              className="flex items-center gap-3 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3"
            >
              <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-800">
                  {layer.label}
                </p>
                <p className="text-xs text-amber-600">Aguardando validação</p>
              </div>
            </div>
          );
        }
        return (
          <div
            key={i}
            className="flex items-center gap-3 rounded-lg bg-gray-50 border border-gray-200 px-4 py-3"
          >
            <Lock className="h-5 w-5 text-gray-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-gray-500">{layer.label}</p>
              <p className="text-xs text-gray-400">Etapa anterior pendente</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Diálogo: visualizar mudanças aplicadas no catálogo de competências padrão
// (mostra adicionadas, alteradas e removidas da última publicação, filtradas
// pelos tipos que afetam este referencial).
// ──────────────────────────────────────────────────────────────────────────────

const TIPO_LABELS: Record<string, string> = {
  comportamental: "Competências Comportamentais",
  estrategica: "Competências Estratégicas",
  gerencial: "Competências Gerenciais",
};

interface MudancaPorTipo {
  tipo: string;
  adicionadas: { id: number; nome: string }[];
  removidas: { id: number; nome: string }[];
  alteradas: { id: number; nome: string }[];
}

function MudancasPadraoDialog({
  open,
  onClose,
  tiposAfetados,
}: {
  open: boolean;
  onClose: () => void;
  tiposAfetados: string[];
}) {
  const [loading, setLoading] = useState(false);
  const [mudancas, setMudancas] = useState<MudancaPorTipo[]>([]);
  const [versaoAtual, setVersaoAtual] = useState<number | null>(null);
  const [detalhesPorId, setDetalhesPorId] = useState<
    Map<number, CompetenciaPadrao>
  >(new Map());

  useEffect(() => {
    if (!open) return;
    let ativo = true;
    setLoading(true);
    (async () => {
      try {
        const versao = await competenciasPadraoApi.getVersaoAtual();
        if (!ativo) return;
        setVersaoAtual(versao.versao);

        // Diff da última publicação (versão atual em relação à anterior)
        const fromVersion = Math.max(0, (versao.versao || 1) - 1);
        const diff = await competenciasPadraoApi.getDiff(fromVersion);
        if (!ativo) return;
        setMudancas((diff.mudancas as MudancaPorTipo[]) || []);

        // Detalhes (nome + descrição atual) para enriquecer adicionadas/alteradas
        const all = await competenciasPadraoApi.getAll();
        if (!ativo) return;
        const map = new Map<number, CompetenciaPadrao>();
        [
          ...(all.comportamental || []),
          ...(all.estrategica || []),
          ...(all.gerencial || []),
        ].forEach((c) => map.set(c.id, c));
        setDetalhesPorId(map);
      } catch (err) {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      } finally {
        if (ativo) setLoading(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [open]);

  const tiposAfetadosSet = new Set(tiposAfetados);
  const mudancasFiltradas = mudancas.filter(
    (m) => tiposAfetadosSet.size === 0 || tiposAfetadosSet.has(m.tipo),
  );
  const totalMudancas = mudancasFiltradas.reduce(
    (acc, m) =>
      acc + m.adicionadas.length + m.alteradas.length + m.removidas.length,
    0,
  );

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[680px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Eye className="h-5 w-5 text-purple-600" />
            Alterações em competências padrão
          </DialogTitle>
          <DialogDescription>
            Mudanças aplicadas pela SGJT na publicação mais recente do catálogo
            {versaoAtual ? ` (v${versaoAtual})` : ""}.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            Carregando alterações...
          </div>
        ) : totalMudancas === 0 ? (
          <p className="text-sm text-gray-500 py-8 text-center">
            Nenhuma alteração encontrada para os tipos afetados por este
            referencial.
          </p>
        ) : (
          <div className="space-y-6 py-2">
            {mudancasFiltradas.map((m) => {
              const totalDoTipo =
                m.adicionadas.length + m.alteradas.length + m.removidas.length;
              if (totalDoTipo === 0) return null;
              return (
                <section key={m.tipo} className="space-y-3">
                  <h3 className="font-semibold text-gray-900 border-b border-gray-200 pb-1">
                    {TIPO_LABELS[m.tipo] || m.tipo}
                  </h3>

                  {m.adicionadas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-emerald-700 flex items-center gap-1">
                        <Plus className="h-3 w-3" /> Adicionadas (
                        {m.adicionadas.length})
                      </p>
                      {m.adicionadas.map((a) => {
                        const det = detalhesPorId.get(a.id);
                        return (
                          <div
                            key={`add-${a.id}`}
                            className="rounded-md border border-emerald-200 bg-emerald-50/50 px-3 py-2"
                          >
                            <p className="text-sm font-medium text-emerald-900">
                              {det?.nome || a.nome}
                            </p>
                            {det?.descricao && (
                              <p className="text-xs text-emerald-800/80 mt-1 [overflow-wrap:anywhere]">
                                {det.descricao}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {m.alteradas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-amber-700 flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> Alteradas (
                        {m.alteradas.length})
                      </p>
                      {m.alteradas.map((a) => {
                        const det = detalhesPorId.get(a.id);
                        return (
                          <div
                            key={`alt-${a.id}`}
                            className="rounded-md border border-amber-200 bg-amber-50/60 px-3 py-2"
                          >
                            <p className="text-sm font-medium text-amber-900">
                              {det?.nome || a.nome}
                            </p>
                            {det?.descricao && (
                              <p className="text-xs text-amber-800/80 mt-1 [overflow-wrap:anywhere]">
                                {det.descricao}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {m.removidas.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-gray-600 flex items-center gap-1">
                        <Minus className="h-3 w-3" /> Removidas (
                        {m.removidas.length})
                      </p>
                      {m.removidas.map((r) => (
                        <div
                          key={`rem-${r.id}`}
                          className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2"
                        >
                          <p className="text-sm font-medium text-gray-700 line-through">
                            {r.nome}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              );
            })}
          </div>
        )}

        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
