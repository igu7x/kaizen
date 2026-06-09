-- liquibase formatted sql
-- changeset kaizen:152 splitStatements:false

-- Migration 152: Renomeia tabelas/sequences/índices `contratos_projetos*` -> `cadastros_projetos*`
--
-- CONTEXTO E POR QUÊ
-- ==================
-- O módulo de cadastros administrativos (Projetos + aninhados: Entregas, Tarefas,
-- Riscos, Entraves, Áreas de execução) é chamado de "Cadastros" no produto. No
-- backend Node original (anos atrás), as tabelas foram criadas com prefixo
-- `contratos_projetos_*` por confusão de nomenclatura, gerando o seguinte ruído:
--
--   - O módulo aparece como "Cadastros" no menu, na URL (/cadastros/projetos) e no
--     código (CadastrosController, CadastrosProjetosService — refator jun/2026).
--   - Mas as tabelas continuam com nome `contratos_projetos*` — confunde quem lê
--     o SQL, e ainda colide visualmente com o módulo distinto "Contratações de TI"
--     (PCA), que NÃO tem nada a ver.
--
-- Esta migration corrige o ruído: tabelas, sequences e índices passam a se chamar
-- `cadastros_projetos*`. NÃO MUDA ESQUEMA — só renomeia.
--
--
-- ATENÇÃO — PRÉ-REQUISITOS ANTES DE RODAR EM PRODUÇÃO
-- ===================================================
-- Esta migration QUEBRA o backend Node enquanto ele estiver referenciando os nomes
-- antigos. NÃO RODAR em ambiente compartilhado sem coordenação. Ordem segura:
--
--   1. Garantir que o backend Java (deste monorepo) já foi atualizado para usar
--      `cadastros_projetos*` em todas as 119 queries SQL espalhadas pelos services
--      — em jun/2026 ainda usavam o nome antigo; precisa de PR/MR de acompanhamento.
--   2. Garantir que o backend Node institucional do TJGO foi atualizado da mesma
--      forma (auditoria estimada: ~80 referências). Coordenar com a equipe institucional.
--   3. Auditar consumidores externos: dashboards de BI (Power BI / Metabase /
--      Grafana), scripts de backup, jobs agendados, sync staging↔prod.
--   4. Agendar janela de manutenção com DBA + infra.
--   5. Parar todos os backends (Node e Java) e rodar esta migration.
--   6. Subir os backends com o código atualizado (item 1 e 2).
--   7. Smoke test: login + abrir 1 projeto + gerar TAP.
--   8. Manter o rollback (no fim deste arquivo) pronto para uso imediato caso
--      algo dê errado.
--
-- Em DEV local, a ordem é mais simples: parar `dev.ps1` do Java, rodar a migration,
-- aplicar a versão atualizada do Java (com as 119 queries reescritas), subir.
--
--
-- ROLLBACK
-- ========
-- A reversão está documentada no fim deste arquivo (comentada). Para reverter:
-- copiar o bloco de rollback para um novo arquivo e executar.
--
--
-- IDEMPOTÊNCIA
-- ============
-- Os RENAME só rodam se a tabela antiga ainda existir (IF EXISTS via TO_REGCLASS).
-- Rodar duas vezes é seguro: na segunda execução, vira no-op.


