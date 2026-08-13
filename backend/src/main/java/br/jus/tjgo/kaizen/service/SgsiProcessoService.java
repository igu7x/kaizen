package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Processos de negócio (BPMN) do SGSI. A listagem é leve (metadados + contagens); o detalhe traz
 * raias/nós/fluxos como texto JSON, e o diagrama swimlane é montado no front. 11ª fatia — leitura.
 */
@Service
@RequiredArgsConstructor
public class SgsiProcessoService {

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(
                "SELECT p.id, p.nome, p.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, " +
                "  p.referencia, p.restrito, p.versao, " +
                "  jsonb_array_length(p.lanes) AS raias, jsonb_array_length(p.nodes) AS nos " +
                "FROM sgsi_processo p " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = p.instrumento_codigo " +
                "ORDER BY p.id");
    }

    public Map<String, Object> buscar(String id) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id, p.nome, p.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, " +
                "  p.referencia, p.restrito, p.versao, " +
                "  p.lanes::text AS lanes, p.nodes::text AS nodes, p.flows::text AS flows " +
                "FROM sgsi_processo p " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = p.instrumento_codigo " +
                "WHERE p.id = ?", id);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
