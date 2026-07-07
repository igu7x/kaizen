-- liquibase formatted sql
-- changeset kaizen:177_fix_permissoes_acoes_unidade_fk

-- Migration 177: Corrigir chave estrangeira de unidade_id na tabela permissoes_acoes
--
-- CONTEXTO:
-- A constraint 'chk_permissoes_acoes_unidade' estava apontando erroneamente para 'cadastros_areas(id)'.
-- O correto é apontar para 'cadastros_unidades(id)'.

ALTER TABLE permissoes_acoes DROP CONSTRAINT IF EXISTS chk_permissoes_acoes_unidade;
ALTER TABLE permissoes_acoes ADD CONSTRAINT fk_permissoes_acoes_unidade FOREIGN KEY (unidade_id) REFERENCES cadastros_unidades(id) ON DELETE CASCADE;

-- rollback ALTER TABLE permissoes_acoes DROP CONSTRAINT IF EXISTS fk_permissoes_acoes_unidade;
-- rollback ALTER TABLE permissoes_acoes ADD CONSTRAINT chk_permissoes_acoes_unidade FOREIGN KEY (unidade_id) REFERENCES cadastros_areas(id) ON DELETE CASCADE;
