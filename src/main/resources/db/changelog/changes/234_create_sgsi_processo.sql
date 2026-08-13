-- liquibase formatted sql

-- changeset kaizen:234_create_sgsi_processo
-- Migration 234: 11ª fatia do módulo "Segurança da Informação" — Processos (BPMN).
-- Processos de negócio em notação BPMN simplificada: raias (lanes), nós (nodes: start/task/gw/end,
-- com o índice da raia em `l`) e fluxos (flows: [de, para, rótulo?]). Renderizados como swimlane.
--
-- ADAPTAÇÕES ao Kaizen: tabela prefixada sgsi_; FK → sgsi_instrumento. Sem os caches derivados
-- bpmn_xml/svg do protótipo (vazios na origem) — o diagrama é montado no front a partir do JSON.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.
CREATE TABLE IF NOT EXISTS sgsi_processo (
    id                 text PRIMARY KEY,          -- P01..P08
    nome               text NOT NULL,
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    referencia         text,
    restrito           boolean NOT NULL DEFAULT false,
    lanes              jsonb NOT NULL,            -- ["Unidade elaboradora", ...]
    nodes              jsonb NOT NULL,            -- [{id,t,n,l}]
    flows              jsonb NOT NULL,            -- [["n1","n2"], ["n4","n5","não"]]
    versao             int NOT NULL DEFAULT 1,
    atualizado_em      timestamptz NOT NULL DEFAULT now()
);
-- rollback DROP TABLE IF EXISTS sgsi_processo;
