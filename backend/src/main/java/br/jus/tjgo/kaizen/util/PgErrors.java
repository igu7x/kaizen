package br.jus.tjgo.kaizen.util;

import java.sql.SQLException;

/**
 * Extrai o SQLState do Postgres de uma cadeia de exceções (Spring envelopa
 * PSQLException em DataAccessException). Usado para replicar o tratamento do Node
 * que inspeciona error.code (ex: '23505' unique_violation, '23503' fk_violation).
 */
public final class PgErrors {

    private PgErrors() {
    }

    public static String sqlState(Throwable t) {
        while (t != null) {
            if (t instanceof SQLException se) {
                return se.getSQLState();
            }
            t = t.getCause();
        }
        return null;
    }

    public static boolean is(Throwable t, String state) {
        return state.equals(sqlState(t));
    }
}
