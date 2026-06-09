package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Porte fiel de comites.service.ts (comitês + membros + reuniões + pauta + quadro de controle + ata).
 * Comitês filtrados por domínio. Reuniões/pauta/quadro são hard-DELETE; comitês/membros soft (ativo).
 * Bug #4: casts ?::date em comite_reunioes.data e comite_quadro_controle.prazo.
 */
@Service
@RequiredArgsConstructor
public class ComitesService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    // ======================== COMITÊS ========================

    public List<Map<String, Object>> findAll(String dominio) {
        if (dominio != null) {
            try {
                return jdbc.queryForList(
                        "SELECT * FROM comites WHERE ativo = TRUE AND dominio = ? ORDER BY ordem ASC", dominio);
            } catch (Exception e) {
                return jdbc.queryForList("SELECT * FROM comites WHERE ativo = TRUE ORDER BY ordem ASC");
            }
        }
        return jdbc.queryForList("SELECT * FROM comites WHERE ativo = TRUE ORDER BY ordem ASC");
    }

    public Map<String, Object> findById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM comites WHERE id = ? AND ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> findBySigla(String sigla) {
        var rows = jdbc.queryForList("SELECT * FROM comites WHERE UPPER(sigla) = UPPER(?) AND ativo = TRUE", sigla);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> create(Map<String, Object> data, Long userId) {
        String dominio = data.get("dominio") != null ? (String) data.get("dominio") : "SGJT";
        Integer nextOrdem = jdbc.queryForObject(
                "SELECT COALESCE(MAX(ordem), 0) + 1 AS next_ordem FROM comites WHERE dominio = ?", Integer.class, dominio);
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO comites (nome, sigla, descricao, icone, cor, ordem, dominio, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                data.get("nome"), data.get("sigla"), orNull(data.get("descricao")), orNull(data.get("icone")),
                data.get("cor") != null ? data.get("cor") : "#1565C0", nextOrdem, dominio, userId, userId);
        audit.log("comites", asLong(created.get("id")), "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> update(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> oldRecord = findById(id);
        if (oldRecord == null) {
            return null;
        }
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("nome", "sigla", "descricao", "icone", "cor", "ordem")) {
            if (data.containsKey(key)) {
                updates.add(key + " = ?");
                values.add(data.get(key));
            }
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord;
        }
        var rows = jdbc.queryForList(
                "UPDATE comites SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND ativo = TRUE RETURNING *", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        audit.log("comites", id, "UPDATE", userId, null, oldRecord, rows.get(0));
        return rows.get(0);
    }

    public boolean deleteComite(long id, Long userId) {
        var rows = jdbc.queryForList(
                "UPDATE comites SET ativo = FALSE, updated_by = ?, updated_at = NOW() WHERE id = ? AND ativo = TRUE RETURNING id",
                userId, id);
        if (!rows.isEmpty()) {
            audit.log("comites", id, "SOFT_DELETE", userId);
        }
        return !rows.isEmpty();
    }

    // ======================== MEMBROS ========================

    public List<Map<String, Object>> findMembros(long comiteId) {
        return jdbc.queryForList(
                "SELECT * FROM comite_membros WHERE comite_id = ? AND ativo = TRUE ORDER BY ordem ASC", comiteId);
    }

    private Map<String, Object> findMembroById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM comite_membros WHERE id = ? AND ativo = TRUE", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createMembro(long comiteId, Map<String, Object> data, Long userId) {
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO comite_membros (comite_id, nome, cargo, ordem, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
                comiteId, data.get("nome"), data.get("cargo"),
                data.get("ordem") != null ? data.get("ordem") : 0, userId, userId);
        audit.log("comite_membros", asLong(created.get("id")), "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> updateMembro(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> oldRecord = findMembroById(id);
        if (oldRecord == null) {
            return null;
        }
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("nome", "cargo", "ordem")) {
            if (data.containsKey(key)) {
                updates.add(key + " = ?");
                values.add(data.get(key));
            }
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord;
        }
        var rows = jdbc.queryForList(
                "UPDATE comite_membros SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? AND ativo = TRUE RETURNING *", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        audit.log("comite_membros", id, "UPDATE", userId, null, oldRecord, rows.get(0));
        return rows.get(0);
    }

    public boolean deleteMembro(long id, Long userId) {
        Map<String, Object> existing = findMembroById(id);
        if (existing == null) {
            return false;
        }
        jdbc.update("UPDATE comite_membros SET ativo = FALSE WHERE id = ?", id);
        audit.log("comite_membros", id, "SOFT_DELETE", userId, null, existing, null);
        return true;
    }

    // ======================== REUNIÕES ========================

    public List<Map<String, Object>> findReunioes(long comiteId, Integer ano) {
        if (ano != null) {
            return jdbc.queryForList(
                    "SELECT * FROM comite_reunioes WHERE comite_id = ? AND ano = ? ORDER BY data ASC", comiteId, ano);
        }
        return jdbc.queryForList("SELECT * FROM comite_reunioes WHERE comite_id = ? ORDER BY data ASC", comiteId);
    }

    public Map<String, Object> findReuniaoById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM comite_reunioes WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createReuniao(long comiteId, Map<String, Object> data, Long userId) {
        Object numero = data.get("numero");
        Object ano = data.get("ano");
        String titulo = data.get("titulo") != null ? (String) data.get("titulo")
                : "Reunião " + numero + " - " + ano;
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO comite_reunioes (comite_id, numero, ano, data, mes, status, tipo_reuniao, titulo, " +
                        "observacoes, link_proad, link_transparencia, link_ata, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?::date, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING *",
                comiteId, numero, ano, data.get("data"), orNull(data.get("mes")),
                data.get("status") != null ? data.get("status") : "Previsto",
                data.get("tipo_reuniao") != null ? data.get("tipo_reuniao") : "Ordinária",
                titulo, orNull(data.get("observacoes")), orNull(data.get("link_proad")),
                orNull(data.get("link_transparencia")), orNull(data.get("link_ata")), userId, userId);
        audit.log("comite_reunioes", asLong(created.get("id")), "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> updateReuniao(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> oldRecord = findReuniaoById(id);
        if (oldRecord == null) {
            return null;
        }
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("numero", "ano", "data", "mes", "status", "tipo_reuniao", "titulo",
                "observacoes", "link_proad", "link_transparencia", "link_ata")) {
            if (data.containsKey(key)) {
                updates.add(key + ("data".equals(key) ? " = ?::date" : " = ?"));
                values.add(data.get(key));
            }
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord;
        }
        var rows = jdbc.queryForList(
                "UPDATE comite_reunioes SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? RETURNING *", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        audit.log("comite_reunioes", id, "UPDATE", userId, null, oldRecord, rows.get(0));
        return rows.get(0);
    }

    public boolean deleteReuniao(long id, Long userId) {
        Map<String, Object> existing = findReuniaoById(id);
        if (existing == null) {
            return false;
        }
        jdbc.update("DELETE FROM comite_reunioes WHERE id = ?", id);
        audit.log("comite_reunioes", id, "DELETE", userId, null, existing, null);
        return true;
    }

    public Map<String, Object> updateReuniaoAta(long id, String filename, String filepath, Long filesize, Long userId) {
        Map<String, Object> oldRecord = findReuniaoById(id);
        if (oldRecord == null) {
            return null;
        }
        Map<String, Object> updated;
        if (filename == null) {
            updated = jdbc.queryForMap(
                    "UPDATE comite_reunioes SET ata_filename = NULL, ata_filepath = NULL, ata_filesize = NULL, " +
                            "ata_uploaded_at = NULL, ata_uploaded_by = NULL, updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? RETURNING *", userId, id);
        } else {
            updated = jdbc.queryForMap(
                    "UPDATE comite_reunioes SET ata_filename = ?, ata_filepath = ?, ata_filesize = ?, " +
                            "ata_uploaded_at = NOW(), ata_uploaded_by = ?, updated_at = NOW(), updated_by = ? " +
                            "WHERE id = ? RETURNING *", filename, filepath, filesize, userId, userId, id);
        }
        audit.log("comite_reunioes", id, "UPDATE_ATA", userId);
        return updated;
    }

    // ======================== PAUTA ========================

    public List<Map<String, Object>> findPauta(long reuniaoId) {
        return jdbc.queryForList(
                "SELECT * FROM comite_reuniao_pauta WHERE reuniao_id = ? ORDER BY ordem ASC, numero_item ASC", reuniaoId);
    }

    private Map<String, Object> findPautaById(long id) {
        var rows = jdbc.queryForList("SELECT * FROM comite_reuniao_pauta WHERE id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createPauta(long reuniaoId, Map<String, Object> data, Long userId) {
        Object numeroItem = data.get("numero_item");
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO comite_reuniao_pauta (reuniao_id, numero_item, descricao, ordem, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?) RETURNING *",
                reuniaoId, numeroItem, data.get("descricao"),
                data.get("ordem") != null ? data.get("ordem") : numeroItem, userId, userId);
        audit.log("comite_reuniao_pauta", asLong(created.get("id")), "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> updatePauta(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> oldRecord = findPautaById(id);
        if (oldRecord == null) {
            return null;
        }
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("numero_item", "descricao", "ordem")) {
            if (data.containsKey(key)) {
                updates.add(key + " = ?");
                values.add(data.get(key));
            }
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord;
        }
        var rows = jdbc.queryForList(
                "UPDATE comite_reuniao_pauta SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? RETURNING *", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        audit.log("comite_reuniao_pauta", id, "UPDATE", userId, null, oldRecord, rows.get(0));
        return rows.get(0);
    }

    public boolean deletePauta(long id, Long userId) {
        Map<String, Object> existing = findPautaById(id);
        if (existing == null) {
            return false;
        }
        jdbc.update("DELETE FROM comite_reuniao_pauta WHERE id = ?", id);
        audit.log("comite_reuniao_pauta", id, "DELETE", userId, null, existing, null);
        return true;
    }

    // ======================== QUADRO DE CONTROLE ========================

    private static final String QC_SELECT = "SELECT qc.*, r.numero AS reuniao_numero, r.ano AS reuniao_ano, " +
            "r.data AS reuniao_data, p.numero_item AS item_pauta_numero, p.descricao AS item_pauta_descricao " +
            "FROM comite_quadro_controle qc " +
            "LEFT JOIN comite_reunioes r ON qc.reuniao_id = r.id " +
            "LEFT JOIN comite_reuniao_pauta p ON qc.item_pauta_id = p.id ";

    public List<Map<String, Object>> findQuadroControle(long comiteId) {
        return jdbc.queryForList(QC_SELECT + "WHERE qc.comite_id = ? ORDER BY qc.ordem ASC, qc.created_at DESC", comiteId);
    }

    private Map<String, Object> findQuadroControleById(long id) {
        var rows = jdbc.queryForList(QC_SELECT + "WHERE qc.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    public Map<String, Object> createQuadroControle(long comiteId, Map<String, Object> data, Long userId) {
        Map<String, Object> created = jdbc.queryForMap(
                "INSERT INTO comite_quadro_controle (comite_id, item, reuniao_id, item_pauta_id, discussao_contexto, " +
                        "deliberacao, decisao_encaminhamento, acoes_atividades, responsavel, prazo, observacoes, status, " +
                        "ordem, created_by, updated_by) " +
                        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?::date, ?, ?, ?, ?, ?) RETURNING *",
                comiteId, data.get("item"), toNullId(data.get("reuniao_id")), toNullId(data.get("item_pauta_id")),
                toNull(data.get("discussao_contexto")), toNull(data.get("deliberacao")),
                toNull(data.get("decisao_encaminhamento")), toNull(data.get("acoes_atividades")),
                toNull(data.get("responsavel")), toNull(data.get("prazo")), toNull(data.get("observacoes")),
                data.get("status") != null ? data.get("status") : "Andamento",
                data.get("ordem") != null ? data.get("ordem") : 0, userId, userId);
        audit.log("comite_quadro_controle", asLong(created.get("id")), "INSERT", userId, null, null, created);
        return created;
    }

    public Map<String, Object> updateQuadroControle(long id, Map<String, Object> data, Long userId) {
        Map<String, Object> oldRecord = findQuadroControleById(id);
        if (oldRecord == null) {
            return null;
        }
        List<String> updates = new ArrayList<>();
        List<Object> values = new ArrayList<>();
        for (String key : List.of("item", "reuniao_id", "item_pauta_id", "discussao_contexto", "deliberacao",
                "decisao_encaminhamento", "acoes_atividades", "responsavel", "prazo", "observacoes", "status", "ordem")) {
            if (data.containsKey(key)) {
                updates.add(key + ("prazo".equals(key) ? " = ?::date" : " = ?"));
                Object value = data.get(key);
                values.add("".equals(value) ? null : value); // string vazia -> null (Node)
            }
        }
        updates.add("updated_by = ?");
        values.add(userId);
        values.add(id);
        if (updates.size() == 1) {
            return oldRecord;
        }
        var rows = jdbc.queryForList(
                "UPDATE comite_quadro_controle SET " + String.join(", ", updates) + ", updated_at = NOW() " +
                        "WHERE id = ? RETURNING *", values.toArray());
        if (rows.isEmpty()) {
            return null;
        }
        audit.log("comite_quadro_controle", id, "UPDATE", userId, null, oldRecord, rows.get(0));
        return rows.get(0);
    }

    public boolean deleteQuadroControle(long id, Long userId) {
        Map<String, Object> existing = findQuadroControleById(id);
        if (existing == null) {
            return false;
        }
        jdbc.update("DELETE FROM comite_quadro_controle WHERE id = ?", id);
        audit.log("comite_quadro_controle", id, "DELETE", userId, null, existing, null);
        return true;
    }

    // ======================== HELPERS ========================

    private static Object orNull(Object v) {
        return v == null ? null : v;
    }

    /** toNull do Node: '' -> null, senão (v || null). */
    private static Object toNull(Object v) {
        if (v == null || "".equals(v)) {
            return null;
        }
        return v;
    }

    /** toNullId do Node: '' | null | undefined -> null. */
    private static Object toNullId(Object v) {
        if (v == null || "".equals(v)) {
            return null;
        }
        return v;
    }

    private static Long asLong(Object v) {
        return v == null ? null : ((Number) v).longValue();
    }
}
