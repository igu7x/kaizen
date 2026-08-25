-- liquibase formatted sql

-- changeset kaizen:254_add_soft_delete_to_contract_risk_assessments
ALTER TABLE contract_risk_assessments
ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE,
ADD COLUMN deleted_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN deleted_by_id BIGINT,
ADD CONSTRAINT fk_contract_risk_assessments_deleted_user FOREIGN KEY (deleted_by_id) REFERENCES users(id);