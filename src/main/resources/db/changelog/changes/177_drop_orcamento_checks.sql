-- liquibase formatted sql
-- changeset kaizen:177_drop_orcamento_checks

-- Migration 177: remove os CHECK de domínio das migrations 170/171/172 (correção de rota jul/2026)
--
-- CONTEXTO:
-- Decisão de arquitetura da equipe TJGO: as validações de domínio saem dos CHECK do banco e passam
-- para o backend (Services). As migrations 170/171/172 já foram enviadas ao repositório remoto e
-- aplicadas em ambientes (local/staging) — por isso NÃO são alteradas no lugar (evita quebra de
-- checksum no boot do Liquibase). Este changeset forward-only dropa os CHECK criados por elas:
--   170 → chk_contracts_situation (situation)                → validado em ContractService
--   171 → finalidade / subtipo (ciclo_orcamentario)          → validado em CicloOrcamentarioService
--   172 → bloco / natureza / estado (ifo)                    → validado em IfoService
--
-- Os nomes dos CHECK inline seguem o padrão do PostgreSQL: {tabela}_{coluna}_check.
--
-- SEGURANÇA (Zero Downtime): apenas remove constraints (DROP IF EXISTS, idempotente). Sem perda de
-- dados. Aplica-se para frente em qualquer ambiente, sem rollback/cirurgia manual no banco.

-- 170 — contracts.situation (constraint nomeada)
ALTER TABLE contracts DROP CONSTRAINT IF EXISTS chk_contracts_situation;

-- 171 — ciclo_orcamentario.finalidade / subtipo
ALTER TABLE ciclo_orcamentario DROP CONSTRAINT IF EXISTS ciclo_orcamentario_finalidade_check;
ALTER TABLE ciclo_orcamentario DROP CONSTRAINT IF EXISTS ciclo_orcamentario_subtipo_check;

-- 172 — ifo.bloco / natureza / estado
ALTER TABLE ifo DROP CONSTRAINT IF EXISTS ifo_bloco_check;
ALTER TABLE ifo DROP CONSTRAINT IF EXISTS ifo_natureza_check;
ALTER TABLE ifo DROP CONSTRAINT IF EXISTS ifo_estado_check;

-- rollback ALTER TABLE contracts ADD CONSTRAINT chk_contracts_situation CHECK (situation IS NULL OR situation IN ('continuada', 'pontual'));
-- rollback ALTER TABLE ciclo_orcamentario ADD CONSTRAINT ciclo_orcamentario_finalidade_check CHECK (finalidade IN ('formacao', 'revisao'));
-- rollback ALTER TABLE ciclo_orcamentario ADD CONSTRAINT ciclo_orcamentario_subtipo_check CHECK (subtipo IS NULL OR subtipo IN ('ordinaria', 'extraordinaria'));
-- rollback ALTER TABLE ifo ADD CONSTRAINT ifo_bloco_check CHECK (bloco IN ('encerramento', 'renovacao', 'plurianual', 'nova_contratacao'));
-- rollback ALTER TABLE ifo ADD CONSTRAINT ifo_natureza_check CHECK (natureza IS NULL OR natureza IN ('continuada', 'pontual'));
-- rollback ALTER TABLE ifo ADD CONSTRAINT ifo_estado_check CHECK (estado IN ('rascunho', 'enviado_cca', 'consolidado', 'publicado'));
