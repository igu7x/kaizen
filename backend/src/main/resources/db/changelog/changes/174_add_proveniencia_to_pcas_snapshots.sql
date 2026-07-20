-- liquibase formatted sql
-- changeset kaizen:174_add_proveniencia_to_pcas_snapshots

-- Migration 174: proveniência das versões do PCA-TIC diretamente em pcas_snapshots (RF-45/46)
--
-- CONTEXTO:
-- A numeração de versão do PCA-TIC só avança na PUBLICAÇÃO de um ciclo (Formação/Revisão), e cada
-- versão publicada deve ser rastreável ao ciclo que a produziu. A tabela paralela `pca_versoes`
-- (versão original desta migration) era REDUNDANTE em relação a `pcas_snapshots`, que já é a fonte
-- de verdade das versões. A proveniência passa a ser colunas da própria `pcas_snapshots`:
--   ciclo_id      → ciclo de origem que publicou a versão (NULL em snapshot manual)
--   finalidade    → 'formacao' | 'revisao' | 'manual' (default 'manual'; validado no BACKEND)
--   publicado_em  → quando a versão foi publicada
--   publicado_por → user_id de quem publicou (se houver)
-- Snapshots manuais de superadmin (fallback) ficam com finalidade='manual' e ciclo_id nulo.
-- A validação do domínio de `finalidade` é feita no backend (PcaService), NÃO por CHECK no banco.
--
-- SEGURANÇA (Zero Downtime): colunas aditivas (nullable / com default). O DROP de `pca_versoes`
-- é auto-curável (IF EXISTS) — remove a tabela redundante caso a versão anterior tenha sido aplicada.

-- Remove a tabela paralela de proveniência (substituída pelas colunas abaixo).
DROP INDEX IF EXISTS idx_pca_versoes_ciclo;
DROP INDEX IF EXISTS uq_pca_versoes_ano_versao;
DROP TABLE IF EXISTS pca_versoes;

ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS ciclo_id BIGINT REFERENCES ciclo_orcamentario (id);
ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS finalidade VARCHAR(20) NOT NULL DEFAULT 'manual';
ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS publicado_em TIMESTAMP DEFAULT NOW();
ALTER TABLE pcas_snapshots ADD COLUMN IF NOT EXISTS publicado_por BIGINT;

CREATE INDEX IF NOT EXISTS idx_pcas_snapshots_ciclo ON pcas_snapshots (ciclo_id);

-- rollback DROP INDEX IF EXISTS idx_pcas_snapshots_ciclo;
-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS publicado_por;
-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS publicado_em;
-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS finalidade;
-- rollback ALTER TABLE pcas_snapshots DROP COLUMN IF EXISTS ciclo_id;
