import { useState } from "react";
import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface ListInputProps {
  /** Itens atuais da lista */
  value: string[];
  /** Callback ao adicionar/remover */
  onChange: (next: string[]) => void;
  /** Placeholder do input de adição */
  placeholder?: string;
  /** Mensagem quando a lista está vazia */
  emptyMessage?: string;
  /** Somente leitura: esconde o campo de adicionar e o botão de remover (só exibe os itens). */
  somenteLeitura?: boolean;
}

/**
 * Input pra editar listas de strings (proprietários, atores, áreas etc).
 * Exibe os itens existentes como chips com botão de remover + um campo
 * pra adicionar novo item (Enter ou clique no botão "+" confirma).
 */
export function ListInput({
  value,
  onChange,
  placeholder = "Digite e pressione Enter para adicionar",
  emptyMessage = "Nenhum item adicionado",
  somenteLeitura = false,
}: ListInputProps) {
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (value.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...value, v]);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      {!somenteLeitura && (
        <div className="flex gap-2">
          <Input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder={placeholder}
            className="h-9 flex-1"
          />
          <Button
            type="button"
            onClick={add}
            variant="outline"
            size="sm"
            className="h-9 px-3"
            disabled={!draft.trim()}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      )}

      {value.length === 0 ? (
        <p className="text-xs italic text-slate-400 px-1">
          {somenteLeitura ? "—" : emptyMessage}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((item, idx) => (
            <li
              key={`${idx}-${item}`}
              className="group flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <span className="mt-1 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-blue-500" />
              <span className="flex-1 break-words">{item}</span>
              {!somenteLeitura && (
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="opacity-50 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
