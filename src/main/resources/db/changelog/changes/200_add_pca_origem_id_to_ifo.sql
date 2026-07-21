-- liquibase formatted sql
-- changeset kaizen:200_add_pca_origem_id_to_ifo

-- Migration 200: Adiciona pca_origem_id à tabela ifo para rastreabilidade
-- quando IFOs de Nova Contratação são gerados a partir de PCAs existentes.

ALTER TABLE ifo ADD COLUMN pca_origem_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_ifo_pca_origem ON ifo (pca_origem_id);

-- rollback DROP INDEX IF EXISTS idx_ifo_pca_origem;
-- rollback ALTER TABLE ifo DROP COLUMN pca_origem_id;
