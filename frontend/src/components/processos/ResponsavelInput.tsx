import { useEffect, useMemo, useState } from "react";
import { X, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { areasApi, Unidade } from "@/services/areasApi";
import {
  ResponsavelEntry,
  normalizeResponsavel,
} from "@/services/processosNegocioApi";

interface ResponsavelInputProps {
  /** Lista de responsáveis (área + cargo). */
  value: ResponsavelEntry[];
  onChange: (next: ResponsavelEntry[]) => void;
  emptyMessage?: string;
}

type UnidadeComArea = Unidade & { area_nome?: string; area_sigla?: string };

/**
 * Input de Responsável em duas camadas: camada 1 busca a área digitando no
 * cadastro geral de unidades (não só nas áreas macro), camada 2 digita o cargo.
 * Permite múltiplas entradas. No documento aparece como "cargo (área)".
 */
export function ResponsavelInput({
  value,
  onChange,
  emptyMessage = "Nenhum responsável",
}: ResponsavelInputProps) {
  const [unidades, setUnidades] = useState<UnidadeComArea[]>([]);
  const [area, setArea] = useState("");
  const [showList, setShowList] = useState(false);
  const [cargo, setCargo] = useState("");

  // Carrega o cadastro geral de unidades uma vez no mount.
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
        console.warn("[ResponsavelInput] erro ao carregar unidades:", err),
      );
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = area.toLowerCase().trim();
    return unidades.filter((u) => {
      if (!q) return true;
      return (
        (u.nome || "").toLowerCase().includes(q) ||
        (u.area_nome || "").toLowerCase().includes(q) ||
        (u.area_sigla || "").toLowerCase().includes(q)
      );
    });
  }, [unidades, area]);

  const add = () => {
    const a = area.trim();
    const c = cargo.trim();
    if (!a || !c) return;
    onChange([...value, { area: a, cargo: c }]);
    setArea("");
    setCargo("");
    setShowList(false);
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        {/* Camada 1: área — busca por digitação no cadastro geral de unidades */}
        <div className="relative">
          <Input
            type="text"
            value={area}
            onChange={(e) => {
              setArea(e.target.value);
              setShowList(true);
            }}
            onFocus={() => setShowList(true)}
            onBlur={() => setTimeout(() => setShowList(false), 200)}
            placeholder="Digite a área..."
            className="bg-white"
          />
          {showList && (
            <div className="absolute z-50 mt-1 max-h-60 w-full overflow-y-auto rounded-md border border-slate-200 bg-white shadow-lg">
              {filtered.length === 0 ? (
                <div className="px-3 py-2 text-sm italic text-slate-500">
                  {area.trim()
                    ? "Nenhum resultado"
                    : "Comece a digitar para buscar..."}
                </div>
              ) : (
                filtered.map((u) => (
                  <div
                    key={u.id}
                    className="cursor-pointer px-3 py-2 text-sm hover:bg-slate-50"
                    onMouseDown={() => {
                      setArea(u.nome);
                      setShowList(false);
                    }}
                  >
                    <div className="text-slate-800">{u.nome}</div>
                    {(u.area_sigla || u.area_nome) && (
                      <div className="truncate text-[10px] text-slate-400">
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

        {/* Camada 2: cargo */}
        <div className="flex gap-2">
          <Input
            type="text"
            value={cargo}
            onChange={(e) => setCargo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                add();
              }
            }}
            placeholder="Digite o cargo"
            className="min-w-0 flex-1 bg-white"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={add}
            disabled={!area.trim() || !cargo.trim()}
            className="flex-shrink-0"
          >
            Adicionar
          </Button>
        </div>
      </div>

      {value.length === 0 ? (
        <p className="text-xs italic text-slate-400 px-1">{emptyMessage}</p>
      ) : (
        <ul className="space-y-1.5">
          {value.map((raw, idx) => {
            const item = normalizeResponsavel(raw);
            return (
              <li
                key={`${idx}-${item.cargo}`}
                className="group flex items-start gap-2 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
              >
                <Briefcase className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-blue-500" />
                <span className="flex-1 break-words">
                  <span className="font-medium">{item.cargo}</span>
                  {item.area && (
                    <span className="text-slate-400"> ({item.area})</span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => remove(idx)}
                  className="opacity-50 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all flex-shrink-0"
                  title="Remover"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
