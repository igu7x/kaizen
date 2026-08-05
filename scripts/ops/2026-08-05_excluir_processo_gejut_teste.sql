-- ============================================================================
-- OPS / PROD — Exclusão FÍSICA (definitiva) de processo de negócio de teste
-- ----------------------------------------------------------------------------
-- Processo : "GEJUT TESTE"  (ID: PN_1_2_001, diretoria GEJUT)
-- Motivo   : processo de teste que ficou no ambiente de produção; deve ser removido
--            por completo, como se nunca tivesse existido.
--
-- ESCOPO: remoção física (DELETE), irreversível. A única tabela filha
-- (processos_negocio_historico, coluna processo_id) tem FK ON DELETE CASCADE, então
-- o histórico de versões é apagado AUTOMATICAMENTE junto — não deixa órfãos.
--
-- COMO RODAR (psql, PROD): rode o bloco inteiro. Roda em UMA transação e imprime o
-- ANTES e o DEPOIS. Confira que o SELECT (1) retornou UMA linha só e é o processo
-- certo. Se estiver ok, deixe o COMMIT no fim; se não, troque por ROLLBACK.
-- ============================================================================

BEGIN;

-- (1) ANTES — confirme: 1 linha, codigo=PN_1_2_001, nome=GEJUT TESTE, diretoria=GEJUT.
SELECT id, codigo, nome_processo, diretoria, status, is_deleted
FROM   processos_negocio
WHERE  codigo = 'PN_1_2_001'
  AND  nome_processo = 'GEJUT TESTE'
  AND  diretoria = 'GEJUT';

-- (1b) Quantas versões históricas serão removidas em cascata (informativo).
SELECT count(*) AS versoes_historico_a_remover
FROM   processos_negocio_historico
WHERE  processo_id = (SELECT id FROM processos_negocio
                      WHERE codigo = 'PN_1_2_001' AND nome_processo = 'GEJUT TESTE' AND diretoria = 'GEJUT');

-- (2) Exclusão física. O histórico vinculado sai junto (ON DELETE CASCADE).
DELETE FROM processos_negocio
WHERE  codigo = 'PN_1_2_001'
  AND  nome_processo = 'GEJUT TESTE'
  AND  diretoria = 'GEJUT';

-- (3) DEPOIS — deve retornar 0 linhas nas duas consultas (nada restou).
SELECT count(*) AS processo_restante
FROM   processos_negocio
WHERE  codigo = 'PN_1_2_001' AND nome_processo = 'GEJUT TESTE' AND diretoria = 'GEJUT';

SELECT count(*) AS historico_restante
FROM   processos_negocio_historico h
WHERE  NOT EXISTS (SELECT 1 FROM processos_negocio p WHERE p.id = h.processo_id);

-- Se ANTES/DEPOIS estiverem corretos (DEPOIS = 0/0), confirme:
COMMIT;
-- Se algo estiver errado, use no lugar do COMMIT:
-- ROLLBACK;
