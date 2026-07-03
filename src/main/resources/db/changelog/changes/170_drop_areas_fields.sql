-- changeset kaizen:170_drop_areas_fields
ALTER TABLE cadastros_areas 
  DROP COLUMN IF EXISTS colaboradores_vinculados,
  DROP COLUMN IF EXISTS foto_gestor,
  DROP COLUMN IF EXISTS foto_subdiretor;

-- rollback ALTER TABLE cadastros_areas ADD COLUMN IF NOT EXISTS colaboradores_vinculados VARCHAR(255);
-- rollback ALTER TABLE cadastros_areas ADD COLUMN IF NOT EXISTS foto_gestor TEXT;
-- rollback ALTER TABLE cadastros_areas ADD COLUMN IF NOT EXISTS foto_subdiretor TEXT;
