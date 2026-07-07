-- liquibase formatted sql
-- changeset kaizen:173_add_evidencia_data_entregas

-- Migration 173: guardar a Evidência (PDF) da entrega NO BANCO, não no filesystem.
--
-- CONTEXTO / BUG DE PRODUÇÃO:
-- O upload de evidência gravava o PDF em disco (uploads/projetos/evidencias/...). No pod
-- do OpenShift o filesystem é efêmero/somente-leitura, então o write falhava e o endpoint
-- retornava HTTP 500. A coluna `evidencia_filepath` fica obsoleta; a partir daqui o PDF é
-- guardado em `evidencia_data` (BYTEA), do mesmo jeito que os anexos de processos.
--
-- SEGURANÇA (Zero Downtime): coluna nullable, aditiva. Não migra registros antigos (que só
-- existiam em disco e nunca chegaram a persistir de fato no ambiente containerizado).

ALTER TABLE cadastros_projetos_entregas ADD COLUMN IF NOT EXISTS evidencia_data BYTEA;

-- rollback ALTER TABLE cadastros_projetos_entregas DROP COLUMN IF EXISTS evidencia_data;
