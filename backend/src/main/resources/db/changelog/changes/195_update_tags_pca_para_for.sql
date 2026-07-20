-- liquibase formatted sql
-- changeset system:195_update_tags_pca_para_for

-- 1. Insere as novas tags com PCA_FOR_ copiando os nomes das existentes
INSERT INTO tags_acoes (id, name)
SELECT REPLACE(id, 'PCA_', 'PCA_FOR_'), name
FROM tags_acoes
WHERE id LIKE 'PCA_%' AND id NOT LIKE 'PCA_FOR_%';

-- 2. Atualiza a tabela filha (permissoes_acoes) para apontar para as novas tags
UPDATE permissoes_acoes
SET tag_acoes_id = REPLACE(tag_acoes_id, 'PCA_', 'PCA_FOR_')
WHERE tag_acoes_id LIKE 'PCA_%' AND tag_acoes_id NOT LIKE 'PCA_FOR_%';

-- 3. Remove as tags antigas que agora estão sem dependências
DELETE FROM tags_acoes
WHERE id LIKE 'PCA_%' AND id NOT LIKE 'PCA_FOR_%';

-- rollback INSERT INTO tags_acoes (id, name) SELECT REPLACE(id, 'PCA_FOR_', 'PCA_'), name FROM tags_acoes WHERE id LIKE 'PCA_FOR_%';
-- rollback UPDATE permissoes_acoes SET tag_acoes_id = REPLACE(tag_acoes_id, 'PCA_FOR_', 'PCA_') WHERE tag_acoes_id LIKE 'PCA_FOR_%';
-- rollback DELETE FROM tags_acoes WHERE id LIKE 'PCA_FOR_%';
