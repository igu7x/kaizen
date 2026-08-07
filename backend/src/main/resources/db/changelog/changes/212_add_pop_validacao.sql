-- liquibase formatted sql
-- changeset kaizen:212_add_pop_validacao

-- Migration 212: fluxo de validação do POP (Procedimento Operacional Padrão).
--
-- CONTEXTO:
-- O POP passa a ter um fluxo de aprovação em 3 etapas (seção 10 do documento):
--   1) Proposto  — quem cria o POP (gestor da área ou usuário com permissão de Editor);
--   2) Analisado — gestor/sub-diretor da área (coordenador);
--   3) Aprovado  — diretor da área (cadastros_areas.gestor_user_id).
-- Não há etapa de Compliance (o POP não precisa da aprovação do Compliance Officer).
-- Ao aprovar, a Data da Versão é carimbada com a data da aprovação; até lá fica "Pendente".
--
-- Os nomes (proposto_por/analisado_por/aprovado_por) já existem como texto; aqui só adicionamos
-- o status e os ids/datas de cada etapa.
--
-- SEGURANÇA (Zero Downtime): colunas aditivas com DEFAULT; nenhuma reescrita bloqueante.

ALTER TABLE pops_criados
    ADD COLUMN IF NOT EXISTS status            TEXT NOT NULL DEFAULT 'proposto',
    ADD COLUMN IF NOT EXISTS proposto_por_id   BIGINT,
    ADD COLUMN IF NOT EXISTS proposto_em       TIMESTAMP,
    ADD COLUMN IF NOT EXISTS analisado_por_id  BIGINT,
    ADD COLUMN IF NOT EXISTS analisado_em      TIMESTAMP,
    ADD COLUMN IF NOT EXISTS aprovado_por_id   BIGINT,
    ADD COLUMN IF NOT EXISTS aprovado_em       TIMESTAMP;

-- POPs que já existiam (pré-fluxo) são documentos já em uso: mantêm-se como 'aprovado' para não
-- aparecerem como pendentes. A data de aprovação recebe a Data da Versão (ou a criação).
UPDATE pops_criados
   SET status = 'aprovado',
       aprovado_em = COALESCE(
           CASE WHEN data_versao ~ '^\d{4}-\d{2}-\d{2}' THEN data_versao::timestamp END,
           created_at)
 WHERE status = 'proposto' AND is_deleted = FALSE;

-- rollback ALTER TABLE pops_criados DROP COLUMN IF EXISTS status, DROP COLUMN IF EXISTS proposto_por_id, DROP COLUMN IF EXISTS proposto_em, DROP COLUMN IF EXISTS analisado_por_id, DROP COLUMN IF EXISTS analisado_em, DROP COLUMN IF EXISTS aprovado_por_id, DROP COLUMN IF EXISTS aprovado_em;
