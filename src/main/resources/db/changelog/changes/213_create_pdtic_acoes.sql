-- liquibase formatted sql
-- changeset kaizen:213_create_pdtic_acoes

-- Migration 213: cadastro das Ações do PDTIC (Plano Diretor de TIC).
--
-- CONTEXTO:
-- Cadastro simples, feito na tela de Cadastros, que alimenta a nova tela do PDTIC (módulo
-- Estratégia). Cada ação tem: nome, o ID do PDTIC (ex.: AC01), a diretoria e a área
-- responsável, e a data de conclusão prevista (usada para o Prazo/Status na tela do PDTIC).
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva; sem impacto em tabelas existentes.

CREATE TABLE IF NOT EXISTS pdtic_acoes (
    id                BIGSERIAL PRIMARY KEY,
    nome              TEXT NOT NULL,
    id_pdtic          TEXT,
    diretoria         TEXT,
    area_responsavel  TEXT,
    conclusao         TEXT,          -- data de conclusão prevista (YYYY-MM-DD)
    is_deleted        BOOLEAN     DEFAULT FALSE,
    created_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pdtic_acoes_ativos ON pdtic_acoes (is_deleted, created_at);

-- rollback DROP TABLE IF EXISTS pdtic_acoes;
