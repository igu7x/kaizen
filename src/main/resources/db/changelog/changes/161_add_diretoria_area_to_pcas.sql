-- liquibase formatted sql

-- changeset system:161_add_id_diretoria_to_pcas
ALTER TABLE pcas ADD COLUMN IF NOT EXISTS id_diretoria BIGINT;
ALTER TABLE pcas ADD CONSTRAINT fk_pcas_diretoria
  FOREIGN KEY (id_diretoria) REFERENCES cadastros_unidades(id);
-- rollback ALTER TABLE pcas DROP CONSTRAINT IF EXISTS fk_pcas_diretoria;
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS id_diretoria;

-- changeset system:161_add_id_area_demandante_to_pcas
ALTER TABLE pcas ADD COLUMN IF NOT EXISTS id_area_demandante BIGINT;
ALTER TABLE pcas ADD CONSTRAINT fk_pcas_area_demandante
  FOREIGN KEY (id_area_demandante) REFERENCES cadastros_unidades(id);
-- rollback ALTER TABLE pcas DROP CONSTRAINT IF EXISTS fk_pcas_area_demandante;
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS id_area_demandante;

-- changeset system:161_add_formalized_value_cents_to_pcas
ALTER TABLE pcas ADD COLUMN IF NOT EXISTS formalized_value_cents BIGINT DEFAULT 0;
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS formalized_value_cents;

-- changeset system:161_add_id_cadastros_areas_to_pcas
ALTER TABLE pcas ADD COLUMN IF NOT EXISTS id_cadastros_areas BIGINT;
ALTER TABLE pcas ADD CONSTRAINT fk_pcas_cadastros_areas
  FOREIGN KEY (id_cadastros_areas) REFERENCES cadastros_areas(id);
-- rollback ALTER TABLE pcas DROP CONSTRAINT IF EXISTS fk_pcas_cadastros_areas;
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS id_cadastros_areas;

-- changeset system:161_add_indexes_pcas_fk
CREATE INDEX IF NOT EXISTS idx_pcas_id_diretoria ON pcas(id_diretoria);
CREATE INDEX IF NOT EXISTS idx_pcas_id_area_demandante ON pcas(id_area_demandante);
CREATE INDEX IF NOT EXISTS idx_pcas_id_cadastros_areas ON pcas(id_cadastros_areas);
-- rollback DROP INDEX IF EXISTS idx_pcas_id_diretoria;
-- rollback DROP INDEX IF EXISTS idx_pcas_id_area_demandante;
-- rollback DROP INDEX IF EXISTS idx_pcas_id_cadastros_areas;
