-- liquibase formatted sql

-- changeset kaizen:228_create_sgsi_risco
-- Migration 228: 6ª fatia do módulo "Segurança da Informação" — Registro de Riscos.
-- Risco com probabilidade/severidade/relevância (1..5) e seus residuais; o IRS (Índice de Risco
-- de Segurança) é calculado = prob × sev × relevância (RN-30). Plano de ação 1:1 opcional.
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; FKs → sgsi_instrumento/users. Sem seed
-- (o registro de riscos é preenchido pelo NSI — vazio na origem).
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_risco (
    id                     bigserial PRIMARY KEY,
    instrumento_codigo     text REFERENCES sgsi_instrumento(codigo),
    titulo                 text NOT NULL,
    ativo_informacao       text,
    ameaca                 text,
    vulnerabilidade        text,
    dono                   text,                       -- risk owner (texto livre)
    dono_id                integer REFERENCES users(id),
    probabilidade          int NOT NULL CHECK (probabilidade BETWEEN 1 AND 5),
    severidade             int NOT NULL CHECK (severidade BETWEEN 1 AND 5),
    relevancia             int NOT NULL CHECK (relevancia BETWEEN 1 AND 5),
    probabilidade_residual int CHECK (probabilidade_residual BETWEEN 1 AND 5),
    severidade_residual    int CHECK (severidade_residual BETWEEN 1 AND 5),
    controles              text,
    status                 text NOT NULL DEFAULT 'IDENTIFICADO'
        CHECK (status IN ('IDENTIFICADO','EM_ANALISE','EM_TRATAMENTO','MITIGADO','ACEITO')),
    criado_por             integer REFERENCES users(id),
    criado_em              timestamptz NOT NULL DEFAULT now(),
    atualizado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_risco_instrumento ON sgsi_risco (instrumento_codigo);

CREATE TABLE IF NOT EXISTS sgsi_risco_plano_acao (
    risco_id      bigint PRIMARY KEY REFERENCES sgsi_risco(id) ON DELETE CASCADE,
    descricao     text NOT NULL,
    responsavel   text,
    prazo         date,
    status        text NOT NULL DEFAULT 'NAO_INICIADO'
        CHECK (status IN ('NAO_INICIADO','EM_ANDAMENTO','CONCLUIDO')),
    atualizado_em timestamptz NOT NULL DEFAULT now()
);
-- rollback DROP TABLE IF EXISTS sgsi_risco_plano_acao; DROP TABLE IF EXISTS sgsi_risco;
