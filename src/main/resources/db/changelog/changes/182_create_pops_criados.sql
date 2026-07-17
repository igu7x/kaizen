--liquibase formatted sql

--changeset kaizen:182_create_pops_criados
-- Migration 182: POPs (Procedimento Operacional Padrão) criados dentro do Kaizen.
--
-- Sustenta o recurso "Criar POP" do Escritório de Processos (filtro POP). Cada linha guarda
-- os campos do modelo institucional de POP (SGQ) usados para gerar o PDF padronizado e para
-- listar na tabela "POPs Criados no Kaizen". Listas (siglas, normativa, sistemas, anexos) são
-- armazenadas como texto com um item por linha.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.

CREATE TABLE IF NOT EXISTS pops_criados (
    id                     BIGSERIAL PRIMARY KEY,
    codigo                 VARCHAR(60),
    nome_processo          TEXT,
    macroprocesso          VARCHAR(160),
    diretoria_orgao        TEXT,
    unidade_orgao          TEXT,
    area                   VARCHAR(120),
    data_versao            TEXT,
    revisao                VARCHAR(20),
    servico                TEXT,
    objetivo               TEXT,
    unidade_responsavel    TEXT,
    siglas                 TEXT,
    normativa              TEXT,
    descricao_procedimento TEXT,
    gestor_processo        TEXT,
    sistemas_utilizados    TEXT,
    anexos                 TEXT,
    proposto_por           TEXT,
    analisado_por          TEXT,
    aprovado_por           TEXT,
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted             BOOLEAN   DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_pops_criados_ativos ON pops_criados (is_deleted, created_at);

--rollback DROP TABLE pops_criados;
