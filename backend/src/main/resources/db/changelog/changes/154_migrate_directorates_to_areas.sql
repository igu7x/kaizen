-- liquibase formatted sql
-- changeset kaizen:154 splitStatements:false

-- Migration 154: Migração definitiva da tabela `directorates` para `cadastros_areas`
--
-- CONTEXTO:
-- A tabela `directorates` ficou obsoleta pois a lista de diretorias válidas passou
-- a ser lida dinamicamente da tabela `cadastros_areas`. O único campo exclusivo da
-- tabela `directorates` era o `proad_link`, que agora será migrado para `cadastros_areas`.
-- Em seguida, a tabela `directorates` será excluída para evitar dupla fonte de verdade.


DO $$
BEGIN
    -- 1. Adicionar coluna proad_link na tabela cadastros_areas
    ALTER TABLE cadastros_areas ADD COLUMN IF NOT EXISTS proad_link VARCHAR(255);

    -- 2. Migrar os dados existentes de proad_link
    IF TO_REGCLASS('public.directorates') IS NOT NULL THEN
        UPDATE cadastros_areas ca
        SET proad_link = d.proad_link
        FROM directorates d
        WHERE ca.sigla = d.code;

        -- 3. Excluir a tabela obsoleta
        DROP TABLE directorates CASCADE;
        
        RAISE NOTICE '154: Tabela directorates deletada e dados migrados para cadastros_areas.';
    END IF;
END $$;


-- rollback CREATE TABLE directorates (code VARCHAR(255) PRIMARY KEY, name VARCHAR(255), description TEXT, proad_link VARCHAR(255));
-- rollback UPDATE directorates d SET proad_link = ca.proad_link FROM cadastros_areas ca WHERE d.code = ca.sigla;
-- rollback ALTER TABLE cadastros_areas DROP COLUMN proad_link;


