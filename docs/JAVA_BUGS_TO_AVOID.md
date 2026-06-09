# JAVA BUGS TO AVOID — armadilhas que o Java caiu na 1ª tentativa

> **Leia este documento ANTES de codar cada sprint.** São 8 bugs reais que o Java introduziu na 1ª tentativa, descobertos por smoke tests ou contract tests, e que custaram tempo de debug.
>
> Cada entrada tem: **sintoma → causa → fix → como evitar desde o início.**

---

## Bug #1 — `requestUserId()` em endpoints que exigem auth (5 endpoints afetados)

**Sintoma**: contract test sem auth retorna 404 ou 200 (caindo no fallback) em vez do 401 que o Node retorna.

**Causa**: usar um helper de `userId` único pra todos os controllers. Mas o Node tem 2 padrões (Categoria A com fallback `|| 1`, Categoria B com check strict).

**Endpoints afetados na 1ª tentativa**:
- `HomeController.resumo()` — caía em userId=1 (soft-deleted) → 404
- `ProcessosNegocioController.validarAutor()` — fallback mascarava ausência de auth
- `ProcessosNegocioController.validarDiretoria()` — idem
- `ProcessosNegocioController.validarFinal()` — idem
- `ProcessosNegocioController.recusar()` — idem

**Fix**: dois helpers no `AuthContext`:
```java
public static Long requestUserId() {  // Categoria A — permissivo
    return getCurrentUser().map(AuthenticatedUser::id).orElse(1L);
}

public static Long currentUserId() {  // Categoria B — strict
    return getCurrentUser()
        .map(AuthenticatedUser::id)
        .orElseThrow(() -> new ApiException(401, "Não autenticado"));
}
```

**Como evitar desde o início**: ao implementar cada controller, consultar `AUTH_AUDIT_PRELOADED.md` e usar o helper certo. Endpoints identity-based **sempre** `currentUserId()`.

---

## Bug #2 — `java.sql.Date.toInstant()` throws `UnsupportedOperationException`

**Sintoma**: endpoint que retorna campo `DATE` do Postgres (ex: `/api/sprints/todos` com coluna `data_inicio`) explode com `UnsupportedOperationException` em vez de retornar `"2026-02-02T00:00:00.000Z"`.

**Causa**: `JdbcTemplate` mapeia coluna `DATE` pra `java.sql.Date`, que é uma subclasse "quebrada" de `java.util.Date` — não suporta `toInstant()`. O serializer Jackson default chama `toInstant()` e morre.

**Fix**: serializer dedicado pra `java.sql.Date` no `JacksonConfig`:
```java
SimpleModule module = new SimpleModule();
module.addSerializer(java.sql.Date.class, new JsonSerializer<java.sql.Date>() {
    @Override
    public void serialize(java.sql.Date value, JsonGenerator gen, SerializerProvider sp) throws IOException {
        Instant instant = value.toLocalDate().atStartOfDay(ZoneOffset.UTC).toInstant();
        gen.writeString(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss.SSS'Z'").withZone(ZoneOffset.UTC).format(instant));
    }
});
```

**Ordem importa**: o serializer de `java.sql.Date` precisa ser **registrado ANTES** do de `java.util.Date` (Jackson resolve subclasses na ordem de registro).

**Como evitar desde o início**: incluir esse serializer no `JacksonConfig` desde o Sprint 0.

---

## Bug #3 — JSONB arrays serializados como `String` em vez de `List<String>`

**Sintoma**: campo `processos_negocio.proprietarios` que deveria ser `["João", "Maria"]` no JSON chega no frontend como `"[\"João\",\"Maria\"]"` (string contendo JSON, não array).

**Causa**: `JdbcTemplate` mapeia coluna JSONB pra `org.postgresql.util.PGobject`. Sem serializer custom, Jackson serializa o `PGobject.toString()` como string literal.

**Fix**: serializer Jackson global pra `PGobject` que emite o JSON raw:
```java
module.addSerializer(PGobject.class, new JsonSerializer<PGobject>() {
    @Override
    public void serialize(PGobject value, JsonGenerator gen, SerializerProvider sp) throws IOException {
        String json = value.getValue();
        if (json == null || json.isEmpty()) {
            gen.writeNull();
        } else {
            gen.writeRawValue(json);  // raw — Jackson trata o conteúdo como JSON nativo
        }
    }
});
```

