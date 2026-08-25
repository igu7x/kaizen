-- liquibase formatted sql

-- changeset kaizen:255_add_grau_minimo_esperado
-- "Grau de Impacto" (peso 1-3: Util/Importante/Critica) da lugar a "Grau minimo esperado" (1-5) no
-- preenchimento das duas matrizes (equipe e gestor).
--
-- Coluna NOVA em vez de reaproveitar `peso`: os dois campos medem coisas diferentes. Peso 3
-- ("Critica") dizia o quanto a AUSENCIA da competencia machuca; grau minimo 3 diz que nivel a
-- pessoa precisa ter para ser considerada capaz. Reusar a coluna reinterpretaria em silencio todo
-- o historico ja gravado.
--
-- Backfill em 3: era exatamente o corte que o relatorio de Lacunas usava por padrao, entao os
-- numeros das matrizes ja existentes nao mudam com esta migration.
ALTER TABLE competencias_gestor_itens
    ADD COLUMN IF NOT EXISTS grau_minimo_esperado INTEGER NOT NULL DEFAULT 3;
-- rollback ALTER TABLE competencias_gestor_itens DROP COLUMN IF EXISTS grau_minimo_esperado;

-- changeset kaizen:255_peso_default
-- `peso` e NOT NULL e deixa de ser preenchido pelo formulario. O default evita que qualquer
-- gravacao que o omita quebre; a coluna fica so como historico do criterio antigo.
ALTER TABLE competencias_gestor_itens
    ALTER COLUMN peso SET DEFAULT 1;
-- rollback ALTER TABLE competencias_gestor_itens ALTER COLUMN peso DROP DEFAULT;

-- changeset kaizen:255_grau_minimo_competencias_por_unidade
-- Espelho na tabela que replica as competencias da equipe por unidade (syncCompetenciasPorUnidade).
ALTER TABLE competencias_por_unidade
    ADD COLUMN IF NOT EXISTS grau_minimo_esperado INTEGER NOT NULL DEFAULT 3;
-- rollback ALTER TABLE competencias_por_unidade DROP COLUMN IF EXISTS grau_minimo_esperado;
