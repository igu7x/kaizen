-- liquibase formatted sql
-- changeset kaizen:172_add_cargo_governanca_projetos

-- Migration 172: Cargo do Patrocinador e do Gestor na Governança do projeto.
--
-- CONTEXTO:
-- Na tela "Editar Projeto" > "Governança e Responsáveis", além do nome do Patrocinador
-- e do Gestor, passa a existir um campo livre "Cargo". Quando preenchido, esse cargo
-- SUBSTITUI o nome do responsável na coluna "Responsável" do TAP (Termo de Abertura).
-- Campos livres (texto), independentes do vínculo com cadastros_pessoas.
--
-- SEGURANÇA (Zero Downtime): colunas nullable, aditivas.

ALTER TABLE cadastros_projetos ADD COLUMN IF NOT EXISTS patrocinador_cargo TEXT;
ALTER TABLE cadastros_projetos ADD COLUMN IF NOT EXISTS gestor_cargo TEXT;

-- rollback ALTER TABLE cadastros_projetos DROP COLUMN IF EXISTS patrocinador_cargo;
-- rollback ALTER TABLE cadastros_projetos DROP COLUMN IF EXISTS gestor_cargo;
