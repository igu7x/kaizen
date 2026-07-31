--liquibase formatted sql

--changeset kaizen:207_backfill_responsavel_user_id_unidades splitStatements:false
-- Migration 207: backfill de cadastros_unidades.responsavel_user_id.
--
-- CONTEXTO:
-- O cadastro de unidade grava o nome do responsável em texto (cadastros_unidades.responsavel),
-- mas em várias unidades o vínculo com a conta (responsavel_user_id) ficou NULL. O papel
-- "Responsável do Processo" (que libera o botão "Validar" no Escritório de Processos) é resolvido
-- por esse FK — com ele nulo, o responsável real não é reconhecido (relato: Marcus/CSTI, unidade 75,
-- sem o botão "Validar").
--
-- Preenche apenas linhas com responsavel_user_id NULL, de forma conservadora: casa o MEMBRO da
-- unidade (users.cadastros_unidades_id = unidade) cujo nome bate com o texto
-- cadastros_unidades.responsavel, comparando SEM acento e SEM caixa. A exigência de ser membro da
-- unidade desambigua homônimos (ex.: vários "Marcus Vinícius"). O texto do cadastro pode ter acento
-- que o nome da conta não tem (ex.: "Viní­cius" x "Vinicius"), por isso a normalização por translate.
--
-- SEGURANÇA (Zero Downtime): apenas UPDATE de linhas sem valor; idempotente. Não depende da
-- extensão unaccent (usa translate).

UPDATE cadastros_unidades cu
SET responsavel_user_id = u.id
FROM users u
WHERE cu.responsavel_user_id IS NULL
  AND cu.responsavel IS NOT NULL
  AND btrim(cu.responsavel) <> ''
  AND u.cadastros_unidades_id = cu.id
  AND translate(lower(btrim(u.name)),
                'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn')
    = translate(lower(btrim(cu.responsavel)),
                'áàâãäéèêëíìîïóòôõöúùûüçñ', 'aaaaaeeeeiiiiooooouuuucn');

--rollback SELECT 1;
