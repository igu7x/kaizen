-- liquibase formatted sql

-- changeset kaizen:222_create_sgsi_documento
-- Migration 222: 2ª fatia do módulo "Segurança da Informação" — Obrigações Documentais.
-- Cada documento é uma obrigação exigida por um instrumento normativo, em geral derivada de
-- uma tarefa do plano 5W2H (seed_key '<INSTR>:<numero>'), com sua referência normativa e prazo.
--
-- ADAPTAÇÕES ao Kaizen: tabela prefixada sgsi_; FKs de instrumento/tarefa apontam para
-- sgsi_instrumento/sgsi_tarefa; FKs de pessoas (titular/checkout/registrado_por) para users(id).
-- As tabelas do ciclo completo (versão, tramitação, assinatura, colaborador) ficam para a fatia
-- de workflow de documento — aqui só a obrigação e seu status.
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva.
CREATE TABLE IF NOT EXISTS sgsi_documento (
    id                 bigserial PRIMARY KEY,
    seed_key           text UNIQUE,                          -- '<INSTR>:<numero_tarefa>' (derivadas do plano)
    nome               text NOT NULL,
    tipo               text NOT NULL,
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    tarefa_id          bigint REFERENCES sgsi_tarefa(id) ON DELETE SET NULL,
    atividade          text,                                 -- atividade 5W2H de origem
    referencia         text,                                 -- dispositivo normativo que a exige
    responsavel        text,                                 -- unidade responsável (texto livre)
    prazo_marco        int,                                  -- M+n herdado do plano
    prazo_data         date,                                 -- prazo explícito; PREVALECE sobre prazo_marco
    status             text NOT NULL DEFAULT 'PENDENTE'
        CHECK (status IN ('PENDENTE','EM_ELABORACAO','EM_REVISAO','EM_ASSINATURA','ASSINADO','PUBLICADO','CANCELADO')),
    conteudo           text,
    origem             text NOT NULL DEFAULT 'REGISTRO_MANUAL'
        CHECK (origem IN ('PLANO_5W2H','REGISTRO_MANUAL')),
    titular_id         integer REFERENCES users(id),         -- detentor atual na tramitação
    checkout_id        integer REFERENCES users(id),         -- trava de edição exclusiva
    checkout_em        timestamptz,
    numero_emissao     text,                                 -- preenchido na emissão
    registrado_por     integer REFERENCES users(id),
    criado_em          timestamptz NOT NULL DEFAULT now(),
    atualizado_em      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT sgsi_documento_checkout_coerente CHECK ((checkout_id IS NULL) = (checkout_em IS NULL))
);
CREATE INDEX IF NOT EXISTS idx_sgsi_documento_instrumento ON sgsi_documento (instrumento_codigo);
CREATE INDEX IF NOT EXISTS idx_sgsi_documento_status ON sgsi_documento (status);
-- rollback DROP TABLE IF EXISTS sgsi_documento;
