-- changeset kaizen:184_add_cadastros_areas_id_to_avaliacoes splitStatements:false

DO $$
BEGIN
    ALTER TABLE IF EXISTS avaliacao_gestor_formularios ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='avaliacao_gestor_formularios' AND column_name='diretoria') THEN
        EXECUTE 'UPDATE avaliacao_gestor_formularios p SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = p.diretoria AND p.cadastros_areas_id IS NULL';
    END IF;

    ALTER TABLE IF EXISTS avaliacao_integrada_formularios ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id);
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='avaliacao_integrada_formularios' AND column_name='diretoria') THEN
        EXECUTE 'UPDATE avaliacao_integrada_formularios p SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = p.diretoria AND p.cadastros_areas_id IS NULL';
    END IF;
END $$;
