import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Edit2, ExternalLink, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cicloOrcamentarioApi, type Ciclo } from "@/services/cicloOrcamentarioApi";

interface CampoLinkProadProps {
  cicloId: number;
  campo: string;
  valorOriginal: string | null;
  estadoAtual: string;
  estadoEditavel: string;
  label: string;
  onSaved: (ciclo: Ciclo) => void;
}

export function CampoLinkProad({
  cicloId,
  campo,
  valorOriginal,
  estadoAtual,
  estadoEditavel,
  label,
  onSaved,
}: CampoLinkProadProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [valor, setValor] = useState(valorOriginal || "");
  const [loading, setLoading] = useState(false);

  const editavel = estadoAtual === estadoEditavel;

  // Se não é editável e não tem valor, não exibe nada
  if (!editavel && !valorOriginal) {
    return null;
  }

  const handleSave = async () => {
    try {
      setLoading(true);
      if (!valor.trim()) {
        if (valorOriginal) {
          const updated = await cicloOrcamentarioApi.excluirLink(cicloId, campo);
          onSaved(updated);
          toast.success("Link removido com sucesso.");
        }
      } else {
        const updated = await cicloOrcamentarioApi.salvarLink(cicloId, campo, valor.trim());
        onSaved(updated);
        toast.success("Link atualizado com sucesso.");
      }
      setIsEditing(false);
    } catch (err: any) {
      toast.error(err.response?.data?.detail || "Erro ao salvar o link.");
    } finally {
      setLoading(false);
    }
  };

  const cancelEdit = () => {
    setValor(valorOriginal || "");
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col gap-1.5 mt-4 pt-4 border-t border-slate-100">
      <span className="text-xs font-semibold text-slate-600 uppercase tracking-wider">
        {label}
      </span>
      {isEditing ? (
        <div className="flex items-center gap-2 max-w-sm">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            className="h-8 text-sm"
            placeholder={campo === "link_dou" ? "https://..." : "Ex: 202700001234"}
            autoFocus
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
            onClick={handleSave}
            disabled={loading}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-slate-400 hover:text-slate-600"
            onClick={cancelEdit}
            disabled={loading}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          {valorOriginal ? (
            campo === "link_dou" ? (
              <a
                href={valorOriginal}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                Acessar DOU
              </a>
            ) : (
              <a
                href={`#proad-${valorOriginal}`}
                className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 transition-colors"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                PROAD {valorOriginal}
              </a>
            )
          ) : (
            <span className="text-sm text-slate-400 italic">Não informado</span>
          )}

          {editavel && (
            <Button
              size="sm"
              variant="ghost"
              className="h-6 px-2 text-slate-400 hover:text-slate-600"
              onClick={() => setIsEditing(true)}
            >
              <Edit2 className="h-3 w-3 mr-1" />
              Editar
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
