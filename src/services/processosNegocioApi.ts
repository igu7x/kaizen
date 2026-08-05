import { apiClient } from "./apiClient";

// ============================================================
// INTERFACES
// ============================================================

export type ProcessoStatus =
  | "em_elaboracao"
  | "enviado"
  | "validado_autor"
  | "validado_diretoria"
  | "validado_final"
  | "recusado";

export type TipoDocumentoAnexado =
  | "MPS"
  | "POP"
  | "AUX"
  | "PRI"
  | "FLUXOGRAMA"
  | "IT"
  | "OUTROS";

export interface DocumentoAnexado {
  tipo: TipoDocumentoAnexado;
  nome: string;
  mime: string;
  data: string; // data URL base64
  /** Nome de exibição amigável informado no anexo (opcional; cai no `nome` do arquivo). */
  nome_exibicao?: string;
  /** Data do documento informada no anexo (YYYY-MM-DD, opcional). */
  data_documento?: string;
}

/** Aprovação de um comitê (item da lista `aprovacoes`). `data` vem só no detalhe (não na listagem). */
export interface AprovacaoComite {
  comite: string; // sigla: CGTIC | CGovTIC
  filename: string | null;
  mime: string | null;
  em: string | null; // data de aprovação (YYYY-MM-DD)
  data?: string | null; // PDF base64 (ausente no payload enxuto da listagem)
}

export interface VersaoHistorico {
  id: number;
  versao: string;
  validado_final_em: string;
  validado_final_nome: string | null;
  created_at: string;
}

export const TIPO_DOCUMENTO_LABEL: Record<TipoDocumentoAnexado, string> = {
  MPS: "MPS — Modelo Padrão de Serviço",
  POP: "POP — Procedimento Operacional Padrão",
  AUX: "Docs Auxiliares",
  PRI: "Documento Primário",
  FLUXOGRAMA: "Fluxograma",
  IT: "Instrução de Trabalho",
  OUTROS: "Outros anexos",
};

export const TIPO_DOCUMENTO_BADGE: Record<TipoDocumentoAnexado, string> = {
  MPS: "bg-blue-100 text-blue-700 border-blue-200",
  POP: "bg-emerald-100 text-emerald-700 border-emerald-200",
  AUX: "bg-slate-100 text-slate-700 border-slate-200",
  PRI: "bg-violet-100 text-violet-700 border-violet-200",
  FLUXOGRAMA: "bg-pink-100 text-pink-700 border-pink-200",
  IT: "bg-pink-100 text-pink-700 border-pink-200",
  OUTROS: "bg-amber-100 text-amber-700 border-amber-200",
};

/**
 * Resolve o fluxograma do processo: prefere o documento anexado tipo "FLUXOGRAMA";
 * faz fallback para os campos legados fluxograma_* (processos antigos).
 */
export function getFluxograma(p: {
  documentos_anexados?: DocumentoAnexado[] | null;
  fluxograma_data?: string | null;
  fluxograma_filename?: string | null;
  fluxograma_mime?: string | null;
}): { data: string | null; filename: string | null; mime: string | null } {
  const doc = (p.documentos_anexados || []).find(
    (d) => d.tipo === "FLUXOGRAMA",
  );
  if (doc) return { data: doc.data, filename: doc.nome, mime: doc.mime };
  return {
    data: p.fluxograma_data ?? null,
    filename: p.fluxograma_filename ?? null,
    mime: p.fluxograma_mime ?? null,
  };
}

/**
 * Indica se o processo tem fluxograma. Prefere o flag `tem_fluxograma` do payload enxuto da
 * listagem (sem base64); cai para a checagem dos dados completos quando o flag não vier
 * (objeto vindo de getById/create/update).
 */
export function temFluxograma(p: {
  tem_fluxograma?: boolean;
  documentos_anexados?: DocumentoAnexado[] | null;
  fluxograma_data?: string | null;
}): boolean {
  if (typeof p.tem_fluxograma === "boolean") return p.tem_fluxograma;
  return !!getFluxograma(p).data;
}

/** Tem documento primário = anexo com tipo `PRI`. */
export function temDocumentoPrimario(p: {
  documentos_anexados?: DocumentoAnexado[] | null;
}): boolean {
  return (p.documentos_anexados || []).some((d) => d.tipo === "PRI");
}

