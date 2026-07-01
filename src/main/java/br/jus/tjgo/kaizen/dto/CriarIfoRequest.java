package br.jus.tjgo.kaizen.dto;

import java.util.List;

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
        String areaDemandante,
        Long unidadeId,
        Double valorEstimado,
        Boolean interesseRenovacao,
        List<Long> contratos
) {}
