-- changeset kaizen:202_make_diretoria_nullable splitStatements:false

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'autoavaliacao_formularios' AND column_name = 'diretoria') THEN
        ALTER TABLE autoavaliacao_formularios ALTER COLUMN diretoria DROP NOT NULL;
    END IF;
END $$;
