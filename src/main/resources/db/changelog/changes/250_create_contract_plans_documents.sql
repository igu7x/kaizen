-- liquibase formatted sql

-- changeset kaizen:250_create_contract_plans_documents

-- Da antiga 251: adiciona areas e unidades
ALTER TABLE contract_plans
    ADD COLUMN cadastros_areas_id BIGINT,
    ADD COLUMN cadastros_unidades_id BIGINT;

ALTER TABLE contract_plans
    ADD CONSTRAINT fk_contract_plans_cadastros_areas FOREIGN KEY (cadastros_areas_id) REFERENCES cadastros_areas (id);

ALTER TABLE contract_plans
    ADD CONSTRAINT fk_contract_plans_cadastros_unidades FOREIGN KEY (cadastros_unidades_id) REFERENCES cadastros_unidades (id);

-- Garante que contract_plans possui exclusão lógica
ALTER TABLE contract_plans
    ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP,
    ADD COLUMN IF NOT EXISTS deleted_by BIGINT;

-- Remove as colunas de steps do contract_plans e as colunas de body que poderiam existir
ALTER TABLE contract_plans
    DROP COLUMN IF EXISTS dod_step,
    DROP COLUMN IF EXISTS dod_step_range,
    DROP COLUMN IF EXISTS etp_step,
    DROP COLUMN IF EXISTS etp_step_range,
    DROP COLUMN IF EXISTS ar_step,
    DROP COLUMN IF EXISTS ar_step_range,
    DROP COLUMN IF EXISTS tr_step,
    DROP COLUMN IF EXISTS tr_step_range,
    DROP COLUMN IF EXISTS am_step,
    DROP COLUMN IF EXISTS am_step_range,
    DROP COLUMN IF EXISTS dod_body,
    DROP COLUMN IF EXISTS etp_body,
    DROP COLUMN IF EXISTS tr_body;


-- rollback ALTER TABLE contract_plans DROP CONSTRAINT IF EXISTS fk_contract_plans_cadastros_areas;
-- rollback ALTER TABLE contract_plans DROP CONSTRAINT IF EXISTS fk_contract_plans_cadastros_unidades;
-- rollback ALTER TABLE contract_plans DROP COLUMN IF EXISTS cadastros_areas_id;
-- rollback ALTER TABLE contract_plans DROP COLUMN IF EXISTS cadastros_unidades_id;
-- rollback ALTER TABLE contract_plans ADD COLUMN IF NOT EXISTS dod_step INTEGER, ADD COLUMN IF NOT EXISTS dod_step_range INTEGER, ADD COLUMN IF NOT EXISTS etp_step INTEGER, ADD COLUMN IF NOT EXISTS etp_step_range INTEGER, ADD COLUMN IF NOT EXISTS ar_step INTEGER, ADD COLUMN IF NOT EXISTS ar_step_range INTEGER, ADD COLUMN IF NOT EXISTS tr_step INTEGER, ADD COLUMN IF NOT EXISTS tr_step_range INTEGER, ADD COLUMN IF NOT EXISTS am_step INTEGER, ADD COLUMN IF NOT EXISTS am_step_range INTEGER;
