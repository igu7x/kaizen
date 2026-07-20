-- liquibase formatted sql
-- changeset kaizen:186_seed_permissoes_acoes_teste_dev

-- Inserção de dados de teste (concessão de tags de ação) para facilitar o desenvolvimento.
-- Atribui as tags da esteira PCA às autoridades atuais (Gestores CCA, Diretores, Responsáveis).
-- O usuário "Superadmin" (is_superadmin = true) já possui bypass automático.

-- 1. Atribui PCA_VALIDAR_DEMANDA_2_CAMADA e PCA_REMETER_PARTICAO para todos os Diretores de Área
INSERT INTO permissoes_acoes (user_id, tag_acoes_id, area_id)
SELECT gestor_user_id, 'PCA_VALIDAR_DEMANDA_2_CAMADA', id
FROM cadastros_areas
WHERE gestor_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM permissoes_acoes p 
      WHERE p.user_id = cadastros_areas.gestor_user_id 
        AND p.tag_acoes_id = 'PCA_VALIDAR_DEMANDA_2_CAMADA' 
        AND p.area_id = cadastros_areas.id
  );

INSERT INTO permissoes_acoes (user_id, tag_acoes_id, area_id)
SELECT gestor_user_id, 'PCA_REMETER_PARTICAO', id
FROM cadastros_areas
WHERE gestor_user_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM permissoes_acoes p 
      WHERE p.user_id = cadastros_areas.gestor_user_id 
        AND p.tag_acoes_id = 'PCA_REMETER_PARTICAO' 
        AND p.area_id = cadastros_areas.id
  );

-- 2. Atribui PCA_VALIDAR_DEMANDA_1_CAMADA para todos os Gestores de Unidade
INSERT INTO permissoes_acoes (user_id, tag_acoes_id, area_id)
SELECT responsavel_user_id, 'PCA_VALIDAR_DEMANDA_1_CAMADA', area_id
FROM cadastros_unidades
WHERE responsavel_user_id IS NOT NULL AND area_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM permissoes_acoes p 
      WHERE p.user_id = cadastros_unidades.responsavel_user_id 
        AND p.tag_acoes_id = 'PCA_VALIDAR_DEMANDA_1_CAMADA' 
        AND p.area_id = cadastros_unidades.area_id
  );

-- 3. Atribui as tags da CCA para o gestor da CCA
INSERT INTO permissoes_acoes (user_id, tag_acoes_id, area_id)
SELECT cu.responsavel_user_id, t.tag, cu.area_id
FROM cadastros_unidades cu
CROSS JOIN (VALUES 
    ('PCA_REGISTRAR_PROAD'),
    ('PCA_ENCAMINHAR_CONSULTA'),
    ('PCA_CONSOLIDAR_ENCAMINHAR_GEJUT'),
    ('PCA_INSTRUIR_PRODUTO_FINAL'),
    ('PCA_REMETER_DG'),
    ('PCA_REGISTRAR_PUBLICACAO')
) AS t(tag)
WHERE cu.nome = 'Coordenadoria de Contratações e Orçamento de TIC' 
  AND cu.responsavel_user_id IS NOT NULL
  AND cu.area_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM permissoes_acoes p 
      WHERE p.user_id = cu.responsavel_user_id 
        AND p.tag_acoes_id = t.tag 
        AND p.area_id = cu.area_id
  );

-- rollback DELETE FROM permissoes_acoes WHERE tag_acoes_id IN ('PCA_VALIDAR_DEMANDA_2_CAMADA', 'PCA_REMETER_PARTICAO', 'PCA_VALIDAR_DEMANDA_1_CAMADA', 'PCA_REGISTRAR_PROAD', 'PCA_ENCAMINHAR_CONSULTA', 'PCA_CONSOLIDAR_ENCAMINHAR_GEJUT', 'PCA_INSTRUIR_PRODUTO_FINAL', 'PCA_REMETER_DG', 'PCA_REGISTRAR_PUBLICACAO');
