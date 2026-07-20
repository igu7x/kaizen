-- liquibase formatted sql
-- changeset kaizen:176_add_motivo_reclassificacao_to_ifo

-- Migration 176: motivo de reclassificação do IFO (RF-07)
--
-- CONTEXTO:
-- No bloco Renovação, "Interesse na renovação = Não" reclassifica automaticamente o item para
-- Encerramento, registrando o motivo em metadado (RF-07). Esta coluna guarda esse motivo.
--
-- SEGURANÇA (Zero Downtime): coluna aditiva e nullable.

ALTER TABLE ifo ADD COLUMN IF NOT EXISTS motivo_reclassificacao VARCHAR(255);

-- rollback ALTER TABLE ifo DROP COLUMN IF EXISTS motivo_reclassificacao;
