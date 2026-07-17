-- liquibase formatted sql
-- changeset kaizen:186_migrate_relacionamentos_to_users splitStatements:false

-- Migration 186: Altera referências de cadastros_pessoas para users
-- Foco principal na tabela cadastros_projetos (gestor_id, patrocinador_id)

DO $$
DECLARE
    constraint_name text;
BEGIN
    -- Remover FK de gestor_id se existir
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'cadastros_projetos' AND kcu.column_name = 'gestor_id' AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE cadastros_projetos DROP CONSTRAINT ' || constraint_name;
    END IF;

    -- Remover FK de patrocinador_id se existir
    SELECT tc.constraint_name INTO constraint_name
    FROM information_schema.table_constraints AS tc
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
    WHERE tc.table_name = 'cadastros_projetos' AND kcu.column_name = 'patrocinador_id' AND tc.constraint_type = 'FOREIGN KEY'
    LIMIT 1;

    IF constraint_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE cadastros_projetos DROP CONSTRAINT ' || constraint_name;
    END IF;
END $$;

-- Atualizar gestor_id para user_id correspondente
UPDATE cadastros_projetos p
SET gestor_id = cp.user_id
FROM cadastros_pessoas cp
WHERE cp.id = p.gestor_id;

-- Projetos que tinham gestor mas a pessoa não tem usuário ativo (user_id nulo) perdem o gestor
UPDATE cadastros_projetos p
SET gestor_id = NULL
WHERE gestor_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.gestor_id);

-- Atualizar patrocinador_id para user_id correspondente
UPDATE cadastros_projetos p
SET patrocinador_id = cp.user_id
FROM cadastros_pessoas cp
WHERE cp.id = p.patrocinador_id;

-- Idem para patrocinador
UPDATE cadastros_projetos p
SET patrocinador_id = NULL
WHERE patrocinador_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = p.patrocinador_id);

-- Adicionar novas FKs para users
ALTER TABLE cadastros_projetos 
  ADD CONSTRAINT fk_cadastros_projetos_gestor_id 
  FOREIGN KEY (gestor_id) REFERENCES users(id);

ALTER TABLE cadastros_projetos 
  ADD CONSTRAINT fk_cadastros_projetos_patrocinador_id 
  FOREIGN KEY (patrocinador_id) REFERENCES users(id);

-- Recriar a view vw_cadastros_projetos_completo para usar a tabela users
DROP VIEW IF EXISTS vw_cadastros_projetos_completo;

CREATE OR REPLACE VIEW public.vw_cadastros_projetos_completo AS
 SELECT p.id,
    p.codigo,
    p.nome,
    p.descricao_sintetica,
    p.objetivo,
    p.contexto_justificativa,
    p.fora_do_escopo,
    p.patrocinador_id,
    COALESCE(pat.nome_cc_fc, pat.name) AS patrocinador_nome,
    pat.id AS patrocinador_user_id,
    p.gestor_id,
    COALESCE(ges.nome_cc_fc, ges.name) AS gestor_nome,
    ges.id AS gestor_user_id,
    area.gestor_user_id AS diretor_user_id,
    p.ancoragem_estrategica_plano_gestao,
    p.ancoragem_estrategica_pep,
    p.ancoragem_estrategica_programa_x,
    p.escopo_sintetico,
    p.data_prevista_inicio,
    p.data_prevista_conclusao,
    p.status,
    p.prioridade,
    p.complexidade,
    p.abrangencia,
    p.havera_contratacao,
    p.valor_estimado_contratacao,
    p.progresso_percentual,
    p.saude,
    p.saude_justificativa,
    p.saude_ultima_revisao,
    p.tap_vinculado,
    p.tap_id,
    p.tap_versao,
    p.tap_gerado_em,
    p.observacoes_gerais,
    p.diretoria,
    p.ativo,
    p.created_at,
    p.updated_at,
    p.areas_vinculadas_ids,
    p.tap_validado_gestor_em,
    p.tap_validado_gestor_por,
    p.tap_validado_diretor_em,
    p.tap_validado_diretor_por,
    p.tap_validado_patrocinador_em,
    p.tap_validado_patrocinador_por,
    p.tap_recusado_em,
    p.tap_recusado_por,
    p.tap_recusado_por_nome,
    p.tap_recusado_comentario,
    p.tap_recusado_camada,
    tep.tipo_encerramento AS tep_tipo_encerramento,
    tep.tep_validado_gestor_em,
    tep.tep_validado_diretor_em,
    tep.tep_validado_patrocinador_em,
    tep.tep_versao,
    tep.tep_gerado_em,
    ( SELECT count(*) AS count
           FROM cadastros_projetos_entregas e
          WHERE e.projeto_id = p.id AND e.ativo = true) AS total_entregas,
    ( SELECT count(*) AS count
           FROM cadastros_projetos_entregas e
          WHERE e.projeto_id = p.id AND e.ativo = true AND e.status::text = 'concluida'::text) AS entregas_concluidas,
    ( SELECT count(*) AS count
           FROM cadastros_projetos_riscos r
          WHERE r.projeto_id = p.id AND r.ativo = true) AS total_riscos,
    ( SELECT count(*) AS count
           FROM cadastros_projetos_entraves en
          WHERE en.projeto_id = p.id AND en.ativo = true AND en.resolvido = false) AS entraves_pendentes,
    ( SELECT string_agg(DISTINCT u.nome::text, ', '::text ORDER BY (u.nome::text)) AS string_agg
           FROM cadastros_projetos_areas_execucao ae
             JOIN cadastros_unidades u ON u.id = ae.area_id
          WHERE ae.projeto_id = p.id) AS areas_execucao_diretorias,
    ( SELECT string_agg(DISTINCT i.nome::text, ', '::text ORDER BY (i.nome::text)) AS string_agg
           FROM cadastros_instrumentos_projetos ip
             JOIN cadastros_instrumentos_planejamento i ON i.id = ip.instrumento_id
          WHERE ip.projeto_id = p.id AND i.ativo = true) AS instrumentos_nomes,
    ( SELECT count(*) AS count
           FROM cadastros_instrumentos_projetos ip
             JOIN cadastros_instrumentos_planejamento i ON i.id = ip.instrumento_id
          WHERE ip.projeto_id = p.id AND i.ativo = true) AS total_instrumentos
   FROM cadastros_projetos p
     LEFT JOIN users pat ON pat.id = p.patrocinador_id
     LEFT JOIN users ges ON ges.id = p.gestor_id
     LEFT JOIN cadastros_areas area ON (
         (array_length(p.areas_vinculadas_ids, 1) >= 1 AND area.id = p.areas_vinculadas_ids[1])
         OR ((p.areas_vinculadas_ids IS NULL OR array_length(p.areas_vinculadas_ids, 1) IS NULL) AND area.id = p.cadastros_areas_id)
     ) AND area.ativo = true
     LEFT JOIN tep_termos_encerramento tep ON tep.projeto_id = p.id
  WHERE p.ativo = true
  ORDER BY p.codigo DESC;
