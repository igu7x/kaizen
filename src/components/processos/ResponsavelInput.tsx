import { useState } from "react";
import { X, Briefcase } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Area } from "@/services/areasApi";
import {
  ResponsavelEntry,
  normalizeResponsavel,
} from "@/services/processosNegocioApi";

interface ResponsavelInputProps {
  /** Lista de responsáveis (área + cargo). */
  value: ResponsavelEntry[];
  onChange: (next: ResponsavelEntry[]) => void;
  /** Áreas disponíveis para a camada 1 (seleção da área). */
  areas: Area[];
  emptyMessage?: string;
}

/**
 * Input de Responsável em duas camadas: camada 1 seleciona a área, camada 2
 * digita o nome do cargo. Permite múltiplas entradas. No PDF aparece somente o
 * cargo (ver generateProcessoNegocioPDF); aqui mostramos "cargo — área".
 */
export function ResponsavelInput({
  value,
  onChange,
  areas,
  emptyMessage = "Nenhum responsável",
}: ResponsavelInputProps) {
  const [area, setArea] = useState("");
  const [cargo, setCargo] = useState("");

  const add = () => {
    const a = area.trim();
    const c = cargo.trim();
    if (!a || !c) return;
    onChange([...value, { area: a, cargo: c }]);
    setArea("");
    setCargo("");
  };

  const remove = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="space-y-2">
        <Select value={area} onValueChange={setArea}>
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder="Selecionar a área" />
          </SelectTrigger>
          <SelectContent>
            {areas.map((a) => (
              <SelectItem key={a.id} value={a.nome}>
                {a.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                    <span className="text-slate-400"> — {item.area}</span>
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
