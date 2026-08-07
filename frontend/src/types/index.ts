// Tipos de usuário e autenticação
export type UserRole = "VIEWER" | "MANAGER" | "ADMIN";

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  status: "ACTIVE" | "INACTIVE";
  diretoria?: Directorate;
  cadastrosAreasId?: number | null;
  cadastrosUnidadesId?: number | null;
  areaSigla?: string | null;
  unidadeSigla?: string | null;
  areaFormatada?: string | null;
  unidadeFormatada?: string | null;
  dominio?: string;
  is_domain_root?: boolean;
  password?: string;
  // Campos de perfil pessoal — preenchidos pelo próprio usuário em /perfil
  matricula?: string | null;
  cargo_funcao?: string | null;
  situacao_funcional?: string | null;
  classe_efetivo?: string | null;
  cargo_efetivo?: string | null;
  cc_fc?: string | null;
  nome_cc_fc?: string | null;
  classe_cc_fc?: string | null;
  foto_perfil?: string | null;
  unidade_lotacao?: string | null;
  unidade_nome?: string | null;
  // Cargo efetivo e código (cc_fc_classe — "Código" da tabela do painel) — só vem de GET /me/perfil
  cc_fc_classe?: string | null;
  codigo?: string | null;
  is_developer?: boolean;
  // Camada D — tags de Permissão de Ação concedidas (Ciclo Orçamentário)
  tags_acesso?: string[];
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  setUser: (user: User | null) => void;
}

// Tipos de Diretoria - Agora dinâmico, carregado de cadastros_areas
export type Directorate = string;

export interface DirectorateInfo {
  id: number;
  code: string;
  name: string;
  description?: string | null;
  proad_link?: string | null;
}

// Tipos de Gestão Estratégica
export type OKRStatus = "CONCLUIDO" | "EM_ANDAMENTO" | "NAO_INICIADO";
export type OKRSituation = "NO_PRAZO" | "EM_ATRASO" | "FINALIZADO";
export type BoardStatus = "A_FAZER" | "FAZENDO" | "FEITO";
export type InitiativeLocation =
  | "BACKLOG"
  | "EM_FILA"
  | "SPRINT_ATUAL"
  | "FORA_SPRINT"
  | "CONCLUIDA";
export type Priority = "SIM" | "NAO";
export type ExecutionProgress = "FAZENDO" | "FEITO" | "A_FAZER";

export interface Objective {
  id: string;
  code: string;
  title: string;
  description: string;
  diretoria: string;
  cadastrosAreasId?: number | string | null;
  area?: { sigla: string; nome: string };
}

export interface KeyResult {
  id: string;
  objectiveId: string;
  code: string;
  description: string;
  status: OKRStatus;
  situation: OKRSituation;
  deadline: string;
  diretoria: string;
  cadastrosAreasId?: number | string | null;
  area?: { sigla: string; nome: string };
}

export interface Initiative {
  id: string;
  keyResultId: string;
  title: string;
  description: string;
  boardStatus: BoardStatus;
  location: InitiativeLocation;
  sprintId?: string;
  diretoria: string;
}

// Novo tipo para Controle de Execução
export interface ExecutionControl {
  id: string;
  planProgram: string;
  krProjectInitiative: string;
  backlogTasks: string;
  sprintStatus: InitiativeLocation;
  sprintTasks: string;
  progress: ExecutionProgress;
  diretoria: string;
  ordemLinha?: number;
  ordemPosicao?: number;
}

export interface Program {
  id: string;
  name: string;
  description: string;
  diretoria: string;
}

export interface ProgramInitiative {
  id: string;
  programId: string;
  title: string;
  description: string;
  boardStatus: BoardStatus;
  priority: Priority;
  diretoria: string;
}

// Tipos para estatísticas dos dashboards
export interface OKRStats {
  total: number;
  concluido: number;
  emAndamento: number;
  aIniciar: number;
  progresso: number;
}

