-- liquibase formatted sql

-- changeset system:158_add_process_enums
ALTER TABLE pcas
ADD COLUMN process VARCHAR(255),
ADD COLUMN financial_resource_type VARCHAR(50),
ADD COLUMN contract_type VARCHAR(50);
