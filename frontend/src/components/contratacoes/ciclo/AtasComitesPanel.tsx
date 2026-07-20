import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FileText, Trash2, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import {
  orcamentoApi,
  type AtaComite,
  type ComiteOrcamento,
} from "@/services/orcamentoApi";

/**
 * RN-GERAL-04 — juntada das atas dos comitês (CGTIC/CGOVTIC). Os comitês deliberam no PROAD
 * (externo); o Kaizen reflete o ato registrando/anexando a ata (ação do Editor SGJT).
 */

const COMITE_LABEL: Record<ComiteOrcamento, string> = {
  cgtic: "CGTIC (gestão)",
  cgovtic: "CGOVTIC (governança)",
};

function fmtData(d: string | null): string {
  if (!d) return "—";
  const raw = d.substring(0, 10);
  const [y, m, dd] = raw.split("-");
  return y && m && dd ? `${dd}/${m}/${y}` : d;
}

export function AtasComitesPanel({ cicloId }: { cicloId: number }) {
  const [atas, setAtas] = useState<AtaComite[]>([]);
  const [comite, setComite] = useState<ComiteOrcamento>("cgtic");
  const [numero, setNumero] = useState("");
  const [dataAta, setDataAta] = useState("");
  const [decisao, setDecisao] = useState("");
  const [anexoUrl, setAnexoUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const carregar = useCallback(() => {
    orcamentoApi
      .listarAtas(cicloId)
      .then(setAtas)
      .catch(() => {
        /* backend indisponível */
      });
  }, [cicloId]);

  useEffect(carregar, [carregar]);

  const registrar = async () => {
    setBusy(true);
    try {
      await orcamentoApi.registrarAta({
        cicloId,
        comite,
        numero: numero.trim() || null,
        dataAta: dataAta || null,
        decisao: decisao.trim() || null,
        anexoUrl: anexoUrl.trim() || null,
      });
      setNumero("");
      setDataAta("");
      setDecisao("");
      setAnexoUrl("");
      toast.success("Ata juntada.");
      carregar();
    } catch {
      toast.error("Não foi possível juntar a ata (verifique permissão do escopo SGJT).");
    } finally {
      setBusy(false);
    }
  };

  const excluir = async (id: number) => {
    try {
      await orcamentoApi.excluirAta(id);
      toast.success("Ata removida.");
      carregar();
    } catch {
      toast.error("Não foi possível remover a ata.");
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-4 w-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-800">Atas dos comitês</h3>
        <span className="text-xs text-slate-400">CGTIC / CGOVTIC · juntada (RN-GERAL-04)</span>
      </div>

      {/* Formulário de juntada */}
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={comite}
          onChange={(e) => setComite(e.target.value as ComiteOrcamento)}
          className="h-9 rounded-md border border-slate-300 bg-white px-2 text-sm"
          aria-label="Comitê"
        >
          <option value="cgtic">CGTIC (gestão)</option>
          <option value="cgovtic">CGOVTIC (governança)</option>
        </select>
        <Input placeholder="Nº da ata" value={numero} onChange={(e) => setNumero(e.target.value)} />
        <Input type="date" value={dataAta} onChange={(e) => setDataAta(e.target.value)} aria-label="Data da ata" />
        <Input placeholder="URL do anexo (opcional)" value={anexoUrl} onChange={(e) => setAnexoUrl(e.target.value)} />
        <Input
          className="sm:col-span-2 lg:col-span-3"
          placeholder="Decisão / deliberação (opcional)"
          value={decisao}
          onChange={(e) => setDecisao(e.target.value)}
        />
        <Button onClick={registrar} disabled={busy} className="bg-blue-600 hover:bg-blue-700 text-white">
          {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
          Juntar ata
        </Button>
      </div>

      {/* Lista */}
      <div className="mt-4 space-y-2">
        {atas.length === 0 ? (
          <p className="text-xs italic text-slate-400">Nenhuma ata juntada neste ciclo.</p>
        ) : (
          atas.map((a) => (
            <div
              key={a.id}
              className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50 px-3 py-2 text-sm"
            >
              <span className="rounded bg-slate-200 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                {COMITE_LABEL[a.comite] ?? a.comite}
              </span>
              <span className="font-medium text-slate-800">{a.numero ?? "s/nº"}</span>
              <span className="text-xs text-slate-500">{fmtData(a.data_ata)}</span>
              {a.decisao && <span className="truncate text-xs text-slate-600">· {a.decisao}</span>}
              {a.anexo_url && (
                <a
                  href={a.anexo_url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline"
                >
                  anexo
                </a>
              )}
              <button
                type="button"
                onClick={() => excluir(a.id)}
                className="ml-auto text-slate-400 hover:text-red-600"
                aria-label="Remover ata"
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
