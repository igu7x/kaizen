-- liquibase formatted sql
-- changeset kaizen:174_add_pca_item_to_projetos

-- Migration 174: vincular um item do PCA (Plano de Contratações Anual) ao projeto quando
-- "Haverá contratação? = Sim".
--
-- CONTEXTO:
-- Na tela "Editar Projeto" > "Classificação para Gestão do Portfólio", ao marcar "Sim" em
-- "Haverá contratação?", o antigo campo livre de valor estimado é substituído por um seletor
-- do item do PCA (módulo Contratações de TIC > Orçamento > PCA, tabela `pcas`). Guarda-se aqui
-- a referência ao item escolhido. A coluna valor_estimado_contratacao permanece (legado).
--
-- SEGURANÇA (Zero Downtime): coluna nullable, aditiva.

ALTER TABLE cadastros_projetos ADD COLUMN IF NOT EXISTS pca_item_id BIGINT;

-- rollback ALTER TABLE cadastros_projetos DROP COLUMN IF EXISTS pca_item_id;
