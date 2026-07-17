-- liquibase formatted sql
-- changeset kaizen:180_add_cadastros_unidades_id_to_users

ALTER TABLE users ADD COLUMN IF NOT EXISTS cadastros_unidades_id BIGINT;
ALTER TABLE users ADD CONSTRAINT fk_users_cadastros_unidades FOREIGN KEY (cadastros_unidades_id) REFERENCES cadastros_unidades(id);

ALTER TABLE users ADD COLUMN IF NOT EXISTS cadastros_areas_id BIGINT;
ALTER TABLE users ADD CONSTRAINT fk_users_cadastros_areas FOREIGN KEY (cadastros_areas_id) REFERENCES cadastros_areas(id);

UPDATE users u SET cadastros_areas_id = a.id FROM cadastros_areas a WHERE a.sigla = u.directorate_code;

UPDATE users u
SET cadastros_unidades_id = (
    SELECT cp.unidade_id
    FROM cadastros_pessoas cp
    WHERE cp.user_id = u.id
      AND cp.area_id = u.cadastros_areas_id
    LIMIT 1
)
WHERE u.cadastros_unidades_id IS NULL;

-- rollback ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_cadastros_areas;
-- rollback ALTER TABLE users DROP COLUMN IF EXISTS cadastros_areas_id;
-- rollback ALTER TABLE users DROP CONSTRAINT IF EXISTS fk_users_cadastros_unidades;
-- rollback ALTER TABLE users DROP COLUMN IF EXISTS cadastros_unidades_id;