-- =============================================================================
-- 1. TABELAS (7)
-- =============================================================================
DO $$
BEGIN
    IF TO_REGCLASS('public.contratos_projetos') IS NOT NULL THEN
        ALTER TABLE public.contratos_projetos RENAME TO cadastros_projetos;
        RAISE NOTICE '152: contratos_projetos -> cadastros_projetos';
    END IF;

    IF TO_REGCLASS('public.contratos_projetos_areas_execucao') IS NOT NULL THEN
        ALTER TABLE public.contratos_projetos_areas_execucao RENAME TO cadastros_projetos_areas_execucao;
        RAISE NOTICE '152: contratos_projetos_areas_execucao -> cadastros_projetos_areas_execucao';
    END IF;

    IF TO_REGCLASS('public.contratos_projetos_entregas') IS NOT NULL THEN
        ALTER TABLE public.contratos_projetos_entregas RENAME TO cadastros_projetos_entregas;
        RAISE NOTICE '152: contratos_projetos_entregas -> cadastros_projetos_entregas';
    END IF;

    IF TO_REGCLASS('public.contratos_projetos_entregas_responsaveis') IS NOT NULL THEN
        ALTER TABLE public.contratos_projetos_entregas_responsaveis RENAME TO cadastros_projetos_entregas_responsaveis;
        RAISE NOTICE '152: contratos_projetos_entregas_responsaveis -> cadastros_projetos_entregas_responsaveis';
    END IF;

    IF TO_REGCLASS('public.contratos_projetos_entregas_tarefas') IS NOT NULL THEN
        ALTER TABLE public.contratos_projetos_entregas_tarefas RENAME TO cadastros_projetos_entregas_tarefas;
        RAISE NOTICE '152: contratos_projetos_entregas_tarefas -> cadastros_projetos_entregas_tarefas';
    END IF;

    IF TO_REGCLASS('public.contratos_projetos_riscos') IS NOT NULL THEN
        ALTER TABLE public.contratos_projetos_riscos RENAME TO cadastros_projetos_riscos;
        RAISE NOTICE '152: contratos_projetos_riscos -> cadastros_projetos_riscos';
    END IF;

    IF TO_REGCLASS('public.contratos_projetos_entraves') IS NOT NULL THEN
        ALTER TABLE public.contratos_projetos_entraves RENAME TO cadastros_projetos_entraves;
        RAISE NOTICE '152: contratos_projetos_entraves -> cadastros_projetos_entraves';
    END IF;
END $$;

-- =============================================================================
-- 2. SEQUENCES (7) — não são renomeadas automaticamente quando a tabela vira nova
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'contratos_projetos_id_seq') THEN
        ALTER SEQUENCE public.contratos_projetos_id_seq RENAME TO cadastros_projetos_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'contratos_projetos_areas_execucao_id_seq') THEN
        ALTER SEQUENCE public.contratos_projetos_areas_execucao_id_seq RENAME TO cadastros_projetos_areas_execucao_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'contratos_projetos_entregas_id_seq') THEN
        ALTER SEQUENCE public.contratos_projetos_entregas_id_seq RENAME TO cadastros_projetos_entregas_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'contratos_projetos_entregas_responsaveis_id_seq') THEN
        ALTER SEQUENCE public.contratos_projetos_entregas_responsaveis_id_seq RENAME TO cadastros_projetos_entregas_responsaveis_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'contratos_projetos_entregas_tarefas_id_seq') THEN
        ALTER SEQUENCE public.contratos_projetos_entregas_tarefas_id_seq RENAME TO cadastros_projetos_entregas_tarefas_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'contratos_projetos_riscos_id_seq') THEN
        ALTER SEQUENCE public.contratos_projetos_riscos_id_seq RENAME TO cadastros_projetos_riscos_id_seq;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.sequences WHERE sequence_name = 'contratos_projetos_entraves_id_seq') THEN
        ALTER SEQUENCE public.contratos_projetos_entraves_id_seq RENAME TO cadastros_projetos_entraves_id_seq;
    END IF;
END $$;