**Campos afetados** (replica em todos):
- `processos_negocio.{proprietarios, atores, areas_responsaveis, entradas, saidas, sistemas_ferramentas, normativos_referencias, documentos_anexados}`
- `cadastros_areas.areas_vinculadas_ids`
- `gestao_planos_programas.areas_vinculadas_ids`
- Qualquer `form_answers.value` no módulo de Forms

**Como evitar desde o início**: incluir o serializer de `PGobject` no `JacksonConfig` desde o Sprint 0.

---

## Bug #4 — `data_fim < ?` rejeitado pelo Postgres (text vs date)

**Sintoma**: `POST /api/sprints/atualizar-status` falha com `ERROR: operator does not exist: date < text`.

**Causa**: o placeholder `?` do JDBC envia o parâmetro como `text`. Postgres precisa cast explícito pra comparar com coluna `date`.

**Fix**: cast explícito no SQL:
```sql
SELECT * FROM sprints
WHERE data_fim < ?::date
```
(Nota: outras formas — `CAST(? AS date)` — também funcionam. Use o que ficar mais legível.)

**Como evitar desde o início**: **sempre que comparar parâmetro com coluna `date` ou `timestamp` no SQL, adicionar `::date` ou `::timestamp`**.

---

## Bug #5 — `caminho::text` produzindo formato Postgres array (`{1,2,3}`) em vez de JSON array (`[1,2,3]`)

**Sintoma**: campo `caminho` do organograma retorna `"{22,23,24,25}"` em vez de `[22,23,24,25]`.

**Causa**: a view `pessoas_organograma_hierarquia` retorna `caminho` como `INTEGER[]` Postgres. O cast `::text` produz a representação literal do Postgres, não JSON.

**Fix**: **NÃO usar cast `::text`**. Em vez disso, deixar o `JdbcTemplate` mapear pra `java.sql.Array` (nativo) e adicionar serializer global:
```java
module.addSerializer(java.sql.Array.class, new JsonSerializer<java.sql.Array>() {
    @Override
    public void serialize(java.sql.Array value, JsonGenerator gen, SerializerProvider sp) throws IOException {
        Object[] elements = (Object[]) value.getArray();
        gen.writeStartArray();
        for (Object e : elements) {
            gen.writeObject(e);
        }
        gen.writeEndArray();
    }
});
```

**Beneficiários** (todos os arrays nativos do Postgres ganham serialização correta):
- `pessoas_organograma_hierarquia.caminho`
- Qualquer coluna `INTEGER[]` ou `TEXT[]` no banco

**Como evitar desde o início**: incluir o serializer de `java.sql.Array` no `JacksonConfig` desde o Sprint 0 — **antes** de codar qualquer endpoint que toque organograma.

---

## Bug #6 — Diretório aninhado `kaizen-api-java/kaizen-api-java/` (compila mas Spring não carrega)

**Sintoma**: `mvn clean install` retorna `BUILD SUCCESS`, mas `curl localhost:8081/api/<endpoint>` retorna 404. Os controllers existem como `.class` mas o Spring não os escaneou.

**Causa**: arquivos criados acidentalmente em `kaizen-api-java/kaizen-api-java/src/main/java/...` (diretório aninhado) em vez de `kaizen-api-java/src/main/java/...`. Maven compila o que encontra; Spring escaneia só `src/main/java` do projeto correto.

**Como o erro acontece**: cada chamada do `Bash` tool do Claude é uma **sessão isolada**; `cd` não persiste. Se o Claude faz `cd subpasta` e depois cria arquivos com paths relativos, eles caem onde o shell estava (geralmente a raiz do projeto, não a subpasta).

**Fix**: sempre verificar `target/classes/.../*.class` após reorg de pacote:
```bash
find target/classes -name "*.class" | head
```
Se aparecer caminho duplicado tipo `target/classes/kaizen-api-java/...`, é diretório aninhado.

**Como evitar desde o início**:
1. **Sempre usar paths absolutos** ao criar/mover arquivos com tool de file system
2. **Verificar pwd** no início de cada sequência de comandos
3. Após qualquer reorg, rodar `find . -type d -name "kaizen-api-java"` pra detectar aninhamento

**Lição operacional grave**: o `rm -rf` que destruiu a 1ª tentativa foi consequência de tentar limpar um diretório aninhado e o shell estar em outro pwd que o esperado. **Use sempre caminhos absolutos em comandos destrutivos.**

---

