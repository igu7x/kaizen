package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Relatório de Lacunas de Competências.
 *
 * <p>Cruza duas fontes que hoje vivem separadas:
 * <ul>
 *   <li><b>Matriz de Competências da equipe</b> — quantos colaboradores a unidade tem
 *       ({@code qtd_colaboradores}) e, por competência técnica, para quantos ela se aplica
 *       ({@code aplicabilidade} = "todos" | "parte" + {@code quantidade_pessoas});</li>
 *   <li><b>Resultado Final</b> — a nota consolidada de cada colaborador por competência.</li>
 * </ul>
 *
 * <p>Para cada competência: <b>necessário</b> é quanta gente deveria dominá-la, <b>possuem</b> é
 * quanta gente atinge o nível mínimo pedido no Resultado Final, e <b>débito</b> é o que falta.
 * O cálculo é sempre feito na hora da consulta, com os dados vigentes — não há nada congelado.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class LacunasCompetenciasService {

    private final JdbcTemplate jdbc;

    /** Nível mínimo padrão: 3 = "Intermediário" na escala técnica (1..5). */
    public static final int NIVEL_MINIMO_PADRAO = 3;

    /**
     * Unidades sobre as quais o usuário pode emitir o relatório: aquelas onde ele é o gestor
     * (<code>cadastros_unidades.responsavel_user_id</code>) e as das áreas que dirige
     * (<code>cadastros_areas.gestor_user_id / subdiretor_user_id</code>). Superadmin vê todas.
     */
    public List<Map<String, Object>> unidadesPermitidas(long userId, boolean isSuperadmin) {
        String filtro = isSuperadmin
                ? ""
                : " AND ( cu.responsavel_user_id = ? " +
                  "    OR ca.gestor_user_id = ? " +
                  "    OR ca.subdiretor_user_id = ? ) ";
        String sql =
                "SELECT cu.id, cu.nome, cu.area_id, ca.sigla AS area_sigla, " +
                "       (cu.responsavel_user_id = ?) AS sou_gestor " +
                "FROM cadastros_unidades cu " +
                "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                "WHERE (cu.ativo IS NOT FALSE) AND COALESCE(ca.ativo, TRUE) = TRUE " +
                "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla)) " +
                filtro +
                "ORDER BY ca.sigla, cu.nome";
        if (isSuperadmin) {
            return jdbc.queryForList(sql, userId);
        }
        return jdbc.queryForList(sql, userId, userId, userId, userId);
    }

    /** A mesma regra, para uma unidade só — usada como porta do relatório. */
    public boolean podeGerar(long unidadeId, long userId, boolean isSuperadmin) {
        if (isSuperadmin) {
            return true;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT 1 FROM cadastros_unidades cu " +
                        "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "WHERE cu.id = ? " +
                        "  AND ( cu.responsavel_user_id = ? " +
                        "     OR ca.gestor_user_id = ? " +
                        "     OR ca.subdiretor_user_id = ? ) LIMIT 1",
                unidadeId, userId, userId, userId);
        return !rows.isEmpty();
    }

    /**
     * Monta o relatório da unidade. Devolve {@code null} quando a unidade não tem Matriz de
     * Competências da equipe — sem ela não há o que comparar.
     */
    public Map<String, Object> gerar(long unidadeId, int nivelMinimo) {
        // Matriz vigente da equipe: a validada mais recente; sem nenhuma validada, a mais recente.
        List<Map<String, Object>> matrizRows = jdbc.queryForList(
                "SELECT f.id, f.qtd_colaboradores, f.versao_formulario, f.status, " +
                        "       f.validado_final_em, cu.nome AS unidade_nome, ca.sigla AS area_sigla " +
                        "FROM competencias_gestor_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "LEFT JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "WHERE f.unidade_id = ? AND f.tipo = 'equipe' AND f.is_deleted = FALSE " +
                        "ORDER BY (f.validado_final_em IS NOT NULL) DESC, f.validado_final_em DESC, f.id DESC " +
                        "LIMIT 1",
                unidadeId);
        if (matrizRows.isEmpty()) {
            return null;
        }
        Map<String, Object> matriz = matrizRows.get(0);
        long matrizId = ((Number) matriz.get("id")).longValue();
        int qtdColaboradores = matriz.get("qtd_colaboradores") != null
                ? ((Number) matriz.get("qtd_colaboradores")).intValue() : 0;

        // Um Resultado Final por pessoa (o mais recente), restrito ao inventário da equipe.
        List<Map<String, Object>> avaliados = jdbc.queryForList(
                "SELECT DISTINCT ON (af.user_id) ai.id, af.user_id " +
                        "FROM avaliacao_integrada_formularios ai " +
                        "JOIN autoavaliacao_formularios af ON af.id = ai.autoavaliacao_id " +
                        "WHERE ai.unidade_id = ? AND COALESCE(ai.tipo_inventario, 'equipe') = 'equipe' " +
                        "  AND ai.is_deleted = FALSE " +
                        "ORDER BY af.user_id, COALESCE(ai.calculado_em, ai.created_at) DESC",
                unidadeId);
        List<Long> formulariosIntegrados = new ArrayList<>();
        for (Map<String, Object> row : avaliados) {
            formulariosIntegrados.add(((Number) row.get("id")).longValue());
        }

        // Só entram as competências com aplicabilidade declarada — é o campo que diz para quantos
        // a competência vale, e na prática marca as TÉCNICAS (as padrão não o preenchem).
        List<Map<String, Object>> itens = jdbc.queryForList(
                "SELECT i.id, i.nome, i.descricao, i.peso, i.aplicabilidade, i.quantidade_pessoas, i.ordem " +
                        "FROM competencias_gestor_itens i " +
                        "WHERE i.formulario_id = ? AND i.aplicabilidade IS NOT NULL " +
                        "ORDER BY i.ordem, i.id",
                matrizId);

        List<Map<String, Object>> linhas = new ArrayList<>();
        int somaNecessario = 0;
        int somaPossuem = 0;
        int somaDebito = 0;
        for (Map<String, Object> item : itens) {
            String nome = str(item.get("nome"));
            boolean paraTodos = !"parte".equalsIgnoreCase(str(item.get("aplicabilidade")));
            int necessario = paraTodos
                    ? qtdColaboradores
                    : (item.get("quantidade_pessoas") != null
                            ? ((Number) item.get("quantidade_pessoas")).intValue() : 0);
            int possuem = contarAptos(formulariosIntegrados, nome, nivelMinimo);
            int debito = Math.max(0, necessario - possuem);

            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("competencia_id", item.get("id"));
            linha.put("competencia_nome", nome);
            linha.put("competencia_descricao", item.get("descricao"));
            linha.put("peso", item.get("peso"));
            linha.put("aplicabilidade", item.get("aplicabilidade"));
            linha.put("necessario", necessario);
            linha.put("possuem", possuem);
            linha.put("debito", debito);
            // Percentual de cobertura da competência (100% = ninguém em falta).
            linha.put("cobertura_percentual",
                    necessario > 0 ? Math.min(100, (possuem * 100) / necessario) : 100);
            linhas.add(linha);

            somaNecessario += necessario;
            somaPossuem += Math.min(possuem, necessario);
            somaDebito += debito;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("unidade_id", unidadeId);
        out.put("unidade_nome", matriz.get("unidade_nome"));
        out.put("area_sigla", matriz.get("area_sigla"));
        out.put("matriz_id", matrizId);
        out.put("matriz_status", matriz.get("status"));
        out.put("matriz_validada_em", matriz.get("validado_final_em"));
        out.put("nivel_minimo", nivelMinimo);
        out.put("qtd_colaboradores", qtdColaboradores);
        // Cobertura do próprio inventário: de nada adianta o número de aptos se metade da equipe
        // ainda não tem Resultado Final. É a ressalva que o relatório precisa mostrar.
        out.put("colaboradores_avaliados", formulariosIntegrados.size());
        out.put("total_competencias", linhas.size());
        out.put("competencias_com_debito",
                linhas.stream().filter(l -> ((Number) l.get("debito")).intValue() > 0).count());
        out.put("soma_necessario", somaNecessario);
        out.put("soma_possuem", somaPossuem);
        out.put("soma_debito", somaDebito);
        out.put("cobertura_geral_percentual",
                somaNecessario > 0 ? (somaPossuem * 100) / somaNecessario : 100);
        out.put("competencias", linhas);
        return out;
    }

    /**
     * Quantos colaboradores atingem o nível mínimo na competência. O pareamento é por NOME
     * normalizado — {@code competencia_unidade_id} vem nulo na grande maioria das respostas, então
     * é o nome que liga a matriz ao Resultado Final (mesma escolha do resto do módulo).
     */
    private int contarAptos(List<Long> formularioIds, String nome, int nivelMinimo) {
        if (formularioIds.isEmpty() || nome == null || nome.isBlank()) {
            return 0;
        }
        Integer total = jdbc.queryForObject(
                "SELECT COUNT(DISTINCT r.formulario_id)::int " +
                        "FROM avaliacao_integrada_respostas r " +
                        "WHERE r.formulario_id = ANY(?::bigint[]) " +
                        "  AND LOWER(BTRIM(r.competencia_nome)) = LOWER(BTRIM(?)) " +
                        "  AND r.nota_integrada IS NOT NULL AND r.nota_integrada >= ?",
                Integer.class, bigintArray(formularioIds), nome, nivelMinimo);
        return total == null ? 0 : total;
    }

    private static String bigintArray(List<Long> ids) {
        StringBuilder sb = new StringBuilder("{");
        for (int i = 0; i < ids.size(); i++) {
            if (i > 0) {
                sb.append(',');
            }
            sb.append(ids.get(i));
        }
        return sb.append('}').toString();
    }

    private static String str(Object v) {
        return v == null ? null : String.valueOf(v);
    }
}
