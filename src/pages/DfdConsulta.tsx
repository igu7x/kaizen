import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FileSearch,
  XCircle,
  RefreshCcw,
  CalendarClock,
  PlusCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { areasApi, type Unidade } from "@/services/areasApi";
import {
  dfdApi,
  type DfdConsulta as DfdConsultaData,
  type DfdItem,
  type DfdPcaItem,
} from "@/services/dfdApi";
import { cn } from "@/lib/utils";

const ANOS = [2025, 2026, 2027];
const TODAS = "todas";

function formatBRL(v: number | null): string {
  if (v == null) return "—";
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatData(iso: string | null): string {
  if (!iso) return "—";
  const d = iso.slice(0, 10).split("-");
  return d.length === 3 ? `${d[2]}/${d[1]}/${d[0]}` : iso;
}

/**
 * DFD-Consulta (Orçamento de TIC, Cap. 1) — instrumento de captura da Formação. Mostra os 4 blocos
 * canônicos derivados dos contratos continuada da unidade + itens do PCA-TIC corrente (RF-01..05).
 * Somente leitura nesta etapa; a atribuição de IFO (banda-envelope) e o envio à CCA virão a seguir.
 */
export default function DfdConsulta() {
  const [ano, setAno] = useState<number>(2026);
  const [unidadeId, setUnidadeId] = useState<number | undefined>(undefined);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [data, setData] = useState<DfdConsultaData | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    areasApi
      .getAllUnidades()
      .then((us) => setUnidades(us))
      .catch(() => setUnidades([]));
  }, []);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setData(await dfdApi.getConsulta(ano, unidadeId));
    } catch {
      setErro("Não foi possível carregar a DFD-Consulta.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [ano, unidadeId]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const totalGeral = useMemo(() => {
    if (!data) return 0;
    const soma = (arr: DfdItem[]) => arr.reduce((s, i) => s + (i.valorTotal || 0), 0);
    return (
      soma(data.encerramento) +
      soma(data.renovacao) +
      soma(data.plurianual) +
      data.novaContratacao.reduce((s, i) => s + (i.valorEstimado || 0), 0)
    );
  }, [data]);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
            <FileSearch className="h-6 w-6 text-blue-600" />
            DFD-Consulta
          </h1>
          <p className="text-sm text-gray-500">
            Captura da Formação — contratos continuada classificados por ciclo de vida + itens do PCA-TIC.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Select value={String(ano)} onValueChange={(v) => setAno(parseInt(v, 10))}>
            <SelectTrigger className="w-[120px] h-9 bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ANOS.map((a) => (
                <SelectItem key={a} value={String(a)}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={unidadeId === undefined ? TODAS : String(unidadeId)}
            onValueChange={(v) => setUnidadeId(v === TODAS ? undefined : parseInt(v, 10))}
          >
            <SelectTrigger className="w-[260px] h-9 bg-white">
              <SelectValue placeholder="Unidade" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={TODAS}>Todas as unidades</SelectItem>
              {unidades.map((u) => (
                <SelectItem key={u.id} value={String(u.id)}>
                  {u.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LoadingSpinner />
        </div>
      ) : erro ? (
        <p className="text-sm text-red-600 py-8 text-center">{erro}</p>
      ) : data ? (
        <>
          <Card className="bg-blue-50/50 border-blue-100">
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4 text-sm">
              <span className="text-gray-600">
                Exercício <strong>{data.ano}</strong> ·{" "}
                {data.encerramento.length + data.renovacao.length + data.plurianual.length} contratos continuada ·{" "}
                {data.novaContratacao.length} itens do PCA
              </span>
              <span className="font-semibold text-gray-800">
                Total estimado: {formatBRL(totalGeral)}
              </span>
            </CardContent>
          </Card>

          <BlocoContratos
            titulo="1 · Encerramento"
            descricao="Continuada que encerra no exercício sem prazo de prorrogação — exige nova contratação."
            icone={<XCircle className="h-5 w-5" />}
            cor="red"
            itens={data.encerramento}
          />
          <BlocoContratos
            titulo="2 · Renovação"
            descricao="Continuada que encerra no exercício com prazo de prorrogação — sujeita a interesse na renovação."
            icone={<RefreshCcw className="h-5 w-5" />}
            cor="amber"
            itens={data.renovacao}
          />
          <BlocoContratos
            titulo="3 · Plurianual"
            descricao="Continuada cuja vigência ultrapassa o exercício — segue vigente, sem ação nesta formação."
            icone={<CalendarClock className="h-5 w-5" />}
            cor="blue"
            itens={data.plurianual}
          />
          <BlocoNovaContratacao itens={data.novaContratacao} />
        </>
      ) : null}
    </div>
  );
}

