-- changeset kaizen:203_backfill_cadastros_areas_id_competencias splitStatements:false

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'competencias_gestor_formularios' AND column_name = 'diretoria') THEN
        UPDATE competencias_gestor_formularios p 
        SET cadastros_areas_id = a.id 
        FROM cadastros_areas a 
        WHERE a.sigla = p.diretoria AND p.cadastros_areas_id IS NULL;
    END IF;
END $$;
