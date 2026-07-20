-- liquibase formatted sql
-- changeset kaizen:187_add_tag_pca_formacao_abertura

-- Criação da tag de ação exigida para visualização da fase de Abertura da Formação do PCA.

INSERT INTO tags_acoes(id, name) VALUES ('PCA_FORMACAO_ABERTURA', 'Ciclo Orçamentário -> Formação -> Visualizar Abertura')
ON CONFLICT (id) DO NOTHING;

-- rollback DELETE FROM tags_acoes WHERE id = 'PCA_FORMACAO_ABERTURA';
