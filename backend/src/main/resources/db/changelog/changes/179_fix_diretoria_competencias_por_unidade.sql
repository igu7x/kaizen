-- liquibase formatted sql
-- changeset kaizen:179_fix_diretoria_competencias_por_unidade

-- Migration 179: corrige a diretoria dos formulários de competências do gestor que ficou com a
-- diretoria de QUEM editou, em vez da MACROÁREA da unidade.
--
-- CONTEXTO:
-- A diretoria do formulário deve ser sempre a macroárea da unidade selecionada
-- (cadastros_unidades.area_id → cadastros_areas.sigla). Um editor de outra diretoria (ex.: o
-- validador final da SGJT editando um formulário da DPE) sobrescrevia a diretoria com a dele.
-- O CompetenciasGestorService agora deriva a diretoria da unidade; esta migration conserta os
-- registros já gravados.
--
-- SEGURANÇA: corretiva, idempotente, não-destrutiva. Atualiza apenas linhas cuja diretoria diverge
-- da macroárea da unidade e cuja unidade resolve uma macroárea.

UPDATE competencias_gestor_formularios f
   SET diretoria = a.sigla, updated_at = NOW()
  FROM cadastros_unidades u
  JOIN cadastros_areas a ON a.id = u.area_id
 WHERE f.unidade_id = u.id
   AND f.is_deleted = FALSE
   AND f.diretoria IS DISTINCT FROM a.sigla;

-- rollback SELECT 1; -- correção de dados não é revertida (não há valor anterior confiável a restaurar)
