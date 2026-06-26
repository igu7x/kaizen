-- liquibase formatted sql
-- changeset kaizen:165_add_aprovacao_comite_processos_negocio

-- Migration 165: Adiciona o comitê de aprovação em processos_negocio
--
-- CONTEXTO:
-- Ao anexar o PDF de aprovação (Modelo K1), o superadmin seleciona qual comitê aprovou
-- (CGTIC = Comitê Gestor de TIC, ou CGovTIC = Comitê de Governança de TIC). Exibido na
-- tela de detalhe e no "Rito de Aprovação" do PDF.
--
-- SEGURANÇA (Zero Downtime): coluna TEXT nullable, aditiva.

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS aprovacao_comite TEXT;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS aprovacao_comite;
