-- liquibase formatted sql

-- changeset antigravity:210
ALTER TABLE ifo ADD COLUMN expense_nature VARCHAR(255);
