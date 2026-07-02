import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { UserCog, Trash2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  orcamentoApi,
  type EditorOrcamento,
  type EscopoOrcamento,
} from "@/services/orcamentoApi";

/**
 * Cap. 8 / RN-GERAL-09 — atribuição de Editores por escopo. O Editor edita e salva conteúdo, mas
 * nunca transita fase (RN-GERAL-01). A atribuição é ato da Autoridade do próprio escopo (gateado no
 * backend). Painel administrativo simples: informa o id do usuário e o escopo.
 */

const ESCOPO_LABEL: Record<EscopoOrcamento, string> = {
  cca: "CCA",
  demandante: "Demandante",
  gejut: "GEJUT",
  sgjt: "SGJT",
};

export function EditoresPanel({ cicloId }: { cicloId?: number }) {
  const [editores, setEditores] = useState<EditorOrcamento[]>([]);
  const [userId, setUserId] = useState("");
  const [escopo, setEscopo] = useState<EscopoOrcamento>("cca");
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(() => {
    orcamentoApi
      .listarEditores(undefined, cicloId)
      .then(setEditores)
      .catch(() => {
        /* backend indisponível */
      });
  }, [cicloId]);

  useEffect(carregar, [carregar]);

  const atribuir = async () => {
    const uid = Number(userId.trim());
    if (!uid || Number.isNaN(uid)) {
      toast.error("Informe um id de usuário válido.");
      return;
    }
    setBusy(true);
    try {
      await orcamentoApi.atribuirEditor(uid, escopo, cicloId ?? null);
      setUserId("");
      toast.success("Editor atribuído.");
      carregar();
    } catch {
      toast.error("Não foi possível atribuir (só a Autoridade do escopo pode).");
    } finally {
      setBusy(false);
    }
  };

  const revogar = async (e: EditorOrcamento) => {
    try {
      await orcamentoApi.revogarEditor(e.user_id, e.escopo, e.ciclo_id ?? undefined);
      toast.success("Atribuição revogada.");
      carregar();
    } catch {
      toast.error("Não foi possível revogar.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <UserCog className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">Editores por escopo</h3>
        <span className="text-xs text-slate-400">Editor edita/salva; nunca transita (RN-GERAL-01)</span>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        <Input
          placeholder="ID do usuário"
          value={userId}
          onChange={(e) => setUserId(e.target.value)}
          inputMode="numeric"
        />
        <select
          value={escopo}
          onChange={(e) => setEscopo(e.target.value as EscopoOrcamento)}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          aria-label="Escopo"
        >
          <option value="cca">CCA</option>
          <option value="demandante">Demandante</option>
          <option value="gejut">GEJUT</option>
          <option value="sgjt">SGJT</option>
        </select>
        <Button onClick={atribuir} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Atribuir Editor
        </Button>
      </div>

      <div className="mt-4 space-y-2">
        {editores.length === 0 ? (
          <p className="text-xs italic text-slate-400">Nenhum Editor atribuído.</p>
        ) : (
          editores.map((e) => (
            <div
              key={e.id}
              className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="rounded bg-indigo-100 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">
                {ESCOPO_LABEL[e.escopo] ?? e.escopo}
              </span>
              <span className="font-medium text-slate-800">{e.user_name ?? `Usuário #${e.user_id}`}</span>
              {e.user_email && <span className="text-xs text-slate-500">{e.user_email}</span>}
              {e.ciclo_id == null && (
                <span className="text-[10px] uppercase text-slate-400">global</span>
              )}
              <button
                type="button"
                onClick={() => revogar(e)}
                className="ml-auto text-slate-400 hover:text-red-600"
                aria-label="Revogar Editor"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
