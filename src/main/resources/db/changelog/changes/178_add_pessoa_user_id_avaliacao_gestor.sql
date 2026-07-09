-- liquibase formatted sql
-- changeset kaizen:178_add_pessoa_user_id_avaliacao_gestor

-- Migration 178: permitir que o diretor avalie o gestor de uma unidade ANTES da autoavaliação.
--
-- CONTEXTO:
-- Até aqui o "avaliado" da avaliação do gestor era identificado por pessoa_id = id da
-- autoavaliacao_formularios — logo, só dava pra avaliar quem já tinha se autoavaliado, e a
-- integração juntava os dois por af.id = ag.pessoa_id.
--
-- Agora o diretor seleciona a unidade e o gestor dela (cadastros_unidades.responsavel_user_id) e
-- avalia mesmo sem autoavaliação. Guardamos aqui a chave estável da pessoa avaliada
-- (pessoa_user_id). Quando o gestor se autoavaliar, AutoavaliacaoService faz o backfill de
-- ag.pessoa_id casando por (pessoa_user_id, unidade_id, tipo_inventario) — então TODA a máquina de
-- integração (que casa por af.id = ag.pessoa_id) continua funcionando sem alteração.
--
-- SEGURANÇA (Zero Downtime): coluna nullable, aditiva. Registros antigos seguem com pessoa_user_id
-- nulo e keyed por pessoa_id, sem mudança de comportamento.

ALTER TABLE avaliacao_gestor_formularios ADD COLUMN IF NOT EXISTS pessoa_user_id BIGINT;

CREATE INDEX IF NOT EXISTS idx_avaliacao_gestor_pessoa_user_id
    ON avaliacao_gestor_formularios (pessoa_user_id);

-- pessoa_id deixa de ser obrigatório: no fluxo novo o gestor é avaliado antes de existir a
-- autoavaliação, então não há id de autoavaliação para referenciar (o vínculo é feito depois,
-- via backfill). A pessoa passa a ser identificada por pessoa_user_id nesse caso.
ALTER TABLE avaliacao_gestor_formularios ALTER COLUMN pessoa_id DROP NOT NULL;

-- rollback ALTER TABLE avaliacao_gestor_formularios ALTER COLUMN pessoa_id SET NOT NULL;
-- rollback DROP INDEX IF EXISTS idx_avaliacao_gestor_pessoa_user_id;
-- rollback ALTER TABLE avaliacao_gestor_formularios DROP COLUMN IF EXISTS pessoa_user_id;
