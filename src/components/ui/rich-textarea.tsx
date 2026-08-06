import { useRef, useEffect, useCallback, useState } from "react";
import { Bold } from "lucide-react";
import { cn } from "@/lib/utils";

interface RichTextareaProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
  minHeight?: number;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** markdown `**` -> HTML (o \n é preservado como texto e renderizado via white-space: pre-wrap). */
function mdToHtml(md: string): string {
  return escapeHtml(md).replace(/\*\*([\s\S]+?)\*\*/g, "<strong>$1</strong>");
}

function isBoldEl(el: HTMLElement): boolean {
  if (el.nodeName === "B" || el.nodeName === "STRONG") return true;
  const fw = el.style?.fontWeight;
  return fw === "bold" || (!!fw && parseInt(fw, 10) >= 600);
}

/** DOM do contentEditable -> markdown `**`. Trata <br>/<div> como quebra de linha. */
function domToMd(root: HTMLElement): string {
  let md = "";
  const walk = (node: Node, bold: boolean) => {
    node.childNodes.forEach((child) => {
      if (child.nodeType === Node.TEXT_NODE) {
        const t = child.textContent || "";
        md += bold && t ? `**${t}**` : t;
      } else if (child.nodeName === "BR") {
        md += "\n";
      } else {
        const el = child as HTMLElement;
        if (/^(DIV|P)$/.test(el.nodeName) && md && !md.endsWith("\n")) md += "\n";
        walk(el, bold || isBoldEl(el));
      }
    });
  };
  walk(root, false);
  return md;
}

/**
 * Caixa de texto WYSIWYG com suporte a NEGRITO (botão + Ctrl+B). Mostra o negrito de verdade
 * enquanto edita, mas guarda/emite o conteúdo como marcação `**texto**` (texto puro, sem HTML).
 */
export function RichTextarea({
  value,
  onChange,
  placeholder,
  disabled,
  id,
  className,
  minHeight = 120,
}: RichTextareaProps) {
  const ref = useRef<HTMLDivElement>(null);
  const last = useRef<string | null>(null);
  const [empty, setEmpty] = useState(!value);

  // Sincroniza o DOM quando o valor muda POR FORA (não durante a digitação).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (value !== last.current) {
      const current = (el.textContent || "").length === 0 ? "" : domToMd(el);
      if (value !== current) el.innerHTML = mdToHtml(value);
      last.current = value;
      setEmpty(!value);
    }
  }, [value]);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const md = (el.textContent || "").length === 0 ? "" : domToMd(el);
    last.current = md;
    setEmpty(md.length === 0);
    onChange(md);
  }, [onChange]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
      e.preventDefault();
      ref.current?.focus();
      document.execCommand("bold");
      emit();
    } else if (e.key === "Enter") {
      e.preventDefault();
      document.execCommand("insertLineBreak");
      emit();
    }
  };

  const onPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const text = e.clipboardData.getData("text/plain");
    document.execCommand("insertText", false, text);
    emit();
  };

  return (
    <div
      className={cn(
        "rounded-md border border-input bg-background ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
        disabled && "opacity-50",
        className,
      )}
    >
      <div className="flex items-center gap-1 border-b border-input px-2 py-1">
        <button
          type="button"
          title="Negrito (Ctrl+B)"
          aria-label="Negrito"
          disabled={disabled}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            ref.current?.focus();
            document.execCommand("bold");
            emit();
          }}
          className="inline-flex h-7 w-7 items-center justify-center rounded text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed"
        >
          <Bold className="h-4 w-4" />
        </button>
      </div>
      <div className="relative">
        {empty && placeholder && (
          <div className="pointer-events-none absolute left-3 top-2 text-sm text-muted-foreground">
            {placeholder}
          </div>
        )}
        <div
          id={id}
          ref={ref}
          role="textbox"
          aria-multiline="true"
          contentEditable={!disabled}
          suppressContentEditableWarning
          onInput={emit}
          onKeyDown={onKeyDown}
          onPaste={onPaste}
          className="w-full whitespace-pre-wrap px-3 py-2 text-sm outline-none [overflow-wrap:anywhere]"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}
