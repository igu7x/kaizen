import { cn } from "@/lib/utils";
import {
  FileText,
  Send,
  Users,
  Scale,
  Gavel,
  ShieldCheck,
  Truck,
  Globe,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapeamento visual de cada estado da Formação do PCA com informações
 * contextuais sobre o DFD para orientar o usuário.
 */
interface FaseConfig {
  icon: LucideIcon;
  titulo: string;
  descricao: string;
  atorLabel: string;
  /** Cor do ícone e borda (classes Tailwind). */
  color: {
    border: string;
    bg: string;
    iconBg: string;
    iconText: string;
    atorBadge: string;
    atorText: string;
  };
}

const FASE_CONFIG: Record<string, FaseConfig> = {
  aguardando_proad: {
    icon: FileText,
    titulo: "Abertura do DFD",
    descricao:
      "Você está iniciando a construção do Documento de Formalização da Demanda (DFD) do PCA-TIC. Informe o PROAD de instrução para carregar os blocos do DFD-Consulta.",
    atorLabel: "CCA",
    color: {
      border: "border-blue-200",
      bg: "bg-blue-50/60",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      atorBadge: "bg-blue-100",
      atorText: "text-blue-700",
    },
  },
  aberto: {
    icon: Send,
    titulo: "DFD-Consulta pronto para envio",
    descricao:
      "O Documento de Formalização da Demanda está pronto. Revise os blocos abaixo e, quando satisfeito, encaminhe o DFD-Consulta para apreciação das áreas demandantes.",
    atorLabel: "CCA",
    color: {
      border: "border-blue-200",
      bg: "bg-blue-50/60",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      atorBadge: "bg-blue-100",
      atorText: "text-blue-700",
    },
  },
  em_consulta_1: {
    icon: Users,
    titulo: "Consulta (1ª Validação)",
    descricao:
      "As áreas demandantes estão analisando e validando os IFOs (Itens de Formação do Orçamento) do DFD. A Validação 1 deve ser realizada pelas Unidades Descentralizadas.",
    atorLabel: "Demandantes",
    color: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/60",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
      atorBadge: "bg-emerald-100",
      atorText: "text-emerald-700",
    },
  },
  em_consulta_2: {
    icon: Users,
    titulo: "Consulta (2ª Validação)",
    descricao:
      "As áreas demandantes estão realizando a Validação 2 dos IFOs pelas Diretorias/Secretarias e remetendo sua partição.",
    atorLabel: "Demandantes",
    color: {
      border: "border-emerald-200",
      bg: "bg-emerald-50/60",
      iconBg: "bg-emerald-100",
      iconText: "text-emerald-600",
      atorBadge: "bg-emerald-100",
      atorText: "text-emerald-700",
    },
  },
  consolidacao_cca: {
    icon: FileText,
    titulo: "Consolidação do DFD — CCA",
    descricao:
      "A CCA está consolidando as propostas recebidas das áreas demandantes. Os IFOs são organizados e preparados para encaminhamento à GEJUT para análise de conformidade.",
    atorLabel: "CCA",
    color: {
      border: "border-blue-200",
      bg: "bg-blue-50/60",
      iconBg: "bg-blue-100",
      iconText: "text-blue-600",
      atorBadge: "bg-blue-100",
      atorText: "text-blue-700",
    },
  },
  validacao_gejut: {
    icon: Scale,
    titulo: "Validação jurídica — GEJUT",
    descricao:
      "A Gerência Jurídica de TIC (GEJUT) analisa a conformidade jurídica do DFD consolidado. Após validação, o documento será encaminhado à SGJT para apreciação.",
    atorLabel: "GEJUT",
    color: {
      border: "border-violet-200",
      bg: "bg-violet-50/60",
      iconBg: "bg-violet-100",
      iconText: "text-violet-600",
      atorBadge: "bg-violet-100",
      atorText: "text-violet-700",
    },
  },
  apreciacao_sgjt: {
    icon: Gavel,
    titulo: "Apreciação — SGJT",
    descricao:
      "A Secretaria-Geral da Junta de Trabalho (SGJT) aprecia o DFD e encaminha para deliberação nos comitês CGTIC e CGovTIC.",
    atorLabel: "SGJT",
    color: {
      border: "border-amber-200",
      bg: "bg-amber-50/60",
      iconBg: "bg-amber-100",
      iconText: "text-amber-600",
      atorBadge: "bg-amber-100",
      atorText: "text-amber-700",
    },
  },

  remessa_dg: {
    icon: Truck,
    titulo: "Remessa à Diretoria-Geral",
    descricao:
      "O DFD foi remetido à Diretoria-Geral. A CCA pode publicar o PCA-TIC quando autorizada.",
    atorLabel: "CCA",
    color: {
      border: "border-slate-300",
      bg: "bg-slate-50/60",
      iconBg: "bg-slate-200",
      iconText: "text-slate-600",
      atorBadge: "bg-slate-200",
      atorText: "text-slate-700",
    },
  },
  publicado: {
    icon: Globe,
    titulo: "PCA-TIC publicado",
    descricao:
      "O PCA-TIC foi publicado e a versão está congelada. O documento está disponível para consulta.",
    atorLabel: "Publicado",
    color: {
      border: "border-green-200",
      bg: "bg-green-50/60",
      iconBg: "bg-green-100",
      iconText: "text-green-600",
      atorBadge: "bg-green-100",
      atorText: "text-green-700",
    },
  },
};

interface FaseBannerProps {
  /** Estado atual do ciclo (ex.: "em_consulta", "consolidacao_cca"). */
  estado: string;
  /** Ano de formação para interpolação nos textos. */
  ano?: number;
  /** Texto adicional exibido abaixo da descrição padrão. */
  nota?: string;
  className?: string;
}

/**
 * Banner contextual da fase atual da Formação do PCA.
 * Exibe ícone, título, descrição do DFD e ator responsável, com cores
 * diferenciadas por ator para orientar visualmente o usuário.
 */
export function FaseBanner({ estado, ano, nota, className }: FaseBannerProps) {
  const config = FASE_CONFIG[estado];
  if (!config) return null;

  const Icon = config.icon;
  const descricao = ano
    ? config.descricao.replace("{ano}", String(ano))
    : config.descricao;

  return (
    <div
      className={cn(
        "rounded-xl border p-5 shadow-sm transition-all",
        config.color.border,
        config.color.bg,
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {/* Ícone da fase */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
            config.color.iconBg,
          )}
        >
          <Icon className={cn("h-5 w-5", config.color.iconText)} />
        </div>

        {/* Textos */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2.5 mb-1.5">
            <h3 className="text-base font-semibold text-slate-800 leading-tight">
              {config.titulo}
            </h3>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold",
                config.color.atorBadge,
                config.color.atorText,
              )}
            >
              {config.atorLabel}
            </span>
          </div>
          <p className="text-sm text-slate-600 leading-relaxed max-w-3xl">
            {descricao}
          </p>
          {nota && (
            <p className="text-xs text-slate-500 mt-2 leading-relaxed max-w-3xl">
              {nota}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
