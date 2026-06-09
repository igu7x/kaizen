# AUTH AUDIT — classificação dos controllers do Node em "permissivo" (A) vs "strict" (B)

> **Contexto**: o middleware `authenticate` do Node é **permissivo** — sempre chama `next()`, mesmo sem token. Os controllers individualmente decidem se exigem auth ou não, lendo `req.userId` (que pode ser `undefined` quando não houve token).
>
> Há **dois padrões** de tratamento desse `req.userId` em controllers:
>
> - **Categoria A — permissivo**: usa `req.userId || 1` (fallback pra userId=1, geralmente "Sistema" ou admin default). Não retorna 401, sempre processa.
> - **Categoria B — strict**: usa `if (!req.userId) return res.status(401)` ou throw com check explícito. Retorna 401 quando sem auth.
>
> A diferença é **invisível em testes positivos** mas **explode em contract tests sem auth**.

---

## Por que isso importa para a migração Java

A 1ª tentativa cometeu o erro de tratar TODOS os 85 `req.userId` do Node como Categoria A (via helper `AuthContext.requestUserId()` que faz fallback pra `userId=1`). Isso resultou em **2 bugs descobertos pelo Sprint 10**:

1. `HomeController.resumo()` retornava 404 sem auth (caía no fallback `userId=1` → user soft-deleted → 404) em vez de 401 que o Node retorna
2. `ProcessosNegocioController.{validarAutor, validarDiretoria, validarFinal, recusar}` retornavam 401 ou 403 em paths diferentes do Node

**Lição**: no Java, **dois helpers distintos** no `AuthContext`:

```java
public class AuthContext {
    // Para controllers Categoria A (permissivos com fallback)
    public static Long requestUserId() {
        return getCurrentUser().map(AuthenticatedUser::id).orElse(1L);
    }

    // Para controllers Categoria B (strict — exige auth)
    public static Long currentUserId() {
        return getCurrentUser()
            .map(AuthenticatedUser::id)
            .orElseThrow(() -> new ApiException(401, "Não autenticado"));
    }
}
```

E cada controller usa o helper correto conforme a categoria abaixo.

---

## Categoria A — permissivos com fallback `|| 1`

Use `AuthContext.requestUserId()` (com fallback). **10 controllers:**

| Controller | Justificativa |
|---|---|
| `autoavaliacao` | Node usa `req.userId \|\| 1` em todos endpoints |
| `avaliacaoGestor` | Idem |
| `avaliacaoIntegrada` | Idem |
| `comites` | Idem |
| `competenciasGestor` | Idem |
| `forms` | Idem |
| `metas` | Idem |
| `okr` | Idem |
| `pca` | Idem |
| `pca-details` | Idem (mesmo prefixo `/api/pca-items` que `pca`) |
| `users` | **RECLASSIFICADO p/ A na 2ª tentativa (Sprint 1)** — ver correção abaixo |

---

## Categoria B — strict (verificar `if (!userId) return 401`)

Use `AuthContext.currentUserId()` (lança 401 se sem auth). **9 controllers:**

| Controller | Notas |
|---|---|
| `areas` | A maioria dos endpoints é strict; alguns GETs públicos podem usar requestUserId |
| `colaboradores` | Strict em todos |
| `competenciasPadrao` | Strict |
| `contratos-projetos` | Strict — especialmente TAP/TEP que dependem de identidade |
| `gestao-estrategica` | Strict |
| `home` | **FIXED na 1ª tentativa** — usava requestUserId, corrigido para currentUserId |
| `permissoes` | Strict |
| `pessoas` | Strict |
| `processosNegocio` | **FIXED na 1ª tentativa** — 4 endpoints PATCH (`validar-autor`, `validar-diretoria`, `validar-final`, `recusar`) usavam requestUserId, corrigidos para currentUserId. Restante já era strict. |

---

## CORREÇÃO (2ª tentativa, Sprint 1) — `users` é Categoria A, não B

A 1ª tentativa classificou `users` como strict (B). O **código real do Node contradiz**:

- `routes/users.ts` define `getCurrentUserId(req)` que termina em `return 1` (fallback). Nenhum
  endpoint chama `authorize()` nem faz `if (!userId) return 401`. **Não há um único 401 no arquivo.**
