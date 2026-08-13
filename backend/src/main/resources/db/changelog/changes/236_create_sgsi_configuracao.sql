-- liquibase formatted sql

-- changeset kaizen:236_create_sgsi_configuracao
-- Migration 236: 12ª fatia do módulo "Segurança da Informação" — Configurações.
-- Parâmetros ajustáveis do SGSI (âncora padrão, janela de alerta, step-up, tamanho máximo de
-- digitalização, limiares de IRS…), guardados como chave → valor JSON.
--
-- ADAPTAÇÕES ao Kaizen: tabela prefixada sgsi_; FK → users. Seed classificado PARÂMETRO.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.
CREATE TABLE IF NOT EXISTS sgsi_configuracao (
    chave          text PRIMARY KEY,
    valor          jsonb NOT NULL,
    descricao      text,
    atualizado_por integer REFERENCES users(id),
    atualizado_em  timestamptz NOT NULL DEFAULT now()
);
-- rollback DROP TABLE IF EXISTS sgsi_configuracao;
