-- liquibase formatted sql

-- changeset kaizen:242_create_sgsi_alerta
-- Migration 242: 18ª fatia do módulo "Segurança da Informação" — Alertas.
-- Duas naturezas (RN-06): (1) DERIVADOS — calculados a partir dos prazos de documentos e tarefas
-- dentro da janela (config alerta.janela_dias, padrão 15) ou já vencidos; NÃO são persistidos, pois o
-- prazo muda quando a âncora muda e um alerta gravado passaria a mentir. (2) REGISTRADOS — criados por
-- usuário/API, persistidos em sgsi_alerta com flag lido. A dispensa de um derivado é POR USUÁRIO e a
-- chave inclui a data-limite (RN-08): mudou o prazo, o alerta reaparece — não existe "dispensar sempre".
--
-- ADAPTAÇÕES ao Kaizen: tabelas prefixadas sgsi_; usuário uuid → users(id) INTEGER; FKs → sgsi_*.
--
-- SEGURANÇA (Zero Downtime): tabelas novas, aditivas.
CREATE TABLE IF NOT EXISTS sgsi_alerta (
    id                 bigserial PRIMARY KEY,
    titulo             text NOT NULL,
    descricao          text,
    data_referencia    date,
    instrumento_codigo text REFERENCES sgsi_instrumento(codigo),
    tarefa_id          bigint REFERENCES sgsi_tarefa(id) ON DELETE CASCADE,
    documento_id       bigint REFERENCES sgsi_documento(id) ON DELETE CASCADE,
    indicador_id       bigint REFERENCES sgsi_indicador(id) ON DELETE CASCADE,
    origem             text NOT NULL DEFAULT 'MANUAL' CHECK (origem IN ('MANUAL','API')),
    lido               boolean NOT NULL DEFAULT false,
    criado_por         integer REFERENCES users(id),
    criado_em          timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_sgsi_alerta_lido ON sgsi_alerta (lido, criado_em DESC);

CREATE TABLE IF NOT EXISTS sgsi_alerta_dispensa (
    chave      text    NOT NULL,
    usuario_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    criado_em  timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (chave, usuario_id)
);
-- rollback DROP TABLE IF EXISTS sgsi_alerta_dispensa;
-- rollback DROP TABLE IF EXISTS sgsi_alerta;
