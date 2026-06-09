package br.jus.tjgo.kaizen.util;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.stream.Collectors;

/**
 * Constroi query strings preservando a ordem de insercao (paridade com URLSearchParams do JS).
 * Bug #7: Map.of() usa hash interno e embaralha a ordem — contract tests falham no diff exato.
 *
 * Uso: buildQueryString("matrizId", 21, "tipo", "equipe") -> "matrizId=21&tipo=equipe"
 */
public final class QueryStringBuilder {

    private QueryStringBuilder() {
    }

    public static String buildQueryString(Object... kvPairs) {
        LinkedHashMap<String, String> params = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kvPairs.length; i += 2) {
            params.put(String.valueOf(kvPairs[i]), String.valueOf(kvPairs[i + 1]));
        }
        return params.entrySet().stream()
                .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
                .collect(Collectors.joining("&"));
    }
}
