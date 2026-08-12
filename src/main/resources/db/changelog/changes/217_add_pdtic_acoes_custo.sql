-- liquibase formatted sql

-- changeset kaizen:217_add_pdtic_acoes_custo
-- Migration 217: ação do PDTIC pode ter custo.
--
-- CONTEXTO:
-- No cadastro de Ações do PDTIC ganha o toggle "Ação com custo?"; marcando, o
-- usuário informa o valor num campo de texto livre (ex.: "R$ 2.000.000,00").
--
-- SEGURANÇA (Zero Downtime): colunas aditivas. com_custo com default FALSE;
-- custo nullable. Tabela do próprio app. Roda uma única vez (changeset Liquibase).
ALTER TABLE pdtic_acoes
    ADD COLUMN IF NOT EXISTS com_custo BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS custo     TEXT;
-- rollback ALTER TABLE pdtic_acoes DROP COLUMN IF EXISTS com_custo, DROP COLUMN IF EXISTS custo;
