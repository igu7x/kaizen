import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";
import { Info, XCircle } from "lucide-react";
import { pcaApi } from "@/services/pcaApi";
import type { PcaItem } from "@/types";

/** Rótulo amigável de um item do PCA: "PCA {numero} — {objeto}" (sem zeros à esquerda). */
export const labelPcaItem = (item: PcaItem): string => {
  const raw = String(item.item_pca ?? "");
  const num = raw.replace(/^0+/, "") || raw;
  const desc = item.description || item.objeto || "";
  return `PCA ${num}${desc ? " — " + desc : ""}`;
};

interface PcaItemPickerProps {
  /** id do item do PCA selecionado (ou undefined/null quando nenhum). */
  value: number | null | undefined;
  onChange: (id: number | undefined) => void;
  disabled?: boolean;
  /** Rótulo já conhecido do item (ex.: pca_item_label do projeto), usado enquanto a lista carrega. */
  fallbackLabel?: string | null;
  className?: string;
}

/**
 * Seletor de item do PCA (Plano de Contratações Anual). Puxa os itens cadastrados no
 * módulo Contratações de TIC > Orçamento > PCA (`pcaApi.getPcaItems`) e permite buscar +
 * vincular um item à contratação do projeto. Popover em portal (escapa clips de overflow).
 */
export function PcaItemPicker({
  value,
  onChange,
  disabled,
  fallbackLabel,
  className,
}: PcaItemPickerProps) {
  const [pcaItens, setPcaItens] = useState<PcaItem[]>([]);
  const [busca, setBusca] = useState("");
  const [showList, setShowList] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const pcaData = await pcaApi.getPcaItems();
        if (!cancelled) setPcaItens(pcaData.filter((p) => !p.is_deleted));
      } catch {
        /* erro já tratado pelo apiClient ou ignorado intencionalmente */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selecionado = pcaItens.find((p) => p.id === value);
  const label = selecionado
    ? labelPcaItem(selecionado)
    : fallbackLabel || (value ? `Item PCA #${value}` : "");

  const q = busca.trim().toLowerCase();
  const filtrados = pcaItens
    .filter(
      (item) =>
        !q ||
        labelPcaItem(item).toLowerCase().includes(q) ||
        String(item.item_pca ?? "")
          .toLowerCase()
          .includes(q),
    )
    .slice(0, 50);

  return (
    <div className={`relative ${className || "flex-1 min-w-[220px]"}`}>
      {value ? (
        <div className="flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 px-2.5 py-2 text-sm">
          <Info className="h-4 w-4 flex-shrink-0 text-blue-600" />
          <span className="flex-1 truncate text-blue-900" title={label}>
            {label}
          </span>
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(undefined)}
              className="text-blue-500 hover:text-red-600 transition-colors"
              title="Remover item do PCA"
            >
              <XCircle className="h-4 w-4" />
            </button>
          )}
        </div>
      ) : disabled ? (
        <span className="text-sm text-gray-400">
          Nenhum item do PCA selecionado
        </span>
      ) : (
        // Popover (portal) em vez de um <div absolute>: o AccordionContent tem
        // overflow-hidden e o corpo do Dialog rola, então a lista ancorada ficava
        // recortada e atrás do conteúdo. O portal escapa desses clips.
        <Popover open={showList} onOpenChange={setShowList}>
          <PopoverAnchor asChild>
            <Input
              placeholder="Adicionar o item do PCA..."
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setShowList(true);
              }}
              onFocus={() => setShowList(true)}
            />
          </PopoverAnchor>
          <PopoverContent
            align="start"
            sideOffset={4}
            className="w-[340px] max-w-[80vw] max-h-60 overflow-y-auto p-0"
            onOpenAutoFocus={(e) => e.preventDefault()}
            onCloseAutoFocus={(e) => e.preventDefault()}
          >
            {pcaItens.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                Nenhum item do PCA cadastrado.
              </div>
            ) : filtrados.length === 0 ? (
              <div className="px-3 py-2 text-sm text-gray-500">
                Nenhum item encontrado.
              </div>
            ) : (
              filtrados.map((item) => (
                <div
                  key={item.id}
                  className="px-3 py-2 text-sm cursor-pointer hover:bg-gray-100"
                  onMouseDown={() => {
                    onChange(item.id);
                    setBusca("");
                    setShowList(false);
                  }}
                >
                  {labelPcaItem(item)}
                </div>
              ))
            )}
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
}
