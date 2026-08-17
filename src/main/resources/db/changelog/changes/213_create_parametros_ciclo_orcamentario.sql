-- liquibase formatted sql
-- changeset kaizen:213_create_parametros_ciclo_orcamentario

-- Migration 213: tabela normalizada de parâmetros do Ciclo Orçamentário (Contratações de TIC).
--
-- CONTEXTO:
-- As datas da Formação e da Revisão do PCA-TIC estavam hardcoded no backend
-- (CicloOrcamentarioService) e no frontend (cicloConstants.ts). Esta tabela parametriza
-- esses valores para que sejam editáveis via tela administrativa (Cadastros → Contratações de TIC).
--
-- Dois grupos de parâmetros:
--   1) Fases da Formação (6 fases com data-limite + corte de auto-fechamento)
--   2) Janelas da Revisão (3 janelas ordinárias com datas de início/fim/rito)
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas. Seed com valores padrão atuais.

-- =============================================
-- Tabela: fases da Formação do PCA
-- =============================================
CREATE TABLE IF NOT EXISTS parametros_ciclo_formacao (
    id            SERIAL PRIMARY KEY,
    ordem         INTEGER NOT NULL,
    fase          VARCHAR(60) NOT NULL,
    area          VARCHAR(60) NOT NULL,
    data_limite   VARCHAR(5) NOT NULL,         -- formato DD/MM (MonthDay)
    updated_at    TIMESTAMP DEFAULT NOW(),
    updated_by    BIGINT,
    UNIQUE(ordem)
);

-- =============================================
-- Tabela: janelas ordinárias da Revisão do PCA
-- =============================================
CREATE TABLE IF NOT EXISTS parametros_ciclo_revisao (
    id              SERIAL PRIMARY KEY,
    ordem           INTEGER NOT NULL,            -- 1, 2 ou 3
    versao          INTEGER NOT NULL,            -- versão gerada (2, 3 ou 4)
    janela_inicio   VARCHAR(5),                  -- DD/MM (null na 1ª = evento de publicação)
    janela_fim      VARCHAR(5) NOT NULL,          -- DD/MM
    rito_sgjt       VARCHAR(5) NOT NULL,          -- DD/MM — consolidação CCA/GEJUT
    comites         VARCHAR(5) NOT NULL,          -- DD/MM — apreciação comitês
    remessa_dg      VARCHAR(5) NOT NULL,          -- DD/MM — remessa à DG
    updated_at      TIMESTAMP DEFAULT NOW(),
    updated_by      BIGINT,
    UNIQUE(ordem)
);

-- =============================================
-- Tabela: parâmetros gerais do Ciclo Orçamentário
-- =============================================
CREATE TABLE IF NOT EXISTS parametros_ciclo_geral (
    id              SERIAL PRIMARY KEY,
    chave           VARCHAR(100) NOT NULL UNIQUE,
    valor           VARCHAR(20) NOT NULL,
    descricao       TEXT,
    updated_at      TIMESTAMP DEFAULT NOW(),
    updated_by      BIGINT
);

-- =============================================
-- SEED: valores padrão (atuais hardcoded)
-- =============================================

-- Fases da Formação (ordem cronológica, RF-42)
INSERT INTO parametros_ciclo_formacao (ordem, fase, area, data_limite) VALUES
    (1, 'Abertura',       'CCA',        '31/01'),
    (2, 'Consulta',       'Demandantes', '28/02'),
    (3, 'Consolidação',   'CCA · GEJUT', '15/03'),
    (4, 'Apreciação',     'SGJT',        '20/03'),
    (5, 'Comitês',        'CGovTIC',     '25/03'),
    (6, 'Remessa à DG',   'CCA',         '31/03')
ON CONFLICT (ordem) DO NOTHING;

-- Janelas Ordinárias da Revisão (RF-76/77)
INSERT INTO parametros_ciclo_revisao (ordem, versao, janela_inicio, janela_fim, rito_sgjt, comites, remessa_dg) VALUES
    (1, 2, NULL,    '31/01', '07/02', '15/02', '20/02'),
    (2, 3, '01/04', '30/04', '07/05', '15/05', '20/05'),
    (3, 4, '01/07', '31/07', '07/08', '15/08', '20/08')
ON CONFLICT (ordem) DO NOTHING;

-- Corte de auto-fechamento da Formação (RF-31)
INSERT INTO parametros_ciclo_geral (chave, valor, descricao) VALUES
    ('corte_formacao', '01/03', 'Data de corte para auto-fechamento da consulta às unidades na Formação (DD/MM)')
ON CONFLICT (chave) DO NOTHING;

-- rollback DROP TABLE IF EXISTS parametros_ciclo_geral;
-- rollback DROP TABLE IF EXISTS parametros_ciclo_revisao;
-- rollback DROP TABLE IF EXISTS parametros_ciclo_formacao;
