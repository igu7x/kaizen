-- liquibase formatted sql

-- changeset kaizen:246_create_sgsi_sbom
-- Migration 246: 21ª fatia do módulo "Segurança da Informação" — SBOM (Software Bill of Materials).
-- Inventário de componentes de software por sistema (cadeia de suprimentos): licença, procedência,
-- purl e fim de vida (EOL). A coluna origem separa inventários REAIS dos de DEMONSTRACAO.
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; FK → sgsi_instrumento. SEM seed — na origem os dados
-- de SBOM são apenas demonstração; inventários reais são cadastrados pela tela (não carregar demo em prod).
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_sbom_sistema (
    id                 text PRIMARY KEY,
    sistema            text NOT NULL,
    versao             text,
    fornecedor         text,
    tipo               text,
    criticidade        text CHECK (criticidade IN ('ALTA','MEDIA','BAIXA')),
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    formato            text DEFAULT 'CycloneDX 1.6',
    data_referencia    date,
    observacoes        text,
    origem             text NOT NULL DEFAULT 'REAL' CHECK (origem IN ('REAL','DEMONSTRACAO')),
    criado_em          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sgsi_sbom_componente (
    id              bigserial PRIMARY KEY,
    sbom_sistema_id text NOT NULL REFERENCES sgsi_sbom_sistema(id) ON DELETE CASCADE,
    nome            text NOT NULL,
    versao          text,
    fornecedor      text,
    licenca         text,
    tipo            text,
    procedencia     text,
    purl            text,
    eol_data        date
);
CREATE INDEX IF NOT EXISTS idx_sgsi_sbom_comp ON sgsi_sbom_componente (sbom_sistema_id);
-- rollback DROP TABLE IF EXISTS sgsi_sbom_componente;
-- rollback DROP TABLE IF EXISTS sgsi_sbom_sistema;
