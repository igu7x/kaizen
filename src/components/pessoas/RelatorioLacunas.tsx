import { useEffect, useMemo, useState } from "react";
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
  FileText,
  Loader2,
  RefreshCw,
  ScanSearch,
} from "lucide-react";
import { NOTA_TECNICA_LABELS } from "@/constants/competencias";
import {
  lacunasCompetenciasApi,
  RelatorioLacunas as Relatorio,
  UnidadeLacunas,
} from "@/services/lacunasCompetenciasApi";
import { generateLacunasCompetenciasPDF } from "@/utils/generateLacunasCompetenciasPDF";
import { toast } from "sonner";

const pesoLabel = (peso: number | null) =>
  peso === 3 ? "Crítica" : peso === 2 ? "Importante" : peso === 1 ? "Útil" : "—";

const pesoCor = (peso: number | null) =>
  peso === 3
    ? "bg-red-100 text-red-700"
    : peso === 2
      ? "bg-amber-100 text-amber-700"
      : "bg-blue-100 text-blue-700";

/**
 * Relatório de Lacunas de Competências.
 *
 * Compara, por competência técnica, quanta gente a Matriz da equipe diz que precisa dominá-la
 * (aplicabilidade) com quanta gente de fato atinge o nível mínimo no Resultado Final. O cálculo
 * roda no backend a cada consulta — nada fica congelado, então o número reflete sempre o estado
 * atual do inventário.
 */
