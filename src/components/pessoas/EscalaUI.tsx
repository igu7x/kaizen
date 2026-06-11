import { parseEscalaItem } from "@/constants/competencias";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface EscalaItem {
  value: string;
  label: string;
}

/**
 * Renderiza a legenda da escala (1-5) como lista com marcadores. O prefixo
 * "N – Título:" sai em negrito; a descrição vai no peso normal logo em seguida.
 */
export function EscalaLegenda({ items }: { items: readonly EscalaItem[] }) {
  return (
    <ul className="list-disc ml-6 space-y-1">
      {items.map((item) => {
        const { num, titulo, descricao } = parseEscalaItem(item.label);
        return (
          <li key={item.value}>
            <strong className="font-semibold text-gray-900">
              {num} – {titulo}:
            </strong>{" "}
            {descricao}
          </li>
        );
      })}
    </ul>
  );
}

type AccentColor = "teal" | "violet" | "blue" | "rose" | "amber" | "sky";

const ACCENT_CLASSES: Record<AccentColor, string> = {
  teal: "text-teal-600 focus:ring-teal-500",
  violet: "text-violet-600 focus:ring-violet-500",
  blue: "text-blue-600 focus:ring-blue-500",
  rose: "text-rose-600 focus:ring-rose-500",
  amber: "text-amber-600 focus:ring-amber-500",
  sky: "text-sky-600 focus:ring-sky-500",
};

/**
 * Grupo de radio buttons da escala. Cada opção mostra só a forma curta ("N – Título")
 * e usa o Tooltip (shadcn/Radix) pra exibir a descrição completa em um popover
 * estilizado quando o usuário passa o mouse ou foca via teclado.
 */
export function EscalaRadioGroup({
  items,
  name,
  value,
  onChange,
  disabled = false,
  accentColor = "teal",
}: {
  items: readonly EscalaItem[];
  name: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  accentColor?: AccentColor;
}) {
  const ringClass = ACCENT_CLASSES[accentColor];
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={50}>
      <div className="mt-2 space-y-2">
        {items.map((opt) => {
          const { num, titulo, descricao } = parseEscalaItem(opt.label);
          return (
            <Tooltip key={opt.value}>
              <TooltipTrigger asChild>
                <label
                  className={`flex items-start gap-3 group w-fit ${disabled ? "pointer-events-none" : "cursor-pointer"}`}
                >
                  <input
                    type="radio"
                    name={name}
                    value={opt.value}
                    checked={value === opt.value}
                    onChange={() => onChange(opt.value)}
                    disabled={disabled}
                    className={`mt-0.5 h-4 w-4 border-gray-300 ${ringClass}`}
                  />
                  <span className="text-sm text-gray-700 group-hover:text-gray-900">
                    {num} – {titulo}
                  </span>
                </label>
              </TooltipTrigger>
              <TooltipContent
                side="right"
                align="start"
                sideOffset={12}
                className="max-w-sm bg-white text-gray-800 border border-gray-200 shadow-lg px-3.5 py-2.5 leading-relaxed"
              >
                {descricao}
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </TooltipProvider>
  );
}
