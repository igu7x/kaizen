import { useEffect, useMemo, useState } from "react";
import { X, User as UserIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { pessoasApi, Pessoa } from "@/services/pessoasApi";

interface UserMultiPickerProps {
  /** Valores selecionados (nomes das pessoas — string array). */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
}

/**
 * Multi-picker que carrega PESSOAS de cadastros_pessoas (/api/pessoas, já filtrado
 * por domínio do usuário logado) com input "Digite para buscar..." + dropdown
 * absoluto — mesmo padrão visual do cadastro de projetos / governança.
 *
 * Salva no estado os NOMES (não os IDs), pra renderização do template ser
 * direta no momento de exibir.
 */
export function UserMultiPicker({
  value,
  onChange,
  placeholder = "Digite para buscar...",
  emptyMessage = "Nenhum selecionado",
}: UserMultiPickerProps) {
  const [pessoas, setPessoas] = useState<Pessoa[]>([]);
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);

  // Carrega pessoas uma vez no mount
  useEffect(() => {
    let cancelled = false;
    pessoasApi
      .getAll()
      .then((data) => {
        if (cancelled) return;
        const sorted = [...data].sort((a, b) =>
          (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
        );
        setPessoas(sorted);
      })
      .catch((err) =>
        console.warn("[UserMultiPicker] erro ao carregar pessoas:", err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const valueSet = useMemo(() => new Set(value), [value]);

  // Filtra pelo texto digitado + ESCONDE quem já foi selecionado
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return pessoas.filter((p) => {
      if (valueSet.has(p.nome)) return false;
      if (!q) return true;
      return (
        (p.nome || "").toLowerCase().includes(q) ||
        (p.email || "").toLowerCase().includes(q) ||
        (p.unidade_nome || "").toLowerCase().includes(q) ||
        (p.area_nome || "").toLowerCase().includes(q)
      );
    });
  }, [pessoas, valueSet, search]);

  const handleSelect = (nome: string) => {
    onChange([...value, nome]);
    setSearch("");
    setShowList(false);
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <Input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setShowList(true);
          }}
          onFocus={() => setShowList(true)}
          onBlur={() => setTimeout(() => setShowList(false), 200)}
          placeholder={placeholder}
          className="bg-white"
        />

        {showList && (
          <div className="absolute z-50 w-full mt-1 bg-white border border-slate-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-3 py-2 text-sm text-slate-500 italic">
                {search.trim()
                  ? "Nenhum resultado"
                  : "Comece a digitar para buscar..."}
              </div>
            ) : (
              filtered.map((p) => (
                <div
                  key={p.id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  onMouseDown={() => handleSelect(p.nome)}
                >
                  <div className="text-slate-800">{p.nome}</div>
                  {(p.unidade_nome || p.area_nome) && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {p.unidade_nome || p.area_nome}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {value.length === 0 ? (
        <p className="text-xs italic text-slate-400 px-1">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((name, idx) => (
            <li
              key={`${idx}-${name}`}
              className="group flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <UserIcon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
              <span className="flex-1 break-words">{name}</span>
              <button
                type="button"
                onClick={() => remove(idx)}
                className="opacity-50 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                title="Remover"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
