-- liquibase formatted sql
-- changeset kaizen:163_add_aprovacao_processos_negocio

-- Migration 163: Adiciona o PDF de aprovação em processos_negocio
--
-- CONTEXTO:
-- O Escritório de Processos passa a distinguir "Modelo K1" de "Documento Primário".
-- Um processo vira "Modelo K1" quando tem o PDF de aprovação anexado E as 3 camadas
-- de validação concluídas (status = validado_final). O upload é feito na tela de
-- detalhe e é restrito ao superadmin.
--
-- SEGURANÇA (Zero Downtime):
-- - Colunas nullable, aditivas. ADD COLUMN sem default volátil é instantâneo no Postgres.
-- - aprovacao_data guarda o data URL base64 (mesmo padrão de fluxograma_data).

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS aprovacao_data TEXT;
ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS aprovacao_filename TEXT;
ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS aprovacao_mime TEXT;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS aprovacao_data;
-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS aprovacao_filename;
-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS aprovacao_mime;
