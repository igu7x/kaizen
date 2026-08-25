import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  ScanSearch,
  UserCog,
  FileText,
} from "lucide-react";
import { NOTA_TECNICA_LABELS } from "@/constants/competencias";
import {
  lacunasGestorApi,
  RelatorioLacunasGestor as Relatorio,
  UnidadeGestorLacunas,
} from "@/services/lacunasCompetenciasApi";
import { generateLacunasGestorPDF } from "@/utils/generateLacunasGestorPDF";
import { toast } from "sonner";

/** Plural de "nível" é "níveis" — não "nívelis". */
export const niveis = (n: number) => (n === 1 ? "1 nível" : `${n} níveis`);
const faltamNiveis = (n: number | null) =>
  n === 1 ? "Falta 1 nível" : `Faltam ${n} níveis`;

/**
 * Lacunas de Competências do Gestor.
 *
 * Diferente do relatório da equipe, aqui o avaliado é UMA pessoa — o gestor da unidade. Por isso
 * não se conta gente: a pergunta, competência a competência, é se ele alcança o grau mínimo
 * esperado, e o débito é a distância em níveis até esse grau.
 *
 * Restrito à direção da área; o backend revalida a unidade a cada geração.
 */
export function RelatorioLacunasGestor() {
  const [unidades, setUnidades] = useState<UnidadeGestorLacunas[]>([]);
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    lacunasGestorApi
      .getUnidades()
      .then((data) => {
        setUnidades(data);
        if (data.length === 1) setUnidadeId(String(data[0].id));
      })
      .catch(() => setUnidades([]))
      .finally(() => setCarregando(false));
  }, []);

  const gerar = async () => {
    if (!unidadeId) return;
    setGerando(true);
    setErro(null);
    try {
      setRelatorio(await lacunasGestorApi.gerar(Number(unidadeId)));
    } catch (err: any) {
      setRelatorio(null);
      setErro(
        err?.message ||
          "Não foi possível gerar o relatório. Verifique se a unidade tem Matriz de Competências do Gestor.",
      );
    } finally {
      setGerando(false);
    }
  };

  const exportarPdf = () => {
    if (!relatorio) return;
    try {
      generateLacunasGestorPDF(relatorio);
    } catch {
      toast.error("Falha ao gerar o PDF.");
    }
  };

  return (
    <div className="space-y-6">
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanSearch className="h-5 w-5 text-violet-600" />
            Lacunas de Competências do Gestor
          </CardTitle>
          <p className="text-sm text-gray-500">
            Compara o grau mínimo esperado de cada competência da Matriz do
            Gestor com o Resultado Final dele, mostrando o que alcançou e o que
            está em débito.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[280px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Unidade
              </label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      carregando
                        ? "Carregando..."
                        : unidades.length === 0
                          ? "Nenhuma unidade disponível"
                          : "Selecione a unidade"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((u) => (
                    <SelectItem key={u.id} value={String(u.id)}>
                      {u.area_sigla ? `${u.area_sigla} — ` : ""}
                      {u.nome}
                      {u.gestor_nome ? ` · ${u.gestor_nome}` : " · sem gestor"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={gerar}
              disabled={!unidadeId || gerando}
              className="bg-violet-600 hover:bg-violet-700 text-white"
            >
              {gerando ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-1.5 h-4 w-4" />
              )}
              Gerar relatório
            </Button>

            {relatorio && (
              <Button variant="outline" onClick={exportarPdf}>
                <FileText className="mr-1.5 h-4 w-4" /> Gerar PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {erro && (
        <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600" />
          <p className="text-sm text-red-800">{erro}</p>
        </div>
      )}

      {relatorio && (
        <>
          <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-violet-100">
              <UserCog className="h-5 w-5 text-violet-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">
                {relatorio.gestor_nome || "Gestor não definido"}
              </p>
              <p className="text-xs text-gray-500">
                {relatorio.area_sigla ? `${relatorio.area_sigla} · ` : ""}
                {relatorio.unidade_nome}
              </p>
            </div>
          </div>

          {/* Sem Resultado Final não há o que comparar — e sem dizer isso o relatório pareceria
              indicar que o gestor não domina nada. */}
          {!relatorio.tem_resultado_final && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">
                Este gestor ainda não tem <strong>Resultado Final</strong>{" "}
                calculado no inventário do gestor. Sem ele não há nota para
                comparar — as competências aparecem como não avaliadas.
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Resumo
              rotulo="Competências"
              valor={String(relatorio.total_competencias)}
              detalhe={`${relatorio.competencias_avaliadas} avaliadas`}
            />
            <Resumo
              rotulo="Alcançadas"
              valor={String(relatorio.atingidas)}
              detalhe="atingiram o grau mínimo"
            />
            <Resumo
              rotulo="Em débito"
              valor={String(relatorio.em_debito)}
              detalhe={`${niveis(relatorio.soma_debito_niveis)} a evoluir`}
              destaque={relatorio.em_debito > 0}
            />
            <Resumo
              rotulo="Alcance"
              valor={`${relatorio.percentual_alcance}%`}
              detalhe={`${relatorio.atingidas} de ${relatorio.competencias_avaliadas} avaliadas`}
            />
          </div>

          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 text-left">Competência</th>
                      <th className="px-4 py-3 text-center">Grau mínimo</th>
                      <th className="px-4 py-3 text-center">Nota do gestor</th>
                      <th className="px-4 py-3 text-center">Situação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {relatorio.competencias.map((l) => (
                      <tr
                        key={`${l.origem}-${l.competencia_id}`}
                        className="hover:bg-gray-50"
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {l.competencia_nome}
                          </p>
                          {l.origem === "padrao" && (
                            <p className="text-xs text-gray-500">
                              Competência padrão
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {l.grau_minimo_esperado} —{" "}
                          {NOTA_TECNICA_LABELS[l.grau_minimo_esperado]}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {l.nota == null ? (
                            <span className="text-gray-400">—</span>
                          ) : (
                            <span className="font-medium text-gray-800">
                              {l.nota} — {NOTA_TECNICA_LABELS[l.nota]}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {l.nota == null ? (
                            <Badge className="bg-gray-100 text-gray-500">
                              Não avaliada
                            </Badge>
                          ) : l.atingiu ? (
                            <Badge className="bg-emerald-100 text-emerald-700">
                              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                              Alcançada
                            </Badge>
                          ) : (
                            <Badge className="bg-red-100 text-red-700">
                              {faltamNiveis(l.debito_niveis)}
                            </Badge>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {relatorio.competencias.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-gray-500">
                  A Matriz do Gestor desta unidade não tem competências
                  cadastradas.
                </p>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

function Resumo({
  rotulo,
  valor,
  detalhe,
  destaque,
}: {
  rotulo: string;
  valor: string;
  detalhe: string;
  destaque?: boolean;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
        {rotulo}
      </p>
      <p
        className={`mt-1 text-2xl font-bold ${destaque ? "text-red-600" : "text-gray-900"}`}
      >
        {valor}
      </p>
      <p className="text-xs text-gray-500">{detalhe}</p>
    </div>
  );
}
