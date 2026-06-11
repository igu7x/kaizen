-- liquibase formatted sql

-- changeset kaizen:155_create_pca_contract_plans_contracts
CREATE TABLE pcas (
    id BIGSERIAL PRIMARY KEY,
    code VARCHAR(4) NOT NULL,
    year VARCHAR(4) NOT NULL,
    description VARCHAR(100),
    object_name VARCHAR(50),
    directory_acronym VARCHAR(20),
    estimated_value_cents BIGINT,
    priority_level INTEGER,
    step INTEGER,
    status INTEGER,
    estimated_date DATE,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT
);

CREATE UNIQUE INDEX idx_pca_code_year ON pcas (code, year) WHERE is_deleted = FALSE;

CREATE TABLE contract_plans (
    id BIGSERIAL PRIMARY KEY,
    pca_id BIGINT NOT NULL,
    object_name VARCHAR(50) NOT NULL,
    area_acronym VARCHAR(20),
    description VARCHAR(100) NOT NULL,
    justification VARCHAR(500) NOT NULL,
    estimated_value_cents BIGINT DEFAULT 0,
    estimated_value_currency VARCHAR(3) DEFAULT 'BRL',
    priority_level INTEGER,
    estimated_date DATE NOT NULL,
    pendency_description VARCHAR(128),
    local_description VARCHAR(128),
    contract_type_id BIGINT,
    registration_date DATE,
    status INTEGER,
    step INTEGER,
    financial_resource_type INTEGER,
    loa_reference VARCHAR(64) NOT NULL,
    dod_step INTEGER,
    dod_step_range INTEGER,
    etp_step INTEGER,
    etp_step_range INTEGER,
    ar_step INTEGER,
    ar_step_range INTEGER,
    tr_step INTEGER,
    tr_step_range INTEGER,
    am_step INTEGER,
    am_step_range INTEGER,
    step_updated_at TIMESTAMP,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    CONSTRAINT fk_contract_plans_pca FOREIGN KEY (pca_id) REFERENCES pcas (id)
);


CREATE TABLE contracts (
    id BIGSERIAL PRIMARY KEY,
    contract_plan_id BIGINT,
    base_contract_id BIGINT,
    supplier VARCHAR(255),
    contract_model VARCHAR(255),
    process VARCHAR(255),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    effective_date DATE,
    limit_date DATE,
    contract_type VARCHAR(50) CHECK (contract_type IN (
        'Armazenamento', 'Autenticação', 'Backup', 'Banco de Dados', 
        'Colaboração', 'Compliance', 'Desenvolvimento', 'Email', 
        'Fábrica de Software', 'Gestão', 'Help Desk', 'Impressão', 
        'Links de Dados', 'Material', 'Nuvem', 'Parque Computacior', 
        'Processamento', 'Redes', 'Residência', 'Software Prateleira', 
        'Segurança', 'Telefonia fixa', 'Telefonia móvel', 
        'Videoconferência', 'Voip'
    )),
    additive_term_type INTEGER,
    object_name TEXT,
    description TEXT,
    notice_number VARCHAR(16),
    effective_additive_term INTEGER,
    total_value_cents BIGINT DEFAULT 0,
    total_value_currency VARCHAR(3) DEFAULT 'BRL',
    monthly_value_cents BIGINT DEFAULT 0,
    monthly_value_currency VARCHAR(3) DEFAULT 'BRL',
    year_value BIGINT,
    directory VARCHAR(50),
    cadastro_area_id BIGINT,
    cadastro_unidade_id BIGINT,
    unidade VARCHAR(255),
    contract_members_id BIGINT,
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT,
    is_deleted BOOLEAN DEFAULT FALSE,
    deleted_at TIMESTAMP,
    deleted_by BIGINT,
    CONSTRAINT fk_contracts_contract_plans FOREIGN KEY (contract_plan_id) REFERENCES contract_plans (id),
    CONSTRAINT fk_contracts_base_contract FOREIGN KEY (base_contract_id) REFERENCES contracts (id)
);

CREATE TABLE contracts_pcas (
    contract_id BIGINT NOT NULL,
    pca_id BIGINT NOT NULL,
    PRIMARY KEY (contract_id, pca_id),
    CONSTRAINT fk_contracts_pca_contract FOREIGN KEY (contract_id) REFERENCES contracts (id),
    CONSTRAINT fk_contracts_pcas_pca FOREIGN KEY (pca_id) REFERENCES pcas (id)
);

CREATE TABLE contracts_members (
    id BIGSERIAL PRIMARY KEY,
    contract_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    type VARCHAR(50),
    CONSTRAINT fk_contract_members_contract FOREIGN KEY (contract_id) REFERENCES contracts (id)
);

-- rollback DROP TABLE contracts_members;
-- rollback DROP TABLE contracts_pcas;
-- rollback DROP TABLE contracts;
-- rollback DROP TABLE contract_plans;
-- rollback DROP INDEX idx_pca_code_year;
-- rollback DROP TABLE pcas;
