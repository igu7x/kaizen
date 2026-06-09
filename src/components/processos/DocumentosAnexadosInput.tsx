import { useRef, useState } from 'react';
import { Upload, Paperclip, X, FileText, FileImage, File as FileIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  DocumentoAnexado,
  TipoDocumentoAnexado,
  TIPO_DOCUMENTO_LABEL,
  TIPO_DOCUMENTO_BADGE,
} from '@/services/processosNegocioApi';

interface DocumentosAnexadosInputProps {
  value: DocumentoAnexado[];
  onChange: (next: DocumentoAnexado[]) => void;
}

const ACCEPT = 'image/png,image/jpeg,image/jpg,image/webp,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain';
const MAX_BYTES_PER_FILE = 5_000_000; // 5MB por arquivo

async function readFileAsDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function fileIconFor(mime: string) {
  if (mime.startsWith('image/')) return <FileImage className="h-4 w-4 text-blue-500" />;
  if (mime === 'application/pdf') return <FileText className="h-4 w-4 text-red-500" />;
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
export function DocumentosAnexadosInput({ value, onChange }: DocumentosAnexadosInputProps) {
  const [tipoSelecionado, setTipoSelecionado] = useState<TipoDocumentoAnexado | null>(null);
  // Contador usado como `key` do Select pra forçar remount após reset —
  // Radix Select não reseta o display visual ao trocar value controlado pra undefined.
  const [resetKey, setResetKey] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const pickFile = () => {
    if (!tipoSelecionado) {
      alert('Selecione o tipo de documento antes de anexar.');
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!tipoSelecionado) return;

    if (file.size > MAX_BYTES_PER_FILE) {
      alert(`Arquivo muito grande (${(file.size / 1_000_000).toFixed(1)}MB). Máximo por arquivo: ${MAX_BYTES_PER_FILE / 1_000_000}MB.`);
      return;
    }

    try {
      const data = await readFileAsDataURL(file);
      const novo: DocumentoAnexado = {
        tipo: tipoSelecionado,
        nome: file.name,
        mime: file.type || 'application/octet-stream',
        data,
      };
      onChange([...value, novo]);
      // Reseta o tipo após anexar pra forçar o usuário a escolher de novo no próximo
      setTipoSelecionado(null);
      setResetKey((k) => k + 1);
    } catch (err) {
      console.error('Erro ao ler arquivo:', err);
      alert('Não foi possível ler o arquivo.');
    }
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
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
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
        <div>
          <Label className="text-xs font-semibold text-slate-700">Tipo de Documento</Label>
          <Select
            key={resetKey}
            value={tipoSelecionado || undefined}
            onValueChange={(v) => setTipoSelecionado(v as TipoDocumentoAnexado)}
          >
            <SelectTrigger className="mt-1 h-9 bg-white">
              <SelectValue placeholder="(Escolher tipo)" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MPS">{TIPO_DOCUMENTO_LABEL.MPS}</SelectItem>
              <SelectItem value="POP">{TIPO_DOCUMENTO_LABEL.POP}</SelectItem>
              <SelectItem value="PRI">{TIPO_DOCUMENTO_LABEL.PRI}</SelectItem>
              <SelectItem value="AUX">{TIPO_DOCUMENTO_LABEL.AUX}</SelectItem>
            </SelectContent>
          </Select>
        </div>
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
        Formatos aceitos: PNG, JPG, WEBP, PDF, DOC, DOCX, XLS, XLSX, TXT — máx. 5MB por arquivo.
      </p>

      {/* Lista de documentos anexados */}
      {value.length === 0 ? (
        <p className="text-xs italic text-slate-400 px-1">Nenhum documento anexado</p>
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
                  <span className="text-sm font-medium text-slate-800 truncate">{doc.nome}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="opacity-50 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                title="Remover"
              >
                <X className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
