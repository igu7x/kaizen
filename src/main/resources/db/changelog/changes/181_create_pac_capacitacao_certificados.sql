--liquibase formatted sql

--changeset kaizen:181_create_pac_capacitacao_certificados
-- Migration 181: certificados dos participantes de um item da Matriz do PAC.
--
-- Cada linha registra a conclusão de um servidor (nome + diretoria vindos do cadastro de
-- colaboradores) com o PDF do certificado anexado (data URL base64 em arquivo_data).
-- O progresso de cada capacitação é calculado no app: certificados / vagas (vagas = 1
-- quando numero_vagas é nulo/zero).
--
-- SEGURANÇA (Zero Downtime): tabela nova, aditiva. FK com ON DELETE CASCADE.

CREATE TABLE IF NOT EXISTS pac_capacitacao_certificados (
    id              BIGSERIAL PRIMARY KEY,
    capacitacao_id  BIGINT NOT NULL REFERENCES pac_capacitacao(id) ON DELETE CASCADE,
    colaborador_id  BIGINT,
    nome_servidor   TEXT NOT NULL,
    diretoria       VARCHAR(120),
    arquivo_nome    TEXT,
    arquivo_data    TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_deleted      BOOLEAN   DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_pac_cert_capacitacao
    ON pac_capacitacao_certificados (capacitacao_id, is_deleted);

--rollback DROP TABLE pac_capacitacao_certificados;
