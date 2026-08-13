-- liquibase formatted sql

-- changeset kaizen:226_create_sgsi_framework
-- Migration 226: 5ª fatia do módulo "Segurança da Informação" — Frameworks de governança.
-- 6 frameworks (CIS, NIST, ISO 27001/27002, COBIT, LGPD) com seus itens; cada item pode estar
-- vinculado a um ou mais instrumentos normativos e receber uma avaliação de conformidade.
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; FKs → sgsi_*; documento_id → sgsi_documento;
-- avaliado_por → users(id) INTEGER.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_framework (
    codigo    text PRIMARY KEY,                 -- CIS, NIST, ISO27001, ISO27002, COBIT, LGPD
    nome      text NOT NULL,
    descricao text,
    ordem     int  NOT NULL
);

CREATE TABLE IF NOT EXISTS sgsi_framework_item (
    id               bigserial PRIMARY KEY,
    framework_codigo text NOT NULL REFERENCES sgsi_framework(codigo) ON DELETE CASCADE,
    item_id          text NOT NULL,             -- 'CIS 1', 'ISO 5.1', 'GV.OC' ...
    nome             text NOT NULL,
    ordem            int  NOT NULL,
    UNIQUE (framework_codigo, item_id)
);

CREATE TABLE IF NOT EXISTS sgsi_framework_item_instrumento (
    framework_item_id  bigint NOT NULL REFERENCES sgsi_framework_item(id) ON DELETE CASCADE,
    instrumento_codigo text   NOT NULL REFERENCES sgsi_instrumento(codigo) ON DELETE CASCADE,
    PRIMARY KEY (framework_item_id, instrumento_codigo)
);

CREATE TABLE IF NOT EXISTS sgsi_framework_avaliacao (
    framework_item_id bigint PRIMARY KEY REFERENCES sgsi_framework_item(id) ON DELETE CASCADE,
    status            text NOT NULL DEFAULT 'NAO_AVALIADO'
        CHECK (status IN ('NAO_AVALIADO','CONFORME','PARCIALMENTE_CONFORME','NAO_CONFORME','NAO_APLICAVEL')),
    observacao        text,
    documento_id      bigint REFERENCES sgsi_documento(id) ON DELETE SET NULL,
    avaliado_por      integer REFERENCES users(id),
    avaliado_em       timestamptz NOT NULL DEFAULT now()
);
-- rollback DROP TABLE IF EXISTS sgsi_framework_avaliacao; DROP TABLE IF EXISTS sgsi_framework_item_instrumento; DROP TABLE IF EXISTS sgsi_framework_item; DROP TABLE IF EXISTS sgsi_framework;
