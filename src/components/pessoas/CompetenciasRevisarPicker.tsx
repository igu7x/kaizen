import { useState, useEffect, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Loader2, RefreshCw, Search, Info } from "lucide-react";
import { toast } from "sonner";
import {
  competenciasGestorApi,
  FormularioCompetencias,
  UnidadeParaRevisao,
} from "@/services/competenciasGestorApi";

/** Data legível a partir do timestamp do backend; string vazia quando não há data. */
function formatarData(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}

interface CompetenciasRevisarPickerProps {
  tipo: "equipe" | "gestor";
  /** Recebe o formulário JÁ carregado por inteiro, pronto para abrir em modo de edição. */
  onSelecionar: (formulario: FormularioCompetencias) => void;
}

/**
 * Seleção da unidade cuja matriz será revisada.
 *
 * Só entram unidades que já têm matriz validada até o fim e que o usuário alcança — o backend
 * aplica o mesmo recorte de permissão do preenchimento (/unidades-para-revisao). Escolher uma
 * carrega o formulário completo e devolve pelo onSelecionar; quem abre a tela de edição é o
 * chamador, reaproveitando a mesma view de sempre.
 *
 * Abrir aqui NÃO reabre o ciclo de validação: isso só acontece no primeiro save da revisão. Quem
 * entrar por engano e sair não destrava a matriz aprovada.
 */
export function CompetenciasRevisarPicker({
  tipo,
  onSelecionar,
}: CompetenciasRevisarPickerProps) {
  const [unidades, setUnidades] = useState<UnidadeParaRevisao[]>([]);
  const [loading, setLoading] = useState(true);
  const [abrindoId, setAbrindoId] = useState<number | null>(null);
  const [busca, setBusca] = useState("");

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    competenciasGestorApi
      .getUnidadesParaRevisao(tipo)
      .then((rows) => {
        if (ativo) setUnidades(rows);
      })
      .catch(() => {
        if (ativo) {
          setUnidades([]);
          toast.error("Não foi possível carregar as unidades para revisão.");
        }
      })
      .finally(() => {
        if (ativo) setLoading(false);
      });
    return () => {
      ativo = false;
    };
  }, [tipo]);

  const filtradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return unidades;
    return unidades.filter(
      (u) =>
        u.nome.toLowerCase().includes(termo) ||
        (u.area_sigla || "").toLowerCase().includes(termo),
    );
  }, [unidades, busca]);

  const abrir = async (u: UnidadeParaRevisao) => {
    if (abrindoId !== null) return;
    setAbrindoId(u.formulario_id);
    try {
      const completo = await competenciasGestorApi.getById(u.formulario_id);
      onSelecionar(completo);
    } catch {
      toast.error("Não foi possível abrir a matriz desta unidade.");
    } finally {
      setAbrindoId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-gray-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        Carregando unidades…
      </div>
    );
  }

  if (unidades.length === 0) {
    return (
      <Card className="border-gray-200">
        <CardContent className="py-10 text-center space-y-2">
          <Info className="h-6 w-6 mx-auto text-gray-400" />
          <p className="text-gray-600 font-medium">
            Nenhuma unidade disponível para revisão.
          </p>
          <p className="text-sm text-gray-500">
            Só aparecem aqui as unidades que você alcança e cuja matriz já
            passou por todas as camadas de validação.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-lg border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800">
        <Info className="h-4 w-4 mt-0.5 shrink-0" />
        <p>
          A matriz escolhida abre em modo de edição. A versão vigente continua
          valendo enquanto você revisa — ela só é substituída, e a versão só
          avança, quando a revisão passar de novo por todas as camadas de
          validação.
        </p>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por unidade ou área…"
          className="pl-9"
        />
      </div>

      <Card className="border-gray-200">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unidade</TableHead>
                <TableHead>Área</TableHead>
                <TableHead className="text-center">Competências</TableHead>
                <TableHead className="text-center">Versão vigente</TableHead>
                <TableHead>Validada em</TableHead>
                <TableHead className="text-center">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtradas.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={6}
                    className="text-center text-gray-400 py-8"
                  >
                    Nenhuma unidade para “{busca}”.
                  </TableCell>
                </TableRow>
              ) : (
                filtradas.map((u) => (
                  <TableRow key={u.formulario_id}>
                    <TableCell className="font-medium text-gray-900">
                      {u.nome}
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {u.area_sigla || "—"}
                    </TableCell>
                    <TableCell className="text-center text-gray-600">
                      {u.total_competencias}
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700">
                        v{u.versao_formulario}
                      </span>
                    </TableCell>
                    <TableCell className="text-gray-600">
                      {formatarData(u.validado_final_em)}
                    </TableCell>
                    <TableCell className="text-center">
                      {u.em_revisao ? (
                        // Já existe revisão salva: ela está correndo as camadas de validação, e
                        // reabrir aqui continuaria a MESMA revisão, não iniciaria outra.
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrir(u)}
                          disabled={abrindoId !== null}
                          className="border-amber-200 text-amber-700 hover:bg-amber-50"
                        >
                          {abrindoId === u.formulario_id ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1.5" />
                          )}
                          Revisão em andamento
                        </Button>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => abrir(u)}
                          disabled={abrindoId !== null}
                          className="border-blue-200 text-blue-700 hover:bg-blue-50"
                        >
                          {abrindoId === u.formulario_id ? (
                            <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          ) : (
                            <RefreshCw className="h-4 w-4 mr-1.5" />
                          )}
                          Revisar
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
