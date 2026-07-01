package br.jus.tjgo.kaizen.dto;

/**
 * Item do Bloco 4 (Nova Contratação) da DFD-Consulta, pré-preenchido a partir do PCA-TIC
 * corrente (RF-03/04). valorEstimado em reais.
 */
public record DfdPcaItemDto(
        Long pcaId,
        String itemPca,
        String objeto,
        String areaDemandante,
        Double valorEstimado
) {}
