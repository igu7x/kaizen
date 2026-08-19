package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.List;
import java.util.Map;

/**
 * Trilha de auditoria GLOBAL — leitura de {@code audit_log} sem restrição de módulo (todo o Kaizen).
 * O registro é feito pelos services de escrita via {@link AuditService}; aqui só consultamos, com o
 * ator resolvido a partir de {@code users}. Acesso restrito a superadmin (ver AuditoriaController).
 *
 * <p>A listagem é paginada por demanda (sem teto artificial): o cliente percorre todas as páginas e
 * chega a 100% dos registros. O detalhe de um registro (antes/depois) vem por {@link #buscarPorId}
 * — os JSONs de old/new ficam FORA da listagem pra não inflar o payload.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AuditoriaService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    /** Página padrão quando o cliente não pede tamanho. {@code tamanho <= 0} = traz tudo de uma vez. */
    private static final int TAMANHO_PADRAO = 200;

    /** Expressão que diz se o registro tem conteúdo de antes/depois pra abrir no detalhe. */
    private static final String TEM_DETALHE =
            "(a.old_values IS NOT NULL AND a.old_values::text <> 'null') " +
            "OR (a.new_values IS NOT NULL AND a.new_values::text <> 'null') " +
            "OR (a.changed_fields IS NOT NULL AND a.changed_fields::text <> 'null')";

    /**
     * Nome do item mexido, garimpado do próprio conteúdo gravado. Sem isso a listagem só consegue
     * dizer "nº 17", que não significa nada pra quem lê. Olha o depois primeiro (estado final) e
     * cai pro antes, que é o único lado que existe numa exclusão.
     */
    private static final String ITEM_NOME =
            "COALESCE(" +
            "  a.new_values->>'title', a.new_values->>'titulo', a.new_values->>'nome', " +
            "  a.new_values->>'name', a.new_values->>'objeto', a.new_values->>'object_name', " +
            "  a.new_values->>'tarefa', a.new_values->>'ponto_controle', " +
            "  a.new_values->>'deliberacao', a.new_values->>'item', " +
            "  a.new_values->>'item_pca', a.new_values->>'codigo', a.new_values->>'descricao', " +
            "  a.new_values->>'description', " +
            "  a.old_values->>'title', a.old_values->>'titulo', a.old_values->>'nome', " +
            "  a.old_values->>'name', a.old_values->>'objeto', a.old_values->>'object_name', " +
            "  a.old_values->>'tarefa', a.old_values->>'ponto_controle', " +
            "  a.old_values->>'deliberacao', a.old_values->>'item', " +
            "  a.old_values->>'item_pca', a.old_values->>'codigo', a.old_values->>'descricao', " +
            "  a.old_values->>'description')";

    /** Ações e tabelas distintas já registradas — alimenta os filtros da tela. */
    public Map<String, Object> facetas() {
        List<String> acoes = jdbc.queryForList(
                "SELECT DISTINCT action FROM audit_log ORDER BY action", String.class);
        List<String> tabelas = jdbc.queryForList(
                "SELECT DISTINCT table_name FROM audit_log ORDER BY table_name", String.class);
        return Map.of("acoes", acoes, "tabelas", tabelas);
    }

    /**
     * Monta o trecho de WHERE compartilhado entre a contagem e a listagem, acumulando os binds em
     * {@code args}. Sempre começa com {@code 1 = 1} pra concatenação ficar uniforme.
     */
    private String filtros(String acao, String tabela, String busca, List<Object> args) {
        StringBuilder w = new StringBuilder("1 = 1 ");
        if (acao != null && !acao.isBlank()) {
            w.append("AND a.action = ? ");
            args.add(acao.trim());
        }
        if (tabela != null && !tabela.isBlank()) {
            // Aceita 1+ tabelas separadas por vírgula (um "módulo" agrupa várias tabelas no front).
            List<String> tabs = new ArrayList<>();
            for (String t : tabela.split(",")) {
                String x = t.trim();
                if (!x.isEmpty()) tabs.add(x);
            }
            if (!tabs.isEmpty()) {
                w.append("AND a.table_name IN (")
                        .append(String.join(",", tabs.stream().map(t -> "?").toList()))
                        .append(") ");
                args.addAll(tabs);
            }
        }
        if (busca != null && !busca.isBlank()) {
            String termo = busca.trim();
            w.append("AND (a.action ILIKE ? OR a.table_name ILIKE ? OR u.name ILIKE ? " +
                    "OR COALESCE(u.email, a.user_email) ILIKE ? OR a.record_id::text = ?) ");
            String like = "%" + termo + "%";
            args.add(like);
            args.add(like);
            args.add(like);
            args.add(like);
            // Permite buscar direto pelo número do item (ex.: "17" acha o recurso #17).
            args.add(termo.replaceFirst("^#", ""));
        }
        return w.toString();
    }

    /**
     * Lista a trilha filtrada, do mais recente pro mais antigo.
     *
     * @param pagina  página 0-based (null = 0)
     * @param tamanho quantos por página; {@code <= 0} traz TODOS os registros do filtro
     * @return {@code {total, pagina, tamanho, itens}} — {@code total} é a contagem completa do
     *         filtro, independente da página, pra tela saber quanto ainda falta carregar.
     */
    public Map<String, Object> listar(String acao, String tabela, String busca,
                                      Integer pagina, Integer tamanho) {
        List<Object> args = new ArrayList<>();
        String where = filtros(acao, tabela, busca, args);

        Long total = jdbc.queryForObject(
                "SELECT count(*) FROM audit_log a LEFT JOIN users u ON u.id = a.user_id WHERE " + where,
                Long.class, args.toArray());

        StringBuilder sql = new StringBuilder(
                "SELECT a.id, a.created_at, a.action, a.table_name, a.record_id, a.user_id, " +
                "  u.name AS user_name, COALESCE(u.email, a.user_email) AS user_email, " +
                "  a.changed_fields::text AS changed_fields, " +
                "  " + ITEM_NOME + " AS item_nome, " +
                "  (" + TEM_DETALHE + ") AS tem_detalhe " +
                "FROM audit_log a " +
                "LEFT JOIN users u ON u.id = a.user_id " +
                "WHERE ").append(where)
                .append("ORDER BY a.created_at DESC, a.id DESC ");

        int p = (pagina == null || pagina < 0) ? 0 : pagina;
        int t = (tamanho == null) ? TAMANHO_PADRAO : tamanho;
        if (t > 0) {
            sql.append("LIMIT ").append(t).append(" OFFSET ").append((long) p * t);
        }

        List<Map<String, Object>> itens = jdbc.queryForList(sql.toString(), args.toArray());

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("total", total == null ? 0L : total);
        out.put("pagina", p);
        out.put("tamanho", t);
        out.put("itens", itens);
        return out;
    }

    /**
     * Registro completo, com os JSONs de antes/depois — é o que alimenta o diff da tela.
     * Retorna {@code null} se o id não existir.
     */
    public Map<String, Object> buscarPorId(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT a.id, a.created_at, a.action, a.table_name, a.record_id, a.user_id, " +
                "  u.name AS user_name, COALESCE(u.email, a.user_email) AS user_email, a.user_role, " +
                "  a.changed_fields::text AS changed_fields, " +
                "  a.old_values::text AS old_values, a.new_values::text AS new_values, " +
                "  a.ip_address::text AS ip_address, a.user_agent " +
                "FROM audit_log a " +
                "LEFT JOIN users u ON u.id = a.user_id " +
                "WHERE a.id = ?", id);
        if (rows.isEmpty()) return null;

        // Nunca devolver segredo pra tela: o hash de senha do users, por exemplo, está no JSON.
        Map<String, Object> reg = new LinkedHashMap<>(rows.get(0));
        for (String campo : new String[]{"old_values", "new_values", "changed_fields"}) {
            reg.put(campo, mascarar((String) reg.get(campo)));
        }
        reg.put("referencias", referencias(
                lerJson((String) reg.get("old_values")),
                lerJson((String) reg.get("new_values"))));
        return reg;
    }

    private JsonNode lerJson(String json) {
        if (json == null || json.isBlank() || "null".equals(json)) return null;
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * Colunas de chave estrangeira que a tela consegue traduzir em nome. Sem isso o comparativo
     * mostra "Área: de 2 para 1", que não diz nada — com isso vira "de DPE para SGJT".
     * O valor é {@code {tabela, coluna de rótulo}}; a sigla vem antes do nome quando existe.
     */
    private static final Map<String, String[]> REFERENCIAS = Map.ofEntries(
            Map.entry("cadastros_areas_id", new String[]{"cadastros_areas", "COALESCE(sigla, nome)"}),
            Map.entry("area_demandante_id", new String[]{"cadastros_areas", "COALESCE(sigla, nome)"}),
            Map.entry("area_id", new String[]{"cadastros_areas", "COALESCE(sigla, nome)"}),
            Map.entry("cadastros_unidades_id", new String[]{"cadastros_unidades", "COALESCE(sigla, nome)"}),
            Map.entry("unidade_id", new String[]{"cadastros_unidades", "COALESCE(sigla, nome)"}),
            Map.entry("comite_id", new String[]{"comites", "COALESCE(sigla, nome)"}),
            Map.entry("projeto_id", new String[]{"cadastros_projetos", "nome"}),
            Map.entry("user_id", new String[]{"users", "name"}),
            Map.entry("responsavel_id", new String[]{"users", "name"}),
            Map.entry("created_by", new String[]{"users", "name"}),
            Map.entry("updated_by", new String[]{"users", "name"}),
            Map.entry("deleted_by", new String[]{"users", "name"}),
            Map.entry("validated_by_id", new String[]{"users", "name"}),
            Map.entry("ata_uploaded_by", new String[]{"users", "name"}));

    /**
     * Para cada FK conhecida presente no antes/depois, resolve os ids em nomes.
     * Retorna {@code {coluna: {id: rótulo}}} — a tela consulta esse dicionário na hora de exibir.
     */
    private Map<String, Map<String, String>> referencias(JsonNode... jsons) {
        Map<String, Set<Long>> idsPorCampo = new LinkedHashMap<>();
        for (JsonNode json : jsons) {
            if (json == null || !json.isObject()) continue;
            json.fields().forEachRemaining(e -> {
                String[] ref = REFERENCIAS.get(e.getKey());
                if (ref == null) return;
                JsonNode v = e.getValue();
                // numeric/bigint podem chegar como número ou como texto no JSON gravado.
                // Sem o if/else explícito o ternário unboxa o ramo null e estoura NullPointerException.
                Long id = null;
                if (v.isNumber()) {
                    id = v.asLong();
                } else if (v.isTextual() && v.asText().matches("\\d+")) {
                    id = Long.parseLong(v.asText());
                }
                if (id != null) {
                    idsPorCampo.computeIfAbsent(e.getKey(), k -> new LinkedHashSet<>()).add(id);
                }
            });
        }

        Map<String, Map<String, String>> out = new LinkedHashMap<>();
        idsPorCampo.forEach((campo, ids) -> {
            String[] ref = REFERENCIAS.get(campo);
            String marcadores = String.join(",", ids.stream().map(i -> "?").toList());
            try {
                List<Map<String, Object>> rows = jdbc.queryForList(
                        "SELECT id, " + ref[1] + " AS rotulo FROM " + ref[0] +
                                " WHERE id IN (" + marcadores + ")", ids.toArray());
                Map<String, String> mapa = new LinkedHashMap<>();
                for (Map<String, Object> r : rows) {
                    Object rotulo = r.get("rotulo");
                    if (rotulo != null) mapa.put(String.valueOf(r.get("id")), String.valueOf(rotulo));
                }
                if (!mapa.isEmpty()) out.put(campo, mapa);
            } catch (Exception e) {
                // Tabela de referência ausente num ambiente: seguir sem o nome é melhor que falhar.
                log.debug("Não foi possível resolver a referência {}: {}", campo, e.getMessage());
            }
        });
        return out;
    }

    /** Chaves cujo VALOR nunca deve trafegar — comparadas em minúsculas, por "contém". */
    private static final List<String> CHAVES_SENSIVEIS = List.of(
            "password", "senha", "hash", "token", "secret", "segredo", "api_key", "apikey",
            "chave_secreta", "client_secret", "authorization", "credential");

    private static final String MASCARA = "••••••••";

    /** Substitui recursivamente o valor das chaves sensíveis por uma máscara, preservando o resto. */
    private String mascarar(String json) {
        if (json == null || json.isBlank() || "null".equals(json)) return json;
        try {
            JsonNode raiz = objectMapper.readTree(json);
            mascararNo(raiz);
            return objectMapper.writeValueAsString(raiz);
        } catch (Exception e) {
            // JSON inesperado: melhor devolver como veio do que perder o registro de auditoria.
            return json;
        }
    }

    private void mascararNo(JsonNode no) {
        if (no instanceof ObjectNode obj) {
            List<String> nomes = new ArrayList<>();
            obj.fieldNames().forEachRemaining(nomes::add);
            for (String nome : nomes) {
                String n = nome.toLowerCase();
                if (CHAVES_SENSIVEIS.stream().anyMatch(n::contains)) {
                    obj.put(nome, MASCARA);
                } else {
                    mascararNo(obj.get(nome));
                }
            }
        } else if (no != null && no.isArray()) {
            no.forEach(this::mascararNo);
        }
    }
}
