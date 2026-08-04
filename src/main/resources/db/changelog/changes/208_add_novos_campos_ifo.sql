-- liquibase formatted sql

-- changeset kaizen:208_add_novos_campos_ifo
ALTER TABLE ifo
    ADD COLUMN strategic_objective TEXT,
    ADD COLUMN is_sustainable BOOLEAN DEFAULT FALSE,
    ADD COLUMN is_shared_acquisition BOOLEAN DEFAULT FALSE,
    ADD COLUMN quantity VARCHAR(255);

-- rollback ALTER TABLE ifo DROP COLUMN quantity;
-- rollback ALTER TABLE ifo DROP COLUMN is_shared_acquisition;
-- rollback ALTER TABLE ifo DROP COLUMN is_sustainable;
-- rollback ALTER TABLE ifo DROP COLUMN strategic_objective;
