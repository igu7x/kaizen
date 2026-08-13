package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * SBOM — inventário de componentes de software por sistema (cadeia de suprimentos). Cada sistema lista
 * seus componentes com licença, procedência, purl e fim de vida (EOL). 21ª fatia.
 */
@Service
@RequiredArgsConstructor
public class SgsiSbomService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;
    private static final SecureRandom RNG = new SecureRandom();

    private static final Set<String> CRITICIDADES = Set.of("ALTA", "MEDIA", "BAIXA");

    public List<Map<String, Object>> listarSistemas() {
        return jdbc.queryForList(
                "SELECT s.id, s.sistema, s.versao, s.fornecedor, s.tipo, s.criticidade, " +
                "  s.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, s.formato, " +
                "  s.data_referencia, s.origem, s.criado_em, " +
                "  ( SELECT COUNT(*) FROM sgsi_sbom_componente c WHERE c.sbom_sistema_id = s.id ) AS componentes, " +
                "  ( SELECT COUNT(*) FROM sgsi_sbom_componente c " +
                "     WHERE c.sbom_sistema_id = s.id AND c.eol_data IS NOT NULL AND c.eol_data < CURRENT_DATE ) AS eol_vencidos " +
                "FROM sgsi_sbom_sistema s " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = s.instrumento_codigo " +
                "ORDER BY s.criticidade NULLS LAST, s.sistema");
    }

    public Map<String, Object> buscarSistema(String id) {
        List<Map<String, Object>> s = jdbc.queryForList(
                "SELECT s.id, s.sistema, s.versao, s.fornecedor, s.tipo, s.criticidade, " +
                "  s.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, s.formato, " +
                "  s.data_referencia, s.observacoes, s.origem, s.criado_em " +
                "FROM sgsi_sbom_sistema s LEFT JOIN sgsi_instrumento i ON i.codigo = s.instrumento_codigo " +
                "WHERE s.id = ?", id);
        if (s.isEmpty()) {
            return null;
        }
        List<Map<String, Object>> comps = jdbc.queryForList(
                "SELECT id, nome, versao, fornecedor, licenca, tipo, procedencia, purl, eol_data " +
                "FROM sgsi_sbom_componente WHERE sbom_sistema_id = ? ORDER BY procedencia, nome", id);
        Map<String, Object> out = new HashMap<>(s.get(0));
        out.put("componentes", comps);
        return out;
    }

    @Transactional
    public Map<String, Object> criarSistema(Map<String, Object> b, Long userId) {
        String sistema = str(b.get("sistema"));
        if (sistema == null) {
            throw new IllegalArgumentException("sistema é obrigatório");
        }
        String criticidade = str(b.get("criticidade"));
        if (criticidade != null && !CRITICIDADES.contains(criticidade)) {
            throw new IllegalArgumentException("criticidade inválida");
        }
        String id = "sb_" + hex(5);
        jdbc.update(
                "INSERT INTO sgsi_sbom_sistema (id, sistema, versao, fornecedor, tipo, criticidade, " +
                "  instrumento_codigo, formato, data_referencia, observacoes, origem) " +
                "VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'CycloneDX 1.6'), ?::date, ?, 'REAL')",
                id, sistema, str(b.get("versao")), str(b.get("fornecedor")), str(b.get("tipo")),
                criticidade, str(b.get("instrumento_codigo")), str(b.get("formato")),
                str(b.get("data_referencia")), str(b.get("observacoes")));
        audit.log("sgsi_sbom_sistema", 0L, "INSERT", userId,
                Map.of("evento", "SBOM_SISTEMA_CRIADO", "id", id, "sistema", sistema), null, null);
        return buscarSistema(id);
    }

    @Transactional
    public boolean deletarSistema(String id, Long userId) {
        boolean ok = jdbc.update("DELETE FROM sgsi_sbom_sistema WHERE id = ?", id) > 0;
        if (ok) {
            audit.log("sgsi_sbom_sistema", 0L, "DELETE", userId,
                    Map.of("evento", "SBOM_SISTEMA_EXCLUIDO", "id", id), null, null);
        }
        return ok;
    }

    @Transactional
    public Map<String, Object> adicionarComponente(String sistemaId, Map<String, Object> b, Long userId) {
        String nome = str(b.get("nome"));
        if (nome == null) {
            throw new IllegalArgumentException("nome do componente é obrigatório");
        }
        Integer existe = jdbc.queryForObject(
                "SELECT count(*) FROM sgsi_sbom_sistema WHERE id = ?", Integer.class, sistemaId);
        if (existe == null || existe == 0) {
            return null;
        }
        jdbc.update(
                "INSERT INTO sgsi_sbom_componente (sbom_sistema_id, nome, versao, fornecedor, licenca, " +
                "  tipo, procedencia, purl, eol_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?::date)",
                sistemaId, nome, str(b.get("versao")), str(b.get("fornecedor")), str(b.get("licenca")),
                str(b.get("tipo")), str(b.get("procedencia")), str(b.get("purl")), str(b.get("eol_data")));
        audit.log("sgsi_sbom_sistema", 0L, "UPDATE", userId,
                Map.of("evento", "SBOM_COMPONENTE_INCLUIDO", "sistema", sistemaId, "componente", nome), null, null);
        return buscarSistema(sistemaId);
    }

    @Transactional
    public boolean removerComponente(long componenteId, Long userId) {
        boolean ok = jdbc.update("DELETE FROM sgsi_sbom_componente WHERE id = ?", componenteId) > 0;
        if (ok) {
            audit.log("sgsi_sbom_sistema", 0L, "UPDATE", userId,
                    Map.of("evento", "SBOM_COMPONENTE_REMOVIDO", "componente", String.valueOf(componenteId)), null, null);
        }
        return ok;
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }

    private static String hex(int nBytes) {
        byte[] b = new byte[nBytes];
        RNG.nextBytes(b);
        StringBuilder sb = new StringBuilder(b.length * 2);
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }
}
