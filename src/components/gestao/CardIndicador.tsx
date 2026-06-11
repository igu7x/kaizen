import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface CardIndicadorProps {
  title: string;
  value: number | string;
  icon: LucideIcon;
  color: "blue" | "green" | "yellow" | "orange" | "gray" | "teal";
}

// Cores equilibradas conforme novo design
const colorClasses = {
  blue: "bg-[#3b82f6]", // Azul para Totais
  teal: "bg-[#3b82f6]", // Alias para compatibilidade
  green: "bg-[#22c55e]", // Verde para Concluído
  yellow: "bg-[#f59e0b]", // Amarelo/âmbar para Em andamento
  orange: "bg-[#f97316]", // Laranja para A iniciar
  gray: "bg-gray-500",
};

// Texto branco em todos os cards
const textClasses = {
  blue: "text-white",
  teal: "text-white",
  green: "text-white",
  yellow: "text-white",
  orange: "text-white",
  gray: "text-white",
};

export function CardIndicador({
  title,
  value,
  icon: Icon,
  color,
}: CardIndicadorProps) {
  return (
    <Card
      className={cn(
        "border-0 rounded-lg transition-all duration-200",
        colorClasses[color],
      )}
    >
      <CardContent className="p-3 lg:p-4 xl:p-5 h-full flex flex-col justify-center">
        <div className="flex items-center justify-between gap-2">
          <div className={cn("min-w-0", textClasses[color])}>
            <div className="text-2xl lg:text-3xl 2xl:text-4xl font-bold leading-none tracking-tight">
              {value}
            </div>
            <div className="text-xs lg:text-sm font-medium capitalize mt-1 opacity-90">
              {title}
            </div>
          </div>
          <div className="flex-shrink-0">
            <Icon
              className={cn(
                "h-6 w-6 lg:h-7 lg:w-7 2xl:h-8 2xl:w-8 opacity-80",
                textClasses[color],
              )}
              strokeWidth={1.5}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
