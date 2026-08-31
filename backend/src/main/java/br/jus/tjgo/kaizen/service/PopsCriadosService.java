package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.utils.SqlValue;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * CRUD dos POPs (Procedimento Operacional Padrão) criados no Kaizen (tabela pops_criados).
 * Todos os campos são texto (listas com um item por linha). Soft-delete via is_deleted.
 */
@Service
@RequiredArgsConstructor
public class PopsCriadosService {

    private final JdbcTemplate jdbc;

    // Campos de conteúdo editáveis pelo cliente. Não inclui os campos do fluxo de validação
    // (status/proposto/analisado/aprovado) nem data_versao — esses são gerenciados pelo servidor.
    private static final List<String> CAMPOS = List.of(
            "codigo", "nome_processo", "macroprocesso", "diretoria_orgao", "unidade_orgao",
            "area", "revisao", "servico", "objetivo", "unidade_responsavel",
            "siglas", "normativa", "descricao_procedimento", "gestor_processo",
            "sistemas_utilizados", "anexos", "fluxograma_nome", "fluxograma_data");

    /**
     * Campos NUMÉRICOS, gravados à parte de {@link #CAMPOS}.
     *
     * CAMPOS binda tudo com {@code str(...)}: uma coluna integer receberia uma String, o pgjdbc
     * mandaria VARCHAR e o Postgres quebraria com 42804. Aqui o valor passa por
     * {@link SqlValue#numeroOuNull} antes.
     */
    private static final List<String> CAMPOS_NUM = List.of("processo_id");

    // Colunas do fluxo de validação retornadas na listagem (sem os ids, só nomes/datas/status).
    private static final String WORKFLOW_COLS =
            "status, data_versao, proposto_por, proposto_em, analisado_por, analisado_em, " +
            "aprovado_por, aprovado_em";

    private static final List<String> CAMPOS_LISTA = java.util.stream.Stream
            .concat(CAMPOS.stream().filter(c -> !c.equals("fluxograma_data")), CAMPOS_NUM.stream())
            .toList();

    /**
     * A listagem omite fluxograma_data (imagem em base64, potencialmente grande): a tabela só
     * precisa saber se há anexo, pelo nome. O conteúdo vem no getById, usado para gerar o PDF.
     */
    public List<Map<String, Object>> list() {
        return jdbc.queryForList(
                "SELECT id, " + String.join(", ", CAMPOS_LISTA) + ", " + WORKFLOW_COLS +
                        ", created_at, updated_at " +
                        "FROM pops_criados WHERE is_deleted = FALSE ORDER BY created_at DESC, id DESC");
    }

