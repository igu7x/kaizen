package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de avaliacaoIntegrada.service.ts.
 * create() faz UPSERT preservando o formulario_id (chave: autoavaliacao_id + avaliacao_gestor_id).
 * Validação em 2 camadas: validarGestor (camada 1) → validarColaborador (camada 2 / final, gera snapshot).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AvaliacaoIntegradaService {

    private final JdbcTemplate jdbc;
    private final br.jus.tjgo.kaizen.service.notificacao.AvaliacoesNotificacoes avaliacoesNotificacoes;
    private final ObjectMapper objectMapper;

    public List<Map<String, Object>> findAllByDomain(List<Long> areasIds, String tipoInventario) {
        String where = "f.is_deleted = FALSE AND f.cadastros_areas_id = ANY(?::bigint[])";
        List<Object> params = new ArrayList<>();
        params.add(bigintArray(areasIds));
        if (tipoInventario != null) {
            params.add(tipoInventario);
            where += " AND COALESCE(f.tipo_inventario, 'equipe') = ?";
        }
        return jdbc.queryForList(listSql(where), params.toArray());
    }

    /**
     * Resultado Final com a visibilidade do negócio: no inventário da equipe quem vê é o
     * gestor da unidade (cadastros_unidades.responsavel_user_id) e o próprio colaborador
     * avaliado; no inventário do gestor, o diretor/sub-diretor da área
     * (cadastros_areas.gestor_user_id / subdiretor_user_id) e o próprio gestor avaliado.
     * Superadmin continua enxergando tudo do domínio, como nas demais telas do módulo.
     */
    public List<Map<String, Object>> findVisiveis(
            List<Long> areasIds, String tipoInventario, long userId, boolean isSuperadmin) {
        if (isSuperadmin) {
            return findAllByDomain(areasIds, tipoInventario);
        }
        String where = "f.is_deleted = FALSE AND f.cadastros_areas_id = ANY(?::bigint[])";
        List<Object> params = new ArrayList<>();
        params.add(bigintArray(areasIds));
        if (tipoInventario != null) {
            params.add(tipoInventario);
            where += " AND COALESCE(f.tipo_inventario, 'equipe') = ?";
        }
        where += " AND ( af.user_id = ? " +
                "   OR ( COALESCE(f.tipo_inventario, 'equipe') = 'equipe' AND EXISTS ( " +
                "        SELECT 1 FROM cadastros_unidades cu2 " +
                "        WHERE cu2.id = f.unidade_id AND cu2.responsavel_user_id = ?) ) " +
                "   OR ( COALESCE(f.tipo_inventario, 'equipe') = 'gestor' AND EXISTS ( " +
                "        SELECT 1 FROM cadastros_areas ca2 " +
                "        WHERE ca2.id = f.cadastros_areas_id " +
                "          AND (ca2.gestor_user_id = ? OR ca2.subdiretor_user_id = ?)) ) )";
        params.add(userId);
        params.add(userId);
        params.add(userId);
        params.add(userId);
        return jdbc.queryForList(listSql(where), params.toArray());
    }

    /** Mesma regra de visibilidade da listagem, para um registro só. */
    public boolean podeVer(long id, long userId, boolean isSuperadmin) {
        if (isSuperadmin) {
            return true;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 1 FROM avaliacao_integrada_formularios f " +
                        "LEFT JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE AND ( af.user_id = ? " +
                        "   OR ( COALESCE(f.tipo_inventario, 'equipe') = 'equipe' AND EXISTS ( " +
                        "        SELECT 1 FROM cadastros_unidades cu2 " +
                        "        WHERE cu2.id = f.unidade_id AND cu2.responsavel_user_id = ?) ) " +
                        "   OR ( COALESCE(f.tipo_inventario, 'equipe') = 'gestor' AND EXISTS ( " +
                        "        SELECT 1 FROM cadastros_areas ca2 " +
                        "        WHERE ca2.id = f.cadastros_areas_id " +
                        "          AND (ca2.gestor_user_id = ? OR ca2.subdiretor_user_id = ?)) ) ) LIMIT 1",
                id, userId, userId, userId, userId);
        return !rows.isEmpty();
    }

    /** Resultados Finais do próprio avaliado (colaborador ou gestor), já calculados. */
    public List<Map<String, Object>> findMeus(long userId) {
        return jdbc.queryForList(
                "SELECT f.*, cu.nome as unidade_nome, af.user_id as colaborador_user_id " +
                        "FROM avaliacao_integrada_formularios f " +
                        "JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.is_deleted = FALSE AND af.user_id = ? " +
                        "ORDER BY COALESCE(f.calculado_em, f.created_at) DESC",
                userId);
    }

    public List<Map<String, Object>> findAll(String diretoria, String tipoInventario) {
        String where = "f.is_deleted = FALSE";
        List<Object> params = new ArrayList<>();
        if (diretoria != null) {
            params.add(diretoria);
            where += " AND f.cadastros_areas_id = (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1)";
        }
        if (tipoInventario != null) {
            params.add(tipoInventario);
            where += " AND COALESCE(f.tipo_inventario, 'equipe') = ?";
        }
        return jdbc.queryForList(listSql(where), params.toArray());
    }

    private static String listSql(String whereClauses) {
        return "SELECT f.*, " +
                "       u.name as avaliador_user_name, " +
                "       cu.nome as unidade_nome, " +
                "       af.user_id as colaborador_user_id, " +
                "       (SELECT COUNT(*) FROM avaliacao_integrada_respostas r WHERE r.formulario_id = f.id) as total_respostas " +
                "FROM avaliacao_integrada_formularios f " +
                "LEFT JOIN users u ON u.id = f.avaliador_user_id " +
                "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                "LEFT JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id " +
                "WHERE " + whereClauses + " " +
                "  AND f.id = ( " +
                "    SELECT f2.id FROM avaliacao_integrada_formularios f2 " +
                "    WHERE f2.pessoa_id = f.pessoa_id " +
                "      AND f2.is_deleted = FALSE " +
                "      AND COALESCE(f2.tipo_inventario, 'equipe') = COALESCE(f.tipo_inventario, 'equipe') " +
                "    ORDER BY f2.created_at DESC " +
                "    LIMIT 1 " +
                "  ) " +
                "ORDER BY f.created_at DESC";
    }

    /** Avaliações integradas validadas pelo gestor onde o colaborador é o user logado. */
    public List<Map<String, Object>> findPendentesColaborador(long userId) {
        return jdbc.queryForList(
                "SELECT f.*, cu.nome as unidade_nome, af.user_id as colaborador_user_id " +
                        "FROM avaliacao_integrada_formularios f " +
                        "JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.is_deleted = FALSE " +
                        "  AND f.validado_gestor_em IS NOT NULL " +
                        "  AND af.user_id = ? " +
                        "ORDER BY f.validado_gestor_em DESC",
                userId);
    }

    /** Verifica se há elegíveis/preenchidas por tipo para um domínio (porte do inline da rota tem-elegiveis). */
    public Map<String, Object> temElegiveis(List<Long> areasIds) {
        String dirArr = bigintArray(areasIds);

        Map<String, Object> equipe = jdbc.queryForMap(
                "SELECT " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_gestor_formularios ag " +
                        "    INNER JOIN autoavaliacao_formularios af ON af.id = ag.pessoa_id AND af.is_deleted = FALSE " +
                        "      AND COALESCE(af.tipo_inventario, 'equipe') = 'equipe' AND af.validado_em IS NOT NULL " +
                        "    WHERE ag.is_deleted = FALSE AND COALESCE(ag.tipo_inventario, 'equipe') = 'equipe' " +
                        "      AND ag.validado_em IS NOT NULL AND ag.cadastros_areas_id = ANY(?::bigint[]) " +
                        "      AND NOT EXISTS (SELECT 1 FROM avaliacao_integrada_formularios ai WHERE ai.autoavaliacao_id = af.id AND ai.avaliacao_gestor_id = ag.id AND ai.is_deleted = FALSE) " +
                        "  ) as tem_elegiveis, " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_integrada_formularios ai " +
                        "    WHERE ai.is_deleted = FALSE AND COALESCE(ai.tipo_inventario, 'equipe') = 'equipe' " +
                        "      AND ai.cadastros_areas_id = ANY(?::bigint[]) " +
                        "  ) as tem_preenchidas",
                dirArr, dirArr);

        Map<String, Object> gestor = jdbc.queryForMap(
                "SELECT " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_gestor_formularios ag " +
                        "    INNER JOIN autoavaliacao_formularios af ON af.id = ag.pessoa_id AND af.is_deleted = FALSE " +
                        "      AND COALESCE(af.tipo_inventario, 'equipe') = 'gestor' AND af.validado_em IS NOT NULL " +
                        "    WHERE ag.is_deleted = FALSE AND COALESCE(ag.tipo_inventario, 'equipe') = 'gestor' " +
                        "      AND ag.validado_em IS NOT NULL AND ag.cadastros_areas_id = ANY(?::bigint[]) " +
                        "      AND NOT EXISTS (SELECT 1 FROM avaliacao_integrada_formularios ai WHERE ai.autoavaliacao_id = af.id AND ai.avaliacao_gestor_id = ag.id AND ai.is_deleted = FALSE) " +
                        "  ) as tem_elegiveis, " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_integrada_formularios ai " +
                        "    WHERE ai.is_deleted = FALSE AND COALESCE(ai.tipo_inventario, 'equipe') = 'gestor' " +
                        "      AND ai.cadastros_areas_id = ANY(?::bigint[]) " +
                        "  ) as tem_preenchidas",
                dirArr, dirArr);

        Map<String, Object> avgestorEquipe = jdbc.queryForMap(
                "SELECT " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM autoavaliacao_formularios af " +
                        "    WHERE af.is_deleted = FALSE AND COALESCE(af.tipo_inventario, 'equipe') = 'equipe' " +
                        "      AND af.validado_em IS NOT NULL AND af.cadastros_areas_id = ANY(?::bigint[]) " +
                        "      AND NOT EXISTS (SELECT 1 FROM avaliacao_gestor_formularios ag WHERE ag.pessoa_id = af.id AND ag.is_deleted = FALSE) " +
                        "  ) as tem_elegiveis, " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_gestor_formularios ag " +
                        "    WHERE ag.is_deleted = FALSE AND COALESCE(ag.tipo_inventario, 'equipe') = 'equipe' " +
                        "      AND ag.cadastros_areas_id = ANY(?::bigint[]) " +
                        "  ) as tem_preenchidas",
                dirArr, dirArr);

        Map<String, Object> avgestorGestor = jdbc.queryForMap(
                "SELECT " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM autoavaliacao_formularios af " +
                        "    WHERE af.is_deleted = FALSE AND COALESCE(af.tipo_inventario, 'equipe') = 'gestor' " +
                        "      AND af.validado_em IS NOT NULL AND af.cadastros_areas_id = ANY(?::bigint[]) " +
                        "      AND NOT EXISTS (SELECT 1 FROM avaliacao_gestor_formularios ag WHERE ag.pessoa_id = af.id AND ag.is_deleted = FALSE) " +
                        "  ) as tem_elegiveis, " +
                        "  EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_gestor_formularios ag " +
                        "    WHERE ag.is_deleted = FALSE AND COALESCE(ag.tipo_inventario, 'equipe') = 'gestor' " +
                        "      AND ag.cadastros_areas_id = ANY(?::bigint[]) " +
                        "  ) as tem_preenchidas",
                dirArr, dirArr);

        boolean equipeEleg = bool(equipe.get("tem_elegiveis"));
        boolean gestorEleg = bool(gestor.get("tem_elegiveis"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("equipe", equipeEleg || bool(equipe.get("tem_preenchidas")));
        out.put("gestor", gestorEleg || bool(gestor.get("tem_preenchidas")));
        out.put("equipeElegiveis", equipeEleg);
        out.put("gestorElegiveis", gestorEleg);
        out.put("avgestorEquipe", bool(avgestorEquipe.get("tem_elegiveis")) || bool(avgestorEquipe.get("tem_preenchidas")));
        out.put("avgestorGestor", bool(avgestorGestor.get("tem_elegiveis")) || bool(avgestorGestor.get("tem_preenchidas")));
        return out;
    }

    public List<Map<String, Object>> getElegiveis(long unidadeId, String tipoInventario) {
        return jdbc.queryForList(
                "SELECT DISTINCT ag.pessoa_id, ag.pessoa_nome, " +
                        "       af.id as autoavaliacao_id, ag.id as avaliacao_gestor_id " +
                        "FROM avaliacao_gestor_formularios ag " +
                        "INNER JOIN autoavaliacao_formularios af " +
                        "    ON af.id = ag.pessoa_id " +
                        "    AND af.is_deleted = FALSE " +
                        "    AND COALESCE(af.tipo_inventario, 'equipe') = ? " +
                        "    AND af.validado_em IS NOT NULL " +
                        "WHERE ag.unidade_id = ? AND ag.is_deleted = FALSE " +
                        "  AND COALESCE(ag.tipo_inventario, 'equipe') = ? " +
                        "  AND ag.validado_em IS NOT NULL " +
                        "AND NOT EXISTS ( " +
                        "    SELECT 1 FROM avaliacao_integrada_formularios ai " +
                        "    WHERE ai.autoavaliacao_id = af.id AND ai.avaliacao_gestor_id = ag.id " +
                        "    AND ai.is_deleted = FALSE " +
                        ") " +
                        "ORDER BY ag.pessoa_nome",
                tipoInventario, unidadeId, tipoInventario);
    }

    public Map<String, Object> getParData(long autoavaliacaoId, long avaliacaoGestorId) {
        Map<String, Object> autoavaliacao = null;
        List<Map<String, Object>> autoForm = jdbc.queryForList(
                "SELECT f.*, cu.nome as unidade_nome " +
                        "FROM autoavaliacao_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                autoavaliacaoId);
        if (!autoForm.isEmpty()) {
            List<Map<String, Object>> respostas = jdbc.queryForList(
                    "SELECT * FROM autoavaliacao_respostas WHERE formulario_id = ? ORDER BY ordem", autoForm.get(0).get("id"));
            autoavaliacao = new LinkedHashMap<>(autoForm.get(0));
            autoavaliacao.put("respostas", respostas);
        }

        Map<String, Object> avaliacaoGestor = null;
        List<Map<String, Object>> gestorForm = jdbc.queryForList(
                "SELECT f.*, cu.nome as unidade_nome " +
                        "FROM avaliacao_gestor_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                avaliacaoGestorId);
        if (!gestorForm.isEmpty()) {
            List<Map<String, Object>> respostas = jdbc.queryForList(
                    "SELECT * FROM avaliacao_gestor_respostas WHERE formulario_id = ? ORDER BY ordem", gestorForm.get(0).get("id"));
            avaliacaoGestor = new LinkedHashMap<>(gestorForm.get(0));
            avaliacaoGestor.put("respostas", respostas);
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("autoavaliacao", autoavaliacao);
        out.put("avaliacaoGestor", avaliacaoGestor);
        return out;
    }

    /** Metadados mínimos da última avaliação integrada por user_id (ou null). */
    public Map<String, Object> findLatestByUserId(long userId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT f.id, COALESCE(f.tipo_inventario, 'equipe') AS tipo_inventario, f.status " +
                        "FROM avaliacao_integrada_formularios f " +
                        "INNER JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id " +
                        "INNER JOIN users u ON u.id = af.user_id " +
                        "WHERE af.user_id = ? AND f.is_deleted = FALSE " +
                        "ORDER BY f.created_at DESC LIMIT 1",
                userId);
        if (rows.isEmpty()) {
            return null;
        }
        Map<String, Object> row = rows.get(0);
        String tipo = "gestor".equals(String.valueOf(row.get("tipo_inventario"))) ? "gestor" : "equipe";
        Map<String, Object> out = new LinkedHashMap<>();
        // id é int4 (SERIAL) → Integer → número (paridade com Number(row.id) do Node).
        // NÃO usar longValue(): o serializer de Long agora emite string (fix B), o que divergiria.
        out.put("id", ((Number) row.get("id")).intValue());
        out.put("tipo_inventario", tipo);
        out.put("status", String.valueOf(row.get("status")));
        return out;
    }

    public Map<String, Object> findById(long id) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT f.*, u.name as avaliador_user_name, cu.nome as unidade_nome, " +
                        "       af.user_id as colaborador_user_id " +
                        "FROM avaliacao_integrada_formularios f " +
                        "LEFT JOIN users u ON u.id = f.avaliador_user_id " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "LEFT JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                id);
        if (formRows.isEmpty()) {
            return null;
        }
        List<Map<String, Object>> respostas = jdbc.queryForList(
                "SELECT * FROM avaliacao_integrada_respostas WHERE formulario_id = ? ORDER BY ordem", id);
        Map<String, Object> out = new LinkedHashMap<>(formRows.get(0));
        out.put("respostas", respostas);
        return out;
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> data, long userId) {
        String tipoInv = data.get("tipo_inventario") != null ? str(data.get("tipo_inventario")) : "equipe";
        Long autoavaliacaoId = asLong(data.get("autoavaliacao_id"));
        Long avaliacaoGestorId = asLong(data.get("avaliacao_gestor_id"));
        Long pessoaId = asLong(data.get("pessoa_id"));
        Long unidadeId = asLong(data.get("unidade_id"));

        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id FROM avaliacao_integrada_formularios " +
                        "WHERE autoavaliacao_id = ? AND avaliacao_gestor_id = ? " +
                        "  AND is_deleted = FALSE " +
                        "  AND ((validado_gestor_em IS NULL AND validado_colaborador_em IS NULL) OR status = 'atualizacao_requisitada') " +
                        "ORDER BY id DESC LIMIT 1",
                autoavaliacaoId, avaliacaoGestorId);

        int tecnicasVersao = 1;
        if (unidadeId != null) {
            List<Map<String, Object>> versaoRows = jdbc.queryForList(
                    "SELECT tecnicas_versao FROM competencias_gestor_formularios " +
                            "WHERE unidade_id = ? AND COALESCE(tipo, 'equipe') = ? " +
                            "  AND is_deleted = FALSE AND validado_final_em IS NOT NULL " +
                            "  AND COALESCE(tecnicas_propagacao_pendente, FALSE) = FALSE " +
                            "ORDER BY tecnicas_versao DESC LIMIT 1",
                    unidadeId, tipoInv);
            if (!versaoRows.isEmpty() && versaoRows.get(0).get("tecnicas_versao") != null) {
                tecnicasVersao = ((Number) versaoRows.get(0).get("tecnicas_versao")).intValue();
            }
        }

        int competenciasVersao = 1;
        try {
            Integer v = jdbc.queryForObject(
                    "SELECT COALESCE(MAX(versao), 1) AS versao FROM competencias_padrao_versoes", Integer.class);
            if (v != null) {
                competenciasVersao = v;
            }
        } catch (Exception err) {
            log.error("[avaliacaoIntegrada.create] Erro ao buscar versão padrão: {}", err.getMessage());
        }

        long formularioId;
        if (!existing.isEmpty()) {
            formularioId = ((Number) existing.get(0).get("id")).longValue();
            jdbc.update(
                    "UPDATE avaliacao_integrada_formularios SET " +
                            "  pessoa_nome = ?, avaliador_user_id = ?, avaliador_nome = ?, " +
                            "  cadastros_areas_id = (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1), diretoria = ?, unidade_id = ?, tipo_inventario = ?, " +
                            "  status = 'enviado', tecnicas_versao = ?, competencias_versao = ?, " +
                            "  validado_gestor_id = NULL, validado_gestor_nome = NULL, validado_gestor_em = NULL, " +
                            "  validado_colaborador_id = NULL, validado_colaborador_nome = NULL, validado_colaborador_em = NULL, " +
                            "  updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ?",
                    str(data.get("pessoa_nome")), userId, str(data.get("avaliador_nome")),
                    str(data.get("diretoria")), str(data.get("diretoria")), unidadeId, tipoInv, tecnicasVersao, competenciasVersao, userId, formularioId);
            // Salvaguarda anti-perda: só apaga as respostas existentes se o payload trouxer respostas.
            // Um save com lista vazia/ausente não pode zerar notas integradas/comentários do rascunho.
            if (!asList(data.get("respostas")).isEmpty()) {
                jdbc.update("DELETE FROM avaliacao_integrada_respostas WHERE formulario_id = ?", formularioId);
            }
        } else {
            Map<String, Object> ins = jdbc.queryForMap(
                    "INSERT INTO avaliacao_integrada_formularios " +
                            "  (autoavaliacao_id, avaliacao_gestor_id, pessoa_id, pessoa_nome, avaliador_user_id, avaliador_nome, cadastros_areas_id, diretoria, unidade_id, tipo_inventario, status, tecnicas_versao, competencias_versao, created_by, updated_by) " +
                            "VALUES (?, ?, ?, ?, ?, ?, (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1), ?, ?, ?, 'enviado', ?, ?, ?, ?) " +
                            "RETURNING id",
                    autoavaliacaoId, avaliacaoGestorId, pessoaId, str(data.get("pessoa_nome")), userId,
                    str(data.get("avaliador_nome")), str(data.get("diretoria")), str(data.get("diretoria")), unidadeId, tipoInv,
                    tecnicasVersao, competenciasVersao, userId, userId);
            formularioId = ((Number) ins.get("id")).longValue();
        }

        List<Map<String, Object>> respostas = asList(data.get("respostas"));
        for (int i = 0; i < respostas.size(); i++) {
            Map<String, Object> r = respostas.get(i);
            jdbc.update(
                    "INSERT INTO avaliacao_integrada_respostas (formulario_id, competencia_unidade_id, competencia_nome, competencia_descricao, nota_autoavaliacao, nota_gestor, nota_integrada, comentario, tipo, ordem) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    formularioId, asLong(r.get("competencia_unidade_id")), str(r.get("competencia_nome")),
                    orNull(r.get("competencia_descricao")), r.get("nota_autoavaliacao"), r.get("nota_gestor"),
                    r.get("nota_integrada"), orNull(r.get("comentario")),
                    r.get("tipo") != null ? str(r.get("tipo")) : "tecnica", i + 1);
        }

        Map<String, Object> criada = findById(formularioId);
        if (criada != null) {
            avaliacoesNotificacoes.aoIntegradaEnviada(criada);
        }
        return criada;
    }

    @Transactional
    public Map<String, Object> validarGestor(long id, long userId, String userName) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT f.*, ag.avaliador_user_id as gestor_user_id " +
                        "FROM avaliacao_integrada_formularios f " +
                        "LEFT JOIN avaliacao_gestor_formularios ag ON ag.id = f.avaliacao_gestor_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                id);
        if (formRows.isEmpty()) {
            return error("Formulário não encontrado");
        }
        Map<String, Object> formulario = formRows.get(0);
        if (formulario.get("validado_gestor_em") != null) {
            return error("Já foi validado pelo gestor");
        }
        Long gestorUserId = asLong(formulario.get("gestor_user_id"));
        Long avaliadorUserId = asLong(formulario.get("avaliador_user_id"));
        if (!equalsId(gestorUserId, userId) && !equalsId(avaliadorUserId, userId)) {
            return error("Apenas o gestor pode validar nesta etapa");
        }

        jdbc.update(
                "UPDATE avaliacao_integrada_formularios " +
                        "SET status = 'validado_gestor', validado_gestor_id = ?, validado_gestor_nome = ?, validado_gestor_em = NOW(), updated_by = ? " +
                        "WHERE id = ?",
                userId, userName, userId, id);

        Map<String, Object> f = findById(id);
        if (f != null) {
            avaliacoesNotificacoes.aoIntegradaValidadaGestor(f);
        }
        return f;
    }

    @Transactional
    public Map<String, Object> validarColaborador(long id, long userId, String userName) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT f.*, af.user_id as colaborador_user_id " +
                        "FROM avaliacao_integrada_formularios f " +
                        "LEFT JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                id);
        if (formRows.isEmpty()) {
            return error("Formulário não encontrado");
        }
        Map<String, Object> formulario = formRows.get(0);
        if (formulario.get("validado_gestor_em") == null) {
            return error("O gestor precisa validar primeiro");
        }
        if (formulario.get("validado_colaborador_em") != null) {
            return error("Já foi validado pelo colaborador");
        }
        Long colaboradorUserId = asLong(formulario.get("colaborador_user_id"));
        if (!equalsId(colaboradorUserId, userId)) {
            return error("Apenas o colaborador avaliado pode validar nesta etapa");
        }

        jdbc.update(
                "UPDATE avaliacao_integrada_formularios " +
                        "SET status = 'validado', validado_colaborador_id = ?, validado_colaborador_nome = ?, validado_colaborador_em = NOW(), " +
                        "    versao_formulario = COALESCE(versao_formulario, 0) + 1, updated_by = ? " +
                        "WHERE id = ?",
                userId, userName, userId, id);

        Map<String, Object> formularioCompleto = findById(id);
        if (formularioCompleto != null) {
            try {
                int novaVersao = formularioCompleto.get("versao_formulario") != null
                        ? ((Number) formularioCompleto.get("versao_formulario")).intValue() : 1;
                jdbc.update(
                        "INSERT INTO avaliacao_integrada_versoes (formulario_id, versao, dados, validado_em, validado_nome) " +
                                "VALUES (?, ?, ?::jsonb, ?, ?) " +
                                "ON CONFLICT (formulario_id, versao) DO UPDATE SET dados = EXCLUDED.dados",
                        id, novaVersao, toJson(formularioCompleto),
                        formularioCompleto.get("validado_colaborador_em"), formularioCompleto.get("validado_colaborador_nome"));
            } catch (Exception err) {
                log.error("[validarColaborador] Erro ao salvar snapshot de versão: {}", err.getMessage());
            }
        }

        if (formularioCompleto != null) {
            avaliacoesNotificacoes.aoIntegradaConcluida(formularioCompleto);
        }
        return formularioCompleto;
    }

    public List<Map<String, Object>> findVersoes(long formularioId) {
        return jdbc.queryForList(
                "SELECT id, formulario_id, versao, validado_em, validado_nome, created_at " +
                        "FROM avaliacao_integrada_versoes WHERE formulario_id = ? ORDER BY versao DESC",
                formularioId);
    }

    public Object findVersaoDados(long formularioId, int versao) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT dados FROM avaliacao_integrada_versoes WHERE formulario_id = ? AND versao = ?",
                formularioId, versao);
        if (rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("dados");
    }

    public void delete(long id, long userId) {
        jdbc.update(
                "UPDATE avaliacao_integrada_formularios SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?",
                userId, id);
    }

    // ============================================================
    // Resultado Final (antiga "Avaliação Integrada")
    // ============================================================
    // A nota deixou de ser consenso digitado: agora é média ponderada entre a avaliação
    // de quem avalia (gestor da unidade, no inventário da equipe; liderança, no inventário
    // do gestor) com peso 70, e a autoavaliação do avaliado, com peso 30.

    private static final int PESO_AVALIADOR = 7;
    private static final int PESO_AUTO = 3;

    /**
     * Média ponderada 70/30 arredondada para inteiro. O ,5 exato desce (decisão do negócio:
     * só arredonda pra cima ACIMA de ,5). A conta é feita em inteiros — 7*avaliador + 3*auto
     * é a nota multiplicada por 10 — pra não depender de ponto flutuante num limite de
     * arredondamento. Nota faltando de um lado devolve a do outro; sem nenhuma, devolve null.
     */
    public static Integer calcularNotaFinal(Integer notaAuto, Integer notaAvaliador) {
        if (notaAuto == null && notaAvaliador == null) {
            return null;
        }
        if (notaAuto == null) {
            return notaAvaliador;
        }
        if (notaAvaliador == null) {
            return notaAuto;
        }
        int decimos = PESO_AVALIADOR * notaAvaliador + PESO_AUTO * notaAuto;
        int inteiro = Math.floorDiv(decimos, 10);
        int resto = Math.floorMod(decimos, 10);
        return resto > 5 ? inteiro + 1 : inteiro;
    }

    /** Gera/atualiza o Resultado Final do par, se as duas avaliações já estiverem validadas. */
    @Transactional
    public Map<String, Object> gerarPorPar(long autoavaliacaoId, long avaliacaoGestorId) {
        List<Map<String, Object>> afRows = jdbc.queryForList(
                "SELECT * FROM autoavaliacao_formularios WHERE id = ? AND is_deleted = FALSE AND validado_em IS NOT NULL",
                autoavaliacaoId);
        List<Map<String, Object>> agRows = jdbc.queryForList(
                "SELECT * FROM avaliacao_gestor_formularios WHERE id = ? AND is_deleted = FALSE AND validado_em IS NOT NULL",
                avaliacaoGestorId);
        if (afRows.isEmpty() || agRows.isEmpty()) {
            // Ainda falta uma das pontas — nada a gerar (não é erro).
            return null;
        }
        Map<String, Object> af = afRows.get(0);
        Map<String, Object> ag = agRows.get(0);

        List<Map<String, Object>> respAuto = jdbc.queryForList(
                "SELECT * FROM autoavaliacao_respostas WHERE formulario_id = ? ORDER BY ordem", autoavaliacaoId);
        List<Map<String, Object>> respAvaliador = jdbc.queryForList(
                "SELECT * FROM avaliacao_gestor_respostas WHERE formulario_id = ? ORDER BY ordem", avaliacaoGestorId);

        // A avaliação do avaliador manda na ordem e no conjunto de competências; o que só
        // existir na autoavaliação entra no fim, pra nenhuma competência sumir do resultado.
        List<String> chavesAuto = chavesDeOcorrencia(respAuto);
        Map<String, Map<String, Object>> autoPorChave = new LinkedHashMap<>();
        for (int i = 0; i < respAuto.size(); i++) {
            autoPorChave.put(chavesAuto.get(i), respAuto.get(i));
        }

        List<String> chavesAvaliador = chavesDeOcorrencia(respAvaliador);
        List<Map<String, Object>> linhas = new ArrayList<>();
        for (int i = 0; i < respAvaliador.size(); i++) {
            Map<String, Object> auto = autoPorChave.remove(chavesAvaliador.get(i));
            linhas.add(linhaResultado(respAvaliador.get(i), auto));
        }
        for (Map<String, Object> auto : autoPorChave.values()) {
            linhas.add(linhaResultado(null, auto));
        }

        String tipoInv = ag.get("tipo_inventario") != null ? str(ag.get("tipo_inventario")) : "equipe";
        Long unidadeId = asLong(ag.get("unidade_id"));
        Long avaliadorUserId = asLong(ag.get("avaliador_user_id"));

        List<Map<String, Object>> existing = jdbc.queryForList(
                "SELECT id FROM avaliacao_integrada_formularios " +
                        "WHERE autoavaliacao_id = ? AND avaliacao_gestor_id = ? AND is_deleted = FALSE " +
                        "ORDER BY id DESC LIMIT 1",
                autoavaliacaoId, avaliacaoGestorId);

        long formularioId;
        if (!existing.isEmpty()) {
            formularioId = ((Number) existing.get(0).get("id")).longValue();
            jdbc.update(
                    "UPDATE avaliacao_integrada_formularios SET " +
                            "  pessoa_id = ?, pessoa_nome = ?, avaliador_user_id = ?, avaliador_nome = ?, " +
                            "  cadastros_areas_id = ?, diretoria = ?, unidade_id = ?, tipo_inventario = ?, " +
                            "  status = 'calculado', calculado_em = NOW(), " +
                            // Cada recálculo (nova validação de uma das origens) é uma versão nova.
                            "  versao_formulario = COALESCE(versao_formulario, 0) + 1, " +
                            "  tecnicas_versao = ?, competencias_versao = ?, updated_at = NOW() " +
                            "WHERE id = ?",
                    asLong(ag.get("pessoa_id")), str(ag.get("pessoa_nome")), avaliadorUserId,
                    str(ag.get("avaliador_nome")), asLong(ag.get("cadastros_areas_id")), str(ag.get("diretoria")),
                    unidadeId, tipoInv, numOrOne(ag.get("tecnicas_versao")), numOrOne(ag.get("competencias_versao")),
                    formularioId);
        } else {
            Map<String, Object> ins = jdbc.queryForMap(
                    "INSERT INTO avaliacao_integrada_formularios " +
                            "  (autoavaliacao_id, avaliacao_gestor_id, pessoa_id, pessoa_nome, avaliador_user_id, avaliador_nome, " +
                            "   cadastros_areas_id, diretoria, unidade_id, tipo_inventario, status, calculado_em, " +
                            "   versao_formulario, tecnicas_versao, competencias_versao, created_by, updated_by) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'calculado', NOW(), 1, ?, ?, ?, ?) " +
                            "RETURNING id",
                    autoavaliacaoId, avaliacaoGestorId, asLong(ag.get("pessoa_id")), str(ag.get("pessoa_nome")),
                    avaliadorUserId, str(ag.get("avaliador_nome")), asLong(ag.get("cadastros_areas_id")),
                    str(ag.get("diretoria")), unidadeId, tipoInv,
                    numOrOne(ag.get("tecnicas_versao")), numOrOne(ag.get("competencias_versao")),
                    avaliadorUserId, avaliadorUserId);
            formularioId = ((Number) ins.get("id")).longValue();
        }

        jdbc.update("DELETE FROM avaliacao_integrada_respostas WHERE formulario_id = ?", formularioId);
        for (int i = 0; i < linhas.size(); i++) {
            Map<String, Object> l = linhas.get(i);
            jdbc.update(
                    "INSERT INTO avaliacao_integrada_respostas " +
                            "  (formulario_id, competencia_unidade_id, competencia_nome, competencia_descricao, " +
                            "   nota_autoavaliacao, nota_gestor, nota_integrada, tipo, ordem) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    formularioId, l.get("competencia_unidade_id"), l.get("competencia_nome"),
                    l.get("competencia_descricao"), l.get("nota_autoavaliacao"), l.get("nota_gestor"),
                    l.get("nota_integrada"), l.get("tipo"), i + 1);
        }

        // Snapshot da versão recém-calculada. É o que alimenta o histórico de versões e o PDF
        // por versão na tela — sem ele o número apareceria sem nada por trás. Sem validador:
        // `validado_em` recebe o instante do cálculo e o nome fica nulo.
        Map<String, Object> formularioCompleto = findById(formularioId);
        if (formularioCompleto != null) {
            try {
                int novaVersao = formularioCompleto.get("versao_formulario") != null
                        ? ((Number) formularioCompleto.get("versao_formulario")).intValue() : 1;
                jdbc.update(
                        "INSERT INTO avaliacao_integrada_versoes (formulario_id, versao, dados, validado_em, validado_nome) " +
                                "VALUES (?, ?, ?::jsonb, ?, NULL) " +
                                "ON CONFLICT (formulario_id, versao) DO UPDATE SET dados = EXCLUDED.dados",
                        formularioId, novaVersao, toJson(formularioCompleto),
                        formularioCompleto.get("calculado_em"));
            } catch (Exception err) {
                log.error("[resultadoFinal] Erro ao salvar snapshot de versão: {}", err.getMessage());
            }
        }

        log.info("[resultadoFinal] gerado formulario={} par=({},{}) competencias={}",
                formularioId, autoavaliacaoId, avaliacaoGestorId, linhas.size());
        return formularioCompleto;
    }

    /** Gatilho: chamado ao validar uma autoavaliação. Gera o Resultado Final se o par fechou. */
    public void gerarPorAutoavaliacao(long autoavaliacaoId) {
        List<Map<String, Object>> pares = jdbc.queryForList(
                "SELECT id FROM avaliacao_gestor_formularios " +
                        "WHERE pessoa_id = ? AND is_deleted = FALSE AND validado_em IS NOT NULL",
                autoavaliacaoId);
        for (Map<String, Object> p : pares) {
            gerarComLog(autoavaliacaoId, ((Number) p.get("id")).longValue());
        }
    }

    /** Gatilho: chamado ao validar uma avaliação do gestor/liderança. */
    public void gerarPorAvaliacaoGestor(long avaliacaoGestorId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT pessoa_id FROM avaliacao_gestor_formularios WHERE id = ? AND is_deleted = FALSE",
                avaliacaoGestorId);
        if (rows.isEmpty() || rows.get(0).get("pessoa_id") == null) {
            return;
        }
        gerarComLog(asLong(rows.get(0).get("pessoa_id")), avaliacaoGestorId);
    }

    /**
     * O Resultado Final é efeito colateral da validação: se ele falhar, a validação em si
     * (que é o ato do usuário) não pode ser desfeita — por isso o erro é logado, não propagado.
     */
    private void gerarComLog(long autoavaliacaoId, long avaliacaoGestorId) {
        try {
            gerarPorPar(autoavaliacaoId, avaliacaoGestorId);
        } catch (Exception err) {
            log.error("[resultadoFinal] falha ao gerar par=({},{}): {}",
                    autoavaliacaoId, avaliacaoGestorId, err.getMessage(), err);
        }
    }

    /**
     * Chaves de pareamento de uma lista de respostas, numeradas por ocorrência.
     *
     * <p>Nomes repetidos são comuns no referencial e <code>competencia_unidade_id</code> quase nunca
     * vem preenchido, então a chave caía no nome e TODAS as ocorrências do mesmo nome colidiam numa
     * entrada só: a última vencia o <code>put</code>, a primeira competência pareava com a nota da
     * última e as demais ficavam sem autoavaliação (a "Nota null" na tela e no PDF).
     *
     * <p>Numerar a ocorrência dentro de (nome, tipo) casa a n-ésima de um lado com a n-ésima do
     * outro — que é a ordem em que os dois formulários foram gerados a partir do mesmo referencial.
     * Para quem tem id, a chave já era única e o sufixo não muda nada.
     */
    private static List<String> chavesDeOcorrencia(List<Map<String, Object>> respostas) {
        Map<String, Integer> ocorrencias = new HashMap<>();
        List<String> chaves = new ArrayList<>(respostas.size());
        for (Map<String, Object> r : respostas) {
            String base = chaveCompetencia(r);
            chaves.add(base + "#" + ocorrencias.merge(base, 1, Integer::sum));
        }
        return chaves;
    }

    /** Casa a competência entre os dois formulários: id da competência da unidade + tipo. */
    private static String chaveCompetencia(Map<String, Object> r) {
        Object id = r.get("competencia_unidade_id");
        String tipo = r.get("tipo") != null ? String.valueOf(r.get("tipo")) : "tecnica";
        // Sem id (competência avulsa), o nome normalizado é o que resta pra parear.
        String base = id != null
                ? "id:" + id
                : "nome:" + String.valueOf(r.get("competencia_nome")).trim().toLowerCase();
        return base + "|" + tipo;
    }

    private static Map<String, Object> linhaResultado(
            Map<String, Object> doAvaliador, Map<String, Object> daAutoavaliacao) {
        Map<String, Object> base = doAvaliador != null ? doAvaliador : daAutoavaliacao;
        Integer notaAvaliador = asInt(doAvaliador != null ? doAvaliador.get("nota") : null);
        Integer notaAuto = asInt(daAutoavaliacao != null ? daAutoavaliacao.get("nota") : null);

        Map<String, Object> l = new LinkedHashMap<>();
        l.put("competencia_unidade_id", base.get("competencia_unidade_id"));
        l.put("competencia_nome", str(base.get("competencia_nome")));
        l.put("competencia_descricao", orNull(base.get("competencia_descricao")));
        l.put("nota_autoavaliacao", notaAuto);
        l.put("nota_gestor", notaAvaliador);
        l.put("nota_integrada", calcularNotaFinal(notaAuto, notaAvaliador));
        l.put("tipo", base.get("tipo") != null ? str(base.get("tipo")) : "tecnica");
        return l;
    }

    private static Integer asInt(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static int numOrOne(Object v) {
        Integer n = asInt(v);
        return n == null ? 1 : n;
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Map<String, Object> error(String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", message);
        return m;
    }

    private static boolean bool(Object v) {
        return Boolean.TRUE.equals(v);
    }

    private static boolean equalsId(Long a, long b) {
        return a != null && a == b;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asList(Object v) {
        if (v instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return new ArrayList<>();
    }

    private static Object orNull(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof String s && s.isEmpty()) {
            return null;
        }
        return v;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return "null";
        }
    }

    private static Long asLong(Object v) {
        if (v == null) {
            return null;
        }
        if (v instanceof Number n) {
            return n.longValue();
        }
        try {
            return Long.parseLong(String.valueOf(v));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }

    private static String textArray(List<String> values) {
        if (values == null || values.isEmpty()) return "{}";
        return "{" + String.join(",", values) + "}";
    }

    private static String bigintArray(List<Long> values) {
        if (values == null || values.isEmpty()) return "{}";
        return "{" + values.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining(",")) + "}";
    }
}
