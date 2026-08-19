import { useEffect, useMemo, useState } from "react";
import { Loader2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { auditoriaApi } from "@/services/auditoriaApi";
import type { AuditoriaDetalhe } from "@/services/auditoriaApi";
import {
  acaoClasse,
  acaoLabel,
  calcularDiff,
  campoLabel,
  formatarValor,
  moduloDe,
  descreverAcao,
  nomeDoItem,
  parseJson,
  tabelaLabel,
} from "@/utils/auditoriaLabels";
import type { DiffCampo, Referencias } from "@/utils/auditoriaLabels";

interface Props {
  /** Id do registro da trilha a abrir; `null` mantém o diálogo fechado. */
  registroId: number | null;
  onClose: () => void;
}

function fmtDataHora(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

/** Um valor do comparativo. Vermelho = como estava; verde = como ficou. */
function Valor({ texto, tom }: { texto: string; tom: "antes" | "depois" }) {
  const vazio = /^\((vazio|nenhum|não existia|removido)\)$/.test(texto);
  return (
    <span
      className={cn(
        "inline-block rounded px-1.5 py-0.5 break-words",
        vazio
          ? "italic text-slate-400"
          : tom === "antes"
            ? "bg-red-50 text-red-800"
            : "bg-emerald-50 text-emerald-800",
      )}
    >
      {texto}
    </span>
  );
}

/**
 * Tabela do comparativo. Uma linha por campo — cards grandes deixavam 5 campos ocupando
 * a tela inteira e repetiam o mesmo rótulo em cada caixa.
 */
function TabelaDiff({
  campos,
  ladoUnico,
  referencias,
}: {
  campos: DiffCampo[];
  ladoUnico: boolean;
  referencias?: Referencias;
}) {
  return (
    <table className="w-full table-fixed text-sm">
      <tbody className="divide-y divide-slate-100">
        {campos.map((d) => (
          <tr key={d.campo} className="align-top">
            <th
              scope="row"
              className="w-[30%] py-1.5 pr-3 text-left font-normal text-slate-500"
            >
              {d.rotulo}
            </th>
            {ladoUnico ? (
              <td className="py-1.5">
                <Valor
                  texto={formatarValor(
                    d.tipo === "removido" ? d.antes : d.depois,
                    d.campo,
                    referencias,
                  )}
                  tom={d.tipo === "removido" ? "antes" : "depois"}
                />
              </td>
            ) : (
              <>
                <td className="w-[32%] py-1.5">
                  <Valor
                    texto={
                      d.tipo === "adicionado"
                        ? "(não existia)"
                        : formatarValor(d.antes, d.campo, referencias)
                    }
                    tom="antes"
                  />
                </td>
                <td className="w-6 py-1.5 text-center text-slate-300">→</td>
                <td className="py-1.5">
                  <Valor
                    texto={
                      d.tipo === "removido"
                        ? "(removido)"
                        : formatarValor(d.depois, d.campo, referencias)
                    }
                    tom="depois"
                  />
                </td>
              </>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/** JSON formatado com as linhas dos campos alterados destacadas. */
function BlocoJson({
  dados,
  tom,
  titulo,
  camposAlterados,
}: {
  dados: Record<string, unknown> | null;
  tom: "antes" | "depois";
  titulo: string;
  camposAlterados: Set<string>;
}) {
  const linhas = useMemo(
    () => (dados ? JSON.stringify(dados, null, 2).split("\n") : null),
    [dados],
  );

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border",
        tom === "antes"
          ? "border-red-200 bg-red-50/50"
          : "border-emerald-200 bg-emerald-50/50",
      )}
    >
      <div
        className={cn(
          "border-b px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide",
          tom === "antes"
            ? "border-red-200 bg-red-100/60 text-red-600"
            : "border-emerald-200 bg-emerald-100/60 text-emerald-700",
        )}
      >
        {titulo}
      </div>
      {!linhas ? (
        <p className="px-3 py-4 text-xs italic text-slate-400">
          {tom === "antes"
            ? "Não havia registro anterior."
            : "Não há registro posterior."}
        </p>
      ) : (
        <pre className="max-h-80 overflow-auto px-3 py-2 font-mono text-[11px] leading-relaxed">
          {linhas.map((linha, i) => {
            const chave = linha.match(/^\s*"([^"]+)":/)?.[1];
            const destaque = chave ? camposAlterados.has(chave) : false;
            return (
              <div
                key={i}
                className={cn(
                  "-mx-3 px-3",
                  destaque
                    ? tom === "antes"
                      ? "bg-red-200/60 font-semibold text-red-900"
                      : "bg-emerald-200/60 font-semibold text-emerald-900"
                    : "text-slate-600",
                )}
              >
                {linha || " "}
              </div>
            );
          })}
        </pre>
      )}
    </div>
  );
}

/** Seção que abre/fecha, usada pro que é secundário (campos automáticos, dados técnicos). */
function Recolhivel({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  const [aberto, setAberto] = useState(false);
  return (
    <div>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform",
            aberto && "rotate-180",
          )}
        />
        {titulo}
      </button>
      {aberto && <div className="mt-2">{children}</div>}
    </div>
  );
}

export function AuditoriaDetalheDialog({ registroId, onClose }: Props) {
  const [detalhe, setDetalhe] = useState<AuditoriaDetalhe | null>(null);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [verJson, setVerJson] = useState(false);

  useEffect(() => {
    if (registroId === null) return;
    setLoading(true);
    setErro(null);
    setDetalhe(null);
    setVerJson(false);
    auditoriaApi
      .getDetalhe(registroId)
      .then(setDetalhe)
      .catch(() => setErro("Não foi possível carregar este registro."))
      .finally(() => setLoading(false));
  }, [registroId]);

  const antes = useMemo(() => parseJson(detalhe?.old_values), [detalhe]);
  const depois = useMemo(() => parseJson(detalhe?.new_values), [detalhe]);
  const extras = useMemo(() => parseJson(detalhe?.changed_fields), [detalhe]);

  const diff = useMemo(() => calcularDiff(antes, depois), [antes, depois]);
  const negocio = diff.filter((d) => !d.tecnico);
  const tecnicos = diff.filter((d) => d.tecnico);
  const camposAlterados = useMemo(
    () => new Set(diff.map((d) => d.campo)),
    [diff],
  );

  // O SGSI grava o evento de negócio dentro de changed_fields; ele manda no rótulo da ação.
  const evento =
    (extras?.evento as string | undefined) || detalhe?.action || "";
  const temComparativo = Boolean(antes || depois);
  // Cadastro e exclusão têm um lado só — não faz sentido pedir pra comparar com o nada.
  const ladoUnico = Boolean(antes) !== Boolean(depois);
  // O título vem da AÇÃO, não da presença de old/new: um DELETE sem conteúdo gravado estava
  // aparecendo como "Dados cadastrados".
  const tituloSecao =
    evento === "DELETE" || evento === "SOFT_DELETE" || evento === "EXCLUIDO"
      ? "Dados excluídos"
      : !antes
        ? "Dados cadastrados"
        : "O que mudou";

  const nome = nomeDoItem(depois, antes, extras) || detalhe?.item_nome || null;
  const onde = detalhe ? tabelaLabel(detalhe.table_name) : "";
  const extrasVisiveis = extras
    ? Object.entries(extras).filter(([k]) => k !== "evento")
    : [];

  const frase = detalhe
    ? descreverAcao({
        quem: detalhe.user_name || "Um usuário não identificado",
        acao: evento,
        tabela: detalhe.table_name,
        recordId: detalhe.record_id,
        nome,
        mudancas: temComparativo ? negocio : undefined,
        referencias: detalhe.referencias,
      })
    : "";

  return (
    <Dialog open={registroId !== null} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] max-w-3xl gap-3 overflow-y-auto p-5">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-500">
            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            Carregando…
          </div>
        ) : erro || !detalhe ? (
          <div className="py-12 text-center text-sm text-slate-500">
            {erro || "Registro não encontrado."}
          </div>
        ) : (
          <>
            {/* Abre dizendo o que aconteceu, em uma frase. O resto é contexto. */}
            <DialogHeader className="space-y-1.5 pr-8">
              <div>
                <span
                  className={cn(
                    "rounded-full px-2.5 py-0.5 text-xs font-semibold",
                    acaoClasse(evento),
                  )}
                >
                  {acaoLabel(evento)}
                </span>
              </div>
              <DialogTitle className="text-base font-semibold leading-snug text-slate-900">
                {frase}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                {fmtDataHora(detalhe.created_at)}
                {detalhe.user_email && ` · ${detalhe.user_email}`}
                {` · ${moduloDe(detalhe.table_name)} › ${onde}`}
              </DialogDescription>
            </DialogHeader>

            {/* Informações que a própria ação registrou (ex.: eventos do SGSI) */}
            {extrasVisiveis.length > 0 && (
              <table className="w-full table-fixed border-t border-slate-100 pt-2 text-sm">
                <tbody className="divide-y divide-slate-100">
                  {extrasVisiveis.map(([k, v]) => (
                    <tr key={k} className="align-top">
                      <th
                        scope="row"
                        className="w-[30%] py-1.5 pr-3 text-left font-normal text-slate-500"
                      >
                        {campoLabel(k)}
                      </th>
                      <td className="py-1.5 text-slate-700">
                        {formatarValor(v, k, detalhe.referencias)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* O comparativo */}
            <div className="border-t border-slate-100 pt-3">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                {/* Sem conteúdo não há o que intitular — o título contradiria a mensagem abaixo. */}
                <h3 className="text-sm font-semibold text-slate-800">
                  {temComparativo ? tituloSecao : "Detalhes"}
                  {negocio.length > 0 && (
                    <span className="ml-1.5 font-normal text-slate-400">
                      · {negocio.length}{" "}
                      {negocio.length === 1 ? "campo" : "campos"}
                    </span>
                  )}
                </h3>
                {temComparativo && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-slate-500"
                    onClick={() => setVerJson((v) => !v)}
                  >
                    {verJson ? "Ver em texto" : "Ver JSON"}
                  </Button>
                )}
              </div>

              {!temComparativo ? (
                <p className="py-3 text-sm text-slate-500">
                  Esta ação não guardou conteúdo detalhado — o sistema registrou
                  apenas quem fez, quando e onde.
                </p>
              ) : verJson ? (
                <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                  <BlocoJson
                    dados={antes}
                    tom="antes"
                    titulo="Antes — como estava"
                    camposAlterados={camposAlterados}
                  />
                  <BlocoJson
                    dados={depois}
                    tom="depois"
                    titulo="Depois — como ficou"
                    camposAlterados={camposAlterados}
                  />
                </div>
              ) : negocio.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">
                  Nenhum campo de conteúdo mudou
                  {tecnicos.length > 0
                    ? " — só a data e o autor da última gravação."
                    : "."}
                </p>
              ) : (
                <TabelaDiff
                  campos={negocio}
                  ladoUnico={ladoUnico}
                  referencias={detalhe.referencias}
                />
              )}
            </div>

            {/* Secundário: fica fora do caminho de quem só quer entender o que aconteceu */}
            <div className="space-y-2 border-t border-slate-100 pt-2">
              {!verJson && tecnicos.length > 0 && (
                <Recolhivel
                  titulo={`${tecnicos.length} campo(s) preenchido(s) automaticamente`}
                >
                  <TabelaDiff
                    campos={tecnicos}
                    ladoUnico={ladoUnico}
                    referencias={detalhe.referencias}
                  />
                </Recolhivel>
              )}
              <Recolhivel titulo="Dados técnicos do registro">
                <div className="grid grid-cols-1 gap-1 font-mono text-[11px] text-slate-500 sm:grid-cols-2">
                  <span>registro da trilha: #{detalhe.id}</span>
                  <span>tabela: {detalhe.table_name}</span>
                  <span>ação: {detalhe.action}</span>
                  <span>id do item: {detalhe.record_id}</span>
                  <span>área: {moduloDe(detalhe.table_name)}</span>
                  {detalhe.user_role && <span>perfil: {detalhe.user_role}</span>}
                  {detalhe.ip_address && <span>IP: {detalhe.ip_address}</span>}
                  {detalhe.user_agent && (
                    <span className="break-all sm:col-span-2">
                      navegador: {detalhe.user_agent}
                    </span>
                  )}
                </div>
              </Recolhivel>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
