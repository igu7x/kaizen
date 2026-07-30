--liquibase formatted sql

--changeset kaizen:206_backfill_cadastros_areas_id_okr_tables splitStatements:false
-- Migration 206: re-backfill de cadastros_areas_id nas tabelas do módulo OKR.
--
-- CONTEXTO:
-- A migration 181 introduziu cadastros_areas_id nas tabelas de OKR e fez o backfill casando
-- EXATAMENTE `cadastros_areas.sigla = <tabela>.directorate_code`. Esse match é frágil: qualquer
-- diferença de caixa, espaços em branco ou registro cujo directorate_code guardava o NOME da área
-- (e não a sigla) ficou com cadastros_areas_id NULL. Como as listagens de OKR/Metas filtram por
-- cadastros_areas_id (domínio do usuário), esses OKRs simplesmente somem — o usuário vê tudo zerado
-- (relato de produção: OKRs da DPE não apareciam).
--
-- Este re-backfill preenche apenas as linhas ainda NULL, com casamento tolerante:
--   1) por sigla, case-insensitive e sem espaços;
--   2) fallback por nome da área, idem.
-- directorate_code continua existindo (nunca foi dropado), então segue como fonte da verdade.
--
-- SEGURANÇA (Zero Downtime): apenas UPDATE de linhas com cadastros_areas_id ausente; idempotente.

DO $$
DECLARE
    t   text;
    tabelas text[] := ARRAY['objectives', 'key_results', 'initiatives', 'programs', 'execution_controls'];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        -- Só age se a tabela tiver as duas colunas (ambiente já migrado pela 181).
        IF EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = t AND column_name = 'cadastros_areas_id'
        ) AND EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = t AND column_name = 'directorate_code'
        ) THEN
            -- 1) por sigla (case-insensitive, sem espaços)
            EXECUTE format($f$
                UPDATE %1$I x
                   SET cadastros_areas_id = a.id
                  FROM cadastros_areas a
                 WHERE x.cadastros_areas_id IS NULL
                   AND x.directorate_code IS NOT NULL
                   AND lower(btrim(a.sigla)) = lower(btrim(x.directorate_code))
            $f$, t);

            -- 2) fallback por nome da área (case-insensitive, sem espaços)
            EXECUTE format($f$
                UPDATE %1$I x
                   SET cadastros_areas_id = a.id
                  FROM cadastros_areas a
                 WHERE x.cadastros_areas_id IS NULL
                   AND x.directorate_code IS NOT NULL
                   AND lower(btrim(a.nome)) = lower(btrim(x.directorate_code))
            $f$, t);
        END IF;
    END LOOP;
END $$;

--rollback SELECT 1;
