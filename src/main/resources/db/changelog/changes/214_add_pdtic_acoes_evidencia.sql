-- liquibase formatted sql
-- changeset kaizen:214_add_pdtic_acoes_evidencia

-- Migration 214: evidência das Ações do PDTIC.
--
-- CONTEXTO:
-- Na tela do PDTIC (módulo Estratégia), cada ação pode receber um documento de EVIDÊNCIA (PDF).
-- O Status é derivado: com evidência = "Concluído"; sem evidência = "Pendente". O anexo é
-- guardado como base64 (mesma convenção do fluxograma do POP / aprovação de processo).
--
-- SEGURANÇA (Zero Downtime): colunas aditivas; sem reescrita bloqueante.

ALTER TABLE pdtic_acoes
    ADD COLUMN IF NOT EXISTS evidencia_nome TEXT,
    ADD COLUMN IF NOT EXISTS evidencia_mime TEXT,
    ADD COLUMN IF NOT EXISTS evidencia_data TEXT;

-- rollback ALTER TABLE pdtic_acoes DROP COLUMN IF EXISTS evidencia_nome, DROP COLUMN IF EXISTS evidencia_mime, DROP COLUMN IF EXISTS evidencia_data;
