-- liquibase formatted sql
-- changeset system:196_inserir_tags_revisao_pca

-- Tags de transição de estado para Revisão do PCA (PCA_RN_...)
INSERT INTO tags_acoes (id, name) VALUES
  ('PCA_RN_VALIDAR_DEMANDA_1_CAMADA',    'Validar Demanda 1ª Camada (Revisão)'),
  ('PCA_RN_VALIDAR_DEMANDA_2_CAMADA',    'Validar Demanda 2ª Camada (Revisão)'),
  ('PCA_RN_CONSOLIDAR_ENCAMINHAR_GEJUT', 'Consolidar e Encaminhar à GEJUT (Revisão)'),
  ('PCA_RN_PAUTAR_COMITES',             'Pautar Comitês (Revisão)'),
  ('PCA_RN_AUTORIZAR_COMITES',          'Autorizar Comitês (Revisão)'),
  ('PCA_RN_REMETER_DG',                 'Remeter à DG (Revisão)'),
  ('PCA_RN_MODIFICAR_ITEM',             'Modificar Item PCA (Revisão)'),
  ('PCA_RN_MODIFICACAO_ESPECIAL',       'Modificação Especial (Revisão)'),
  ('PCA_RN_MODIFICACAO_CCA',            'Modificação CCA (Revisão)')
ON CONFLICT (id) DO NOTHING;

-- Limpar tags obsoletas da versão anterior (se existirem)
DELETE FROM permissoes_acoes WHERE tag_acoes_id IN ('PCA_RN_ENCAMINHAR_VALIDACAO', 'PCA_RN_CONSOLIDAR_ENCAMINHAR_CCA');
DELETE FROM tags_acoes WHERE id IN ('PCA_RN_ENCAMINHAR_VALIDACAO', 'PCA_RN_CONSOLIDAR_ENCAMINHAR_CCA');

-- Atualizar ciclos de revisão existentes que estejam nos estados antigos
UPDATE ciclo_orcamentario SET estado = 'em_consulta_1' WHERE finalidade = 'revisao' AND estado = 'janela_aberta';
UPDATE ciclo_orcamentario SET estado = 'em_consulta_2' WHERE finalidade = 'revisao' AND estado = 'em_rito_validacao';

-- rollback DELETE FROM tags_acoes WHERE id IN ('PCA_RN_VALIDAR_DEMANDA_1_CAMADA', 'PCA_RN_VALIDAR_DEMANDA_2_CAMADA', 'PCA_RN_CONSOLIDAR_ENCAMINHAR_GEJUT', 'PCA_RN_PAUTAR_COMITES', 'PCA_RN_AUTORIZAR_COMITES', 'PCA_RN_REMETER_DG', 'PCA_RN_MODIFICAR_ITEM', 'PCA_RN_MODIFICACAO_ESPECIAL', 'PCA_RN_MODIFICACAO_CCA');
