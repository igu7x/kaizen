-- liquibase formatted sql
-- changeset kaizen:173_add_origem_to_pcas

-- Migration 173: rastreabilidade do item PCA-TIC ao ciclo de origem e ao PROAD (RF-55)
--
-- CONTEXTO:
-- Cada item oficial do PCA-TIC nasce da publicação de um ciclo (Formação ou Revisão). Para
-- rastreabilidade (RF-55), o item passa a carregar o ciclo de origem, o PROAD de instrução e a
-- finalidade. As colunas são preenchidas na publicação (CicloOrcamentarioService.publicar →
-- PcaService.stampOrigem) e copiadas para o snapshot imutável (createSnapshot).
--
-- SEGURANÇA (Zero Downtime): colunas aditivas e nullable.

ALTER TABLE pcas ADD COLUMN IF NOT EXISTS origem_ciclo_id BIGINT;
ALTER TABLE pcas ADD COLUMN IF NOT EXISTS origem_proad VARCHAR(30);
ALTER TABLE pcas ADD COLUMN IF NOT EXISTS origem_finalidade VARCHAR(20);

ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS origem_ciclo_id BIGINT;
ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS origem_proad VARCHAR(30);
ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS origem_finalidade VARCHAR(20);

-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS origem_finalidade;
-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS origem_proad;
-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS origem_ciclo_id;
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS origem_finalidade;
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS origem_proad;
-- rollback ALTER TABLE pcas DROP COLUMN IF EXISTS origem_ciclo_id;
