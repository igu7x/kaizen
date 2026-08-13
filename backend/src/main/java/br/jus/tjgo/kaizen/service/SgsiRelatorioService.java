package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Catálogo de Relatórios do SGSI — os modelos que a instituição deve produzir, com periodicidade,
 * destinatário, base normativa e instrumento relacionado. 9ª fatia (somente o catálogo; a emissão
 * efetiva de relatórios, acoplada às Emissões, fica para depois).
 */
@Service
@RequiredArgsConstructor
public class SgsiRelatorioService {

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> listarCatalogo() {
        return jdbc.queryForList(
                "SELECT c.codigo, c.nome, c.obrigatorio, c.periodicidade, c.destinatario, " +
                "  c.base_normativa, c.instrumento_codigo, i.sigla_oficial AS instrumento_sigla, c.ordem " +
                "FROM sgsi_relatorio_catalogo c " +
                "LEFT JOIN sgsi_instrumento i ON i.codigo = c.instrumento_codigo " +
                "ORDER BY c.ordem");
    }
}
