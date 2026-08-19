/**
 * Status de uma entrega de projeto.
 *
 * A entrega tem apenas DOIS estados e nenhum deles é escolhido à mão: ela nasce "Pendente" e só
 * vira "Concluída" quando a evidência e a data de conclusão são anexadas. Antes existia um
 * dropdown com três opções (Não Iniciada / Em Andamento / Concluída), o que permitia marcar uma
 * entrega como concluída sem nenhuma comprovação.
 *
 * Registros anteriores à mudança podem trazer 'nao_iniciada' ou 'em_andamento' — ambos são lidos
 * como pendente, então a tela não quebra com dado histórico.
 */

export type EntregaStatus = "pendente" | "concluida";

/** True quando a entrega está concluída (único status que não é pendente). */
export function entregaConcluida(status?: string | null): boolean {
  return status === "concluida";
}

/** Rótulo exibido para a pessoa. Qualquer status legado cai em "Pendente". */
export function entregaStatusLabel(status?: string | null): string {
  return entregaConcluida(status) ? "Concluída" : "Pendente";
}

/** Classes do selo (fundo + texto + borda) por status. */
export function entregaStatusClasse(status?: string | null): string {
  return entregaConcluida(status)
    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
    : "bg-slate-100 text-slate-600 ring-1 ring-slate-200";
}

/** Cor do pontinho que acompanha o selo. */
export function entregaStatusPonto(status?: string | null): string {
  return entregaConcluida(status) ? "bg-emerald-500" : "bg-slate-400";
}
