-- liquibase formatted sql
-- changeset kaizen:252_alter_contract_plans_object_name_type
-- Objeto do Planejamento da Contratacao truncando em 50 caracteres.
--
-- A migration 155 criou object_name como VARCHAR(50) nas DUAS tabelas. Em pcas isso foi corrigido
-- para TEXT na 159, mas contract_plans ficou para tras — o frontend nao tem maxLength e a entidade
-- JPA declara columnDefinition = "TEXT", so que ddl-auto = none, entao quem manda e o schema do
-- Liquibase. Resultado: texto acima de 50 caracteres era recusado pelo Postgres na gravacao.
ALTER TABLE contract_plans
ALTER COLUMN object_name TYPE TEXT;
-- rollback ALTER TABLE contract_plans ALTER COLUMN object_name TYPE VARCHAR(50);
