-- liquibase formatted sql
-- changeset kaizen:167_add_k1_gerado_em_processos_negocio

-- Migration 167: marca a primeira geração do Modelo K1
--
-- CONTEXTO:
-- Ao gerar o PRIMEIRO Modelo K1 (status validado_final + todos os comitês da apreciação
-- aprovados), a "Data da Versão" (coluna periodo) é atualizada automaticamente para a data
-- da geração. k1_gerado_em registra quando isso aconteceu e impede re-carimbar.
--
-- SEGURANÇA (Zero Downtime): coluna DATE nullable, aditiva.

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS k1_gerado_em DATE;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS k1_gerado_em;
