-- liquibase formatted sql
-- changeset kaizen:254_create_competencias_gestor_editores
-- Editores da Matriz de Competencias do Gestor, por macroarea.
--
-- O diretor da area associa um usuario que passa a PREENCHER a matriz do gestor de todas as
-- unidades daquela area. O editor apenas salva: a camada 1 continua sendo referendada pelo gestor
-- da unidade, e as camadas de diretoria e final seguem inalteradas.
--
-- Vinculo por AREA (nao por unidade nem por formulario): e o recorte que o diretor administra, e
-- unidades novas da area passam a valer automaticamente, sem precisar reassociar o editor.
CREATE TABLE IF NOT EXISTS competencias_gestor_editores (
    id                 BIGSERIAL PRIMARY KEY,
    cadastros_areas_id INTEGER   NOT NULL REFERENCES cadastros_areas(id) ON DELETE CASCADE,
    user_id            INTEGER   NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by         INTEGER,
    CONSTRAINT uq_competencias_gestor_editores UNIQUE (cadastros_areas_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_competencias_gestor_editores_user
    ON competencias_gestor_editores (user_id);
-- rollback DROP TABLE IF EXISTS competencias_gestor_editores;
