--liquibase formatted sql

--changeset kaizen:205_add_revisao_editada_processos_negocio
-- Migration 205: controle de Revisão dos processos de negócio.
--
-- `revisao_editada`: flag do ciclo de revisão. Zerada ao Iniciar Revisão; marcada quando o
-- conteúdo é editado durante o ciclo. Na homologação (validarFinal), a Revisão incrementa sempre
-- e a Versão só incrementa (e a Data da Versão só atualiza) se houve edição no ciclo.
--
-- Também normaliza `revisao` NULL para '0' (valor padrão do campo).
--
-- SEGURANÇA (Zero Downtime): coluna nova nulável + UPDATE de valor ausente; idempotente.

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS revisao_editada BOOLEAN DEFAULT FALSE;

UPDATE processos_negocio SET revisao = '0' WHERE revisao IS NULL OR btrim(revisao) = '';

--rollback ALTER TABLE processos_negocio DROP COLUMN revisao_editada;
