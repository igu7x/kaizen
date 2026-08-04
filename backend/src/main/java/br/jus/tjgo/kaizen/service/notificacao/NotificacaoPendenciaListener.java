package br.jus.tjgo.kaizen.service.notificacao;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Component;
import org.springframework.transaction.event.TransactionPhase;
import org.springframework.transaction.event.TransactionalEventListener;

import java.util.List;
import java.util.Map;

/**
 * Trata o {@link PendenciaNotificacaoEvent} APÓS o commit da transação (garante que só notifica
 * pendências que realmente persistiram) e de forma ASSÍNCRONA (não soma a latência do SMTP à
 * resposta da ação). Deduplica por {@code (user_id, assinatura)} para nunca enviar o mesmo evento
 * duas vezes — protege contra retries e múltiplos pods.
 *
 * <p>{@code fallbackExecution = true}: se a ação não estiver numa transação, o listener roda assim
 * mesmo (o dado já foi gravado em autocommit).</p>
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class NotificacaoPendenciaListener {

    private final JdbcTemplate jdbc;
    private final EmailService emailService;

    @Value("${kaizen.frontend.url:}")
    private String frontendUrl;

    @Async("notificacaoExecutor")
    @TransactionalEventListener(phase = TransactionPhase.AFTER_COMMIT, fallbackExecution = true)
    public void aoOcorrer(PendenciaNotificacaoEvent ev) {
        try {
            // Desabilitado: não envia nem registra (assim, ao ligar, o histórico não é "reenviado").
            if (!emailService.isEnabled()) {
                return;
            }

            List<Map<String, Object>> users = jdbc.queryForList(
                    "SELECT name, email FROM users WHERE id = ? AND is_deleted = FALSE", ev.userId());
            if (users.isEmpty()) {
                return;
            }
            String email = str(users.get(0).get("email"));
            if (email == null || email.isBlank()) {
                return;
            }
            String nome = str(users.get(0).get("name"));

            String assinatura = ev.tipo() + ":" + ev.entidadeId() + ":" + ev.versao();

            // Idempotência: insere primeiro; se já existia (0 linhas), o e-mail já foi enviado.
            int inserted = jdbc.update(
                    "INSERT INTO notificacoes_pendencia (user_id, tipo, entidade_id, assinatura, assunto, destinatario_email) " +
                            "VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT (user_id, assinatura) DO NOTHING",
                    ev.userId(), ev.tipo(), ev.entidadeId(), assinatura, ev.assunto(), email);
            if (inserted == 0) {
                return;
            }

            String link = montarLink(ev.linkRelativo());
            String html = montarHtml(nome, ev.assunto(), ev.linhaPrincipal(), link);
            boolean ok = emailService.enviarHtml(email, ev.assunto(), html);
            if (!ok) {
                // Falhou o envio: libera a assinatura para um retry futuro.
                jdbc.update("DELETE FROM notificacoes_pendencia WHERE user_id = ? AND assinatura = ?",
                        ev.userId(), assinatura);
            }
        } catch (Exception e) {
            log.warn("[notificacao] falha ao processar evento {}: {}", ev.tipo(), e.getMessage());
        }
    }

    private String montarLink(String relativo) {
        String base = frontendUrl == null ? "" : frontendUrl.replaceAll("/+$", "");
        String path = relativo == null ? "" : relativo;
        if (!path.isEmpty() && !path.startsWith("/")) {
            path = "/" + path;
        }
        return base + path;
    }

    private static String str(Object o) {
        return o == null ? null : String.valueOf(o);
    }

    /** Template HTML simples e institucional (inline styles p/ compatibilidade com clientes de e-mail). */
    private String montarHtml(String nome, String assunto, String linha, String link) {
        String saudacao = (nome != null && !nome.isBlank()) ? "Olá, " + esc(nome.split(" ")[0]) + "!" : "Olá!";
        return "<!DOCTYPE html><html lang=\"pt-BR\"><body style=\"margin:0;background:#f3f6fa;"
                + "font-family:Arial,Helvetica,sans-serif;color:#1f2933;\">"
                + "<div style=\"max-width:560px;margin:0 auto;padding:24px;\">"
                + "<div style=\"background:#0E3D73;color:#fff;padding:18px 24px;border-radius:10px 10px 0 0;\">"
                + "<span style=\"font-size:20px;font-weight:bold;letter-spacing:0.5px;\">KAIZEN</span>"
                + "<div style=\"font-size:12px;opacity:0.85;\">Governança Judiciária e Tecnológica — TJGO</div>"
                + "</div>"
                + "<div style=\"background:#fff;padding:24px;border:1px solid #e7ecf4;border-top:none;border-radius:0 0 10px 10px;\">"
                + "<p style=\"margin:0 0 12px;font-size:15px;\">" + saudacao + "</p>"
                + "<p style=\"margin:0 0 8px;font-size:16px;font-weight:bold;color:#0E2440;\">" + esc(assunto) + "</p>"
                + "<p style=\"margin:0 0 20px;font-size:15px;line-height:1.5;color:#3b4657;\">" + esc(linha) + "</p>"
                + "<a href=\"" + esc(link) + "\" style=\"display:inline-block;background:#1478B4;color:#fff;"
                + "text-decoration:none;padding:11px 22px;border-radius:8px;font-size:14px;font-weight:bold;\">"
                + "Abrir no Kaizen</a>"
                + "<p style=\"margin:22px 0 0;font-size:12px;color:#8a98ae;\">"
                + "Você recebeu este e-mail porque há uma pendência sob sua responsabilidade no Kaizen. "
                + "Não responda a esta mensagem.</p>"
                + "</div></div></body></html>";
    }

    private static String esc(String s) {
        if (s == null) {
            return "";
        }
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }
}