/** Tem PDF de aprovação. Prefere o flag enxuto `tem_aprovacao`; cai para os dados completos. */
/** Aprovação de um comitê específico (se existe na lista). */
export function aprovacaoDoComite(
  p: { aprovacoes?: AprovacaoComite[] | null },
  comite: string,
): AprovacaoComite | undefined {
  return (p.aprovacoes || []).find((a) => a.comite === comite);
}

/**
 * Campos obrigatórios (mesma regra para "Enviar para Validação" e para virar Modelo K1).
 * Tudo é exigido EXCETO: Indicadores, Observações Gerais e os anexos (Documento Primário /
 * POP / MPS / fluxograma), que são opcionais.
 */
const CAMPOS_OBRIGATORIOS: Array<{
  key: keyof ProcessoNegocio;
  label: string;
  lista?: boolean;
}> = [
  { key: "macroprocesso", label: "Macroprocesso" },
  { key: "diretoria", label: "Área Responsável" },
  { key: "nome_processo", label: "Nome do processo" },
  { key: "periodo", label: "Data da Versão" },
  { key: "descricao", label: "Descrição do processo" },
  { key: "detalhamento", label: "Estrutura do processo" },
  { key: "proprietarios", label: "Responsável", lista: true },
  { key: "areas_responsaveis", label: "Áreas envolvidas", lista: true },
  { key: "entradas", label: "Entradas", lista: true },
  { key: "saidas", label: "Saídas", lista: true },
  { key: "sistemas_ferramentas", label: "Sistemas / Ferramentas", lista: true },
  {
    key: "normativos_referencias",
    label: "Normativos / Referências",
    lista: true,
  },
  { key: "numero_proad", label: "Nº do Proad" },
];

/** Lista (labels) dos campos obrigatórios ainda não preenchidos — vazia = tudo preenchido. */
export function camposObrigatoriosFaltantes(p: Partial<ProcessoNegocio>): string[] {
  const faltam: string[] = [];
  for (const c of CAMPOS_OBRIGATORIOS) {
    const v = p[c.key];
    const vazio = c.lista
      ? !Array.isArray(v) || v.length === 0
      : v == null || String(v).trim() === "";
    if (vazio) faltam.push(c.label);
  }
  return faltam;
}

/** Diretorias (siglas) que obrigam a indicação de comitês de aprovação para o envio. */
export const DIRETORIAS_COMITE_OBRIGATORIO = ["DITI", "DSTI", "GEJUT"];

/** True quando a área responsável exige indicação de comitês de aprovação. */
export function exigeComiteAprovacao(
  diretoria: string | null | undefined,
): boolean {
  if (!diretoria) return false;
  return DIRETORIAS_COMITE_OBRIGATORIO.includes(diretoria.trim().toUpperCase());
}

/**
 * Validação dos comitês para envio: retorna mensagem de erro quando a área responsável
 * exige comitês de aprovação (DITI, DSTI ou GEJUT) e nenhum foi indicado; senão null.
 */
export function validarComiteParaEnvio(
  p: Partial<ProcessoNegocio>,
): string | null {
  if (exigeComiteAprovacao(p.diretoria) && (p.apreciacao || []).length === 0) {
    return `A área responsável ${p.diretoria} exige a indicação de pelo menos um comitê de aprovação. Indique os comitês na seção "Apreciação em Instâncias Colegiadas" antes de enviar.`;
  }
  return null;
}

/**
 * Modelo K1: processo já PROMOVIDO (tem `codigo`/ID, gerado no 1º K1 e permanente) com todos os
 * campos obrigatórios preenchidos E todos os comitês exigidos aprovados (apreciação vazia ⇒ basta o
 * resto). O status transitório NÃO rebaixa o modelo: uma revisão volta o status a em_elaboracao e
 * gera nova versão, mas o processo segue sendo Modelo K1 enquanto mantiver ID + campos + aprovações.
 */
export function isK1(p: ProcessoNegocio): boolean {
  if (!p.codigo) return false;
  if (camposObrigatoriosFaltantes(p).length > 0) return false;
  const exigidos = p.apreciacao || [];
  const aprovados = p.aprovacoes || [];
  return exigidos.every((c) => aprovados.some((a) => a.comite === c));
}

