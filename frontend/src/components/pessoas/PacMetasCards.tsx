import { useState } from "react";
import { Target, BarChart3, Check, Pencil, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  META_1_PERCENTUAL,
  META_2_PERCENTUAL,
} from "@/services/pacCapacitacaoApi";

/**
 * Cabeçalho de indicadores da Matriz de Capacitação: as duas metas do PAC e a distribuição das
 * ações.
 *
 * As Metas 1 e 3 (status) são calculadas a partir dos itens que a própria tela já carregou —
 * de propósito. Recalcular no backend abriria espaço para o card divergir da tabela logo abaixo,
 * já que "concluída" depende de certificados x vagas, regra que vive no frontend
 * (progressoCapacitacao). Só a Meta 2 depende do backend: o total de servidores é um parâmetro
 * informado pelo gestor e os capacitados são pessoas distintas com ao menos um certificado.
 */
export function PacMetasCards({
  totalAcoes,
  acoesConcluidas,
  totalServidores,
  servidoresCapacitados,
  onSalvarTotalServidores,
}: {
  totalAcoes: number;
  acoesConcluidas: number;
  totalServidores: number;
  servidoresCapacitados: number;
  onSalvarTotalServidores?: (valor: number) => Promise<void> | void;
}) {
  const pctMeta1 =
    totalAcoes > 0 ? Math.round((acoesConcluidas / totalAcoes) * 100) : 0;
  const pctMeta2 =
    totalServidores > 0
      ? Math.round((servidoresCapacitados / totalServidores) * 100)
      : 0;
  const pendentes = Math.max(0, totalAcoes - acoesConcluidas);
  const pctConcluidas =
    totalAcoes > 0 ? Math.round((acoesConcluidas / totalAcoes) * 100) : 0;
  const pctPendentes = totalAcoes > 0 ? 100 - pctConcluidas : 0;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <CardMeta
        titulo="Meta 1"
        descricao="Realizar no mínimo 75% das ações de capacitação previstas na matriz anual."
        percentual={pctMeta1}
        alvo={META_1_PERCENTUAL}
        linhas={[
          { rotulo: "Total de Ações", valor: String(totalAcoes) },
          { rotulo: "Ações concluídas", valor: String(acoesConcluidas) },
        ]}
      />

      <CardMeta
        titulo="Meta 2"
        descricao="Garantir que pelo menos 40% dos servidores da área de TI participem de ao menos uma ação de capacitação no ano."
        percentual={pctMeta2}
        alvo={META_2_PERCENTUAL}
        linhas={[
          {
            rotulo: "Total de Servidores",
            valor: String(totalServidores),
            editavel: true,
          },
          {
            rotulo: "Servidores capacitados",
            valor: String(servidoresCapacitados),
          },
        ]}
        onSalvarEditavel={onSalvarTotalServidores}
      />

      <CardStatus
        total={totalAcoes}
        concluidas={acoesConcluidas}
        pendentes={pendentes}
        pctConcluidas={pctConcluidas}
        pctPendentes={pctPendentes}
      />
    </div>
  );
}

type LinhaRodape = { rotulo: string; valor: string; editavel?: boolean };

function CardMeta({
  titulo,
  descricao,
  percentual,
  alvo,
  linhas,
  onSalvarEditavel,
}: {
  titulo: string;
  descricao: string;
  percentual: number;
  alvo: number;
  linhas: LinhaRodape[];
  onSalvarEditavel?: (valor: number) => Promise<void> | void;
}) {
  const atingiu = percentual >= alvo;
  return (
    <div className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-blue-50">
            <Target className="h-5 w-5 text-blue-600" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wide text-gray-900">
              {titulo}
            </p>
            <p className="mt-0.5 text-sm leading-snug text-gray-500">
              {descricao}
            </p>
          </div>
        </div>

        <p
          className={`mt-5 text-center text-4xl font-bold ${
            atingiu ? "text-emerald-600" : "text-blue-700"
          }`}
        >
          {percentual}%
        </p>

        {/* Barra com o marcador do alvo: sem ele o percentual não diz se a meta foi batida. */}
        <div className="relative mt-3 h-3 w-full rounded-full bg-gray-200">
          <div
            className={`h-3 rounded-full transition-all ${
              atingiu ? "bg-emerald-500" : "bg-blue-600"
            }`}
            style={{ width: `${Math.min(100, Math.max(0, percentual))}%` }}
          />
          <div
            className="absolute -top-0.5 h-4 w-0.5 bg-gray-900"
            style={{ left: `${Math.min(100, Math.max(0, alvo))}%` }}
            aria-hidden
          />
        </div>
        <p
          className="mt-1 text-xs font-medium text-gray-500"
          style={{
            marginLeft: `${Math.min(92, Math.max(0, alvo - 4))}%`,
          }}
        >
          {alvo}%
        </p>
      </div>

      <div className="border-t border-gray-200">
        {linhas.map((l, i) => (
          <LinhaRodapeCard
            key={l.rotulo}
            linha={l}
            ultima={i === linhas.length - 1}
            onSalvar={l.editavel ? onSalvarEditavel : undefined}
          />
        ))}
      </div>
    </div>
  );
}

