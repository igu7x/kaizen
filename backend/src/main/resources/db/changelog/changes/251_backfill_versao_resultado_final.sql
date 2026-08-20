-- Resultado Final: versao dos registros calculados antes do versionamento existir
--
-- Ate agora so o fluxo manual (validarColaborador, ja removido) incrementava
-- versao_formulario. Os registros gerados pelo calculo nasciam em 0, e a tela esconde o selo
-- de versao e o historico quando o numero e 0. O codigo passou a gravar versao + snapshot a
-- cada calculo; aqui ficam os registros que vieram antes disso.

-- changeset system:251_versao_inicial_resultado_final
-- Todo resultado ja calculado passa a ser a versao 1.
UPDATE avaliacao_integrada_formularios
SET versao_formulario = 1
WHERE status = 'calculado'
  AND COALESCE(versao_formulario, 0) = 0
  AND is_deleted = FALSE;
-- rollback SELECT 1;

-- changeset system:251_snapshot_inicial_resultado_final
-- O numero sozinho abriria um historico vazio: monta o snapshot da versao 1 com o mesmo
-- formato que o Java grava (colunas do formulario + avaliador_user_name, unidade_nome,
-- colaborador_user_id e o array de respostas). So para quem ainda nao tem snapshot nenhum —
-- registros do fluxo antigo ja trazem os seus.
INSERT INTO avaliacao_integrada_versoes (formulario_id, versao, dados, validado_em, validado_nome)
SELECT f.id,
       f.versao_formulario,
       to_jsonb(f) || jsonb_build_object(
           'avaliador_user_name', u.name,
           'unidade_nome', cu.nome,
           'colaborador_user_id', af.user_id,
           'respostas', COALESCE(
               (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.ordem)
                  FROM avaliacao_integrada_respostas r
                 WHERE r.formulario_id = f.id),
               '[]'::jsonb)
       ),
       COALESCE(f.calculado_em, f.updated_at, f.created_at),
       NULL
FROM avaliacao_integrada_formularios f
LEFT JOIN users u ON u.id = f.avaliador_user_id
LEFT JOIN cadastros_unidades cu ON cu.id = f.unidade_id
LEFT JOIN autoavaliacao_formularios af ON af.id = f.autoavaliacao_id
WHERE f.status = 'calculado'
  AND f.is_deleted = FALSE
  AND COALESCE(f.versao_formulario, 0) > 0
  AND NOT EXISTS (
      SELECT 1 FROM avaliacao_integrada_versoes v WHERE v.formulario_id = f.id
  )
ON CONFLICT (formulario_id, versao) DO NOTHING;
-- rollback SELECT 1;
