-- liquibase formatted sql
-- changeset kaizen:175_add_codigo_oficial_to_ifo

-- Migration 175: código oficial do IFO na publicação (RF-41/49/75)
--
-- CONTEXTO:
-- O IFO é a identidade PROVISÓRIA (IFO-{ano}-{NNNN}) durante o ciclo. Na publicação pela DG, cada
-- IFO é convertido 1:1 em código oficial de Item de PCA (RF-49). Esta coluna persiste esse
-- mapeamento estável (RNF-04/06). A materialização do IFO como linha completa de `pcas` é evolução.
--
-- SEGURANÇA (Zero Downtime): coluna aditiva e nullable.

ALTER TABLE ifo ADD COLUMN IF NOT EXISTS codigo_oficial VARCHAR(20);

-- rollback ALTER TABLE ifo DROP COLUMN IF EXISTS codigo_oficial;
