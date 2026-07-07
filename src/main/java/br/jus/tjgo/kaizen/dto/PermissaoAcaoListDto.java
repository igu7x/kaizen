package br.jus.tjgo.kaizen.dto;

public record PermissaoAcaoListDto(
        Long id,
        String tagId,
        String tagNome,
        Long areaId,
        String areaNome,
        Long unidadeId,
        String unidadeNome,
        Long userId,
        String userNome
) {}
