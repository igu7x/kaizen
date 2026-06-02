-- Migration 151: Cria a tabela permissoes_tap para o módulo "Permissões do TAP"
--
-- CONTEXTO:
-- Hoje só ADMIN/superadmin (e o gestor do projeto, em alguns endpoints específicos)
-- pode editar os 13 campos que compõem o TAP de um projeto:
--   nome, tap_vinculado, data_prevista_inicio, data_prevista_conclusao, objetivo,
--   contexto_justificativa, patrocinador_id, gestor_id, escopo_sintetico,
--   fora_do_escopo, entregas (>=1), instrumentos (Ancoragem >=1), prioridade, complexidade.
--
-- O novo módulo "Permissões do TAP" (em Cadastros) permite que um admin conceda
-- a um usuário específico a capacidade de editar esses 13 campos, MAS apenas em
-- projetos cuja diretoria (contratos_projetos.diretoria) coincida com a diretoria
-- do próprio usuário (users.diretoria). Ou seja: a permissão é binária por usuário,
-- com o escopo de diretoria avaliado em tempo de execução.
--
-- ESCOPO:
-- - Granularidade: por usuário (não por projeto).
-- - Escopo do usuário: derivado de users.diretoria.
-- - Campos liberados: apenas os 13 do TAP (outros campos seguem regra original).
--
-- Idempotente.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'permissoes_tap'
    ) THEN
        CREATE TABLE permissoes_tap (
            user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            granted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
            granted_at   TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_permissoes_tap_granted_by ON permissoes_tap(granted_by);

        COMMENT ON TABLE  permissoes_tap            IS 'Usuários autorizados a editar os 13 campos do TAP em projetos da sua própria diretoria. Concedida via Cadastros > Permissões do TAP.';
        COMMENT ON COLUMN permissoes_tap.user_id    IS 'Usuário que recebeu a permissão. Escopo de edição é restrito a contratos_projetos.diretoria == users.diretoria.';
        COMMENT ON COLUMN permissoes_tap.granted_by IS 'Admin que concedeu a permissão.';

        RAISE NOTICE '151: Tabela permissoes_tap criada.';
    ELSE
        RAISE NOTICE '151: Tabela permissoes_tap já existia, nenhuma alteração feita.';
    END IF;
END $$;
