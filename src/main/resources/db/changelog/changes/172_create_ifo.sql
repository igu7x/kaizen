-- liquibase formatted sql
-- changeset kaizen:172_create_ifo

-- Migration 172: IFO (Item de Formação do Orçamento) — Orçamento de TIC, Cap. 1
--
-- CONTEXTO:
-- O IFO é a identidade PROVISÓRIA de um item durante a Formação (código IFO-{ano}-{NNNN}). Funciona
-- como banda-envelope: agrupa 1:N contratos de natureza continuada da DFD-Consulta (RF-10/11) sob um
-- objeto/área demandante, e é enviado à CCA (RF-24/26). Na publicação pela DG o IFO vira o código
-- oficial de Item de PCA (atributo `code` de `pcas`, RF-49) — conversão a evoluir.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas. Os domínios de `bloco`, `natureza` e
-- `estado` são validados no backend (IfoService), NÃO por CHECK no banco (decisão jul/2026).

CREATE TABLE IF NOT EXISTS ifo (
    id               BIGSERIAL PRIMARY KEY,
    codigo           VARCHAR(20) NOT NULL,
    ano              INTEGER NOT NULL,
    ciclo_id         BIGINT REFERENCES ciclo_orcamentario (id),
    bloco            VARCHAR(20) NOT NULL,
    natureza         VARCHAR(20),
    objeto           TEXT,
    area_demandante  VARCHAR(255),
    unidade_id       BIGINT,
    estado           VARCHAR(20) NOT NULL DEFAULT 'rascunho',
    valor_estimado_cents BIGINT,
    interesse_renovacao  BOOLEAN,
    created_at       TIMESTAMP DEFAULT NOW(),
    updated_at       TIMESTAMP DEFAULT NOW(),
    created_by       BIGINT,
    updated_by       BIGINT
);

-- Código único por ano (IFO-{ano}-{NNNN}).
CREATE UNIQUE INDEX IF NOT EXISTS uq_ifo_codigo ON ifo (ano, codigo);
CREATE INDEX IF NOT EXISTS idx_ifo_ano ON ifo (ano);
CREATE INDEX IF NOT EXISTS idx_ifo_ciclo ON ifo (ciclo_id);

-- Pool 1:N — contratos continuada agrupados sob um IFO (RF-10/11).
CREATE TABLE IF NOT EXISTS ifo_contratos (
    ifo_id      BIGINT NOT NULL REFERENCES ifo (id) ON DELETE CASCADE,
    contract_id BIGINT NOT NULL,
    PRIMARY KEY (ifo_id, contract_id)
);

CREATE INDEX IF NOT EXISTS idx_ifo_contratos_contract ON ifo_contratos (contract_id);

-- rollback DROP INDEX IF EXISTS idx_ifo_contratos_contract;
-- rollback DROP TABLE IF EXISTS ifo_contratos;
-- rollback DROP INDEX IF EXISTS idx_ifo_ciclo;
-- rollback DROP INDEX IF EXISTS idx_ifo_ano;
-- rollback DROP INDEX IF EXISTS uq_ifo_codigo;
-- rollback DROP TABLE IF EXISTS ifo;
