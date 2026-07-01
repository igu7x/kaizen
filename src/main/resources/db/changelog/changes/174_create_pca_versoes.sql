-- liquibase formatted sql
-- changeset kaizen:174_create_pca_versoes

-- Migration 174: registro de proveniência das versões do PCA-TIC (RF-45/46)
--
-- CONTEXTO:
-- A numeração de versão do PCA-TIC só deve avançar na PUBLICAÇÃO de um ciclo (Formação/Revisão),
-- e cada versão publicada deve ser rastreável ao ciclo que a produziu. Esta tabela registra, por
-- (ano, versão), o ciclo de origem, a finalidade e quando/quem publicou. Snapshots manuais de
-- superadmin (fallback, "MANTER POR ORA") ficam com finalidade='manual' e ciclo_id nulo.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva. Não altera a fonte de verdade das versões
-- (pcas_snapshots); é uma sobreposição de proveniência.

CREATE TABLE IF NOT EXISTS pca_versoes (
    id            BIGSERIAL PRIMARY KEY,
    ano           INTEGER NOT NULL,
    versao        INTEGER NOT NULL,
    ciclo_id      BIGINT REFERENCES ciclo_orcamentario (id),
    finalidade    VARCHAR(20) NOT NULL DEFAULT 'manual'
                  CHECK (finalidade IN ('formacao', 'revisao', 'manual')),
    publicado_em  TIMESTAMP DEFAULT NOW(),
    publicado_por BIGINT
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pca_versoes_ano_versao ON pca_versoes (ano, versao);
CREATE INDEX IF NOT EXISTS idx_pca_versoes_ciclo ON pca_versoes (ciclo_id);

-- rollback DROP INDEX IF EXISTS idx_pca_versoes_ciclo;
-- rollback DROP INDEX IF EXISTS uq_pca_versoes_ano_versao;
-- rollback DROP TABLE IF EXISTS pca_versoes;
