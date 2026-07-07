package br.jus.tjgo.kaizen.dto;

public record CreatePermissaoAcaoReq(
        String tagAcoesId,
        Long areaId,
        Long unidadeId,
        Long userId
) {}
