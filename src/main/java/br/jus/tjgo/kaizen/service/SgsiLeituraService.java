package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

/**
 * Ciência e Leitura Confirmada de instrumentos normativos (RN-39). Cada instrumento pode ter um
 * conjunto de leitores exigidos ({@code sgsi_leitura_requisito}); se estiver vazio, a leitura é
 * exigida de TODOS os usuários ativos. A confirmação é registrada por usuário/instrumento. 16ª fatia.
 */
@Service
@RequiredArgsConstructor
public class SgsiLeituraService {

    private final JdbcTemplate jdbc;
    private final AuditService audit;

    /** Filtro do universo "todos" — usuários ativos do Kaizen. */
    private static final String ATIVOS = "status = 'ACTIVE' AND is_deleted = false";

    /** Panorama por instrumento: exigidos, confirmados e a situação do próprio usuário. */
    public List<Map<String, Object>> panorama(Long userId) {
        String temReq = "EXISTS (SELECT 1 FROM sgsi_leitura_requisito r WHERE r.instrumento_codigo = i.codigo)";
        return jdbc.queryForList(
                "SELECT i.codigo, i.sigla_oficial, i.numeral_romano, i.ordem, " +
                "  (SELECT count(*) FROM sgsi_leitura_requisito r WHERE r.instrumento_codigo = i.codigo) AS requisitos, " +
                "  CASE WHEN " + temReq + " " +
                "       THEN (SELECT count(*) FROM sgsi_leitura_requisito r WHERE r.instrumento_codigo = i.codigo) " +
                "       ELSE (SELECT count(*) FROM users WHERE " + ATIVOS + ") END AS exigidos, " +
                "  CASE WHEN " + temReq + " " +
                "       THEN (SELECT count(*) FROM sgsi_leitura_confirmacao c " +
                "               JOIN sgsi_leitura_requisito r " +
                "                 ON r.instrumento_codigo = c.instrumento_codigo AND r.usuario_id = c.usuario_id " +
                "              WHERE c.instrumento_codigo = i.codigo) " +
                "       ELSE (SELECT count(*) FROM sgsi_leitura_confirmacao c " +
                "               JOIN users u ON u.id = c.usuario_id AND " + ATIVOS + " " +
                "              WHERE c.instrumento_codigo = i.codigo) END AS confirmados, " +
                "  EXISTS (SELECT 1 FROM sgsi_leitura_confirmacao c " +
                "           WHERE c.instrumento_codigo = i.codigo AND c.usuario_id = ?) AS eu_confirmei, " +
                "  CASE WHEN " + temReq + " " +
                "       THEN EXISTS (SELECT 1 FROM sgsi_leitura_requisito r " +
                "                     WHERE r.instrumento_codigo = i.codigo AND r.usuario_id = ?) " +
                "       ELSE EXISTS (SELECT 1 FROM users WHERE id = ? AND " + ATIVOS + ") END AS eu_exigido " +
                "FROM sgsi_instrumento i ORDER BY i.ordem",
                userId, userId, userId);
    }

    /** Detalhe de um instrumento: modo do universo e a lista de leitores com sua confirmação. */
    public Map<String, Object> detalhe(String codigo) {
        List<Map<String, Object>> inst = jdbc.queryForList(
                "SELECT codigo, sigla_oficial, nome_completo, numeral_romano FROM sgsi_instrumento WHERE codigo = ?",
                codigo);
        if (inst.isEmpty()) {
            return null;
        }
        Integer requisitos = jdbc.queryForObject(
                "SELECT count(*) FROM sgsi_leitura_requisito WHERE instrumento_codigo = ?", Integer.class, codigo);
        boolean modoLista = requisitos != null && requisitos > 0;

        List<Map<String, Object>> leitores;
        if (modoLista) {
            leitores = jdbc.queryForList(
                    "SELECT u.id AS usuario_id, u.name AS nome, u.email, " +
                    "  (c.usuario_id IS NOT NULL) AS confirmado, c.confirmado_em " +
                    "FROM sgsi_leitura_requisito r " +
                    "JOIN users u ON u.id = r.usuario_id " +
                    "LEFT JOIN sgsi_leitura_confirmacao c " +
                    "  ON c.instrumento_codigo = r.instrumento_codigo AND c.usuario_id = r.usuario_id " +
                    "WHERE r.instrumento_codigo = ? ORDER BY u.name", codigo);
        } else {
            leitores = jdbc.queryForList(
                    "SELECT u.id AS usuario_id, u.name AS nome, u.email, " +
                    "  (c.usuario_id IS NOT NULL) AS confirmado, c.confirmado_em " +
                    "FROM users u " +
                    "LEFT JOIN sgsi_leitura_confirmacao c " +
                    "  ON c.instrumento_codigo = ? AND c.usuario_id = u.id " +
                    "WHERE " + ATIVOS + " ORDER BY u.name", codigo);
        }
        long confirmados = leitores.stream().filter(l -> Boolean.TRUE.equals(l.get("confirmado"))).count();

        Map<String, Object> out = new java.util.HashMap<>();
        out.put("instrumento", inst.get(0));
        out.put("modo", modoLista ? "LISTA" : "TODOS");
        out.put("exigidos", leitores.size());
        out.put("confirmados", confirmados);
        out.put("leitores", leitores);
        return out;
    }

    /** Substitui o conjunto de leitores exigidos. Lista vazia = todos os usuários ativos (RN-39). */
    @Transactional
    public Map<String, Object> definirRequisitos(String codigo, List<Long> usuarioIds, Long definidoPor) {
        Integer existe = jdbc.queryForObject(
                "SELECT count(*) FROM sgsi_instrumento WHERE codigo = ?", Integer.class, codigo);
        if (existe == null || existe == 0) {
            return null;
        }
        jdbc.update("DELETE FROM sgsi_leitura_requisito WHERE instrumento_codigo = ?", codigo);
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        if (usuarioIds != null) {
            for (Long id : usuarioIds) {
                if (id != null) ids.add(id);
            }
        }
        for (Long id : ids) {
            jdbc.update(
                    "INSERT INTO sgsi_leitura_requisito (instrumento_codigo, usuario_id, definido_por) " +
                    "VALUES (?, ?, ?)", codigo, id, definidoPor);
        }
        audit.log("sgsi_leitura_requisito", 0L, "UPDATE", definidoPor,
                Map.of("evento", "REQUISITOS_DEFINIDOS", "instrumento", codigo,
                        "leitores", String.valueOf(ids.size())), null, null);
        return detalhe(codigo);
    }

    /** Registra (ou atualiza) a confirmação de leitura do usuário para o instrumento. */
    @Transactional
    public Map<String, Object> confirmar(String codigo, Long userId, String origemIp) {
        Integer existe = jdbc.queryForObject(
                "SELECT count(*) FROM sgsi_instrumento WHERE codigo = ?", Integer.class, codigo);
        if (existe == null || existe == 0) {
            return null;
        }
        jdbc.update(
                "INSERT INTO sgsi_leitura_confirmacao (instrumento_codigo, usuario_id, origem_ip) " +
                "VALUES (?, ?, ?::inet) " +
                "ON CONFLICT (instrumento_codigo, usuario_id) DO UPDATE " +
                "  SET confirmado_em = now(), origem_ip = EXCLUDED.origem_ip",
                codigo, userId, origemIp);
        audit.log("sgsi_leitura_confirmacao", 0L, "INSERT", userId,
                Map.of("evento", "LEITURA_CONFIRMADA", "instrumento", codigo), null, null);
        return detalhe(codigo);
    }
}
