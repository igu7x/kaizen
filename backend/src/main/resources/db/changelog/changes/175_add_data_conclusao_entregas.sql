-- liquibase formatted sql
-- changeset kaizen:175_add_data_conclusao_entregas

-- Migration 175: Data de Conclusão da entrega.
--
-- CONTEXTO:
-- Na tabela de Entregas (Escritório de Projetos), concluir uma entrega passa a exigir o anexo
-- da evidência de conclusão. Ao anexar, o status vira "Concluída" e a data de conclusão é
-- carimbada (CURRENT_DATE). Ao voltar para outro status, a data é limpa.
--
-- SEGURANÇA (Zero Downtime): coluna nullable, aditiva.

ALTER TABLE cadastros_projetos_entregas ADD COLUMN IF NOT EXISTS data_conclusao DATE;

-- rollback ALTER TABLE cadastros_projetos_entregas DROP COLUMN IF EXISTS data_conclusao;
