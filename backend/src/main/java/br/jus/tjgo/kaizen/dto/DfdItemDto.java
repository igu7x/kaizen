package br.jus.tjgo.kaizen.dto;

/**
 * Item da DFD-Consulta derivado de um contrato de natureza continuada (RF-01/02).
 * O bloco (encerramento|renovacao|plurianual) é DERIVADO da vigência/limite de prorrogação,
 * não persistido. Datas serializadas como String ISO; valorTotal em reais.
 */
public record DfdItemDto(
        Long contractId,
        String process,
        String supplier,
        String objeto,
        String unidade,
        String situation,
        String bloco,
        String startDate,
        String endDate,
        String limitDate,
        Double valorTotal
) {}
