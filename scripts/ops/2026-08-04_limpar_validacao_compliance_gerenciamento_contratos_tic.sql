-- ============================================================================
-- OPS / PROD — Limpeza de validação de Compliance Officer indevida
-- ----------------------------------------------------------------------------
-- Processo : "Gerenciamento de Contratos de TIC" (GEJUT / Governança e Gestão)
-- Camada   : Compliance Officer (coluna validado_final_*)
-- Feita por: Danilo Cordeiro Amaral  -> validação indevida (não é o Compliance
--            Officer correto e o Comitê Gestor de TIC ainda está Pendente).
--
-- O QUE FAZ
--   Desfaz APENAS a camada de Compliance Officer (validado_final). O status volta
--   para 'validado_diretoria' — as camadas de Responsável (validado_autor) e de
--   Revisor (validado_diretoria) ficam INTACTAS, aguardando o Compliance Officer
--   correto. Como o processo deixa de ser 'validado_final':
--     - o rótulo "DATA DA VIGÊNCIA" volta a "DATA DA PROPOSTA" (= Pendente);
--     - o "MODELO" volta a "K1" (deixa de exibir "Doc. Primário");
--   sem tocar em versao/revisao/periodo (esta homologação não os alterou: foi a
--   1ª homologação no Kaizen, ciclos_homologados era 0, então a data da versão
--   informada — 15/07/2025 — permanece).
--
--   Também: remove o snapshot histórico congelado por essa homologação indevida e
--   decrementa ciclos_homologados (a homologação o havia incrementado em +1).
--
-- COMO RODAR (psql, PROD)
--   Rode o bloco inteiro. Ele roda em UMA transação e imprime o ANTES e o DEPOIS.
--   Confira os SELECTs (esp.: (1) retornou UMA linha só e validado_final_nome é o
--   Danilo). Se estiver tudo certo, deixe o COMMIT no fim. Se não, troque por
--   ROLLBACK.
-- ============================================================================

BEGIN;

-- (1) ANTES — confirme: 1 linha, status='validado_final', validado_final_nome=Danilo.
SELECT id, nome_processo, diretoria, status,
       validado_autor_nome,     validado_autor_em,
       validado_diretoria_nome, validado_diretoria_em,
       validado_final_user_id,  validado_final_nome, validado_final_em,
       versao, revisao, periodo, ciclos_homologados
FROM   processos_negocio
WHERE  nome_processo = 'Gerenciamento de Contratos de TIC'
  AND  is_deleted = FALSE;

-- (2) Remove o snapshot histórico gerado pela homologação indevida do Danilo.
DELETE FROM processos_negocio_historico h
USING  processos_negocio p
WHERE  h.processo_id = p.id
  AND  p.nome_processo = 'Gerenciamento de Contratos de TIC'
  AND  p.is_deleted = FALSE
  AND  h.validado_final_nome ILIKE '%Danilo%Amaral%';

-- (3) Limpa a camada de Compliance Officer e volta o status para 'validado_diretoria'.
UPDATE processos_negocio
SET    status                 = 'validado_diretoria',
       validado_final_user_id = NULL,
       validado_final_nome    = NULL,
       validado_final_em      = NULL,
       ciclos_homologados     = GREATEST(COALESCE(ciclos_homologados, 0) - 1, 0),
       updated_at             = CURRENT_TIMESTAMP
WHERE  nome_processo = 'Gerenciamento de Contratos de TIC'
  AND  is_deleted = FALSE
  AND  status = 'validado_final'
  AND  validado_final_nome ILIKE '%Danilo%Amaral%';

-- (4) DEPOIS — status deve estar 'validado_diretoria' e validado_final_* nulo.
SELECT id, nome_processo, status,
       validado_diretoria_nome, validado_diretoria_em,
       validado_final_user_id,  validado_final_nome, validado_final_em,
       versao, revisao, periodo, ciclos_homologados
FROM   processos_negocio
WHERE  nome_processo = 'Gerenciamento de Contratos de TIC'
  AND  is_deleted = FALSE;

-- Se ANTES/DEPOIS estiverem corretos, confirme:
COMMIT;
-- Se algo estiver errado, use no lugar do COMMIT:
-- ROLLBACK;
