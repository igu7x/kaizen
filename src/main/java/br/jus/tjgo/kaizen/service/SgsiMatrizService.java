package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Matriz de Rastreabilidade do SGSI — atividade → responsável → normativo de origem → documento →
 * emissão. Visão consolidada (somente leitura) sobre as obrigações documentais, enriquecida com a
 * tarefa 5W2H de origem e o instrumento. O prazo efetivo é derivado da âncora do instrumento + M+n
 * quando não há data explícita. As colunas de emissão vêm da própria obrigação (numero_emissao).
 */
@Service
@RequiredArgsConstructor
public class SgsiMatrizService {

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(
                "SELECT d.id, d.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, " +
                "  i.numeral_romano AS instrumento_numeral, i.ordem AS instrumento_ordem, " +
                "  t.numero AS tarefa_numero, t.fase AS tarefa_fase, " +
                "  COALESCE(t.oque, d.atividade) AS atividade, " +
                "  d.nome AS documento, d.tipo, d.referencia AS normativo_origem, d.responsavel, " +
                "  d.prazo_marco, d.status, d.numero_emissao, " +
                "  CASE " +
                "    WHEN d.prazo_data IS NOT NULL THEN d.prazo_data " +
                "    WHEN d.prazo_marco IS NOT NULL AND i.ancora IS NOT NULL " +
                "      THEN (i.ancora + make_interval(months => d.prazo_marco))::date " +
                "    ELSE NULL END AS prazo_efetivo " +
                "FROM sgsi_documento d " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = d.instrumento_codigo " +
                "LEFT JOIN sgsi_tarefa t      ON t.id = d.tarefa_id " +
                "ORDER BY i.ordem NULLS LAST, t.numero NULLS LAST, d.nome");
    }
}
