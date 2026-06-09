-- liquibase formatted sql
-- changeset kaizen:153 splitStatements:false

-- Migration 153: Drop obsolete foreign keys to the directorates table
--
-- CONTEXTO:
-- O frontend foi atualizado para carregar dinamicamente as diretorias da tabela `cadastros_areas`,
-- permitindo novas áreas (como GEJUT). Porém, a tabela `objectives` (e outras do módulo OKR)
-- ainda possuía uma foreign key (`objectives_directorate_code_fkey`) apontando para a tabela 
-- estática e obsoleta `directorates`. 
-- Isso causava erro de restrição (violates foreign key constraint) ao tentar salvar/editar 
-- OKRs para siglas recém-criadas.
-- 
-- Esta migration remove as restrições de foreign key das tabelas para o campo `directorate_code`.


DO $$
BEGIN
    ALTER TABLE IF EXISTS objectives DROP CONSTRAINT IF EXISTS objectives_directorate_code_fkey;
    ALTER TABLE IF EXISTS key_results DROP CONSTRAINT IF EXISTS key_results_directorate_code_fkey;
    ALTER TABLE IF EXISTS initiatives DROP CONSTRAINT IF EXISTS initiatives_directorate_code_fkey;
    ALTER TABLE IF EXISTS programs DROP CONSTRAINT IF EXISTS programs_directorate_code_fkey;
    ALTER TABLE IF EXISTS execution_controls DROP CONSTRAINT IF EXISTS execution_controls_directorate_code_fkey;
    ALTER TABLE IF EXISTS forms DROP CONSTRAINT IF EXISTS forms_directorate_code_fkey;
    ALTER TABLE IF EXISTS users DROP CONSTRAINT IF EXISTS users_directorate_code_fkey;
END $$;


