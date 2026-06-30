-- liquibase formatted sql
-- changeset kaizen:169_add_editores_processos_negocio

-- Migration 169: Editores do processo
--
-- CONTEXTO:
-- O Gestor do Escritório de Processos, o Responsável do Processo e o Revisor podem atribuir
-- "editores" — usuários específicos que ganham permissão de editar e salvar o conteúdo do
-- processo (sem iniciar revisão nem validar). Cada editor é referenciado por user_id; nome e
-- email são desnormalizados para exibição na tela de detalhe sem buscar a lista de usuários.
--
-- SEGURANÇA (Zero Downtime): coluna JSONB com default '[]', aditiva.
--   editores: array de objetos { user_id, nome, email }

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS editores JSONB DEFAULT '[]'::jsonb;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS editores;
