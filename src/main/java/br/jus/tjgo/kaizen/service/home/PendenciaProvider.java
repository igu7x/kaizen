package br.jus.tjgo.kaizen.service.home;

import java.util.List;

/**
 * Contrato de uma fonte de pendências da Home. Cada domínio (Competências, Projetos/TAP/TEP,
 * Processos de Negócio, Renovações…) implementa o seu próprio provedor como um {@code @Component}.
 *
 * <p><b>Extensibilidade:</b> a {@code HomeService} injeta {@code List<PendenciaProvider>} e o Spring
 * coleta automaticamente TODOS os beans que implementam esta interface. Portanto, para que uma nova
 * funcionalidade apareça na Home basta criar um novo provedor anotado com {@code @Component} — nada
 * mais precisa ser tocado (nem a HomeService, nem o controller, nem o frontend, que renderiza as
 * pendências genericamente por {@code categoria}). A Home acompanha as próximas implementações
 * "de graça".</p>
 *
 * <p><b>Resiliência:</b> a HomeService envolve cada provedor em try/catch — uma exceção em um
 * provedor não derruba os demais (uma pendência a menos, nunca a Home inteira). Ainda assim,
 * prefira tratar erros internamente e retornar lista vazia.</p>
 */
public interface PendenciaProvider {

    /**
     * Coleta as pendências deste domínio para o usuário do contexto. Deve retornar apenas itens com
     * {@code count > 0}; ordem interna livre (a HomeService reordena por prioridade).
     */
    List<Pendencia> coletar(PendenciaContext ctx);

    /** Nome curto do provedor, usado só em log de erro. */
    default String nome() {
        return getClass().getSimpleName();
    }
}
