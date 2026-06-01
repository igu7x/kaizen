/**
 * API de Detalhes do Item PCA
 * 
 * Este arquivo fornece funções para comunicação com os endpoints de detalhes do PCA.
 */

import { 
  PcaItemDetails,
  PcaChecklistItem,
    PcaChecklistResponse,
  PcaChecklistProgress,
  PcaPontoControle,
  PcaTarefa,
    PcaItemAllDetails,
  UpdatePcaDetailsDto,
  CreatePontoControleDto,
  UpdatePontoControleDto,
  CreateTarefaDto,
  UpdateTarefaDto,
  ChecklistStatus,
    TarefaStatus,
    SaveAllChangesRequest,
    SaveAllChangesResponse
} from '@/types';
import { apiClient } from './apiClient';
import Storage from '@/utils/storage';
import { User } from '@/types';

/**
 * Helper para obter headers com informações do usuário
 */
function getUserHeaders(): Record<string, string> {
    const user = Storage.load<User | null>('user', null);
    if (user) {
        return {
            'x-user-id': String(user.id),
            'x-user-role': user.role
        };
    }
    return {};
}

// ============================================================
// DETALHES (Campos Estáticos)
// ============================================================

/**
 * Buscar todos os detalhes de um item PCA
 */
export async function getPcaItemAllDetails(pcaItemId: number): Promise<PcaItemAllDetails> {
    return apiClient.get<PcaItemAllDetails>(`/api/pca-items/${pcaItemId}/all-details`, {
        headers: getUserHeaders()
    });
}

/**
 * Buscar detalhes estáticos (Validação DG e Fase Atual)
 */
export async function getPcaItemDetails(pcaItemId: number): Promise<PcaItemDetails> {
    return apiClient.get<PcaItemDetails>(`/api/pca-items/${pcaItemId}/details`, {
        headers: getUserHeaders()
    });
}

/**
 * Atualizar detalhes estáticos
 */
export async function updatePcaItemDetails(pcaItemId: number, data: UpdatePcaDetailsDto): Promise<PcaItemDetails> {
    return apiClient.put<PcaItemDetails>(`/api/pca-items/${pcaItemId}/details`, data, {
        headers: getUserHeaders()
    });
}

// ============================================================
// CHECKLIST
// ============================================================

/**
 * Buscar checklist de um item PCA
 */
export async function getPcaChecklist(pcaItemId: number): Promise<PcaChecklistResponse> {
    return apiClient.get<PcaChecklistResponse>(`/api/pca-items/${pcaItemId}/checklist`, {
        headers: getUserHeaders()
    });
}

/**
 * Atualizar status de um item do checklist
 */
export async function updateChecklistItemStatus(
    pcaItemId: number, 
    checklistId: number, 
    status: ChecklistStatus
): Promise<{ item: PcaChecklistItem; progress: PcaChecklistProgress }> {
    return apiClient.patch<{ item: PcaChecklistItem; progress: PcaChecklistProgress }>(
        `/api/pca-items/${pcaItemId}/checklist/${checklistId}/status`, 
        { status }, 
        { headers: getUserHeaders() }
    );
}

// ============================================================
// PONTOS DE CONTROLE
// ============================================================

/**
 * Buscar pontos de controle de um item PCA
 */
export async function getPontosControle(pcaItemId: number): Promise<PcaPontoControle[]> {
    return apiClient.get<PcaPontoControle[]>(`/api/pca-items/${pcaItemId}/pontos-controle`, {
        headers: getUserHeaders()
    });
}

/**
 * Criar novo ponto de controle
 */
export async function createPontoControle(pcaItemId: number, data: CreatePontoControleDto): Promise<PcaPontoControle> {
    return apiClient.post<PcaPontoControle>(`/api/pca-items/${pcaItemId}/pontos-controle`, data, {
        headers: getUserHeaders()
    });
}

/**
 * Atualizar ponto de controle
 */
export async function updatePontoControle(
    pcaItemId: number, 
    pontoId: number, 
    data: UpdatePontoControleDto
): Promise<PcaPontoControle> {
    return apiClient.put<PcaPontoControle>(`/api/pca-items/${pcaItemId}/pontos-controle/${pontoId}`, data, {
        headers: getUserHeaders()
    });
}

/**
 * Excluir ponto de controle
 * @param deleteTarefas Se true, deleta tarefas junto; se false, mantém órfãs
 */
export async function deletePontoControle(
    pcaItemId: number, 
    pontoId: number,
    deleteTarefas: boolean = false
): Promise<{ message: string; tarefas_afetadas: number; tarefas_deletadas: boolean }> {
    return apiClient.delete<{ message: string; tarefas_afetadas: number; tarefas_deletadas: boolean }>(
        `/api/pca-items/${pcaItemId}/pontos-controle/${pontoId}?deleteTarefas=${deleteTarefas}`,
        { headers: getUserHeaders() }
    );
}

/**
 * Buscar pontos de controle com tarefas aninhadas
 */
export async function getPontosControleComTarefas(pcaItemId: number): Promise<import('@/types').PcaPontoControleComTarefas[]> {
    return apiClient.get<import('@/types').PcaPontoControleComTarefas[]>(
        `/api/pca-items/${pcaItemId}/pontos-controle-com-tarefas`,
        { headers: getUserHeaders() }
    );
}

