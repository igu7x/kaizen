-- liquibase formatted sql
-- changeset kaizen:164_add_aprovacao_em_processos_negocio

-- Migration 164: Adiciona a data de aprovação em processos_negocio
--
-- CONTEXTO:
-- Ao anexar o PDF de aprovação (Modelo K1), o superadmin informa também a data da
-- aprovação, que passa a ser exibida na tela de detalhe.
--
-- SEGURANÇA (Zero Downtime): coluna DATE nullable, aditiva.

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS aprovacao_em DATE;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS aprovacao_em;
