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
 * Porte fiel de competenciasGestor.service.ts — Matriz/Referencial de Competências.
 * Workflow de 3 camadas identity-based:
 *  - tipo='equipe' SEMPRE 3 camadas (enviado → validado_autor → validado_diretoria → validado_final)
 *  - tipo='gestor' preenchido pelo gestor da macroárea: pula camada 1 (2 camadas)
 *  - tipo='gestor' preenchido pelo sub-diretor: 3 camadas normais
 * Recusa em camada 2/3 reseta as validações anteriores. validarFinal grava snapshot com o
 * catálogo de padrões capturado no momento; findVersoes faz self-healing do snapshot.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class CompetenciasGestorService {

    /** Validadores por diretoria (Camada 2) — declarado para paridade; NÃO referenciado.
     *  A regra real consulta cadastros_areas.gestor_user_id. NÃO REMOVER (paridade com o Node). */
    @SuppressWarnings("unused")
    private static final Map<String, String> VALIDADORES_DIRETORIA = Map.of(
            "DSTI", "dscjunior@tjgo.jus.br",
            "DITI", "gcparreira@tjgo.jus.br",
            "SGJT", "dcamaral@tjgo.jus.br",
            "GEJUT", "dcamaral@tjgo.jus.br");

    /** Validadores finais (Camada 3): constante compartilhada em {@link br.jus.tjgo.kaizen.util.Validadores}
     *  (reuso entre Matriz de Competências e Home, sem duplicar a lista). */
    private static boolean isValidadorFinal(String email) {
        return br.jus.tjgo.kaizen.util.Validadores.isFinal(email);
    }

    private final JdbcTemplate jdbc;
    private final br.jus.tjgo.kaizen.service.notificacao.CompetenciasMatrizNotificacoes matrizNotificacoes;
    private final ObjectMapper objectMapper;
    private final CompetenciasTecnicasAdminService tecnicasAdminService;

    public List<Map<String, Object>> findAllByDomain(List<Long> areasIds, String tipo) {
        StringBuilder sql = new StringBuilder(listSelect())
                .append(" WHERE f.is_deleted = FALSE AND f.cadastros_areas_id = ANY(?::bigint[])");
        List<Object> params = new ArrayList<>();
        params.add(bigintArray(areasIds));
        if (tipo != null) {
            params.add(tipo);
            sql.append(" AND f.tipo = ?");
        }
        sql.append(" ORDER BY f.created_at DESC");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    /**
     * Matrizes do domínio com a visibilidade do negócio.
     *
     * <p>Superadmin e validador final enxergam o domínio inteiro — o validador precisa, porque é na
     * listagem que fica o botão da camada final. Os demais só veem o que lhes diz respeito: o que
     * preencheram, as unidades onde são responsáveis
     * (<code>cadastros_unidades.responsavel_user_id</code>) e as áreas que dirigem
     * (<code>cadastros_areas.gestor_user_id / subdiretor_user_id</code>).
     *
     * <p>Sem esse recorte o gestor de uma unidade enxergava a matriz de todas as unidades do
     * domínio: a tela manda <code>diretoria</code>, parâmetro que o endpoint não lê, e caía-se no
     * domínio inteiro do usuário.
     */
    public List<Map<String, Object>> findVisiveis(
            List<Long> areasIds, String tipo, long userId, boolean isSuperadmin, String userEmail) {
        if (isSuperadmin || isValidadorFinal(userEmail)) {
            return findAllByDomain(areasIds, tipo);
        }
        StringBuilder sql = new StringBuilder(listSelect())
                .append(" WHERE f.is_deleted = FALSE AND f.cadastros_areas_id = ANY(?::bigint[])");
        List<Object> params = new ArrayList<>();
        params.add(bigintArray(areasIds));
        if (tipo != null) {
            params.add(tipo);
            sql.append(" AND f.tipo = ?");
        }
        sql.append(" AND ( f.user_id = ? ")
                .append("   OR EXISTS (SELECT 1 FROM cadastros_unidades cu2 ")
                .append("               WHERE cu2.id = f.unidade_id AND cu2.responsavel_user_id = ?) ")
                .append("   OR EXISTS (SELECT 1 FROM cadastros_areas ca2 ")
                .append("               WHERE ca2.id = f.cadastros_areas_id ")
                .append("                 AND (ca2.gestor_user_id = ? OR ca2.subdiretor_user_id = ?)) ")
                // Editor da área enxerga as matrizes do GESTOR da sua área — é o que ele preenche.
                .append("   OR ( f.tipo = 'gestor' AND EXISTS (SELECT 1 FROM competencias_gestor_editores e ")
                .append("               WHERE e.cadastros_areas_id = f.cadastros_areas_id AND e.user_id = ?)) ")
                // Editor da unidade enxerga a matriz da EQUIPE daquela unidade.
                .append("   OR ( f.tipo <> 'gestor' AND EXISTS (SELECT 1 FROM competencias_equipe_editores ee ")
                .append("               WHERE ee.cadastros_unidades_id = f.unidade_id AND ee.user_id = ?)) )");
        params.add(userId);
        params.add(userId);
        params.add(userId);
        params.add(userId);
        params.add(userId);
        params.add(userId);
        sql.append(" ORDER BY f.created_at DESC");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    /**
     * Mesma regra de visibilidade da listagem, para um registro só — sem isso, esconder a matriz da
     * lista não adiantaria: bastava pedir o id direto (IDOR). Vale para o formulário e para o
     * histórico de versões, que carrega o mesmo conteúdo.
     */
    public boolean podeVer(long id, long userId, boolean isSuperadmin, String userEmail) {
        if (isSuperadmin || isValidadorFinal(userEmail)) {
            return true;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 1 FROM competencias_gestor_formularios f " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE " +
                        "  AND ( f.user_id = ? " +
                        "    OR EXISTS (SELECT 1 FROM cadastros_unidades cu2 " +
                        "                WHERE cu2.id = f.unidade_id AND cu2.responsavel_user_id = ?) " +
                        "    OR EXISTS (SELECT 1 FROM cadastros_areas ca2 " +
                        "                WHERE ca2.id = f.cadastros_areas_id " +
                        "                  AND (ca2.gestor_user_id = ? OR ca2.subdiretor_user_id = ?)) " +
                        "    OR ( f.tipo = 'gestor' AND EXISTS (SELECT 1 FROM competencias_gestor_editores e " +
                        "                WHERE e.cadastros_areas_id = f.cadastros_areas_id AND e.user_id = ?)) " +
                        "    OR ( f.tipo <> 'gestor' AND EXISTS (SELECT 1 FROM competencias_equipe_editores ee " +
                        "                WHERE ee.cadastros_unidades_id = f.unidade_id AND ee.user_id = ?)) ) " +
                        "LIMIT 1",
                id, userId, userId, userId, userId, userId, userId);
        return !rows.isEmpty();
    }

    public List<Map<String, Object>> findAll(String diretoria, String tipo) {
        StringBuilder sql = new StringBuilder(listSelect()).append(" WHERE f.is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        if (diretoria != null) {
            params.add(diretoria);
            sql.append(" AND f.cadastros_areas_id = (SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1)");
        }
        if (tipo != null) {
            params.add(tipo);
            sql.append(" AND f.tipo = ?");
        }
        sql.append(" ORDER BY f.created_at DESC");
        return jdbc.queryForList(sql.toString(), params.toArray());
    }

    private static String listSelect() {
        return "SELECT f.*, " +
                "       u.name as user_name, " +
                "       cu.nome as unidade_nome, " +
                "       (SELECT COUNT(*) FROM competencias_gestor_itens i WHERE i.formulario_id = f.id) as total_competencias, " +
                "       va.name as validado_por_autor_nome, " +
                "       vd.name as validado_por_diretoria_nome, " +
                "       ( f.tipo = 'gestor' " +
               "         AND EXISTS (SELECT 1 FROM competencias_gestor_editores e " +
               "                      WHERE e.user_id = f.user_id AND e.cadastros_areas_id = f.cadastros_areas_id) " +
               "         AND NOT EXISTS (SELECT 1 FROM cadastros_areas ca2 WHERE ca2.id = f.cadastros_areas_id " +
               "                          AND (ca2.gestor_user_id = f.user_id OR ca2.subdiretor_user_id = f.user_id)) " +
               "         AND NOT EXISTS (SELECT 1 FROM cadastros_unidades cu2 WHERE cu2.id = f.unidade_id " +
               "                          AND cu2.responsavel_user_id = f.user_id) ) AS preenchido_por_editor, " +
               "       vf.name as validado_final_nome " +
                "FROM competencias_gestor_formularios f " +
                "LEFT JOIN users u ON u.id = f.user_id " +
                "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                "LEFT JOIN users va ON va.id = f.validado_por_autor_id " +
                "LEFT JOIN users vd ON vd.id = f.validado_por_diretoria_id " +
                "LEFT JOIN users vf ON vf.id = f.validado_final_id";
    }

    public Map<String, Object> findById(long id) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT f.*, u.name as user_name, cu.nome as unidade_nome, " +
                        "       va.name as validado_por_autor_nome, " +
                        "       vd.name as validado_por_diretoria_nome, " +
                        // Matriz do gestor preenchida por quem é APENAS editor não tem camada de
                        // autor — a tela usa isto para montar o stepper com 2 etapas.
                        "       ( f.tipo = 'gestor' " +
                        "         AND EXISTS (SELECT 1 FROM competencias_gestor_editores e " +
                        "                      WHERE e.user_id = f.user_id AND e.cadastros_areas_id = f.cadastros_areas_id) " +
                        "         AND NOT EXISTS (SELECT 1 FROM cadastros_areas ca2 WHERE ca2.id = f.cadastros_areas_id " +
                        "                          AND (ca2.gestor_user_id = f.user_id OR ca2.subdiretor_user_id = f.user_id)) " +
                        "         AND NOT EXISTS (SELECT 1 FROM cadastros_unidades cu2 WHERE cu2.id = f.unidade_id " +
                        "                          AND cu2.responsavel_user_id = f.user_id) ) AS preenchido_por_editor, " +
                        "       vf.name as validado_final_nome " +
                        "FROM competencias_gestor_formularios f " +
                        "LEFT JOIN users u ON u.id = f.user_id " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "LEFT JOIN users va ON va.id = f.validado_por_autor_id " +
                        "LEFT JOIN users vd ON vd.id = f.validado_por_diretoria_id " +
                        "LEFT JOIN users vf ON vf.id = f.validado_final_id " +
                        "WHERE f.id = ? AND f.is_deleted = FALSE",
                id);
        if (formRows.isEmpty()) {
            return null;
        }
        List<Map<String, Object>> itens = jdbc.queryForList(
                "SELECT * FROM competencias_gestor_itens WHERE formulario_id = ? ORDER BY ordem", id);
        Map<String, Object> out = new LinkedHashMap<>(formRows.get(0));
        out.put("competencias", itens);
        return out;
    }

    public Map<String, Object> findByUserId(long userId, String tipo) {
        StringBuilder sql = new StringBuilder(
                "SELECT f.*, cu.nome as unidade_nome " +
                        "FROM competencias_gestor_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "WHERE f.user_id = ? AND f.is_deleted = FALSE");
        List<Object> params = new ArrayList<>();
        params.add(userId);
        if (tipo != null) {
            params.add(tipo);
            sql.append(" AND f.tipo = ?");
        }
        sql.append(" ORDER BY f.created_at DESC LIMIT 1");

        List<Map<String, Object>> formRows = jdbc.queryForList(sql.toString(), params.toArray());
        if (formRows.isEmpty()) {
            return null;
        }
        Map<String, Object> form = formRows.get(0);
        List<Map<String, Object>> itens = jdbc.queryForList(
                "SELECT * FROM competencias_gestor_itens WHERE formulario_id = ? ORDER BY ordem", form.get("id"));
        Map<String, Object> out = new LinkedHashMap<>(form);
        out.put("competencias", itens);
        return out;
    }

    /**
     * A diretoria do formulário é a MACROÁREA da unidade selecionada (cadastros_unidades.area_id →
     * cadastros_areas.sigla), NÃO a diretoria de quem preenche/edita. Sem isso, um editor de outra
     * diretoria (ex.: validador final da SGJT editando um form da DPE) sobrescrevia a diretoria com
     * a dele. Cai no valor enviado pelo cliente apenas se a unidade não resolver a macroárea.
     */
    private String diretoriaDaUnidade(Long unidadeId, Object fallback) {
        if (unidadeId != null) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT a.sigla FROM cadastros_unidades u " +
                            "JOIN cadastros_areas a ON a.id = u.area_id " +
                            "WHERE u.id = ? LIMIT 1",
                    unidadeId);
            if (!rows.isEmpty() && rows.get(0).get("sigla") != null) {
                return str(rows.get(0).get("sigla"));
            }
        }
        return fallback != null ? str(fallback) : null;
    }

    /**
     * Macroárea (cadastros_areas.id) do formulário: resolvida pela unidade selecionada
     * (cadastros_unidades.area_id) e, se não resolver, pela sigla da diretoria. É a coluna que
     * as listagens usam para filtrar por diretoria.
     */
    private Long areaIdDaUnidade(Long unidadeId, String diretoriaSigla) {
        if (unidadeId != null) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT area_id FROM cadastros_unidades WHERE id = ? LIMIT 1", unidadeId);
            if (!rows.isEmpty() && rows.get(0).get("area_id") != null) {
                return asLong(rows.get(0).get("area_id"));
            }
        }
        if (diretoriaSigla != null) {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id FROM cadastros_areas WHERE sigla = ? LIMIT 1", diretoriaSigla);
            if (!rows.isEmpty()) {
                return asLong(rows.get(0).get("id"));
            }
        }
        return null;
    }

    @Transactional
    public Map<String, Object> create(Map<String, Object> data, long userId) {
        String tipo = data.get("tipo") != null ? str(data.get("tipo")) : "equipe";
        Long unidadeId = asLong(data.get("unidade_id"));
        String diretoria = diretoriaDaUnidade(unidadeId, data.get("diretoria"));
        // A macroárea (cadastros_areas_id) é a fonte de verdade da diretoria pós-refactor; sem
        // gravá-la aqui, o formulário some das listagens filtradas por diretoria.
        Long cadastrosAreasId = areaIdDaUnidade(unidadeId, diretoria);

        Map<String, Object> formulario = jdbc.queryForMap(
                "INSERT INTO competencias_gestor_formularios " +
                        "  (user_id, nome_completo, matricula, cargo_funcao, email_institucional, diretoria, cadastros_areas_id, unidade_id, qtd_colaboradores, tipo, status, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'enviado', ?, ?) RETURNING *",
                userId, str(data.get("nome_completo")), str(data.get("matricula")), str(data.get("cargo_funcao")),
                str(data.get("email_institucional")), diretoria, cadastrosAreasId, unidadeId,
                data.get("qtd_colaboradores") != null ? data.get("qtd_colaboradores") : 0, tipo, userId, userId);
        long formularioId = ((Number) formulario.get("id")).longValue();

        List<Map<String, Object>> competencias = asList(data.get("competencias"));
        for (int i = 0; i < competencias.size(); i++) {
            Map<String, Object> c = competencias.get(i);
            jdbc.update(
                    "INSERT INTO competencias_gestor_itens (formulario_id, ordem, nome, descricao, peso, grau_minimo_esperado, aplicabilidade, quantidade_pessoas) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    formularioId, i + 1, str(c.get("nome")), str(c.get("descricao")), pesoLegado(c),
                    grauMinimo(c), orNull(c.get("aplicabilidade")), orNull(c.get("quantidade_pessoas")));
        }

        if ("equipe".equals(tipo) && unidadeId != null) {
            syncCompetenciasPorUnidade(unidadeId, formularioId, competencias);
        }

        return findById(formularioId);
    }

    /** Verificar se o usuário pode editar o formulário com base no status e papel. */
    public Map<String, Object> canEdit(long id, long userId, String userEmail) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT user_id, status, diretoria, tipo, unidade_id FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE",
                id);
        if (rows.isEmpty()) {
            return notAllowed("Formulário não encontrado");
        }
        Map<String, Object> form = rows.get(0);
        String email = userEmail.toLowerCase().trim();
        String status = (String) form.get("status");

        if ("validado_final".equals(status)) {
            return notAllowed("Formulário já recebeu validação final e não pode ser editado");
        }
        if ("validado_diretoria".equals(status)) {
            if (isValidadorFinal(email)) {
                return allowed();
            }
            return notAllowed("Formulário já validado pela diretoria. Apenas o validador final pode editar");
        }

        Long gestorMacroId = null;
        Long subdiretorMacroId = null;
        try {
            List<Map<String, Object>> areaRows = jdbc.queryForList(
                    "SELECT gestor_user_id, subdiretor_user_id FROM cadastros_areas " +
                            "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                    str(form.get("diretoria")));
            if (!areaRows.isEmpty()) {
                gestorMacroId = asLong(areaRows.get(0).get("gestor_user_id"));
                subdiretorMacroId = asLong(areaRows.get(0).get("subdiretor_user_id"));
            }
        } catch (Exception ex) {
            List<Map<String, Object>> areaRows = jdbc.queryForList(
                    "SELECT gestor_user_id FROM cadastros_areas " +
                            "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                    str(form.get("diretoria")));
            if (!areaRows.isEmpty()) {
                gestorMacroId = asLong(areaRows.get(0).get("gestor_user_id"));
            }
        }

        boolean isAutor = equalsId(form.get("user_id"), userId);
        boolean isGestorMacro = gestorMacroId != null && userId == gestorMacroId;
        boolean isSubdiretorMacro = subdiretorMacroId != null && userId == subdiretorMacroId;
        boolean isFinal = isValidadorFinal(email);
        boolean isMatrizGestor = "gestor".equals(form.get("tipo"));
        // Editor da área preenche a matriz do GESTOR de qualquer unidade dela.
        boolean isEditor = isMatrizGestor
                && isEditorDaArea(areaIdDoFormulario(form.get("diretoria")), userId);
        // Editor da unidade preenche a matriz da EQUIPE daquela unidade.
        boolean isEditorEquipe = !isMatrizGestor
                && isEditorDaUnidade(asLong(form.get("unidade_id")), userId);

        if (isAutor || isGestorMacro || isSubdiretorMacro || isFinal || isEditor || isEditorEquipe) {
            return allowed();
        }
        return notAllowed("Você não tem permissão para editar este formulário");
    }

    @Transactional
    public Map<String, Object> update(long id, Map<String, Object> data, long userId, String userEmail) {
        List<Map<String, Object>> existingRows = jdbc.queryForList(
                "SELECT status, user_id, diretoria, tipo FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE",
                id);
        if (existingRows.isEmpty()) {
            throw new IllegalStateException("Formulário não encontrado");
        }
        Map<String, Object> existing = existingRows.get(0);

        Map<String, Object> editCheck = canEdit(id, userId, userEmail);
        if (!Boolean.TRUE.equals(editCheck.get("allowed"))) {
            String reason = (String) editCheck.get("reason");
            throw new IllegalStateException(reason != null ? reason : "Sem permissão para editar");
        }

        // Auto-validar camada 1 quando o gestor da macroárea edita, em status 'enviado', um formulário
        // cuja camada de autor ainda faz parte do fluxo — matriz do gestor preenchida por outra pessoa
        // (gestor da unidade ou sub-diretor), ou matriz da equipe preenchida pelo sub-diretor.
        boolean autoValidateAutor = false;
        try {
            List<Map<String, Object>> areaRows = jdbc.queryForList(
                    "SELECT gestor_user_id, subdiretor_user_id FROM cadastros_areas " +
                            "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                    str(existing.get("diretoria")));
            if (!areaRows.isEmpty()) {
                Long gestorMacroId = asLong(areaRows.get(0).get("gestor_user_id"));
                Long subdiretorId = asLong(areaRows.get(0).get("subdiretor_user_id"));
                boolean isGestorEditando = gestorMacroId != null && userId == gestorMacroId;
                boolean isTipoGestor = "gestor".equals(existing.get("tipo"));
                boolean camadaAutorPendente = isTipoGestor
                        ? (gestorMacroId != null && requerValidacaoAutor(true, existing.get("user_id"), gestorMacroId))
                        : (subdiretorId != null && equalsId(existing.get("user_id"), subdiretorId));
                boolean statusEnviado = "enviado".equals(existing.get("status"));
                if (isGestorEditando && camadaAutorPendente && statusEnviado) {
                    autoValidateAutor = true;
                }
            }
        } catch (Exception ignored) {
            // paridade com o try/catch silencioso do Node
        }

        // Diretoria = macroárea da unidade (não a do editor). Ver diretoriaDaUnidade.
        Long updUnidadeId = asLong(data.get("unidade_id"));
        String updDiretoria = diretoriaDaUnidade(updUnidadeId, data.get("diretoria"));
        jdbc.update(
                "UPDATE competencias_gestor_formularios SET " +
                        "  nome_completo = ?, matricula = ?, cargo_funcao = ?, email_institucional = ?, " +
                        "  diretoria = ?, unidade_id = ?, qtd_colaboradores = ?, " +
                        "  updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ? AND is_deleted = FALSE",
                str(data.get("nome_completo")), str(data.get("matricula")), str(data.get("cargo_funcao")),
                str(data.get("email_institucional")), updDiretoria, updUnidadeId,
                data.get("qtd_colaboradores") != null ? data.get("qtd_colaboradores") : 0, userId, id);

        if (autoValidateAutor) {
            // Só o id: `validado_por_autor_nome` NÃO é coluna da tabela — é derivada no SELECT pelo
            // LEFT JOIN users va (ver listSelect/findById). Escrever nela quebrava o save com 42703.
            jdbc.update(
                    "UPDATE competencias_gestor_formularios SET " +
                            "  status = 'validado_autor', validado_por_autor_id = ?, validado_por_autor_em = NOW() " +
                            "WHERE id = ?",
                    userId, id);
            // Auto-validou a camada 1 (o diretor editou matriz preenchida por outra pessoa) → avisa
            // a diretoria, igual validarAutor.
            matrizNotificacoes.aoValidarAutor(findById(id));
        }

        List<Map<String, Object>> competencias = asList(data.get("competencias"));
        // Salvaguarda anti-perda: um save sem competências no payload NÃO pode apagar a matriz
        // autoral (nome/descrição/peso) já gravada. O bloco de itens é a última etapa do método,
        // então retornamos preservando o que já existe (o UPDATE dos metadados do formulário,
        // acima, já foi aplicado).
        if (competencias.isEmpty()) {
            return findById(id);
        }

        List<Map<String, Object>> oldItens = jdbc.queryForList(
                "SELECT nome, descricao, peso, aplicabilidade, quantidade_pessoas " +
                        "FROM competencias_gestor_itens WHERE formulario_id = ? ORDER BY ordem", id);
        Map<String, Map<String, Object>> oldByName = new LinkedHashMap<>();
        for (Map<String, Object> o : oldItens) {
            oldByName.put(str(o.get("nome")), o);
        }

        jdbc.update("DELETE FROM competencias_gestor_itens WHERE formulario_id = ?", id);

        for (int i = 0; i < competencias.size(); i++) {
            Map<String, Object> c = competencias.get(i);
            Map<String, Object> o = oldByName.get(str(c.get("nome")));
            boolean isAlterada = o == null
                    || !java.util.Objects.equals(strOrEmpty(o.get("descricao")), strOrEmpty(c.get("descricao")))
                    || !java.util.Objects.equals(asLong(o.get("peso")), asLong(c.get("peso")))
                    || !java.util.Objects.equals(strOrNull(o.get("aplicabilidade")), strOrNull(c.get("aplicabilidade")))
                    || numOr0(o.get("quantidade_pessoas")) != numOr0(c.get("quantidade_pessoas"));
            jdbc.update(
                    "INSERT INTO competencias_gestor_itens (formulario_id, ordem, nome, descricao, peso, grau_minimo_esperado, aplicabilidade, quantidade_pessoas, alterada) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
                    id, i + 1, str(c.get("nome")), str(c.get("descricao")), pesoLegado(c),
                    grauMinimo(c), orNull(c.get("aplicabilidade")), orNull(c.get("quantidade_pessoas")), isAlterada);
        }

        boolean itensChanged = oldItens.size() != competencias.size();
        if (!itensChanged) {
            for (int i = 0; i < oldItens.size(); i++) {
                Map<String, Object> o = oldItens.get(i);
                Map<String, Object> n = competencias.get(i);
                if (!java.util.Objects.equals(str(o.get("nome")), str(n.get("nome")))
                        || !java.util.Objects.equals(strOrEmpty(o.get("descricao")), strOrEmpty(n.get("descricao")))
                        || !java.util.Objects.equals(asLong(o.get("peso")), asLong(n.get("peso")))
                        || !java.util.Objects.equals(strOrNull(o.get("aplicabilidade")), strOrNull(n.get("aplicabilidade")))
                        || numOr0(o.get("quantidade_pessoas")) != numOr0(n.get("quantidade_pessoas"))) {
                    itensChanged = true;
                    break;
                }
            }
        }

        if (itensChanged) {
            jdbc.update(
                    "UPDATE competencias_gestor_formularios " +
                            "SET tecnicas_versao = COALESCE(tecnicas_versao, 1) + 1, " +
                            "    tecnicas_propagacao_pendente = TRUE, updated_at = NOW() " +
                            "WHERE id = ?",
                    id);
            List<Map<String, Object>> statusRows = jdbc.queryForList(
                    "SELECT status FROM competencias_gestor_formularios WHERE id = ?", id);
            if (!statusRows.isEmpty() && "validado_final".equals(statusRows.get(0).get("status"))) {
                try {
                    tecnicasAdminService.propagarParaInventario(id);
                } catch (Exception err) {
                    log.error("[update] Erro ao propagar alterações de técnicas: {}", err.getMessage());
                }
            }
        }

        String tipo = data.get("tipo") != null ? str(data.get("tipo"))
                : (existing.get("tipo") != null ? str(existing.get("tipo")) : "equipe");
        Long unidadeId = asLong(data.get("unidade_id"));
        if ("equipe".equals(tipo) && unidadeId != null) {
            jdbc.update("DELETE FROM competencias_por_unidade WHERE origem_formulario_id = ?", id);
            syncCompetenciasPorUnidade(unidadeId, id, competencias);
        }

        return findById(id);
    }

    public void syncCompetenciasPorUnidade(long unidadeId, long formularioId, List<Map<String, Object>> competencias) {
        for (Map<String, Object> c : competencias) {
            jdbc.update(
                    "INSERT INTO competencias_por_unidade (unidade_id, nome, descricao, peso, grau_minimo_esperado, aplicabilidade, quantidade_pessoas, origem_formulario_id) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    unidadeId, str(c.get("nome")), str(c.get("descricao")), pesoLegado(c),
                    grauMinimo(c), orNull(c.get("aplicabilidade")), orNull(c.get("quantidade_pessoas")), formularioId);
        }
    }

    public List<Map<String, Object>> findCompetenciasByUnidade(long unidadeId) {
        return jdbc.queryForList(
                "SELECT cpu.*, cu.nome as unidade_nome " +
                        "FROM competencias_por_unidade cpu " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = cpu.unidade_id " +
                        "JOIN competencias_gestor_formularios cgf ON cgf.id = cpu.origem_formulario_id " +
                        "WHERE cpu.unidade_id = ? " +
                        "  AND cgf.is_deleted = FALSE " +
                        "  AND cgf.validado_final_em IS NOT NULL " +
                        "ORDER BY cpu.created_at ASC, cpu.id ASC",
                unidadeId);
    }

    /**
     * Ids das unidades com a Matriz de Competências (do tipo) validada até a camada final.
     * Retorna Integer (a coluna unidade_id é int4) para o JSON sair como número — o front
     * cruza esses ids com os de /unidades-lideranca, que também vêm como número. Long seria
     * serializado como string pelo JacksonConfig e quebraria a interseção por tipo.
     */
    public List<Integer> unidadesComMatrizValidada(String tipo) {
        return jdbc.queryForList(
                "SELECT DISTINCT unidade_id FROM competencias_gestor_formularios " +
                        "WHERE tipo = ? AND is_deleted = FALSE AND validado_final_em IS NOT NULL " +
                        "  AND unidade_id IS NOT NULL",
                Integer.class, tipo);
    }

    public List<Map<String, Object>> findCompetenciasGestorByUnidade(long unidadeId) {
        return jdbc.queryForList(
                "SELECT cgi.id, cgi.nome, cgi.descricao, cgi.peso, cgi.aplicabilidade, cgi.quantidade_pessoas, " +
                        "       cgf.unidade_id, cu.nome as unidade_nome " +
                        "FROM competencias_gestor_itens cgi " +
                        "JOIN competencias_gestor_formularios cgf ON cgf.id = cgi.formulario_id " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = cgf.unidade_id " +
                        "WHERE cgf.unidade_id = ? " +
                        "  AND cgf.tipo = 'gestor' " +
                        "  AND cgf.is_deleted = FALSE " +
                        "  AND cgf.validado_final_em IS NOT NULL " +
                        "ORDER BY cgi.ordem ASC, cgi.id ASC",
                unidadeId);
    }

    public List<Map<String, Object>> findFormulariosPreenchidos(long userId, String userEmail, String tipo) {
        // Gestor: a autorização vem de gestor_user_id/subdiretor_user_id (não da tabela
        // autorizacoes_formulario_competencias, que é do fluxo de "equipe"). Sem este ramo os
        // formulários de gestor já preenchidos nunca apareciam para edição — some após salvar.
        if ("gestor".equals(tipo)) {
            return jdbc.queryForList(
                    "SELECT cgf.id, cgf.unidade_id, cu.nome as unidade_nome, " +
                            "       cgf.status, cgf.created_at, cgf.updated_at, " +
                            "       (SELECT COUNT(*) FROM competencias_gestor_itens i WHERE i.formulario_id = cgf.id) as total_competencias " +
                            "FROM competencias_gestor_formularios cgf " +
                            "JOIN cadastros_unidades cu ON cu.id = cgf.unidade_id AND (cu.ativo IS NOT FALSE) " +
                            "WHERE cgf.tipo = 'gestor' AND cgf.is_deleted = FALSE " +
                            // Além dos que ele mesmo preencheu, o EDITOR alcança os das unidades da
                            // sua área — senão, depois de preenchido, o formulário sumia da mão dele
                            // (findUnidadesAutorizadas exclui unidade que já tem matriz).
                            "  AND ( cgf.user_id = ? " +
                            "     OR EXISTS (SELECT 1 FROM competencias_gestor_editores e " +
                            "                 WHERE e.cadastros_areas_id = cu.area_id AND e.user_id = ?) ) " +
                            "ORDER BY cu.nome",
                    userId, userId);
        }
        return jdbc.queryForList(
                "SELECT cgf.id, cgf.unidade_id, cu.nome as unidade_nome, " +
                        "       cgf.status, cgf.created_at, cgf.updated_at, " +
                        "       (SELECT COUNT(*) FROM competencias_gestor_itens i WHERE i.formulario_id = cgf.id) as total_competencias " +
                        "FROM autorizacoes_formulario_competencias afc " +
                        "JOIN cadastros_unidades cu " +
                        "  ON LOWER(TRIM(cu.nome)) = LOWER(TRIM(afc.unidade_nome)) " +
                        "  AND (cu.ativo IS NOT FALSE) " +
                        "JOIN competencias_gestor_formularios cgf " +
                        "  ON cgf.unidade_id = cu.id " +
                        "  AND cgf.user_id = ? " +
                        "  AND cgf.tipo = ? " +
                        "  AND cgf.is_deleted = FALSE " +
                        "WHERE LOWER(TRIM(afc.email)) = LOWER(TRIM(?)) " +
                        "  AND COALESCE(afc.tipo, 'equipe') = ? " +
                        "ORDER BY cu.nome",
                userId, tipo, userEmail, tipo);
    }

    public List<Map<String, Object>> findUnidadesAutorizadas(long userId, String userEmail, String tipo) {
        // Superadmin preenche a matriz de QUALQUER unidade, de qualquer área — é a mesma
        // prerrogativa do editor, sem o recorte. Sem este ramo a tela de preenchimento não oferece
        // unidade nenhuma para ele, porque as consultas abaixo partem sempre de um vínculo
        // (direção da área, gestão da unidade ou associação de editor) que o superadmin não tem.
        if (isSuperadmin(userId)) {
            return jdbc.queryForList(
                    "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id, ca.sigla AS area_sigla " +
                            "FROM cadastros_unidades cu " +
                            "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                            "WHERE cu.ativo IS NOT FALSE " +
                            "  AND COALESCE(ca.ativo, TRUE) = TRUE " +
                            ("gestor".equals(tipo)
                                    ? "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla)) "
                                    : "") +
                            "  AND NOT EXISTS ( " +
                            "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                            "    WHERE cgf.unidade_id = cu.id AND cgf.tipo = ? AND cgf.is_deleted = FALSE " +
                            "  ) " +
                            "ORDER BY ca.sigla, cu.nome",
                    tipo);
        }
        if ("gestor".equals(tipo)) {
            // Além do diretor e do sub-diretor da macroárea, o GESTOR DA UNIDADE preenche a matriz do
            // gestor da própria unidade (cadastros_unidades.responsavel_user_id) — nesse caso ele
            // valida a camada 1 e a matriz segue para diretoria e validação final.
            try {
                return jdbc.queryForList(
                        "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                                "FROM cadastros_unidades cu " +
                                "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                                "WHERE (ca.gestor_user_id = ? OR ca.subdiretor_user_id = ? OR cu.responsavel_user_id = ? " +
                                // Editor da área: alcança TODAS as unidades dela, inclusive as
                                // criadas depois de ele ter sido associado.
                                "     OR EXISTS (SELECT 1 FROM competencias_gestor_editores e " +
                                "                 WHERE e.cadastros_areas_id = ca.id AND e.user_id = ?)) " +
                                "  AND (cu.ativo IS NOT FALSE) " +
                                "  AND COALESCE(ca.ativo, TRUE) = TRUE " +
                                "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla)) " +
                                "  AND NOT EXISTS ( " +
                                "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                                "    WHERE cgf.unidade_id = cu.id AND cgf.tipo = 'gestor' AND cgf.is_deleted = FALSE " +
                                "  ) " +
                                "ORDER BY cu.nome",
                        userId, userId, userId, userId);
            } catch (Exception ex) {
                return jdbc.queryForList(
                        "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                                "FROM cadastros_unidades cu " +
                                "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                                "WHERE ca.gestor_user_id = ? " +
                                "  AND (cu.ativo IS NOT FALSE) " +
                                "  AND COALESCE(ca.ativo, TRUE) = TRUE " +
                                "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla)) " +
                                "  AND NOT EXISTS ( " +
                                "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                                "    WHERE cgf.unidade_id = cu.id AND cgf.tipo = 'gestor' AND cgf.is_deleted = FALSE " +
                                "  ) " +
                                "ORDER BY cu.nome",
                        userId);
            }
        }

        try {
            return jdbc.queryForList(
                    "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id, ca.sigla AS area_sigla " +
                            "FROM cadastros_unidades cu " +
                            "LEFT JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                            "WHERE ( cu.responsavel_user_id = ? " +
                            // Editor da matriz da equipe: preenche a da unidade a que foi associado.
                            "     OR EXISTS (SELECT 1 FROM competencias_equipe_editores ee " +
                            "                 WHERE ee.cadastros_unidades_id = cu.id AND ee.user_id = ?) ) " +
                            "  AND (cu.ativo IS NOT FALSE) " +
                            "  AND NOT EXISTS ( " +
                            "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                            "    WHERE cgf.unidade_id = cu.id AND cgf.tipo = ? AND cgf.is_deleted = FALSE " +
                            "  ) " +
                            "ORDER BY cu.nome",
                    userId, userId, tipo);
        } catch (Exception ex) {
            return new ArrayList<>();
        }
    }

    public List<Map<String, Object>> findTodasUnidadesAutorizadas(String userDiretoria, Long userId) {
        if (userId == null) {
            return new ArrayList<>();
        }
        try {
            return jdbc.queryForList(
                    "SELECT DISTINCT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                            "FROM cadastros_unidades cu " +
                            "LEFT JOIN users u ON u.cadastros_unidades_id = cu.id AND u.id = ? AND u.is_deleted = FALSE " +
                            "WHERE (cu.ativo IS NOT FALSE) " +
                            // O vínculo do colaborador com a unidade é mantido em
                            // cadastros_pessoas — é o que a tela de cadastro da unidade edita e
                            // o que `eh-colaborador-equipe` consulta. users.cadastros_unidades_id
                            // é um espelho que nem sempre acompanha, então sozinho ele deixava o
                            // colaborador sem nenhuma unidade pra escolher na autoavaliação.
                            "  AND (u.id IS NOT NULL " +
                            "       OR cu.responsavel_user_id = ? " +
                            "       OR EXISTS ( " +
                            "         SELECT 1 FROM cadastros_pessoas cp " +
                            "         WHERE cp.unidade_id = cu.id AND cp.user_id = ? " +
                            "           AND COALESCE(cp.ativo, TRUE) = TRUE " +
                            "       )) " +
                            "  AND EXISTS ( " +
                            "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                            "    WHERE cgf.unidade_id = cu.id AND cgf.is_deleted = FALSE " +
                            "  ) " +
                            "ORDER BY cu.nome",
                    userId, userId, userId);
        } catch (Exception ex) {
            return jdbc.queryForList(
                    "SELECT DISTINCT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                            "FROM cadastros_unidades cu " +
                            "JOIN users u ON u.cadastros_unidades_id = cu.id " +
                            "WHERE u.id = ? " +
                            "  AND u.is_deleted = FALSE " +
                            "  AND (cu.ativo IS NOT FALSE) " +
                            "  AND EXISTS ( " +
                            "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                            "    WHERE cgf.unidade_id = cu.id AND cgf.is_deleted = FALSE " +
                            "  ) " +
                            "ORDER BY cu.nome",
                    userId);
        }
    }

    public boolean verificarAcesso(String userEmail, Long userId) {
        if (userId == null) {
            return false;
        }
        try {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*)::int as count FROM cadastros_areas WHERE gestor_user_id = ? AND COALESCE(ativo, TRUE) = TRUE",
                    Integer.class, userId);
            if (count != null && count > 0) {
                return true;
            }
        } catch (Exception ignored) {
        }
        try {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*)::int as count FROM cadastros_areas WHERE subdiretor_user_id = ? AND COALESCE(ativo, TRUE) = TRUE",
                    Integer.class, userId);
            if (count != null && count > 0) {
                return true;
            }
        } catch (Exception ignored) {
        }
        try {
            Integer count = jdbc.queryForObject(
                    "SELECT COUNT(*)::int as count FROM cadastros_unidades WHERE responsavel_user_id = ? AND (ativo IS NOT FALSE)",
                    Integer.class, userId);
            if (count != null && count > 0) {
                return true;
            }
        } catch (Exception ex) {
            return false;
        }
        // Editor de matriz (do gestor, por área; da equipe, por unidade): sem este ramo o módulo
        // inteiro ficaria escondido para quem só tem esse papel.
        try {
            return !areasOndeEhEditor(userId).isEmpty()
                    || !unidadesOndeEhEditorEquipe(userId).isEmpty();
        } catch (Exception ex) {
            return false;
        }
    }

    /**
     * A camada 1 (autor) faz parte do fluxo deste formulário?
     *
     * <p>Matriz da EQUIPE: sempre — 3 camadas (autor → diretoria → final).
     *
     * <p>Matriz do GESTOR: depende de quem preencheu. O gestor da unidade e o sub-diretor validam a
     * própria camada antes de a matriz subir para a diretoria (3 camadas). Quando quem preencheu foi
     * o próprio diretor da área (<code>cadastros_areas.gestor_user_id</code>) não há camada de autor
     * a cumprir — restam diretoria + final (2 camadas).
     */
    private static boolean requerValidacaoAutor(boolean isGestor, Object autorUserId, long gestorMacroId) {
        return !isGestor || !equalsId(autorUserId, gestorMacroId);
    }

    /**
     * Mesma pergunta, para um formulário concreto: além do diretor, quem preenche como
     * <b>apenas editor</b> também não gera camada de autor. O editor só preenche — a matriz sobe
     * direto para a diretoria e depois para a validação final (2 camadas).
     */
    private boolean requerValidacaoAutor(Map<String, Object> form, long gestorMacroId) {
        boolean isGestor = "gestor".equals(form.get("tipo"));
        if (!requerValidacaoAutor(isGestor, form.get("user_id"), gestorMacroId)) {
            return false;
        }
        Object autorUserId = form.get("user_id");
        return autorUserId == null
                || !ehApenasEditor(form, ((Number) autorUserId).longValue());
    }

    // ============================================================
    // EDITORES DA MATRIZ DO GESTOR (por macroárea)
    // ============================================================

    /**
     * O usuário é superadmin? Consultado pelo <b>id</b>, e não pelo token da requisição, porque
     * quem pergunta nem sempre é o usuário logado: {@link #ehApenasEditor} pergunta pelo AUTOR do
     * formulário para saber quantas camadas de validação aquele formulário tem.
     */
    private boolean isSuperadmin(long userId) {
        return !jdbc.queryForList(
                "SELECT 1 FROM users WHERE id = ? AND is_superadmin = TRUE LIMIT 1",
                userId).isEmpty();
    }

    /**
     * O usuário é editor da matriz do gestor desta macroárea?
     *
     * <p>Superadmin é editor de <b>todas</b> as áreas, sem precisar de associação. É a mesma
     * prerrogativa do editor comum — preencher e salvar a matriz do gestor — só que sem o recorte
     * de área, e por consequência vale também para o fluxo de validação: matriz que ele preenche
     * não gera camada de autor, exatamente como a de qualquer editor.
     */
    public boolean isEditorDaArea(Long cadastrosAreasId, long userId) {
        // Antes da guarda de área nula de propósito: o alcance do superadmin não depende de a
        // sigla da diretoria resolver para uma área cadastrada.
        if (isSuperadmin(userId)) {
            return true;
        }
        if (cadastrosAreasId == null) {
            return false;
        }
        return !jdbc.queryForList(
                "SELECT 1 FROM competencias_gestor_editores " +
                        "WHERE cadastros_areas_id = ? AND user_id = ? LIMIT 1",
                cadastrosAreasId, userId).isEmpty();
    }

    /** Áreas onde o usuário é editor. Vazio quando não é editor de nenhuma. */
    public List<Map<String, Object>> areasOndeEhEditor(long userId) {
        if (isSuperadmin(userId)) {
            return jdbc.queryForList(
                    "SELECT ca.id, ca.sigla, ca.nome FROM cadastros_areas ca " +
                            "WHERE COALESCE(ca.ativo, TRUE) = TRUE ORDER BY ca.sigla");
        }
        return jdbc.queryForList(
                "SELECT ca.id, ca.sigla, ca.nome " +
                        "FROM competencias_gestor_editores e " +
                        "JOIN cadastros_areas ca ON ca.id = e.cadastros_areas_id " +
                        "WHERE e.user_id = ? AND COALESCE(ca.ativo, TRUE) = TRUE " +
                        "ORDER BY ca.sigla",
                userId);
    }

    // ============================================================
    // EDITORES DA MATRIZ DA EQUIPE (por unidade)
    // ============================================================

    /**
     * O usuário é editor da matriz da equipe desta unidade?
     *
     * <p>Superadmin é editor de <b>todas</b> as unidades, sem precisar de associação.
     */
    public boolean isEditorDaUnidade(Long cadastrosUnidadesId, long userId) {
        if (isSuperadmin(userId)) {
            return true;
        }
        if (cadastrosUnidadesId == null) {
            return false;
        }
        return !jdbc.queryForList(
                "SELECT 1 FROM competencias_equipe_editores " +
                        "WHERE cadastros_unidades_id = ? AND user_id = ? LIMIT 1",
                cadastrosUnidadesId, userId).isEmpty();
    }

    /** Unidades onde o usuário é editor da matriz da equipe. */
    public List<Map<String, Object>> unidadesOndeEhEditorEquipe(long userId) {
        if (isSuperadmin(userId)) {
            return jdbc.queryForList(
                    "SELECT cu.id, cu.sigla, cu.nome FROM cadastros_unidades cu " +
                            "WHERE cu.ativo IS NOT FALSE ORDER BY cu.nome");
        }
        return jdbc.queryForList(
                "SELECT cu.id, cu.sigla, cu.nome " +
                        "FROM competencias_equipe_editores e " +
                        "JOIN cadastros_unidades cu ON cu.id = e.cadastros_unidades_id " +
                        "WHERE e.user_id = ? AND cu.ativo IS NOT FALSE " +
                        "ORDER BY cu.nome",
                userId);
    }

    /** Unidades cujos editores o usuário pode administrar — aquelas de que ele é o gestor. */
    public List<Map<String, Object>> unidadesQueGerencia(long userId, boolean isSuperadmin) {
        if (isSuperadmin) {
            return jdbc.queryForList(
                    "SELECT cu.id, cu.sigla, cu.nome FROM cadastros_unidades cu " +
                            "WHERE cu.ativo IS NOT FALSE ORDER BY cu.nome");
        }
        return jdbc.queryForList(
                "SELECT cu.id, cu.sigla, cu.nome FROM cadastros_unidades cu " +
                        "WHERE cu.responsavel_user_id = ? AND cu.ativo IS NOT FALSE " +
                        "ORDER BY cu.nome",
                userId);
    }

    /** Só o gestor da unidade (e superadmin) administra os editores dela. */
    public boolean podeGerenciarEditoresEquipe(long cadastrosUnidadesId, long userId, boolean isSuperadmin) {
        if (isSuperadmin) {
            return true;
        }
        return isGestorDaUnidade(cadastrosUnidadesId, userId);
    }

    /** A unidade está sem responsável cadastrado? */
    private boolean unidadeSemGestor(Long cadastrosUnidadesId) {
        if (cadastrosUnidadesId == null) {
            return true;
        }
        return jdbc.queryForList(
                "SELECT 1 FROM cadastros_unidades WHERE id = ? AND responsavel_user_id IS NOT NULL LIMIT 1",
                cadastrosUnidadesId).isEmpty();
    }

    /** O usuário é o responsável cadastrado da unidade? */
    private boolean isGestorDaUnidade(Long cadastrosUnidadesId, long userId) {
        if (cadastrosUnidadesId == null) {
            return false;
        }
        return !jdbc.queryForList(
                "SELECT 1 FROM cadastros_unidades WHERE id = ? AND responsavel_user_id = ? " +
                        "  AND ativo IS NOT FALSE LIMIT 1",
                cadastrosUnidadesId, userId).isEmpty();
    }

    public List<Map<String, Object>> listEditoresEquipe(long cadastrosUnidadesId) {
        return jdbc.queryForList(
                "SELECT e.id, e.user_id, e.created_at, u.name AS user_name, u.email AS user_email " +
                        "FROM competencias_equipe_editores e " +
                        "JOIN users u ON u.id = e.user_id " +
                        "WHERE e.cadastros_unidades_id = ? " +
                        "ORDER BY u.name",
                cadastrosUnidadesId);
    }

    @Transactional
    public void addEditorEquipe(long cadastrosUnidadesId, long novoEditorId, long porUserId) {
        jdbc.update(
                "INSERT INTO competencias_equipe_editores (cadastros_unidades_id, user_id, created_by) " +
                        "VALUES (?, ?, ?) ON CONFLICT (cadastros_unidades_id, user_id) DO NOTHING",
                cadastrosUnidadesId, novoEditorId, porUserId);
    }

    @Transactional
    public void removeEditorEquipe(long cadastrosUnidadesId, long editorId) {
        jdbc.update(
                "DELETE FROM competencias_equipe_editores WHERE cadastros_unidades_id = ? AND user_id = ?",
                cadastrosUnidadesId, editorId);
    }

    /**
     * O usuário é <b>apenas</b> editor da equipe neste formulário — alcança a matriz pela
     * associação de editor da unidade e por nenhum outro papel. Quem acumula editor com gestão da
     * unidade ou direção da área continua com as prerrogativas do papel que já tinha.
     */
    private boolean ehApenasEditorEquipe(Map<String, Object> form, long userId) {
        Long unidadeId = asLong(form.get("unidade_id"));
        if (!isEditorDaUnidade(unidadeId, userId)) {
            return false;
        }
        if (isGestorDaUnidade(unidadeId, userId)) {
            return false;
        }
        Long areaId = areaIdDoFormulario(form.get("diretoria"));
        boolean isDirecao = areaId != null && !jdbc.queryForList(
                "SELECT 1 FROM cadastros_areas WHERE id = ? " +
                        "  AND (gestor_user_id = ? OR subdiretor_user_id = ?) LIMIT 1",
                areaId, userId, userId).isEmpty();
        return !isDirecao;
    }

    /** Editores cadastrados numa área. */
    public List<Map<String, Object>> listEditores(long cadastrosAreasId) {
        return jdbc.queryForList(
                "SELECT e.id, e.user_id, e.created_at, u.name AS user_name, u.email AS user_email " +
                        "FROM competencias_gestor_editores e " +
                        "JOIN users u ON u.id = e.user_id " +
                        "WHERE e.cadastros_areas_id = ? " +
                        "ORDER BY u.name",
                cadastrosAreasId);
    }

    /** Associa um editor à área. Repetir a associação é no-op (constraint única). */
    @Transactional
    public void addEditor(long cadastrosAreasId, long userId, long solicitanteId) {
        jdbc.update(
                "INSERT INTO competencias_gestor_editores (cadastros_areas_id, user_id, created_by) " +
                        "VALUES (?, ?, ?) ON CONFLICT (cadastros_areas_id, user_id) DO NOTHING",
                cadastrosAreasId, userId, solicitanteId);
    }

    @Transactional
    public boolean removeEditor(long editorId, long cadastrosAreasId) {
        return jdbc.update(
                "DELETE FROM competencias_gestor_editores WHERE id = ? AND cadastros_areas_id = ?",
                editorId, cadastrosAreasId) > 0;
    }

    /** Só o diretor e o sub-diretor da área (e superadmin) administram os editores dela. */
    public boolean podeGerenciarEditores(long cadastrosAreasId, long userId, boolean isSuperadmin) {
        if (isSuperadmin) {
            return true;
        }
        return !jdbc.queryForList(
                "SELECT 1 FROM cadastros_areas WHERE id = ? " +
                        "  AND (gestor_user_id = ? OR subdiretor_user_id = ?) LIMIT 1",
                cadastrosAreasId, userId, userId).isEmpty();
    }

    /** Macroárea de um formulário, pela sigla gravada em `diretoria`. */
    private Long areaIdDoFormulario(Object diretoriaSigla) {
        if (diretoriaSigla == null) {
            return null;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id FROM cadastros_areas WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) " +
                        "  AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                str(diretoriaSigla));
        return rows.isEmpty() ? null : asLong(rows.get(0).get("id"));
    }

    /**
     * Quem pode validar a camada 1 do formulário.
     *
     * <p>Regra geral (inalterada): o autor valida a própria camada.
     *
     * <p>Na matriz do GESTOR entram dois ajustes por causa da figura do editor:
     * <ul>
     *   <li>o <b>gestor da unidade</b> também pode validar — quando um editor preenche em nome
     *       dele, é ele quem referenda o que foi escrito;</li>
     *   <li>quem é <b>apenas editor</b> não valida, mesmo sendo o autor do formulário. O papel do
     *       editor é só preencher; deixá-lo validar faria a matriz subir sem ninguém da unidade
     *       ter conferido.</li>
     * </ul>
     */
    private boolean podeValidarAutor(Map<String, Object> form, long userId) {
        boolean isAutor = equalsId(form.get("user_id"), userId);
        if (!"gestor".equals(form.get("tipo"))) {
            Object autorUserId = form.get("user_id");
            boolean preenchidaPorEditor = autorUserId != null
                    && ehApenasEditorEquipe(form, ((Number) autorUserId).longValue());
            if (preenchidaPorEditor) {
                // Matriz da equipe preenchida por editor: a camada 1 é do GESTOR DA UNIDADE. Ele
                // delegou o preenchimento mas segue respondendo pelo que sai da unidade dele — o
                // editor só salva, nunca valida.
                Long unidadeId = asLong(form.get("unidade_id"));
                if (isGestorDaUnidade(unidadeId, userId)) {
                    return true;
                }
                // Unidade sem responsável cadastrado não pode deixar o formulário travado: nesse
                // caso a camada volta para quem preencheu.
                return unidadeSemGestor(unidadeId) && isAutor;
            }
            return isAutor;
        }
        // Guarda defensiva: matriz preenchida por editor nem tem camada 1 (ver
        // requerValidacaoAutor), então esta etapa não é dele em hipótese alguma.
        return isAutor && !ehApenasEditor(form, userId);
    }

    /**
     * O usuário é <b>apenas</b> editor neste formulário — isto é, alcança a matriz pela associação
     * de editor da área e por nenhum outro papel.
     *
     * <p>O "apenas" é o que importa: quem acumula editor com direção da área ou gestão da unidade
     * continua com as prerrogativas do papel que já tinha.
     */
    private boolean ehApenasEditor(Map<String, Object> form, long userId) {
        Long areaId = areaIdDoFormulario(form.get("diretoria"));
        if (!isEditorDaArea(areaId, userId)) {
            return false;
        }
        boolean isDirecao = !jdbc.queryForList(
                "SELECT 1 FROM cadastros_areas WHERE id = ? " +
                        "  AND (gestor_user_id = ? OR subdiretor_user_id = ?) LIMIT 1",
                areaId, userId, userId).isEmpty();
        Long unidadeId = asLong(form.get("unidade_id"));
        boolean isGestorDaUnidade = unidadeId != null && !jdbc.queryForList(
                "SELECT 1 FROM cadastros_unidades WHERE id = ? AND responsavel_user_id = ? " +
                        "  AND (ativo IS NOT FALSE) LIMIT 1",
                unidadeId, userId).isEmpty();
        return !isDirecao && !isGestorDaUnidade;
    }

    /** Camada 1: Validação do autor. */
    @Transactional
    public Map<String, Object> validarAutor(long id, long userId) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT id, user_id, status, tipo, diretoria, unidade_id " +
                        "FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            throw new IllegalStateException("Formulário não encontrado");
        }
        Map<String, Object> form = formRows.get(0);
        if (!podeValidarAutor(form, userId)) {
            throw new IllegalStateException("Apenas o autor pode validar nesta etapa");
        }
        String status = (String) form.get("status");
        if (List.of("validado_autor", "validado_diretoria", "validado_final").contains(status)) {
            return findById(id);
        }
        if (!"enviado".equals(status)) {
            throw new IllegalStateException("Formulário precisa estar com status \"enviado\"");
        }

        jdbc.update(
                "UPDATE competencias_gestor_formularios SET " +
                        "  status = 'validado_autor', validado_por_autor_id = ?, validado_por_autor_em = NOW(), " +
                        "  recusado_por_id = NULL, recusado_por_nome = NULL, recusado_em = NULL, recusado_comentario = NULL, recusado_camada = NULL, " +
                        "  updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ?",
                userId, userId, id);
        Map<String, Object> f = findById(id);
        matrizNotificacoes.aoValidarAutor(f);
        return f;
    }

    /** Camada 2: Validação da diretoria. */
    @Transactional
    public Map<String, Object> validarDiretoria(long id, long userId, String userEmail) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT id, diretoria, status, tipo, user_id, unidade_id FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            throw new IllegalStateException("Formulário não encontrado");
        }
        Map<String, Object> form = formRows.get(0);
        String status = (String) form.get("status");
        if (List.of("validado_diretoria", "validado_final").contains(status)) {
            return findById(id);
        }

        boolean isGestor = "gestor".equals(form.get("tipo"));
        Object autorUserId = form.get("user_id");

        List<Map<String, Object>> areaRows;
        try {
            areaRows = jdbc.queryForList(
                    "SELECT gestor_user_id, subdiretor_user_id FROM cadastros_areas " +
                            "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                    str(form.get("diretoria")));
        } catch (Exception ex) {
            areaRows = jdbc.queryForList(
                    "SELECT gestor_user_id, NULL as subdiretor_user_id FROM cadastros_areas " +
                            "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                    str(form.get("diretoria")));
        }
        if (areaRows.isEmpty() || areaRows.get(0).get("gestor_user_id") == null) {
            throw new IllegalStateException("Nenhum gestor configurado para a diretoria " + str(form.get("diretoria")));
        }
        long gestorMacroId = asLong(areaRows.get(0).get("gestor_user_id"));

        boolean requerValidacaoAutor = requerValidacaoAutor(form, gestorMacroId);
        // Quando a camada do autor não faz parte do fluxo (matriz do gestor preenchida pelo próprio
        // diretor), \"validado_autor\" também serve: a tela do autor permitia validar a própria
        // camada e, exigindo só \"enviado\" aqui, a matriz ficava sem saída — nunca mais avançava.
        boolean statusOk = requerValidacaoAutor
                ? "validado_autor".equals(status)
                : ("enviado".equals(status) || "validado_autor".equals(status));
        if (!statusOk) {
            throw new IllegalStateException(requerValidacaoAutor
                    ? "Formulário precisa ter validação do autor primeiro"
                    : "Formulário precisa estar com status \"enviado\" ou \"validado_autor\"");
        }
        if (userId != gestorMacroId) {
            throw new IllegalStateException("Apenas o gestor da diretoria pode validar nesta etapa");
        }

        jdbc.update(
                "UPDATE competencias_gestor_formularios SET " +
                        "  status = 'validado_diretoria', validado_por_diretoria_id = ?, validado_por_diretoria_em = NOW(), " +
                        "  recusado_por_id = NULL, recusado_por_nome = NULL, recusado_em = NULL, recusado_comentario = NULL, recusado_camada = NULL, " +
                        "  updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ?",
                userId, userId, id);
        Map<String, Object> f = findById(id);
        matrizNotificacoes.aoValidarDiretoria(f);
        return f;
    }

    /** Camada 3: Validação final. */
    @Transactional
    public Map<String, Object> validarFinal(long id, long userId, String userEmail) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT id, status FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            throw new IllegalStateException("Formulário não encontrado");
        }
        String status = (String) formRows.get(0).get("status");
        if ("validado_final".equals(status)) {
            return findById(id);
        }
        if (!"validado_diretoria".equals(status)) {
            throw new IllegalStateException("Formulário precisa ter validação da diretoria primeiro");
        }
        if (!isValidadorFinal(userEmail)) {
            throw new IllegalStateException("Apenas o validador final pode realizar esta validação");
        }

        jdbc.update(
                "UPDATE competencias_gestor_formularios SET " +
                        "  status = 'validado_final', validado_final_id = ?, validado_final_em = NOW(), " +
                        "  versao_formulario = COALESCE(versao_formulario, 0) + 1, " +
                        "  updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ?",
                userId, userId, id);

        jdbc.update("UPDATE competencias_gestor_itens SET alterada = FALSE WHERE formulario_id = ?", id);

        Map<String, Object> formularioCompleto = findById(id);
        if (formularioCompleto != null) {
            try {
                Object padroesSnapshot = capturarPadroesSnapshot();
                int novaVersao = formularioCompleto.get("versao_formulario") != null
                        ? ((Number) formularioCompleto.get("versao_formulario")).intValue() : 1;
                Map<String, Object> snapshot = new LinkedHashMap<>(formularioCompleto);
                snapshot.put("status", "validado_final");
                snapshot.put("padroes", padroesSnapshot);
                jdbc.update(
                        "INSERT INTO competencias_gestor_versoes (formulario_id, versao, dados, validado_final_em, validado_final_nome) " +
                                "VALUES (?, ?, ?::jsonb, ?, ?) " +
                                "ON CONFLICT (formulario_id, versao) DO UPDATE SET dados = EXCLUDED.dados",
                        id, novaVersao, toJson(snapshot),
                        formularioCompleto.get("validado_final_em"), formularioCompleto.get("validado_final_nome"));
            } catch (Exception err) {
                log.error("[validarFinal] Erro ao salvar snapshot de versão: {}", err.getMessage());
            }
        }

        try {
            tecnicasAdminService.propagarParaInventario(id);
        } catch (Exception err) {
            log.error("[validarFinal] Erro ao propagar alterações de técnicas: {}", err.getMessage());
        }

        try {
            jdbc.update(
                    "UPDATE competencias_gestor_formularios " +
                            "SET padroes_propagacao_pendente = FALSE, padroes_tipos_afetados = '[]'::jsonb " +
                            "WHERE id = ? AND padroes_propagacao_pendente = TRUE",
                    id);
        } catch (Exception err) {
            log.error("[validarFinal] Erro ao limpar flag de padrões: {}", err.getMessage());
        }

        if (formularioCompleto != null) {
            matrizNotificacoes.aoValidarFinal(formularioCompleto);
        }
        return formularioCompleto;
    }

    /** Recusar pela camada DIRETORIA — volta para 'enviado', limpa validação do autor. */
    @Transactional
    public Map<String, Object> recusarDiretoria(long id, long userId, String comentario) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT id, diretoria, status, tipo, user_id, unidade_id FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            throw new IllegalStateException("Formulário não encontrado");
        }
        Map<String, Object> form = formRows.get(0);
        boolean isGestor = "gestor".equals(form.get("tipo"));
        Object autorUserId = form.get("user_id");

        List<Map<String, Object>> areaRows = jdbc.queryForList(
                "SELECT gestor_user_id, subdiretor_user_id FROM cadastros_areas " +
                        "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                str(form.get("diretoria")));
        if (areaRows.isEmpty() || areaRows.get(0).get("gestor_user_id") == null) {
            throw new IllegalStateException("Nenhum gestor configurado para a diretoria " + str(form.get("diretoria")));
        }
        long gestorMacroId = asLong(areaRows.get(0).get("gestor_user_id"));
        boolean requerValidacaoAutor = requerValidacaoAutor(form, gestorMacroId);
        String statusValido = requerValidacaoAutor ? "validado_autor" : "enviado";
        if (!statusValido.equals(form.get("status"))) {
            throw new IllegalStateException("Formulário não está em estado válido para recusa pela diretoria");
        }
        if (userId != gestorMacroId) {
            throw new IllegalStateException("Apenas o gestor da diretoria pode recusar nesta etapa");
        }

        List<Map<String, Object>> uname = jdbc.queryForList("SELECT name FROM users WHERE id = ?", userId);
        String userName = (!uname.isEmpty() && uname.get(0).get("name") != null) ? String.valueOf(uname.get(0).get("name")) : null;

        jdbc.update(
                "UPDATE competencias_gestor_formularios SET " +
                        "  status = 'enviado', validado_por_autor_id = NULL, validado_por_autor_em = NULL, " +
                        "  recusado_por_id = ?, recusado_por_nome = ?, recusado_em = NOW(), recusado_comentario = ?, recusado_camada = 'diretoria', " +
                        "  updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ?",
                userId, userName, comentario, userId, id);
        Map<String, Object> f = findById(id);
        matrizNotificacoes.aoRecusar(f);
        return f;
    }

    /** Recusar pela camada FINAL — volta para 'enviado', limpa validações do autor e diretoria. */
    @Transactional
    public Map<String, Object> recusarFinal(long id, long userId, String userEmail, String comentario) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT id, status FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            throw new IllegalStateException("Formulário não encontrado");
        }
        if (!"validado_diretoria".equals(formRows.get(0).get("status"))) {
            throw new IllegalStateException("Formulário precisa ter validação da diretoria para ser recusado nesta etapa");
        }
        if (!isValidadorFinal(userEmail)) {
            throw new IllegalStateException("Apenas o validador final pode recusar nesta etapa");
        }

        List<Map<String, Object>> uname = jdbc.queryForList("SELECT name FROM users WHERE id = ?", userId);
        String userName = (!uname.isEmpty() && uname.get(0).get("name") != null) ? String.valueOf(uname.get(0).get("name")) : null;

        jdbc.update(
                "UPDATE competencias_gestor_formularios SET " +
                        "  status = 'enviado', validado_por_autor_id = NULL, validado_por_autor_em = NULL, " +
                        "  validado_por_diretoria_id = NULL, validado_por_diretoria_em = NULL, " +
                        "  recusado_por_id = ?, recusado_por_nome = ?, recusado_em = NOW(), recusado_comentario = ?, recusado_camada = 'final', " +
                        "  updated_at = NOW(), updated_by = ? " +
                        "WHERE id = ?",
                userId, userName, comentario, userId, id);
        Map<String, Object> f = findById(id);
        matrizNotificacoes.aoRecusar(f);
        return f;
    }

    /** Listar versões históricas com self-healing do snapshot final. */
    public List<Map<String, Object>> findVersoes(long formularioId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, formulario_id, versao, validado_final_em, validado_final_nome, created_at " +
                        "FROM competencias_gestor_versoes WHERE formulario_id = ? ORDER BY versao DESC",
                formularioId);

        Map<String, Object> form = findById(formularioId);
        if (form == null || form.get("validado_final_em") == null) {
            return rows;
        }

        int formVersao = form.get("versao_formulario") != null ? ((Number) form.get("versao_formulario")).intValue() : 1;
        int maxVersaoSalva = 0;
        for (Map<String, Object> r : rows) {
            int v = ((Number) r.get("versao")).intValue();
            if (v > maxVersaoSalva) {
                maxVersaoSalva = v;
            }
        }

        if (formVersao > maxVersaoSalva) {
            try {
                Object padroesSnapshot = capturarPadroesSnapshot();
                Map<String, Object> snapshot = new LinkedHashMap<>(form);
                snapshot.put("status", "validado_final");
                snapshot.put("padroes", padroesSnapshot);
                jdbc.update(
                        "INSERT INTO competencias_gestor_versoes (formulario_id, versao, dados, validado_final_em, validado_final_nome) " +
                                "VALUES (?, ?, ?::jsonb, ?, ?) " +
                                "ON CONFLICT (formulario_id, versao) DO UPDATE SET dados = EXCLUDED.dados",
                        formularioId, formVersao, toJson(snapshot),
                        form.get("validado_final_em"), form.get("validado_final_nome"));
                return jdbc.queryForList(
                        "SELECT id, formulario_id, versao, validado_final_em, validado_final_nome, created_at " +
                                "FROM competencias_gestor_versoes WHERE formulario_id = ? ORDER BY versao DESC",
                        formularioId);
            } catch (Exception err) {
                log.error("[findVersoes] Falha ao gerar snapshot self-healing: {}", err.getMessage());
            }
        }

        return rows;
    }

    public Object findVersaoDados(long formularioId, int versao) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT dados FROM competencias_gestor_versoes WHERE formulario_id = ? AND versao = ?",
                formularioId, versao);
        if (rows.isEmpty()) {
            return null;
        }
        return rows.get(0).get("dados");
    }

    public void delete(long id, long userId) {
        jdbc.update(
                "UPDATE competencias_gestor_formularios SET is_deleted = TRUE, deleted_at = NOW(), deleted_by = ? WHERE id = ?",
                userId, id);
    }

    // ============================================================
    // Helpers
    // ============================================================

    /** Snapshot dos padrões ativos agrupados por tipo (para o PDF histórico). */
    private Object capturarPadroesSnapshot() {
        try {
            List<Map<String, Object>> all = jdbc.queryForList(
                    "SELECT id, tipo, nome, descricao, ordem FROM competencias_padrao WHERE ativo = TRUE ORDER BY tipo, ordem, id");
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("comportamental", filterByTipo(all, "comportamental"));
            out.put("estrategica", filterByTipo(all, "estrategica"));
            out.put("gerencial", filterByTipo(all, "gerencial"));
            return out;
        } catch (Exception err) {
            log.error("[validarFinal] Erro ao capturar snapshot de padrões: {}", err.getMessage());
            return null;
        }
    }

    private static List<Map<String, Object>> filterByTipo(List<Map<String, Object>> all, String tipo) {
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> c : all) {
            if (tipo.equals(c.get("tipo"))) {
                out.add(c);
            }
        }
        return out;
    }

    private static Map<String, Object> allowed() {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("allowed", true);
        return m;
    }

    private static Map<String, Object> notAllowed(String reason) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("allowed", false);
        m.put("reason", reason);
        return m;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String, Object>> asList(Object v) {
        if (v instanceof List<?> list) {
            return (List<Map<String, Object>>) list;
        }
        return new ArrayList<>();
    }

    /**
     * Grau mínimo esperado (1..5) — o nível que a pessoa precisa atingir para ser considerada
     * capaz naquela competência. Substituiu o "Grau de Impacto" no formulário; 3 é o padrão, que
     * era o corte usado pelo relatório de Lacunas antes de o campo existir.
     */
    private static int grauMinimo(Map<String, Object> c) {
        Object v = c.get("grau_minimo_esperado");
        if (v == null) {
            return 3;
        }
        try {
            int n = Integer.parseInt(String.valueOf(v).trim());
            return n < 1 || n > 5 ? 3 : n;
        } catch (NumberFormatException e) {
            return 3;
        }
    }

    /**
     * `peso` saiu do formulário mas a coluna é NOT NULL e guarda o histórico do critério antigo
     * (Grau de Impacto). Preserva o valor quando ainda vier no payload; senão grava o default.
     */
    private static int pesoLegado(Map<String, Object> c) {
        Object v = c.get("peso");
        if (v == null) {
            return 1;
        }
        try {
            return Integer.parseInt(String.valueOf(v).trim());
        } catch (NumberFormatException e) {
            return 1;
        }
    }

    private static boolean equalsId(Object a, long b) {
        return a instanceof Number n && n.longValue() == b;
    }

    private static boolean equalsId(Object a, Long b) {
        return a instanceof Number n && b != null && n.longValue() == b;
    }

    private static int numOr0(Object v) {
        return v == null ? 0 : ((Number) v).intValue();
    }

    private static String strOrEmpty(Object v) {
        return v == null ? "" : String.valueOf(v);
    }

    private static String strOrNull(Object v) {
        return v == null ? null : String.valueOf(v);
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