export function RelatorioLacunas() {
  const [unidades, setUnidades] = useState<UnidadeLacunas[]>([]);
  const [unidadeId, setUnidadeId] = useState<string>("");
  const [nivelMinimo, setNivelMinimo] = useState<string>("3");
  const [relatorio, setRelatorio] = useState<Relatorio | null>(null);
  const [carregandoUnidades, setCarregandoUnidades] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    lacunasCompetenciasApi
      .getUnidades()
      .then((data) => {
        setUnidades(data);
        // Uma unidade só: já seleciona, é o caso do gestor de unidade.
        if (data.length === 1) setUnidadeId(String(data[0].id));
      })
      .catch(() => setUnidades([]))
      .finally(() => setCarregandoUnidades(false));
  }, []);

  const gerar = async () => {
    if (!unidadeId) return;
    setGerando(true);
    setErro(null);
    try {
      const data = await lacunasCompetenciasApi.gerar(
        Number(unidadeId),
        Number(nivelMinimo),
      );
      setRelatorio(data);
    } catch (err: any) {
      setRelatorio(null);
      setErro(
        err?.message ||
          "Não foi possível gerar o relatório. Verifique se a unidade tem Matriz de Competências da equipe.",
      );
    } finally {
      setGerando(false);
    }
  };

  const semCobertura = useMemo(
    () =>
      relatorio != null &&
      relatorio.colaboradores_avaliados < relatorio.qtd_colaboradores,
    [relatorio],
  );

  const exportarPdf = () => {
    if (!relatorio) return;
    try {
      generateLacunasCompetenciasPDF(relatorio);
    } catch {
      toast.error("Falha ao gerar o PDF.");
    }
  };

  return (
    <div className="space-y-6">
      {/* Parâmetros */}
      <Card className="border border-gray-200 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg">
            <ScanSearch className="h-5 w-5 text-indigo-600" />
            Lacunas de Competências
          </CardTitle>
          <p className="text-sm text-gray-500">
            Compara a aplicabilidade declarada na Matriz da equipe com o
            Resultado Final e aponta o débito de competências da unidade. O
            cálculo é feito no momento em que você gera.
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[260px] flex-1 space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Unidade
              </label>
              <Select value={unidadeId} onValueChange={setUnidadeId}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      carregandoUnidades
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
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-[230px] space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Nível mínimo
              </label>
              <Select value={nivelMinimo} onValueChange={setNivelMinimo}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} — {NOTA_TECNICA_LABELS[n]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              onClick={gerar}
              disabled={!unidadeId || gerando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
            >
              {gerando ? (
                <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-1.5" />
              )}
              Gerar relatório
            </Button>

            {relatorio && (
              <Button variant="outline" onClick={exportarPdf}>
                <FileText className="h-4 w-4 mr-1.5" /> Gerar PDF
              </Button>
            )}
          </div>

          <p className="mt-3 text-xs text-gray-500">
            Conta como "possui a competência" quem atinge{" "}
            <strong>
              {nivelMinimo} — {NOTA_TECNICA_LABELS[Number(nivelMinimo)]}
            </strong>{" "}
            ou mais no Resultado Final.
          </p>
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
          {/* Resumo */}
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
            <Resumo
              rotulo="Colaboradores"
              valor={String(relatorio.qtd_colaboradores)}
              detalhe={`${relatorio.colaboradores_avaliados} com Resultado Final`}
            />
            <Resumo
              rotulo="Competências"
              valor={String(relatorio.total_competencias)}
              detalhe={`${relatorio.competencias_com_debito} com débito`}
            />
            {/* A unidade é colaborador × competência: cada pessoa que falta conta uma vez em
                CADA competência. Dizer "vagas" fazia parecer nº de pessoas. */}
            <Resumo
              rotulo="Débito total"
              valor={String(relatorio.soma_debito)}
              detalhe="lacunas (colaborador × competência)"
              destaque={relatorio.soma_debito > 0}
            />
            {/* O recorte que separa falta de COMPETÊNCIA de falta de AVALIAÇÃO: olha só quem
                já tem Resultado Final. Enquanto a equipe não estiver toda avaliada, é este o
                número que fala sobre domínio técnico. */}
            <Resumo
              rotulo="Débito entre avaliados"
              valor={String(relatorio.soma_debito_avaliados)}
              detalhe={`de ${relatorio.soma_necessario_avaliados} possíveis · ${relatorio.competencias_com_debito_avaliados} competência(s)`}
              destaque={relatorio.soma_debito_avaliados > 0}
            />
            <Resumo
              rotulo="Cobertura geral"
              valor={`${relatorio.cobertura_geral_percentual}%`}
              detalhe={`${relatorio.soma_possuem} de ${relatorio.soma_necessario}`}
            />
          </div>

          {/* A matriz de referência pode ainda não estar homologada — nesse caso o "necessário"
              vem de um rascunho e ainda pode mudar. Quem lê o relatório precisa saber. */}
          {relatorio.matriz_status !== "validado_final" && (
            <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-blue-600" />
              <p className="text-sm text-blue-900">
                A Matriz de Competências desta unidade ainda não recebeu
                validação final. Os números da coluna "Necessário" vêm de uma
                versão em elaboração e podem mudar.
              </p>
            </div>
          )}

          {/* A ressalva que impede a leitura errada do número: quem não foi avaliado
              nunca entra em "Possuem". */}
          {semCobertura && (
            <div className="flex items-start gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4">
              <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
              <p className="text-sm text-amber-900">
                <strong>
                  {relatorio.qtd_colaboradores -
                    relatorio.colaboradores_avaliados}{" "}
                  colaborador(es)
                </strong>{" "}
                ainda não têm Resultado Final calculado e não entram na coluna
                "Possuem" — o débito abaixo é o pior cenário. Para enxergar só a
                falta de competência de quem já foi medido, use{" "}
                <strong>Débito entre avaliados</strong>.
              </p>
            </div>
          )}

          {/* Tabela */}
          <Card className="border border-gray-200 shadow-sm">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                      <th className="px-4 py-3 text-left">Competência</th>
                      <th className="px-4 py-3 text-center">Peso</th>
                      <th className="px-4 py-3 text-center">Necessário</th>
                      <th className="px-4 py-3 text-center">Possuem</th>
                      <th className="px-4 py-3 text-center">Débito</th>
                      <th className="px-4 py-3 text-center">Cobertura</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {relatorio.competencias.map((l) => (
                      <tr key={l.competencia_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900">
                            {l.competencia_nome}
                          </p>
                          {l.aplicabilidade === "parte" && (
                            <p className="text-xs text-gray-500">
                              Aplicável a parte da equipe
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge className={pesoCor(l.peso)}>
                            {pesoLabel(l.peso)}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {l.necessario}
                        </td>
                        <td className="px-4 py-3 text-center text-gray-700">
                          {l.possuem}
                        </td>
                        <td
                          className={`px-4 py-3 text-center font-bold ${
                            l.debito > 0 ? "text-red-600" : "text-emerald-600"
                          }`}
                        >
                          {l.debito}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-center gap-2">
                            <div className="h-2 w-20 overflow-hidden rounded-full bg-gray-200">
                              <div
                                className={`h-full rounded-full ${
                                  l.cobertura_percentual >= 100
                                    ? "bg-emerald-500"
                                    : l.cobertura_percentual >= 50
                                      ? "bg-amber-500"
                                      : "bg-red-500"
                                }`}
                                style={{
                                  width: `${Math.min(100, l.cobertura_percentual)}%`,
                                }}
                              />
                            </div>
                            <span className="w-10 text-xs text-gray-600">
                              {l.cobertura_percentual}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {relatorio.competencias.length === 0 && (
                <p className="px-4 py-10 text-center text-sm text-gray-500">
                  A Matriz desta unidade não tem competência técnica com
                  aplicabilidade declarada — sem isso não há o que comparar.
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
