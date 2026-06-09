package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Porte fiel de AreasService + AreasServiceExtended (areas.service.ts). userId nullable, sem 401. */
@Slf4j
@Service
@RequiredArgsConstructor
public class AreasService {

    private final JdbcTemplate jdbc;
    private final DomainService domainService;

    private static final List<Map<String, Object>> AREAS_PADRAO = List.of(
            areaPadrao("Secretaria de Governança Judiciária e Tecnológica", "SGJT", 0, 0),
            areaPadrao("Diretoria de Tecnologia da Informação", "DITI", 0, 1),
            areaPadrao("Diretoria de Soluções em Tecnologia da Informação", "DSTI", 0, 2),
            areaPadrao("Diretoria de Processamento Eletrônico", "DPE", 0, 3),
            areaPadrao("Diretoria Judiciária", "DIJUD", 0, 4),
            areaPadrao("Corregedoria TJGO", "CGJ", 0, 5),
            areaPadrao("Diretoria-Geral", "DG", 0, 6),
            areaPadrao("Secretaria-Geral da Presidência", "SGP", 0, 7)
    );

    public List<Map<String, Object>> getAll(String dominio) {
        String sql = "SELECT * FROM cadastros_areas WHERE COALESCE(ativo, TRUE) = TRUE";
        if (dominio != null && !dominio.isBlank()) {
            return jdbc.queryForList(sql + " AND dominio = ? " +
                    "ORDER BY COALESCE(ordem_linha, 0), COALESCE(ordem_posicao, 0), nome", dominio);
        }
        return jdbc.queryForList(sql + " ORDER BY COALESCE(ordem_linha, 0), COALESCE(ordem_posicao, 0), nome");
    }

