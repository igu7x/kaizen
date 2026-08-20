package br.jus.tjgo.kaizen.util;

import java.util.List;

/**
 * Validadores finais (Camada 3) — lista hardcoded de 4 e-mails, usada no fluxo de
 * Matriz de Competências (Sprint 7) e no resumo da Home (Sprint 9).
 * Constante única compartilhada para evitar duplicação entre serviços.
 * (VALIDADORES_DIRETORIA fica em CompetenciasGestorService — é declarado mas não usado, paridade.)
 */
public final class Validadores {

    private Validadores() {
    }

    public static final List<String> FINAIS = List.of(
            "gmpdmaciel@tjgo.jus.br",
            // Acesso de teste do fluxo completo da matriz em staging.
            "ifccteixeira@tjgo.jus.br");

    public static boolean isFinal(String email) {
        if (email == null) {
            return false;
        }
        String e = email.toLowerCase().trim();
        return FINAIS.stream().anyMatch(v -> v.equalsIgnoreCase(e));
    }
}
