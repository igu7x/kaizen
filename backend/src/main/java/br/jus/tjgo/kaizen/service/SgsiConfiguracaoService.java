package br.jus.tjgo.kaizen.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Configurações (parâmetros) do SGSI — chave → valor JSON. 12ª fatia. O valor é validado como JSON
 * antes de gravar; a UI edita o JSON cru (superadmin).
 */
@Service
@RequiredArgsConstructor
public class SgsiConfiguracaoService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private static final ObjectMapper JSON = new ObjectMapper();

    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(
                "SELECT chave, valor::text AS valor, descricao, atualizado_em " +
                "FROM sgsi_configuracao ORDER BY chave");
    }

    /** Atualiza o valor (JSON) de uma chave. Null se a chave não existir; erro se o JSON for inválido. */
    @Transactional
    public Map<String, Object> atualizar(String chave, String valorJson, Long userId) {
        if (valorJson == null || valorJson.isBlank()) {
            throw new IllegalArgumentException("valor é obrigatório");
        }
        try {
            JSON.readTree(valorJson);
        } catch (Exception e) {
            throw new IllegalArgumentException("valor deve ser um JSON válido");
        }
        int n = jdbc.update(
                "UPDATE sgsi_configuracao SET valor = ?::jsonb, atualizado_por = ?, atualizado_em = now() " +
                "WHERE chave = ?",
                valorJson, userId, chave);
        if (n == 0) {
            return null;
        }
        // record_id é NOT NULL na audit_log e a configuração tem PK textual (chave) — 0 = sem id numérico.
        audit.log("sgsi_configuracao", 0L, "UPDATE", userId,
                Map.of("evento", "ATUALIZADO", "chave", chave, "valor", valorJson), null, null);
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT chave, valor::text AS valor, descricao, atualizado_em " +
                "FROM sgsi_configuracao WHERE chave = ?", chave);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
