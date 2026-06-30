-- liquibase formatted sql

-- changeset kaizen:167_create_pcas_snapshots
CREATE TABLE pcas_snapshots (
    id SERIAL PRIMARY KEY,
    original_pca_id BIGINT,
    snapshot_version INT NOT NULL,
    snapshot_created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    snapshot_created_by BIGINT,
    
    -- Mesmos campos exatos de pcas
    year VARCHAR(4) NOT NULL,
    code VARCHAR(4) NOT NULL,
    description TEXT,
    justification TEXT,
    process VARCHAR(255),
    financial_resource_type VARCHAR(50),
    contract_type VARCHAR(50),
    object_name TEXT,
    directory_acronym VARCHAR(20),
    estimated_value_cents BIGINT,
    formalized_value_cents BIGINT,
    id_diretoria BIGINT,
    id_area_demandante BIGINT,
    id_cadastros_areas BIGINT,
    priority VARCHAR(50),
    step VARCHAR(100),
    estimated_date DATE,
    status VARCHAR(50),
    is_deleted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by BIGINT,
    updated_by BIGINT,
    deleted_at TIMESTAMP,
    deleted_by BIGINT
);

-- rollback DROP TABLE pcas_snapshots;
