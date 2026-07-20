--liquibase formatted sql

--changeset kaizen:199_add_fluxograma_pops_criados
-- Migration 199: imagem do fluxograma anexada ao POP criado no Kaizen.
--
-- A seção 9 (Anexos) do modelo institucional de POP referencia o fluxograma do processo.
-- Além da lista textual de anexos, passa a ser possível subir a imagem do fluxograma, que é
-- renderizada em uma página "ANEXO" no PDF gerado. A imagem é guardada como data URL base64
-- em fluxograma_data, seguindo a mesma convenção dos certificados do PAC (migration 181).
--
-- SEGURANÇA (Zero Downtime): colunas novas e nuláveis, aditivas.

ALTER TABLE pops_criados ADD COLUMN IF NOT EXISTS fluxograma_nome TEXT;
ALTER TABLE pops_criados ADD COLUMN IF NOT EXISTS fluxograma_data TEXT;

--rollback ALTER TABLE pops_criados DROP COLUMN fluxograma_nome;
--rollback ALTER TABLE pops_criados DROP COLUMN fluxograma_data;
