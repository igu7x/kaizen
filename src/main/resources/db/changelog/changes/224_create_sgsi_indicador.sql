-- liquibase formatted sql

-- changeset kaizen:224_create_sgsi_indicador
-- Migration 224: 3ª fatia do módulo "Segurança da Informação" — Indicadores e medições.
-- Cada indicador é exigido por um instrumento (em geral derivado de uma tarefa 5W2H) e pode ter
-- meta, tolerância e direção (>=/<=) para o semáforo. As medições registram o valor por competência.
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; FKs de instrumento/tarefa → sgsi_*;
-- registrado_por → users(id) INTEGER.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_indicador (
    id                 bigserial PRIMARY KEY,
    seed_key           text UNIQUE,
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    tarefa_id          bigint REFERENCES sgsi_tarefa(id) ON DELETE SET NULL,
    nome               text NOT NULL,
    referencia         text,
    responsavel        text,
    formula            text,
    unidade            text NOT NULL DEFAULT '%',
    meta               numeric,
    tolerancia         numeric,
    direcao            text NOT NULL DEFAULT '>=' CHECK (direcao IN ('>=','<=')),
    frequencia         text CHECK (frequencia IN ('MENSAL','TRIMESTRAL','SEMESTRAL','ANUAL','EVENTUAL')),
    ativo              boolean NOT NULL DEFAULT true,
    criado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_indicador_instrumento ON sgsi_indicador (instrumento_codigo);

CREATE TABLE IF NOT EXISTS sgsi_medicao (
    id              bigserial PRIMARY KEY,
    indicador_id    bigint  NOT NULL REFERENCES sgsi_indicador(id) ON DELETE CASCADE,
    competencia     text    NOT NULL,                 -- AAAA-MM
    data_referencia date    NOT NULL,
    valor           numeric NOT NULL,
    observacao      text,
    registrado_por  integer REFERENCES users(id),
    criado_em       timestamptz NOT NULL DEFAULT now(),
    UNIQUE (indicador_id, competencia)
);
CREATE INDEX IF NOT EXISTS idx_sgsi_medicao_indicador ON sgsi_medicao (indicador_id);
-- rollback DROP TABLE IF EXISTS sgsi_medicao; DROP TABLE IF EXISTS sgsi_indicador;