export interface SprintStats {
  backlog: number;
  emFila: number;
  concluido: number;
  sprintAtual: number;
  progresso: number;
}

export interface ChartData {
  name: string;
  concluido?: number;
  emAndamento?: number;
  naoIniciado?: number;
  value?: number;
  [key: string]: string | number | undefined;
}

// Tipos para o módulo de Pessoas (Formulários)
export type FormStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";
export type ResponseStatus = "DRAFT" | "SUBMITTED";

export type FieldType =
  | "SHORT_TEXT"
  | "LONG_TEXT"
  | "MULTIPLE_CHOICE"
  | "CHECKBOXES"
  | "SCALE"
  | "DATE"
  | "NUMBER"
  | "DROPDOWN";

export interface FormFieldOption {
  id: string;
  label: string;
  value: string;
}

export interface FormFieldConfig {
  options?: FormFieldOption[];
  minValue?: number;
  maxValue?: number;
  minLabel?: string;
  maxLabel?: string;
  placeholder?: string;
}

export interface FormField {
  id: string;
  formId: string;
  sectionId?: string;
  type: FieldType;
  label: string;
  helpText?: string;
  required: boolean;
  order: number;
  config?: FormFieldConfig;
}

export interface FormSection {
  id: string;
  formId: string;
  title: string;
  description?: string;
  order: number;
}

export interface Form {
  id: string;
  title: string;
  description?: string;
  status: FormStatus;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  directorate?: Directorate;
  allowedDirectorates?: (Directorate | "ALL")[];
}

export interface FormResponse {
  id: string;
  formId: string;
  userId: string;
  userName: string;
  status: ResponseStatus;
  submittedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface FormAnswer {
  id: string;
  responseId: string;
  fieldId: string;
  value: string | string[] | number;
}

export interface FormWithDetails extends Form {
  sections: FormSection[];
  fields: FormField[];
  responseCount?: number;
}

export interface ResponseWithAnswers extends FormResponse {
  answers: FormAnswer[];
}

// ============================================================
// Tipos para o módulo de Contratações de TI (PCA)
// ============================================================

export type PcaStatus = "Concluída" | "Em andamento" | "Não Iniciada";

export type PcaTipo = "Contratação" | "Renovação";

export interface PcaItem {
  id: number;
  itemPca: string;
  tipo: string;
  cadastrosAreasId?: number | null;
  cadastrosUnidadesId?: number | null;
  areaSigla?: string | null;
  areaNome?: string | null;
  unidadeSigla?: string | null;
  unidadeNome?: string | null;
  objeto: string;
  valor_estimado: number;
  valor_formalizado: number | null;
  data_estimada_contratacao: string;
  status: PcaStatus | string | number;
  ano: number;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  contract_ids?: string;

  // Novos campos do domínio Pca.java
  code?: string;
  year?: string;
  description?: string;
  justification?: string;
  process?: string;
  financial_resource_type?: string;
  contract_type?: string;
  object_name?: string;

  estimated_value_cents?: number;
  priority?: string;
  step?: string;
  estimated_date?: string;

