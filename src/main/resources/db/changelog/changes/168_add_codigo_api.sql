-- changeset kaizen:168_add_codigo_api
ALTER TABLE cadastros_areas ADD COLUMN IF NOT EXISTS codigo_api VARCHAR(100);
ALTER TABLE cadastros_unidades ADD COLUMN IF NOT EXISTS codigo_api VARCHAR(100);

-- rollback ALTER TABLE cadastros_unidades DROP COLUMN IF EXISTS codigo_api;
-- rollback ALTER TABLE cadastros_areas DROP COLUMN IF EXISTS codigo_api;
