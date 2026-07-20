-- liquibase formatted sql
-- changeset kaizen:181_add_expense_nature_to_contracts

ALTER TABLE contracts ADD COLUMN expense_nature VARCHAR(255);

-- rollback ALTER TABLE contracts DROP COLUMN expense_nature;
