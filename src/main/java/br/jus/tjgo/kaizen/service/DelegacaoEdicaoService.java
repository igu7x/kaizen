package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.dto.DelegacaoEdicaoDto;
import br.jus.tjgo.kaizen.dto.DelegacaoEdicaoReq;
import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Delegação de permissões de edição por etapa do ciclo orçamentário.
 *
 * <p>Validadores (usuários com tag de transição) podem delegar a capacidade de
 * editar/excluir IFOs a colegas da mesma área, com escopo limitado a uma etapa
 * específica do ciclo. A delegação é automaticamente revogada ao avançar/retroceder.</p>
 *
 * <p>Tipo 'normal': edição padrão; 'especial': herda capacidades de modificação especial
 * (bypass de campos read-only). Só pode delegar 'especial' quem possui tag
 * PCA_FOR_MODIFICACAO_ESPECIAL ou PCA_FOR_MODIFICACAO_CCA.</p>
 */
@Service
@RequiredArgsConstructor
public class DelegacaoEdicaoService {

    private final JdbcTemplate jdbc;
    private final PermissoesAcoesService permissoesAcoesService;

    private static final Set<String> TIPOS_VALIDOS = Set.of("normal", "especial");

    /** Tags de transição de cada estado (Formação). Se o usuário possui a tag, pode delegar naquele estado. */
    private static final Map<String, String> TAG_TRANSICAO_FORMACAO = Map.ofEntries(
            Map.entry("aguardando_proad", "PCA_FOR_REGISTRAR_PROAD"),
            Map.entry("aberto", "PCA_FOR_ENCAMINHAR_CONSULTA"),
            Map.entry("em_consulta_1", "PCA_FOR_VALIDAR_DEMANDA_1_CAMADA"),
            Map.entry("em_consulta_2", "PCA_FOR_VALIDAR_DEMANDA_2_CAMADA"),
            Map.entry("consolidacao_cca", "PCA_FOR_CONSOLIDAR_ENCAMINHAR_GEJUT"),
            Map.entry("validacao_gejut", "PCA_FOR_ENCAMINHAR_SGJT"),
            Map.entry("apreciacao_sgjt", "PCA_FOR_PAUTAR_COMITES"),
            Map.entry("em_comites", "PCA_FOR_AUTORIZAR_COMITES"),
            Map.entry("remessa_dg", "PCA_FOR_REMETER_DG"));

    private static final Set<String> TAGS_MODIFICACAO_ESPECIAL =
            Set.of("PCA_FOR_MODIFICACAO_ESPECIAL", "PCA_FOR_MODIFICACAO_CCA");

