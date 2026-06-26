-- liquibase formatted sql
-- changeset kaizen:166_add_apreciacao_aprovacoes_processos_negocio

-- Migration 166: Apreciação (comitês exigidos) + aprovações por comitê
--
-- CONTEXTO:
-- No cadastro do processo define-se a "apreciação": quais comitês (CGTIC e/ou CGovTIC,
-- ou nenhum) entram na camada de validação. Cada comitê exigido aprova com seu próprio
-- PDF + data. O processo vira "Modelo K1" quando está validado_final E todos os comitês
-- da apreciação têm aprovação (apreciação vazia => basta o validado_final).
--
-- Substitui o modelo de aprovação única (colunas aprovacao_* das migrations 163-165, que
-- não chegaram a ser usadas em produção e permanecem nulas).
--
-- SEGURANÇA (Zero Downtime): colunas JSONB nullable com default '[]', aditivas.
--   apreciacao: array de siglas, ex.: ["CGTIC","CGovTIC"]
--   aprovacoes: array de objetos { comite, filename, mime, data (base64), em (YYYY-MM-DD) }

ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS apreciacao JSONB DEFAULT '[]'::jsonb;
ALTER TABLE processos_negocio ADD COLUMN IF NOT EXISTS aprovacoes JSONB DEFAULT '[]'::jsonb;

-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS apreciacao;
-- rollback ALTER TABLE processos_negocio DROP COLUMN IF EXISTS aprovacoes;
