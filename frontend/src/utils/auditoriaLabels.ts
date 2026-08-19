/**
 * Tradução da trilha de auditoria para linguagem de negócio.
 *
 * A tabela `audit_log` guarda nomes técnicos (tabela, coluna, INSERT/UPDATE/DELETE). Este módulo
 * converte tudo isso no vocabulário que qualquer pessoa da equipe entende, e é compartilhado entre
 * a listagem e o detalhe pra os dois falarem exatamente a mesma língua.
 */

/** Rótulos amigáveis por tabela do audit_log (best-effort; cai no nome legível se não mapeado). */
export const TABELA_LABEL: Record<string, string> = {
  // Projetos / Estratégia
  cadastros_projetos: "Projetos",
  cadastros_projetos_entregas: "Projetos — Entregas",
  cadastros_projetos_riscos: "Projetos — Riscos",
  cadastros_projetos_entraves: "Projetos — Entraves",
  tep_termos_encerramento: "Projetos — TEP",
  pdtic_acoes: "PDTIC — Ações",
  processos_negocio: "Escritório de Processos",
  objectives: "Estratégia — Objetivos",
  key_results: "Estratégia — Resultados-chave",
  initiatives: "Estratégia — Iniciativas",
  programs: "Estratégia — Programas",
  program_initiatives: "Estratégia — Iniciativas do programa",
  execution_controls: "Estratégia — Controle de execução",
  cadastros_metas: "Estratégia — Metas",
  // Contratações
  pcas: "Contratações — PCA",
  pcas_snapshots: "Contratações — PCA (versão)",
  pca_tarefas: "Contratações — Tarefas do PCA",
  pca_pontos_controle: "Contratações — Pontos de controle",
  pca_renovacoes: "Contratações — Renovações",
  ifo: "Contratações — IFO",
  ifo_contratos: "Contratações — IFO/Contratos",
  contracts: "Contratações — Contratos",
  ciclo_orcamentario: "Ciclo Orçamentário",
  atas_comites: "Atas de Comitês",
  // Comitês
  comites: "Comitês",
  comite_membros: "Comitês — Membros",
  comite_reunioes: "Comitês — Reuniões",
  comite_reuniao_pauta: "Comitês — Pauta da reunião",
  comite_quadro_controle: "Comitês — Quadro de controle",
  // Pessoas / Competências
  users: "Usuários",
  forms: "Pessoas — Formulários",
  form_responses: "Pessoas — Respostas de formulário",
  form_answers: "Pessoas — Respostas (itens)",
  form_fields: "Pessoas — Campos do formulário",
  form_sections: "Pessoas — Seções do formulário",
  competencias_gestor_itens: "Pessoas — Itens da matriz",
  competencias_padrao: "Pessoas — Competências padrão",
  competencias_padrao_versoes: "Pessoas — Competências padrão (versões)",
  pca_items: "Contratações — Itens do PCA",
  autoavaliacao_formularios: "Pessoas — Autoavaliação",
  avaliacao_gestor_formularios: "Pessoas — Avaliação do Gestor",
  avaliacao_integrada_formularios: "Pessoas — Avaliação Integrada",
  competencias_gestor_formularios: "Pessoas — Matriz de Competências",
  // SGSI
  sgsi_emissao: "SGSI — Emissões",
  sgsi_relatorio: "SGSI — Relatórios",
  sgsi_risco: "SGSI — Riscos",
  sgsi_tarefa: "SGSI — Tarefas 5W2H",
  sgsi_indicador: "SGSI — Indicadores",
  sgsi_framework_item: "SGSI — Frameworks",
  sgsi_documento: "SGSI — Obrigações",
  sgsi_ata: "SGSI — Atas",
  sgsi_configuracao: "SGSI — Configurações",
  sgsi_leitura_requisito: "SGSI — Leitura (requisitos)",
  sgsi_leitura_confirmacao: "SGSI — Leitura (confirmação)",
  sgsi_evento_rh: "SGSI — Eventos de RH",
  sgsi_incidente: "SGSI — Incidentes",
  sgsi_alerta: "SGSI — Alertas",
  sgsi_api_chave: "SGSI — Chaves de API",
  sgsi_webhook: "SGSI — Webhooks",
  sgsi_sbom_sistema: "SGSI — SBOM",
};

