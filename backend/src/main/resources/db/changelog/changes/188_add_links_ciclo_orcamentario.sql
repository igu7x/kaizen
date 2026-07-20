-- liquibase formatted sql
-- changeset kaizen:188_add_links_ciclo_orcamentario

ALTER TABLE ciclo_orcamentario ADD COLUMN IF NOT EXISTS proad_gejut         VARCHAR(60);
ALTER TABLE ciclo_orcamentario ADD COLUMN IF NOT EXISTS proad_sgjt          VARCHAR(60);
ALTER TABLE ciclo_orcamentario ADD COLUMN IF NOT EXISTS proad_ata_comites   VARCHAR(60);
ALTER TABLE ciclo_orcamentario ADD COLUMN IF NOT EXISTS proad_produto_final VARCHAR(60);
ALTER TABLE ciclo_orcamentario ADD COLUMN IF NOT EXISTS proad_publicacao    VARCHAR(60);
ALTER TABLE ciclo_orcamentario ADD COLUMN IF NOT EXISTS link_dou            VARCHAR(500);

-- rollback ALTER TABLE ciclo_orcamentario DROP COLUMN IF EXISTS link_dou;
-- rollback ALTER TABLE ciclo_orcamentario DROP COLUMN IF EXISTS proad_publicacao;
-- rollback ALTER TABLE ciclo_orcamentario DROP COLUMN IF EXISTS proad_produto_final;
-- rollback ALTER TABLE ciclo_orcamentario DROP COLUMN IF EXISTS proad_ata_comites;
-- rollback ALTER TABLE ciclo_orcamentario DROP COLUMN IF EXISTS proad_sgjt;
-- rollback ALTER TABLE ciclo_orcamentario DROP COLUMN IF EXISTS proad_gejut;