const CORES: Record<string, { header: string; ring: string; badge: string }> = {
  red: { header: "text-red-700", ring: "border-red-200", badge: "bg-red-100 text-red-700 border-red-200" },
  amber: { header: "text-amber-700", ring: "border-amber-200", badge: "bg-amber-100 text-amber-700 border-amber-200" },
  blue: { header: "text-blue-700", ring: "border-blue-200", badge: "bg-blue-100 text-blue-700 border-blue-200" },
  green: { header: "text-green-700", ring: "border-green-200", badge: "bg-green-100 text-green-700 border-green-200" },
};

function BlocoContratos({
  titulo,
  descricao,
  icone,
  cor,
  itens,
}: {
  titulo: string;
  descricao: string;
  icone: React.ReactNode;
  cor: "red" | "amber" | "blue";
  itens: DfdItem[];
}) {
  const c = CORES[cor];
  const total = itens.reduce((s, i) => s + (i.valorTotal || 0), 0);
  return (
    <Card className={cn("border", c.ring)}>
      <CardHeader className="pb-3">
        <CardTitle className={cn("flex items-center gap-2 text-base", c.header)}>
          {icone} {titulo}
          <Badge variant="outline" className={cn("ml-1", c.badge)}>
            {itens.length}
          </Badge>
          <span className="ml-auto text-sm font-normal text-gray-500">{formatBRL(total)}</span>
        </CardTitle>
        <p className="text-xs text-gray-500">{descricao}</p>
      </CardHeader>
      <CardContent className="pt-0">
        {itens.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nenhum contrato neste bloco.</p>
        ) : (
          <div className="space-y-1.5">
            {itens.map((i) => (
              <div
                key={i.contractId}
                className="grid grid-cols-1 gap-1 rounded-md border border-gray-100 bg-gray-50 px-3 py-2 md:grid-cols-[1fr_auto]"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate">{i.objeto || "—"}</p>
                  <p className="text-xs text-gray-500 truncate">
                    {i.supplier || "Fornecedor não informado"}
                    {i.process ? ` · ${i.process}` : ""}
                    {i.unidade ? ` · ${i.unidade}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-xs text-gray-600 md:justify-end">
                  <span>Vigência até {formatData(i.endDate)}</span>
                  {i.limitDate && <span>Limite {formatData(i.limitDate)}</span>}
                  <span className="font-semibold text-gray-800">{formatBRL(i.valorTotal)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function BlocoNovaContratacao({ itens }: { itens: DfdPcaItem[] }) {
  const c = CORES.green;
  const total = itens.reduce((s, i) => s + (i.valorEstimado || 0), 0);
  return (
    <Card className={cn("border", c.ring)}>
      <CardHeader className="pb-3">
        <CardTitle className={cn("flex items-center gap-2 text-base", c.header)}>
          <PlusCircle className="h-5 w-5" /> 4 · Nova Contratação
          <Badge variant="outline" className={cn("ml-1", c.badge)}>
            {itens.length}
          </Badge>
          <span className="ml-auto text-sm font-normal text-gray-500">{formatBRL(total)}</span>
        </CardTitle>
        <p className="text-xs text-gray-500">
          Pré-preenchido com os itens do PCA-TIC corrente (itens pontuais não entram nesta formação).
        </p>
      </CardHeader>
      <CardContent className="pt-0">
        {itens.length === 0 ? (
          <p className="text-sm text-gray-400 py-2">Nenhum item do PCA para o exercício.</p>
        ) : (
          <div className="space-y-1.5">
            {itens.map((i) => (
              <div
                key={i.pcaId ?? i.itemPca}
                className="flex items-start gap-3 rounded-md border border-gray-100 bg-gray-50 px-3 py-2"
              >
                <Badge variant="outline" className={cn("shrink-0 font-mono text-xs", c.badge)}>
                  {i.itemPca || "—"}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-gray-800 truncate">{i.objeto || "—"}</p>
                  <p className="text-xs text-gray-500">{i.areaDemandante || "—"}</p>
                </div>
                <span className="text-xs font-semibold text-gray-800">{formatBRL(i.valorEstimado)}</span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
