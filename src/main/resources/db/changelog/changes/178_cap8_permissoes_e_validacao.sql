-- liquibase formatted sql
-- changeset kaizen:178_cap8_permissoes_e_validacao

-- Migration 178: Cap. 8 — atribuição de Editores por escopo (RN-GERAL-09) e validação por demanda
--                do IFO em 2 camadas (§8.4 / RN-GERAL-06/07).
--
-- CONTEXTO:
-- Modelo Editor × Autoridade (RN-GERAL-01): o Editor edita e salva, mas nunca transita fase; a
-- Autoridade valida e transita. A atribuição de Editor é feita pela Autoridade do próprio escopo.
-- A validação de itens (demandas) é granular, em 2 camadas: 1ª (Gestor Demandante) → 2ª (Diretor de
-- Área); a remessa da partição (por unidade) é ato único do Diretor e congela a partição.
--
-- SEGURANÇA (Zero Downtime): tabela nova + colunas aditivas/nullable com default. Domínios validados
-- no backend (OrcamentoPapelService / IfoService), sem CHECK no banco (padrão jul/2026).

-- Atribuição de Editor por escopo (RN-GERAL-09). ciclo_id nulo = atribuição global.
CREATE TABLE IF NOT EXISTS orcamento_editores (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT NOT NULL,
    escopo      VARCHAR(20) NOT NULL,   -- cca | demandante | gejut | sgjt
    ciclo_id    BIGINT REFERENCES ciclo_orcamentario (id),
    created_by  BIGINT,
    created_at  TIMESTAMP DEFAULT NOW()
);

-- Uma atribuição por (usuário, escopo, ciclo) — trata ciclo global (nulo) como 0.
CREATE UNIQUE INDEX IF NOT EXISTS uq_orcamento_editor
    ON orcamento_editores (user_id, escopo, COALESCE(ciclo_id, 0));
CREATE INDEX IF NOT EXISTS idx_orcamento_editor_escopo ON orcamento_editores (escopo);

-- Estado de validação por demanda no IFO (§8.4): em_edicao → validada_1a → validada_2a.
ALTER TABLE ifo ADD COLUMN IF NOT EXISTS validacao VARCHAR(20) NOT NULL DEFAULT 'em_edicao';
ALTER TABLE ifo ADD COLUMN IF NOT EXISTS validado_1a_por BIGINT;
ALTER TABLE ifo ADD COLUMN IF NOT EXISTS validado_1a_em  TIMESTAMP;
ALTER TABLE ifo ADD COLUMN IF NOT EXISTS validado_2a_por BIGINT;
ALTER TABLE ifo ADD COLUMN IF NOT EXISTS validado_2a_em  TIMESTAMP;

-- rollback ALTER TABLE ifo DROP COLUMN IF EXISTS validado_2a_em;
-- rollback ALTER TABLE ifo DROP COLUMN IF EXISTS validado_2a_por;
-- rollback ALTER TABLE ifo DROP COLUMN IF EXISTS validado_1a_em;
-- rollback ALTER TABLE ifo DROP COLUMN IF EXISTS validado_1a_por;
-- rollback ALTER TABLE ifo DROP COLUMN IF EXISTS validacao;
-- rollback DROP INDEX IF EXISTS idx_orcamento_editor_escopo;
-- rollback DROP INDEX IF EXISTS uq_orcamento_editor;
-- rollback DROP TABLE IF EXISTS orcamento_editores;
