-- Resultado Final (antiga "Avaliação Integrada")
--
-- A nota deixou de ser consenso digitado pelo gestor: agora é média ponderada entre a
-- avaliação de quem avalia (peso 70) e a autoavaliação do avaliado (peso 30), arredondada
-- para inteiro com o ,5 exato descendo (só sobe ACIMA de ,5).
--
-- Conta em inteiros pra não depender de ponto flutuante no limite do arredondamento:
--   decimos = 7*nota_gestor + 3*nota_autoavaliacao   (a nota final x10)
--   final   = decimos/10 + (1 se decimos%10 > 5)

-- changeset system:250_add_calculado_em_avaliacao_integrada
ALTER TABLE avaliacao_integrada_formularios
  ADD COLUMN IF NOT EXISTS calculado_em TIMESTAMP;
-- rollback ALTER TABLE avaliacao_integrada_formularios DROP COLUMN IF EXISTS calculado_em;

COMMENT ON COLUMN avaliacao_integrada_formularios.calculado_em
  IS 'Quando o Resultado Final foi calculado (media ponderada 70/30). Substitui a validacao em duas camadas.';

-- changeset system:250_recalcula_notas_resultado_final
-- Reescreve as notas dos registros existentes pela regra nova. Onde falta uma das pontas,
-- a nota que existe prevalece (mesmo comportamento do calculo em Java).
UPDATE avaliacao_integrada_respostas
SET nota_integrada = CASE
    WHEN nota_autoavaliacao IS NULL AND nota_gestor IS NULL THEN NULL
    WHEN nota_autoavaliacao IS NULL THEN nota_gestor
    WHEN nota_gestor IS NULL THEN nota_autoavaliacao
    ELSE (7 * nota_gestor + 3 * nota_autoavaliacao) / 10
         + CASE WHEN (7 * nota_gestor + 3 * nota_autoavaliacao) % 10 > 5 THEN 1 ELSE 0 END
  END;
-- rollback SELECT 1; -- nao ha como restaurar as notas de consenso anteriores

-- changeset system:250_marca_formularios_como_calculados
-- Sem consenso não há o que validar: os registros existentes passam a 'calculado'.
UPDATE avaliacao_integrada_formularios
SET status = 'calculado',
    calculado_em = COALESCE(calculado_em, validado_colaborador_em, validado_gestor_em, updated_at, created_at)
WHERE is_deleted = FALSE;
-- rollback SELECT 1;
