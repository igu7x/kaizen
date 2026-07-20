-- liquibase formatted sql
-- changeset kaizen:197_fix_tags_em_consulta

-- Cria as tags com sufixo _1 e _2 para Formação, copiando e adaptando as existentes de "_EM_CONSULTA"
INSERT INTO tags_acoes (id, name)
SELECT REPLACE(id, '_EM_CONSULTA', '_EM_CONSULTA_1'), name || ' (1ª Camada)'
FROM tags_acoes WHERE id LIKE 'PCA_FOR_%_EM_CONSULTA';

INSERT INTO permissoes_acoes (user_id, tag_acoes_id, area_id)
SELECT user_id, REPLACE(tag_acoes_id, '_EM_CONSULTA', '_EM_CONSULTA_1'), area_id
FROM permissoes_acoes WHERE tag_acoes_id LIKE 'PCA_FOR_%_EM_CONSULTA'
ON CONFLICT DO NOTHING;

INSERT INTO tags_acoes (id, name)
SELECT REPLACE(id, '_EM_CONSULTA', '_EM_CONSULTA_2'), name || ' (2ª Camada)'
FROM tags_acoes WHERE id LIKE 'PCA_FOR_%_EM_CONSULTA';

INSERT INTO permissoes_acoes (user_id, tag_acoes_id, area_id)
SELECT user_id, REPLACE(tag_acoes_id, '_EM_CONSULTA', '_EM_CONSULTA_2'), area_id
FROM permissoes_acoes WHERE tag_acoes_id LIKE 'PCA_FOR_%_EM_CONSULTA'
ON CONFLICT DO NOTHING;

-- Remover a antiga tag genérica
DELETE FROM permissoes_acoes WHERE tag_acoes_id LIKE 'PCA_FOR_%_EM_CONSULTA';
DELETE FROM tags_acoes WHERE id LIKE 'PCA_FOR_%_EM_CONSULTA';

-- rollback DELETE FROM tags_acoes WHERE id LIKE 'PCA_FOR_%_EM_CONSULTA_1' OR id LIKE 'PCA_FOR_%_EM_CONSULTA_2';
