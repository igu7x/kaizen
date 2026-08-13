-- liquibase formatted sql

-- changeset kaizen:239_create_sgsi_documento_workflow
-- Migration 239: 15ª fatia do módulo "Segurança da Informação" — Elaboração e Assinatura de Documentos.
-- Estende as Obrigações Documentais (fatia 2, que já criou sgsi_documento com checkout_id/checkout_em e
-- o ciclo de status). Aqui entram o VERSIONAMENTO (RN-16: cada gravação de conteúdo vira uma versão
-- imutável) e a ASSINATURA (RN-18: hash do conteúdo da versão vigente; uma assinatura por usuário/versão;
-- a 1ª assinatura leva o documento a EM_ASSINATURA, travando o conteúdo).
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; FKs de autoria/assinante → users(id) INTEGER.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_documento_versao (
    id           bigserial PRIMARY KEY,
    documento_id bigint  NOT NULL REFERENCES sgsi_documento(id) ON DELETE CASCADE,
    numero       int     NOT NULL,
    conteudo     text    NOT NULL,
    caracteres   int     NOT NULL,
    autor_id     integer REFERENCES users(id),
    criado_em    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (documento_id, numero)
);
CREATE INDEX IF NOT EXISTS idx_sgsi_doc_versao ON sgsi_documento_versao (documento_id, numero DESC);

CREATE TABLE IF NOT EXISTS sgsi_documento_assinatura (
    id            bigserial PRIMARY KEY,
    documento_id  bigint  NOT NULL REFERENCES sgsi_documento(id) ON DELETE CASCADE,
    usuario_id    integer REFERENCES users(id),
    nome          text    NOT NULL,           -- nome do signatário no momento da assinatura
    login         text    NOT NULL,
    versao_numero int,                        -- versão assinada
    hash_sha256   text    NOT NULL,           -- hash do conteúdo assinado
    criado_em     timestamptz NOT NULL DEFAULT now(),
    UNIQUE (documento_id, usuario_id, versao_numero)
);
CREATE INDEX IF NOT EXISTS idx_sgsi_doc_assinatura ON sgsi_documento_assinatura (documento_id);
-- rollback DROP TABLE IF EXISTS sgsi_documento_assinatura;
-- rollback DROP TABLE IF EXISTS sgsi_documento_versao;
