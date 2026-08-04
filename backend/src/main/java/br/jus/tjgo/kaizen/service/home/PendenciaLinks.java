package br.jus.tjgo.kaizen.service.home;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Helpers de montagem de deep-links das pendências (mesma semântica do buildLink do Node/HomeService
 * antigo): ignora valores null/'' e preserva a ordem dos params. Centralizado para todos os provedores.
 */
public final class PendenciaLinks {

    private PendenciaLinks() {
    }

    /** Monta um mapa ordenado de query params a partir de pares chave/valor. */
    public static LinkedHashMap<String, Object> params(Object... kv) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            m.put(String.valueOf(kv[i]), kv[i + 1]);
        }
        return m;
    }

    /** base + "?" + querystring (ignora null/'' e URL-encoda), preservando a ordem dos params. */
    public static String build(String base, LinkedHashMap<String, Object> params) {
        StringBuilder qs = new StringBuilder();
        for (Map.Entry<String, Object> e : params.entrySet()) {
            Object v = e.getValue();
            if (v == null) {
                continue;
            }
            String s = String.valueOf(v);
            if (s.isEmpty()) {
                continue;
            }
            if (qs.length() > 0) {
                qs.append("&");
            }
            qs.append(enc(e.getKey())).append("=").append(enc(s));
        }
        return qs.length() > 0 ? base + "?" + qs : base;
    }

    private static String enc(String s) {
        return URLEncoder.encode(s, StandardCharsets.UTF_8);
    }
}
