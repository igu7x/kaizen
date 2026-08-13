-- liquibase formatted sql

-- changeset kaizen:229_create_sgsi_emissao
-- Migration 229: 8ª fatia do módulo "Segurança da Informação" — Emissões (numeração + digitalização).
-- Série define o padrão de numeração; a emissão gera um número sequencial atômico por série/ano
-- (RN-20) e um hash de custódia dos metadados + digitalização (RN-22). A digitalização (PDF) é
-- guardada como base64 (convenção do Kaizen), não em bytea/objeto externo.
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; FKs → sgsi_*/users; anexo = conteudo_base64 TEXT.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_serie (
    codigo   text PRIMARY KEY,
    nome     text NOT NULL,
    prefixo  text NOT NULL,
    mascara  text NOT NULL DEFAULT '{PFX}-{SEQ}/{ANO}',
    digitos  int  NOT NULL DEFAULT 4 CHECK (digitos BETWEEN 1 AND 9),
    reinicia text NOT NULL DEFAULT 'ANO' CHECK (reinicia IN ('ANO','NUNCA')),
    orgao    text,
    ativa    boolean NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS sgsi_emissao (
    id                 bigserial PRIMARY KEY,
    numero             text NOT NULL UNIQUE,           -- ex.: 'DEC-0001/2026'
    serie_codigo       text NOT NULL REFERENCES sgsi_serie(codigo),
    sequencial         int  NOT NULL,
    ano                int  NOT NULL,
    documento_id       bigint REFERENCES sgsi_documento(id),
    titulo             text NOT NULL,
    tipo               text,
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    referencia         text,
    data_emissao       date NOT NULL DEFAULT current_date,
    autoridade         text NOT NULL,
    proad              text,
    classificacao      text NOT NULL DEFAULT 'INTERNA'
        CHECK (classificacao IN ('PUBLICA','INTERNA','RESTRITA','SIGILOSA_CLASSIFICADA')),
    observacoes        text,
    hash_sha256        text NOT NULL,                  -- custódia dos metadados + digitalização
    status             text NOT NULL DEFAULT 'EMITIDO' CHECK (status IN ('EMITIDO','CANCELADO')),
    cancel_motivo      text,
    cancel_por         integer REFERENCES users(id),
    cancel_em          timestamptz,
    emitido_por        integer REFERENCES users(id),
    emitido_em         timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sgsi_emissao_sequencia UNIQUE (serie_codigo, sequencial, ano),
    CONSTRAINT sgsi_emissao_cancel_motivado CHECK (status <> 'CANCELADO' OR cancel_motivo IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_sgsi_emissao_serie ON sgsi_emissao (serie_codigo, ano);

-- Digitalização (PDF) da emissão — base64 em TEXT (convenção do Kaizen; sem bytea/objeto externo).
CREATE TABLE IF NOT EXISTS sgsi_emissao_arquivo (
    emissao_id      bigint PRIMARY KEY REFERENCES sgsi_emissao(id) ON DELETE CASCADE,
    nome            text   NOT NULL,
    mime            text   NOT NULL,
    tamanho_bytes   bigint NOT NULL CHECK (tamanho_bytes > 0 AND tamanho_bytes <= 8388608),
    hash_sha256     text   NOT NULL,
    conteudo_base64 text   NOT NULL,
    anexado_por     integer REFERENCES users(id),
    anexado_em      timestamptz NOT NULL DEFAULT now()
);
-- rollback DROP TABLE IF EXISTS sgsi_emissao_arquivo; DROP TABLE IF EXISTS sgsi_emissao; DROP TABLE IF EXISTS sgsi_serie;
