import { useEffect, useState, useCallback, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Loader2, Plus, Download, Paperclip, X, AlertTriangle, Info } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  orcamentoApi,
  validarArquivoAta,
  formatFileSize,
  type AtaComite,
  type ComiteOrcamento,
} from "@/services/orcamentoApi";

/**
 * RN-GERAL-04 — juntada das atas dos comitês (CGTIC/CGOVTIC). Os comitês deliberam no PROAD
 * (externo); o Kaizen reflete o ato registrando/anexando a ata (ação do Editor SGJT).
 *
 * @param cicloId  ID do ciclo orçamentário
 * @param readOnly Se true, oculta formulário de juntada e botão de exclusão
 */

interface AtasComitesPanelProps {
  cicloId: number;
  readOnly?: boolean;
}

const COMITE_LABEL: Record<ComiteOrcamento, string> = {
  cgtic: "CGTIC (gestão)",
  cgovtic: "CGOVTIC (governança)",
};

function fmtData(d: string | null): string {
  if (!d) return "—";
  const raw = d.substring(0, 10);
  const [y, m, dd] = raw.split("-");
  return y && m && dd ? `${dd}/${m}/${y}` : d;
}

export function AtasComitesPanel({ cicloId, readOnly = false }: AtasComitesPanelProps) {
  const [atas, setAtas] = useState<AtaComite[]>([]);
  const [comite, setComite] = useState<ComiteOrcamento>("cgtic");
  const [numero, setNumero] = useState("");
  const [dataAta, setDataAta] = useState("");
  const [decisao, setDecisao] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [baixandoId, setBaixandoId] = useState<number | null>(null);
  const [ataParaExcluir, setAtaParaExcluir] = useState<number | null>(null);
  const [confirmarInclusao, setConfirmarInclusao] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const carregar = useCallback(() => {
    orcamentoApi
      .listarAtas(cicloId)
      .then(setAtas)
      .catch(() => {
        /* backend indisponível */
      });
  }, [cicloId]);

  useEffect(carregar, [carregar]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const erro = validarArquivoAta(file);
    if (erro) {
      toast.error(erro);
      e.target.value = "";
      return;
    }
    setArquivo(file);
  };

  const limparArquivo = () => {
    setArquivo(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRegistrarClick = () => {
    if (!arquivo && !anexoUrl.trim()) {
      toast.error("É necessário anexar um arquivo ou informar a URL do anexo.");
      return;
    }
    setConfirmarInclusao(true);
  };

  const registrar = async () => {
    setConfirmarInclusao(false);
    setBusy(true);
    try {
      await orcamentoApi.registrarAta(
        {
          cicloId,
          comite,
          numero: numero.trim() || null,
          dataAta: dataAta || null,
          decisao: decisao.trim() || null,
          anexoUrl: anexoUrl.trim() || null,
        },
        arquivo ?? undefined,
      );
      setNumero("");
      setDataAta("");
      setDecisao("");
      setAnexoUrl("");
      limparArquivo();
      toast.success("Ata juntada.");
      carregar();
    } catch {
      toast.error("Não foi possível juntar a ata (verifique permissão do escopo SGJT).");
    } finally {
      setBusy(false);
    }
  };

  const handleExcluirClick = (id: number) => {
    setAtaParaExcluir(id);
  };

  const confirmarExclusao = async () => {
    if (!ataParaExcluir) return;
    const id = ataParaExcluir;
    setAtaParaExcluir(null);
    try {
      await orcamentoApi.excluirAta(id);
      toast.success("Ata removida.");
      carregar();
    } catch {
      toast.error("Não foi possível remover a ata.");
    }
  };

  const baixarAnexo = async (ata: AtaComite) => {
    setBaixandoId(ata.id);
    const token = localStorage.getItem("auth_token");
    const url = orcamentoApi.getUrlDownloadAta(ata.id);

    try {
      const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: "include",
      });

      if (!res.ok) {
        let msg = "Erro ao baixar arquivo.";
        try {
          const json = await res.json();
          msg = json.message || msg;
        } catch {
          // Ignora se a resposta não for JSON
        }
        throw new Error(msg);
      }

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = ata.original_filename || "ata";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(blobUrl), 100);
    } catch (error: any) {
      toast.error(error.message || "Não foi possível baixar o arquivo.");
    } finally {
      setBaixandoId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">Atas dos comitês</h3>
        <span className="text-xs text-slate-400">CGTIC / CGOVTIC · juntada (RN-GERAL-04)</span>
      </div>

      {/* Formulário de juntada — oculto no modo readOnly */}
      {!readOnly && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={comite}
              onChange={(e) => setComite(e.target.value as ComiteOrcamento)}
              className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
              aria-label="Comitê"
            >
              <option value="cgtic">CGTIC (gestão)</option>
              <option value="cgovtic">CGOVTIC (governança)</option>
            </select>
            <Input placeholder="Nº da ata" value={numero} onChange={(e) => setNumero(e.target.value)} />
            <Input type="date" value={dataAta} onChange={(e) => setDataAta(e.target.value)} aria-label="Data da ata" />
            <Input placeholder="URL do anexo (opcional)" value={anexoUrl} onChange={(e) => setAnexoUrl(e.target.value)} />
            <Input
              className="sm:col-span-2 lg:col-span-3"
              placeholder="Decisão / deliberação (opcional)"
              value={decisao}
              onChange={(e) => setDecisao(e.target.value)}
            />
          </div>

          {/* Upload de arquivo */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx"
                onChange={handleFileChange}
                className="hidden"
                id="ata-file-input"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-600"
              >
                <Paperclip className="h-4 w-4 mr-1.5" />
                {arquivo ? "Trocar arquivo" : "Anexar PDF/DOC"}
              </Button>
            </div>

            {arquivo && (
              <div className="flex items-center gap-2 rounded-md bg-blue-50 border border-blue-200 px-2.5 py-1 text-sm">
                <FileText className="h-3.5 w-3.5 text-blue-600 shrink-0" />
                <span className="text-blue-800 font-medium truncate max-w-[200px]">{arquivo.name}</span>
                <span className="text-blue-500 text-xs">({formatFileSize(arquivo.size)})</span>
                <button
                  type="button"
                  onClick={limparArquivo}
                  className="text-blue-400 hover:text-red-500 transition-colors"
                  aria-label="Remover arquivo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            <Button onClick={handleRegistrarClick} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white ml-auto">
              {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Juntar ata
            </Button>
          </div>
        </div>
      )}

      {/* Lista */}
      <div className={`space-y-2 ${readOnly ? "" : "mt-4"}`}>
        {atas.length === 0 ? (
          <p className="text-xs italic text-slate-400">Nenhuma ata juntada neste ciclo.</p>
        ) : (
          atas.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {COMITE_LABEL[a.comite] ?? a.comite}
              </span>
              <span className="font-medium text-slate-800">{a.numero ?? "s/nº"}</span>
              <span className="text-xs text-slate-500">{fmtData(a.data_ata)}</span>
              {a.decisao && <span className="truncate text-xs text-slate-600">· {a.decisao}</span>}

              {/* Arquivo S3 */}
              {a.file_key && (
                <button
                  type="button"
                  onClick={() => baixarAnexo(a)}
                  disabled={baixandoId === a.id}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  title={`${a.original_filename} (${formatFileSize(a.file_size)})`}
                >
                  {baixandoId === a.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" />
                  )}
                  {a.original_filename
                    ? a.original_filename.length > 25
                      ? a.original_filename.substring(0, 22) + "..."
                      : a.original_filename
                    : "anexo"}
                  <span className="text-blue-400 font-normal">({formatFileSize(a.file_size)})</span>
                </button>
              )}

              {/* Link PROAD legado */}
              {!a.file_key && a.anexo_url && (
                <a
                  href={a.anexo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  anexo
                </a>
              )}

              {/* Botão excluir — oculto no modo readOnly */}
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => handleExcluirClick(a.id)}
                  className="ml-auto text-slate-400 hover:text-red-600"
                  aria-label="Remover ata"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {/* Dialog Confirmar Inclusão */}
      <Dialog open={confirmarInclusao} onOpenChange={setConfirmarInclusao}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Info className="h-5 w-5 text-blue-500" />
              Confirmar juntada de ata
            </DialogTitle>
            <DialogDescription>
              Você está prestes a registrar uma nova ata para o comitê{" "}
              <strong>{COMITE_LABEL[comite]}</strong>.
              {arquivo && (
                <span className="block mt-2">
                  O arquivo <strong>{arquivo.name}</strong> será anexado.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setConfirmarInclusao(false)}>
              Cancelar
            </Button>
            <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={registrar}>
              Confirmar Juntada
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Confirmar Exclusão */}
      <Dialog open={ataParaExcluir !== null} onOpenChange={(open) => !open && setAtaParaExcluir(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-5 w-5" />
              Excluir ata
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover esta ata? O arquivo físico também será excluído permanentemente do servidor. Esta ação não pode ser desfeita.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setAtaParaExcluir(null)}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={confirmarExclusao}>
              Sim, Excluir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
