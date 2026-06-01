# POST-CUTOVER BUGS — defeitos reais do Node a corrigir após a migração

> Este arquivo **NÃO é** sobre divergências entre Node e Java (essas estão em `KNOWN_DIVERGENCES.md`).
>
> Este arquivo é sobre **defeitos reais do sistema atual** que a migração descobriu mas **não corrige** (porque a regra da migração é fidelidade ao Node). Cada entrada vira um issue a ser tratado **depois do cutover** — em ambos os backends simultaneamente, ou desligando o feature até decidir a UX correta.
>
> **Esta lista é entregue à equipe junto com o backend Java pronto.**

---

## Bug #1 — `home/resumo` campo `projetos` sempre retorna `{0, 0, 0}` em produção

**Endpoint afetado**: `GET /api/home/resumo` — campo `projetos` no payload de resposta

**Sintoma visível**: o dashboard da Home exibe sempre "0 projetos" em todos os 3 cards (`total`, `no_prazo`, `em_atraso`), independentemente da quantidade real de projetos no banco do usuário.

**Causa raiz**: a query SQL do bloco 15 do `home.service.ts` referencia uma coluna `data_fim_prevista` que **não existe** na tabela `pca_items`. O Postgres rejeita a query com `ERROR: column "data_fim_prevista" does not exist`. O `try/catch` vazio em volta engole o erro silenciosamente, e o bloco retorna o default `{0, 0, 0}`.

**Confirmação tripla** (verificada na 1ª tentativa da migração):
1. **Query SQL bruta direta no banco** → erro `column "data_fim_prevista" does not exist`
2. **Dataset real**: todos os 31 `pca_items` do dev DB estão com `status='Não Iniciada'` — mesmo sem o erro SQL, os filtros do query (`status IN ('em_andamento', 'em_planejamento')`) nunca casariam
3. **A/B Node × Java**: ambos retornam exatamente `{0, 0, 0}` byte-a-byte → confirmação de que o Java não introduziu novo bug; só replicou o existente

**Por quanto tempo esse bug está em produção**: indeterminado. Provavelmente desde o deploy do dashboard. Nunca foi reportado, possivelmente porque:
- Usuários assumem que "0 projetos" é o estado real do sistema deles
- O card é visualmente discreto e não chama atenção
- Ninguém reporta porque "está zerado, mas faz sentido"

**Coluna correta provável**: `data_estimada_contratacao` (que existe em `pca_items`). Confirmar com a equipe que mantém o módulo PCA.

**Possíveis correções pós-cutover**:

1. **Fix da query SQL** (caminho recomendado):
   - Trocar `data_fim_prevista` por `data_estimada_contratacao` (ou outra coluna existente que reflita a intenção original)
   - Reavaliar os filtros de `status` (atualmente `('em_andamento', 'em_planejamento')` — mas todos os 31 itens estão como `'Não Iniciada'`)
   - **Aplicar a correção nos DOIS backends ao mesmo tempo** (Node + Java) para manter paridade

2. **Desativar o card** (caminho conservador):
   - Frontend para de mostrar o card "Projetos" na Home até definição da UX
   - Backend mantém retorno `{0, 0, 0}` (que não é mais visível) ou passa a retornar `null`

3. **Reescrever a feature**:
   - Discutir com produto qual a intenção semântica original ("projetos da diretoria do usuário"? "projetos com prazo apertado"?)
   - Implementar de novo de forma testada e documentada

**Prioridade sugerida**: baixa-média. Não há indício de que usuário esteja sendo prejudicado (a feature não está sendo usada, basicamente). Mas é dívida técnica visível assim que alguém olhar o código.

**Responsável sugerido**: equipe que mantém o módulo Home + módulo PCA.

---

## Bug #2 — `gestao-estrategica` referencia tabela inexistente `instrumentos_planejamento`

**Endpoint afetado**:
- `GET /api/gestao-estrategica/projetos` (e `/projetos/:id`) — LEFT JOIN `instrumentos_planejamento`
- `POST/PUT/DELETE /api/gestao-estrategica/planos` — INSERT/UPDATE em `instrumentos_planejamento`
- `POST/PUT /api/gestao-estrategica/projetos` — lookup de `instrumento_nome` em `instrumentos_planejamento`

**Sintoma visível**: a aba de Projetos da Gestão Estratégica retorna erro 500 (lista não carrega). Criar/editar/excluir planos e criar/editar projetos também falham com 500.

**Causa raiz**: o `gestao-estrategica.service.ts` referencia a tabela `instrumentos_planejamento`, que **não existe** no schema. O nome correto é `cadastros_instrumentos_planejamento` (usado corretamente em `getAllPlanos`/`getPlanoById` no mesmo arquivo). O Postgres rejeita com `ERROR: relation "instrumentos_planejamento" does not exist`. Diferente do Bug #1, **não há try/catch** engolindo o erro — ele sobe como 500.

**Confirmação** (descoberta no Sprint 3 da migração):
1. `SELECT to_regclass('instrumentos_planejamento')` → `NULL` (não existe); `to_regclass('cadastros_instrumentos_planejamento')` → existe
2. Smoke test Java `GET /api/gestao-estrategica/projetos` → 500 com `relation "instrumentos_planejamento" does not exist`
3. O código Node (`gestao-estrategica.service.ts`) referencia literalmente `instrumentos_planejamento` em `getAllProjetos`, `getProjetoById`, `createPlano`, `updatePlano`, `deletePlano`, `createProjeto`, `updateProjeto` → o Node retornaria o **mesmo 500**

**Replicação no Java**: fiel — o Java referencia exatamente `instrumentos_planejamento` (mesmos nomes de tabela do Node), produzindo 500 idêntico. **Não é regressão do Java**; é defeito pré-existente do Node.

**Coluna/comportamento correto provável**: trocar `instrumentos_planejamento` por `cadastros_instrumentos_planejamento` nos 7 pontos do `gestao-estrategica.service.ts`. Avaliar também se `getEstatisticasPorDiretoria` (que usa `gestao_planos_programas`, tabela que existe) está semanticamente correta.

**Possíveis correções pós-cutover**: corrigir o nome da tabela nos DOIS backends simultaneamente (Node + Java) para manter paridade. Adicionar teste de fumaça que exercite a aba de Projetos.

**Prioridade sugerida**: média-alta — a aba de Projetos da Gestão Estratégica está quebrada em produção (500). Pode já estar sendo notada pelos usuários.

**Responsável sugerido**: equipe que mantém o módulo de Gestão Estratégica.

---

## Como adicionar novas entradas

Conforme outros bugs latentes forem descobertos durante o Sprint 10 (contract tests) ou durante o shadow traffic do Sprint 11, **adicione entrada `#2`, `#3`, ...** seguindo o template:

```markdown
## Bug #N — <título curto>

**Endpoint afetado**: <method + path>

**Sintoma visível**: <o que o usuário vê acontecer de errado>

**Causa raiz**: <descrição técnica>

**Confirmação**: <como foi verificado>

**Coluna/comportamento correto provável**: <hipótese da correção>

**Possíveis correções pós-cutover**: <opções>

**Prioridade sugerida**: <baixa/média/alta>

**Responsável sugerido**: <equipe ou pessoa>
```
