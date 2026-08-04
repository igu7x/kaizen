package br.jus.tjgo.kaizen.service.notificacao;

import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Service;

/**
 * Envio de e-mail (HTML) via SMTP. No-op seguro quando {@code kaizen.notificacoes.enabled=false} ou
 * quando não há JavaMailSender configurado — assim o sistema nunca quebra por falta de SMTP.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    /** Opcional: só existe se o starter-mail auto-configurar (host presente, que é o default). */
    private final ObjectProvider<JavaMailSender> mailSenderProvider;

    @Value("${kaizen.notificacoes.enabled:false}")
    private boolean enabled;

    @Value("${kaizen.notificacoes.remetente:}")
    private String remetente;

    @Value("${spring.mail.username:}")
    private String smtpUser;

    public boolean isEnabled() {
        return enabled;
    }

    /** Envia um e-mail HTML. Retorna true se realmente enviado. */
    public boolean enviarHtml(String para, String assunto, String html) {
        if (!enabled) {
            return false;
        }
        if (para == null || para.isBlank()) {
            return false;
        }
        JavaMailSender sender = mailSenderProvider.getIfAvailable();
        if (sender == null) {
            log.warn("[email] JavaMailSender indisponível — verifique spring.mail.* ");
            return false;
        }
        String from = (remetente != null && !remetente.isBlank()) ? remetente : smtpUser;
        try {
            MimeMessage msg = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(msg, false, "UTF-8");
            if (from != null && !from.isBlank()) {
                helper.setFrom(from);
            }
            helper.setTo(para);
            helper.setSubject(assunto);
            helper.setText(html, true);
            sender.send(msg);
            return true;
        } catch (Exception e) {
            log.warn("[email] falha ao enviar para {}: {}", para, e.getMessage());
            return false;
        }
    }
}
