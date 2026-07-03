package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.exception.ApiException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

@Slf4j
@Service
@RequiredArgsConstructor
public class DatabaseConsoleService {

    private final JdbcTemplate jdbcTemplate;

    // Padrão de expressão regular para encontrar comandos de mutação/DML/DDL.
    // Usamos word boundaries (\b) para não barrar acidentalmente algo como "SELECT drop_date FROM...".
    private static final Pattern MUTATION_PATTERN = Pattern.compile(
            "(?i)\\b(insert|update|delete|drop|alter|truncate|replace|grant|revoke|commit|rollback)\\b"
    );

    private static final Pattern LIMIT_PATTERN = Pattern.compile("(?i)\\blimit\\b");

    @Transactional(readOnly = true)
    public Map<String, Object> executeQuery(String query) {
        if (query == null || query.isBlank()) {
            throw new ApiException(400, "A query não pode estar vazia.");
        }

        // Remover espaços em branco extras do início e fim
        String sanitizedQuery = query.trim();

        // 1. Verificação de Segurança Anti-DML / DDL
        if (MUTATION_PATTERN.matcher(sanitizedQuery).find()) {
            log.warn("Tentativa de executar query com palavras-chave proibidas: {}", sanitizedQuery);
            throw new ApiException(400, "Operação bloqueada: Apenas comandos SELECT são permitidos.");
        }

        // 2. Auto-Limit
        // Verifica se já não existe uma cláusula LIMIT.
        if (!LIMIT_PATTERN.matcher(sanitizedQuery).find()) {
            // Verifica se a query termina com ponto e vírgula e o remove temporariamente para adicionar o LIMIT
            if (sanitizedQuery.endsWith(";")) {
                sanitizedQuery = sanitizedQuery.substring(0, sanitizedQuery.length() - 1);
            }
            sanitizedQuery = sanitizedQuery + " LIMIT 100;";
        }

        try {
            long startTime = System.currentTimeMillis();
            
            // 3. Execução
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(sanitizedQuery);
            
            long endTime = System.currentTimeMillis();
            long executionTime = endTime - startTime;

            return Map.of(
                    "success", true,
                    "rows", rows,
                    "count", rows.size(),
                    "executionTimeMs", executionTime
            );
        } catch (Exception e) {
            log.error("Erro ao executar query do console: {}", sanitizedQuery, e);
            throw new ApiException(400, "Erro ao executar a consulta: " + e.getMessage());
        }
    }
}
