-- liquibase formatted sql
-- changeset kaizen:196_add_valor_contrato_ifo_contratos

ALTER TABLE ifo_contratos ADD COLUMN valor_contrato_cents BIGINT;

-- Populando com valor total do contrato para evitar perda financeira
UPDATE ifo_contratos ic
SET valor_contrato_cents = c.total_value_cents
FROM contracts c
WHERE ic.contract_id = c.id;

-- rollback ALTER TABLE ifo_contratos DROP COLUMN valor_contrato_cents;
