package br.jus.tjgo.kaizen.service.home.providers;

import br.jus.tjgo.kaizen.service.home.Pendencia;
import br.jus.tjgo.kaizen.service.home.PendenciaContext;
import br.jus.tjgo.kaizen.service.home.PendenciaProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Pendências dos Processos de Negócio (Escritório de Processos) — antes AUSENTES da Home. Cobre toda
 * a esteira em que o processo aguarda uma pessoa específica:
 * <ul>
 *   <li>handoff do Editor (concluir edição) e devolução ao Responsável após a edição concluída;</li>
 *   <li>validação em 3 camadas (Responsável já envia validando a camada 1 → Revisor → Compliance);</li>
 *   <li>processo recusado devolvido ao Responsável;</li>
 *   <li>homologado aguardando anexar a ata do comitê exigido;</li>
 *   <li>revisão vencida (data da versão + 1 ano no passado).</li>
 * </ul>
 *
 * <p>Predicados de papel (Responsável via {@code proprietarios}+{@code cadastros_unidades}, Revisor via
 * {@code cadastros_areas.gestor_user_id}, Editor via {@code editores}) reaproveitam exatamente os
 * mesmos joins do {@code ProcessosNegocioService.findAll}. Deep-link = página de detalhe do processo
 * (o usuário revisa e age lá; NÃO usamos o link de auto-validação por código).</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProcessosNegocioPendenciaProvider implements PendenciaProvider {

    private final JdbcTemplate jdbc;

    // Responsável do Processo (2 params: userId, userId) — snapshot proprietarios OU unidade do cadastro.
    private static final String RESP =
            "EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(pn.proprietarios, '[]'::jsonb)) e " +
                    "LEFT JOIN cadastros_unidades u ON (" +
                    "  ((e->>'unidade_id') ~ '^[0-9]+$' AND u.id = (e->>'unidade_id')::int) " +
                    "  OR LOWER(TRIM(u.nome)) = LOWER(TRIM(e->>'area'))) " +
                    "WHERE ((e->>'responsavel_user_id') ~ '^[0-9]+$' AND (e->>'responsavel_user_id')::int = ?) " +
                    "OR u.responsavel_user_id = ?)";

    // Revisor = gestor da diretoria cadastrada no processo (1 param: userId).
    private static final String REVISOR =
            "EXISTS (SELECT 1 FROM cadastros_areas a " +
                    "WHERE LOWER(TRIM(a.sigla)) = LOWER(TRIM(pn.diretoria)) " +
                    "AND a.gestor_user_id = ? AND COALESCE(a.ativo, TRUE) = TRUE)";

    // Editor atribuído (1 param: userId).
    private static final String EDITOR =
            "EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(pn.editores, '[]'::jsonb)) e " +
                    "WHERE (e->>'user_id') ~ '^[0-9]+$' AND (e->>'user_id')::int = ?)";

    // Falta pelo menos uma ata de comitê exigido (0 params).
    private static final String FALTA_ATA =
            "EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(pn.apreciacao, '[]'::jsonb)) req " +
                    "WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(pn.aprovacoes, '[]'::jsonb)) a " +
                    "WHERE a->>'comite' = req))";

    @Override
    public List<Pendencia> coletar(PendenciaContext ctx) {
        List<Pendencia> out = new ArrayList<>();
        long uid = ctx.userId();

        // 1) Editor precisa CONCLUIR a edição (handoff pendente do editor).
        add(out, "processo_editor_edicao", Pendencia.PRIO_HANDOFF, "blue",
                "1 processo de negócio aguardando você concluir a edição",
                " processos de negócio aguardando você concluir a edição",
                "pn.status IN ('em_elaboracao','recusado') AND pn.edicao_concluida_em IS NULL AND " + EDITOR,
                new Object[]{uid});

        // 2) Editor CONCLUIU — devolvido ao Responsável para enviar à validação (o handoff que o
        //    usuário descreveu: "editor terminou as alterações"). Exige editor ATRIBUÍDO — sem isso,
        //    "edição concluída pelo editor" não faz sentido (e o edicao_concluida_em é sticky, sobra
        //    de ciclos antigos em processos reabertos sem editor).
        add(out, "processo_responsavel_apos_edicao", Pendencia.PRIO_HANDOFF, "amber",
                "1 processo com edição concluída aguardando seu envio à validação",
                " processos com edição concluída aguardando seu envio à validação",
                "pn.status = 'em_elaboracao' AND pn.edicao_concluida_em IS NOT NULL " +
                        "AND jsonb_array_length(COALESCE(pn.editores,'[]'::jsonb)) > 0 AND " + RESP,
                new Object[]{uid, uid});

        // 3) Processo RECUSADO — devolvido ao Responsável para ajuste.
        add(out, "processo_recusado", Pendencia.PRIO_DEVOLVIDO, "orange",
                "1 processo de negócio foi recusado — ajuste e envie novamente",
                " processos de negócio foram recusados — ajuste e envie novamente",
                "pn.status = 'recusado' AND " + RESP,
                new Object[]{uid, uid});

        // 4) Camada 2 — Revisor (gestor da diretoria) precisa validar.
        add(out, "processo_validar_diretoria", Pendencia.PRIO_VALIDACAO, "blue",
                "1 processo de negócio aguardando sua validação (revisor)",
                " processos de negócio aguardando sua validação (revisor)",
                "pn.status = 'validado_autor' AND " + REVISOR,
                new Object[]{uid});

        // 5) Camada 3 — Compliance Officer (whitelist) precisa validar. Não é por processo: qualquer
        //    validador da whitelist vê todos os que aguardam a validação final.
        if (ctx.isValidadorFinal()) {
            add(out, "processo_validar_final", Pendencia.PRIO_VALIDACAO, "emerald",
                    "1 processo de negócio aguardando validação final (compliance officer)",
                    " processos de negócio aguardando validação final (compliance officer)",
                    "pn.status = 'validado_diretoria'",
                    new Object[]{});
        }

        // 6) Homologado, mas falta anexar a ata de comitê exigido — aguarda Responsável ou Revisor.
        add(out, "processo_comite_ata", Pendencia.PRIO_HANDOFF, "amber",
                "1 processo homologado aguardando anexar a ata do comitê",
                " processos homologados aguardando anexar a ata do comitê",
                "pn.status = 'validado_final' AND " + FALTA_ATA + " AND (" + RESP + " OR " + REVISOR + ")",
                new Object[]{uid, uid, uid});

        // 7a) Revisão SE APROXIMANDO — faltam 90 dias ou menos para a Data da Versão + 1 ano, mas
        //     ainda não venceu. O processo reentra na lista de revisão e o Responsável/Revisor é
        //     avisado para programar a revisão com antecedência.
        add(out, "processo_revisao_proxima", Pendencia.PRIO_VALIDACAO, "amber",
                "1 processo de negócio com revisão em até 90 dias — programe a revisão",
                " processos de negócio com revisão em até 90 dias — programem a revisão",
                "pn.status = 'validado_final' " +
                        "AND (substring(pn.periodo from '^\\d{4}-\\d{2}-\\d{2}'))::date + INTERVAL '1 year' >= CURRENT_DATE " +
                        "AND (substring(pn.periodo from '^\\d{4}-\\d{2}-\\d{2}'))::date + INTERVAL '1 year' <= CURRENT_DATE + INTERVAL '90 days' " +
                        "AND (" + RESP + " OR " + REVISOR + ")",
                new Object[]{uid, uid, uid});

        // 7b) Revisão vencida (Data da Versão + 1 ano no passado) — aguarda Responsável ou Revisor.
        add(out, "processo_revisao_vencida", Pendencia.PRIO_VENCIDO, "red",
                "1 processo de negócio com revisão vencida — inicie a revisão",
                " processos de negócio com revisão vencida — iniciem a revisão",
                "pn.status = 'validado_final' " +
                        "AND (substring(pn.periodo from '^\\d{4}-\\d{2}-\\d{2}'))::date + INTERVAL '1 year' < CURRENT_DATE " +
                        "AND (" + RESP + " OR " + REVISOR + ")",
                new Object[]{uid, uid, uid});

        return out;
    }

    /** Executa uma query de contagem+primeiro-id e, se houver linhas, adiciona a pendência. */
    private void add(List<Pendencia> out, String tipo, int prioridade, String color,
                     String singular, String pluralSuffix, String whereExtra, Object[] params) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT pn.id FROM processos_negocio pn " +
                            "WHERE pn.is_deleted = FALSE AND " + whereExtra + " " +
                            "ORDER BY pn.updated_at DESC",
                    params);
            if (rows.isEmpty()) {
                return;
            }
            int n = rows.size();
            String label = n == 1 ? singular : n + pluralSuffix;
            // Deep-link ?abrir=<id>: a lista abre o modal de visualização (com Validar/Enviar),
            // não a tela de detalhe só-leitura.
            String link = "/gestao-estrategica/processos?abrir=" + rows.get(0).get("id");
            out.add(new Pendencia(tipo, label, n, link, color, Pendencia.CAT_PROCESSOS, prioridade));
        } catch (Exception e) {
            log.warn("[home] {}: {}", tipo, e.getMessage());
        }
    }
}
