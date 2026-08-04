package br.jus.tjgo.kaizen.service.notificacao;

/**
 * Evento "uma pendência acaba de recair sobre um usuário". Publicado pelos serviços de domínio no
 * momento da ação (recusa, passagem de camada, edição concluída…) e tratado após o COMMIT por
 * {@link NotificacaoPendenciaListener}, que faz a deduplicação e dispara o e-mail de forma assíncrona.
 *
 * @param userId        destinatário (quem precisa agir agora)
 * @param tipo          slug da pendência (ex.: {@code processo_validar_diretoria})
 * @param entidadeId    id da entidade relacionada (processo/projeto/matriz…); pode ser null
 * @param versao        token que torna o evento único por ocorrência — normalmente o timestamp da
 *                      transição (recusado_em, validado_diretoria_em…). Reenvios do mesmo evento
 *                      compartilham a versão e são deduplicados; um evento novo tem versão nova.
 * @param assunto       assunto do e-mail
 * @param linhaPrincipal frase principal do corpo (o que aconteceu / o que fazer)
 * @param linkRelativo  caminho no frontend (ex.: {@code /gestao-estrategica/processos/8})
 */
public record PendenciaNotificacaoEvent(
        long userId,
        String tipo,
        Long entidadeId,
        String versao,
        String assunto,
        String linhaPrincipal,
        String linkRelativo
) {
}
