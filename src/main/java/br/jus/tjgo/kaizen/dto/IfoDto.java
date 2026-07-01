package br.jus.tjgo.kaizen.dto;

import java.util.List;

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
        String estado,
        Double valorEstimado,
        Boolean interesseRenovacao,
        List<Long> contratos
) {}
