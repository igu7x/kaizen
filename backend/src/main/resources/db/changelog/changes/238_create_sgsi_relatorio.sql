-- liquibase formatted sql

-- changeset kaizen:238_create_sgsi_relatorio
-- Migration 238: 13ª fatia do módulo "Segurança da Informação" — Emissão efetiva de Relatórios.
-- Fecha o ciclo do Catálogo (fatia 9) + Emissões (fatia 8): emitir um relatório consome um número da
-- série REL (mesma numeração atômica) e grava um RETRATO IMUTÁVEL dos indicadores no instante da
-- emissão (RN-37) em conteudo (jsonb). Reabrir depois mostra sempre os números de então — nunca recalcula.
--
-- ADAPTAÇÕES ao Kaizen: tabela prefixada sgsi_; FKs → sgsi_emissao/sgsi_relatorio_catalogo/users.
-- Sem seed: relatórios são emitidos pelo NSI, não semeados.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.
CREATE TABLE IF NOT EXISTS sgsi_relatorio (
    id              bigserial PRIMARY KEY,
    numero          text NOT NULL UNIQUE REFERENCES sgsi_emissao(numero),
    catalogo_codigo text NOT NULL REFERENCES sgsi_relatorio_catalogo(codigo),
    titulo          text NOT NULL,
    periodo         text,
    destinatario    text,
    conteudo        jsonb NOT NULL,
    observacoes     text,
    hash_sha256     text NOT NULL,
    data_emissao    date NOT NULL DEFAULT current_date,
    emitido_por     integer REFERENCES users(id),
    criado_em       timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_rel_cat ON sgsi_relatorio(catalogo_codigo, data_emissao DESC);
-- rollback DROP TABLE IF EXISTS sgsi_relatorio;
