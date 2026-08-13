package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Map;

/**
 * Atas de reunião dos comitês do SGSI (deliberação/homologação). CRUD simples de texto — 10ª fatia.
 */
@Service
@RequiredArgsConstructor
public class SgsiAtaService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    private static final String SELECT_BASE =
            "SELECT a.id, a.data_reuniao, a.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, " +
            "  a.titulo, a.participantes, a.pauta, a.deliberacoes, a.encaminhamentos, " +
            "  a.numero_emissao, a.criado_em " +
            "FROM sgsi_ata a LEFT JOIN sgsi_instrumento i ON i.codigo = a.instrumento_codigo ";

    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(SELECT_BASE + " ORDER BY a.data_reuniao DESC, a.id DESC");
    }

    public Map<String, Object> buscar(long id) {
        List<Map<String, Object>> rows = jdbc.queryForList(SELECT_BASE + " WHERE a.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }

    @Transactional
    public Map<String, Object> criar(Map<String, Object> b, Long userId) {
        String titulo = str(b.get("titulo"));
        String data = str(b.get("data_reuniao"));
        if (titulo == null) throw new IllegalArgumentException("título é obrigatório");
        if (data == null) throw new IllegalArgumentException("data da reunião é obrigatória");
        Long id = jdbc.queryForObject(
                "INSERT INTO sgsi_ata (data_reuniao, instrumento_codigo, titulo, participantes, pauta, " +
                "  deliberacoes, encaminhamentos, numero_emissao, criado_por) " +
                "VALUES (?::date, ?, ?, ?, ?, ?, ?, ?, ?) RETURNING id",
                Long.class,
                data, str(b.get("instrumento_codigo")), titulo, str(b.get("participantes")),
                str(b.get("pauta")), str(b.get("deliberacoes")), str(b.get("encaminhamentos")),
                str(b.get("numero_emissao")), userId);
        audit.log("sgsi_ata", id, "INSERT", userId, Map.of("evento", "CRIADO"), null, null);
        return buscar(id);
    }

    @Transactional
    public Map<String, Object> atualizar(long id, Map<String, Object> b, Long userId) {
        if (buscar(id) == null) return null;
        String titulo = str(b.get("titulo"));
        String data = str(b.get("data_reuniao"));
        if (titulo == null) throw new IllegalArgumentException("título é obrigatório");
        if (data == null) throw new IllegalArgumentException("data da reunião é obrigatória");
        jdbc.update(
                "UPDATE sgsi_ata SET data_reuniao=?::date, instrumento_codigo=?, titulo=?, participantes=?, " +
                "  pauta=?, deliberacoes=?, encaminhamentos=?, numero_emissao=? WHERE id=?",
                data, str(b.get("instrumento_codigo")), titulo, str(b.get("participantes")),
                str(b.get("pauta")), str(b.get("deliberacoes")), str(b.get("encaminhamentos")),
                str(b.get("numero_emissao")), id);
        audit.log("sgsi_ata", id, "UPDATE", userId, Map.of("evento", "ATUALIZADO"), null, null);
        return buscar(id);
    }

    @Transactional
    public boolean deletar(long id, Long userId) {
        boolean ok = jdbc.update("DELETE FROM sgsi_ata WHERE id = ?", id) > 0;
        if (ok) {
            audit.log("sgsi_ata", id, "DELETE", userId, Map.of("evento", "EXCLUIDO"), null, null);
        }
        return ok;
    }

    private static String str(Object v) {
        if (v == null) return null;
        String s = String.valueOf(v).trim();
        return s.isEmpty() ? null : s;
    }
}