## Bug #7 — `Map.of()` ou `Map<String,Object>` perdendo ordem de query params

**Sintoma**: endpoint da Home retorna links como `?tipo=equipe&matrizId=21` mas o Node retorna `?matrizId=21&tipo=equipe` (ordem diferente). Contract test falha no diff exato.

**Causa**: JS `URLSearchParams` preserva ordem do object literal. `Map.of()` em Java não — usa hash interno.

**Fix**: usar `LinkedHashMap` (preserva ordem de inserção):
```java
public static String buildQueryString(Object... kvPairs) {
    Map<String, String> params = new LinkedHashMap<>();
    for (int i = 0; i < kvPairs.length; i += 2) {
        params.put(kvPairs[i].toString(), kvPairs[i+1].toString());
    }
    return params.entrySet().stream()
        .map(e -> e.getKey() + "=" + URLEncoder.encode(e.getValue(), StandardCharsets.UTF_8))
        .collect(Collectors.joining("&"));
}

// uso: buildQueryString("matrizId", 21, "tipo", "equipe")
```

**Como evitar desde o início**: nunca usar `Map.of()` pra construir query strings em respostas. Sempre `LinkedHashMap` ou helper dedicado.

---

## Bug #8 — `user 1 is_deleted=TRUE` mascarando falhas de auth (dev DB)

**Sintoma**: POST endpoints retornam 401 misterioso mesmo quando você passa Bearer token válido com `userId=1`.

**Causa**: no banco de dev, `users.id=1` está com `is_deleted=TRUE` (smoke test antigo). O `JwtAuthenticationFilter` chama `findAuthById(1)` que filtra `is_deleted=FALSE` → empty → SecurityContext vazio → 401.

**Fix imediato**: usar outro `userId` nos smoke tests (ex: `userId=4` ou `userId=8`, dependendo dos dados do dev DB).

**Fix pré-cutover** (em prod): rodar contra cada ambiente:
```sql
SELECT id, name, email, role, is_superadmin, is_deleted
FROM users
WHERE is_deleted = TRUE AND (role IN ('ADMIN','MANAGER') OR is_superadmin = TRUE);
```
Se houver admin importante na lista, restaurar via `UPDATE users SET is_deleted = FALSE WHERE id IN (...)`.

**Como evitar desde o início**:
1. Antes de smoke tests, conferir users válidos no DB: `SELECT id, email, role, is_superadmin FROM users WHERE is_deleted = FALSE AND role IN ('ADMIN','MANAGER') ORDER BY id;`
2. Usar um user real (ex: `ifccupertino@tjgo.jus.br`) em vez de `userId=1`

---

## Bônus — disciplina operacional (NÃO é bug de código, mas custou a 1ª tentativa)

### Bônus #1 — Bash tool é stateless

Cada chamada `Bash` cria nova sessão. `cd` não persiste. Sempre use caminhos absolutos em comandos destrutivos (`rm -rf`, `mv`).

### Bônus #2 — `BUILD SUCCESS` ≠ "código está vivo"

Maven compilou ≠ Spring carregou. Sempre validar com `curl /actuator/health` ou similar após mudanças estruturais.

### Bônus #3 — Commit + push após cada sprint

A 1ª tentativa foi perdida porque NUNCA foi commitada em git. **Inegociável**: `git commit -m "Sprint N"` + `git push` ao final de cada sprint. Idealmente, commits menores por arquivo grande.

---

## Resumo: checklist anti-bugs no Sprint 0

Antes mesmo de implementar o primeiro endpoint, garanta no `JacksonConfig`:

- [ ] Serializer `Instant`/`OffsetDateTime` em formato ISO-8601 com `.SSSZ` (paridade com Node `Date.toISOString()`)
- [ ] Serializer `java.sql.Date` com `toLocalDate().atStartOfDay(UTC)` — **antes** do `java.util.Date`
- [ ] Serializer `java.sql.Array` emitindo JSON array nativo
- [ ] Serializer `org.postgresql.util.PGobject` com `gen.writeRawValue(value.getValue())`
- [ ] No `AuthContext`, **dois helpers**: `requestUserId()` (Cat. A) e `currentUserId()` (Cat. B)
- [ ] `LinkedHashMap` como padrão pra qualquer construção de query string
- [ ] `git init` + remote + commit inicial **antes** do primeiro arquivo de código

Com esse setup, os 8 bugs acima ficam evitados desde o início.
