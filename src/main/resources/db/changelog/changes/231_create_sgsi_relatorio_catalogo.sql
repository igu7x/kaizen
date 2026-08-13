-- liquibase formatted sql

-- changeset kaizen:231_create_sgsi_relatorio_catalogo
-- Migration 231: 9ª fatia do módulo "Segurança da Informação" — Catálogo de Relatórios.
-- Os modelos de relatório que o SGSI deve produzir (R01..R17 obrigatórios; R90..R93 sob demanda),
-- com periodicidade, destinatário, base normativa e instrumento relacionado. A emissão efetiva de
-- relatórios (tabela relatorio, acoplada às Emissões) fica para uma fatia futura.
--
-- ADAPTAÇÕES ao Kaizen: tabela prefixada sgsi_; FK → sgsi_instrumento.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.
CREATE TABLE IF NOT EXISTS sgsi_relatorio_catalogo (
    codigo             text PRIMARY KEY,          -- R01..R17 (obrigatórios) · R90..R93 (sob demanda)
    nome               text NOT NULL,
    obrigatorio        boolean NOT NULL DEFAULT false,
    periodicidade      text NOT NULL,
    destinatario       text NOT NULL,
    base_normativa     text NOT NULL,
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    ordem              int NOT NULL
);
-- rollback DROP TABLE IF EXISTS sgsi_relatorio_catalogo;
