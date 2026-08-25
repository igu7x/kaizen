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
    public Map<String, Object> gerar(long unidadeId) {
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

        // As TÉCNICAS vêm da matriz — são as que o gestor digitou, com aplicabilidade e grau.
        List<Map<String, Object>> itens = new ArrayList<>(jdbc.queryForList(
                "SELECT i.id, i.nome, i.descricao, i.peso, i.grau_minimo_esperado, " +
                        "       i.aplicabilidade, i.quantidade_pessoas, i.ordem, 'matriz' AS origem " +
                        "FROM competencias_gestor_itens i " +
                        "WHERE i.formulario_id = ? " +
                        "ORDER BY i.ordem, i.id",
                matrizId));

        // As COMPORTAMENTAIS não ficam na matriz: vivem no catálogo de competências padrão e são
        // aplicadas a todo mundo na avaliação. Por isso entram aqui pelo catálogo, com o grau
        // mínimo fixo em 3 e necessário = todos os colaboradores.
        itens.addAll(jdbc.queryForList(
                "SELECT p.id, p.nome, p.descricao, NULL::int AS peso, " +
                        "       " + NIVEL_MINIMO_PADRAO + " AS grau_minimo_esperado, " +
                        "       NULL::varchar AS aplicabilidade, NULL::int AS quantidade_pessoas, " +
                        "       p.ordem, 'padrao' AS origem " +
                        "FROM competencias_padrao p " +
                        "WHERE p.tipo = 'comportamental' AND COALESCE(p.ativo, TRUE) = TRUE " +
                        "ORDER BY p.ordem, p.id"));

        int totalAvaliados = formulariosIntegrados.size();
        // Notas de cada avaliado, agrupadas por nome e PRESERVANDO A ORDEM das respostas.
        // A ordem é o que permite casar a n-ésima competência de nome repetido da matriz com a
        // n-ésima resposta da pessoa — ver contarAptos.
        Map<Long, Map<String, List<Integer>>> notasPorPessoa = carregarNotas(formulariosIntegrados);
        Map<String, Integer> ocorrencias = new LinkedHashMap<>();
        List<Map<String, Object>> linhas = new ArrayList<>();
        int somaNecessario = 0;
        int somaPossuem = 0;
        int somaDebito = 0;
        int somaNecessarioAvaliados = 0;
        int somaDebitoAvaliados = 0;
        for (Map<String, Object> item : itens) {
            String nome = str(item.get("nome"));
            boolean paraTodos = !"parte".equalsIgnoreCase(str(item.get("aplicabilidade")));
            int necessario = paraTodos
                    ? qtdColaboradores
                    : (item.get("quantidade_pessoas") != null
                            ? ((Number) item.get("quantidade_pessoas")).intValue() : 0);
            // O corte agora é de CADA competência (Grau mínimo esperado, definido na matriz), não
            // mais um nível único escolhido ao gerar o relatório.
            int grauMinimo = grauMinimoDoItem(item);
            // Índice desta ocorrência do nome dentro da matriz (0, 1, 2...).
            String chave = normalizar(nome);
            int ocorrencia = ocorrencias.merge(chave, 1, Integer::sum) - 1;
            int possuem = contarAptos(notasPorPessoa, chave, ocorrencia, grauMinimo);
            int debito = Math.max(0, necessario - possuem);

            // Recorte entre quem JÁ TEM Resultado Final. Separa "falta competência" de "falta
            // avaliação": no débito cheio, todo colaborador ainda não avaliado vira lacuna em
            // todas as competências, e o número passa a medir cobertura de avaliação, não domínio.
            // A base é o que dá para observar hoje — no máximo o total de avaliados.
            int necessarioAvaliados = Math.min(necessario, totalAvaliados);
            int debitoAvaliados = Math.max(0, necessarioAvaliados - possuem);

            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("competencia_id", item.get("id"));
            // "matriz" (técnica digitada) ou "padrao" (comportamental do catálogo). Ids das duas
            // origens podem coincidir, então a tela precisa dos dois para montar a chave.
            linha.put("origem", item.get("origem"));
            linha.put("competencia_nome", nome);
            linha.put("competencia_descricao", item.get("descricao"));
            linha.put("peso", item.get("peso"));
            linha.put("grau_minimo_esperado", grauMinimo);
            linha.put("aplicabilidade", item.get("aplicabilidade"));
            linha.put("necessario", necessario);
            linha.put("possuem", possuem);
            linha.put("debito", debito);
            linha.put("necessario_avaliados", necessarioAvaliados);
            linha.put("debito_avaliados", debitoAvaliados);
            // Percentual de cobertura da competência (100% = ninguém em falta).
            linha.put("cobertura_percentual",
                    necessario > 0 ? Math.min(100, (possuem * 100) / necessario) : 100);
            linhas.add(linha);

            somaNecessario += necessario;
            somaPossuem += Math.min(possuem, necessario);
            somaDebito += debito;
            somaNecessarioAvaliados += necessarioAvaliados;
            somaDebitoAvaliados += debitoAvaliados;
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("unidade_id", unidadeId);
        out.put("unidade_nome", matriz.get("unidade_nome"));
        out.put("area_sigla", matriz.get("area_sigla"));
        out.put("matriz_id", matrizId);
        out.put("matriz_status", matriz.get("status"));
        out.put("matriz_validada_em", matriz.get("validado_final_em"));
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
        // Recorte só entre os avaliados — o débito que é de fato falta de competência.
        out.put("soma_necessario_avaliados", somaNecessarioAvaliados);
        out.put("soma_debito_avaliados", somaDebitoAvaliados);
        out.put("competencias_com_debito_avaliados",
                linhas.stream().filter(l -> ((Number) l.get("debito_avaliados")).intValue() > 0).count());
        out.put("cobertura_geral_percentual",
                somaNecessario > 0 ? (somaPossuem * 100) / somaNecessario : 100);
        out.put("competencias", linhas);
        return out;
    }

    // ============================================================
    // LACUNAS DO GESTOR
    // ============================================================

    /**
     * Unidades cujo gestor o usuário pode analisar: as das áreas que ele dirige. É o recorte do
     * pedido — o relatório do gestor é instrumento da direção da área.
     */
    public List<Map<String, Object>> unidadesComGestor(long userId, boolean isSuperadmin) {
        String filtro = isSuperadmin
                ? ""
                : " AND (ca.gestor_user_id = ? OR ca.subdiretor_user_id = ?) ";
        String sql =
                "SELECT cu.id, cu.nome, cu.area_id, ca.sigla AS area_sigla, " +
                "       cu.responsavel_user_id AS gestor_user_id, u.name AS gestor_nome " +
                "FROM cadastros_unidades cu " +
                "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                "LEFT JOIN users u ON u.id = cu.responsavel_user_id " +
                "WHERE (cu.ativo IS NOT FALSE) AND COALESCE(ca.ativo, TRUE) = TRUE " +
                "  AND LOWER(TRIM(cu.nome)) <> LOWER(TRIM(ca.sigla)) " +
                filtro +
                "ORDER BY ca.sigla, cu.nome";
        return isSuperadmin
                ? jdbc.queryForList(sql)
                : jdbc.queryForList(sql, userId, userId);
    }

    /** Só a direção da área (e superadmin) emite o relatório do gestor daquela unidade. */
    public boolean podeGerarGestor(long unidadeId, long userId, boolean isSuperadmin) {
        if (isSuperadmin) {
            return true;
        }
        return !jdbc.queryForList(
                "SELECT 1 FROM cadastros_unidades cu " +
                        "JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "WHERE cu.id = ? AND (ca.gestor_user_id = ? OR ca.subdiretor_user_id = ?) LIMIT 1",
                unidadeId, userId, userId).isEmpty();
    }

    /**
     * Lacunas do GESTOR da unidade. Diferente do relatório da equipe, aqui não se conta gente: o
     * avaliado é uma pessoa só, e a pergunta por competência é se ele alcança o grau mínimo
     * esperado. O "débito" vira a distância em níveis até esse grau.
     *
     * <p>Devolve {@code null} quando a unidade não tem Matriz do Gestor — sem ela não há referência.
     */
    public Map<String, Object> gerarGestor(long unidadeId) {
        List<Map<String, Object>> matrizRows = jdbc.queryForList(
                "SELECT f.id, f.status, f.validado_final_em, " +
                        "       cu.nome AS unidade_nome, ca.sigla AS area_sigla, " +
                        "       cu.responsavel_user_id AS gestor_user_id, u.name AS gestor_nome " +
                        "FROM competencias_gestor_formularios f " +
                        "LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id " +
                        "LEFT JOIN cadastros_areas ca ON ca.id = cu.area_id " +
                        "LEFT JOIN users u ON u.id = cu.responsavel_user_id " +
                        "WHERE f.unidade_id = ? AND f.tipo = 'gestor' AND f.is_deleted = FALSE " +
                        "ORDER BY (f.validado_final_em IS NOT NULL) DESC, f.validado_final_em DESC, f.id DESC " +
                        "LIMIT 1",
                unidadeId);
        if (matrizRows.isEmpty()) {
            return null;
        }
        Map<String, Object> matriz = matrizRows.get(0);
        long matrizId = ((Number) matriz.get("id")).longValue();

        // Resultado Final mais recente do inventário do GESTOR nesta unidade. Só um: o avaliado é
        // o gestor da unidade.
        List<Map<String, Object>> integrada = jdbc.queryForList(
                "SELECT ai.id FROM avaliacao_integrada_formularios ai " +
                        "WHERE ai.unidade_id = ? AND COALESCE(ai.tipo_inventario, 'equipe') = 'gestor' " +
                        "  AND ai.is_deleted = FALSE " +
                        "ORDER BY COALESCE(ai.calculado_em, ai.created_at) DESC LIMIT 1",
                unidadeId);
        List<Long> formularios = integrada.isEmpty()
                ? List.of()
                : List.of(((Number) integrada.get(0).get("id")).longValue());
        Map<Long, Map<String, List<Integer>>> notasPorPessoa = carregarNotas(formularios);
        Map<String, List<Integer>> notasDoGestor = notasPorPessoa.values().stream()
                .findFirst().orElse(new LinkedHashMap<>());

        // Técnicas da matriz do gestor + TODAS as padrão (comportamental, estratégica e gerencial),
        // que no inventário do gestor são as três aplicadas, com grau mínimo 3.
        List<Map<String, Object>> itens = new ArrayList<>(jdbc.queryForList(
                "SELECT i.id, i.nome, i.descricao, i.grau_minimo_esperado, i.ordem, 'matriz' AS origem " +
                        "FROM competencias_gestor_itens i WHERE i.formulario_id = ? " +
                        "ORDER BY i.ordem, i.id",
                matrizId));
        itens.addAll(jdbc.queryForList(
                "SELECT p.id, p.nome, p.descricao, " + NIVEL_MINIMO_PADRAO + " AS grau_minimo_esperado, " +
                        "       p.ordem, 'padrao' AS origem " +
                        "FROM competencias_padrao p " +
                        "WHERE p.tipo IN ('comportamental', 'estrategica', 'gerencial') " +
                        "  AND COALESCE(p.ativo, TRUE) = TRUE " +
                        "ORDER BY p.tipo, p.ordem, p.id"));

        Map<String, Integer> ocorrencias = new LinkedHashMap<>();
        List<Map<String, Object>> linhas = new ArrayList<>();
        int atingidas = 0;
        int somaDebitoNiveis = 0;
        int avaliadas = 0;
        for (Map<String, Object> item : itens) {
            String nome = str(item.get("nome"));
            int grauMinimo = grauMinimoDoItem(item);
            String chave = normalizar(nome);
            int ocorrencia = ocorrencias.merge(chave, 1, Integer::sum) - 1;
            Integer nota = notaDoAvaliado(notasDoGestor, chave, ocorrencia);
            boolean atingiu = nota != null && nota >= grauMinimo;
            // Distância até o grau exigido. Sem nota não há como afirmar débito de competência —
            // fica nulo, e a tela mostra como "não avaliada" em vez de somar como lacuna.
            Integer debitoNiveis = nota == null ? null : Math.max(0, grauMinimo - nota);

            Map<String, Object> linha = new LinkedHashMap<>();
            linha.put("competencia_id", item.get("id"));
            linha.put("origem", item.get("origem"));
            linha.put("competencia_nome", nome);
            linha.put("competencia_descricao", item.get("descricao"));
            linha.put("grau_minimo_esperado", grauMinimo);
            linha.put("nota", nota);
            linha.put("atingiu", atingiu);
            linha.put("debito_niveis", debitoNiveis);
            linhas.add(linha);

            if (nota != null) {
                avaliadas++;
                if (atingiu) {
                    atingidas++;
                } else {
                    somaDebitoNiveis += debitoNiveis;
                }
            }
        }

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("unidade_id", unidadeId);
        out.put("unidade_nome", matriz.get("unidade_nome"));
        out.put("area_sigla", matriz.get("area_sigla"));
        out.put("gestor_user_id", matriz.get("gestor_user_id"));
        out.put("gestor_nome", matriz.get("gestor_nome"));
        out.put("matriz_id", matrizId);
        out.put("matriz_status", matriz.get("status"));
        out.put("matriz_validada_em", matriz.get("validado_final_em"));
        out.put("tem_resultado_final", !formularios.isEmpty());
        out.put("total_competencias", linhas.size());
        out.put("competencias_avaliadas", avaliadas);
        out.put("atingidas", atingidas);
        out.put("em_debito", avaliadas - atingidas);
        out.put("soma_debito_niveis", somaDebitoNiveis);
        // Percentual sobre o que foi AVALIADO: usar o total faria uma matriz recém-criada parecer
        // reprovada quando na verdade ainda não houve avaliação.
        out.put("percentual_alcance", avaliadas > 0 ? (atingidas * 100) / avaliadas : 0);
        out.put("competencias", linhas);
        return out;
    }

    /** Nota do avaliado nesta ocorrência da competência, ou {@code null} se não respondida. */
    private static Integer notaDoAvaliado(
            Map<String, List<Integer>> notas, String chave, int ocorrencia) {
        List<Integer> lista = notas.get(chave);
        if (lista == null || lista.size() <= ocorrencia) {
            return null;
        }
        return lista.get(ocorrencia);
    }

    /**
     * Notas de cada avaliado, por nome de competência, na ordem em que aparecem no Resultado Final.
     * Uma consulta só para todo o relatório (evita uma ida ao banco por competência).
     */
    private Map<Long, Map<String, List<Integer>>> carregarNotas(List<Long> formularioIds) {
        Map<Long, Map<String, List<Integer>>> porPessoa = new LinkedHashMap<>();
        if (formularioIds.isEmpty()) {
            return porPessoa;
        }
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT r.formulario_id, r.competencia_nome, r.nota_integrada " +
                        "FROM avaliacao_integrada_respostas r " +
                        "WHERE r.formulario_id = ANY(?::bigint[]) " +
                        "ORDER BY r.formulario_id, r.ordem, r.id",
                bigintArray(formularioIds));
        for (Map<String, Object> row : rows) {
            long formularioId = ((Number) row.get("formulario_id")).longValue();
            String chave = normalizar(str(row.get("competencia_nome")));
            Integer nota = row.get("nota_integrada") != null
                    ? ((Number) row.get("nota_integrada")).intValue() : null;
            porPessoa
                    .computeIfAbsent(formularioId, k -> new LinkedHashMap<>())
                    .computeIfAbsent(chave, k -> new ArrayList<>())
                    .add(nota);
        }
        return porPessoa;
    }

    /**
     * Quantos avaliados atingem o nível mínimo NESTA ocorrência da competência.
     *
     * <p>O pareamento é por nome — {@code competencia_unidade_id} vem nulo na grande maioria das
     * respostas, então é o nome que liga a matriz ao Resultado Final (mesma escolha do resto do
     * módulo). Só que nomes repetidos são comuns na matriz, e aí o nome sozinho não basta: contar
     * "existe alguma resposta com esse nome acima do corte" dava a MESMA contagem para todas as
     * ocorrências e escondia a que estava abaixo. Por isso a n-ésima ocorrência do nome na matriz
     * é comparada com a n-ésima resposta da pessoa — a ordem é a mesma dos dois lados, porque as
     * respostas nascem da própria matriz. Ver o mesmo raciocínio em
     * AvaliacaoIntegradaService.chavesDeOcorrencia.
     */
    private int contarAptos(Map<Long, Map<String, List<Integer>>> notasPorPessoa,
                            String chave, int ocorrencia, int nivelMinimo) {
        if (chave == null || chave.isBlank()) {
            return 0;
        }
        int aptos = 0;
        for (Map<String, List<Integer>> doPessoa : notasPorPessoa.values()) {
            List<Integer> notas = doPessoa.get(chave);
            if (notas == null || notas.size() <= ocorrencia) {
                continue;
            }
            Integer nota = notas.get(ocorrencia);
            if (nota != null && nota >= nivelMinimo) {
                aptos++;
            }
        }
        return aptos;
    }

    private static String normalizar(String nome) {
        return nome == null ? "" : nome.trim().toLowerCase();
    }

    /**
     * Grau mínimo esperado da competência (1..5), definido no preenchimento da matriz.
     * Cai em 3 quando ausente ou fora da faixa — é o valor do backfill da migration 255 e o corte
     * que o relatório usava antes de o campo existir, então matriz antiga não muda de resultado.
     */
    private static int grauMinimoDoItem(Map<String, Object> item) {
        Object v = item.get("grau_minimo_esperado");
        if (v == null) {
            return NIVEL_MINIMO_PADRAO;
        }
        int n = ((Number) v).intValue();
        return n < 1 || n > 5 ? NIVEL_MINIMO_PADRAO : n;
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
