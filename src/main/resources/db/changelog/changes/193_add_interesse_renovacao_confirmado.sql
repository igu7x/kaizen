-- liquibase formatted sql
-- changeset kaizen:193_add_interesse_renovacao_confirmado

ALTER TABLE ifo ADD COLUMN interesse_renovacao_confirmado BOOLEAN DEFAULT FALSE;

-- rollback ALTER TABLE ifo DROP COLUMN interesse_renovacao_confirmado;