    public Map<String, Object> getById(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM pops_criados WHERE id = ? AND is_deleted = FALSE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    /**
     * Cria o POP. {@code ocuparCamada1} diz se quem esta criando assume o "Proposto por".
     *
     * Falso quando um superadmin preenche o POP de um processo do qual nao e o Responsavel: nesse
     * caso ele so salva, a 1a camada fica VAGA, e o Responsavel assume as duas ao validar
     * (ver {@link #analisar}).
     */
    public Map<String, Object> create(long uid, String userName, Map<String, Object> body,
                                      boolean ocuparCamada1) {
        body = new java.util.HashMap<>(body);
        // Código é gerado pelo sistema: POP_<SIGLA DA DIRETORIA>_<nº sequencial na diretoria>.
        if (blankToNull(str(body.get("codigo"))) == null) {
            body.put("codigo", gerarCodigo(str(body.get("area"))));
        }
        // Revisão inicia em 000 (não editável no formulário).
        if (blankToNull(str(body.get("revisao"))) == null) {
            body.put("revisao", "000");
        }
        StringBuilder cols = new StringBuilder();
        StringBuilder ph = new StringBuilder();
        List<Object> params = new ArrayList<>();
        for (String campo : CAMPOS) {
            if (cols.length() > 0) {
                cols.append(", ");
                ph.append(", ");
            }
            cols.append(campo);
            ph.append("?");
            params.add(blankToNull(str(body.get(campo))));
        }
        for (String campo : CAMPOS_NUM) {
            cols.append(", ").append(campo);
            ph.append(", ?");
            params.add(SqlValue.numeroOuNull(body.get(campo)));
        }
        // Etapa 1 do fluxo: criar = propor. O status vai para 'proposto' de qualquer jeito; o que
        // muda e se o autor ocupa a camada ou se ela fica esperando o Responsavel.
        cols.append(", status");
        ph.append(", ?");
        params.add("proposto");
        if (ocuparCamada1) {
            cols.append(", proposto_por, proposto_por_id, proposto_em");
            ph.append(", ?, ?, CURRENT_TIMESTAMP");
            params.add(blankToNull(userName));
            params.add(uid);
        }

        Long id = jdbc.queryForObject(
                "INSERT INTO pops_criados (" + cols + ") VALUES (" + ph + ") RETURNING id",
                Long.class, params.toArray());
        return getById(id);
    }

    @Transactional
    public Map<String, Object> update(long id, Map<String, Object> body) {
        StringBuilder set = new StringBuilder();
        List<Object> params = new ArrayList<>();
        for (String campo : CAMPOS) {
            if (!body.containsKey(campo)) continue;
            if (set.length() > 0) set.append(", ");
            set.append(campo).append(" = ?");
            params.add(blankToNull(str(body.get(campo))));
        }
        for (String campo : CAMPOS_NUM) {
            if (!body.containsKey(campo)) continue;
            if (set.length() > 0) set.append(", ");
            set.append(campo).append(" = ?");
            params.add(SqlValue.numeroOuNull(body.get(campo)));
        }
        if (set.length() == 0) return getById(id);
        set.append(", updated_at = CURRENT_TIMESTAMP");
        params.add(id);
        jdbc.update("UPDATE pops_criados SET " + set + " WHERE id = ? AND is_deleted = FALSE",
                params.toArray());
        return getById(id);
    }

    @Transactional
    public boolean delete(long id) {
        int n = jdbc.update(
                "UPDATE pops_criados SET is_deleted = TRUE, updated_at = CURRENT_TIMESTAMP " +
                        "WHERE id = ? AND is_deleted = FALSE", id);
        return n > 0;
    }

    /**
     * 2a camada. Se a 1a estiver VAGA -- POP preenchido por superadmin que nao e o Responsavel --,
     * quem valida aqui assume TAMBEM a 1a: o nome dele passa a constar nas duas.
     *
     * Os COALESCE fazem isso sem tocar em POP que ja tem a camada 1 preenchida.
     */
    @Transactional
    public Map<String, Object> analisar(long id, long uid, String userName) {
        int n = jdbc.update(
                "UPDATE pops_criados SET status = 'analisado', analisado_por = ?, analisado_por_id = ?, " +
                        "analisado_em = CURRENT_TIMESTAMP, " +
                        "proposto_por = COALESCE(proposto_por, ?), " +
                        "proposto_por_id = COALESCE(proposto_por_id, ?), " +
                        "proposto_em = COALESCE(proposto_em, CURRENT_TIMESTAMP), " +
                        "updated_at = CURRENT_TIMESTAMP " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'proposto'",
                blankToNull(userName), uid, blankToNull(userName), uid, id);
        return n > 0 ? getById(id) : null;
    }

    /** Etapa 3: Diretor da área aprova (analisado → aprovado); carimba a Data da Versão de hoje. */
    @Transactional
    public Map<String, Object> aprovar(long id, long uid, String userName) {
        int n = jdbc.update(
                "UPDATE pops_criados SET status = 'aprovado', aprovado_por = ?, aprovado_por_id = ?, " +
                        "aprovado_em = CURRENT_TIMESTAMP, data_versao = to_char(CURRENT_DATE, 'YYYY-MM-DD'), " +
                        "updated_at = CURRENT_TIMESTAMP " +
                        "WHERE id = ? AND is_deleted = FALSE AND status = 'analisado'",
                blankToNull(userName), uid, id);
        return n > 0 ? getById(id) : null;
    }

    /** Recusa/reabre: volta o POP para 'proposto' e limpa análise/aprovação e a Data da Versão. */
    @Transactional
    public Map<String, Object> recusar(long id) {
        int n = jdbc.update(
                "UPDATE pops_criados SET status = 'proposto', analisado_por = NULL, analisado_por_id = NULL, " +
                        "analisado_em = NULL, aprovado_por = NULL, aprovado_por_id = NULL, aprovado_em = NULL, " +
                        "data_versao = NULL, updated_at = CURRENT_TIMESTAMP " +
                        "WHERE id = ? AND is_deleted = FALSE AND status IN ('analisado', 'aprovado')",
                id);
        return n > 0 ? getById(id) : null;
    }

    /**
     * Gestor (diretor) e sub-diretor da área do POP, resolvidos pela sigla (cadastros_areas).
     * Segue o mesmo modelo dos Processos: gestor_user_id = diretor; subdiretor_user_id = sub-diretor.
     * Retorna null se a área não existir no cadastro.
     */
    public Map<String, Object> gestoresDaArea(String areaSigla) {
        String sigla = blankToNull(areaSigla);
        if (sigla == null) return null;
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT gestor_user_id, subdiretor_user_id FROM cadastros_areas " +
                        "WHERE UPPER(sigla) = UPPER(?) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1",
                sigla);
        return rows.isEmpty() ? null : rows.get(0);
    }

    /**
     * Gera o código do POP no padrão POP_<SIGLA>_<NNN>, com a contagem sequencial reiniciando por
     * diretoria (sigla da área). Usa o MAIOR número já usado na área + 1 (conta inclusive os
     * excluídos, pra nunca reaproveitar número). Sem área definida, cai para "GERAL".
     */
    private String gerarCodigo(String area) {
        String sigla = blankToNull(area);
        sigla = (sigla == null ? "GERAL" : sigla.toUpperCase());
        Integer prox = jdbc.queryForObject(
                "SELECT COALESCE(MAX(CAST(regexp_replace(codigo, '^.*_', '') AS INTEGER)), 0) + 1 " +
                        "FROM pops_criados WHERE UPPER(area) = ? AND codigo ~ '_[0-9]+$'",
                Integer.class, sigla);
        return String.format("POP_%s_%03d", sigla, prox == null ? 1 : prox);
    }

    private String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
