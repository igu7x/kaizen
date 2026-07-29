--liquibase formatted sql

--changeset kaizen:204_backfill_cadastros_areas_id_competencias_gestor
-- Migration 204: backfill de cadastros_areas_id em competencias_gestor_formularios.
--
-- O create do formulário não gravava cadastros_areas_id (só a sigla `diretoria`), então
-- formulários novos ficavam com cadastros_areas_id NULL e sumiam das listagens filtradas por
-- diretoria (que passaram a usar cadastros_areas_id após o refactor). A migration 185 fez o
-- backfill de então, mas linhas criadas depois voltaram a ficar NULL. Preenche pela macroárea da
-- unidade (cadastros_unidades.area_id) e, como fallback, pela sigla da diretoria.
--
-- SEGURANÇA (Zero Downtime): apenas UPDATE de linhas com valor ausente; idempotente.

UPDATE competencias_gestor_formularios f
SET cadastros_areas_id = u.area_id
FROM cadastros_unidades u
WHERE f.unidade_id = u.id
  AND f.cadastros_areas_id IS NULL
  AND u.area_id IS NOT NULL;

UPDATE competencias_gestor_formularios f
SET cadastros_areas_id = a.id
FROM cadastros_areas a
WHERE f.cadastros_areas_id IS NULL
  AND f.diretoria IS NOT NULL
  AND a.sigla = f.diretoria;

--rollback SELECT 1;
