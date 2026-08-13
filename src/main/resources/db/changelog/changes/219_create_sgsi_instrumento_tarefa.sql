-- liquibase formatted sql

-- changeset kaizen:219_create_sgsi_instrumento_tarefa
-- Migration 219: 1ª fatia do módulo "Segurança da Informação" (SGSI) — Instrumentos
-- Normativos + Tarefas 5W2H. Porte do SGSI/TJGO (protótipo HTML do NSI) para o Kaizen.
--
-- ADAPTAÇÕES ao Kaizen (vs. schema original do colega):
--  * tabelas prefixadas com sgsi_ (namespacing no banco compartilhado);
--  * FKs de autoria/responsável apontam para users(id) INTEGER (não a tabela `usuario` uuid
--    do protótipo, que foi descartada — a identidade é a do Kaizen/Keycloak).
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas. Módulo gated a superadmin por ora.
CREATE TABLE IF NOT EXISTS sgsi_instrumento (
    codigo          text PRIMARY KEY,                       -- POSIC, IAM, PUA, ... (chave técnica imutável)
    ordem           int  NOT NULL UNIQUE,                   -- 0 = norma basilar; 1..13 = complementares
    numeral_romano  text,                                   -- I..XIII (NULL na basilar)
    sigla_oficial   text NOT NULL,                          -- PSI/TJGO, IAM/TJGO, ...
    nome_curto      text NOT NULL,
    nome_completo   text NOT NULL,
    titulo_plano    text,
    cor_hex         text,
    restrito        boolean NOT NULL DEFAULT false,
    artigos         int,
    versao          text,
    ancora          date NOT NULL DEFAULT DATE '2026-07-01',-- M0: data de publicação
    vigente_desde   date,
    criado_em       timestamptz NOT NULL DEFAULT now(),
    atualizado_em   timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgsi_tarefa (
    id                 bigserial PRIMARY KEY,
    instrumento_codigo text NOT NULL REFERENCES sgsi_instrumento(codigo) ON DELETE CASCADE,
    numero             int  NOT NULL,
    fase               text NOT NULL,                       -- F0..F8 | TRANSVERSAL
    tipo               text NOT NULL
        CHECK (tipo IN ('GOVERNANCA','NORMATIVO','LEVANTAMENTO','PROCESSO','TECNOLOGIA','CAPACITACAO','CONTRATOS')),
    oque               text NOT NULL,                       -- What
    porque             text,                                -- Why (referência normativa)
    onde               text,                                -- Where
    quem               text,                                -- Who (unidade responsável, texto livre)
    como               text,                                -- How
    custo              text,                                -- How much
    dados_levantar     text,
    inicio_m           int  NOT NULL CHECK (inicio_m >= 0), -- M+n de início
    fim_m              int  NOT NULL CHECK (fim_m >= 0),    -- M+n de término
    status             text NOT NULL DEFAULT 'NAO_INICIADA'
        CHECK (status IN ('NAO_INICIADA','EM_ANDAMENTO','CONCLUIDA','ATRASADA','BLOQUEADA')),
    percentual         numeric(5,4) NOT NULL DEFAULT 0 CHECK (percentual BETWEEN 0 AND 1),
    responsavel_id     integer REFERENCES users(id),
    atualizado_por     integer REFERENCES users(id),
    atualizado_em      timestamptz NOT NULL DEFAULT now(),
    criado_em          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sgsi_tarefa_intervalo CHECK (fim_m >= inicio_m),
    CONSTRAINT sgsi_tarefa_unica UNIQUE (instrumento_codigo, numero)
);
CREATE INDEX IF NOT EXISTS idx_sgsi_tarefa_instrumento ON sgsi_tarefa (instrumento_codigo);

CREATE TABLE IF NOT EXISTS sgsi_tarefa_historico (
    id                  bigserial PRIMARY KEY,
    tarefa_id           bigint NOT NULL REFERENCES sgsi_tarefa(id) ON DELETE CASCADE,
    status_anterior     text,
    status_novo         text NOT NULL,
    percentual_anterior numeric(5,4),
    percentual_novo     numeric(5,4) NOT NULL,
    observacao          text,
    ator_id             integer REFERENCES users(id),
    criado_em           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_tarefa_historico_tarefa ON sgsi_tarefa_historico (tarefa_id);
-- rollback DROP TABLE IF EXISTS sgsi_tarefa_historico; DROP TABLE IF EXISTS sgsi_tarefa; DROP TABLE IF EXISTS sgsi_instrumento;