    @Transactional
    public DelegacaoEdicaoDto delegar(long cicloId, DelegacaoEdicaoReq req, Long deleganteId) {
        if (deleganteId == null) {
            throw new ApiException(403, "Usuário não identificado.");
        }
        if (req.estado() == null || req.estado().isBlank()) {
            throw new ApiException(400, "Estado é obrigatório.");
        }
        if (req.delegadoId() == null) {
            throw new ApiException(400, "ID do delegado é obrigatório.");
        }
        String tipo = req.tipo() == null ? "normal" : req.tipo().trim().toLowerCase();
        if (!TIPOS_VALIDOS.contains(tipo)) {
            throw new ApiException(400, "Tipo de delegação inválido. Use 'normal' ou 'especial'.");
        }
        if (deleganteId.equals(req.delegadoId())) {
            throw new ApiException(400, "Não é possível delegar edição para si mesmo.");
        }

        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
        boolean isSuperadmin = optUser.isPresent() && optUser.get().isSuperadmin();

        // Verifica se o delegante pode delegar neste estado (tem tag de transição ou é superadmin).
        if (!isSuperadmin) {
            String tagTransicao = TAG_TRANSICAO_FORMACAO.get(req.estado());
            if (tagTransicao == null || !permissoesAcoesService.validarAcesso(deleganteId, tagTransicao)) {
                throw new ApiException(403,
                        "Apenas quem pode transitar esta etapa pode delegar permissão de edição.");
            }
        }

        // Tipo 'especial' exige que o delegante tenha permissão de modificação especial.
        if ("especial".equals(tipo) && !isSuperadmin) {
            List<String> tags = permissoesAcoesService.buscarTagsDoUsuario(deleganteId);
            boolean temEspecial = tags.stream().anyMatch(TAGS_MODIFICACAO_ESPECIAL::contains);
            if (!temEspecial) {
                throw new ApiException(403,
                        "Delegação do tipo 'especial' exige permissão PCA_FOR_MODIFICACAO_ESPECIAL ou PCA_FOR_MODIFICACAO_CCA.");
            }
        }

        // Resolve ids do delegante
        var idsDelegante = buscarIdsDeAreaEUnidade(deleganteId);
        Long areaDelegante = idsDelegante.get("areaId");
        Long unidadeDelegante = idsDelegante.get("unidadeId");

        // Restrição de mesma área ou unidade (superadmin pode delegar para qualquer um).
        if (!isSuperadmin) {
            var idsDelegado = buscarIdsDeAreaEUnidade(req.delegadoId());
            Long areaDelegado = idsDelegado.get("areaId");
            Long unidadeDelegado = idsDelegado.get("unidadeId");
            
            boolean mesmaArea = areaDelegante != null && areaDelegado != null && areaDelegante.equals(areaDelegado);
            boolean mesmaUnidade = unidadeDelegante != null && unidadeDelegado != null && unidadeDelegante.equals(unidadeDelegado);

            if (!mesmaArea && !mesmaUnidade) {
                throw new ApiException(403,
                        "O delegado deve pertencer à mesma área ou unidade do delegante.");
            }
        }

        Long areaId = areaDelegante != null ? areaDelegante : buscarIdsDeAreaEUnidade(req.delegadoId()).get("areaId");
        if (areaId == null) {
            throw new ApiException(400, "Não foi possível determinar a área do usuário.");
        }

        jdbc.update(
                "INSERT INTO delegacao_edicao (ciclo_id, estado, delegado_id, delegante_id, area_id, tipo) " +
                        "VALUES (?, ?, ?, ?, ?, ?) " +
                        "ON CONFLICT (ciclo_id, estado, delegado_id) DO UPDATE SET " +
                        "delegante_id = EXCLUDED.delegante_id, tipo = EXCLUDED.tipo, created_at = NOW()",
                cicloId, req.estado(), req.delegadoId(), deleganteId, areaId, tipo);

        return buscarDelegacao(cicloId, req.estado(), req.delegadoId());
    }