function LinhaRodapeCard({
  linha,
  ultima,
  onSalvar,
}: {
  linha: LinhaRodape;
  ultima: boolean;
  onSalvar?: (valor: number) => Promise<void> | void;
}) {
  const [editando, setEditando] = useState(false);
  const [rascunho, setRascunho] = useState(linha.valor);
  const [salvando, setSalvando] = useState(false);

  const confirmar = async () => {
    const n = parseInt(rascunho, 10);
    if (!Number.isFinite(n) || n < 0) return;
    setSalvando(true);
    try {
      await onSalvar?.(n);
      setEditando(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div
      className={`flex items-center justify-between px-5 py-3 ${
        ultima ? "" : "border-b border-gray-100"
      }`}
    >
      <span className="text-sm text-gray-600">{linha.rotulo}</span>
      {editando ? (
        <div className="flex items-center gap-1.5">
          <Input
            type="number"
            min={0}
            value={rascunho}
            autoFocus
            onChange={(e) => setRascunho(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") confirmar();
              if (e.key === "Escape") setEditando(false);
            }}
            className="h-8 w-24 text-right"
          />
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-emerald-600"
            disabled={salvando}
            onClick={confirmar}
            aria-label="Salvar"
          >
            <Check className="h-4 w-4" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-gray-400"
            onClick={() => {
              setRascunho(linha.valor);
              setEditando(false);
            }}
            aria-label="Cancelar"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-1.5">
          <span className="text-base font-bold text-gray-900">
            {linha.valor}
          </span>
          {onSalvar && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-gray-400 hover:text-gray-700"
              onClick={() => {
                setRascunho(linha.valor);
                setEditando(true);
              }}
              aria-label={`Editar ${linha.rotulo}`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function CardStatus({
  total,
  concluidas,
  pendentes,
  pctConcluidas,
  pctPendentes,
}: {
  total: number;
  concluidas: number;
  pendentes: number;
  pctConcluidas: number;
  pctPendentes: number;
}) {
  // Altura relativa ao maior valor, para as duas barras serem comparáveis entre si.
  const maior = Math.max(concluidas, pendentes, 1);
  const alturaConcluidas = Math.round((concluidas / maior) * 100);
  const alturaPendentes = Math.round((pendentes / maior) * 100);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-indigo-50">
          <BarChart3 className="h-5 w-5 text-indigo-600" />
        </div>
        <div>
          <p className="text-sm font-bold uppercase tracking-wide text-gray-900">
            Status das Ações
          </p>
          <p className="mt-0.5 text-sm text-gray-500">Total de ações</p>
          <p className="text-3xl font-bold text-gray-900">{total}</p>
        </div>
      </div>

      <div className="mt-4 flex items-end justify-center gap-12">
        <ColunaStatus
          valor={concluidas}
          percentual={pctConcluidas}
          altura={alturaConcluidas}
          rotulo="Concluídas"
          corBarra="bg-emerald-500"
          corTexto="text-emerald-600"
        />
        <ColunaStatus
          valor={pendentes}
          percentual={pctPendentes}
          altura={alturaPendentes}
          rotulo="Pendentes"
          corBarra="bg-red-400"
          corTexto="text-red-500"
        />
      </div>
    </div>
  );
}

function ColunaStatus({
  valor,
  percentual,
  altura,
  rotulo,
  corBarra,
  corTexto,
}: {
  valor: number;
  percentual: number;
  altura: number;
  rotulo: string;
  corBarra: string;
  corTexto: string;
}) {
  return (
    <div className="flex flex-col items-center">
      <span className={`text-sm font-bold ${corTexto}`}>
        {valor} ({percentual}%)
      </span>
      <div className="mt-1 flex h-24 items-end">
        <div
          className={`w-12 rounded-t-md ${corBarra}`}
          style={{ height: `${Math.max(4, altura)}%` }}
        />
      </div>
      <span className="mt-1.5 text-xs text-gray-500">{rotulo}</span>
    </div>
  );
}
