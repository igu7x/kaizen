-- liquibase formatted sql

-- changeset kaizen:244_create_sgsi_api
-- Migration 244: 20ª fatia do módulo "Segurança da Informação" — API e Webhooks.
-- Credenciais de máquina (api_chave) com escopos granulares; do segredo guarda-se APENAS o hash — o
-- valor em claro é exibido uma única vez na criação. Webhooks de saída (só https) com segredo próprio e
-- lista de eventos; o log de entregas fica pronto para o worker de entrega (fora do escopo desta fatia).
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; usuário uuid → users(id) INTEGER.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_api_escopo (
    codigo    text PRIMARY KEY,
    descricao text NOT NULL
);

CREATE TABLE IF NOT EXISTS sgsi_api_chave (
    id             text PRIMARY KEY,
    nome           text NOT NULL,
    unidade        text,
    segredo_hash   text NOT NULL,
    exige_mtls     boolean NOT NULL DEFAULT false,
    limite_por_min int DEFAULT 120,
    expiracao      date,
    status         text NOT NULL DEFAULT 'ATIVA' CHECK (status IN ('ATIVA','SUSPENSA','REVOGADA')),
    criada_por     integer REFERENCES users(id),
    criada_em      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgsi_api_chave_escopo (
    api_chave_id  text NOT NULL REFERENCES sgsi_api_chave(id) ON DELETE CASCADE,
    escopo_codigo text NOT NULL REFERENCES sgsi_api_escopo(codigo),
    PRIMARY KEY (api_chave_id, escopo_codigo)
);

CREATE TABLE IF NOT EXISTS sgsi_webhook (
    id           bigserial PRIMARY KEY,
    nome         text NOT NULL,
    url          text NOT NULL CHECK (url LIKE 'https://%'),
    segredo_hash text NOT NULL,
    eventos      text[] NOT NULL,
    ativo        boolean NOT NULL DEFAULT true,
    criado_por   integer REFERENCES users(id),
    criado_em    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgsi_webhook_entrega (
    id          bigserial PRIMARY KEY,
    webhook_id  bigint REFERENCES sgsi_webhook(id) ON DELETE CASCADE,
    evento      text NOT NULL,
    tentativa   int  NOT NULL,
    http_status int,
    erro        text,
    criado_em   timestamptz NOT NULL DEFAULT now()
);
-- rollback DROP TABLE IF EXISTS sgsi_webhook_entrega;
-- rollback DROP TABLE IF EXISTS sgsi_webhook;
-- rollback DROP TABLE IF EXISTS sgsi_api_chave_escopo;
-- rollback DROP TABLE IF EXISTS sgsi_api_chave;
-- rollback DROP TABLE IF EXISTS sgsi_api_escopo;
