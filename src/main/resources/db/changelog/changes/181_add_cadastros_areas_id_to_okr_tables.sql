-- liquibase formatted sql
-- changeset kaizen:181 splitStatements:false

-- Migration 181: Adiciona o campo cadastros_areas_id nas tabelas do módulo OKR
--
-- CONTEXTO:
-- O código do OkrService.java foi refatorado para utilizar cadastros_areas_id (Long) 
-- em substituição ao antigo directorate_code (String). Esta migration garante que
-- o banco de dados suporte as novas colunas e realiza a migração dos dados existentes.

DO $$
BEGIN
    -- Objectives
    ALTER TABLE IF EXISTS objectives ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    UPDATE objectives o SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = o.directorate_code;

    -- Key Results
    ALTER TABLE IF EXISTS key_results ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    UPDATE key_results kr SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = kr.directorate_code;

    -- Initiatives
    ALTER TABLE IF EXISTS initiatives ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    UPDATE initiatives i SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = i.directorate_code;

    -- Programs
    ALTER TABLE IF EXISTS programs ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    UPDATE programs p SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = p.directorate_code;

    -- Execution Controls
    ALTER TABLE IF EXISTS execution_controls ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    UPDATE execution_controls ec SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = ec.directorate_code;

END $$;
