package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

/**
 * Instrumentos normativos do SGSI (POSIC/TJGO basilar + 13 complementares). 1ª fatia do
 * módulo "Segurança da Informação". Leitura por ora; a escrita/administração virá com o
 * mapeamento de permissões. Soft-delete não se aplica (conteúdo normativo institucional).
 */
@Service
@RequiredArgsConstructor
public class SgsiInstrumentoService {

    private final JdbcTemplate jdbc;

    /** Lista os instrumentos na ordem oficial, com o progresso agregado do plano 5W2H. */
    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(
                "SELECT i.codigo, i.ordem, i.numeral_romano, i.sigla_oficial, i.nome_curto, " +
                "       i.nome_completo, i.titulo_plano, i.cor_hex, i.restrito, i.artigos, " +
                "       i.versao, i.ancora, i.vigente_desde, " +
                "       COUNT(t.id)                                        AS total_tarefas, " +
                "       COUNT(t.id) FILTER (WHERE t.status = 'CONCLUIDA')  AS tarefas_concluidas, " +
                "       COALESCE(ROUND(AVG(t.percentual) * 100), 0)::int   AS progresso " +
                "  FROM sgsi_instrumento i " +
                "  LEFT JOIN sgsi_tarefa t ON t.instrumento_codigo = i.codigo " +
                " GROUP BY i.codigo " +
                " ORDER BY i.ordem");
    }

    public Map<String, Object> buscar(String codigo) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT * FROM sgsi_instrumento WHERE codigo = ?", codigo);
        return rows.isEmpty() ? null : rows.get(0);
    }
}
