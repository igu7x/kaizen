-- liquibase formatted sql

-- changeset kaizen:240_create_sgsi_leitura
-- Migration 240: 16ª fatia do módulo "Segurança da Informação" — Ciência e Leitura Confirmada.
-- Registra quem DEVE ler cada instrumento normativo (requisito) e quem JÁ CONFIRMOU a leitura (RN-39).
-- Regra do universo: se um instrumento não tem nenhum requisito cadastrado, a leitura é exigida de
-- TODOS os usuários ativos (lista vazia = todos, não ninguém).
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; usuário uuid → users(id) INTEGER.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_leitura_requisito (
    instrumento_codigo text    NOT NULL REFERENCES sgsi_instrumento(codigo) ON DELETE CASCADE,
    usuario_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    definido_por       integer REFERENCES users(id),
    definido_em        timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (instrumento_codigo, usuario_id)
);

CREATE TABLE IF NOT EXISTS sgsi_leitura_confirmacao (
    instrumento_codigo text    NOT NULL REFERENCES sgsi_instrumento(codigo) ON DELETE CASCADE,
    usuario_id         integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    confirmado_em      timestamptz NOT NULL DEFAULT now(),
    origem_ip          inet,
    PRIMARY KEY (instrumento_codigo, usuario_id)
);
-- rollback DROP TABLE IF EXISTS sgsi_leitura_confirmacao;
-- rollback DROP TABLE IF EXISTS sgsi_leitura_requisito;
