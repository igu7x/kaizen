package br.jus.tjgo.kaizen.service;

import org.springframework.dao.EmptyResultDataAccessException;
import org.springframework.jdbc.core.namedparam.MapSqlParameterSource;
import org.springframework.jdbc.core.namedparam.NamedParameterJdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import br.jus.tjgo.kaizen.dto.PermissaoAcaoListDto;
import br.jus.tjgo.kaizen.dto.CreatePermissaoAcaoReq;
import br.jus.tjgo.kaizen.dto.TagAcaoDto;
import br.jus.tjgo.kaizen.exception.ApiException;

import java.util.List;

@Service
public class PermissoesAcoesService {

    private final NamedParameterJdbcTemplate jdbcTemplate;

    public PermissoesAcoesService(NamedParameterJdbcTemplate jdbcTemplate) {
        this.jdbcTemplate = jdbcTemplate;
    }

    /**
     * Valida o acesso através de um funil linear (Área -> Unidade -> Usuário) 
     * baseado nas alocações vigentes.
     * 
     * @param userId             ID do usuário.
     * @param tagDefinidaNaAcao Tag registrada na ação (ex: CONSOLIDACAO_DFD).
     * @return true se o acesso for permitido, false caso contrário.
     */
    public boolean validarAcesso(Long userId, String tagDefinidaNaAcao) {
        String sql = """
                SELECT 1 
                FROM permissoes_acoes pm
                INNER JOIN cadastros_pessoas cp ON cp.user_id = :user_id
                WHERE pm.tag_acoes_id = :tag_definida_na_acao
                  AND pm.area_id = cp.area_id
                  AND (pm.unidade_id = cp.unidade_id OR pm.unidade_id IS NULL)
                  AND (pm.user_id = cp.user_id OR pm.user_id IS NULL)
                LIMIT 1;
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("user_id", userId)
                .addValue("tag_definida_na_acao", tagDefinidaNaAcao);

        try {
            Integer result = jdbcTemplate.queryForObject(sql, params, Integer.class);
            return result != null && result == 1;
        } catch (EmptyResultDataAccessException e) {
            return false;
        }
    }

    /**
     * Retorna uma lista com todas as tags de módulo às quais o usuário tem acesso.
     * Útil para injetar no perfil do usuário e validar menus no Frontend.
     * 
     * @param userId ID do usuário.
     * @return Lista de strings contendo os IDs das tags permitidas.
     */
    public List<String> buscarTagsDoUsuario(Long userId) {
        String sql = """
                SELECT DISTINCT pm.tag_acoes_id 
                FROM permissoes_acoes pm
                INNER JOIN cadastros_pessoas cp ON cp.user_id = :user_id
                WHERE pm.area_id = cp.area_id
                  AND (pm.unidade_id = cp.unidade_id OR pm.unidade_id IS NULL)
                  AND (pm.user_id = cp.user_id OR pm.user_id IS NULL);
                """;

        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("user_id", userId);

        return jdbcTemplate.queryForList(sql, params, String.class);
    }

    public List<PermissaoAcaoListDto> listarTodasPermissoes() {
        String sql = """
                SELECT 
                    pa.id as id,
                    ta.id as tagId,
                    ta.name as tagNome,
                    a.id as areaId,
                    a.nome as areaNome,
                    u.id as unidadeId,
                    u.nome as unidadeNome,
                    usr.id as userId,
                    COALESCE((SELECT cp.nome FROM cadastros_pessoas cp WHERE cp.user_id = pa.user_id LIMIT 1), usr.nome_cc_fc, usr.name) as userNome
                FROM permissoes_acoes pa
                JOIN tags_acoes ta ON pa.tag_acoes_id = ta.id
                JOIN cadastros_areas a ON pa.area_id = a.id
                LEFT JOIN cadastros_unidades u ON pa.unidade_id = u.id
                LEFT JOIN users usr ON pa.user_id = usr.id
                ORDER BY ta.name, a.nome, u.nome, usr.name;
                """;
        
        return jdbcTemplate.query(sql, (rs, rowNum) -> new PermissaoAcaoListDto(
                rs.getLong("id"),
                rs.getString("tagId"),
                rs.getString("tagNome"),
                rs.getLong("areaId"),
                rs.getString("areaNome"),
                rs.getObject("unidadeId") != null ? rs.getLong("unidadeId") : null,
                rs.getString("unidadeNome"),
                rs.getObject("userId") != null ? rs.getLong("userId") : null,
                rs.getString("userNome")
        ));
    }

    public List<TagAcaoDto> listarTags() {
        String sql = "SELECT id, name FROM tags_acoes ORDER BY name";
        return jdbcTemplate.query(sql, (rs, rowNum) -> new TagAcaoDto(
                rs.getString("id"),
                rs.getString("name")
        ));
    }

    @Transactional
    public void adicionarPermissao(CreatePermissaoAcaoReq req) {
        String sql = """
                INSERT INTO permissoes_acoes (tag_acoes_id, area_id, unidade_id, user_id)
                VALUES (:tag_acoes_id, :area_id, :unidade_id, :user_id)
                """;
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("tag_acoes_id", req.tagAcoesId())
                .addValue("area_id", req.areaId())
                .addValue("unidade_id", req.unidadeId())
                .addValue("user_id", req.userId());
        jdbcTemplate.update(sql, params);
    }

    @Transactional
    public void removerPermissao(Long id) {
        String sql = "DELETE FROM permissoes_acoes WHERE id = :id";
        jdbcTemplate.update(sql, new MapSqlParameterSource("id", id));
    }

    @Transactional
    public void atualizarTag(String id, String name) {
        String checkSql = "SELECT count(1) FROM tags_acoes WHERE lower(name) = lower(:name) AND id != :id";
        MapSqlParameterSource checkParams = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", name);
        Integer count = jdbcTemplate.queryForObject(checkSql, checkParams, Integer.class);
        if (count != null && count > 0) {
            throw new ApiException(400, "Já existe uma ação cadastrada com este nome.");
        }

        String sql = "UPDATE tags_acoes SET name = :name WHERE id = :id";
        MapSqlParameterSource params = new MapSqlParameterSource()
                .addValue("id", id)
                .addValue("name", name);
        jdbcTemplate.update(sql, params);
    }
}