/** Nome legível derivado do próprio table_name (Title Case) — usado quando não há rótulo mapeado. */
export function tabelaLegivel(table: string): string {
  // Defensivo: um `evento` gravado torto por algum service não pode derrubar a tela inteira.
  if (typeof table !== "string" || !table) return "—";
  return table
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

/** O que aparece na coluna "Onde" — sempre um nome de negócio, nunca o nome cru da tabela. */
export function tabelaLabel(table: string): string {
  return TABELA_LABEL[table] || tabelaLegivel(table);
}

/**
 * Agrupa um table_name do audit_log numa ÁREA de negócio — é por área que a tela filtra.
 *
 * Cobre as 133 tabelas do schema. O fallback é um "Outras áreas" único e NÃO o nome da tabela:
 * quando cada tabela desconhecida virava a própria área, o filtro enchia de entradas técnicas
 * ("Forms", "Objectives", "Form Responses"). Quem precisa do detalhe tem a segunda linha da
 * coluna "Onde", que continua nomeando exatamente a origem.
 */
export function moduloDe(table: string): string {
  if (table.startsWith("sgsi_")) return "Segurança da Informação";
  if (
    table.startsWith("cadastros_projetos") ||
    table.startsWith("tep_") ||
    table.startsWith("tap_")
  )
    return "Projetos";
  if (table.startsWith("processos_negocio") || table === "pops_criados")
    return "Escritório de Processos";
  if (table === "pdtic_acoes") return "PDTIC";
  if (
    table.startsWith("pca") ||
    table.startsWith("ifo") ||
    table.startsWith("contract") ||
    table.startsWith("orcamento") ||
    table.startsWith("parametros_ciclo") ||
    table === "ciclo_orcamentario" ||
    table === "revisao_item_validacao" ||
    table === "delegacao_edicao" ||
    table === "atas_comites"
  )
    return "Contratações de TIC";
  if (
    table.startsWith("autoavaliacao") ||
    table.startsWith("avaliacao_") ||
    table.startsWith("competencias") ||
    table.startsWith("form") ||
    table.startsWith("pessoas_") ||
    table.startsWith("pac_") ||
    table === "autorizacoes_formulario_competencias"
  )
    return "Pessoas / Competências";
  if (
    table.startsWith("gestao_") ||
    table === "cadastros_metas" ||
    table === "objectives" ||
    table === "key_results" ||
    table === "initiatives" ||
    table === "programs" ||
    table === "program_initiatives" ||
    table === "execution_controls" ||
    table === "sprints"
  )
    return "Estratégia";
  if (table.startsWith("comite")) return "Comitês";
  if (
    table.startsWith("permissoes") ||
    table.startsWith("databasechangelog") ||
    table === "users" ||
    table === "ambientes" ||
    table === "audit_log" ||
    table === "notificacoes_pendencia" ||
    table === "plataforma_abas" ||
    table === "tags_acoes"
  )
    return "Administração";
  if (table.startsWith("cadastros_")) return "Cadastros";
  return "Outras áreas";
}

/**
 * O verbo que a pessoa lê no lugar de INSERT/UPDATE/DELETE. Cobre as ações canônicas do audit_log
 * e os eventos semânticos que o SGSI grava dentro de `changed_fields.evento`.
 */
export const ACAO_LABEL: Record<string, string> = {
  INSERT: "Cadastrou",
  UPDATE: "Alterou",
  DELETE: "Excluiu",
  SOFT_DELETE: "Removeu",
  RESTORE: "Restaurou",
  LOGIN: "Entrou no sistema",
  LOGOUT: "Saiu do sistema",
  EXPORT: "Exportou",
  EMITIDO: "Emitiu",
  CRIADO: "Cadastrou",
  ATUALIZADO: "Alterou",
  AVALIADO: "Avaliou",
  STATUS_ALTERADO: "Mudou o andamento",
  DOC_ASSINADO: "Assinou o documento",
  DOC_REABERTO: "Reabriu o documento",
  CANCELADO: "Cancelou",
  EXCLUIDO: "Excluiu",
};

export function acaoLabel(acao: string): string {
  return ACAO_LABEL[acao] || tabelaLegivel(acao);
}

/** Cor do selo por evento/ação. */
export const ACAO_CLASSE: Record<string, string> = {
  INSERT: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  UPDATE: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  DELETE: "bg-red-50 text-red-600 ring-1 ring-red-200",
  SOFT_DELETE: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  RESTORE: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  LOGIN: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  LOGOUT: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
  EXPORT: "bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200",
  EMITIDO: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  CRIADO: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  ATUALIZADO: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  AVALIADO: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  STATUS_ALTERADO: "bg-blue-50 text-blue-700 ring-1 ring-blue-200",
  DOC_ASSINADO: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
  DOC_REABERTO: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  CANCELADO: "bg-red-50 text-red-600 ring-1 ring-red-200",
  EXCLUIDO: "bg-red-50 text-red-600 ring-1 ring-red-200",
};

export function acaoClasse(acao: string): string {
  return (
    ACAO_CLASSE[acao] || "bg-slate-100 text-slate-600 ring-1 ring-slate-200"
  );
}

/** Rótulo de negócio das colunas mais comuns do sistema. */
export const CAMPO_LABEL: Record<string, string> = {
  id: "Identificador",
  nome: "Nome",
  name: "Nome",
  title: "Título",
  titulo: "Título",
  descricao: "Descrição",
  description: "Descrição",
  status: "Situação",
  situacao: "Situação",
  tipo: "Tipo",
  ativo: "Ativo",
  ordem: "Ordem",
  ordem_linha: "Ordem (linha)",
  ordem_posicao: "Ordem (posição)",
  versao: "Versão",
  versao_formulario: "Versão do formulário",
  tecnicas_versao: "Versão das técnicas",
  codigo: "Código",
  code: "Código",
  sigla: "Sigla",
  cor: "Cor",
  icone: "Ícone",
  dados: "Dados do formulário",
  objetivo: "Objetivo",
  objeto: "Objeto",
  observacoes: "Observações",
  observacoes_gerais: "Observações gerais",
  justificativa: "Justificativa",
  ano: "Ano",
  dominio: "Domínio",
  object_name: "Nome do objeto",
  // Pessoas / áreas
  email: "E-mail",
  role: "Perfil de acesso",
  matricula: "Matrícula",
  cargo_funcao: "Cargo / função",
  foto_perfil: "Foto de perfil",
  ad_username: "Usuário de rede",
  is_superadmin: "Superadministrador",
  is_sso_user: "Acessa por SSO",
  password_hash: "Senha",
  diretoria: "Diretoria",
  directorate_code: "Código da diretoria",
  diretoria_visibilidade: "Diretorias visíveis",
  areas_vinculadas_ids: "Áreas vinculadas",
  area_id: "Área",
  area_demandante: "Área demandante",
  area_demandante_id: "Área demandante",
  unidade_id: "Unidade",
  responsavel: "Responsável",
  responsavel_id: "Responsável",
  // Contratações
  item_pca: "Item do PCA",
  pca_item_id: "Item do PCA",
  valor_estimado: "Valor estimado",
  valor_formalizado: "Valor formalizado",
  data_estimada_contratacao: "Data estimada da contratação",
  renovacao_id: "Renovação",
  ciclo_id: "Ciclo",
  contract_type: "Tipo de contratação",
  contract_ids: "Contratos vinculados",
  contratada: "Empresa contratada",
  estimated_date: "Data estimada",
  estimated_value_cents: "Valor estimado",
  formalized_value_cents: "Valor formalizado",
  valor_anual: "Valor anual",
  financial_resource_type: "Origem do recurso",
  gestor_demandante: "Gestor demandante",
  justification: "Justificativa",
  numero_item: "Número do item",
  ponto_controle: "Ponto de controle",
  ponto_controle_id: "Ponto de controle",
  origem_ciclo_id: "Ciclo de origem",
  origem_finalidade: "Finalidade de origem",
  origem_proad: "PROAD de origem",
  link_proad: "Link do PROAD",
  link_transparencia: "Link da transparência",
  step: "Etapa",
  priority: "Prioridade",
  process: "Processo",
  // Comitês / atas
  comite_id: "Comitê",
  reuniao_id: "Reunião",
  tipo_reuniao: "Tipo de reunião",
  proxima_reuniao: "Próxima reunião",
  item_pauta_id: "Item da pauta",
  deliberacao: "Deliberação",
  decisao_encaminhamento: "Decisão / encaminhamento",
  discussao_contexto: "Discussão / contexto",
  acoes_atividades: "Ações / atividades",
  link_ata: "Link da ata",
  ata_filename: "Ata (arquivo)",
  ata_filepath: "Ata (local do arquivo)",
  ata_filesize: "Ata (tamanho do arquivo)",
  ata_uploaded_at: "Ata enviada em",
  ata_uploaded_by: "Ata enviada por",
  prazo: "Prazo",
  tarefa: "Tarefa",
  item: "Item",
  numero: "Número",
  data: "Data",
  mes: "Mês",
  year: "Ano",
  // Pessoas — dados funcionais
  cadastros_areas_id: "Área",
  cadastros_unidades_id: "Unidade",
  area_demandante_nome: "Área demandante",
  diretoria_nome: "Diretoria",
  allowed_directorates: "Diretorias permitidas",
  unidade_lotacao_atual: "Unidade de lotação",
  situacao_funcional: "Situação funcional",
  cargo_efetivo: "Cargo efetivo",
  classe_efetivo: "Classe do cargo efetivo",
  classe_cc_fc: "Classe do CC/FC",
  nome_cc_fc: "Nome do CC/FC",
  is_developer: "Acessa o módulo Desenvolvimento",
  // Vínculos
  projeto_id: "Projeto",
  formulario_id: "Formulário",
  user_id: "Usuário",
  // Validação
  validado_em: "Validado em",
  validado_final_em: "Validação final em",
  validado_por_nome: "Validado por",
  // Técnicos / trilha
  created_at: "Criado em",
  updated_at: "Atualizado em",
  created_by: "Criado por",
  updated_by: "Atualizado por",
  deleted_at: "Excluído em",
  deleted_by: "Excluído por",
  is_deleted: "Excluído",
};

/**
 * Campos que mudam sozinhos a cada gravação (carimbo de data/autor). Ficam escondidos por padrão
 * no detalhe pra a pessoa ver só o que ELA de fato mexeu — dá pra revelar com um clique.
 */
export const CAMPOS_TECNICOS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "deleted_at",
  "deleted_by",
  "is_deleted",
]);

