package br.jus.tjgo.kaizen.dto;

import java.util.List;
import java.time.LocalDate;

/**
 * Requisição para criar um IFO a partir da DFD-Consulta (RF-24). O código é gerado no backend.
 * `contratos` são os IDs dos contratos continuada agrupados sob o IFO (pool 1:N).
 */
public record CriarIfoRequest(
        Integer ano,
        Long cicloId,
        String bloco,
        String natureza,
        String objeto,
        Long cadastrosUnidadesId,
        Long cadastrosAreasId,
        Double valorEstimado,
        Boolean interesseRenovacao,
        
        // Atributos de PCA herdados/mesclados
        String description,
        String justification,
        String process,
        String financialResourceType,
        String contractType,
        Long formalizedValueCents,
        String priority,
        LocalDate estimatedDate,
        
        List<Long> contratos
) {}
