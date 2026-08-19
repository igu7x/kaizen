-- liquibase formatted sql
-- changeset kaizen:249_entregas_status_pendente_concluida
-- Entregas de projeto passam a ter apenas DOIS status: 'pendente' e 'concluida'.
-- A conclusao deixa de ser manual: o status vira consequencia de anexar a evidencia + a data.
-- 'concluida' ja existente e PRESERVADA (nunca regride) para nao zerar o progresso de projetos
-- concluidos antes desta regra; apenas 'nao_iniciada'/'em_andamento' viram 'pendente'.
-- Escrito de forma idempotente (DROP ... IF EXISTS nos dois nomes de constraint) para poder ser
-- reaplicado sem quebrar num banco que ja tenha recebido uma versao anterior deste script.

ALTER TABLE cadastros_projetos_entregas
    DROP CONSTRAINT IF EXISTS contratos_projetos_entregas_status_check;

ALTER TABLE cadastros_projetos_entregas
    DROP CONSTRAINT IF EXISTS cadastros_projetos_entregas_status_check;

UPDATE cadastros_projetos_entregas
   SET status = 'pendente'
 WHERE status IS NULL
    OR status IN ('nao_iniciada', 'em_andamento');

ALTER TABLE cadastros_projetos_entregas
    ALTER COLUMN status SET DEFAULT 'pendente';

ALTER TABLE cadastros_projetos_entregas
    ADD CONSTRAINT cadastros_projetos_entregas_status_check
    CHECK (status IN ('pendente', 'concluida'));

-- rollback ALTER TABLE cadastros_projetos_entregas DROP CONSTRAINT IF EXISTS cadastros_projetos_entregas_status_check;
-- rollback UPDATE cadastros_projetos_entregas SET status = 'nao_iniciada' WHERE status = 'pendente';
-- rollback ALTER TABLE cadastros_projetos_entregas ALTER COLUMN status SET DEFAULT 'nao_iniciada';
-- rollback ALTER TABLE cadastros_projetos_entregas ADD CONSTRAINT contratos_projetos_entregas_status_check CHECK (status IN ('nao_iniciada', 'em_andamento', 'concluida'));