    @Transactional
    public void revogar(long delegacaoId, Long userId) {
        var optUser = br.jus.tjgo.kaizen.auth.AuthContext.getCurrentUser();
        boolean isSuperadmin = optUser.isPresent() && optUser.get().isSuperadmin();

        if (!isSuperadmin && userId != null) {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*) FROM delegacao_edicao WHERE id = ? AND delegante_id = ?",
                    Integer.class, delegacaoId, userId);
            if (count == null || count == 0) {
                throw new ApiException(403,
                        "Apenas o delegante original ou um administrador pode revogar esta delegação.");
            }
        }

        int n = jdbc.update("DELETE FROM delegacao_edicao WHERE id = ?", delegacaoId);
        if (n == 0) {
            throw new ApiException(404, "Delegação não encontrada.");
        }
    }

    /** Revoga todas as delegações de uma etapa (chamado no avanço/retrocesso do ciclo). */
    @Transactional
    public int revogarPorEstado(long cicloId, String estado) {
        return jdbc.update("DELETE FROM delegacao_edicao WHERE ciclo_id = ? AND estado = ?",
                cicloId, estado);
    }

    public List<DelegacaoEdicaoDto> listar(long cicloId, String estado) {
        String sql = """
                SELECT d.id, d.ciclo_id, d.estado, d.delegado_id, d.delegante_id, d.area_id,
                       d.tipo, d.created_at,
                       COALESCE((SELECT cp.nome FROM cadastros_pessoas cp WHERE cp.user_id = d.delegado_id LIMIT 1),
                                (SELECT u.name FROM users u WHERE u.id = d.delegado_id)) AS delegado_nome,
                       COALESCE((SELECT cp.nome FROM cadastros_pessoas cp WHERE cp.user_id = d.delegante_id LIMIT 1),
                                (SELECT u.name FROM users u WHERE u.id = d.delegante_id)) AS delegante_nome,
                       (SELECT a.nome FROM cadastros_areas a WHERE a.id = d.area_id) AS area_nome
                FROM delegacao_edicao d
                WHERE d.ciclo_id = ? AND d.estado = ?
                ORDER BY d.created_at
                """;
        return jdbc.query(sql, (rs, i) -> new DelegacaoEdicaoDto(
                rs.getLong("id"),
                rs.getLong("ciclo_id"),
                rs.getString("estado"),
                rs.getLong("delegado_id"),
                rs.getString("delegado_nome"),
                rs.getLong("delegante_id"),
                rs.getString("delegante_nome"),
                rs.getLong("area_id"),
                rs.getString("area_nome"),
                rs.getString("tipo"),
                rs.getString("created_at")
        ), cicloId, estado);
    }

    /** Verifica se o usuário tem delegação ativa para o ciclo+estado. */
    public boolean temDelegacao(long cicloId, String estado, Long userId) {
        if (userId == null) return false;
        Integer count = jdbc.queryForObject(
                "SELECT COUNT(*) FROM delegacao_edicao WHERE ciclo_id = ? AND estado = ? AND delegado_id = ?",
                Integer.class, cicloId, estado, userId);
        return count != null && count > 0;
    }

    /** Retorna o tipo de delegação ('normal', 'especial') ou null se não há delegação. */
    public String tipoDelegacao(long cicloId, String estado, Long userId) {
        if (userId == null) return null;
        var rows = jdbc.queryForList(
                "SELECT tipo FROM delegacao_edicao WHERE ciclo_id = ? AND estado = ? AND delegado_id = ?",
                cicloId, estado, userId);
        return rows.isEmpty() ? null : (String) rows.get(0).get("tipo");
    }

    /** Verifica se o usuário tem tag de transição para o estado dado (Formação). */
    public boolean temTagTransicao(String estado, Long userId) {
        if (userId == null || estado == null) return false;
        String tag = TAG_TRANSICAO_FORMACAO.get(estado);
        if (tag == null) return false;
        return permissoesAcoesService.validarAcesso(userId, tag);
    }

    private java.util.Map<String, Long> buscarIdsDeAreaEUnidade(Long userId) {
        if (userId == null) return java.util.Map.of();
        var rows = jdbc.queryForList(
                "SELECT cadastros_areas_id, cadastros_unidades_id FROM users WHERE id = ? LIMIT 1", userId);
        if (rows.isEmpty()) return java.util.Map.of();
        
        java.util.Map<String, Long> ids = new java.util.HashMap<>();
        if (rows.get(0).get("cadastros_areas_id") != null) {
            ids.put("areaId", ((Number) rows.get(0).get("cadastros_areas_id")).longValue());
        }
        if (rows.get(0).get("cadastros_unidades_id") != null) {
            ids.put("unidadeId", ((Number) rows.get(0).get("cadastros_unidades_id")).longValue());
        }
        return ids;
    }

    private DelegacaoEdicaoDto buscarDelegacao(long cicloId, String estado, Long delegadoId) {
        var list = jdbc.query(
                """
                SELECT d.id, d.ciclo_id, d.estado, d.delegado_id, d.delegante_id, d.area_id,
                       d.tipo, d.created_at,
                       COALESCE((SELECT cp.nome FROM cadastros_pessoas cp WHERE cp.user_id = d.delegado_id LIMIT 1),
                                (SELECT u.name FROM users u WHERE u.id = d.delegado_id)) AS delegado_nome,
                       COALESCE((SELECT cp.nome FROM cadastros_pessoas cp WHERE cp.user_id = d.delegante_id LIMIT 1),
                                (SELECT u.name FROM users u WHERE u.id = d.delegante_id)) AS delegante_nome,
                       (SELECT a.nome FROM cadastros_areas a WHERE a.id = d.area_id) AS area_nome
                FROM delegacao_edicao d
                WHERE d.ciclo_id = ? AND d.estado = ? AND d.delegado_id = ?
                """,
                (rs, i) -> new DelegacaoEdicaoDto(
                        rs.getLong("id"), rs.getLong("ciclo_id"), rs.getString("estado"),
                        rs.getLong("delegado_id"), rs.getString("delegado_nome"),
                        rs.getLong("delegante_id"), rs.getString("delegante_nome"),
                        rs.getLong("area_id"), rs.getString("area_nome"),
                        rs.getString("tipo"), rs.getString("created_at")
                ), cicloId, estado, delegadoId);
        return list.isEmpty() ? null : list.get(0);
    }
}
