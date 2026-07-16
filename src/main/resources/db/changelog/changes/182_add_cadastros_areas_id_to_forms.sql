-- liquibase formatted sql
-- changeset kaizen:182_add_cadastros_areas_id_to_forms

-- Migration 182: Adiciona os campos de ID de áreas à tabela forms
-- Substitui directorate_code e allowed_directorates pelas suas versões mapeadas como ID.

DO $$
BEGIN
    -- Adiciona os novos campos
    ALTER TABLE IF EXISTS forms ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    ALTER TABLE IF EXISTS forms ADD COLUMN IF NOT EXISTS allowed_areas_ids JSONB;

    -- Atualiza cadastros_areas_id
    UPDATE forms f SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = f.directorate_code;
END $$;

UPDATE forms f
SET allowed_areas_ids = (
    SELECT jsonb_agg(
        CASE 
            WHEN elem::text = '"ALL"' THEN '"ALL"'::jsonb
            ELSE to_jsonb(a.id)
        END
    )
    FROM jsonb_array_elements(f.allowed_directorates) AS elem
    LEFT JOIN cadastros_areas a ON a.sigla = trim(BOTH '"' FROM elem::text)
    WHERE elem::text = '"ALL"' OR a.id IS NOT NULL
)
WHERE f.allowed_directorates IS NOT NULL AND f.allowed_directorates != '[]'::jsonb;
