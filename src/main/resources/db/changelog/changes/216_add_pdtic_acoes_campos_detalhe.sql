-- liquibase formatted sql

-- changeset kaizen:216_add_pdtic_acoes_campos_detalhe
-- Migration 216: campos de detalhe do PDTIC (todos opcionais).
--
-- CONTEXTO:
-- O cadastro de Ações do PDTIC ganha os campos do quadro de ações do documento
-- (NECESSIDADE IDENTIFICADA, RESULTADO, REAGENDADA, CLASSE, INDICADOR,
-- OBJETIVOS ENTICJUD e MACRODESAFIOS TJGO). Ficam só dentro do cadastro (não
-- aparecem na tabela). Todos NULLABLE — nenhum é obrigatório.
--
-- SEGURANÇA (Zero Downtime): colunas aditivas, nullable, sem default. Tabela do
-- próprio app (não compartilhada). Roda uma única vez (changeset do Liquibase).
ALTER TABLE pdtic_acoes
    ADD COLUMN IF NOT EXISTS necessidade_identificada TEXT,
    ADD COLUMN IF NOT EXISTS resultado                TEXT,
    ADD COLUMN IF NOT EXISTS reagendada               TEXT,
    ADD COLUMN IF NOT EXISTS classe                   TEXT,
    ADD COLUMN IF NOT EXISTS indicador                TEXT,
    ADD COLUMN IF NOT EXISTS objetivos_enticjud       TEXT,
    ADD COLUMN IF NOT EXISTS macrodesafios_tjgo       TEXT;
-- rollback ALTER TABLE pdtic_acoes DROP COLUMN IF EXISTS necessidade_identificada, DROP COLUMN IF EXISTS resultado, DROP COLUMN IF EXISTS reagendada, DROP COLUMN IF EXISTS classe, DROP COLUMN IF EXISTS indicador, DROP COLUMN IF EXISTS objetivos_enticjud, DROP COLUMN IF EXISTS macrodesafios_tjgo;
