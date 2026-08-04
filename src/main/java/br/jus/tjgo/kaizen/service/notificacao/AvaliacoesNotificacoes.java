package br.jus.tjgo.kaizen.service.notificacao;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

import static br.jus.tjgo.kaizen.service.home.PendenciaLinks.build;
import static br.jus.tjgo.kaizen.service.home.PendenciaLinks.params;

/**
 * Notificações das avaliações de Pessoas (autoavaliação, avaliação do gestor, avaliação integrada).
 * Avisa quem recebe a bola: a integrada validada pelo gestor vai para o colaborador validar; a
 * integrada enviada vai para o gestor; e as cascatas de "atualização requisitada" (quando validar
 * uma camada anterior invalida uma posterior vinculada) avisam o dono do formulário devolvido.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class AvaliacoesNotificacoes {

    private static final String LINK = "/pessoas/competencias";
    private final JdbcTemplate jdbc;
    private final Notificador notificador;

    /** Autoavaliação validada → avaliações do gestor vinculadas foram devolvidas p/ atualização. */
    public void aoAutoavaliacaoValidada(long autoavaliacaoId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, avaliador_user_id, updated_at FROM avaliacao_gestor_formularios " +
                            "WHERE is_deleted = FALSE AND pessoa_id = ? AND status = 'atualizacao_requisitada'",
                    autoavaliacaoId);
            for (Map<String, Object> r : rows) {
                Long uid = asLong(r.get("avaliador_user_id"));
                if (uid != null) {
                    notificador.notificar(uid, "avaliacao_gestor_atualizacao", asLong(r.get("id")),
                            r.get("updated_at"),
                            "Avaliação do gestor precisa ser atualizada",
                            "A autoavaliação vinculada foi validada — sua avaliação do gestor precisa ser atualizada e reenviada.",
                            build(LINK, params("avgestorId", r.get("id"))));
                }
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] autoavaliacao validada: {}", e.getMessage());
        }
    }

    /** Avaliação do gestor validada → avaliações integradas vinculadas devolvidas p/ atualização. */
    public void aoAvaliacaoGestorValidada(long avaliacaoGestorId) {
        try {
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT id, avaliador_user_id, COALESCE(tipo_inventario, 'equipe') AS tipo, updated_at " +
                            "FROM avaliacao_integrada_formularios " +
                            "WHERE is_deleted = FALSE AND avaliacao_gestor_id = ? AND status = 'atualizacao_requisitada'",
                    avaliacaoGestorId);
            for (Map<String, Object> r : rows) {
                Long uid = asLong(r.get("avaliador_user_id"));
                if (uid != null) {
                    notificador.notificar(uid, "integrada_atualizacao", asLong(r.get("id")), r.get("updated_at"),
                            "Avaliação integrada precisa ser atualizada",
                            "A avaliação do gestor vinculada foi validada — a avaliação integrada precisa ser atualizada e reenviada.",
                            build(LINK, params("integradaId", r.get("id"), "tipo", r.get("tipo"))));
                }
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] avaliacao gestor validada: {}", e.getMessage());
        }
    }

    /** Integrada enviada (camada 1) → avisa o gestor vinculado (quando difere de quem criou). */
    public void aoIntegradaEnviada(Map<String, Object> integrada) {
        try {
            long id = idDe(integrada);
            Long avaliadorIntegrada = asLong(integrada.get("avaliador_user_id"));
            Long agId = asLong(integrada.get("avaliacao_gestor_id"));
            if (agId == null) {
                return;
            }
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT avaliador_user_id FROM avaliacao_gestor_formularios WHERE id = ?", agId);
            if (rows.isEmpty()) {
                return;
            }
            Long gestor = asLong(rows.get(0).get("avaliador_user_id"));
            if (gestor != null && !gestor.equals(avaliadorIntegrada)) {
                notificador.notificar(gestor, "integrada_gestor", id, integrada.get("updated_at"),
                        "Avaliação integrada aguardando sua validação",
                        "Uma avaliação integrada foi enviada e aguarda sua validação como gestor.",
                        build(LINK, params("integradaId", id, "tipo", tipo(integrada))));
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] integrada enviada: {}", e.getMessage());
        }
    }

    /** Integrada validada pelo gestor (camada 1) → o colaborador valida (camada 2). */
    public void aoIntegradaValidadaGestor(Map<String, Object> integrada) {
        try {
            long id = idDe(integrada);
            Long autoId = asLong(integrada.get("autoavaliacao_id"));
            if (autoId == null) {
                return;
            }
            List<Map<String, Object>> rows = jdbc.queryForList(
                    "SELECT user_id FROM autoavaliacao_formularios WHERE id = ?", autoId);
            if (rows.isEmpty()) {
                return;
            }
            Long colaborador = asLong(rows.get(0).get("user_id"));
            if (colaborador != null) {
                notificador.notificar(colaborador, "integrada_colaborador", id,
                        integrada.get("validado_gestor_em"),
                        "Avaliação integrada aguardando sua validação",
                        "A avaliação integrada foi validada pelo gestor e aguarda a sua validação.",
                        build(LINK, params("integradaId", id, "tipo", tipo(integrada))));
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] integrada validada gestor: {}", e.getMessage());
        }
    }

    /** Integrada validada pelo colaborador (camada 2, final) → avisa o avaliador que foi concluída. */
    public void aoIntegradaConcluida(Map<String, Object> integrada) {
        try {
            long id = idDe(integrada);
            Long avaliador = asLong(integrada.get("avaliador_user_id"));
            if (avaliador != null) {
                notificador.notificar(avaliador, "integrada_concluida", id,
                        integrada.get("validado_colaborador_em"),
                        "Avaliação integrada concluída",
                        "A avaliação integrada foi validada pelo colaborador e está concluída.",
                        build(LINK, params("integradaId", id, "tipo", tipo(integrada))));
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] integrada concluida: {}", e.getMessage());
        }
    }

    // ── Cascatas de catálogo (propagação técnica / publicação do padrão): cada form devolvido
    //    para "atualização requisitada" avisa o seu dono. Recebem a linha do próprio form afetado
    //    (id + coluna do dono + updated_at), obtida via RETURNING no UPDATE da cascata. ──

    public void atualizacaoAutoavaliacao(Map<String, Object> r) {
        try {
            Long uid = asLong(r.get("user_id"));
            if (uid != null) {
                notificador.notificar(uid, "autoavaliacao_atualizacao", asLong(r.get("id")), r.get("updated_at"),
                        "Autoavaliação precisa ser atualizada",
                        "Sua autoavaliação precisa ser atualizada e reenviada — o catálogo de competências foi atualizado.",
                        build(LINK, params("autoavaliacaoId", r.get("id"))));
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] atualizacao autoavaliacao: {}", e.getMessage());
        }
    }

    public void atualizacaoAvaliacaoGestor(Map<String, Object> r) {
        try {
            Long uid = asLong(r.get("avaliador_user_id"));
            if (uid != null) {
                notificador.notificar(uid, "avaliacao_gestor_atualizacao", asLong(r.get("id")), r.get("updated_at"),
                        "Avaliação do gestor precisa ser atualizada",
                        "Sua avaliação do gestor precisa ser atualizada e reenviada — o catálogo de competências foi atualizado.",
                        build(LINK, params("avgestorId", r.get("id"))));
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] atualizacao avaliacao gestor: {}", e.getMessage());
        }
    }

    public void atualizacaoIntegrada(Map<String, Object> r) {
        try {
            Long uid = asLong(r.get("avaliador_user_id"));
            if (uid != null) {
                notificador.notificar(uid, "integrada_atualizacao", asLong(r.get("id")), r.get("updated_at"),
                        "Avaliação integrada precisa ser atualizada",
                        "A avaliação integrada precisa ser atualizada e reenviada — o catálogo de competências foi atualizado.",
                        build(LINK, params("integradaId", r.get("id"), "tipo", tipo(r))));
            }
        } catch (Exception e) {
            log.warn("[notif-avaliacao] atualizacao integrada: {}", e.getMessage());
        }
    }

    // ── helpers ──

    private static String tipo(Map<String, Object> integrada) {
        Object t = integrada.get("tipo_inventario");
        return t == null ? "equipe" : String.valueOf(t);
    }

    private static long idDe(Map<String, Object> m) {
        return ((Number) m.get("id")).longValue();
    }

    private static Long asLong(Object o) {
        return o == null ? null : ((Number) o).longValue();
    }
}
