-- liquibase formatted sql
-- changeset kaizen:187_update_users_cadastros_areas_id

-- Tenta preencher cadastros_areas_id usando a coluna diretoria
UPDATE users u 
SET cadastros_areas_id = a.id 
FROM cadastros_areas a 
WHERE a.sigla = u.diretoria 
  AND u.cadastros_areas_id IS NULL;

-- Como fallback, tenta preencher a partir de cadastros_pessoas
UPDATE users u
SET cadastros_areas_id = (
    SELECT cp.area_id
    FROM cadastros_pessoas cp
    WHERE cp.user_id = u.id
    LIMIT 1
)
WHERE u.cadastros_areas_id IS NULL;

-- Repete o preenchimento de cadastros_unidades_id caso dependesse do cadastros_areas_id corrigido agora
UPDATE users u
SET cadastros_unidades_id = (
    SELECT cp.unidade_id
    FROM cadastros_pessoas cp
    WHERE cp.user_id = u.id
    LIMIT 1
)
WHERE u.cadastros_unidades_id IS NULL;
