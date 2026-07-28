import { toast } from "sonner";
import { useRef, useState } from "react";
import {
  Upload,
  Paperclip,
  X,
  FileText,
  FileImage,
  File as FileIcon,
  Download,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  processosNegocioApi,
  DocumentoAnexado,
  TipoDocumentoAnexado,
  TIPO_DOCUMENTO_LABEL,
  TIPO_DOCUMENTO_BADGE,
} from "@/services/processosNegocioApi";

interface DocumentosAnexadosInputProps {
  value: DocumentoAnexado[];
  onChange: (next: DocumentoAnexado[]) => void;
  /** Somente leitura: esconde a linha de adicionar e o botão de remover (só lista os anexos). */
  somenteLeitura?: boolean;
  /**
   * Id do processo dono dos anexos. Em modo leitura, a listagem enxuta não traz o conteúdo
   * (`data`) dos arquivos; com o id, o download busca o processo completo sob demanda e baixa
   * mesmo que o `data` ainda não tenha sido hidratado no form.
   */
  processoId?: number;
}

const ACCEPT =
  "image/png,image/jpeg,image/jpg,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain";
const MAX_BYTES_PER_FILE = 20_000_000; // 20MB por arquivo

async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileIconFor(mime: string) {
  if (mime.startsWith("image/"))
    return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mime === "application/pdf")
    return <FileText className="h-4 w-4 text-red-500" />;
  return <FileIcon className="h-4 w-4 text-slate-500" />;
}

/**
 * Componente pra anexar múltiplos documentos categorizados (MPS, POP, AUX) ao processo.
 *
 * Fluxo:
 *  1. Usuário seleciona o tipo do documento (Select)
 *  2. Clica em "Selecionar arquivo" → escolhe arquivo
 *  3. Arquivo é lido como base64 e adicionado à lista
 *  4. Lista abaixo mostra cada arquivo com badge do tipo + botão remover
 */
