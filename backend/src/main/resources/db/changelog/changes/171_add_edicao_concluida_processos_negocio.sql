-- liquibase formatted sql
-- changeset kaizen:171_add_edicao_concluida_processos_negocio

-- Migration 171: sinal "Edição concluída" do Editor atribuído.
--
-- CONTEXTO:
-- Quando um Editor é atribuído ao processo, ele preenche o conteúdo dia a dia (status
-- em_elaboracao / recusado) e, ao terminar a versão completa, aciona "Concluir edição".
-- Só a partir daí o Responsável pode validar a camada 1. Enquanto houver editor atribuído
-- e a edição não estiver concluída, o Responsável fica bloqueado de validar.
-- edicao_concluida_em NULO = pendente (edição em andamento).
--
-- SEGURANÇA (Zero Downtime): colunas nullable, aditivas.

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS edicao_concluida_em TIMESTAMP;
ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS edicao_concluida_por_user_id INTEGER;
ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS edicao_concluida_por_nome VARCHAR(255);

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS edicao_concluida_em;
-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS edicao_concluida_por_user_id;
-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS edicao_concluida_por_nome;
