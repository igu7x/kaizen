-- liquibase formatted sql

-- changeset kaizen:211_rename_pca_item_to_pcas_id
ALTER TABLE cadastros_projetos RENAME COLUMN pca_item_id TO pcas_id;

-- rollback ALTER TABLE cadastros_projetos RENAME COLUMN pcas_id TO pca_item_id;
