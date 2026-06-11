import { toast } from "sonner";
import { useRef } from "react";
import { Upload, FileImage, FileText as FileIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface FluxogramaUploadProps {
  data: string | null; // data URL base64 (image/* ou application/pdf)
  filename: string | null;
  mime: string | null;
  onChange: (next: {
    data: string | null;
    filename: string | null;
    mime: string | null;
  }) => void;
}

const ACCEPT = "image/png,image/jpeg,image/jpg,image/webp,application/pdf";
const MAX_BYTES = 6_000_000; // ~6MB — bate com o limite do backend

async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

/**
 * Comprime imagens grandes (>2048px) pra economizar espaço sem perder definição
 * suficiente pra leitura de diagramas BPMN. PDFs vão "as-is".
 */
async function compressIfImage(
  file: File,
): Promise<{ data: string; mime: string }> {
  if (!file.type.startsWith("image/")) {
    return { data: await readFileAsDataURL(file), mime: file.type };
  }
  const dataUrl = await readFileAsDataURL(file);
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = dataUrl;
  });
  // Diagramas precisam de boa resolução pra leitura — só comprime se exceder.
  const MAX_DIM = 2048;
  if (img.width <= MAX_DIM && img.height <= MAX_DIM) {
    return { data: dataUrl, mime: file.type };
  }
  const ratio = Math.min(1, MAX_DIM / Math.max(img.width, img.height));
  const w = Math.round(img.width * ratio);
  const h = Math.round(img.height * ratio);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context indisponível");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  // PNG preserva linhas finas de diagrama melhor que JPEG
  const out = canvas.toDataURL("image/png");
  return { data: out, mime: "image/png" };
}

export function FluxogramaUpload({
  data,
  filename,
  mime,
  onChange,
}: FluxogramaUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePick = () => fileInputRef.current?.click();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    if (file.size > MAX_BYTES * 2) {
      // 2x do limite final — se o usuário tenta um arquivo enorme, alerta na hora
      // (compressão pode reduzir, mas vale avisar).
      toast.warning(
        `Arquivo muito grande (${(file.size / 1_000_000).toFixed(1)}MB). Tamanho máximo: ${MAX_BYTES / 1_000_000}MB.`,
      );
      return;
    }

    try {
      const { data: encoded, mime: outMime } = await compressIfImage(file);
      if (encoded.length > MAX_BYTES) {
        toast.warning(
          `Arquivo final ainda muito grande após compressão. Tente uma imagem menor.`,
        );
        return;
      }
      onChange({ data: encoded, filename: file.name, mime: outMime });
    } catch (err: any) {
      toast.warning("Não foi possível processar o arquivo.");
    }
  };

  const handleRemove = () => {
    onChange({ data: null, filename: null, mime: null });
  };

  const isImage = mime?.startsWith("image/");
  const isPdf = mime === "application/pdf";

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        onChange={handleFile}
        className="hidden"
      />

      {!data ? (
        // Estado vazio — botão pra anexar
        <button
          type="button"
          onClick={handlePick}
          className="w-full border-2 border-dashed border-slate-300 hover:border-blue-400 hover:bg-blue-50/50 rounded-xl py-10 px-4 transition-all flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-blue-600"
        >
          <Upload className="h-8 w-8" />
          <span className="text-sm font-medium">
            Clique para anexar o fluxograma
          </span>
          <span className="text-xs">PNG, JPG, WEBP ou PDF — máx. 6MB</span>
        </button>
      ) : (
        // Preview do arquivo
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-white">
          <div className="flex items-center justify-between gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-200">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              {isImage ? (
                <FileImage className="h-4 w-4 flex-shrink-0 text-blue-500" />
              ) : (
                <FileIcon className="h-4 w-4 flex-shrink-0 text-red-500" />
              )}
              <span className="text-sm font-medium text-slate-700 truncate">
                {filename || "fluxograma"}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Button
                type="button"
                onClick={handlePick}
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
              >
                Substituir
              </Button>
              <button
                type="button"
                onClick={handleRemove}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="p-3 bg-slate-50">
            {isImage && (
              <img
                src={data}
                alt={filename || "Fluxograma"}
                className="w-full max-h-[600px] object-contain rounded-md bg-white"
              />
            )}
            {isPdf && (
              <iframe
                src={data}
                title={filename || "Fluxograma"}
                className="w-full h-[600px] rounded-md bg-white border border-slate-200"
              />
            )}
            {!isImage && !isPdf && (
              <div className="text-center py-12 text-slate-400 text-sm">
                Pré-visualização indisponível para este tipo de arquivo.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
