-- liquibase formatted sql
-- changeset kaizen:203 splitStatements:false

-- Migration 203: Trocar os valores entre start_date e effective_date
-- Utilizando COALESCE na atribuição do start_date para evitar violação de constraint NOT NULL,
-- conforme aprovação do usuário de usar a própria data original de start_date como fallback.

DO $$
BEGIN
    UPDATE contracts
    SET
        start_date = COALESCE(effective_date, start_date),
        effective_date = start_date;
END $$;

-- rollback DO $$
-- rollback BEGIN
-- rollback     UPDATE contracts
-- rollback     SET
-- rollback         start_date = COALESCE(effective_date, start_date),
-- rollback         effective_date = start_date;
-- rollback END $$;
