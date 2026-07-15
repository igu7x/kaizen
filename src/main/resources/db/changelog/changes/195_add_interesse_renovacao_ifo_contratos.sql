-- liquibase formatted sql
-- changeset kaizen:195_add_interesse_renovacao_ifo_contratos

ALTER TABLE ifo_contratos ADD COLUMN interesse_renovacao BOOLEAN DEFAULT TRUE;
ALTER TABLE ifo_contratos ADD COLUMN motivo_reclassificacao TEXT;

-- rollback ALTER TABLE ifo_contratos DROP COLUMN motivo_reclassificacao;
-- rollback ALTER TABLE ifo_contratos DROP COLUMN interesse_renovacao;
