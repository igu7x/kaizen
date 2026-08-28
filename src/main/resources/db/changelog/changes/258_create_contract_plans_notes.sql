-- liquibase formatted sql

-- changeset kaizen:258_create_contract_plans_notes
CREATE TABLE contract_plans_notes (
    id BIGSERIAL PRIMARY KEY,
    contract_plan_id BIGINT NOT NULL REFERENCES contract_plans(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES users(id) ON DELETE SET NULL,
    message TEXT NOT NULL,
    is_system_event BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(255),
    updated_at TIMESTAMP WITH TIME ZONE,
    updated_by VARCHAR(255),
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by VARCHAR(255)
);

CREATE INDEX idx_contract_plans_notes_plan_id ON contract_plans_notes(contract_plan_id);

-- rollback DROP TABLE contract_plans_notes;
