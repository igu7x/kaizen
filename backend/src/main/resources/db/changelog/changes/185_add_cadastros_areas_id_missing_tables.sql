-- changeset kaizen:185_add_cadastros_areas_id_missing_tables splitStatements:false

-- Corrige o refactor diretoria -> cadastros_areas_id: as migrations 180-184 adicionaram a
-- coluna em várias tabelas, mas o código (services) referencia cadastros_areas_id também nas
-- tabelas abaixo, que ficaram sem a coluna -> causava 500 em /permissoes/minha,
-- /avaliacao-integrada/tem-elegiveis, /competencias-gestor, projetos, etc.
-- Aditiva e idempotente (ADD COLUMN IF NOT EXISTS + backfill condicional a partir de `diretoria`).

DO $$
DECLARE
    t text;
    tabelas text[] := ARRAY[
        'autoavaliacao_formularios',
        'autorizacoes_formulario_competencias',
        'cadastros_projetos',
        'competencias_gestor_formularios',
        'permissoes_diretoria'
    ];
BEGIN
    FOREACH t IN ARRAY tabelas LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = t) THEN
            EXECUTE format(
                'ALTER TABLE %I ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT REFERENCES cadastros_areas(id)', t);
            IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = t AND column_name = 'diretoria') THEN
                EXECUTE format(
                    'UPDATE %I p SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = p.diretoria AND p.cadastros_areas_id IS NULL', t);
            END IF;
        END IF;
    END LOOP;
END $$;
