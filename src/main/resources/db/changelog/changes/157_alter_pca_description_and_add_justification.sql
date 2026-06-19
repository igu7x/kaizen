-- liquibase formatted sql

-- changeset system:157_alter_pca_description
ALTER TABLE pcas
ALTER COLUMN description TYPE TEXT,
ADD COLUMN justification TEXT;
