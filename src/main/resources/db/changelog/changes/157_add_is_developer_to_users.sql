-- liquibase formatted sql
-- changeset kaizen:157_add_is_developer_to_users

-- Migration 157: Adiciona a coluna `is_developer` na tabela users

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_developer BOOLEAN DEFAULT FALSE;

-- Configura os desenvolvedores originais (emails master imutáveis)
UPDATE users SET is_developer = TRUE WHERE email IN ('ifccupertino@tjgo.jus.br', 'acandrade@tjgo.jus.br', 'sgrocha@tjgo.jus.br');

-- rollback ALTER TABLE users DROP COLUMN IF EXISTS is_developer;
