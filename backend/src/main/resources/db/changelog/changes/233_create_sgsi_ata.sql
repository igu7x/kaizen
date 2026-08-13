-- liquibase formatted sql

-- changeset kaizen:233_create_sgsi_ata
-- Migration 233: 10ª fatia do módulo "Segurança da Informação" — Atas de reunião.
-- Registro das atas de deliberação/homologação dos comitês (CGSI, CGovTIC, ...), com pauta,
-- deliberações e encaminhamentos. Sem seed (preenchido pelo NSI). numero_emissao é texto livre
-- (referência à emissão oficial, quando houver).
--
-- ADAPTAÇÕES ao Kaizen: tabela prefixada sgsi_; FKs → sgsi_instrumento/users.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.
CREATE TABLE IF NOT EXISTS sgsi_ata (
    id                 bigserial PRIMARY KEY,
    data_reuniao       date NOT NULL,
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    titulo             text NOT NULL,
    participantes      text,
    pauta              text,
    deliberacoes       text,
    encaminhamentos    text,
    numero_emissao     text,
    criado_por         integer REFERENCES users(id),
    criado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_ata_data ON sgsi_ata (data_reuniao DESC);
-- rollback DROP TABLE IF EXISTS sgsi_ata;