/**
 * Vigente = em vigor AGORA. A regra depende do tipo de área (regras institucionais):
 *  - Áreas de TI (DITI/DSTI/GEJUT — {@link exigeComiteAprovacao}): vigente após a ata do comitê
 *    anexada + a data de aprovação preenchida, para TODOS os comitês exigidos.
 *  - Áreas judiciárias (DIJUD/DPE) e demais sem comitê: vigente após a validação do Compliance
 *    Officer (validado_final).
 *  - Documento primário: vigente pelo próprio anexo.
 * Em qualquer caso, só é vigente quando possui ID ({@code codigo}) e os campos obrigatórios.
 */
export function isVigente(p: ProcessoNegocio): boolean {
  if (temDocumentoPrimario(p)) return true;
  if (!p.codigo) return false; // regra: só é vigente quando possui um ID
  if (camposObrigatoriosFaltantes(p).length > 0) return false;
  if (exigeComiteAprovacao(p.diretoria)) {
    const exigidos = p.apreciacao || [];
    if (exigidos.length === 0) return !!p.validado_final_em;
    return exigidos.every((c) =>
      (p.aprovacoes || []).some((a) => a.comite === c && !!a.em),
    );
  }
  return !!p.validado_final_em;
}

/**
 * Data de aprovação que SUBSTITUI a "Data da Versão" e é a referência da Próxima Revisão:
 *  - TI (comitê): a data de aprovação do comitê (a mais recente entre os comitês exigidos);
 *  - Judiciário: a data de aprovação do Compliance Officer (validado_final);
 *  - Documento primário: o período informado.
 * Null quando o processo ainda não é vigente.
 */
export function dataVigencia(p: ProcessoNegocio): string | null {
  if (!isVigente(p)) return null;
  if (exigeComiteAprovacao(p.diretoria)) {
    const exigidos = p.apreciacao || [];
    const datas = (p.aprovacoes || [])
      .filter((a) => exigidos.includes(a.comite) && a.em)
      .map((a) => (a.em as string).substring(0, 10))
      .sort();
    if (datas.length) return datas[datas.length - 1];
  }
  if (p.validado_final_em) return p.validado_final_em.substring(0, 10);
  return p.periodo ? p.periodo.substring(0, 10) : null;
}

