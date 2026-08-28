-- liquibase formatted sql

-- changeset kaizen:254_contract_plans_members_attachments

-- Migration 254: Onda 1 — Planejamento da Contratação.
--
-- CONTEXTO:
-- Adiciona suporte ao circuito de assinaturas do DOD (membros com papéis),
-- anexação de documentos categorizados (dod, etp, tr, mgr, am),
-- e campos PROAD e IPC na tabela contract_plans.
--
-- SEGURANÇA (Zero Downtime): tabelas novas e colunas aditivas. Sem locks ou rewrite.

-- 1. Novos campos em contract_plans
ALTER TABLE contract_plans ADD COLUMN IF NOT EXISTS proad_number VARCHAR(17);
ALTER TABLE contract_plans ADD COLUMN IF NOT EXISTS ipc_code VARCHAR(20);

-- Índice único parcial: um PROAD não pode ter duas IPCs ativas
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_plans_proad_active
    ON contract_plans (proad_number) WHERE proad_number IS NOT NULL AND is_deleted = FALSE;

-- Índice único parcial: IPC é imutável e nunca reutilizado
CREATE UNIQUE INDEX IF NOT EXISTS idx_contract_plans_ipc_code
    ON contract_plans (ipc_code) WHERE ipc_code IS NOT NULL;

-- 2. Tabela de membros (papéis/assinantes do DOD)
CREATE TABLE IF NOT EXISTS contract_plans_members (
    id              BIGSERIAL PRIMARY KEY,
    contract_plan_id BIGINT NOT NULL,
    user_id         BIGINT NOT NULL,
    role            VARCHAR(50) NOT NULL,
    signed_at       TIMESTAMP,
    signature_status VARCHAR(20) DEFAULT 'PENDING',
    reject_reason   TEXT,
    created_at      TIMESTAMP DEFAULT NOW(),
    created_by      BIGINT,
    CONSTRAINT fk_cp_members_plan FOREIGN KEY (contract_plan_id) REFERENCES contract_plans (id)
);

CREATE INDEX IF NOT EXISTS idx_cp_members_plan ON contract_plans_members (contract_plan_id);

-- 3. Tabela de anexos categorizados
CREATE TABLE IF NOT EXISTS contract_plans_attachments (
    id              BIGSERIAL PRIMARY KEY,
    contract_plan_id BIGINT NOT NULL,
    file_name       VARCHAR(255) NOT NULL,
    file_key        TEXT NOT NULL,
    file_size       BIGINT,
    content_type    VARCHAR(100),
    document_type   VARCHAR(10) NOT NULL,
    uploaded_by     BIGINT,
    uploaded_at     TIMESTAMP DEFAULT NOW(),
    is_deleted      BOOLEAN DEFAULT FALSE,
    deleted_at      TIMESTAMP,
    deleted_by      BIGINT,
    CONSTRAINT fk_cp_attachments_plan FOREIGN KEY (contract_plan_id) REFERENCES contract_plans (id)
);

CREATE INDEX IF NOT EXISTS idx_cp_attachments_plan ON contract_plans_attachments (contract_plan_id);
CREATE INDEX IF NOT EXISTS idx_cp_attachments_file_key ON contract_plans_attachments (file_key) WHERE file_key IS NOT NULL;

-- rollback DROP INDEX IF EXISTS idx_cp_attachments_file_key;
-- rollback DROP INDEX IF EXISTS idx_cp_attachments_plan;
-- rollback DROP TABLE IF EXISTS contract_plans_attachments;
-- rollback DROP INDEX IF EXISTS idx_cp_members_plan;
-- rollback DROP TABLE IF EXISTS contract_plans_members;
-- rollback DROP INDEX IF EXISTS idx_contract_plans_ipc_code;
-- rollback DROP INDEX IF EXISTS idx_contract_plans_proad_active;
-- rollback ALTER TABLE contract_plans DROP COLUMN IF EXISTS ipc_code;
-- rollback ALTER TABLE contract_plans DROP COLUMN IF EXISTS proad_number;
