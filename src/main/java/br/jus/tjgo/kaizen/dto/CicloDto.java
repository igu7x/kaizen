package br.jus.tjgo.kaizen.dto;

/**
 * DTO de um ciclo do Orçamento de TIC (Formação ou Revisão). Espelha o tipo `Ciclo` do frontend
 * (cicloOrcamentarioApi.ts). Datas serializadas como String ISO.
 */
public record CicloDto(
        Long id,
        Integer ano,
        String finalidade,
        String subtipo,
        String estado,
        String proad,
        Integer versaoGerada,
        String aberturaEm,
        String publicadoEm,
        String proadGejut,
        String proadSgjt,
        String proadAtaComites,
        String proadProdutoFinal,
        String proadPublicacao,
        String linkDou
) {}
