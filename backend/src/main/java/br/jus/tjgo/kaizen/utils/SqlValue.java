package br.jus.tjgo.kaizen.utils;

import java.math.BigDecimal;

/**
 * Coerções de valores vindos do JSON antes de virarem parâmetro JDBC.
 *
 * <p><b>Por que isto existe (bug de cutover Node→Java):</b> o {@code JacksonConfig} serializa,
 * de propósito, {@code numeric} (BigDecimal) e {@code bigint} (Long) como <b>String</b>, para
 * manter paridade byte-a-byte com o driver {@code pg} do Node. O front recebe {@code "0.00"},
 * guarda no formData e devolve a String no PUT/POST.
 *
 * <p>O driver do Node enviava o parâmetro sem tipo e o Postgres inferia. Já o pgjdbc binda
 * {@code String} como {@code VARCHAR}, e o Postgres <b>recusa</b> atribuir varchar a
 * numeric/bigint/integer: SQLState {@code 42804} (datatype_mismatch), que o Spring embrulha
 * como {@code BadSqlGrammarException} → HTTP 500.
 *
 * <p>Qualquer coluna não-texto (integer / bigint / numeric) alimentada por payload do front
 * precisa passar por {@link #numeroOuNull(Object)}.
 */
public final class SqlValue {

    private SqlValue() {
    }

    /**
     * Converte para {@link Number} um valor que pode chegar como String.
     *
     * <p>Preserva o zero de propósito: num UPDATE, mapear {@code 0 → null} apagaria
     * silenciosamente um valor zero legítimo que o usuário sequer tocou. Apenas
     * {@code null}, string vazia e texto não-numérico viram {@code null}.
     */
    public static Object numeroOuNull(Object v) {
        if (v == null || v instanceof Number) {
            return v;
        }
        String s = String.valueOf(v).trim();
        if (s.isEmpty()) {
            return null;
        }
        try {
            return s.matches("-?\\d+") ? (Object) Long.valueOf(s) : (Object) new BigDecimal(s);
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
