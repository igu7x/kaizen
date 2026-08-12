-- liquibase formatted sql

-- changeset kaizen:218_create_permissoes_processos_ti
-- Migration 218: permissão nomeada "Processos (Tecnologia da Informação)".
--
-- CONTEXTO:
-- Espelha permissoes_tap. Usuários listados aqui podem EDITAR e SALVAR os
-- processos do Escritório de Processos do grupo 'ti' (Tecnologia da Informação)
-- que estejam NOVOS ou EM REVISÃO (status != 'validado_final'). Não afeta o
-- grupo 'apoio_judiciario'. Concedida via Cadastros > Permissões dos Processos (TI).
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva; FKs para users com ON DELETE
-- CASCADE/SET NULL. Roda uma única vez (changeset do Liquibase).
CREATE TABLE IF NOT EXISTS permissoes_processos_ti (
    user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    granted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
    granted_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_permissoes_processos_ti_granted_by
    ON permissoes_processos_ti (granted_by);
-- rollback DROP TABLE IF EXISTS permissoes_processos_ti;