  // RF-55 — rastreabilidade ao ciclo de origem (Formação/Revisão) e ao PROAD de instrução.
  origem_ciclo_id?: number | null;
  origem_proad?: string | null;
  origem_finalidade?: string | null;
}

export interface CreatePcaItemDto {
  item_pca: string;
  tipo: string;
  cadastrosAreasId?: number | null;
  cadastrosUnidadesId?: number | null;
  areaSigla?: string | null;
  areaNome?: string | null;
  unidadeSigla?: string | null;
  unidadeNome?: string | null;
  objeto: string;
  valor_estimado: number;
  valor_formalizado?: number;
  data_estimada_contratacao: string;
  status?: PcaStatus | string | number;
  ano?: number;
  description?: string;
  justification?: string;
  process?: string;
  financial_resource_type?: string;
  priority?: string;
  step?: string;
}

export interface UpdatePcaItemDto {
  item_pca?: string;
  tipo?: PcaTipo | string;
  cadastrosAreasId?: number | null;
  cadastrosUnidadesId?: number | null;
  areaSigla?: string | null;
  areaNome?: string | null;
  unidadeSigla?: string | null;
  unidadeNome?: string | null;
  objeto?: string;
  valor_estimado?: number;
  valor_formalizado?: number;
  data_estimada_contratacao?: string;
  status?: PcaStatus | string | number;
  ano?: number;
  description?: string;
  justification?: string;
  process?: string;
  financial_resource_type?: string;
  priority?: string;
  step?: string;
}

export interface PcaStats {
  total: number;
  valorTotal: number;
  concluidos: number;
  emAndamento: number;
  naoIniciados: number;
}

export interface PcaFilters {
  areasDemandantes: string[];
  meses: string[];
  statusOptions: PcaStatus[];
}

// Constantes para meses ordenados
export const MESES_ORDENADOS = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

// ============================================================
// Tipos para Detalhes do Item PCA
// ============================================================

export type ValidacaoDgTipo = "Pendente" | "Data";
export type ChecklistStatus = "Concluída" | "Em andamento" | "Não Iniciada";
export type TarefaStatus = "Não iniciada" | "Em andamento" | "Concluída";

export interface PcaItemDetails {
  id: number;
  pcas_id: number;
  validacao_dg_tipo: ValidacaoDgTipo;
  validacao_dg_data: string | null;
  fase_atual: string | null;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
}

export interface PcaChecklistItem {
  id: number;
  pcas_id: number;
  item_nome: string;
  item_ordem: number;
  status: ChecklistStatus;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
}

export interface PcaChecklistProgress {
  total: number;
  concluidos: number;
  percentual: number;
}

export interface PcaChecklistResponse {
  items: PcaChecklistItem[];
  progress: PcaChecklistProgress;
}

export interface PcaPontoControle {
  id: number;
  pcas_id: number;
  ponto_controle: string;
  data: string;
  proxima_reuniao: string;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface PcaTarefa {
  id: number;
  pcas_id: number;
  ponto_controle_id: number | null;
  tarefa: string;
  responsavel: string;
  prazo: string;
  status: TarefaStatus;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

// Ponto de Controle com tarefas aninhadas
export interface PcaPontoControleComTarefas extends PcaPontoControle {
  tarefas: PcaTarefa[];
}

// DTOs para criação/atualização
export interface UpdatePcaDetailsDto {
  validacao_dg_tipo?: ValidacaoDgTipo;
  validacao_dg_data?: string | null;
  fase_atual?: string | null;
}

export interface CreatePontoControleDto {
  ponto_controle: string;
  data: string;
  proxima_reuniao: string;
}

export interface UpdatePontoControleDto {
  ponto_controle?: string;
  data?: string;
  proxima_reuniao?: string;
}

export interface CreateTarefaDto {
  tarefa: string;
  responsavel: string;
  prazo: string;
  status?: TarefaStatus;
  ponto_controle_id?: number | null;
}

export interface UpdateTarefaDto {
  tarefa?: string;
  ponto_controle_id?: number | null;
  responsavel?: string;
  prazo?: string;
  status?: TarefaStatus;
}

// Resposta completa dos detalhes de um item PCA
export interface PcaItemAllDetails {
  pcaItem: PcaItem;
  details: PcaItemDetails | null;
  checklist: PcaChecklistItem[];
  checklistProgress: PcaChecklistProgress;
  pontosControle: PcaPontoControle[];
  pontosControleComTarefas: PcaPontoControleComTarefas[];
  tarefas: PcaTarefa[];
  tarefasOrfas: PcaTarefa[];
}

// ============================================================
// Tipos para Salvamento em Lote
// ============================================================

export interface SaveAllChangesRequest {
  details?: {
    validacao_dg_tipo?: ValidacaoDgTipo;
    validacao_dg_data?: string | null;
    fase_atual?: string | null;
  };
  checklist_updates?: Array<{ id: number; status: ChecklistStatus }>;
  tarefas_updates?: Array<{ id: number; status: TarefaStatus }>;
}

export interface SaveAllChangesResponse {
  success: boolean;
  message: string;
  saved_count: {
    details: number;
    checklist: number;
    tarefas: number;
  };
  error?: string;
}

// ============================================================
// Tipos para Renovações PCA
// ============================================================

export interface PcaRenovacao {
  id: number;
  item_pca: string;
  area_demandante: string;
  gestor_demandante: string;
  contratada: string;
  objeto: string;
  valor_anual: number;
  data_estimada_contratacao: string;
  status: PcaStatus;
  is_deleted: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface CreateRenovacaoDto {
  item_pca: string;
  area_demandante: string;
  gestor_demandante: string;
  contratada: string;
  objeto: string;
  valor_anual: number;
  data_estimada_contratacao: string;
  status?: PcaStatus;
}

export interface UpdateRenovacaoDto {
  item_pca?: string;
  area_demandante?: string;
  gestor_demandante?: string;
  contratada?: string;
  objeto?: string;
  valor_anual?: number;
  data_estimada_contratacao?: string;
  status?: PcaStatus;
}

export interface RenovacaoStats {
  total: number;
  valorTotal: number;
  concluidos: number;
  emAndamento: number;
  naoIniciados: number;
}

export interface RenovacaoResumo {
  cadastrosAreasId?: number | null;
  cadastrosUnidadesId?: number | null;
  areaSigla?: string | null;
  areaNome?: string | null;
  unidadeSigla?: string | null;
  unidadeNome?: string | null;
  total: number;
  valor_total: number;
  por_status: { [key: string]: number };
  por_area: { [key: string]: { quantidade: number; valor: number } };
  por_mes: { [key: string]: number };
}

export interface RenovacaoFilters {
  areasDemandantes: string[];
  gestores: string[];
  meses: string[];
}

// Tipos para detalhes de renovação
export interface RenovacaoDetails {
  id: number;
  renovacao_id: number;
  validacao_dg_tipo: ValidacaoDgTipo;
  validacao_dg_data: string | null;
  fase_atual: string | null;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
}

export interface RenovacaoChecklistItem {
  id: number;
  renovacao_id: number;
  item_nome: string;
  item_ordem: number;
  status: ChecklistStatus;
  created_at: string;
  updated_at: string;
  updated_by: number | null;
}

export interface RenovacaoPontoControle {
  id: number;
  renovacao_id: number;
  ponto_controle: string;
  data: string;
  proxima_reuniao: string;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface RenovacaoTarefa {
  id: number;
  renovacao_id: number;
  ponto_controle_id: number | null;
  tarefa: string;
  responsavel: string;
  prazo: string;
  status: TarefaStatus;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface RenovacaoPontoControleComTarefas extends RenovacaoPontoControle {
  tarefas: RenovacaoTarefa[];
}

export interface RenovacaoAllDetails {
  renovacao: PcaRenovacao;
  details: RenovacaoDetails | null;
  checklist: RenovacaoChecklistItem[];
  checklistProgress: number;
  pontosControle: RenovacaoPontoControle[];
  pontosControleComTarefas: RenovacaoPontoControleComTarefas[];
  tarefas: RenovacaoTarefa[];
  tarefasOrfas: RenovacaoTarefa[];
}

export interface SaveRenovacaoChangesRequest {
  details?: {
    validacao_dg_tipo?: ValidacaoDgTipo;
    validacao_dg_data?: string | null;
    fase_atual?: string | null;
  };
  checklist_updates?: Array<{ id: number; status: ChecklistStatus }>;
  tarefas_updates?: Array<{
    id: number;
    status: TarefaStatus;
    ponto_controle_id?: number | null;
  }>;
}

// ============================================================
// TIPOS DE COMITÊS
// ============================================================

export interface Comite {
  id: number;
  nome: string;
  sigla: string;
  descricao: string | null;
  icone: string | null;
  cor: string;
  ordem: number;
  ativo: boolean;
  dominio: string;
  created_at: string;
  updated_at: string;
}

export interface ComiteMembro {
  id: number;
  comite_id: number;
  nome: string;
  cargo: string;
  ordem: number;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export type ReuniaoStatus = "Previsto" | "Realizada" | "Cancelada";

export type TipoReuniao = "Ordinária" | "Extraordinária";

export interface ComiteReuniao {
  id: number;
  comite_id: number;
  numero: number;
  ano: number;
  data: string;
  mes: string | null;
  status: ReuniaoStatus;
  tipo_reuniao: TipoReuniao;
  titulo: string | null;
  observacoes: string | null;
  link_proad: string | null;
  link_transparencia: string | null;
  link_ata: string | null;
  // Campos de ata (PDF upload)
  ata_filename: string | null;
  ata_filepath: string | null;
  ata_filesize: number | null;
  ata_uploaded_at: string | null;
  ata_uploaded_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface AtaInfo {
  has_ata: boolean;
  filename?: string;
  filesize?: number;
  uploaded_at?: string;
  error?: string;
}

export interface UploadAtaResponse {
  message: string;
  filename: string;
  filesize: number;
  uploaded_at: string;
}

export interface ComiteReuniaoPauta {
  id: number;
  reuniao_id: number;
  numero_item: number;
  descricao: string;
  ordem: number;
  created_at: string;
  updated_at: string;
}

export type QuadroControleStatus = "Andamento" | "Concluída" | "Cancelada";

export interface ComiteQuadroControle {
  id: number;
  comite_id: number;
  item: string; // Ação - demanda estabelecida em reunião
  reuniao_id: number | null; // ID da reunião que determinou a ação
  reuniao_numero?: number; // Número da reunião (para exibição)
  reuniao_ano?: number; // Ano da reunião (para exibição)
  reuniao_data?: string; // Data da reunião (para exibição)
  item_pauta_id: number | null; // Item da pauta relacionado
  item_pauta_numero?: number; // Número do item da pauta (para exibição)
  item_pauta_descricao?: string; // Descrição do item da pauta (para exibição)
  discussao_contexto: string | null;
  deliberacao: string | null;
  decisao_encaminhamento: string | null;
  acoes_atividades: string | null;
  responsavel: string | null; // Responsáveis pela ação
  prazo: string | null; // Data para entrega
  observacoes: string | null;
  status: QuadroControleStatus;
  ordem: number;
  created_at: string;
  updated_at: string;
}

// DTOs de Comitês
export interface UpdateComiteDto {
  nome?: string;
  descricao?: string;
  icone?: string;
  cor?: string;
  ordem?: number;
}

export interface CreateMembroDto {
  nome: string;
  cargo: string;
  ordem?: number;
}

export interface UpdateMembroDto {
  nome?: string;
  cargo?: string;
  ordem?: number;
}

export interface CreateReuniaoDto {
  numero: number;
  ano: number;
  data: string;
  mes?: string;
  status?: ReuniaoStatus;
  titulo?: string;
  observacoes?: string;
  link_proad?: string;
  link_transparencia?: string;
  link_ata?: string;
}

export interface UpdateReuniaoDto {
  numero?: number;
  ano?: number;
  data?: string;
  mes?: string;
  status?: ReuniaoStatus;
  titulo?: string;
  observacoes?: string;
  link_proad?: string;
  link_transparencia?: string;
  link_ata?: string;
}

export interface CreatePautaDto {
  numero_item: number;
  descricao: string;
  ordem?: number;
}

export interface UpdatePautaDto {
  numero_item?: number;
  descricao?: string;
  ordem?: number;
}

export interface CreateQuadroControleDto {
  item: string;
  discussao_contexto?: string;
  deliberacao?: string;
  decisao_encaminhamento?: string;
  acoes_atividades?: string;
  responsavel?: string;
  prazo?: string;
  observacoes?: string;
  status?: QuadroControleStatus;
  ordem?: number;
}

export interface UpdateQuadroControleDto {
  item?: string;
  discussao_contexto?: string;
  deliberacao?: string;
  decisao_encaminhamento?: string;
  acoes_atividades?: string;
  responsavel?: string;
  prazo?: string;
  observacoes?: string;
  status?: QuadroControleStatus;
  ordem?: number;
}

// ============================================================
// TIPOS PARA GESTÃO ESTRATÉGICA HIERÁRQUICA
// ============================================================

export type GestaoTarefaStatus = "sprint_atual" | "fora_sprint" | "concluida";
export type GestaoTarefaProgresso = "a_fazer" | "fazendo" | "feito";

export interface PlanoPrograma {
  id: number;
  nome: string;
  cadastros_areas_id: number;
  tipo: "plano" | "programa";
  ativo: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
  is_instrumento?: boolean;
}

export interface KrProjeto {
  id: number;
  nome: string;
  plano_id: number | null;
  plano_nome?: string;
  instrumento_id?: number | null;
  instrumento_nome?: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface GestaoTarefa {
  id: number;
  nome: string;
  projeto_id: number;
  projeto_nome?: string;
  status: GestaoTarefaStatus;
  progresso: GestaoTarefaProgresso;
  ativo: boolean;
  created_at: string;
  updated_at: string;
  created_by: number | null;
  updated_by: number | null;
}

export interface ProjetoEstatisticas {
  total: number;
  backlog: number;
  concluido: number;
  a_fazer: number;
  fazendo: number;
  progresso_concluido: number;
  percentual_concluido: number;
}

export interface ProjetoComTarefas extends KrProjeto {
  tarefas: GestaoTarefa[];
  estatisticas: ProjetoEstatisticas;
}

export interface PlanoComProjetos extends PlanoPrograma {
  projetos: ProjetoComTarefas[];
}

export interface CreatePlanoDto {
  nome: string;
  cadastrosAreasId?: number;
}

export interface UpdatePlanoDto {
  nome?: string;
  cadastrosAreasId?: number;
}

export interface CreateProjetoDto {
  nome: string;
  plano_id?: number | null;
  instrumento_id?: number | null;
}

export interface UpdateProjetoDto {
  nome?: string;
}

export interface CreateGestaoTarefaDto {
  nome: string;
  projeto_id: number;
}

export interface UpdateGestaoTarefaDto {
  nome?: string;
  status?: GestaoTarefaStatus;
  progresso?: GestaoTarefaProgresso;
}

export interface EstatisticasDiretoria {
  total_planos: number;
  total_projetos: number;
  total_tarefas: number;
  tarefas_por_status: { backlog: number; concluido: number };
  tarefas_por_progresso: {
    a_fazer: number;
    fazendo: number;
    concluido: number;
  };
}

// ============================================================
// Tipos para Contratos
// ============================================================

export interface Contract {
  id: number;
  contractPlanId?: number;
  baseContractId?: number;
  supplier?: string;
  contractModel?: string;
  process?: string;
  expenseNature?: string;
  startDate: string;
  endDate: string;
  effectiveDate?: string;
  limitDate?: string;
  yearDurationStandard?: number;
  linkedIfoCodigo?: string;
  contractType?: string;
  situation?: string;
  additiveTermType?: number;
  objectName?: string;
  description?: string;
  noticeNumber?: string;
  effectiveAdditiveTerm?: number;
  totalValueCents?: number;
  totalValueCurrency?: string;
  monthlyValueCents?: number;
  monthlyValueCurrency?: string;
  yearValue?: number;
  cadastroAreaId?: number;
  cadastroUnidadeId?: number;
  areaSigla?: string | null;
  areaNome?: string | null;
  unidadeSigla?: string | null;
  unidadeNome?: string | null;
  contractMembersId?: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: number;
  updatedBy?: number;
  isDeleted?: boolean;
  deletedAt?: string;
  deletedBy?: number;
}
