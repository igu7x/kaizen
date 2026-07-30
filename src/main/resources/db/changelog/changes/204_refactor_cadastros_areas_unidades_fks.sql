-- liquibase formatted sql
-- changeset kaizen:204_refactor_cadastros_areas_unidades_fks

-- 1. CONTRACTS
ALTER TABLE contracts RENAME COLUMN cadastro_area_id TO cadastros_areas_id;
ALTER TABLE contracts RENAME COLUMN cadastro_unidade_id TO cadastros_unidades_id;
ALTER TABLE contracts DROP COLUMN IF EXISTS directory;
ALTER TABLE contracts DROP COLUMN IF EXISTS unidade;

-- 2. PCAS
ALTER TABLE pcas RENAME COLUMN id_cadastros_areas TO cadastros_areas_id;
ALTER TABLE pcas ADD COLUMN IF NOT EXISTS cadastros_unidades_id BIGINT;
UPDATE pcas SET cadastros_unidades_id = id_area_demandante WHERE cadastros_unidades_id IS NULL AND id_area_demandante IS NOT NULL;
ALTER TABLE pcas DROP COLUMN IF EXISTS directory_acronym;
ALTER TABLE pcas DROP COLUMN IF EXISTS id_diretoria;
ALTER TABLE pcas DROP COLUMN IF EXISTS id_area_demandante;

-- 3. PCAS_SNAPSHOTS
ALTER TABLE pcas_snapshots RENAME COLUMN id_cadastros_areas TO cadastros_areas_id;
ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS cadastros_unidades_id BIGINT;
UPDATE pcas_snapshots SET cadastros_unidades_id = id_area_demandante WHERE cadastros_unidades_id IS NULL AND id_area_demandante IS NOT NULL;
ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS directory_acronym;
ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS id_diretoria;
ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS id_area_demandante;

-- 4. CONTRACT_PLANS
ALTER TABLE contract_plans DROP COLUMN IF EXISTS area_acronym;

-- 5. IFO
ALTER TABLE ifo RENAME COLUMN id_cadastros_areas TO cadastros_areas_id;
ALTER TABLE ifo RENAME COLUMN unidade_id TO cadastros_unidades_id;
ALTER TABLE ifo DROP COLUMN IF EXISTS area_id;
ALTER TABLE ifo DROP COLUMN IF EXISTS area_demandante;

-- rollback ALTER TABLE ifo ADD COLUMN IF NOT EXISTS area_demandante VARCHAR(255);
-- rollback ALTER TABLE ifo ADD COLUMN IF NOT EXISTS area_id BIGINT;
-- rollback ALTER TABLE ifo RENAME COLUMN cadastros_unidades_id TO unidade_id;
-- rollback ALTER TABLE ifo RENAME COLUMN cadastros_areas_id TO id_cadastros_areas;
-- rollback ALTER TABLE contract_plans ADD COLUMN IF NOT EXISTS area_acronym VARCHAR(20);
-- rollback ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS id_area_demandante BIGINT;
-- rollback ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS id_diretoria BIGINT;
-- rollback ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS directory_acronym VARCHAR(20);
-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS cadastros_unidades_id;
-- rollback ALTER TABLE pcas_snapshots RENAME COLUMN cadastros_areas_id TO id_cadastros_areas;
-- rollback ALTER TABLE pcas ADD COLUMN IF NOT EXISTS id_area_demandante BIGINT;
-- rollback ALTER TABLE pcas ADD COLUMN IF NOT EXISTS id_diretoria BIGINT;
-- rollback ALTER TABLE pcas ADD COLUMN IF NOT EXISTS directory_acronym VARCHAR(20);
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS cadastros_unidades_id;
-- rollback ALTER TABLE pcas RENAME COLUMN cadastros_areas_id TO id_cadastros_areas;
-- rollback ALTER TABLE contracts ADD COLUMN IF NOT EXISTS unidade VARCHAR(255);
-- rollback ALTER TABLE contracts ADD COLUMN IF NOT EXISTS directory VARCHAR(255);
-- rollback ALTER TABLE contracts RENAME COLUMN cadastros_unidades_id TO cadastro_unidade_id;
-- rollback ALTER TABLE contracts RENAME COLUMN cadastros_areas_id TO cadastro_area_id;
