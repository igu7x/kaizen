package br.jus.tjgo.kaizen.auth;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Anotação para proteger endpoints específicos ou controllers inteiros, bloqueando ações 
 * com base na existência de uma regra na tabela permissoes_acoes.
 */
@Target({ElementType.TYPE, ElementType.METHOD})
@Retention(RetentionPolicy.RUNTIME)
public @interface TagAcao {
    
    /**
     * Define as TAGs que serão buscadas na validação (e.g., {"CONSOLIDACAO_DFD", "OUTRA_TAG"}).
     */
    String[] value();
    
    /**
     * Define se o usuário precisa ter acesso a QUALQUER UMA (ANY) ou a TODAS (ALL) as tags informadas.
     */
    Logical logical() default Logical.ANY;
    
    enum Logical {
        ANY,
        ALL
    }
}
