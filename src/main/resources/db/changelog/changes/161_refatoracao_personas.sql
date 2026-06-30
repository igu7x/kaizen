-- changeset kaizen:161_refatoracao_personas runOnChange:true

-- Migration 161: Adicionar colunas de RH em users e refatorar organograma

-- 1. Adicionar colunas em users
ALTER TABLE users ADD COLUMN IF NOT EXISTS situacao_funcional VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS nome_cc_fc VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS classe_cc_fc VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS cargo_efetivo VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS classe_efetivo VARCHAR(100);

-- 2. Adicionar FK em pessoas_organograma_gestores
ALTER TABLE pessoas_organograma_gestores ADD COLUMN IF NOT EXISTS gestor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL;

-- 3. Migração de dados de RH (de cadastros_pessoas para users) e associação de e-mail/usuario
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'cadastros_pessoas') THEN
        -- Link user_id baseado em email ou no sufixo do usuario
        EXECUTE '
        UPDATE cadastros_pessoas cp
        SET user_id = u.id
        FROM users u
        WHERE cp.user_id IS NULL AND (cp.email = u.email OR u.email = (cp.usuario || ''@tjgo.jus.br''));
        ';

        -- Puxa dados de RH
        EXECUTE '
        UPDATE users u
        SET 
            situacao_funcional = cp.situacao,
            nome_cc_fc = cp.cc_fc,
            classe_cc_fc = cp.cc_fc_classe,
            cargo_efetivo = cp.cargo_efetivo,
            classe_efetivo = cp.cargo_efetivo_classe
        FROM cadastros_pessoas cp
        LEFT JOIN cadastros_unidades cu ON cu.id = cp.unidade_id
        WHERE cp.user_id = u.id;
        ';
    END IF;
END $$;

-- 4. Migração de fallback (de pessoas_colaboradores para users) para dados órfãos
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'pessoas_colaboradores') THEN
        EXECUTE '
        UPDATE users u
        SET 
            situacao_funcional = COALESCE(u.situacao_funcional, pc.situacao_funcional),
            nome_cc_fc = COALESCE(u.nome_cc_fc, pc.nome_cc_fc),
            classe_cc_fc = COALESCE(u.classe_cc_fc, pc.classe_cc_fc),
            cargo_efetivo = COALESCE(u.cargo_efetivo, pc.cargo_efetivo),
            classe_efetivo = COALESCE(u.classe_efetivo, pc.classe_efetivo)
        FROM pessoas_colaboradores pc
        WHERE u.name ILIKE pc.colaborador;
        ';
    END IF;
END $$;

-- 6. Migração automática de Vínculo de Gestores (Tenta associar gestor_user_id pelo nome_gestor)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'pessoas_organograma_gestores' AND column_name = 'nome_gestor') THEN
        EXECUTE '
        UPDATE pessoas_organograma_gestores o
        SET gestor_user_id = u.id
        FROM users u
        WHERE o.nome_gestor IS NOT NULL 
          AND o.nome_gestor != '''' 
          AND o.nome_gestor != ''Sem gestor''
          AND o.gestor_user_id IS NULL
          AND u.name ILIKE o.nome_gestor;
        ';
    END IF;
END $$;

-- rollback ALTER TABLE pessoas_organograma_gestores DROP COLUMN IF EXISTS gestor_user_id;
-- rollback ALTER TABLE pessoas_organograma_gestores DROP COLUMN IF EXISTS gestor_user_id;
-- rollback ALTER TABLE users DROP COLUMN IF EXISTS situacao_funcional, DROP COLUMN IF EXISTS nome_cc_fc, DROP COLUMN IF EXISTS classe_cc_fc, DROP COLUMN IF EXISTS cargo_efetivo, DROP COLUMN IF EXISTS classe_efetivo;