/** Rótulo do campo: dicionário primeiro, senão humaniza o snake_case (e some com o sufixo _id). */
export function campoLabel(campo: string): string {
  if (CAMPO_LABEL[campo]) return CAMPO_LABEL[campo];
  const base = campo.replace(/_id$/, "");
  const legivel = base.replace(/_/g, " ");
  return legivel.charAt(0).toUpperCase() + legivel.slice(1);
}

const RE_DATA_HORA = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/;
const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;
/** Só traduz quem tem cara de constante (MAIÚSCULA_COM_UNDERSCORE), nunca texto digitado. */
const RE_CONSTANTE = /^[A-Z][A-Z0-9_]*$/;

/** Constantes que o banco guarda em inglês/maiúsculas e que ninguém deveria precisar decifrar. */
export const VALOR_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicado",
  ACTIVE: "Ativo",
  INACTIVE: "Inativo",
  ARCHIVED: "Arquivado",
  PENDING: "Pendente",
  NOT_STARTED: "Não iniciado",
  IN_PROGRESS: "Em andamento",
  COMPLETED: "Concluído",
  DONE: "Concluído",
  TODO: "A fazer",
  DOING: "Em execução",
  CANCELLED: "Cancelado",
  CANCELED: "Cancelado",
  OPEN: "Aberto",
  CLOSED: "Fechado",
  APPROVED: "Aprovado",
  REJECTED: "Rejeitado",
  ALL: "Todas",
  NONE: "Nenhuma",
  // Andamento / prioridade
  NAO_INICIADO: "Não iniciado",
  NAO_INICIADA: "Não iniciada",
  EM_ANDAMENTO: "Em andamento",
  EM_ATRASO: "Em atraso",
  NO_PRAZO: "No prazo",
  CONCLUIDO: "Concluído",
  CONCLUIDA: "Concluída",
  SUSPENSO: "Suspenso",
  ALTO: "Alto",
  ALTA: "Alta",
  MEDIO: "Médio",
  MEDIA: "Média",
  BAIXO: "Baixo",
  BAIXA: "Baixa",
  // Perfis de acesso
  ADMIN: "Administrador",
  MANAGER: "Gestor",
  VIEWER: "Visualizador",
  USER: "Usuário",
  SUPERADMIN: "Superadministrador",
  // Contratações
  NOVA_CONTRATACAO: "Nova contratação",
  RENOVACAO: "Renovação",
  PRORROGACAO: "Prorrogação",
};

