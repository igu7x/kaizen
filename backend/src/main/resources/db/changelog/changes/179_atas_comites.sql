-- liquibase formatted sql
-- changeset kaizen:179_atas_comites

-- Migration 179: juntada das atas dos comitês (CGTIC/CGOVTIC) — RN-GERAL-04.
--
-- CONTEXTO:
-- Comitês e DG são externos ao Kaizen: deliberam no PROAD. O Kaizen apenas REFLETE esses atos pela
-- juntada das atas (ato do Editor SGJT). A Especificação v2 trata a ata como inclusão/anexo de
-- arquivo e não define metadados estruturados — modelamos um registro mínimo (comitê, número, data,
-- decisão, anexo) suficiente para exibir a juntada, sem inventar regra de negócio ausente na spec.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva. Domínio de `comite` validado no backend.

CREATE TABLE IF NOT EXISTS atas_comites (
    id          BIGSERIAL PRIMARY KEY,
    ciclo_id    BIGINT REFERENCES ciclo_orcamentario (id),
    comite      VARCHAR(20) NOT NULL,   -- cgtic | cgovtic
    numero      VARCHAR(50),
    data_ata    DATE,
    decisao     TEXT,
    anexo_url   TEXT,
    created_by  BIGINT,
    created_at  TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_atas_comites_ciclo ON atas_comites (ciclo_id);

-- rollback DROP INDEX IF EXISTS idx_atas_comites_ciclo;
-- rollback DROP TABLE IF EXISTS atas_comites;
