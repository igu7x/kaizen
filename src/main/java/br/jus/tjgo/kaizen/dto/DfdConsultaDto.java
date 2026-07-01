package br.jus.tjgo.kaizen.dto;

import java.util.List;

/**
 * Payload da DFD-Consulta (instrumento de captura da Formação, Cap. 1). Os 4 blocos na ordem
 * canônica (RF-05): Encerramento → Renovação → Plurianual → Nova Contratação. Os três primeiros
 * derivam dos contratos continuada da unidade; o quarto vem do PCA-TIC corrente.
 */
public record DfdConsultaDto(
        int ano,
        Long unidadeId,
        List<DfdItemDto> encerramento,
        List<DfdItemDto> renovacao,
        List<DfdItemDto> plurianual,
        List<DfdPcaItemDto> novaContratacao
) {}
