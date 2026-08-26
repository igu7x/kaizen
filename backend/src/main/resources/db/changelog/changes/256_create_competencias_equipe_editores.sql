-- liquibase formatted sql
-- changeset kaizen:256_create_competencias_equipe_editores
-- Editores da Matriz de Competencias da EQUIPE, por unidade.
--
-- O gestor da unidade associa um usuario que passa a PREENCHER e SALVAR a matriz da equipe
-- daquela unidade. O editor apenas salva: nao valida nenhuma camada.
--
-- Diferenca em relacao ao editor da matriz do GESTOR (competencias_gestor_editores):
--   - la o vinculo e por AREA e quem associa e o diretor; a matriz preenchida por editor pula a
--     camada 1 e sobe direto para a diretoria, porque o diretor que delegou ja e o proximo a
--     validar;
--   - aqui o vinculo e por UNIDADE e quem associa e o gestor da unidade, que E o validador da
--     camada 1. Entao a camada 1 continua existindo e passa a ser dele: ele delega o
--     preenchimento mas segue respondendo pelo que sai da unidade.
--
-- Vinculo por UNIDADE (nao por formulario): o editor vale para a matriz da equipe daquela unidade
-- em qualquer ciclo, sem precisar reassociar a cada formulario novo.
CREATE TABLE IF NOT EXISTS competencias_equipe_editores (
    id                    BIGSERIAL PRIMARY KEY,
    cadastros_unidades_id INTEGER   NOT NULL REFERENCES cadastros_unidades(id) ON DELETE CASCADE,
    user_id               INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by            INTEGER,
    CONSTRAINT uq_competencias_equipe_editores UNIQUE (cadastros_unidades_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competencias_equipe_editores_user
    ON competencias_equipe_editores (user_id);
-- rollback DROP TABLE IF EXISTS competencias_equipe_editores;
