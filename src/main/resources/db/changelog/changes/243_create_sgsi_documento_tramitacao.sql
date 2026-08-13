-- liquibase formatted sql

-- changeset kaizen:243_create_sgsi_documento_tramitacao
-- Migration 243: 19ª fatia do módulo "Segurança da Informação" — Tramitação e Colaboradores.
-- Completa o ciclo do documento (fatia 15). RN-17: tramitar exige documento não travado; grava o
-- despacho, transfere o TITULAR (quem responde pelo documento naquele momento) e libera o checkout.
-- O COLABORADOR é distinto do titular: tem direito permanente de edição. A coluna titular_id já existe
-- em sgsi_documento (migration 222).
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; usuário uuid → users(id) INTEGER.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_documento_colaborador (
    documento_id bigint  NOT NULL REFERENCES sgsi_documento(id) ON DELETE CASCADE,
    usuario_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    incluido_em  timestamptz NOT NULL DEFAULT now(),
    incluido_por integer REFERENCES users(id),
    PRIMARY KEY (documento_id, usuario_id)
);

CREATE TABLE IF NOT EXISTS sgsi_documento_tramitacao (
    id              bigserial PRIMARY KEY,
    documento_id    bigint  NOT NULL REFERENCES sgsi_documento(id) ON DELETE CASCADE,
    de_usuario_id   integer REFERENCES users(id),
    para_usuario_id integer NOT NULL REFERENCES users(id),
    despacho        text,
    criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_doc_tramitacao ON sgsi_documento_tramitacao (documento_id, criado_em DESC);
-- rollback DROP TABLE IF EXISTS sgsi_documento_tramitacao;
-- rollback DROP TABLE IF EXISTS sgsi_documento_colaborador;
