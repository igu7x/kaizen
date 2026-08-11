-- liquibase formatted sql

-- changeset kaizen:215_add_grupo_processos_negocio
-- Migration 215: desdobra o Escritório de Processos em 2 grupos independentes.
--
-- CONTEXTO:
-- O Escritório de Processos passa a ter 2 páginas: "Tecnologia da Informação" (ti) e
-- "Apoio Judiciário" (apoio_judiciario). Cada uma tem seus PRÓPRIOS registros — excluir um
-- processo em um grupo NÃO afeta o outro. Para começarem idênticas, DUPLICAMOS os processos
-- atuais para o grupo "apoio_judiciario" (os existentes ficam em "ti").
--
-- SEGURANÇA (Zero Downtime): coluna aditiva com DEFAULT; a duplicação é INSERT (não destrutivo)
-- e roda uma única vez (changeset do Liquibase). Tabela do próprio app (não compartilhada).
ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS grupo TEXT DEFAULT 'ti';
UPDATE processos_negocio SET grupo = 'ti' WHERE grupo IS NULL;
-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS grupo;

-- changeset kaizen:215b_duplicar_processos_apoio splitStatements:false
-- Duplica os processos de 'ti' para 'apoio_judiciario', copiando TODAS as colunas (menos o id
-- serial) via information_schema — sem depender de listar os campos aqui. O histórico
-- (processos_negocio_historico) NÃO é duplicado: a cópia começa com o estado atual (linha vigente).
DO $$
DECLARE
    cols text;
BEGIN
    SELECT string_agg(quote_ident(column_name), ', ')
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'processos_negocio'
       AND column_name NOT IN ('id', 'grupo');

    EXECUTE format(
        'INSERT INTO processos_negocio (%1$s, grupo) '
        || 'SELECT %1$s, ''apoio_judiciario'' FROM processos_negocio '
        || 'WHERE COALESCE(grupo, ''ti'') = ''ti'' AND is_deleted = FALSE',
        cols);
END $$;
-- rollback DELETE FROM processos_negocio WHERE grupo = 'apoio_judiciario';