/**
 * Buscar tarefas órfãs
 */
export async function getTarefasOrfas(pcaItemId: number): Promise<PcaTarefa[]> {
    return apiClient.get<PcaTarefa[]>(
        `/api/pca-items/${pcaItemId}/tarefas-orfas`,
        { headers: getUserHeaders() }
    );
}

/**
 * Associar tarefa a um ponto de controle
 */
export async function associarTarefaAPontoControle(
    pcaItemId: number,
    tarefaId: number,
    pontoControleId: number | null
): Promise<PcaTarefa> {
    return apiClient.patch<PcaTarefa>(
        `/api/pca-items/${pcaItemId}/tarefas/${tarefaId}/associar-pc`,
        { ponto_controle_id: pontoControleId },
        { headers: getUserHeaders() }
    );
}

// ============================================================
// TAREFAS
// ============================================================

/**
 * Buscar tarefas de um item PCA
 */
export async function getTarefas(pcaItemId: number): Promise<PcaTarefa[]> {
    return apiClient.get<PcaTarefa[]>(`/api/pca-items/${pcaItemId}/tarefas`, {
        headers: getUserHeaders()
    });
}

/**
 * Criar nova tarefa
 */
export async function createTarefa(pcaItemId: number, data: CreateTarefaDto): Promise<PcaTarefa> {
    return apiClient.post<PcaTarefa>(`/api/pca-items/${pcaItemId}/tarefas`, data, {
        headers: getUserHeaders()
    });
}

/**
 * Atualizar tarefa
 */
export async function updateTarefa(
    pcaItemId: number, 
    tarefaId: number, 
    data: UpdateTarefaDto
): Promise<PcaTarefa> {
    return apiClient.put<PcaTarefa>(`/api/pca-items/${pcaItemId}/tarefas/${tarefaId}`, data, {
        headers: getUserHeaders()
    });
}

/**
 * Atualizar apenas o status de uma tarefa
 */
export async function updateTarefaStatus(
    pcaItemId: number, 
    tarefaId: number, 
    status: TarefaStatus
): Promise<PcaTarefa> {
    return apiClient.patch<PcaTarefa>(`/api/pca-items/${pcaItemId}/tarefas/${tarefaId}/status`, { status }, {
        headers: getUserHeaders()
    });
}

/**
 * Excluir tarefa
 */
export async function deleteTarefa(pcaItemId: number, tarefaId: number): Promise<void> {
    await apiClient.delete<void>(`/api/pca-items/${pcaItemId}/tarefas/${tarefaId}`, {
        headers: getUserHeaders()
    });
}

// ============================================================
// SALVAMENTO EM LOTE
// ============================================================

/**
 * Salvar todas as alterações de uma vez
 */
export async function saveAllChanges(pcaItemId: number, changes: SaveAllChangesRequest): Promise<SaveAllChangesResponse> {
    return apiClient.patch<SaveAllChangesResponse>(`/api/pca-items/${pcaItemId}/save-all-changes`, changes, {
        headers: getUserHeaders()
    });
}

// ============================================================
// HELPERS DE FORMATAÇÃO
// ============================================================

/**
 * Formatar data para exibição (DD/MM/AAAA)
 */
export function formatDate(dateString: string | null): string {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
}

/**
 * Formatar data para input (YYYY-MM-DD)
 */
export function formatDateForInput(dateString: string | null): string {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toISOString().split('T')[0];
}

/**
 * Obter classe CSS do badge de status do checklist
 */
export function getChecklistStatusBadgeClass(status: ChecklistStatus): string {
    switch (status) {
        case 'Concluída':
            return 'bg-green-500 text-white';
        case 'Em andamento':
            return 'bg-amber-500 text-white';
        case 'Não Iniciada':
        default:
            return 'bg-gray-400 text-white';
    }
}

/**
 * Obter classe CSS do badge de status da tarefa
 */
export function getTarefaStatusBadgeClass(status: TarefaStatus): string {
    switch (status) {
        case 'Concluída':
            return 'bg-green-500 text-white';
        case 'Em andamento':
            return 'bg-amber-500 text-white';
        case 'Não iniciada':
        default:
            return 'bg-gray-400 text-white';
    }
}

// ============================================================
// EXPORTAÇÃO DEFAULT
// ============================================================

export const pcaDetailsApi = {
    // Todos os detalhes
    getPcaItemAllDetails,
    
    // Detalhes estáticos
    getPcaItemDetails,
    updatePcaItemDetails,
    
    // Checklist
    getPcaChecklist,
    updateChecklistItemStatus,
    
    // Pontos de Controle
    getPontosControle,
    createPontoControle,
    updatePontoControle,
    deletePontoControle,
    getPontosControleComTarefas,
    
    // Tarefas
    getTarefas,
    getTarefasOrfas,
    createTarefa,
    updateTarefa,
    updateTarefaStatus,
    deleteTarefa,
    associarTarefaAPontoControle,
    
    // Salvamento em Lote
    saveAllChanges,
    
    // Helpers
    formatDate,
    formatDateForInput,
    getChecklistStatusBadgeClass,
    getTarefaStatusBadgeClass,
};

export default pcaDetailsApi;
