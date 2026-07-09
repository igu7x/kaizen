-- liquibase formatted sql
-- changeset kaizen:185_seed_tags_acoes_formacao_pca

-- Migration 185: Seed das tags de Permissão de Ação (Camada D) para a esteira de Formação PCA-TIC.
--
-- CONTEXTO:
-- Cada tag representa uma transição de estado ou validação crítica que só pode ser executada
-- por uma Autoridade com concessão explícita na tabela permissoes_acoes. Tarefas de edição
-- (Editor) NÃO possuem tags — são protegidas pelas Camadas A (filtro de dados) e B (perfis/roles).
--
-- As concessões (INSERT em permissoes_acoes) serão feitas manualmente pelo Administrador
-- no Painel de Permissões do sistema.

INSERT INTO tags_acoes (id, name) VALUES
    ('PCA_REGISTRAR_PROAD',              'Registrar PROAD de instrução'),
    ('PCA_ENCAMINHAR_CONSULTA',          'Encaminhar DFD — Consulta às áreas'),
    ('PCA_VALIDAR_DEMANDA_1_CAMADA',     'Validar demanda (1ª camada — Gestor Unidade)'),
    ('PCA_VALIDAR_DEMANDA_2_CAMADA',     'Validar demanda (2ª camada — Diretor de Área)'),
    ('PCA_REMETER_PARTICAO',             'Remeter partição da unidade'),
    ('PCA_CONSOLIDAR_ENCAMINHAR_GEJUT',  'Consolidar DFD e encaminhar à GEJUT'),
    ('PCA_ENCAMINHAR_SGJT',              'Encaminhar produto à SGJT'),
    ('PCA_PAUTAR_COMITES',               'Pautar nos comitês (CGTIC/CGOVTIC)'),
    ('PCA_AUTORIZAR_COMITES',            'Autorizar após deliberação dos comitês'),
    ('PCA_INSTRUIR_PRODUTO_FINAL',       'Instruir produto final e ajustes'),
    ('PCA_REMETER_DG',                   'Remeter à Diretoria-Geral para publicação'),
    ('PCA_REGISTRAR_PUBLICACAO',         'Registrar publicação (reflete ato externo da DG)')
ON CONFLICT (id) DO NOTHING;

-- rollback DELETE FROM tags_acoes WHERE id IN ('PCA_REGISTRAR_PROAD','PCA_ENCAMINHAR_CONSULTA','PCA_VALIDAR_DEMANDA_1_CAMADA','PCA_VALIDAR_DEMANDA_2_CAMADA','PCA_REMETER_PARTICAO','PCA_CONSOLIDAR_ENCAMINHAR_GEJUT','PCA_ENCAMINHAR_SGJT','PCA_PAUTAR_COMITES','PCA_AUTORIZAR_COMITES','PCA_INSTRUIR_PRODUTO_FINAL','PCA_REMETER_DG','PCA_REGISTRAR_PUBLICACAO');
