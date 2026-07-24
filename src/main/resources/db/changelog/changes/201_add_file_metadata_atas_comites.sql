-- liquibase formatted sql
-- changeset kaizen:201_add_file_metadata_atas_comites

-- Migration 201: metadados de arquivo S3 na tabela atas_comites.
--
-- CONTEXTO:
-- A integração com OpenShift ECS armazena os arquivos físicos no storage S3-compatible e
-- apenas os metadados ficam no banco relacional. Colunas nullable para retrocompatibilidade
-- com atas já registradas via link PROAD (coluna anexo_url existente na migration 179).
--
-- SEGURANÇA (Zero Downtime): colunas aditivas, sem locks ou rewrite de tabela.

ALTER TABLE atas_comites ADD COLUMN IF NOT EXISTS file_key          TEXT;
ALTER TABLE atas_comites ADD COLUMN IF NOT EXISTS original_filename TEXT;
ALTER TABLE atas_comites ADD COLUMN IF NOT EXISTS content_type      VARCHAR(100);
ALTER TABLE atas_comites ADD COLUMN IF NOT EXISTS file_size         BIGINT;
ALTER TABLE atas_comites ADD COLUMN IF NOT EXISTS uploaded_at       TIMESTAMP;

-- Índice parcial: só atas com arquivo S3 (file_key NOT NULL)
CREATE INDEX IF NOT EXISTS idx_atas_comites_file_key
    ON atas_comites (file_key) WHERE file_key IS NOT NULL;

-- rollback ALTER TABLE atas_comites DROP COLUMN IF EXISTS file_key;
-- rollback ALTER TABLE atas_comites DROP COLUMN IF EXISTS original_filename;
-- rollback ALTER TABLE atas_comites DROP COLUMN IF EXISTS content_type;
-- rollback ALTER TABLE atas_comites DROP COLUMN IF EXISTS file_size;
-- rollback ALTER TABLE atas_comites DROP COLUMN IF EXISTS uploaded_at;
-- rollback DROP INDEX IF EXISTS idx_atas_comites_file_key;
