# KNOWN DIVERGENCES — divergências propositais entre Node e Java

> Cada entrada documenta uma diferença de comportamento entre os dois backends que foi **identificada na 1ª tentativa, discutida e aceita** como divergência consciente (não regressão).
>
> No Sprint 10 (contract tests), cada uma vira **exceção declarada** com `@KnownDivergence` — testes validam paridade APENAS nos campos não-divergentes.
>
> Quando começar a 2ª tentativa, **copie este arquivo pra `kaizen-api-java/docs/KNOWN_DIVERGENCES.md`** e mantenha-o vivo (adicione novas entradas conforme aparecerem).

---

## #1 — Formato do campo `caminho` em organograma (RESOLVIDO)

**Status**: ✅ Resolvido no Sprint 3 — **não é mais divergência**.

**O que era**: a view `pessoas_organograma_hierarquia` retorna `caminho` como `INTEGER[]` Postgres. Tentativa inicial usou `caminho::text` que produzia `"{22,23,24,25}"` em vez do `[22,23,24,25]` (JSON array) que o Node entregava.

**Solução**: serializer Jackson global para `java.sql.Array` emitindo JSON array nativo. Removido o cast `caminho::text`.

**Implementação**: `JacksonConfig.java` com `SimpleModule().addSerializer(java.sql.Array.class, new SqlArraySerializer())`.

---

## #2 — `UpdateUnidadeRequest.unidadeSuperiorId == null` ambíguo

**Tipo**: divergência de ergonomia da API.

**O que é**: em records Java não dá pra distinguir "campo ausente no JSON" de "campo presente com valor `null`". O Node distingue isso (`undefined` vs `null`) e trata diferente: `undefined` = "manter valor atual", `null` = "setar pra NULL" (desvincular).

**No Java atual**: `null` é interpretado como "manter".

**Impacto**: se o frontend nunca envia `null` explícito pra desvincular (provavelmente o caso — usa outro endpoint ou outro sentinela), a divergência é invisível.

**Ação no Sprint 10**: verificar comportamento do frontend. Se confirmar que nunca envia `null` explícito, fechar a entrada. Se enviar, migrar pra `JsonNullable<Long>` do `openapi-tools` ou `Optional<Optional<Long>>`.

---

## #3 — PUT cascateado em projetos perde IDs de entregas/riscos/entraves

**Status**: divergência aceita.

**O que é**: ao fazer `PUT /api/contratos/projetos/:id` o Node não faz diff inteligente — **soft-deleta antigos e cria novos** entregas/riscos/entraves. IDs antigos viram inacessíveis (FK órfãs).

**No Java**: replicado fielmente o mesmo comportamento.

**Por quê fica assim**: bug existe há tempo no Node; corrigir nos dois lados ao mesmo tempo (com diff inteligente) é o caminho **pós-cutover**, não durante a migração.

---

## #4 — Datas com ano > 9999 no banco (sujeira pré-existente)

**Status**: divergência aceita (não é divergência de implementação — é sujeira de dado).

**O que é**: o projeto id=8 tem `data_prevista_inicio = "+123123-03-12T00:00:00.000Z"` no banco. O Java serializa fielmente esse valor lixo.

**Impacto**: frontend pode ter validação que rejeita anos > 9999 — não é problema da migração.

**Ação**: deixar como está. Limpeza de dado pré-cutover, opcional.

---

## #5 — Forms publicados sem versionamento de respostas

**Status**: divergência aceita; **conversa pós-cutover** pendente.

**O que é**: `saveFormStructure` cascateia `soft-delete` de sections/fields antigos e cria novos com IDs novos. Respostas em `form_responses.value` JSONB referenciam `field_ids` que ficam órfãos (`is_deleted = TRUE` mas ainda apontados).

**Comportamento**: respostas antigas continuam acessíveis mas não conseguem ser renderizadas corretamente se o frontend depende dos field_ids vigentes.

**Ação**: confirmar com a equipe pós-cutover se forms publicados são imutáveis na prática (provável) ou se precisa de snapshot pattern (como TAP/Processos).

---

## #6 — `VALIDADORES_FINAIS` e `VALIDADORES_DIRETORIA` hardcoded em código

**Status**: divergência de **configuration smell** aceita.

**O que é**: em `competenciasGestor.service.ts`:
- `VALIDADORES_FINAIS` = lista hardcoded de 4 emails (`gmpdmaciel`, `dcamaral`, `ifccupertino`, `jdnascimento`) → **usado** no fluxo
- `VALIDADORES_DIRETORIA` = mapa de siglas pra emails (`DSTI`, `DITI`, `SGJT`, `GEJUT`) → **declarado mas NÃO referenciado** (a regra real consulta `cadastros_areas.gestor_user_id`)

**No Java**: replica fielmente — `VALIDADORES_FINAIS` num `Map<String,String>` estático + `VALIDADORES_DIRETORIA` declarado com comentário "/* paridade — não remover */" pra próximo dev não "limpar".

**Ação pós-cutover**: mover ambos pra `application.yml` ou usar `users.is_superadmin` (que já existe no schema).

---

## #7 — Usuários importantes podem estar com `is_deleted = TRUE` no banco

**Status**: **checklist pré-cutover**, não divergência de comportamento.

