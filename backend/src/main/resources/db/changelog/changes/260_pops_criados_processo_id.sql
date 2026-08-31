-- liquibase formatted sql

-- changeset kaizen:260_pops_criados_processo_id
-- O POP so guardava `nome_processo` (texto). Isso impede validar no servidor de que processo o POP
-- e: ha processos com NOMES REPETIDOS no cadastro ("processo teste" e "processo x" aparecem em
-- duplicidade), entao casar por nome escolheria o processo errado.
--
-- Com o vinculo por id, o backend passa a recusar (403) POP de processo fora do alcance de quem
-- esta preenchendo -- editor atribuido, Responsavel, Revisor da diretoria, Gestor do Escritorio ou
-- Compliance Officer. `nome_processo` continua gravado: e ele que sai no PDF, e o POP e um
-- documento datado, que nao deve mudar de texto se o processo for renomeado depois.
ALTER TABLE pops_criados
    ADD COLUMN IF NOT EXISTS processo_id INTEGER;
-- rollback ALTER TABLE pops_criados DROP COLUMN IF EXISTS processo_id;

-- changeset kaizen:260_pops_criados_processo_id_backfill
-- Backfill conservador: so preenche quando o nome casa com EXATAMENTE UM processo. POP cujo nome
-- e ambiguo (ou nao existe mais) fica com processo_id nulo -- e tratado como legado pelo backend,
-- que nao bloqueia por falta de vinculo.
UPDATE pops_criados p
   SET processo_id = m.id
  FROM (
        SELECT LOWER(TRIM(nome_processo)) AS chave, MIN(id) AS id
          FROM processos_negocio
         WHERE COALESCE(is_deleted, FALSE) = FALSE
         GROUP BY LOWER(TRIM(nome_processo))
        HAVING COUNT(*) = 1
       ) m
 WHERE p.processo_id IS NULL
   AND LOWER(TRIM(p.nome_processo)) = m.chave;
-- rollback UPDATE pops_criados SET processo_id = NULL;

-- changeset kaizen:260_pops_criados_processo_id_index
CREATE INDEX IF NOT EXISTS idx_pops_criados_processo_id
    ON pops_criados (processo_id) WHERE is_deleted = FALSE;
-- rollback DROP INDEX IF EXISTS idx_pops_criados_processo_id;