/** Nome do item mexido, tirado do próprio conteúdo — "Form Smoke 6" diz mais que "nº 5". */
export function nomeDoItem(
  ...fontes: (Record<string, unknown> | null | undefined)[]
): string | null {
  const candidatos = [
    "title",
    "titulo",
    "nome",
    "name",
    "objeto",
    "object_name",
    "tarefa",
    "ponto_controle",
    "deliberacao",
    "item",
    "item_pca",
    "codigo",
    "descricao",
    "description",
  ];
  for (const fonte of fontes) {
    if (!fonte) continue;
    for (const k of candidatos) {
      const v = fonte[k];
      if (typeof v === "string" && v.trim() && v.trim().length <= 120) {
        return v.trim();
      }
    }
  }
  return null;
}

/**
 * Campo que representa dinheiro — as colunas `…_cents` guardam centavos, as demais reais.
 * `valor`/`value` sozinhos ficam de fora de propósito: em `parametros_ciclo_geral` e
 * `form_answers` são campos genéricos de texto, e formatá-los como moeda inventaria um "R$".
 */
function ehMonetario(campo?: string): boolean {
  if (!campo || campo === "valor" || campo === "value") return false;
  return /_cents$|valor|preco|custo|orcament/i.test(campo);
}

const RE_NUMERO = /^-?\d+(\.\d+)?$/;