- `server.ts:188` monta `app.use('/api/users', usersRouter)` **sem** `authenticate` extra; o
  `authenticate` global é permissivo.
- Sem token: `getCurrentUserId` → `1` → `findUserById(1)`. Como `users.id=1` está soft-deleted no
  dev DB, `GET /api/users/me/perfil` → **404** e `GET /api/users` → **200** (lista, sem filtro de
  domínio). Em nenhum caso 401.

Pelo próprio critério deste doc ("tem `|| 1`? → A"), `users` é **Categoria A**. A classificação
original nunca foi verificada por contract test (a 1ª tentativa só testou Home e Processos).
**Decisão (Igor, Sprint 1):** seguir o Node = Categoria A. No Java, o `UserController` replica o
`getCurrentUserId` (principal do filtro → header `X-User-Id` → Bearer base64 → fallback 1).

---

## Casos especiais — autorização identity-based (NÃO é só role-based)

Em alguns endpoints da Categoria B, **role não basta** — precisa verificar identidade específica:

### `processosNegocio` — validação em 3 camadas

- `PATCH /api/processos-negocio/:id/validar-autor`: **só o `created_by` do processo pode**. Não basta ser ADMIN.
  - Check: `if (Number(processo.created_by) !== Number(userId)) return res.status(403).json({ error: 'Apenas o autor...' })`
- `PATCH /api/processos-negocio/:id/validar-diretoria`: **só o `gestor_user_id` da `cadastros_areas` cuja `sigla` bate com `processo.diretoria`**.
  - Lookup: `SELECT gestor_user_id FROM cadastros_areas WHERE LOWER(TRIM(sigla)) = LOWER(TRIM($1)) AND COALESCE(ativo, TRUE) = TRUE LIMIT 1`
  - Check: `if (!gestorUserId || Number(gestorUserId) !== Number(userId)) return res.status(403)`
- `PATCH /api/processos-negocio/:id/validar-final`: **só `users.is_superadmin = TRUE`**.
  - Check: `if (!user?.is_superadmin) return res.status(403)`
- `PATCH /api/processos-negocio/:id/recusar`: aplica a regra da camada sendo recusada (mesmas 3 regras acima).

### `contratos-projetos` — TAP/TEP em camadas

- TAP validação por camada (`gestor`, `diretor-da-area`, `patrocinador`) tem regras semelhantes: role + identidade vinculada ao projeto.
- TEP create/delete **restrito a `users.is_superadmin = TRUE`** (não basta ADMIN role).

### Detalhe que economiza tempo

O Node tem **redundância inofensiva**: `server.ts` linhas ~209-211 reaplicam `authenticate` em algumas rotas (`competencias-padrao`, `home`, `processos-negocio`). Como o filtro JWT do Java é global, **NÃO precisa replicar essa redundância**. Os controllers individualmente já chamam `currentUserId()` quando precisam.

---

## Procedimento de auditoria pra novos controllers

Quando adicionar um novo controller (ou ao auditar um Categoria B antes do contract test):

1. Abra o controller equivalente no Node (`kaizen-source/api/src/routes/<nome>.ts`)
2. Procure por `req.userId`:
   ```bash
   grep -n "req\.userId\|userId =" kaizen-source/api/src/routes/<nome>.ts
   ```
3. Para cada ocorrência, verifique:
   - **Tem `|| 1` ou similar?** → Categoria A, use `requestUserId()`
   - **Tem `if (!userId)` ou throw?** → Categoria B, use `currentUserId()`
4. Para endpoints identity-based (envolvem comparação `userId === outraColuna`), verifique o lookup específico no service.

---

## Resumo executivo

- 16 controllers principais auditados
- 10 em Categoria A (permissivos) — usar `requestUserId()`
- 10 em Categoria B (strict) — usar `currentUserId()` — atenção especial a `processosNegocio` e `contratos-projetos` (identity-based)
- O bug do "5 endpoints com requestUserId errado" da 1ª tentativa só apareceu em contract tests; **evite desde o início auditando endpoint-por-endpoint** ao implementar
