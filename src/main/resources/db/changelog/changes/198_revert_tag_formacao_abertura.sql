-- liquibase formatted sql
-- changeset kaizen:198_revert_tag_formacao_abertura

UPDATE tags_acoes
SET id = 'PCA_FORMACAO_ABERTURA'
WHERE id = 'PCA_FOR_FORMACAO_ABERTURA';

UPDATE permissoes_acoes
SET tag_acoes_id = 'PCA_FORMACAO_ABERTURA'
WHERE tag_acoes_id = 'PCA_FOR_FORMACAO_ABERTURA';

-- rollback UPDATE permissoes_acoes SET tag_acoes_id = 'PCA_FOR_FORMACAO_ABERTURA' WHERE tag_acoes_id = 'PCA_FORMACAO_ABERTURA';
-- rollback UPDATE tags_acoes SET id = 'PCA_FOR_FORMACAO_ABERTURA' WHERE id = 'PCA_FORMACAO_ABERTURA';