/** Dicionário de nomes de chave estrangeira vindo do backend: `{ campo: { id: rótulo } }`. */
export type Referencias = Record<string, Record<string, string>>;

/** Converte um valor cru do JSON no texto que a pessoa lê. */
export function formatarValor(
  valor: unknown,
  campo?: string,
  referencias?: Referencias,
): string {
  if (valor === null || valor === undefined) return "(vazio)";
  // Chave estrangeira que o backend conseguiu resolver: mostra o nome, não o id.
  if (campo && referencias?.[campo] && (typeof valor === "number" || typeof valor === "string")) {
    const rotulo = referencias[campo][String(valor)];
    if (rotulo) return rotulo;
  }
  if (typeof valor === "boolean") return valor ? "Sim" : "Não";
  if (typeof valor === "number") {
    if (ehMonetario(campo)) {
      const emCentavos = campo ? /_cents$/.test(campo) : false;
      return (emCentavos ? valor / 100 : valor).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
      });
    }
    return String(valor);
  }
  if (typeof valor === "string") {
    if (valor === "") return "(vazio)";
    // numeric/bigint do Postgres chegam como STRING no JSON (Jackson): "20000000". Sem isso,
    // um valor em dinheiro passaria batido pela formatação de moeda.
    if (ehMonetario(campo) && RE_NUMERO.test(valor)) {
      return formatarValor(Number(valor), campo);
    }
    if (RE_CONSTANTE.test(valor)) {
      return VALOR_LABEL[valor] || valor;
    }
    if (RE_DATA_HORA.test(valor)) {
      const d = new Date(valor);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        });
      }
    }
    if (RE_DATA.test(valor)) {
      const partes = valor.split("-");
      return `${partes[2]}/${partes[1]}/${partes[0]}`;
    }
    // Anexo em base64 (padrão do Kaizen): mostrar o tamanho, não despejar o conteúdo na tela.
    if (valor.length > 2000) {
      return `(conteúdo extenso — ${valor.length.toLocaleString("pt-BR")} caracteres)`;
    }
    return valor;
  }
  if (Array.isArray(valor)) {
    if (valor.length === 0) return "(nenhum)";
    if (valor.every((v) => typeof v !== "object" || v === null)) {
      return valor.map((v) => formatarValor(v)).join(", ");
    }
    return `${valor.length} item(ns)`;
  }
  return JSON.stringify(valor, null, 2);
}

export type TipoMudanca = "alterado" | "adicionado" | "removido";

export interface DiffCampo {
  campo: string;
  rotulo: string;
  antes: unknown;
  depois: unknown;
  tipo: TipoMudanca;
  /** Carimbo automático (updated_at, updated_by…) — escondido por padrão na tela. */
  tecnico: boolean;
}

function iguais(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  // null e "" representam o mesmo "sem valor" na maior parte das telas do Kaizen.
  const vazio = (v: unknown) => v === null || v === undefined || v === "";
  if (vazio(a) && vazio(b)) return true;
  try {
    return JSON.stringify(a) === JSON.stringify(b);
  } catch {
    return false;
  }
}