-- =============================================================================
-- 3. ÍNDICES / CONSTRAINTS UNIQUE (4) — mantêm referência via nome
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='contratos_projetos_codigo_key') THEN
        ALTER INDEX public.contratos_projetos_codigo_key RENAME TO cadastros_projetos_codigo_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='contratos_projetos_areas_execucao_projeto_id_area_id_key') THEN
        ALTER INDEX public.contratos_projetos_areas_execucao_projeto_id_area_id_key RENAME TO cadastros_projetos_areas_execucao_projeto_id_area_id_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='contratos_projetos_entregas_responsaveis_entrega_id_area_id_key') THEN
        ALTER INDEX public.contratos_projetos_entregas_responsaveis_entrega_id_area_id_key RENAME TO cadastros_projetos_entregas_responsaveis_entrega_id_area_id_key;
    END IF;
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname='public' AND indexname='contratos_projetos_tap_id_key') THEN
        ALTER INDEX public.contratos_projetos_tap_id_key RENAME TO cadastros_projetos_tap_id_key;
    END IF;
END $$;

-- =============================================================================
-- 4. VIEW (1) — definição interna já vai referenciar cadastros_projetos*
--    automaticamente (PostgreSQL rastreia via OID); só falta renomear o nome
--    da view em si.
-- =============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema='public' AND table_name='vw_contratos_projetos_completo') THEN
        ALTER VIEW public.vw_contratos_projetos_completo RENAME TO vw_cadastros_projetos_completo;
        RAISE NOTICE '152: vw_contratos_projetos_completo -> vw_cadastros_projetos_completo';
    END IF;
END $$;


-- =============================================================================
-- ROLLBACK (manter comentado — copiar para arquivo separado se precisar reverter)
-- =============================================================================
-- BEGIN;
--
-- ALTER TABLE public.cadastros_projetos RENAME TO contratos_projetos;
-- ALTER TABLE public.cadastros_projetos_areas_execucao RENAME TO contratos_projetos_areas_execucao;
-- ALTER TABLE public.cadastros_projetos_entregas RENAME TO contratos_projetos_entregas;
-- ALTER TABLE public.cadastros_projetos_entregas_responsaveis RENAME TO contratos_projetos_entregas_responsaveis;
-- ALTER TABLE public.cadastros_projetos_entregas_tarefas RENAME TO contratos_projetos_entregas_tarefas;
-- ALTER TABLE public.cadastros_projetos_riscos RENAME TO contratos_projetos_riscos;
-- ALTER TABLE public.cadastros_projetos_entraves RENAME TO contratos_projetos_entraves;
--
-- ALTER SEQUENCE public.cadastros_projetos_id_seq RENAME TO contratos_projetos_id_seq;
-- ALTER SEQUENCE public.cadastros_projetos_areas_execucao_id_seq RENAME TO contratos_projetos_areas_execucao_id_seq;
-- ALTER SEQUENCE public.cadastros_projetos_entregas_id_seq RENAME TO contratos_projetos_entregas_id_seq;
-- ALTER SEQUENCE public.cadastros_projetos_entregas_responsaveis_id_seq RENAME TO contratos_projetos_entregas_responsaveis_id_seq;
-- ALTER SEQUENCE public.cadastros_projetos_entregas_tarefas_id_seq RENAME TO contratos_projetos_entregas_tarefas_id_seq;
-- ALTER SEQUENCE public.cadastros_projetos_riscos_id_seq RENAME TO contratos_projetos_riscos_id_seq;
-- ALTER SEQUENCE public.cadastros_projetos_entraves_id_seq RENAME TO contratos_projetos_entraves_id_seq;
--
-- ALTER INDEX public.cadastros_projetos_codigo_key RENAME TO contratos_projetos_codigo_key;
-- ALTER INDEX public.cadastros_projetos_areas_execucao_projeto_id_area_id_key RENAME TO contratos_projetos_areas_execucao_projeto_id_area_id_key;
-- ALTER INDEX public.cadastros_projetos_entregas_responsaveis_entrega_id_area_id_key RENAME TO contratos_projetos_entregas_responsaveis_entrega_id_area_id_key;
-- ALTER INDEX public.cadastros_projetos_tap_id_key RENAME TO contratos_projetos_tap_id_key;
--
-- ALTER VIEW public.vw_cadastros_projetos_completo RENAME TO vw_contratos_projetos_completo;
--
-- COMMIT;


