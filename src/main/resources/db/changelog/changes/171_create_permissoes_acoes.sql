--liquibase formatted sql

--changeset system:171_create_permissoes_acoes
CREATE TABLE tags_acoes (
    id VARCHAR(50) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE permissoes_acoes (
    id SERIAL PRIMARY KEY,
    tag_acoes_id VARCHAR(50) NOT NULL REFERENCES tags_acoes(id) ON DELETE CASCADE,
    area_id INTEGER NOT NULL REFERENCES cadastros_areas(id) ON DELETE CASCADE,
    unidade_id INTEGER,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_permissoes_acoes_unidade FOREIGN KEY (unidade_id) REFERENCES cadastros_areas(id) ON DELETE CASCADE
);

CREATE INDEX idx_permissoes_acoes_validacao 
ON permissoes_acoes (tag_acoes_id, area_id, unidade_id, user_id);

--rollback DROP TABLE permissoes_acoes;
--rollback DROP TABLE tags_acoes;
