-- liquibase formatted sql

-- changeset kaizen:259_add_situation_and_location

-- 1. Adicionar coluna situation à tabela contract_plans
ALTER TABLE contract_plans
    ADD COLUMN situation VARCHAR(20) DEFAULT 'Em Instrução'
        CONSTRAINT chk_contract_plans_situation CHECK (situation IN ('Em Instrução', 'Concluído'));

-- 2. Adicionar coluna location à tabela contract_plans_notes
ALTER TABLE contract_plans_notes
    ADD COLUMN location TEXT;

-- rollback ALTER TABLE contract_plans_notes DROP COLUMN location;
-- rollback ALTER TABLE contract_plans DROP CONSTRAINT chk_contract_plans_situation;
-- rollback ALTER TABLE contract_plans DROP COLUMN situation;
