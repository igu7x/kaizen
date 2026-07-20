-- liquibase formatted sql
-- changeset kaizen:180_revisao_item_validacao

-- Migration 180: validação por demanda dos ITENS na Revisão (§8.4) — 2 camadas por item de PCA.
--
-- CONTEXTO:
-- Na Revisão, a "demanda" é a alteração proposta a um Item de PCA (que mantém seu código PCA-NNN,
-- diferente da Formação onde a demanda é um IFO). A validação é a mesma máquina de 2 camadas
-- (1ª = Gestor Demandante → 2ª = Diretor), por (ciclo de revisão × item). Editar um item já validado
-- derruba as validações (RN-GERAL-07). Estado por item, não na tabela pcas, para não poluir o item
-- oficial e permitir resetar a cada revisão.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva. Domínio de `validacao` validado no backend.

CREATE TABLE IF NOT EXISTS revisao_item_validacao (
    id              BIGSERIAL PRIMARY KEY,
    ciclo_id        BIGINT NOT NULL REFERENCES ciclo_orcamentario (id),
    pca_id          BIGINT NOT NULL,
    validacao       VARCHAR(20) NOT NULL DEFAULT 'em_edicao',
    validado_1a_por BIGINT,
    validado_1a_em  TIMESTAMP,
    validado_2a_por BIGINT,
    validado_2a_em  TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_revisao_item_validacao ON revisao_item_validacao (ciclo_id, pca_id);

-- rollback DROP INDEX IF EXISTS uq_revisao_item_validacao;
-- rollback DROP TABLE IF EXISTS revisao_item_validacao;
