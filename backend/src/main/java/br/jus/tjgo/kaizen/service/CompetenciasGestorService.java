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
                    "INSERT INTO competencias_gestor_itens (formulario_id, ordem, nome, descricao, peso, aplicabilidade, quantidade_pessoas) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    formularioId, i + 1, str(c.get("nome")), str(c.get("descricao")), c.get("peso"),
                    orNull(c.get("aplicabilidade")), orNull(c.get("quantidade_pessoas")));
        }

        if ("equipe".equals(tipo) && unidadeId != null) {
            syncCompetenciasPorUnidade(unidadeId, formularioId, competencias);
        }

        return findById(formularioId);
    }

    /** Verificar se o usuário pode editar o formulário com base no status e papel. */
    public Map<String, Object> canEdit(long id, long userId, String userEmail) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT user_id, status, diretoria, tipo FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE",
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

        if (isAutor || isGestorMacro || isSubdiretorMacro || isFinal) {
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

        // Auto-validar camada 1 quando o gestor da macroárea edita form do sub-diretor (status enviado).
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
                boolean foiPreenchidoPorSubdiretor = subdiretorId != null && equalsId(existing.get("user_id"), subdiretorId);
                boolean statusEnviado = "enviado".equals(existing.get("status"));
                if (isGestorEditando && foiPreenchidoPorSubdiretor && statusEnviado) {
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
            List<Map<String, Object>> uname = jdbc.queryForList("SELECT name FROM users WHERE id = ?", userId);
            String nomeGestor = (!uname.isEmpty() && uname.get(0).get("name") != null)
                    ? String.valueOf(uname.get(0).get("name")) : "Gestor da Macroárea";
            jdbc.update(
                    "UPDATE competencias_gestor_formularios SET " +
                            "  status = 'validado_autor', validado_por_autor_id = ?, validado_por_autor_nome = ?, validado_por_autor_em = NOW() " +
                            "WHERE id = ?",
                    userId, nomeGestor, id);
            // Auto-validou a camada 1 (gestor editou form do subdiretor) → avisa a diretoria, igual validarAutor.
            matrizNotificacoes.aoValidarAutor(findById(id));
        }

        List<Map<String, Object>> oldItens = jdbc.queryForList(
                "SELECT nome, descricao, peso, aplicabilidade, quantidade_pessoas " +
                        "FROM competencias_gestor_itens WHERE formulario_id = ? ORDER BY ordem", id);
        Map<String, Map<String, Object>> oldByName = new LinkedHashMap<>();
        for (Map<String, Object> o : oldItens) {
            oldByName.put(str(o.get("nome")), o);
        }

        jdbc.update("DELETE FROM competencias_gestor_itens WHERE formulario_id = ?", id);

        List<Map<String, Object>> competencias = asList(data.get("competencias"));
        for (int i = 0; i < competencias.size(); i++) {
            Map<String, Object> c = competencias.get(i);
            Map<String, Object> o = oldByName.get(str(c.get("nome")));
            boolean isAlterada = o == null
                    || !java.util.Objects.equals(strOrEmpty(o.get("descricao")), strOrEmpty(c.get("descricao")))
                    || !java.util.Objects.equals(asLong(o.get("peso")), asLong(c.get("peso")))
                    || !java.util.Objects.equals(strOrNull(o.get("aplicabilidade")), strOrNull(c.get("aplicabilidade")))
                    || numOr0(o.get("quantidade_pessoas")) != numOr0(c.get("quantidade_pessoas"));
            jdbc.update(
                    "INSERT INTO competencias_gestor_itens (formulario_id, ordem, nome, descricao, peso, aplicabilidade, quantidade_pessoas, alterada) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    id, i + 1, str(c.get("nome")), str(c.get("descricao")), c.get("peso"),
                    orNull(c.get("aplicabilidade")), orNull(c.get("quantidade_pessoas")), isAlterada);
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
                    "INSERT INTO competencias_por_unidade (unidade_id, nome, descricao, peso, aplicabilidade, quantidade_pessoas, origem_formulario_id) " +
                            "VALUES (?, ?, ?, ?, ?, ?, ?)",
                    unidadeId, str(c.get("nome")), str(c.get("descricao")), c.get("peso"),
                    orNull(c.get("aplicabilidade")), orNull(c.get("quantidade_pessoas")), formularioId);
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
                            "WHERE cgf.tipo = 'gestor' AND cgf.is_deleted = FALSE AND cgf.user_id = ? " +
                            "ORDER BY cu.nome",
                    userId);
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
        if ("gestor".equals(tipo)) {
            try {
                return jdbc.queryForList(
                        "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                                "FROM cadastros_unidades cu " +
                                "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                                "WHERE (ca.gestor_user_id = ? OR ca.subdiretor_user_id = ?) " +
                                "  AND (cu.ativo IS NOT FALSE) " +
                                "  AND COALESCE(ca.ativo, TRUE) = TRUE " +
                                "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla)) " +
                                "  AND NOT EXISTS ( " +
                                "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                                "    WHERE cgf.unidade_id = cu.id AND cgf.tipo = 'gestor' AND cgf.is_deleted = FALSE " +
                                "  ) " +
                                "ORDER BY cu.nome",
                        userId, userId);
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
                    "SELECT cu.id, cu.nome, cu.area_id, cu.unidade_superior_id " +
                            "FROM cadastros_unidades cu " +
                            "WHERE cu.responsavel_user_id = ? " +
                            "  AND (cu.ativo IS NOT FALSE) " +
                            "  AND NOT EXISTS ( " +
                            "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                            "    WHERE cgf.unidade_id = cu.id AND cgf.tipo = ? AND cgf.is_deleted = FALSE " +
                            "  ) " +
                            "ORDER BY cu.nome",
                    userId, tipo);
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
                            "  AND (u.id IS NOT NULL OR cu.responsavel_user_id = ?) " +
                            "  AND EXISTS ( " +
                            "    SELECT 1 FROM competencias_gestor_formularios cgf " +
                            "    WHERE cgf.unidade_id = cu.id AND cgf.is_deleted = FALSE " +
                            "  ) " +
                            "ORDER BY cu.nome",
                    userId, userId);
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
            return count != null && count > 0;
        } catch (Exception ex) {
            return false;
        }
    }

    /** Camada 1: Validação do autor. */
    @Transactional
    public Map<String, Object> validarAutor(long id, long userId) {
        List<Map<String, Object>> formRows = jdbc.queryForList(
                "SELECT id, user_id, status FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
        if (formRows.isEmpty()) {
            throw new IllegalStateException("Formulário não encontrado");
        }
        Map<String, Object> form = formRows.get(0);
        if (!equalsId(form.get("user_id"), userId)) {
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
                "SELECT id, diretoria, status, tipo, user_id FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
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
        Long subdiretorId = asLong(areaRows.get(0).get("subdiretor_user_id"));

        boolean preenchidoPorSubdiretor = isGestor && subdiretorId != null && equalsId(autorUserId, subdiretorId);
        boolean requerValidacaoAutor = !isGestor || preenchidoPorSubdiretor;
        String statusValido = requerValidacaoAutor ? "validado_autor" : "enviado";
        if (!statusValido.equals(status)) {
            throw new IllegalStateException(requerValidacaoAutor
                    ? "Formulário precisa ter validação do autor primeiro"
                    : "Formulário precisa estar com status \"enviado\"");
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
                "SELECT id, diretoria, status, tipo, user_id FROM competencias_gestor_formularios WHERE id = ? AND is_deleted = FALSE", id);
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
        Long subdiretorId = asLong(areaRows.get(0).get("subdiretor_user_id"));
        boolean preenchidoPorSubdiretor = isGestor && subdiretorId != null && equalsId(autorUserId, subdiretorId);
        boolean requerValidacaoAutor = !isGestor || preenchidoPorSubdiretor;
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
