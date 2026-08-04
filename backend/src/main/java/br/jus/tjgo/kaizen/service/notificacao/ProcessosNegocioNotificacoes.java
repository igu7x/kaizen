package br.jus.tjgo.kaizen.service.notificacao;

import br.jus.tjgo.kaizen.util.Validadores;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

/**
 * Resolve os destinatários e dispara as notificações de pendência dos Processos de Negócio, a partir
 * da linha do processo já atualizada (RETURNING *). Mantém o {@code ProcessosNegocioService} limpo:
 * cada transição chama um método daqui. Nunca lança para o chamador (a notificação jamais quebra a
 * ação de negócio). Os predicados de papel reaproveitam a mesma lógica dos providers da Home.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProcessosNegocioNotificacoes {

    private static final String LINK = "/gestao-estrategica/processos/";
    private final JdbcTemplate jdbc;
    private final Notificador notificador;

    /** Enviado à validação → avisa o Revisor (gestor da diretoria). */
    public void aoEnviarParaValidacao(Map<String, Object> proc) {
        try {
            long id = idDe(proc);
            String nome = str(proc.get("nome_processo"));
            Long gestor = gestorDaDiretoria(str(proc.get("diretoria")));
            if (gestor != null) {
                notificador.notificar(gestor, "processo_validar_diretoria", id,
                        proc.get("validado_autor_em"),
                        "Processo de negócio aguardando sua validação (revisor)",
                        "O processo \"" + nome + "\" foi enviado e aguarda sua validação como revisor da diretoria.",
                        LINK + id);
            }
        } catch (Exception e) {
            log.warn("[notif-processo] enviar: {}", e.getMessage());
        }
    }

    /** Validado pela diretoria → avisa os Compliance Officers (whitelist de validação final). */
    public void aoValidarDiretoria(Map<String, Object> proc) {
        try {
            long id = idDe(proc);
            String nome = str(proc.get("nome_processo"));
            for (Long uid : validadoresFinais()) {
                notificador.notificar(uid, "processo_validar_final", id,
                        proc.get("validado_diretoria_em"),
                        "Processo de negócio aguardando validação final",
                        "O processo \"" + nome + "\" passou pela diretoria e aguarda a validação final (compliance officer).",
                        LINK + id);
            }
        } catch (Exception e) {
            log.warn("[notif-processo] validar-diretoria: {}", e.getMessage());
        }
    }

    /** Homologado, mas faltam atas de comitê → avisa os Responsáveis para anexá-las. */
    public void aoValidarFinal(Map<String, Object> proc) {
        try {
            long id = idDe(proc);
            String nome = str(proc.get("nome_processo"));
            Boolean faltaAta = jdbc.queryForObject(
                    "SELECT EXISTS (SELECT 1 FROM jsonb_array_elements_text(COALESCE(apreciacao,'[]'::jsonb)) req " +
                            "WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(COALESCE(aprovacoes,'[]'::jsonb)) a " +
                            "WHERE a->>'comite' = req)) FROM processos_negocio WHERE id = ?",
                    Boolean.class, id);
            if (Boolean.TRUE.equals(faltaAta)) {
                for (Long uid : responsaveis(id)) {
                    notificador.notificar(uid, "processo_comite_ata", id,
                            proc.get("validado_final_em"),
                            "Processo homologado — anexe a ata do comitê",
                            "O processo \"" + nome + "\" foi homologado, mas ainda falta anexar a ata de um comitê exigido.",
                            LINK + id);
                }
            }
        } catch (Exception e) {
            log.warn("[notif-processo] validar-final: {}", e.getMessage());
        }
    }

    /** Recusado → devolve aos Responsáveis para ajuste. */
    public void aoRecusar(Map<String, Object> proc, String camada, String motivo) {
        try {
            long id = idDe(proc);
            String nome = str(proc.get("nome_processo"));
            String porque = (motivo != null && !motivo.isBlank()) ? " Motivo: " + motivo : "";
            for (Long uid : responsaveis(id)) {
                notificador.notificar(uid, "processo_recusado", id, proc.get("recusado_em"),
                        "Processo de negócio recusado — ajuste e reenvie",
                        "O processo \"" + nome + "\" foi recusado e voltou para ajuste." + porque,
                        LINK + id);
            }
        } catch (Exception e) {
            log.warn("[notif-processo] recusar: {}", e.getMessage());
        }
    }

    /** Edição concluída pelo Editor → avisa os Responsáveis que podem enviar à validação. */
    public void aoConcluirEdicao(Map<String, Object> proc) {
        try {
            long id = idDe(proc);
            String nome = str(proc.get("nome_processo"));
            for (Long uid : responsaveis(id)) {
                notificador.notificar(uid, "processo_responsavel_apos_edicao", id,
                        proc.get("edicao_concluida_em"),
                        "Edição concluída — envie o processo à validação",
                        "A edição do processo \"" + nome + "\" foi concluída e ele está pronto para você enviar à validação.",
                        LINK + id);
            }
        } catch (Exception e) {
            log.warn("[notif-processo] concluir-edicao: {}", e.getMessage());
        }
    }

    /** Editor atribuído → avisa o próprio editor. */
    public void aoAtribuirEditor(Map<String, Object> proc, long editorUserId) {
        try {
            long id = idDe(proc);
            String nome = str(proc.get("nome_processo"));
            notificador.notificar(editorUserId, "processo_editor_edicao", id, proc.get("updated_at"),
                    "Você foi designado editor de um processo de negócio",
                    "Você foi designado como editor do processo \"" + nome + "\". Conclua a edição para liberar a validação.",
                    LINK + id);
        } catch (Exception e) {
            log.warn("[notif-processo] atribuir-editor: {}", e.getMessage());
        }
    }

    // ── resolução de destinatários ──

    private List<Long> responsaveis(long processoId) {
        return jdbc.queryForList(
                "SELECT DISTINCT uid FROM (" +
                        "  SELECT (CASE WHEN (e->>'responsavel_user_id') ~ '^[0-9]+$' " +
                        "               THEN (e->>'responsavel_user_id')::bigint ELSE u.responsavel_user_id END) AS uid " +
                        "  FROM processos_negocio pn " +
                        "  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(pn.proprietarios,'[]'::jsonb)) e " +
                        "  LEFT JOIN cadastros_unidades u ON (" +
                        "    ((e->>'unidade_id') ~ '^[0-9]+$' AND u.id = (e->>'unidade_id')::int) " +
                        "    OR LOWER(TRIM(u.nome)) = LOWER(TRIM(e->>'area'))) " +
                        "  WHERE pn.id = ?" +
                        ") s WHERE uid IS NOT NULL",
                Long.class, processoId);
    }

    private Long gestorDaDiretoria(String diretoria) {
        if (diretoria == null || diretoria.isBlank()) {
            return null;
        }
        List<Long> rows = jdbc.queryForList(
                "SELECT gestor_user_id FROM cadastros_areas " +
                        "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo,TRUE) = TRUE " +
                        "  AND gestor_user_id IS NOT NULL LIMIT 1",
                Long.class, diretoria);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private List<Long> validadoresFinais() {
        List<String> finais = Validadores.FINAIS;
        if (finais.isEmpty()) {
            return List.of();
        }
        String in = String.join(",", finais.stream().map(x -> "?").toList());
        Object[] params = finais.stream().map(e -> e.toLowerCase().trim()).toArray();
        return jdbc.queryForList(
                "SELECT id FROM users WHERE is_deleted = FALSE AND LOWER(TRIM(email)) IN (" + in + ")",
                Long.class, params);
    }

    private static long idDe(Map<String, Object> proc) {
        return ((Number) proc.get("id")).longValue();
    }

    private static String str(Object o) {
        return o == null ? "" : String.valueOf(o);
    }
}
