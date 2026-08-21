package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de avaliacaoGestor.service.ts.
 * create() faz UPSERT preservando o formulario_id (chave: pessoa_id + unidade_id + tipo_inventario).
 * validar() dispara o cascade: marca a avaliacao_integrada vinculada (avaliacao_gestor_id) como
 * atualizacao_requisitada — inclui integradas já validadas.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AvaliacaoGestorService {

    private final JdbcTemplate jdbc;
    private final br.jus.tjgo.kaizen.service.notificacao.AvaliacoesNotificacoes avaliacoesNotificacoes;
    private final ObjectMapper objectMapper;
    private final AvaliacaoIntegradaService avaliacaoIntegradaService;

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
                "       (SELECT COUNT(*) FROM avaliacao_gestor_respostas r WHERE r.formulario_id = f.id) as total_respostas " +
                "FROM avaliacao_gestor_formularios f " +
                "LEFT JOIN users u ON u.id = f.avaliador_user_id " +
                "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                "WHERE " + whereClauses + " " +
                // Mantém só a avaliação mais recente por pessoa avaliada. A identidade é o
                // pessoa_id quando há autoavaliação vinculada; senão é a chave estável
                // (pessoa_user_id + unidade), que é o estado normal quando o diretor avalia o
                // gestor ANTES de existir autoavaliação (ver 6bbdac7). Sem o segundo ramo,
                // `f2.pessoa_id = f.pessoa_id` vira NULL = NULL, nunca é verdadeiro, e a
                // avaliação simplesmente some da relação.
                "  AND f.id = ( " +
                "    SELECT f2.id FROM avaliacao_gestor_formularios f2 " +
                "    WHERE f2.is_deleted = FALSE " +
                "      AND COALESCE(f2.tipo_inventario, 'equipe') = COALESCE(f.tipo_inventario, 'equipe') " +
                "      AND ( " +
                "            (f.pessoa_id IS NOT NULL AND f2.pessoa_id = f.pessoa_id) " +
                "         OR (f.pessoa_id IS NULL AND f2.pessoa_id IS NULL " +
                "             AND f2.pessoa_user_id IS NOT DISTINCT FROM f.pessoa_user_id " +
                "             AND f2.unidade_id IS NOT DISTINCT FROM f.unidade_id) " +
                "      ) " +
                "    ORDER BY f2.created_at DESC " +
                "    LIMIT 1 " +
                "  ) " +
                "ORDER BY f.created_at DESC";
    }

    public Map<String, Object> findById(long id) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT f.*, u.name as avaliador_user_name, cu.nome as unidade_nome " +
                        "FROM avaliacao_gestor_formularios f " +
                        "LEFT JOIN users u ON u.id = f.avaliador_user_id " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                id);
        if (formRows.isEmpty()) {
            return null;
        }
        List<Map<String, Object>> respostas = jdbc.queryForList(
                "SELECT * FROM avaliacao_gestor_respostas WHERE formulario_id = ? ORDER BY ordem", id);
        Map<String, Object> out = new LinkedHashMap<>(formRows.get(0));
        out.put("respostas", respostas);
        return out;
    }

    public Map<String, Object> findByPessoaAndUnidade(long pessoaId, long unidadeId) {
        return montarComRespostas(jdbc.queryForList(
                "SELECT f.*, cu.nome as unidade_nome " +
                        "FROM avaliacao_gestor_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.pessoa_id = ? AND f.unidade_id = ? AND f.is_deleted = FALSE " +
                        "ORDER BY f.created_at DESC LIMIT 1",
                pessoaId, unidadeId));
    }

    /** Detecção da avaliação existente pela chave estável da pessoa (gestor sem autoavaliação). */
    public Map<String, Object> findByPessoaUserIdAndUnidade(long pessoaUserId, long unidadeId) {
        return montarComRespostas(jdbc.queryForList(
                "SELECT f.*, cu.nome as unidade_nome " +
                        "FROM avaliacao_gestor_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.pessoa_user_id = ? AND f.unidade_id = ? AND f.is_deleted = FALSE " +
                        "ORDER BY f.created_at DESC LIMIT 1",
                pessoaUserId, unidadeId));
    }

    private Map<String, Object> montarComRespostas(List<Map<String, Object>> formRows) {
        if (formRows.isEmpty()) {
            return null;
        }
        Map<String, Object> form = formRows.get(0);
        List<Map<String, Object>> respostas = jdbc.queryForList(
                "SELECT * FROM avaliacao_gestor_respostas WHERE formulario_id = ? ORDER BY ordem", form.get("id"));
        Map<String, Object> out = new LinkedHashMap<>(form);
        out.put("respostas", respostas);
        return out;
    }

    /**
     * Gestor da unidade (cadastros_unidades.responsavel_user_id) como avaliável — mesmo sem
     * autoavaliação. Se ele já se autoavaliou nessa unidade/tipo, devolve o autoavaliacao_id
     * para o front reusar o item já listado. Retorna null quando a unidade não tem responsável.
     */
    public Map<String, Object> gestorDaUnidade(long unidadeId, String tipoInventario) {
        List<Map<String, Object>> uRows = jdbc.queryForList(
                "SELECT responsavel_user_id, responsavel, cargo_responsavel " +
                        "FROM cadastros_unidades WHERE id = ? LIMIT 1",
                unidadeId);
        if (uRows.isEmpty() || uRows.get(0).get("responsavel_user_id") == null) {
            return null;
        }
        Map<String, Object> u = uRows.get(0);
        long gestorUserId = ((Number) u.get("responsavel_user_id")).longValue();

        List<Map<String, Object>> auto = jdbc.queryForList(
                "SELECT id, email_institucional FROM autoavaliacao_formularios " +
                        "WHERE user_id = ? AND unidade_id = ? AND COALESCE(tipo_inventario, 'equipe') = ? " +
                        "  AND is_deleted = FALSE ORDER BY created_at DESC LIMIT 1",
                gestorUserId, unidadeId, tipoInventario);

        List<Map<String, Object>> userRows = jdbc.queryForList(
                "SELECT name, email FROM users WHERE id = ? LIMIT 1", gestorUserId);
        String nomeUser = userRows.isEmpty() ? null : str(userRows.get(0).get("name"));
        String emailUser = userRows.isEmpty() ? null : str(userRows.get(0).get("email"));

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("pessoa_user_id", gestorUserId);
        out.put("nome", u.get("responsavel") != null ? str(u.get("responsavel")) : nomeUser);
        out.put("cargo", u.get("cargo_responsavel"));
        out.put("autoavaliacao_id", auto.isEmpty() ? null : ((Number) auto.get(0).get("id")).longValue());
        out.put("email", auto.isEmpty() ? emailUser : str(auto.get(0).get("email_institucional")));
        return out;
    }

    /**
     * Colaboradores da unidade como avaliáveis, tenham ou não autoavaliação. Simétrico ao
     * {@link #gestorDaUnidade}: o gestor precisa poder avaliar antes de o colaborador se
     * autoavaliar, do mesmo jeito que o diretor avalia o gestor antes da autoavaliação dele.
     * Quando a autoavaliação existe, devolve o id dela — daí a avaliação já nasce vinculada
     * (pessoa_id) e a integração casa sem depender do backfill.
     * O responsável pela unidade fica de fora: ele é avaliado no inventário do gestor.
     */
    public List<Map<String, Object>> colaboradoresDaUnidade(long unidadeId, String tipoInventario) {
        return jdbc.queryForList(
                "SELECT cp.user_id AS pessoa_user_id, " +
                        "       COALESCE(NULLIF(TRIM(cp.nome), ''), u.name) AS nome, " +
                        "       COALESCE(NULLIF(TRIM(cp.cargo_efetivo), ''), NULLIF(TRIM(cp.cc_fc), '')) AS cargo, " +
                        "       COALESCE(af.email_institucional, cp.email, u.email) AS email, " +
                        "       af.id AS autoavaliacao_id " +
                        "FROM cadastros_pessoas cp " +
                        "JOIN users u ON u.id = cp.user_id AND u.is_deleted = FALSE " +
                        "LEFT JOIN LATERAL ( " +
                        "  SELECT a.id, a.email_institucional FROM autoavaliacao_formularios a " +
                        "  WHERE a.user_id = cp.user_id AND a.unidade_id = cp.unidade_id " +
                        "    AND COALESCE(a.tipo_inventario, 'equipe') = ? AND a.is_deleted = FALSE " +
                        "  ORDER BY a.created_at DESC LIMIT 1 " +
                        ") af ON TRUE " +
                        "WHERE cp.unidade_id = ? " +
                        "  AND COALESCE(cp.ativo, TRUE) = TRUE " +
                        "  AND cp.user_id IS NOT NULL " +
                        "  AND cp.user_id IS DISTINCT FROM ( " +
                        "        SELECT cu.responsavel_user_id FROM cadastros_unidades cu WHERE cu.id = cp.unidade_id " +
                        "      ) " +
                        "ORDER BY 2",
                tipoInventario, unidadeId);
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> data, long userId) {
        String tipoInv = data.get("tipo_inventario") != null ? str(data.get("tipo_inventario")) : "equipe";
        Long pessoaId = asLong(data.get("pessoa_id"));
        // Chave estável da pessoa avaliada (o gestor da unidade). Permite avaliar antes da
        // autoavaliação existir — ver migration 178 e o backfill em AutoavaliacaoService.
        Long pessoaUserId = asLong(data.get("pessoa_user_id"));
        Long unidadeId = asLong(data.get("unidade_id"));

        // Se avaliaram por pessoa_user_id (sem autoavaliação) mas já EXISTE uma autoavaliação da
        // pessoa nessa unidade/tipo, linka o pessoa_id agora — assim a integração já casa.
        if (pessoaId == null && pessoaUserId != null && unidadeId != null) {
            List<Map<String, Object>> auto = jdbc.queryForList(
                    "SELECT id FROM autoavaliacao_formularios " +
                            "WHERE user_id = ? AND unidade_id = ? AND COALESCE(tipo_inventario, 'equipe') = ? " +
                            "  AND is_deleted = FALSE ORDER BY created_at DESC LIMIT 1",
                    pessoaUserId, unidadeId, tipoInv);
            if (!auto.isEmpty()) {
                pessoaId = ((Number) auto.get(0).get("id")).longValue();
            }
        }

        // Dedup: por pessoa_id quando há autoavaliação vinculada; senão, pela chave estável
        // (pessoa_user_id). Evita duplicar a avaliação do mesmo gestor na mesma unidade.
        List<Map<String, Object>> existing = pessoaId != null
                ? jdbc.queryForList(
                        "SELECT id FROM avaliacao_gestor_formularios " +
                                "WHERE pessoa_id = ? AND unidade_id = ? AND COALESCE(tipo_inventario, 'equipe') = ? " +
                                "  AND is_deleted = FALSE " +
                                "  AND (validado_em IS NULL OR status = 'atualizacao_requisitada') " +
                                "ORDER BY id DESC LIMIT 1",
                        pessoaId, unidadeId, tipoInv)
                : pessoaUserId != null
                        ? jdbc.queryForList(
                                "SELECT id FROM avaliacao_gestor_formularios " +
                                        "WHERE pessoa_user_id = ? AND unidade_id = ? AND COALESCE(tipo_inventario, 'equipe') = ? " +
                                        "  AND is_deleted = FALSE " +
                                        "  AND (validado_em IS NULL OR status = 'atualizacao_requisitada') " +
                                        "ORDER BY id DESC LIMIT 1",
                                pessoaUserId, unidadeId, tipoInv)
                        : new ArrayList<>();

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
            log.error("[avaliacaoGestor.create] Erro ao buscar versão padrão: {}", err.getMessage());
        }

        long formularioId;
        if (!existing.isEmpty()) {
            formularioId = ((Number) existing.get(0).get("id")).longValue();
            jdbc.update(
                    "UPDATE avaliacao_gestor_formularios SET " +
                            "  pessoa_id = COALESCE(?, pessoa_id), pessoa_user_id = COALESCE(?, pessoa_user_id), " +
                            "  pessoa_nome = ?, pessoa_cargo = ?, pessoa_email = ?, " +
                            "  avaliador_user_id = ?, avaliador_nome = ?, cadastros_areas_id = (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1), diretoria = ?, unidade_id = ?, tipo_inventario = ?, " +
                            "  status = 'enviado', tecnicas_versao = ?, competencias_versao = ?, " +
                            "  validado_em = NULL, validado_por_id = NULL, validado_por_nome = NULL, " +
                            "  updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ?",
                    pessoaId, pessoaUserId,
                    str(data.get("pessoa_nome")), orNull(data.get("pessoa_cargo")), orNull(data.get("pessoa_email")),
                    userId, str(data.get("avaliador_nome")), str(data.get("diretoria")), str(data.get("diretoria")), unidadeId, tipoInv,
                    tecnicasVersao, competenciasVersao, userId, formularioId);
            // Salvaguarda anti-perda: só apaga as respostas existentes se o payload trouxer respostas.
            // Um save com lista vazia/ausente não pode zerar notas/comentários já gravados no rascunho.
            if (!asList(data.get("respostas")).isEmpty()) {
                jdbc.update("DELETE FROM avaliacao_gestor_respostas WHERE formulario_id = ?", formularioId);
            }
        } else {
            Map<String, Object> ins = jdbc.queryForMap(
                    "INSERT INTO avaliacao_gestor_formularios " +
                            "  (pessoa_id, pessoa_user_id, pessoa_nome, pessoa_cargo, pessoa_email, avaliador_user_id, avaliador_nome, cadastros_areas_id, diretoria, unidade_id, tipo_inventario, status, tecnicas_versao, competencias_versao, created_by, updated_by) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1), ?, ?, ?, 'enviado', ?, ?, ?, ?) " +
                            "RETURNING id",
                    pessoaId, pessoaUserId, str(data.get("pessoa_nome")), orNull(data.get("pessoa_cargo")), orNull(data.get("pessoa_email")),
                    userId, str(data.get("avaliador_nome")), str(data.get("diretoria")), str(data.get("diretoria")), unidadeId, tipoInv,
                    tecnicasVersao, competenciasVersao, userId, userId);
            formularioId = ((Number) ins.get("id")).longValue();
        }

        List<Map<String, Object>> respostas = asList(data.get("respostas"));
        for (int i = 0; i < respostas.size(); i++) {
            Map<String, Object> r = respostas.get(i);
            jdbc.update(
                    "INSERT INTO avaliacao_gestor_respostas (formulario_id, competencia_unidade_id, competencia_nome, competencia_descricao, nota, comentario, tipo, ordem) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    formularioId, asLong(r.get("competencia_unidade_id")), str(r.get("competencia_nome")),
                    orNull(r.get("competencia_descricao")), r.get("nota"), orNull(r.get("comentario")),
                    r.get("tipo") != null ? str(r.get("tipo")) : "tecnica", i + 1);
        }

        return findById(formularioId);
    }

    @Transactional
    public Map<String, Object> validar(long id, long userId, String userName) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT * FROM avaliacao_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            return error("Formulário não encontrado");
        }
        Map<String, Object> formulario = formRows.get(0);
        if (formulario.get("validado_em") != null) {
            return error("Formulário já foi validado");
        }
        if (!asLong(formulario.get("avaliador_user_id")).equals(userId)) {
            return error("Apenas o gestor que preencheu pode validar");
        }

        jdbc.update(
                "UPDATE avaliacao_gestor_formularios " +
                        "SET status = 'validado', validado_por_id = ?, validado_por_nome = ?, validado_em = NOW(), " +
                        "    versao_formulario = COALESCE(versao_formulario, 0) + 1, updated_by = ? " +
                        "WHERE id = ?",
                userId, userName, userId, id);

        Map<String, Object> formularioCompleto = findById(id);
        if (formularioCompleto != null) {
            try {
                int novaVersao = formularioCompleto.get("versao_formulario") != null
                        ? ((Number) formularioCompleto.get("versao_formulario")).intValue() : 1;
                jdbc.update(
                        "INSERT INTO avaliacao_gestor_versoes (formulario_id, versao, dados, validado_em, validado_nome) " +
                                "VALUES (?, ?, ?::jsonb, ?, ?) " +
                                "ON CONFLICT (formulario_id, versao) DO UPDATE SET dados = EXCLUDED.dados",
                        id, novaVersao, toJson(formularioCompleto),
                        formularioCompleto.get("validado_em"), formularioCompleto.get("validado_por_nome"));
            } catch (Exception err) {
                log.error("[validar] Erro ao salvar snapshot de versão: {}", err.getMessage());
            }
        }

        // Cascade: marca a avaliacao_integrada vinculada como atualizacao_requisitada (inclui já validadas).
        try {
            int tecV = numOr1(formulario.get("tecnicas_versao"));
            int padV = numOr1(formulario.get("competencias_versao"));
            jdbc.update(
                    "UPDATE avaliacao_integrada_formularios " +
                            "SET status = 'atualizacao_requisitada', updated_at = NOW() " +
                            "WHERE is_deleted = FALSE " +
                            "  AND avaliacao_gestor_id = ? " +
                            "  AND status <> 'atualizacao_requisitada' " +
                            "  AND ( " +
                            "        COALESCE(tecnicas_versao, 1) < ? " +
                            "     OR COALESCE(competencias_versao, 1) < ? " +
                            "  )",
                    id, tecV, padV);
        } catch (Exception err) {
            log.error("[validar] Erro ao cascatear atualização para avaliação integrada: {}", err.getMessage());
        }

        // Resultado Final: com a autoavaliacao do par ja validada, fecha a nota 70/30.
        avaliacaoIntegradaService.gerarPorAvaliacaoGestor(id);

        avaliacoesNotificacoes.aoAvaliacaoGestorValidada(id);
        return formularioCompleto;
    }

    public List<Map<String, Object>> findVersoes(long formularioId) {
        return jdbc.queryForList(
                "SELECT id, formulario_id, versao, validado_em, validado_nome, created_at " +
                        "FROM avaliacao_gestor_versoes WHERE formulario_id = ? ORDER BY versao DESC",
                formularioId);
    }

    public Object findVersaoDados(long formularioId, int versao) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT dados FROM avaliacao_gestor_versoes WHERE formulario_id = ? AND versao = ?",
                formularioId, versao);
        if (rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("dados");
    }

    public void delete(long id, long userId) {
        jdbc.update(
                "UPDATE avaliacao_gestor_formularios SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?",
                userId, id);
    }

    // ============================================================
    // Helpers
    // ============================================================

    private static Map<String, Object> error(String message) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("error", message);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asList(Object v) {
        if (v instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return new ArrayList<>();
    }

    private static int numOr1(Object v) {
        return v == null ? 1 : ((Number) v).intValue();
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