/**
 * Compara os JSONs de antes/depois e devolve só o que mudou.
 * Serve tanto pra alteração (dois lados) quanto pra cadastro (só depois) e exclusão (só antes).
 */
export function calcularDiff(
  antes: Record<string, unknown> | null,
  depois: Record<string, unknown> | null,
): DiffCampo[] {
  const chaves = Array.from(
    new Set([...Object.keys(depois || {}), ...Object.keys(antes || {})]),
  );
  const out: DiffCampo[] = [];
  for (const campo of chaves) {
    const a = antes ? antes[campo] : undefined;
    const d = depois ? depois[campo] : undefined;
    if (antes && depois && iguais(a, d)) continue;
    const tipo: TipoMudanca = !antes
      ? "adicionado"
      : !depois
        ? "removido"
        : a === undefined
          ? "adicionado"
          : d === undefined
            ? "removido"
            : "alterado";
    out.push({
      campo,
      rotulo: campoLabel(campo),
      antes: a,
      depois: d,
      tipo,
      tecnico: CAMPOS_TECNICOS.has(campo),
    });
  }
  // Campos de negócio primeiro; carimbos automáticos no fim.
  return out.sort((x, y) => {
    if (x.tecnico !== y.tecnico) return x.tecnico ? 1 : -1;
    return x.rotulo.localeCompare(y.rotulo, "pt-BR");
  });
}

/**
 * Como o item se chama numa frase, no singular e com artigo ("o formulário", "a reunião").
 * É o que permite escrever "excluiu a competência padrão nº 17" em vez de "DELETE em nº 17".
 */
export const TABELA_ITEM: Record<string, string> = {
  users: "o usuário",
  forms: "o formulário",
  form_responses: "a resposta de formulário",
  form_answers: "a resposta",
  form_fields: "o campo do formulário",
  form_sections: "a seção do formulário",
  competencias_padrao: "a competência padrão",
  competencias_padrao_versoes: "a versão das competências padrão",
  competencias_gestor_formularios: "a matriz de competências",
  competencias_gestor_itens: "o item da matriz de competências",
  autoavaliacao_formularios: "a autoavaliação",
  avaliacao_gestor_formularios: "a avaliação do gestor",
  avaliacao_integrada_formularios: "a avaliação integrada",
  // Contratações
  pcas: "o PCA",
  pca_items: "o item do PCA",
  pca_tarefas: "a tarefa do PCA",
  pca_pontos_controle: "o ponto de controle",
  pca_renovacoes: "a renovação",
  pcas_snapshots: "a versão do PCA",
  ifo: "o IFO",
  ifo_contratos: "o contrato do IFO",
  contracts: "o contrato",
  ciclo_orcamentario: "o ciclo orçamentário",
  // Comitês
  comites: "o comitê",
  comite_membros: "o membro do comitê",
  comite_reunioes: "a reunião do comitê",
  comite_reuniao_pauta: "o item de pauta",
  comite_quadro_controle: "o item do quadro de controle",
  atas_comites: "a ata do comitê",
  // Projetos / Estratégia
  cadastros_projetos: "o projeto",
  cadastros_projetos_entregas: "a entrega do projeto",
  cadastros_projetos_riscos: "o risco do projeto",
  cadastros_projetos_entraves: "o entrave do projeto",
  tep_termos_encerramento: "o termo de encerramento",
  tap_versoes: "a versão do TAP",
  pdtic_acoes: "a ação do PDTIC",
  processos_negocio: "o processo de negócio",
  objectives: "o objetivo",
  key_results: "o resultado-chave",
  initiatives: "a iniciativa",
  programs: "o programa",
  program_initiatives: "a iniciativa do programa",
  execution_controls: "o controle de execução",
  cadastros_metas: "a meta",
  // SGSI
  sgsi_risco: "o risco",
  sgsi_tarefa: "a tarefa 5W2H",
  sgsi_documento: "a obrigação",
  sgsi_indicador: "o indicador",
  sgsi_ata: "a ata",
  sgsi_incidente: "o incidente",
  sgsi_alerta: "o alerta",
  sgsi_relatorio: "o relatório",
  sgsi_emissao: "a emissão",
};

export function itemLabel(table: string): string {
  return TABELA_ITEM[table] || "o registro";
}

