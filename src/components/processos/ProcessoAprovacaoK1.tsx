import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  FileText,
  Download,
  Loader2,
  Trash2,
  Upload,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import {
  processosNegocioApi,
  ProcessoNegocio,
  isK1,
  isResponsavel,
  isComplianceOfficer,
  camposObrigatoriosFaltantes,
  aprovacaoDoComite,
  COMITES_APROVACAO,
} from "@/services/processosNegocioApi";
import { areasApi, Area } from "@/services/areasApi";

interface ProcessoAprovacaoK1Props {
  /** Processo PERSISTIDO — a aprovação opera sobre ele (aprovacoes/apreciacao), não sobre o form. */
  processo: ProcessoNegocio;
  /** Atualiza o processo após anexar/remover a aprovação (muda o status Modelo K1). */
  onChanged: (next: ProcessoNegocio) => void;
  /** True enquanto o objeto completo (com o PDF base64 da aprovação) ainda está sendo buscado. */
  loadingFull?: boolean;
}

/** Formata uma data ISO (YYYY-MM-DD) para dd/mm/aaaa. */
function formatDataCompleta(data: string | null | undefined): string {
  if (!data || !data.trim()) return "—";
  const m = data.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return data;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/**
 * Aprovação (Modelo K1) — porte fiel da seção do ProcessoDetalhe. Para cada comitê exigido
 * (processo.apreciacao), mostra o status da aprovação e, para superadmin, o espaço de anexar o
 * PDF (com a data de aprovação) que torna o processo Modelo K1. Restrito a superadmin no backend.
 */
export function ProcessoAprovacaoK1({
  processo,
  onChanged,
  loadingFull = false,
}: ProcessoAprovacaoK1Props) {
  const { user } = useAuth();
  const isSuperadmin =
    (user as { is_superadmin?: boolean } | null)?.is_superadmin === true;
  const [areas, setAreas] = useState<Area[]>([]);
  useEffect(() => {
    let cancelled = false;
    areasApi
      .getAll()
      .then((data) => {
        if (!cancelled) setAreas(data);
      })
      .catch(() => {
        /* sem áreas, cai só nos demais papéis */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Anexar/remover a aprovação do comitê é liberado para quem faz parte das camadas de validação
  // do processo: Gestor do Escritório (superadmin), Compliance Officer (camada 3), Revisor/Diretor
  // da área (camada 2 — gestor_user_id) ou Responsável do Processo (camada 1).
  const podeAnexarAprovacao = useMemo(() => {
    if (isSuperadmin) return true;
    if (isComplianceOfficer(user)) return true;
    if (isResponsavel(processo, user?.id)) return true;
    const area = areas.find(
      (a) =>
        a.sigla?.trim().toUpperCase() ===
        processo.diretoria?.trim().toUpperCase(),
    );
    return (
      area?.gestor_user_id != null &&
      Number(area.gestor_user_id) === Number(user?.id)
    );
  }, [isSuperadmin, user?.email, user?.id, processo, areas]);
  // Comitê cuja aprovação está sendo anexada/removida no momento (sigla) ou null.
  const [aprovacaoBusyComite, setAprovacaoBusyComite] = useState<string | null>(
    null,
  );
  // Data de aprovação informada por comitê (sigla -> YYYY-MM-DD), antes de anexar.
  const [aprovacaoEmInputs, setAprovacaoEmInputs] = useState<
    Record<string, string>
  >({});

  const handleUploadAprovacao = async (comite: string, file: File) => {
    const dataAprovacao = aprovacaoEmInputs[comite];
    if (!dataAprovacao) {
      toast.error("Informe a data de aprovação antes de anexar o PDF.");
      return;
    }
    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      toast.error("Envie um arquivo PDF.");
      return;
    }
    if (file.size > 6 * 1024 * 1024) {
      toast.error("PDF muito grande. Tamanho máximo: 6MB.");
      return;
    }
    setAprovacaoBusyComite(comite);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });
      const updated = await processosNegocioApi.setAprovacao(processo.id, {
        aprovacao_data: dataUrl,
        aprovacao_filename: file.name,
        aprovacao_mime: file.type || "application/pdf",
        aprovacao_em: dataAprovacao,
        aprovacao_comite: comite,
      });
      onChanged(updated);
      setAprovacaoEmInputs((prev) => ({ ...prev, [comite]: "" }));
      toast.success("Aprovação anexada.");
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setAprovacaoBusyComite(null);
    }
  };

  const handleRemoverAprovacao = async (comite: string) => {
    if (
      !window.confirm(
        `Remover a aprovação do ${comite}? O processo pode deixar de ser Modelo K1.`,
      )
    )
      return;
    setAprovacaoBusyComite(comite);
    try {
      const updated = await processosNegocioApi.removeAprovacao(
        processo.id,
        comite,
      );
      onChanged(updated);
      toast.success("Aprovação removida.");
    } catch {
      /* erro já tratado pelo apiClient ou ignorado intencionalmente */
    } finally {
      setAprovacaoBusyComite(null);
    }
  };

  const k1 = isK1(processo);
  const exigidos = processo.apreciacao || [];
  const faltam = camposObrigatoriosFaltantes(processo);

  return (
    <div className="space-y-3">
      {k1 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border bg-blue-50 text-blue-700 border-blue-200">
            <ShieldCheck className="h-3.5 w-3.5" />
            Modelo K1
          </span>
        </div>
      )}

      {faltam.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Para atualizar o processo para o modelo atual, preencha os campos:{" "}
          <span className="font-semibold">{faltam.join(", ")}</span>.
        </div>
      )}

      {exigidos.length === 0 ? (
        <p className="text-xs italic text-slate-400">
          Este processo não passa por aprovação de comitê (apreciação vazia).
        </p>
      ) : (
        <div className="space-y-3">
          {exigidos.map((comite) => {
            const aprov = aprovacaoDoComite(processo, comite);
            const nome = COMITES_APROVACAO[comite] || comite;
            const busy = aprovacaoBusyComite === comite;
            const carregando = loadingFull && !!aprov && !aprov.data;
            return (
              <div key={comite} className="rounded-md border border-slate-200 p-3">
                <p className="text-sm font-semibold text-slate-800">
                  {comite}{" "}
                  <span className="font-normal text-slate-500">— {nome}</span>
                </p>
                {aprov ? (
                  <div className="mt-2 space-y-1.5">
                    <p className="text-sm text-slate-700">
                      <span className="font-semibold">Aprovado em:</span>{" "}
                      {formatDataCompleta(aprov.em)}
                    </p>
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="flex items-center gap-2 text-sm text-slate-700">
                        <FileText className="h-4 w-4 flex-shrink-0 text-red-500" />
                        <span className="break-words">
                          {aprov.filename || "aprovacao.pdf"}
                        </span>
                      </div>
                      {carregando ? (
                        <span className="inline-flex items-center gap-1 text-xs text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Carregando…
                        </span>
                      ) : (
                        aprov.data && (
                          <a
                            href={aprov.data}
                            download={aprov.filename || "aprovacao.pdf"}
                            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 hover:underline"
                          >
                            <Download className="h-3.5 w-3.5" />
                            Baixar
                          </a>
                        )
                      )}
                      {podeAnexarAprovacao && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoverAprovacao(comite)}
                          disabled={busy}
                          className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          {busy ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                          <span className="ml-1">Remover</span>
                        </Button>
                      )}
                    </div>
                  </div>
                ) : podeAnexarAprovacao ? (
                  <div className="mt-2 flex flex-wrap items-end gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                        Data de aprovação
                      </label>
                      <input
                        type="date"
                        value={aprovacaoEmInputs[comite] || ""}
                        onChange={(e) =>
                          setAprovacaoEmInputs((prev) => ({
                            ...prev,
                            [comite]: e.target.value,
                          }))
                        }
                        className="h-9 w-[180px] rounded-md border border-slate-300 bg-white px-3 text-sm"
                      />
                    </div>
                    <label
                      className={`inline-flex items-center gap-2 text-sm font-medium ${
                        aprovacaoEmInputs[comite]
                          ? "cursor-pointer text-blue-600 hover:text-blue-700"
                          : "cursor-not-allowed text-slate-400"
                      }`}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Anexar aprovação (PDF)
                      <input
                        type="file"
                        accept="application/pdf,.pdf"
                        className="hidden"
                        disabled={busy || !aprovacaoEmInputs[comite]}
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) handleUploadAprovacao(comite, f);
                          e.target.value = "";
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <p className="mt-1 text-xs italic text-slate-400">
                    Aprovação pendente.
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
