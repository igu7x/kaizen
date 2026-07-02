import { useEffect, useMemo, useState } from "react";
import { X, Building2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { areasApi, Unidade } from "@/services/areasApi";

interface UnidadeMultiPickerProps {
  /** Valores selecionados (nomes das unidades — string array). */
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  /** Somente leitura: esconde a busca e o botão de remover (só exibe os selecionados). */
  somenteLeitura?: boolean;
}

type UnidadeComArea = Unidade & { area_nome?: string; area_sigla?: string };

/**
 * Multi-picker que carrega UNIDADES cadastradas nas diretorias (cadastros_unidades),
 * via /api/areas/unidades/all — já filtrado por domínio do usuário logado.
 *
 * Mesmo padrão visual do UserMultiPicker (input "Digite para buscar..." + dropdown
 * absoluto + chips), mas a fonte de dados são as unidades organizacionais
 * (Núcleo de X, Coordenadoria de Y, etc.) — adequado pro campo "Áreas Responsáveis"
 * do template do Escritório de Processos.
 */
export function UnidadeMultiPicker({
  value,
  onChange,
  placeholder = "Digite para buscar...",
  emptyMessage = "Nenhum selecionado",
  somenteLeitura = false,
}: UnidadeMultiPickerProps) {
  const [unidades, setUnidades] = useState<UnidadeComArea[]>([]);
  const [search, setSearch] = useState("");
  const [showList, setShowList] = useState(false);

  // Carrega unidades uma vez no mount
  useEffect(() => {
    let cancelled = false;
    areasApi
      .getAllUnidades()
      .then((data) => {
        if (cancelled) return;
        const sorted = [...data].sort((a, b) =>
          (a.nome || "").localeCompare(b.nome || "", "pt-BR"),
        );
        setUnidades(sorted);
      })
      .catch((err) =>
        console.warn("[UnidadeMultiPicker] erro ao carregar unidades:", err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const valueSet = useMemo(() => new Set(value), [value]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return unidades.filter((u) => {
      if (valueSet.has(u.nome)) return false;
      if (!q) return true;
      return (
        (u.nome || "").toLowerCase().includes(q) ||
        (u.area_nome || "").toLowerCase().includes(q) ||
        (u.area_sigla || "").toLowerCase().includes(q) ||
        (u.responsavel || "").toLowerCase().includes(q)
      );
    });
  }, [unidades, valueSet, search]);

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
      {!somenteLeitura && (
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
              filtered.map((u) => (
                <div
                  key={u.id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-slate-50"
                  onMouseDown={() => handleSelect(u.nome)}
                >
                  <div className="text-slate-800">{u.nome}</div>
                  {(u.area_sigla || u.area_nome) && (
                    <div className="text-[10px] text-slate-400 truncate">
                      {u.area_sigla ? `${u.area_sigla} — ` : ""}
                      {u.area_nome}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
      )}

      {value.length === 0 ? (
        <p className="text-xs italic text-slate-400 px-1">
          {somenteLeitura ? "—" : emptyMessage}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((name, idx) => (
            <li
              key={`${idx}-${name}`}
              className="group flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              <Building2 className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
              <span className="flex-1 break-words">{name}</span>
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