export function DocumentosAnexadosInput({
  value,
  onChange,
  somenteLeitura = false,
  processoId,
}: DocumentosAnexadosInputProps) {
  const [tipoSelecionado, setTipoSelecionado] =
    useState<TipoDocumentoAnexado | null>(null);
  // Nome de exibição + data do documento — informados após escolher o tipo.
  const [nomeExibicao, setNomeExibicao] = useState("");
  const [dataDocumento, setDataDocumento] = useState("");
  // Índice da linha cujo download está buscando o conteúdo completo (spinner no botão).
  const [baixandoIdx, setBaixandoIdx] = useState<number | null>(null);
  // Contador usado como `key` do Select pra forçar remount após reset —
  // Radix Select não reseta o display visual ao trocar value controlado pra undefined.
  const [resetKey, setResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    if (!tipoSelecionado) {
      toast.warning("Selecione o tipo de documento antes de anexar.");
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!tipoSelecionado) return;

    if (file.size > MAX_BYTES_PER_FILE) {
      toast.warning(
        `Arquivo muito grande (${(file.size / 1_000_000).toFixed(1)}MB). Máximo por arquivo: ${MAX_BYTES_PER_FILE / 1_000_000}MB.`,
      );
      return;
    }

    try {
      const data = await readFileAsDataURL(file);
      const novo: DocumentoAnexado = {
        tipo: tipoSelecionado,
        nome: file.name,
        mime: file.type || "application/octet-stream",
        data,
        nome_exibicao: nomeExibicao.trim() || undefined,
        data_documento: dataDocumento || undefined,
      };
      onChange([...value, novo]);
      // Reseta o formulário após anexar pra forçar o usuário a preencher de novo no próximo
      setTipoSelecionado(null);
      setNomeExibicao("");
      setDataDocumento("");
      setResetKey((k) => k + 1);
    } catch (err) {
      toast.warning("Não foi possível ler o arquivo.");
    }
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  // Resolve o conteúdo (data URL base64) de um documento. Usa o `doc.data` já hidratado;
  // se estiver ausente (listagem enxuta) e houver `processoId`, busca o processo completo e
  // casa o documento pelo tipo/nome/nome de exibição.
  const resolverData = async (
    doc: DocumentoAnexado,
  ): Promise<string | null> => {
    if (doc.data) return doc.data;
    if (processoId == null) return null;
    try {
      const full = await processosNegocioApi.getById(processoId);
      const docs = full.documentos_anexados || [];
      const match =
        docs.find(
          (d) =>
            d.tipo === doc.tipo &&
            d.nome === doc.nome &&
            (d.nome_exibicao || "") === (doc.nome_exibicao || ""),
        ) || docs.find((d) => d.tipo === doc.tipo && d.nome === doc.nome);
      return match?.data || null;
    } catch {
      return null;
    }
  };

  // Baixa o documento anexado. Converte o data URL (base64) em blob pra funcionar bem
  // inclusive com PDFs grandes. Em modo leitura busca o conteúdo sob demanda se necessário.
  const baixar = async (doc: DocumentoAnexado, idx: number) => {
    setBaixandoIdx(idx);
    try {
      const data = await resolverData(doc);
      if (!data) {
        toast.warning("Conteúdo do documento indisponível para download.");
        return;
      }
      const blob = await (await fetch(data)).blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.nome || `documento-${doc.tipo}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30_000);
    } catch {
      toast.warning("Não foi possível baixar o documento.");
    } finally {
      setBaixandoIdx(null);
    }
  };

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFile}
        className="hidden"
      />

      {/* Linha de adição: tipo + botão de upload */}
      {!somenteLeitura && (
        <>
          <div className="space-y-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                Tipo de Documento
              </Label>
              <Select
                key={resetKey}
                value={tipoSelecionado || undefined}
                onValueChange={(v) =>
                  setTipoSelecionado(v as TipoDocumentoAnexado)
                }
              >
                <SelectTrigger className="mt-1 h-9 bg-white">
                  <SelectValue placeholder="(Escolher tipo)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="FLUXOGRAMA">
                    {TIPO_DOCUMENTO_LABEL.FLUXOGRAMA}
                  </SelectItem>
                  <SelectItem value="POP">{TIPO_DOCUMENTO_LABEL.POP}</SelectItem>
                  <SelectItem value="MPS">{TIPO_DOCUMENTO_LABEL.MPS}</SelectItem>
                  <SelectItem value="IT">{TIPO_DOCUMENTO_LABEL.IT}</SelectItem>
                  <SelectItem value="PRI">{TIPO_DOCUMENTO_LABEL.PRI}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Após escolher o tipo: nome de exibição + data do documento */}
            {tipoSelecionado && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 animate-in fade-in slide-in-from-top-1 duration-200">
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Nome de Exibição
                  </Label>
                  <Input
                    value={nomeExibicao}
                    onChange={(e) => setNomeExibicao(e.target.value)}
                    placeholder="Como o documento aparece na lista"
                    className="mt-1 h-9 bg-white"
                  />
                </div>
                <div>
                  <Label className="text-xs font-semibold text-slate-700">
                    Data do Documento
                  </Label>
                  <Input
                    type="date"
                    value={dataDocumento}
                    onChange={(e) => setDataDocumento(e.target.value)}
                    className="mt-1 h-9 bg-white"
                  />
                </div>
              </div>
            )}

            <Button
              type="button"
              onClick={pickFile}
              variant="outline"
              disabled={!tipoSelecionado}
              className="h-9 bg-white border-slate-300 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="h-4 w-4 mr-2" />
              Selecionar Arquivo
            </Button>
          </div>

          <p className="text-xs text-slate-500">
            Formatos aceitos: PNG, JPG, WEBP, PDF, DOC, DOCX, XLS, XLSX, TXT —
            máx. 20MB por arquivo.
          </p>
        </>
      )}

      {/* Lista de documentos anexados */}
      {value.length === 0 ? (
        <p className="text-xs italic text-slate-400 px-1">
          {somenteLeitura ? "—" : "Nenhum documento anexado"}
        </p>
      ) : (
        <ul className="space-y-2">
          {value.map((doc, idx) => (
            <li
              key={`${idx}-${doc.nome}`}
              className="group flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm"
            >
              {fileIconFor(doc.mime)}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${TIPO_DOCUMENTO_BADGE[doc.tipo]}`}
                  >
                    {doc.tipo}
                  </span>
                  <span className="text-sm font-medium text-slate-800 truncate">
                    {doc.nome_exibicao || doc.nome}
                  </span>
                  {doc.data_documento && (
                    <span className="text-[11px] text-slate-500 whitespace-nowrap">
                      {doc.data_documento.split("-").reverse().join("/")}
                    </span>
                  )}
                </div>
                {doc.nome_exibicao && (
                  <p
                    className="text-[11px] text-slate-400 truncate mt-0.5"
                    title={doc.nome}
                  >
                    {doc.nome}
                  </p>
                )}
              </div>
              {(doc.data || processoId != null) && (
                // <a> (não <button>) de propósito: em modo leitura o pai envolve tudo num
                // <fieldset disabled>, que desabilitaria um <button>. Âncora não é form control,
                // então escapa do disabled e o download continua clicável.
                <a
                  role="button"
                  tabIndex={0}
                  onClick={() => {
                    if (baixandoIdx !== idx) baixar(doc, idx);
                  }}
                  onKeyDown={(e) => {
                    if (
                      (e.key === "Enter" || e.key === " ") &&
                      baixandoIdx !== idx
                    ) {
                      e.preventDefault();
                      baixar(doc, idx);
                    }
                  }}
                  className={`flex-shrink-0 cursor-pointer text-slate-400 transition-colors hover:text-blue-600 ${
                    baixandoIdx === idx ? "pointer-events-none opacity-50" : ""
                  }`}
                  title="Baixar documento"
                >
                  {baixandoIdx === idx ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                </a>
              )}
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="opacity-50 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                  title="Remover"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