**O que é**: durante a 1ª tentativa, descobriu-se que `users.id = 1` está com `is_deleted = TRUE` no DB de dev (provavelmente smoke test antigo). O Java filtra `is_deleted = FALSE` em 100% das autenticações — qualquer admin/superadmin soft-deletado **para de logar**.

**Ação pré-cutover**: rodar contra os bancos de staging e produção:
```sql
SELECT id, name, email, role, is_superadmin, is_deleted
FROM users
WHERE is_deleted = TRUE AND (role IN ('ADMIN','MANAGER') OR is_superadmin = TRUE);
```
Se houver alguém importante na lista, restaurar via `UPDATE users SET is_deleted = FALSE WHERE id IN (...)` antes do cutover.

**Confirmação prática (Sprint 8, dev DB `kaizen_java_dev`)**: a query abaixo confirmou usuários soft-deletados:
```sql
SELECT id, email, is_deleted FROM users WHERE is_deleted = TRUE;
-- => ids 1, 2, 3 estão is_deleted = TRUE (estado herdado de smoke tests antigos)
```
Usuários **vivos** (`is_deleted = FALSE`) no dev: **4** e **6** (ADMIN + `is_superadmin`), **7** (VIEWER), **8** (MANAGER).
Consequência observada: tokens base64 `{"userId":1|2|3}` **não autenticam** (o filtro JWT usa `findAuthById` com `is_deleted = FALSE`). No Sprint 7 o `user 1` só "funcionou" pelo fallback Categoria A (`requestUserId()` → 1), não por autenticação real. Smoke tests daqui em diante usam **4/6/7/8**.
No DB de dev é só estado herdado, sem impacto. No pré-cutover de staging/produção: rodar a query e verificar se algum admin/superadmin importante está soft-deletado por engano.

---

## #8 — Bearer base64 `{"userId":N}` como atalho de smoke test (NÃO É DIVERGÊNCIA — É CONVENÇÃO)

**Status**: convenção de desenvolvimento documentada.

**O que é**: em vez de gerar JWT Keycloak válido pra testes manuais, usar:
```bash
TOKEN=$(printf '{"userId":4}' | base64 | tr -d '\n')
curl -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/...
```

**Por quê funciona**: o `JwtAuthenticationFilter` aceita tanto JWT Keycloak (com `.`) quanto base64 puro (sem `.`) decodificando o JSON e extraindo `userId`. Comportamento herdado do Node (`auth.ts` linhas 271-297) — login local também emite base64 puro, não JWT.

**Disclaimer**: usar **apenas em dev**. Produção sempre via Keycloak real.

---

## #9 — Bug latente do Node: `data_fim_prevista` column doesn't exist

**Status**: **bug do Node confirmado, replicado fielmente, escalável pós-cutover** (ver `POST_CUTOVER_BUGS.md`).

**O que é**: o endpoint `GET /api/home/resumo` faz uma query que referencia a coluna `data_fim_prevista` que **não existe na tabela `pca_items`**. O erro é silenciosamente engolido por um `try/catch` vazio no Node — o resultado é o card "projetos" sempre retornando `{total: 0, no_prazo: 0, em_atraso: 0}`.

**Confirmação tripla** (Sprint 10):
1. Query SQL bruta → `ERROR: column "data_fim_prevista" does not exist`
2. Dataset real: todos os 31 `pca_items` com `status='Não Iniciada'` — filtros do query nunca casariam mesmo sem o SQL error
3. A/B Node × Java → idêntico byte-a-byte (ambos retornam `{0,0,0}`)

**No Java**: replicado fielmente (try/catch silencioso preservado).

**Ação**: ver `POST_CUTOVER_BUGS.md` entrada #1 — coluna correta é provavelmente `data_estimada_contratacao`.

---

## #10 — Mensagem de erro 413 (body too large) diverge entre Node e Java

**Status**: divergência aceita; cobertura via `@KnownDivergence` validando apenas status code.

**O que é**:
- **Node**: usa o handler do `express.json({ limit: '2mb' })`. Body do 413 contém algo como `"PayloadTooLargeError: request entity too large"` + stack do Express.
- **Java**: validação explícita no service lança `ApiException(413, "Fluxograma muito grande. Tamanho máximo: 6MB.")` — mensagem PT custom.

**Status code**: ambos 413 ✅
**Body do erro**: diferente.

**Justificativa pra aceitar**: o frontend reage ao status 413, não ao texto da mensagem. Paridade comportamental preservada onde importa.

**Caminho de unificação pós-cutover** (recomendado): Java aceita body até ~25 MB no nível global e mantém a validação custom no service. Assim o erro PT custom aparece em todos os casos, e o Node passa a se beneficiar de uma versão similar.

---

## Como manter este documento vivo

Conforme novos contract tests forem rodados no Sprint 10 e novas divergências aparecerem, **adicione entrada #11, #12, ...** seguindo o template:

```markdown
## #N — <título curto>

**Status**: <aceita | resolvida | escalável pós-cutover>

**O que é**: <descrição do comportamento divergente>

**Por quê fica assim**: <justificativa>

**Ação**: <O que fazer — aceitar, corrigir agora, corrigir pós-cutover>
```