/**
 * Contrai a preposição com o artigo do item: "em" + "o comitê" = "no comitê"; "de" + "a meta" =
 * "da meta". Sem isso a frase saía "alterou 2 campos de o usuário".
 */
function contrair(alvo: string, prep: "em" | "de"): string {
  if (alvo.startsWith("o ")) {
    return `${prep === "em" ? "no" : "do"} ${alvo.slice(2)}`;
  }
  if (alvo.startsWith("a ")) {
    return `${prep === "em" ? "na" : "da"} ${alvo.slice(2)}`;
  }
  return `${prep} ${alvo}`;
}

/**
 * Como o item aparece na listagem, ao lado do verbo: `O item do PCA "Notebooks"`.
 * Retorna `null` quando não há item nenhum — entrar no sistema não mexe em "usuário nº 4".
 */
export function resumoItem(
  tabela: string,
  acao: string,
  recordId: number | null,
  nome: string | null,
): string | null {
  if (acao === "LOGIN" || acao === "LOGOUT") return null;
  const item = itemLabel(tabela);
  // O nome pode vir de uma descrição longa; na linha da tabela ele precisa caber.
  const curto =
    nome && nome.length > 60 ? `${nome.slice(0, 60).trimEnd()}…` : nome;
  const texto = curto ? `${item} "${curto}"` : `${item} nº ${recordId}`;
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

export interface DescricaoParams {
  quem: string;
  /** Evento já resolvido (ação canônica ou o evento de negócio do SGSI). */
  acao: string;
  tabela: string;
  recordId: number | null;
  nome: string | null;
  /** Mudanças de negócio já filtradas. `undefined` = ainda não sabemos (caso da listagem). */
  mudancas?: DiffCampo[];
  /** Nomes de chave estrangeira, pra frase dizer "de DPE para SGJT" em vez de "de 2 para 1". */
  referencias?: Referencias;
}

/**
 * A frase que abre o detalhe. O objetivo é que a pessoa entenda o que houve sem ler mais nada —
 * antes a tela mostrava "Usuários nº 4" pra um login, que não diz nada a ninguém.
 */
export function descreverAcao(p: DescricaoParams): string {
  const { quem, acao, tabela, recordId, nome, mudancas, referencias } = p;
  const item = itemLabel(tabela);
  const alvo = nome ? `${item} "${nome}"` : `${item} nº ${recordId}`;

  switch (acao) {
    case "LOGIN":
      return `${quem} entrou no sistema.`;
    case "LOGOUT":
      return `${quem} saiu do sistema.`;
    case "EXPORT":
      return `${quem} exportou dados de ${moduloDe(tabela)}.`;
    case "INSERT":
    case "CRIADO":
      return `${quem} cadastrou ${alvo}.`;
    case "DELETE":
    case "EXCLUIDO":
      return `${quem} excluiu ${alvo}.`;
    case "SOFT_DELETE":
      return `${quem} removeu ${alvo}.`;
    case "RESTORE":
      return `${quem} restaurou ${alvo}.`;
    case "UPDATE":
    case "ATUALIZADO": {
      if (!mudancas) return `${quem} alterou ${alvo}.`;
      if (mudancas.length === 0) {
        return `${quem} salvou ${alvo}, sem mudar nenhum conteúdo.`;
      }
      // Uma mudança só cabe inteira na frase — é o caso mais comum e o mais fácil de entender.
      if (mudancas.length === 1) {
        const m = mudancas[0];
        const de = formatarValor(m.antes, m.campo, referencias);
        const para = formatarValor(m.depois, m.campo, referencias);
        return `${quem} alterou ${m.rotulo.toLowerCase()} de "${de}" para "${para}" ${contrair(alvo, "em")}.`;
      }
      return `${quem} alterou ${mudancas.length} campos ${contrair(alvo, "de")}.`;
    }
    default:
      // Eventos semânticos do SGSI (EMITIDO, DOC_ASSINADO…): usa o verbo do dicionário.
      return `${quem} ${acaoLabel(acao).toLowerCase()} ${alvo}.`;
  }
}

/** Faz o parse tolerante de uma coluna jsonb que chega como texto. */
export function parseJson(
  texto: string | null | undefined,
): Record<string, unknown> | null {
  if (!texto || texto === "null") return null;
  try {
    const obj = JSON.parse(texto);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}
