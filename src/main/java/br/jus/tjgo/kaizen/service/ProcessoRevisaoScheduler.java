package br.jus.tjgo.kaizen.service;

import br.jus.tjgo.kaizen.service.notificacao.ProcessosNegocioNotificacoes;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Aviso automático de revisão de processo. Todo dia varre os processos VIGENTES (validado_final) cuja
 * próxima revisão (Data da Versão + 1 ano) cai nos próximos 90 dias e ainda não venceu, e dispara a
 * notificação ao Responsável. O e-mail sai uma única vez por ciclo (dedupe por data da revisão no
 * {@link ProcessosNegocioNotificacoes}); a inclusão do processo na lista "Em Revisão" é feita no
 * front (janela de 90 dias) e na Home ({@code ProcessosNegocioPendenciaProvider}).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProcessoRevisaoScheduler {

    private final JdbcTemplate jdbc;
    private final ProcessosNegocioNotificacoes notificacoes;

    private static final String PROX_REVISAO =
            "(substring(pn.periodo from '^\\d{4}-\\d{2}-\\d{2}'))::date + INTERVAL '1 year'";

    /** Diariamente às 08:00 (horário do servidor). */
    @Scheduled(cron = "0 0 8 * * *")
    public void avisarRevisaoProxima() {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT pn.id, pn.nome_processo, to_char((" + PROX_REVISAO + ")::date, 'DD/MM/YYYY') AS proxima " +
                            "FROM processos_negocio pn " +
                            "WHERE pn.is_deleted = FALSE AND pn.status = 'validado_final' " +
                            "  AND " + PROX_REVISAO + " >= CURRENT_DATE " +
                            "  AND " + PROX_REVISAO + " <= CURRENT_DATE + INTERVAL '90 days'");
            for (Map<String, Object> r : rows) {
                long id = ((Number) r.get("id")).longValue();
                String nome = r.get("nome_processo") == null ? "" : String.valueOf(r.get("nome_processo"));
                String proxima = r.get("proxima") == null ? "" : String.valueOf(r.get("proxima"));
                notificacoes.aoRevisaoProxima(id, nome, proxima);
            }
            if (!rows.isEmpty()) {
                log.info("[revisao-scheduler] {} processo(s) com revisão em até 90 dias avisado(s)", rows.size());
            }
        } catch (Exception e) {
            log.warn("[revisao-scheduler] falha: {}", e.getMessage());
        }
    }
}
