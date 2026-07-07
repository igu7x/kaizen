-- liquibase formatted sql
-- changeset kaizen:176_fix_gerar_codigo_projeto splitStatements:false

-- Migration 176: corrige a função gerar_codigo_projeto().
--
-- BUG: a função (trigger BEFORE INSERT em cadastros_projetos, disparado quando codigo IS NULL)
-- ainda fazia SELECT ... FROM `contratos_projetos` — nome ANTIGO da tabela, renomeada para
-- `cadastros_projetos` na migration 152. Como ao criar um projeto o codigo vem NULL (é
-- auto-gerado por este trigger), o INSERT quebrava com "relation contratos_projetos does not
-- exist" → "Erro ao criar projeto". Aqui trocamos a referência para `cadastros_projetos`.
--
-- SEGURANÇA: CREATE OR REPLACE idempotente; não altera schema/dados.

CREATE OR REPLACE FUNCTION public.gerar_codigo_projeto()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_ano INTEGER;
    v_seq INTEGER;
BEGIN
    v_ano := EXTRACT(YEAR FROM CURRENT_DATE);
    SELECT COALESCE(MAX(
        CAST(SUBSTRING(codigo FROM 'PRJ-' || v_ano || '-(\d+)') AS INTEGER)
    ), 0) + 1
    INTO v_seq
    FROM cadastros_projetos
    WHERE codigo LIKE 'PRJ-' || v_ano || '-%';

    NEW.codigo := 'PRJ-' || v_ano || '-' || LPAD(v_seq::TEXT, 3, '0');
    RETURN NEW;
END;
$function$;

-- rollback SELECT 1;
