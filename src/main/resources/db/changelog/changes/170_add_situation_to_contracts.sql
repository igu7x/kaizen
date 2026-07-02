-- liquibase formatted sql
-- changeset kaizen:170_add_situation_to_contracts

-- Migration 170: natureza (situation) do contrato para o Orçamento de TIC
--
-- CONTEXTO:
-- O DFD-Consulta (Formação do Orçamento de TIC) classifica os contratos por natureza.
-- Ver Especificação de Requisitos do Orçamento (RF-01/02/04/17). Nulo = não classificado.
--
-- SEGURANÇA (Zero Downtime): coluna nullable, aditiva. O domínio de valores válidos é validado
-- no backend (ContractService), NÃO por CHECK no banco (decisão de arquitetura, jul/2026).

ALTER TABLE contracts ADD COLUMN IF NOT EXISTS situation VARCHAR(20);

-- Remove o CHECK legado (a validação passou para o backend).
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS chk_contracts_situation;

-- rollback ALTER TABLE contracts DROP COLUMN IF EXISTS situation;
