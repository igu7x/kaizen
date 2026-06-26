-- liquibase formatted sql
-- changeset kaizen:168_add_codigo_processos_negocio

-- Migration 168: ID do processo (nomenclatura PN_{macroArea}_{diretoria}_{seq})
--
-- CONTEXTO:
-- Gerado quando o processo se torna Modelo K1 pela primeira vez e NUNCA mais muda.
-- O número sequencial é global (ordem de geração entre todos os processos K1):
-- o 1º a virar K1 é o 001, o 2º o 002, etc. Ex.: PN_1_2_001.
--
-- SEGURANÇA (Zero Downtime): coluna TEXT nullable, aditiva.

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS codigo TEXT;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS codigo;
