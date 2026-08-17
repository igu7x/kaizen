-- Correção da coluna id_cadastros_unidades para cadastros_unidades_id na tabela pcas
DO $$ 
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns 
              WHERE table_name='pcas' AND column_name='id_cadastros_unidades') THEN
        
        -- Verifica se a coluna de destino (cadastros_unidades_id) já existe
        IF NOT EXISTS(SELECT 1 FROM information_schema.columns 
                      WHERE table_name='pcas' AND column_name='cadastros_unidades_id') THEN
            -- Se não existe, apenas renomeia a antiga
            ALTER TABLE pcas RENAME COLUMN id_cadastros_unidades TO cadastros_unidades_id;
        ELSE
            -- Se já existe, atualiza os dados migrando os que não são nulos para a nova
            UPDATE pcas SET cadastros_unidades_id = id_cadastros_unidades 
            WHERE id_cadastros_unidades IS NOT NULL AND cadastros_unidades_id IS NULL;
            
            -- Em seguida, remove a coluna antiga
            ALTER TABLE pcas DROP COLUMN id_cadastros_unidades;
        END IF;

    END IF;
END $$;
