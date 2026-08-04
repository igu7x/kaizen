package br.jus.tjgo.kaizen.service.notificacao;

import lombok.RequiredArgsConstructor;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Component;

/**
 * Fachada única para os serviços de domínio dispararem notificações de pendência sem conhecer o
 * mecanismo de e-mail. Apenas publica um {@link PendenciaNotificacaoEvent}; o envio real acontece
 * após o commit e de forma assíncrona (ver {@link NotificacaoPendenciaListener}).
 *
 * <p>Barato e seguro de chamar em qualquer ponto: nunca lança para o chamador nem bloqueia a ação.</p>
 */
@Component
@RequiredArgsConstructor
public class Notificador {

    private final ApplicationEventPublisher publisher;

    public void notificar(long userId, String tipo, Long entidadeId, Object versao,
                          String assunto, String linhaPrincipal, String linkRelativo) {
        if (userId <= 0) {
            return;
        }
        publisher.publishEvent(new PendenciaNotificacaoEvent(
                userId, tipo, entidadeId,
                versao == null ? "" : String.valueOf(versao),
                assunto, linhaPrincipal, linkRelativo));
    }
}
