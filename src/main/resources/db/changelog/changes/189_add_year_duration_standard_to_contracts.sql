-- liquibase formatted sql
-- changeset kaizen:189_add_year_duration_standard_to_contracts

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS year_duration_standard NUMERIC(5,2);

-- rollback ALTER TABLE contracts DROP COLUMN IF EXISTS year_duration_standard;
