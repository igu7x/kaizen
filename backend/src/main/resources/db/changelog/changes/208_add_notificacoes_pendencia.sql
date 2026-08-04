-- liquibase formatted sql
-- changeset kaizen:208_add_notificacoes_pendencia

-- Migration 208: log de idempotência das notificações de pendência por e-mail.
--
-- CONTEXTO:
-- A cada ação que gera uma pendência (recusa, passagem de camada, edição concluída…) o Kaizen
-- envia um e-mail ao responsável pela próxima ação. Esta tabela evita e-mail duplicado: a
-- `assinatura` = "<tipo>:<entidade_id>:<versao>", onde `versao` é o timestamp da transição que
-- criou a pendência. Assim:
--   - re-disparos do mesmo evento (retry, múltiplos pods) => mesma assinatura => não reenvia;
--   - um evento genuinamente novo (ex.: processo recusado de novo, com novo recusado_em) => nova
--     assinatura => notifica outra vez.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva; nenhuma escrita bloqueante em tabelas existentes.

CREATE TABLE IF NOT EXISTS notificacoes_pendencia (
    id                  BIGSERIAL PRIMARY KEY,
    user_id             BIGINT      NOT NULL,
    tipo                TEXT        NOT NULL,
    entidade_id         BIGINT,
    assinatura          TEXT        NOT NULL,
    assunto             TEXT,
    destinatario_email  TEXT,
    enviada_em          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_notificacoes_pendencia UNIQUE (user_id, assinatura)
);

CREATE INDEX IF NOT EXISTS ix_notificacoes_pendencia_user ON notificacoes_pendencia (user_id);

-- rollback DROP TABLE IF EXISTS notificacoes_pendencia;
