-- liquibase formatted sql

-- changeset kaizen:241_create_sgsi_eventos
-- Migration 241: 17ª fatia do módulo "Segurança da Informação" — Eventos institucionais e SLA.
-- Registra eventos de RH (desligamento/movimentação/afastamento/ingresso) e incidentes de segurança,
-- com o PRAZO DE AÇÃO derivado da norma, não de parâmetro operacional:
--   · RH (RN-40):        data_evento + 1h  se DESLIGAMENTO (PSI art. 11 §2º), senão + 24h.
--   · Incidente (RN-41): detectado_em + 2h se ALTA/CRÍTICA (PPINC art. 37), senão + 24h (PSFT art. 30).
-- O SGSI normatiza e audita — não opera: a revogação/acionamento pertence aos sistemas da DITI.
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_. Sem seed.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_evento_rh (
    id           bigserial PRIMARY KEY,
    tipo         text NOT NULL CHECK (tipo IN ('DESLIGAMENTO','MOVIMENTACAO','AFASTAMENTO','INGRESSO')),
    matricula    text NOT NULL,
    nome         text,
    unidade      text,
    data_evento  timestamptz NOT NULL,
    prazo_acao   timestamptz NOT NULL,
    situacao     text NOT NULL DEFAULT 'PENDENTE' CHECK (situacao IN ('PENDENTE','EXECUTADO','FALHA')),
    executado_em timestamptz,
    origem       text,
    criado_em    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_evento_rh_sit ON sgsi_evento_rh (situacao, prazo_acao);

CREATE TABLE IF NOT EXISTS sgsi_incidente (
    id                bigserial PRIMARY KEY,
    severidade        text NOT NULL CHECK (severidade IN ('BAIXA','MEDIA','ALTA','CRITICA')),
    titulo            text NOT NULL,
    descricao         text,
    ativos            text,
    dados_pessoais    boolean NOT NULL DEFAULT false,
    fornecedor        text,
    detectado_em      timestamptz NOT NULL,
    prazo_acionamento timestamptz NOT NULL,
    situacao          text NOT NULL DEFAULT 'TRIAGEM'
        CHECK (situacao IN ('TRIAGEM','EM_TRATAMENTO','CONTIDO','ENCERRADO')),
    origem            text,
    criado_em         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_incidente_sit ON sgsi_incidente (situacao, prazo_acionamento);
-- rollback DROP TABLE IF EXISTS sgsi_incidente;
-- rollback DROP TABLE IF EXISTS sgsi_evento_rh;
