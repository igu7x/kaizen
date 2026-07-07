-- liquibase formatted sql
-- changeset kaizen:176_add_sigla_unidades

-- Migration 176: Adicionar sigla em cadastros_unidades.
--
-- CONTEXTO:
-- Adicionar o campo de sigla para as unidades, assim como já é no de cadastros_areas.

ALTER TABLE cadastros_unidades ADD COLUMN IF NOT EXISTS sigla VARCHAR(255);

-- rollback ALTER TABLE cadastros_unidades DROP COLUMN IF EXISTS sigla;
