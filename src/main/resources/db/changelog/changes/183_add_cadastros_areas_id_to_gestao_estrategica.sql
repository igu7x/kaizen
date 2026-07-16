-- liquibase formatted sql
-- changeset kaizen:183_add_cadastros_areas_id_to_gestao_estrategica splitStatements:false

DO $$
BEGIN
    -- Tabelas de Planos/Instrumentos
    ALTER TABLE IF EXISTS instrumentos_planejamento ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'instrumentos_planejamento') THEN
        EXECUTE 'UPDATE instrumentos_planejamento p SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = p.diretoria AND p.cadastros_areas_id IS NULL';
    END IF;

    ALTER TABLE IF EXISTS cadastros_instrumentos_planejamento ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'cadastros_instrumentos_planejamento') THEN
        EXECUTE 'UPDATE cadastros_instrumentos_planejamento p SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = p.diretoria AND p.cadastros_areas_id IS NULL';
    END IF;

    ALTER TABLE IF EXISTS gestao_planos_programas ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'gestao_planos_programas') THEN
        EXECUTE 'UPDATE gestao_planos_programas p SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = p.diretoria AND p.cadastros_areas_id IS NULL';
    END IF;

END $$;
