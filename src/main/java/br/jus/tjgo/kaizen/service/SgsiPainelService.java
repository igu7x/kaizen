package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Painel de Compliance do SGSI — visão executiva agregando as fatias já portadas
 * (tarefas 5W2H, obrigações documentais, indicadores) e o progresso por instrumento.
 * Somente leitura; não cria tabelas.
 */
@Service
@RequiredArgsConstructor
public class SgsiPainelService {

    private final JdbcTemplate jdbc;

    public Map<String, Object> resumo() {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("tarefas", jdbc.queryForMap(
                "SELECT count(*) AS total, " +
                "  count(*) FILTER (WHERE status='CONCLUIDA')   AS concluidas, " +
                "  count(*) FILTER (WHERE status='EM_ANDAMENTO') AS em_andamento, " +
                "  count(*) FILTER (WHERE status='ATRASADA')     AS atrasadas, " +
                "  count(*) FILTER (WHERE status='BLOQUEADA')    AS bloqueadas, " +
                "  count(*) FILTER (WHERE status='NAO_INICIADA') AS nao_iniciadas, " +
                "  COALESCE(ROUND(AVG(percentual)*100),0)::int   AS progresso " +
                "FROM sgsi_tarefa"));

        out.put("documentos", jdbc.queryForMap(
                "SELECT count(*) AS total, " +
                "  count(*) FILTER (WHERE status NOT IN ('ASSINADO','PUBLICADO','CANCELADO')) AS pendentes, " +
                "  count(*) FILTER (WHERE status IN ('ASSINADO','PUBLICADO')) AS publicados, " +
                "  count(*) FILTER (WHERE status='CANCELADO') AS cancelados " +
                "FROM sgsi_documento"));

        out.put("indicadores", jdbc.queryForMap(
                "SELECT count(*) AS total, " +
                "  count(meta) AS com_meta, " +
                "  count(*) FILTER (WHERE ult.valor IS NOT NULL) AS com_medicao, " +
                "  count(*) FILTER (WHERE meta IS NOT NULL AND ult.valor IS NOT NULL AND " +
                "     ((direcao='>=' AND ult.valor >= meta) OR (direcao='<=' AND ult.valor <= meta))) AS dentro_meta, " +
                "  count(*) FILTER (WHERE meta IS NOT NULL AND ult.valor IS NOT NULL AND " +
                "     NOT ((direcao='>=' AND ult.valor >= meta) OR (direcao='<=' AND ult.valor <= meta))) AS fora_meta " +
                "FROM sgsi_indicador i " +
                "LEFT JOIN LATERAL (SELECT valor FROM sgsi_medicao WHERE indicador_id=i.id " +
                "                   ORDER BY competencia DESC LIMIT 1) ult ON true"));

        List<Map<String, Object>> instrumentos = jdbc.queryForList(
                "SELECT i.codigo, i.sigla_oficial, i.numeral_romano, i.ordem, i.cor_hex, i.restrito, " +
                "  COUNT(t.id) AS total_tarefas, " +
                "  COUNT(t.id) FILTER (WHERE t.status='CONCLUIDA') AS tarefas_concluidas, " +
                "  COALESCE(ROUND(AVG(t.percentual)*100),0)::int   AS progresso " +
                "FROM sgsi_instrumento i " +
                "LEFT JOIN sgsi_tarefa t ON t.instrumento_codigo = i.codigo " +
                "GROUP BY i.codigo ORDER BY i.ordem");
        out.put("instrumentos", instrumentos);

        return out;
    }
}
