-- liquibase formatted sql
-- changeset kaizen:183_add_pca_attributes_to_ifo

-- Add PCA attributes to IFO

ALTER TABLE ifo ADD COLUMN description TEXT;
ALTER TABLE ifo ADD COLUMN justification TEXT;
ALTER TABLE ifo ADD COLUMN process VARCHAR(255);
ALTER TABLE ifo ADD COLUMN financial_resource_type VARCHAR(50);
ALTER TABLE ifo ADD COLUMN contract_type VARCHAR(50);
ALTER TABLE ifo ADD COLUMN formalized_value_cents BIGINT;
ALTER TABLE ifo ADD COLUMN id_cadastros_areas BIGINT;
ALTER TABLE ifo ADD COLUMN priority VARCHAR(50);
ALTER TABLE ifo ADD COLUMN estimated_date DATE;
ALTER TABLE ifo ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE ifo ADD COLUMN deleted_at TIMESTAMP;
ALTER TABLE ifo ADD COLUMN deleted_by BIGINT;

-- rollback ALTER TABLE ifo DROP COLUMN deleted_by;
-- rollback ALTER TABLE ifo DROP COLUMN deleted_at;
-- rollback ALTER TABLE ifo DROP COLUMN is_deleted;
-- rollback ALTER TABLE ifo DROP COLUMN estimated_date;
-- rollback ALTER TABLE ifo DROP COLUMN priority;
-- rollback ALTER TABLE ifo DROP COLUMN id_cadastros_areas;
-- rollback ALTER TABLE ifo DROP COLUMN formalized_value_cents;
-- rollback ALTER TABLE ifo DROP COLUMN contract_type;
-- rollback ALTER TABLE ifo DROP COLUMN financial_resource_type;
-- rollback ALTER TABLE ifo DROP COLUMN process;
-- rollback ALTER TABLE ifo DROP COLUMN justification;
-- rollback ALTER TABLE ifo DROP COLUMN description;
