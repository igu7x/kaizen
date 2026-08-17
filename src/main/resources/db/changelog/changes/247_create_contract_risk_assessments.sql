-- liquibase formatted sql

-- changeset kaizen:247_create_contract_risk_assessments
CREATE TABLE contract_risk_assessments (
    id BIGSERIAL PRIMARY KEY,
    created_by_id BIGINT NOT NULL,
    updated_by_id BIGINT,
    status VARCHAR(50) NOT NULL,
    body JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_contract_risk_assessments_created_user FOREIGN KEY (created_by_id) REFERENCES users(id),
    CONSTRAINT fk_contract_risk_assessments_updated_user FOREIGN KEY (updated_by_id) REFERENCES users(id)
);

INSERT INTO tags_acoes (id, name) VALUES
    ('PC_AR_CRUD', 'Gerenciar Avaliações de Risco (Criar, Editar, Excluir)')
ON CONFLICT (id) DO NOTHING;