/** Próxima revisão = data de aprovação (Data da Vigência) + 1 ano. Null se não vigente/ inválida. */
export function proximaRevisao(p: ProcessoNegocio): Date | null {
  const base = dataVigencia(p);
  if (!base) return null;
  const m = base.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

/** Revisão vencida = próxima revisão no passado (só faz sentido para processo vigente). */
export function revisaoVencida(p: ProcessoNegocio): boolean {
  const next = proximaRevisao(p);
  return next != null && next.getTime() < Date.now();
}

/**
 * Revisão ou Novo = ainda não finalizado (status ≠ validado_final — ex.: em elaboração/revisão) OU
 * não é K1 completo OU está com a revisão vencida. Não é exclusivo de {@link isVigente}: um Modelo K1
 * em revisão aparece nas DUAS abas (vigente como modelo publicado; em revisão como versão em curso).
 */
export function isRevisaoOuNovo(p: ProcessoNegocio): boolean {
  return p.status !== "validado_final" || !isK1(p) || revisaoVencida(p);
}

/**
 * Responsável por um processo: área + cargo (camada 1 = área, camada 2 = cargo).
 * No PDF aparece apenas o cargo. Persistido no JSONB legado `proprietarios`.
 */
export interface ResponsavelEntry {
  area: string;
  cargo: string;
  /** Id da unidade do cadastro, preenchido quando a área é escolhida da lista (não digitada). */
  unidade_id?: number | null;
  /** Usuário responsável pela unidade — base do papel "Responsável do Processo". */
  responsavel_user_id?: number | null;
}

/** Normaliza uma entrada de responsável, tolerando dado legado (string = cargo). */
export function normalizeResponsavel(raw: unknown): ResponsavelEntry {
  if (typeof raw === "string") return { area: "", cargo: raw };
  if (raw && typeof raw === "object") {
    const r = raw as Record<string, unknown>;
    const toId = (v: unknown): number | null =>
      v == null || v === "" ? null : Number(v) || null;
    return {
      area: String(r.area ?? ""),
      cargo: String(r.cargo ?? ""),
      unidade_id: toId(r.unidade_id),
      responsavel_user_id: toId(r.responsavel_user_id),
    };
  }
  return { area: "", cargo: "" };
}

/**
 * user_ids dos responsáveis vinculados (entradas escolhidas da lista de unidades) de um processo.
 * Entradas digitadas livremente, sem unidade do cadastro, não entram aqui.
 */
export function responsaveisUserIds(
  p: Pick<ProcessoNegocio, "proprietarios">,
): number[] {
  const ids = (p.proprietarios || [])
    .map((r) => normalizeResponsavel(r).responsavel_user_id)
    .filter((v): v is number => typeof v === "number" && !Number.isNaN(v));
  return Array.from(new Set(ids));
}

/** True quando o usuário é Responsável do Processo (via unidade vinculada no campo Responsável). */
export function isResponsavel(
  p: Pick<ProcessoNegocio, "proprietarios">,
  userId?: number | string | null,
): boolean {
  if (userId == null) return false;
  const uid = Number(userId);
  if (Number.isNaN(uid)) return false;
  return responsaveisUserIds(p).includes(uid);
}

/** E-mails autorizados à validação final (camada 3 / Compliance Officer). */
export const COMPLIANCE_OFFICER_EMAILS = ["gmpdmaciel@tjgo.jus.br"];

/** True quando o e-mail é de um Compliance Officer (validador final / camada 3). */
export function isComplianceOfficerEmail(email?: string | null): boolean {
  if (!email) return false;
  return COMPLIANCE_OFFICER_EMAILS.includes(email.trim().toLowerCase());
}

/** Editor atribuído ao processo: usuário com permissão de editar/salvar o conteúdo. */
export interface Editor {
  user_id: number;
  nome?: string | null;
  email?: string | null;
}

/** True quando o usuário é um editor atribuído ao processo. */
export function isEditor(
  p: Pick<ProcessoNegocio, "editores">,
  userId?: number | string | null,
): boolean {
  if (userId == null) return false;
  const uid = Number(userId);
  if (Number.isNaN(uid)) return false;
  return (p.editores || []).some((e) => Number(e.user_id) === uid);
}

/** True quando o processo tem ao menos um Editor atribuído. */
export function temEditores(p: Pick<ProcessoNegocio, "editores">): boolean {
  return (p.editores || []).length > 0;
}

/** True quando o Editor atribuído sinalizou "Edição concluída" (edicao_concluida_em preenchido). */
export function edicaoConcluida(
  p: Pick<ProcessoNegocio, "edicao_concluida_em">,
): boolean {
  return !!p.edicao_concluida_em;
}

/**
 * O Responsável só pode validar a camada 1 quando NÃO há Editor atribuído, ou quando há e ele já
 * concluiu a edição. Enquanto houver editor preenchendo (não concluído), a validação fica bloqueada.
 */
export function responsavelPodeValidar(
  p: Pick<ProcessoNegocio, "editores" | "edicao_concluida_em">,
): boolean {
  return !temEditores(p) || edicaoConcluida(p);
}

/** Política de revisão exibida na coluna "Periodicidade" da seção Revisão. */
export const REVISAO_POLITICA_TEXTO =
  "A revisão do processo deverá ocorrer de forma ordinária, anualmente, ou de forma extraordinária, sempre que houver necessidade de atualização.";

/** Comitês que podem aprovar um processo (Modelo K1). Chave = sigla persistida. */
export const COMITES_APROVACAO: Record<string, string> = {
  CGTIC: "Comitê Gestor de Tecnologia da Informação e Comunicação",
  CGovTIC: "Comitê de Governança de Tecnologia da Informação e Comunicação",
};

export interface ProcessoNegocio {
  id: number;
  /** ID do processo (PN_{macroArea}_{diretoria}_{seq}), gerado no 1º Modelo K1; null antes disso. */
  codigo: string | null;
  macroprocesso: string;
  diretoria: string;
  periodo: string | null;
  revisao: string | null;
  codigo_versao: string | null;
  nome_processo: string;
  descricao: string | null;
  detalhamento: string | null;
  /** Indicadores de desempenho/resultado do processo (texto livre). */
  indicadores: string | null;
  /** Responsáveis (área + cargo). Coluna JSONB historicamente chamada `proprietarios`. */
  proprietarios: ResponsavelEntry[];
  /** Editores atribuídos: usuários com permissão de editar/salvar o conteúdo do processo. */
  editores: Editor[];
  atores: string[];
  areas_responsaveis: string[];
  entradas: string[];
  saidas: string[];
  sistemas_ferramentas: string[];
  normativos_referencias: string[];
  fluxograma_data: string | null;
  fluxograma_filename: string | null;
  fluxograma_mime: string | null;
  documentos_anexados: DocumentoAnexado[];
  /**
   * Apreciação: comitês exigidos para aprovar este processo (siglas). Vazio = não passa por comitê.
   * Definido no cadastro. Junto com {@link aprovacoes} e o status, determina o Modelo K1.
   */
  apreciacao: string[];
  /** Aprovações por comitê (uma por comitê). Na listagem vem sem os bytes do PDF. */
  aprovacoes: AprovacaoComite[];
  /** @deprecated colunas de aprovação única (legado, sempre null) — ver {@link aprovacoes}. */
  aprovacao_data?: string | null;
  aprovacao_filename?: string | null;
  aprovacao_mime?: string | null;
  aprovacao_em?: string | null;
  aprovacao_comite?: string | null;
  /**
   * Presentes apenas no payload da listagem (getAll), que vem enxuto sem os bytes base64.
   * `tem_fluxograma`: tem fluxograma (legado ou doc tipo FLUXOGRAMA); `tem_aprovacao`: tem PDF de aprovação.
   * No detalhe (getById) vêm undefined — use {@link getFluxograma}/{@link isK1} a partir dos dados completos.
   */
  tem_fluxograma?: boolean;
  tem_aprovacao?: boolean;
  periodicidade_revisao: string | null;
  numero_proad: string | null;
  observacoes_gerais: string | null;
  versao: string;
  status: ProcessoStatus;
  validado_autor_user_id: number | null;
  validado_autor_nome: string | null;
  validado_autor_em: string | null;
  validado_diretoria_user_id: number | null;
  validado_diretoria_nome: string | null;
  validado_diretoria_em: string | null;
  validado_final_user_id: number | null;
  validado_final_nome: string | null;
  validado_final_em: string | null;
  /** Sinal "Edição concluída" do Editor atribuído (nulo = pendente/em andamento). */
  edicao_concluida_em: string | null;
  edicao_concluida_por_user_id: number | null;
  edicao_concluida_por_nome: string | null;
  recusado_em: string | null;
  recusado_por_user_id: number | null;
  recusado_por_nome: string | null;
  recusado_camada: "autor" | "diretoria" | "final" | null;
  recusa_motivo: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
  /** Código de validação de autenticidade (12 dígitos), presente no getById/validação. */
  codigo_validacao?: string | null;
}

export interface CreateProcessoNegocioDto {
  macroprocesso: string;
  diretoria: string;
  periodo?: string | null;
  revisao?: string | null;
  codigo_versao?: string | null;
  nome_processo: string;
  descricao?: string | null;
  detalhamento?: string | null;
  indicadores?: string | null;
  proprietarios?: ResponsavelEntry[];
  atores?: string[];
  areas_responsaveis?: string[];
  entradas?: string[];
  saidas?: string[];
  sistemas_ferramentas?: string[];
  normativos_referencias?: string[];
  fluxograma_data?: string | null;
  fluxograma_filename?: string | null;
  fluxograma_mime?: string | null;
  documentos_anexados?: DocumentoAnexado[];
  /** Comitês exigidos para aprovação (siglas). Vazio = não passa por comitê. */
  apreciacao?: string[];
  periodicidade_revisao?: string | null;
  numero_proad?: string | null;
  observacoes_gerais?: string | null;
  /**
   * Versão (inteiro). Enviada manualmente apenas quando há documento primário anexado
   * (o processo pode já estar na 9ª versão, p.ex.). Sem documento primário, a versão é
   * gerida automaticamente pelo backend (inicia em 1 e incrementa a cada homologação).
   */
  versao?: string | null;
}

export type UpdateProcessoNegocioDto = Partial<CreateProcessoNegocioDto>;

const BASE = "/api/processos-negocio";

// ============================================================
// API
// ============================================================

export const processosNegocioApi = {
  getAll(diretoria?: string): Promise<ProcessoNegocio[]> {
    const url = diretoria
      ? `${BASE}?diretoria=${encodeURIComponent(diretoria)}`
      : BASE;
    return apiClient.request<ProcessoNegocio[]>(url);
  },

  getById(id: number): Promise<ProcessoNegocio> {
    return apiClient.request<ProcessoNegocio>(`${BASE}/${id}`);
  },

  /**
   * Valida a autenticidade de um documento pelo código impresso no PDF. Exige login (o backend
   * checa a autenticação). Resolve para o processo se o código for válido e o documento tiver
   * passado por todas as camadas de validação; rejeita (404) caso contrário.
   */
  validarPorCodigo(codigo: string): Promise<ProcessoNegocio> {
    return apiClient.request<ProcessoNegocio>(
      `${BASE}/validacao/${encodeURIComponent(codigo.replace(/\D/g, ""))}`,
    );
  },

  create(data: CreateProcessoNegocioDto): Promise<ProcessoNegocio> {
    return apiClient.post<ProcessoNegocio>(BASE, data);
  },

  update(id: number, data: UpdateProcessoNegocioDto): Promise<ProcessoNegocio> {
    return apiClient.put<ProcessoNegocio>(`${BASE}/${id}`, data);
  },

  enviar(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/enviar`);
  },

  /** Reabre um processo vigente (K1) para revisão antecipada (volta para 'em_elaboracao'). */
  iniciarRevisao(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/iniciar-revisao`);
  },

  /** Editor atribuído sinaliza que terminou a versão completa (libera o Responsável a validar). */
  concluirEdicao(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/concluir-edicao`);
  },

  /** Atribui um editor (usuário com permissão de editar/salvar o conteúdo do processo). */
  adicionarEditor(id: number, userId: number): Promise<ProcessoNegocio> {
    return apiClient.post<ProcessoNegocio>(`${BASE}/${id}/editores`, {
      user_id: userId,
    });
  },

  /** Remove um editor do processo. */
  removerEditor(id: number, userId: number): Promise<ProcessoNegocio> {
    return apiClient.delete<ProcessoNegocio>(`${BASE}/${id}/editores/${userId}`);
  },

  validarAutor(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/validar-autor`);
  },

  validarDiretoria(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/validar-diretoria`);
  },

  validarFinal(id: number): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/validar-final`);
  },

  recusar(
    id: number,
    camada: "autor" | "diretoria" | "final",
    motivo: string,
  ): Promise<ProcessoNegocio> {
    return apiClient.patch<ProcessoNegocio>(`${BASE}/${id}/recusar`, {
      camada,
      motivo,
    });
  },

  remove(id: number): Promise<void> {
    return apiClient.delete(`${BASE}/${id}`);
  },

  /** Anexa o PDF de aprovação (Modelo K1). Restrito a superadmin no backend. */
  setAprovacao(
    id: number,
    data: {
      aprovacao_data: string;
      aprovacao_filename: string;
      aprovacao_mime: string;
      aprovacao_em: string;
      aprovacao_comite: string;
    },
  ): Promise<ProcessoNegocio> {
    return apiClient.put<ProcessoNegocio>(`${BASE}/${id}/aprovacao`, data);
  },

  /** Remove a aprovação de um comitê específico. Restrito a superadmin no backend. */
  removeAprovacao(id: number, comite: string): Promise<ProcessoNegocio> {
    return apiClient.delete<ProcessoNegocio>(
      `${BASE}/${id}/aprovacao?comite=${encodeURIComponent(comite)}`,
    );
  },

  /** Lista as versões homologadas (snapshots) de um processo */
  listVersoes(id: number): Promise<VersaoHistorico[]> {
    return apiClient.request<VersaoHistorico[]>(`${BASE}/${id}/versoes`);
  },

  /** Retorna o snapshot completo de uma versão específica */
  getVersaoSnapshot(id: number, historicoId: number): Promise<ProcessoNegocio> {
    return apiClient.request<ProcessoNegocio>(
      `${BASE}/${id}/versoes/${historicoId}`,
    );
  },
};

// ============================================================
// HELPERS
// ============================================================

export const STATUS_LABEL: Record<ProcessoStatus, string> = {
  em_elaboracao: "Em elaboração",
  enviado: "Aguardando validação do autor",
  validado_autor: "Aguardando validação da diretoria",
  validado_diretoria: "Aguardando validação final",
  validado_final: "Homologado",
  recusado: "Recusado",
};

export const STATUS_COLOR: Record<ProcessoStatus, string> = {
  em_elaboracao: "bg-slate-100 text-slate-700 border-slate-200",
  enviado: "bg-amber-50 text-amber-700 border-amber-200",
  validado_autor: "bg-blue-50 text-blue-700 border-blue-200",
  validado_diretoria: "bg-indigo-50 text-indigo-700 border-indigo-200",
  validado_final: "bg-emerald-50 text-emerald-700 border-emerald-200",
  recusado: "bg-red-50 text-red-700 border-red-200",
};
