-- liquibase formatted sql
-- changeset kaizen:202_create_delegacao_edicao

-- Migration 202: Delegação de permissões de edição por etapa do ciclo orçamentário.
--
-- CONTEXTO:
-- Validadores (quem transita etapas) precisam poder delegar a permissão de edição/exclusão de IFOs
-- a colegas da mesma área, por etapa específica da Formação do PCA. Delegações são automaticamente
-- revogadas quando o ciclo avança ou retrocede de etapa.
-- Tipo 'normal' permite edição padrão; 'especial' herda capacidades de modificação especial.

CREATE TABLE IF NOT EXISTS delegacao_edicao (
    id              BIGSERIAL PRIMARY KEY,
    ciclo_id        BIGINT NOT NULL REFERENCES ciclo_orcamentario(id) ON DELETE CASCADE,
    estado          VARCHAR(40) NOT NULL,
    delegado_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    delegante_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    area_id         BIGINT NOT NULL REFERENCES cadastros_areas(id) ON DELETE CASCADE,
    tipo            VARCHAR(20) NOT NULL DEFAULT 'normal',
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_delegacao_edicao
    ON delegacao_edicao (ciclo_id, estado, delegado_id);

CREATE INDEX IF NOT EXISTS idx_delegacao_edicao_ciclo_estado
    ON delegacao_edicao (ciclo_id, estado);

-- rollback DROP INDEX IF EXISTS idx_delegacao_edicao_ciclo_estado;
-- rollback DROP INDEX IF EXISTS uq_delegacao_edicao;
-- rollback DROP TABLE IF EXISTS delegacao_edicao;
