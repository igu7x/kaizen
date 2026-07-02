-- liquibase formatted sql
-- changeset kaizen:170_add_situation_to_contracts

-- Migration 170: natureza (situation) do contrato para o Orçamento de TIC
--
-- CONTEXTO:
-- O DFD-Consulta (Formação do Orçamento de TIC) classifica os contratos por natureza:
-- "continuada" (pré-carregados nos blocos 1–3 do DFD) | "pontual" (não pré-carregados).
-- Ver Especificação de Requisitos do Orçamento (RF-01/02/04/17). Nulo = não classificado.
--
-- SEGURANÇA (Zero Downtime): coluna nullable, aditiva; CHECK limita aos valores válidos.

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS situation VARCHAR(20);

ALTER TABLE contracts DROP CONSTRAINT IF EXISTS chk_contracts_situation;
ALTER TABLE contracts ADD CONSTRAINT chk_contracts_situation
    CHECK (situation IS NULL OR situation IN ('continuada', 'pontual'));

-- rollback ALTER TABLE contracts DROP CONSTRAINT IF EXISTS chk_contracts_situation;
-- rollback ALTER TABLE contracts DROP COLUMN IF EXISTS situation;
