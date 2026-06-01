package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Utilitário de domínio (multi-tenant) — porte fiel de utils/domain.ts.
 * Cache em memória com TTL de 5min; fallback legado se a coluna dominio não existir (migration 072).
 */
@Service
@RequiredArgsConstructor
public class DomainService {

    public record DomainInfo(String dominio, boolean isDomainRoot, List<String> diretoriasInDomain) {
    }

    private static final long CACHE_TTL_MS = 5 * 60 * 1000L;

    private final JdbcTemplate jdbc;

    private volatile Map<String, DomainInfo> cacheData;
    private volatile long cacheTimestamp;

    public void invalidateCache() {
        cacheData = null;
    }

    private boolean hasDominioColumn() {
        try {
            return !jdbc.queryForList(
                    "SELECT 1 FROM information_schema.columns " +
                            "WHERE table_name = 'cadastros_areas' AND column_name = 'dominio' LIMIT 1"
            ).isEmpty();
        } catch (Exception e) {
            return false;
        }
    }

    private Map<String, DomainInfo> buildLegacyCache() {
        List<String> allSiglas = jdbc.queryForList(
                "SELECT sigla FROM cadastros_areas WHERE COALESCE(ativo, TRUE) = TRUE AND sigla IS NOT NULL",
                String.class
        );
        Map<String, DomainInfo> infoMap = new HashMap<>();
        for (String sigla : allSiglas) {
            infoMap.put(sigla, new DomainInfo("SGJT", false, allSiglas));
        }
        return infoMap;
    }

    private synchronized Map<String, DomainInfo> loadCache() {
        long now = System.currentTimeMillis();
        if (cacheData != null && now - cacheTimestamp < CACHE_TTL_MS) {
            return cacheData;
        }

        if (!hasDominioColumn()) {
            cacheData = buildLegacyCache();
            cacheTimestamp = now;
            return cacheData;
        }

        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT sigla, dominio, is_domain_root FROM cadastros_areas " +
                        "WHERE COALESCE(ativo, TRUE) = TRUE AND sigla IS NOT NULL"
        );

        Map<String, List<String>> domainMap = new HashMap<>();
        Map<String, Boolean> rootFlags = new HashMap<>();
        Map<String, String> diretoriaDominio = new HashMap<>();

        for (Map<String, Object> row : rows) {
            String sigla = (String) row.get("sigla");
            String dominio = row.get("dominio") != null ? (String) row.get("dominio") : "SGJT";
            boolean isRoot = Boolean.TRUE.equals(row.get("is_domain_root"));

            diretoriaDominio.put(sigla, dominio);
            rootFlags.put(sigla, isRoot);
            domainMap.computeIfAbsent(dominio, k -> new ArrayList<>()).add(sigla);
        }

        Map<String, DomainInfo> infoMap = new HashMap<>();
        for (Map.Entry<String, String> e : diretoriaDominio.entrySet()) {
            String sigla = e.getKey();
            String dominio = e.getValue();
            infoMap.put(sigla, new DomainInfo(
                    dominio,
                    rootFlags.getOrDefault(sigla, false),
                    domainMap.getOrDefault(dominio, new ArrayList<>())
            ));
        }

        if (infoMap.isEmpty()) {
            cacheData = buildLegacyCache();
            cacheTimestamp = now;
            return cacheData;
        }

        cacheData = infoMap;
        cacheTimestamp = now;
        return infoMap;
    }

    /** Info de domínio de uma diretoria; fallback p/ não-root no domínio SGJT se não encontrada. */
    public DomainInfo getDomainForDiretoria(String diretoria) {
        Map<String, DomainInfo> map = loadCache();
        DomainInfo info = map.get(diretoria);
        if (info != null) {
            return info;
        }
        DomainInfo sgjtInfo = map.get("SGJT");
        List<String> diretorias = sgjtInfo != null ? sgjtInfo.diretoriasInDomain() : List.of(diretoria);
        return new DomainInfo("SGJT", false, diretorias);
    }

    public boolean isValidDiretoria(String sigla) {
        return loadCache().containsKey(sigla);
    }

    public boolean isDomainRoot(String diretoria) {
        return getDomainForDiretoria(diretoria).isDomainRoot();
    }

    public boolean isSameDomain(String dir1, String dir2) {
        return getDomainForDiretoria(dir1).dominio().equals(getDomainForDiretoria(dir2).dominio());
    }

    public List<String> getAllDiretorias() {
        return new ArrayList<>(loadCache().keySet());
    }
}
