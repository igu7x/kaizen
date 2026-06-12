-- liquibase formatted sql
-- changeset kaizen:156_add_indicadores_processos_negocio

-- Migration 156: Adiciona a coluna `indicadores` em processos_negocio
--
-- CONTEXTO:
-- Novo item "INDICADORES" no Formulário de Processos (logo após "Recursos
-- Utilizados"): texto livre onde o usuário informa os indicadores usados para
-- acompanhar desempenho e resultados do processo (ex.: volume de demandas,
-- tempo de execução, produtividade, qualidade).
--
-- SEGURANÇA (Zero Downtime):
-- - Coluna TEXT nullable, aditiva. Não altera dado existente nem trava a tabela
--   de forma relevante (ADD COLUMN sem default volátil é instantâneo no Postgres).

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS indicadores TEXT;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS indicadores;
