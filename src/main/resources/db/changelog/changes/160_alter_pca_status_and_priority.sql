-- liquibase formatted sql

-- changeset system:160_alter_pca_status
ALTER TABLE pcas
ALTER COLUMN status TYPE VARCHAR(50) USING CASE 
    WHEN status = 0 THEN 'NAO_INICIADA' 
    WHEN status = 1 THEN 'EM_ANDAMENTO' 
    WHEN status = 2 THEN 'CONCLUIDA' 
    ELSE 'NAO_INICIADA' 
END;
-- rollback ALTER TABLE pcas ALTER COLUMN status TYPE INTEGER USING CASE WHEN status = 'NAO_INICIADA' THEN 0 WHEN status = 'EM_ANDAMENTO' THEN 1 WHEN status = 'CONCLUIDA' THEN 2 ELSE 0 END;

-- changeset system:160_rename_and_alter_priority
ALTER TABLE pcas RENAME COLUMN priority_level TO priority;
ALTER TABLE pcas
ALTER COLUMN priority TYPE VARCHAR(50) USING CASE 
    WHEN priority = '1' THEN 'ALTO' 
    WHEN priority = '2' THEN 'MEDIO' 
    WHEN priority = '3' THEN 'BAIXO' 
    ELSE 'MEDIO' 
END;
-- rollback ALTER TABLE pcas ALTER COLUMN priority TYPE INTEGER USING CASE WHEN priority = 'ALTO' THEN 1 WHEN priority = 'MEDIO' THEN 2 WHEN priority = 'BAIXO' THEN 3 ELSE 1 END;
-- rollback ALTER TABLE pcas RENAME COLUMN priority TO priority_level;
