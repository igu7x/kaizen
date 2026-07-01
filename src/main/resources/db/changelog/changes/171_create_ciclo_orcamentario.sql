-- liquibase formatted sql
-- changeset kaizen:171_create_ciclo_orcamentario

-- Migration 171: fundação do Ciclo Orçamentário (Orçamento de TIC)
--
-- CONTEXTO:
-- O Ciclo Orçamentário é a oficina que produz versões oficiais do PCA-TIC por duas finalidades:
-- Formação (gera a Versão 1 do ano seguinte) e Revisão (gera Versões 2–4 do ano vigente).
-- Cada ciclo percorre uma esteira (estado), é instruído por um PROAD (RF-22) e, na publicação
-- pela DG, grava a próxima versão no PCA-TIC (RF-41/75). Ver Especificação de Requisitos, Cap. 2–6.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.

CREATE TABLE IF NOT EXISTS ciclo_orcamentario (
    id            BIGSERIAL PRIMARY KEY,
    ano           INTEGER NOT NULL,
    finalidade    VARCHAR(20) NOT NULL CHECK (finalidade IN ('formacao', 'revisao')),
    subtipo       VARCHAR(20) CHECK (subtipo IS NULL OR subtipo IN ('ordinaria', 'extraordinaria')),
    estado        VARCHAR(40) NOT NULL,
    proad         VARCHAR(30),
    versao_gerada INTEGER,
    abertura_em   TIMESTAMP,
    publicado_em  TIMESTAMP,
    created_at    TIMESTAMP DEFAULT NOW(),
    updated_at    TIMESTAMP DEFAULT NOW(),
    created_by    BIGINT,
    updated_by    BIGINT
);

CREATE INDEX IF NOT EXISTS idx_ciclo_orcamentario_ano_finalidade
    ON ciclo_orcamentario (ano, finalidade);

-- RF-74 — concorrência serializada: no máximo uma revisão NÃO publicada por ano vigente.
CREATE UNIQUE INDEX IF NOT EXISTS uq_ciclo_revisao_ativa_por_ano
    ON ciclo_orcamentario (ano)
    WHERE finalidade = 'revisao' AND estado <> 'publicado';

-- rollback DROP INDEX IF EXISTS uq_ciclo_revisao_ativa_por_ano;
-- rollback DROP INDEX IF EXISTS idx_ciclo_orcamentario_ano_finalidade;
-- rollback DROP TABLE IF EXISTS ciclo_orcamentario;
