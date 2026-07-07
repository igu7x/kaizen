-- liquibase formatted sql
-- changeset kaizen:182_add_area_id_to_ifo

ALTER TABLE ifo ADD COLUMN area_id BIGINT;

-- rollback ALTER TABLE ifo DROP COLUMN area_id;
