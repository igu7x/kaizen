package br.jus.tjgo.kaizen.dto;

import java.util.List;
import java.time.LocalDate;

/**
 * IFO (Item de Formação do Orçamento) — identidade provisória de um item na Formação (código
 * IFO-{ano}-{NNNN}). Banda-envelope que agrupa 1:N contratos continuada (RF-10/11). valorEstimado
 * em reais. Espelha o tipo `Ifo` do frontend.
 */
public record IfoDto(
        Long id,
        String codigo,
        Integer ano,
        Long cicloId,
        String bloco,
        String natureza,
        String objeto,
        String areaDemandante,
        Long unidadeId,
        Long areaId,
        String estado,
        Double valorEstimado,
        Boolean interesseRenovacao,
        /** RF-07 — motivo registrado quando o item foi reclassificado (Renovação→Encerramento). */
        String motivoReclassificacao,
        /** Código oficial de Item de PCA atribuído na publicação (RF-49); null antes disso. */
        String codigoOficial,
        /** §8.4 — estado de validação da demanda: em_edicao | validada_1a | validada_2a. */
        String validacao,
        
        // Atributos de PCA herdados/mesclados
        String description,
        String justification,
        String process,
        String financialResourceType,
        String contractType,
        Long formalizedValueCents,
        Long idCadastrosAreas,
        String priority,
        LocalDate estimatedDate,
        
        List<Long> contratos
) {}
