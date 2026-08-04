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
 * Notificações do TAP e TEP (validação em 3 camadas: Gestor → Diretor → Patrocinador). Os métodos
 * de validação/recusa dos serviços retornam só {success, projetoId}, então aqui re-buscamos o
 * projeto. Destinatários e joins espelham os providers de pendência (gestor/patrocinador via
 * users.id; diretor via cadastros_areas.gestor_user_id da diretoria).
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class ProjetosTapTepNotificacoes {

    private static final String LINK = "/gestao-estrategica/execucao";
    private final JdbcTemplate jdbc;
    private final Notificador notificador;

    // ══════════════ TAP ══════════════

    /** TAP gerado → aguarda o Gestor (camada 1). */
    public void aoGerarTap(long projetoId) {
        try {
            Map<String, Object> p = projeto(projetoId);
            if (p == null) return;
            Long gestor = asLong(p.get("gestor_id"));
            if (gestor != null) {
                notificar(gestor, "tap_gestor", projetoId, p.get("tap_gerado_em"),
                        "TAP aguardando sua validação (gestor)",
                        "O TAP do projeto \"" + nome(p) + "\" foi gerado e aguarda sua validação como gestor.",
                        linkTap(projetoId));
            }
        } catch (Exception e) {
            log.warn("[notif-tap] gerar: {}", e.getMessage());
        }
    }

    /** TAP validado numa camada → avisa a próxima (1→diretor, 2→patrocinador; 3 é terminal). */
    public void aoValidarTap(long projetoId, int camada) {
        try {
            Map<String, Object> p = projeto(projetoId);
            if (p == null) return;
            if (camada == 1) {
                Long diretor = diretorDaDiretoria(str(p.get("diretoria")));
                if (diretor != null) {
                    notificar(diretor, "tap_diretor", projetoId, p.get("tap_validado_gestor_em"),
                            "TAP aguardando sua validação (diretor)",
                            "O TAP do projeto \"" + nome(p) + "\" foi validado pelo gestor e aguarda sua validação como diretor.",
                            linkTap(projetoId));
                }
            } else if (camada == 2) {
                Long patro = asLong(p.get("patrocinador_id"));
                if (patro != null) {
                    notificar(patro, "tap_patrocinador", projetoId, p.get("tap_validado_diretor_em"),
                            "TAP aguardando sua validação (patrocinador)",
                            "O TAP do projeto \"" + nome(p) + "\" foi validado pelo diretor e aguarda sua validação como patrocinador.",
                            linkTap(projetoId));
                }
            }
        } catch (Exception e) {
            log.warn("[notif-tap] validar camada {}: {}", camada, e.getMessage());
        }
    }

    /** TAP recusado → devolve ao Gestor. */
    public void aoRecusarTap(long projetoId) {
        try {
            Map<String, Object> p = projeto(projetoId);
            if (p == null) return;
            Long gestor = asLong(p.get("gestor_id"));
            if (gestor != null) {
                notificar(gestor, "tap_recusado", projetoId, p.get("tap_recusado_em"),
                        "TAP recusado — ajuste e valide novamente",
                        "O TAP do projeto \"" + nome(p) + "\" foi recusado e voltou para você." + motivo(p, "tap"),
                        linkTap(projetoId));
            }
        } catch (Exception e) {
            log.warn("[notif-tap] recusar: {}", e.getMessage());
        }
    }

    // ══════════════ TEP ══════════════

    /** TEP criado → aguarda o Gestor (camada 1). */
    public void aoCriarTep(long projetoId) {
        try {
            Map<String, Object> t = projetoTep(projetoId);
            if (t == null) return;
            Long gestor = asLong(t.get("gestor_id"));
            if (gestor != null) {
                notificar(gestor, "tep_gestor", projetoId, t.get("finalizado_em"),
                        "TEP aguardando sua validação (gestor)",
                        "O TEP do projeto \"" + nome(t) + "\" foi gerado e aguarda sua validação como gestor.",
                        linkTep(projetoId));
            }
        } catch (Exception e) {
            log.warn("[notif-tep] criar: {}", e.getMessage());
        }
    }

    /** TEP validado numa camada → avisa a próxima (1→diretor, 2→patrocinador; 3 é terminal). */
    public void aoValidarTep(long projetoId, int camada) {
        try {
            Map<String, Object> t = projetoTep(projetoId);
            if (t == null) return;
            if (camada == 1) {
                Long diretor = diretorDaDiretoria(str(t.get("diretoria")));
                if (diretor != null) {
                    notificar(diretor, "tep_diretor", projetoId, t.get("tep_validado_gestor_em"),
                            "TEP aguardando sua validação (diretor)",
                            "O TEP do projeto \"" + nome(t) + "\" foi validado pelo gestor e aguarda sua validação como diretor.",
                            linkTep(projetoId));
                }
            } else if (camada == 2) {
                Long patro = asLong(t.get("patrocinador_id"));
                if (patro != null) {
                    notificar(patro, "tep_patrocinador", projetoId, t.get("tep_validado_diretor_em"),
                            "TEP aguardando sua validação (patrocinador)",
                            "O TEP do projeto \"" + nome(t) + "\" foi validado pelo diretor e aguarda sua validação como patrocinador.",
                            linkTep(projetoId));
                }
            }
        } catch (Exception e) {
            log.warn("[notif-tep] validar camada {}: {}", camada, e.getMessage());
        }
    }

    /** TEP recusado → devolve ao Gestor. */
    public void aoRecusarTep(long projetoId) {
        try {
            Map<String, Object> t = projetoTep(projetoId);
            if (t == null) return;
            Long gestor = asLong(t.get("gestor_id"));
            if (gestor != null) {
                notificar(gestor, "tep_recusado", projetoId, t.get("tep_recusado_em"),
                        "TEP recusado — ajuste e valide novamente",
                        "O TEP do projeto \"" + nome(t) + "\" foi recusado e voltou para você." + motivo(t, "tep"),
                        linkTep(projetoId));
            }
        } catch (Exception e) {
            log.warn("[notif-tep] recusar: {}", e.getMessage());
        }
    }

    // ── helpers ──

    private void notificar(long uid, String tipo, long projetoId, Object versao,
                           String assunto, String linha, String link) {
        notificador.notificar(uid, tipo, projetoId, versao, assunto, linha, link);
    }

    private Map<String, Object> projeto(long projetoId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT id, nome, diretoria, gestor_id, patrocinador_id, tap_gerado_em, " +
                        "tap_validado_gestor_em, tap_validado_diretor_em, tap_recusado_em, " +
                        "tap_recusado_comentario, tap_recusado_camada " +
                        "FROM cadastros_projetos WHERE id = ?", projetoId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Map<String, Object> projetoTep(long projetoId) {
        List<Map<String, Object>> rows = jdbc.queryForList(
                "SELECT p.id, p.nome, p.diretoria, p.gestor_id, p.patrocinador_id, " +
                        "t.finalizado_em, t.tep_validado_gestor_em, t.tep_validado_diretor_em, " +
                        "t.tep_recusado_em, t.tep_recusado_comentario, t.tep_recusado_camada " +
                        "FROM cadastros_projetos p JOIN tep_termos_encerramento t ON t.projeto_id = p.id " +
                        "WHERE p.id = ?", projetoId);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private Long diretorDaDiretoria(String diretoria) {
        if (diretoria == null || diretoria.isBlank()) return null;
        List<Long> rows = jdbc.queryForList(
                "SELECT gestor_user_id FROM cadastros_areas " +
                        "WHERE LOWER(TRIM(sigla)) = LOWER(TRIM(?)) AND COALESCE(ativo, TRUE) = TRUE " +
                        "  AND gestor_user_id IS NOT NULL LIMIT 1",
                Long.class, diretoria);
        return rows.isEmpty() ? null : rows.get(0);
    }

    private String linkTap(long projetoId) {
        return build(LINK, params("projetoId", projetoId, "openTap", "true"));
    }

    private String linkTep(long projetoId) {
        return build(LINK, params("projetoId", projetoId, "openTep", "true"));
    }

    private static String motivo(Map<String, Object> p, String prefixo) {
        Object c = p.get(prefixo + "_recusado_comentario");
        return (c != null && !String.valueOf(c).isBlank()) ? " Motivo: " + c : "";
    }

    private static String nome(Map<String, Object> p) {
        Object n = p.get("nome");
        return n == null ? "" : String.valueOf(n);
    }

    private static Long asLong(Object o) {
        return o == null ? null : ((Number) o).longValue();
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }
}