    public Map<String, Object> getById(long id) {
        var rows = jdbc.queryForList(
                "SELECT * FROM cadastros_areas WHERE id = ? AND COALESCE(ativo, TRUE) = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public List<Map<String, Object>> getForSelect(String dominio) {
        String sql = "SELECT id, nome FROM cadastros_areas WHERE COALESCE(ativo, TRUE) = TRUE";
        if (dominio != null && !dominio.isBlank()) {
            return jdbc.queryForList(sql + " AND dominio = ? ORDER BY nome", dominio);
        }
        return jdbc.queryForList(sql + " ORDER BY nome");
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> dto, Long userId, String dominio) {
        Integer nextPos = jdbc.queryForObject(
                "SELECT COALESCE(MAX(ordem_posicao), -1) + 1 FROM cadastros_areas " +
                        "WHERE COALESCE(ordem_linha, 0) = 0 AND COALESCE(ativo, TRUE) = TRUE", Integer.class);

        Map<String, Object> area = jdbc.queryForMap(
                "INSERT INTO cadastros_areas (nome, sigla, subordinacao, gestor, cargo_gestor, foto_gestor, " +
                        "subdiretor, cargo_subdiretor, foto_subdiretor, gerido_por_unidade_superior, " +
                        "colaboradores_vinculados, ordem_linha, ordem_posicao, dominio, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?) RETURNING *",
                orNull(dto.get("nome")), orNull(dto.get("sigla")), orNull(dto.get("subordinacao")),
                orNull(dto.get("gestor")), orNull(dto.get("cargo_gestor")), orNull(dto.get("foto_gestor")),
                orNull(dto.get("subdiretor")), orNull(dto.get("cargo_subdiretor")), orNull(dto.get("foto_subdiretor")),
                dto.get("gerido_por_unidade_superior") != null ? dto.get("gerido_por_unidade_superior") : false,
                orNull(dto.get("colaboradores_vinculados")),
                nextPos == null ? 0 : nextPos, dominio != null ? dominio : "SGJT", userId, userId);

        domainService.invalidateCache();

        Object sigla = area.get("sigla");
        if (sigla != null) {
            try {
                List<String> abas = jdbc.queryForList(
                        "SELECT DISTINCT aba_codigo FROM permissoes_diretoria", String.class);
                for (String aba : abas) {
                    jdbc.update(
                            "INSERT INTO permissoes_diretoria (diretoria, aba_codigo, pode_acessar, apenas_propria_diretoria) " +
                                    "VALUES (?, ?, FALSE, TRUE) ON CONFLICT (diretoria, aba_codigo) DO NOTHING",
                            sigla, aba);
                }
            } catch (Exception e) {
                log.warn("[Areas] Erro ao criar permissões padrão: {}", e.getMessage());
            }
        }

        Object subordinacao = dto.get("subordinacao");
        if (subordinacao != null && !String.valueOf(subordinacao).isBlank()) {
            syncUnidadeSubordinada(area, String.valueOf(subordinacao), userId);
        }
        return area;
    }

    @Transactional
    public Map<String, Object> update(long id, Map<String, Object> dto, Long userId) {
        Map<String, Object> area = getById(id);
        if (area == null) {
            return null;
        }
        Object gestorUserId = dto.containsKey("gestor_user_id") ? dto.get("gestor_user_id") : null;
        Object subdiretorUserId = dto.containsKey("subdiretor_user_id") ? dto.get("subdiretor_user_id") : null;

        var rows = jdbc.queryForList(
                "UPDATE cadastros_areas SET " +
                        "nome = COALESCE(?, nome), sigla = COALESCE(?, sigla), subordinacao = COALESCE(?, subordinacao), " +
                        "gestor = COALESCE(?, gestor), " +
                        "gestor_user_id = CASE WHEN ?::INTEGER IS NOT NULL THEN ?::INTEGER " +
                        "WHEN ?::VARCHAR IS NOT NULL THEN (SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1) " +
                        "ELSE gestor_user_id END, " +
                        "cargo_gestor = COALESCE(?, cargo_gestor), foto_gestor = COALESCE(?, foto_gestor), " +
                        "subdiretor = COALESCE(?, subdiretor), " +
                        "subdiretor_user_id = CASE WHEN ?::INTEGER IS NOT NULL THEN ?::INTEGER " +
                        "WHEN ?::VARCHAR IS NOT NULL THEN (SELECT id FROM users WHERE LOWER(TRIM(name)) = LOWER(TRIM(?)) LIMIT 1) " +
                        "ELSE subdiretor_user_id END, " +
                        "cargo_subdiretor = COALESCE(?, cargo_subdiretor), foto_subdiretor = COALESCE(?, foto_subdiretor), " +
                        "gerido_por_unidade_superior = COALESCE(?, gerido_por_unidade_superior), " +
                        "colaboradores_vinculados = COALESCE(?, colaboradores_vinculados), " +
                        "updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND COALESCE(ativo, TRUE) = TRUE RETURNING *",
                orNull(dto.get("nome")), orNull(dto.get("sigla")), orNull(dto.get("subordinacao")),
                orNull(dto.get("gestor")),
                gestorUserId, gestorUserId, orNull(dto.get("gestor")), orNull(dto.get("gestor")),
                orNull(dto.get("cargo_gestor")), orNull(dto.get("foto_gestor")),
                orNull(dto.get("subdiretor")),
                subdiretorUserId, subdiretorUserId, orNull(dto.get("subdiretor")), orNull(dto.get("subdiretor")),
                orNull(dto.get("cargo_subdiretor")), orNull(dto.get("foto_subdiretor")),
                dto.get("gerido_por_unidade_superior"),
                orNull(dto.get("colaboradores_vinculados")),
                userId, id);

        domainService.invalidateCache();
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> updated = rows.get(0);
        if (dto.containsKey("subordinacao")) {
            Object sub = dto.get("subordinacao");
            syncUnidadeSubordinada(updated, sub == null ? null : String.valueOf(sub), userId);
        }
        return updated;
    }

    private void syncUnidadeSubordinada(Map<String, Object> area, String subordinacaoNome, Long userId) {
        try {
            String areaNome = String.valueOf(area.get("nome"));
            if (subordinacaoNome == null || subordinacaoNome.isBlank()) {
                jdbc.update(
                        "UPDATE cadastros_unidades SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP " +
                                "WHERE nome = ? AND area_id IN (SELECT id FROM cadastros_areas WHERE COALESCE(ativo, TRUE) = TRUE) " +
                                "AND descricao = 'Área subordinada'",
                        areaNome);
                return;
            }
            var areaSuperior = jdbc.queryForList(
                    "SELECT id FROM cadastros_areas WHERE nome = ? AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                    subordinacaoNome);
            if (areaSuperior.isEmpty()) {
                return;
            }
            Object areaSuperiorId = areaSuperior.get(0).get("id");
            var existing = jdbc.queryForList(
                    "SELECT id FROM cadastros_unidades WHERE area_id = ? AND nome = ? AND COALESCE(ativo, TRUE) = TRUE",
                    areaSuperiorId, areaNome);
            if (existing.isEmpty()) {
                Integer next = jdbc.queryForObject(
                        "SELECT COALESCE(MAX(ordem), 0) + 1 FROM cadastros_unidades WHERE area_id = ?",
                        Integer.class, areaSuperiorId);
                jdbc.update(
                        "INSERT INTO cadastros_unidades (area_id, nome, descricao, responsavel, cargo_responsavel, ordem, created_by) " +
                                "VALUES (?, ?, 'Área subordinada', ?, ?, ?, ?)",
                        areaSuperiorId, areaNome, orNull(area.get("gestor")), orNull(area.get("cargo_gestor")),
                        next == null ? 1 : next, userId);
            }
        } catch (Exception e) {
            log.warn("[Areas] Erro ao sincronizar unidade subordinada: {}", e.getMessage());
        }
    }

    public boolean delete(long id, Long userId) {
        int affected = jdbc.update(
                "UPDATE cadastros_areas SET ativo = FALSE, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                        "WHERE id = ? AND COALESCE(ativo, TRUE) = TRUE",
                userId, id);
        domainService.invalidateCache();
        return affected > 0;
    }

    @Transactional
    public void updateOrdenacao(List<Map<String, Object>> ordenacao, Long userId) {
        for (Map<String, Object> item : ordenacao) {
            jdbc.update(
                    "UPDATE cadastros_areas SET ordem_linha = ?, ordem_posicao = ?, updated_at = CURRENT_TIMESTAMP, updated_by = ? " +
                            "WHERE id = ? AND COALESCE(ativo, TRUE) = TRUE",
                    item.get("ordem_linha"), item.get("ordem_posicao"), userId, item.get("id"));
        }
    }

    public Map<String, Object> getAreaCompleta(long id) {
        Map<String, Object> area = getById(id);
        if (area == null) {
            return null;
        }
        List<Map<String, Object>> unidades = jdbc.queryForList(
                "SELECT u.*, sup.nome as unidade_superior_nome FROM cadastros_unidades u " +
                        "LEFT JOIN cadastros_unidades sup ON sup.id = u.unidade_superior_id AND sup.ativo = TRUE " +
                        "WHERE u.area_id = ? AND u.ativo = TRUE " +
                        "AND COALESCE(u.descricao, '') NOT IN ('auto:diretoria', 'Diretoria') " +
                        "ORDER BY u.ordem, u.nome",
                id);
        Map<String, Object> out = new LinkedHashMap<>(area);
        out.put("unidades", unidades);
        return out;
    }

    @Transactional
    public Map<String, Object> inicializarAreasPadrao() {
        int criadas = 0;
        int existentes = 0;
        jdbc.update("UPDATE cadastros_areas SET ativo = FALSE " +
                "WHERE sigla NOT IN ('SGJT', 'DITI', 'DSTI', 'DPE', 'DIJUD', 'CGJ', 'DG', 'SGP') OR sigla IS NULL");

        for (Map<String, Object> ap : AREAS_PADRAO) {
            var existe = jdbc.queryForList("SELECT id FROM cadastros_areas WHERE sigla = ?", ap.get("sigla"));
            if (!existe.isEmpty()) {
                jdbc.update(
                        "UPDATE cadastros_areas SET nome = ?, ativo = TRUE, ordem_linha = ?, ordem_posicao = ?, " +
                                "updated_at = CURRENT_TIMESTAMP WHERE id = ?",
                        ap.get("nome"), ap.get("ordem_linha"), ap.get("ordem_posicao"), existe.get(0).get("id"));
                existentes++;
            } else {
                jdbc.update(
                        "INSERT INTO cadastros_areas (nome, sigla, ordem_linha, ordem_posicao, ativo) VALUES (?, ?, ?, ?, TRUE)",
                        ap.get("nome"), ap.get("sigla"), ap.get("ordem_linha"), ap.get("ordem_posicao"));
                criadas++;
            }
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("message", "Áreas padrão inicializadas com sucesso");
        out.put("areas_criadas", criadas);
        out.put("areas_existentes", existentes);
        return out;
    }

    private static Object orNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s) {
            return s.isEmpty() ? null : s;
        }
        return v;
    }

    private static Map<String, Object> areaPadrao(String nome, String sigla, int linha, int pos) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("nome", nome);
        m.put("sigla", sigla);
        m.put("ordem_linha", linha);
        m.put("ordem_posicao", pos);
        return m;
    }
}
