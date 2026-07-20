package br.jus.tjgo.kaizen.dto;

/**
 * Payload da tela de entrada do Ciclo Orçamentário (RF-59/60): estado persistido das duas
 * finalidades + qual janela ordinária de revisão está ativa na data corrente (resolvido no backend).
 */
public record EntradaCicloDto(
        int anoFormacao,
        CicloDto formacao,
        int anoVigente,
        Integer revisaoOrdemAtiva,
        Integer revisaoVersaoAtiva,
        CicloDto revisao
) {}
