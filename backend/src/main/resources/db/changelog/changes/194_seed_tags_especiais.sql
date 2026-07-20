-- liquibase formatted sql
-- changeset kaizen:194_seed_tags_especiais

INSERT INTO tags_acoes (id, name) VALUES
    ('PCA_MODIFICACAO_ESPECIAL', 'Modificação Especial (IFO)'),
    ('PCA_MODIFICACAO_CCA', 'Modificação Especial CCA (IFO)')
ON CONFLICT (id) DO NOTHING;

-- rollback DELETE FROM tags_acoes WHERE id IN ('PCA_MODIFICACAO_ESPECIAL', 'PCA_MODIFICACAO_CCA');
