-- liquibase formatted sql
-- changeset kaizen:253_create_pac_parametros
-- Parametros das metas do Plano Anual de Capacitacao, por modulo (ti / apoio).
--
-- Guarda o DENOMINADOR da Meta 2 ("pelo menos 40% dos servidores da area participem de ao menos
-- uma acao"). O total de servidores e informado pelo gestor do PAC e travado para o ciclo: contar
-- cadastros_pessoas faria o percentual oscilar a cada admissao/remocao, e meta institucional
-- precisa de base estavel.
--
-- Os percentuais das metas (75% e 40%) NAO ficam aqui: sao a regra do PAC e vivem como constante
-- no codigo.
CREATE TABLE IF NOT EXISTS pac_parametros (
    modulo           VARCHAR(20)  PRIMARY KEY,
    total_servidores INTEGER      NOT NULL DEFAULT 0,
    updated_at       TIMESTAMP,
    updated_by       INTEGER
);
-- rollback DROP TABLE IF EXISTS pac_parametros;
