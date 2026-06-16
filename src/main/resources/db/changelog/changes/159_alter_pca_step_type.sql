-- liquibase formatted sql

-- changeset system:159159_alter_step_type
ALTER TABLE pcas
ALTER COLUMN step TYPE VARCHAR(255) USING step::VARCHAR;
-- rollback ALTER TABLE pcas ALTER COLUMN step TYPE INTEGER USING step::INTEGER;

-- changeset system:159_alter_object_name
ALTER TABLE pcas
ALTER COLUMN object_name TYPE TEXT;
-- rollback ALTER TABLE pcas ALTER COLUMN object_name TYPE VARCHAR(50);
