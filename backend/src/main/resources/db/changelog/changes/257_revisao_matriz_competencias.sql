-- liquibase formatted sql

-- changeset kaizen:257_revisao_matriz_staging
-- "Revisar Matriz": reabrir uma matriz ja validada (status 'validado_final') para edicao, mandando
-- o resultado de novo pelas camadas de validacao. Ao fim do ciclo `versao_formulario` incrementa,
-- o que ja acontece sozinho em validarFinal.
--
-- O ponto delicado e que a versao VIGENTE precisa continuar valendo enquanto a revisao corre:
-- Lacunas e Inventario leem `competencias_gestor_itens` ao vivo, filtrando por
-- `validado_final_em IS NOT NULL`. Se a revisao escrevesse direto nos itens, a unidade passaria a
-- expor competencia nao aprovada; se zerasse validado_final_em, a unidade sumiria desses modulos.
--
-- Por isso a revisao NAO toca em nada vigente: o payload editado fica parado em `revisao_dados`
-- (mesmo formato do corpo do PUT /competencias-gestor/{id}) e so e aplicado sobre as tabelas reais
-- quando a validacao final do novo ciclo sai. Staging em JSONB na propria linha, e nao uma coluna
-- de flag em `competencias_gestor_itens`, porque aquela tabela e lida em ~20 pontos espalhados por
-- 4 services -- um unico ponto sem o filtro duplicaria competencia em silencio.
ALTER TABLE competencias_gestor_formularios
    ADD COLUMN IF NOT EXISTS em_revisao BOOLEAN NOT NULL DEFAULT FALSE;
-- rollback ALTER TABLE competencias_gestor_formularios DROP COLUMN IF EXISTS em_revisao;

-- changeset kaizen:257_revisao_matriz_dados
ALTER TABLE competencias_gestor_formularios
    ADD COLUMN IF NOT EXISTS revisao_dados JSONB;
-- rollback ALTER TABLE competencias_gestor_formularios DROP COLUMN IF EXISTS revisao_dados;

-- changeset kaizen:257_revisao_matriz_validado_final_anterior
-- Registro de quando o ciclo ANTERIOR foi aprovado. Enquanto a revisao corre, `status` volta para
-- 'enviado'/'validado_autor' e as colunas validado_* do ciclo em andamento sao limpas -- mas
-- validado_final_em precisa permanecer preenchida, senao a unidade sai do Lacunas. Esta coluna
-- guarda a data para a tela conseguir dizer "v2 vigente, revisao em andamento" sem ambiguidade.
ALTER TABLE competencias_gestor_formularios
    ADD COLUMN IF NOT EXISTS revisao_iniciada_em TIMESTAMP;
-- rollback ALTER TABLE competencias_gestor_formularios DROP COLUMN IF EXISTS revisao_iniciada_em;

-- changeset kaizen:257_revisao_matriz_index
-- A tela de revisao lista as unidades que ja tem matriz validada do tipo; o filtro e sempre
-- (tipo, is_deleted, validado_final_em NOT NULL).
CREATE INDEX IF NOT EXISTS idx_cgf_revisao_tipo_validada
    ON competencias_gestor_formularios (tipo, unidade_id)
    WHERE is_deleted = FALSE AND validado_final_em IS NOT NULL;
-- rollback DROP INDEX IF EXISTS idx_cgf_revisao_tipo_validada;
