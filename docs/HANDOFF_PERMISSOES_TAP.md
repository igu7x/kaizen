# HANDOFF — Feature "Permissões do TAP"

> **Origem**: implementado no Node em `c:\Users\igucu\OneDrive\Documentos\kaizen\` em 2026-06-01. Esta é a especificação para porte fiel ao Java.
>
> **Objetivo**: permitir que um **ADMIN** conceda a **um usuário específico** (qualquer role) a capacidade de **editar apenas os 13 campos do TAP** em projetos cuja "Diretoria de Governança" (campo `areas_vinculadas_ids` em `contratos_projetos`) coincida com a `users.diretoria` (sigla) do usuário.

---

## Contexto e regras de negócio

### O que é "editar o TAP"

Os **13 campos** que compõem o TAP de um projeto (`contratos_projetos`):

```
nome, tap_vinculado, data_prevista_inicio, data_prevista_conclusao,
objetivo, contexto_justificativa, patrocinador_id, gestor_id,
escopo_sintetico, fora_do_escopo, entregas (lista >= 1),
instrumentos / instrumentos_ids (Ancoragem >= 1), prioridade, complexidade
```

### Quem podia editar antes

Apenas `userRole === 'ADMIN'`, `is_superadmin = TRUE`, ou o **gestor do próprio projeto** (cujo `cadastros_pessoas.user_id` == userId).

### Quem pode editar agora (regra adicional)

Qualquer usuário que satisfaça **todas** as condições abaixo:

1. Existe linha em `permissoes_tap` com `user_id = <userId>` (permissão concedida por ADMIN).
2. A **sigla** em `users.diretoria` aparece entre as siglas de `cadastros_areas` cujos `id` estão em `contratos_projetos.areas_vinculadas_ids[]` do projeto.

> **Atenção crítica**: a comparação é com `areas_vinculadas_ids` (campo "Diretorias" na seção *Governança e Responsáveis*), **não** com `contratos_projetos.diretoria`. O campo `diretoria` guarda a diretoria de **origem** (do criador) e pode divergir da governança atual.

### Filtragem do payload

O **frontend** filtra o payload de `PUT /api/contratos/projetos/:id` para conter **apenas** os 13 campos TAP quando o usuário entrou no modal via permissão TAP. O backend **não** rejeita o request — apenas atende ao PUT normalmente. Isso evita quebrar fluxos pré-existentes que dependiam do PUT estar aberto a vários perfis.

> **Nota**: se quiser hardening real (403 server-side para campos fora do escopo), faça em uma segunda iteração após auditar todos os consumidores do PUT. Esta entrega não inclui esse hardening.

---

## Migration SQL (já aplicada no Node)

**Arquivo no Node**: `api/sql/migrations/151_permissoes_tap.sql`

```sql
-- Migration 151: Cria a tabela permissoes_tap para o módulo "Permissões do TAP"
-- (ver cabeçalho original no arquivo do Node)
-- Idempotente.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_name = 'permissoes_tap'
    ) THEN
        CREATE TABLE permissoes_tap (
            user_id      INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
            granted_by   INTEGER REFERENCES users(id) ON DELETE SET NULL,
            granted_at   TIMESTAMP NOT NULL DEFAULT NOW(),
            updated_at   TIMESTAMP NOT NULL DEFAULT NOW()
        );

        CREATE INDEX idx_permissoes_tap_granted_by ON permissoes_tap(granted_by);

        COMMENT ON TABLE  permissoes_tap            IS 'Usuários autorizados a editar os 13 campos do TAP em projetos da sua própria diretoria. Concedida via Cadastros > Permissões do TAP.';
        COMMENT ON COLUMN permissoes_tap.user_id    IS 'Usuário que recebeu a permissão. Escopo de edição é restrito a contratos_projetos.diretoria == users.diretoria.';
        COMMENT ON COLUMN permissoes_tap.granted_by IS 'Admin que concedeu a permissão.';

        RAISE NOTICE '151: Tabela permissoes_tap criada.';
    ELSE
        RAISE NOTICE '151: Tabela permissoes_tap já existia, nenhuma alteração feita.';
    END IF;
END $$;
```

### Status nos ambientes

| Ambiente | Aplicada? |
|---|---|
| `kaizen local` (Postgres local — dev) | ✅ Sim |
| Staging | ❌ Não — depende do processo da equipe de DB |
| Produção | ❌ Não — depende do processo da equipe de DB |

> O Java compartilha o mesmo banco do Node nos ambientes — quando o DBA aplicar 151 para o Node, **automaticamente vale para o Java**. Nenhuma migration adicional precisa rodar no schema para o Java.

---

## Endpoints REST a implementar no Java

Base: `/api/permissoes-tap`. Todos os endpoints são **Categoria B (strict)** — exigem auth via `AuthContext.currentUserId()` (lança 401 se sem token, **não** usa fallback `userId=1`). Ver `docs/AUTH_AUDIT.md`.

### 1. `GET /api/permissoes-tap/me`

Retorna se o usuário logado tem permissão TAP e qual é a sua diretoria.

**Auth**: 401 se sem token.

**Response 200**:
```json
{ "temPermissao": true, "diretoria": "DPE" }
```

**SQL**:
```sql
-- temPermissao
SELECT 1 FROM permissoes_tap WHERE user_id = :userId LIMIT 1;
-- diretoria
SELECT diretoria FROM users WHERE id = :userId;
```

---

### 2. `GET /api/permissoes-tap/projeto/{projetoId}`

Retorna se o usuário logado pode editar os 13 campos TAP do projeto informado.

**Auth**: 401 se sem token. **400** se `projetoId` não numérico.

**Response 200**:
```json
{ "podeEditar": true }
```

**SQL** (a query é a alma da feature — match contra `areas_vinculadas_ids`):
```sql
SELECT 1
  FROM permissoes_tap pt
  JOIN users u             ON u.id = pt.user_id
  JOIN contratos_projetos p ON p.id = :projetoId
 WHERE pt.user_id = :userId
   AND u.diretoria IS NOT NULL
   AND EXISTS (
     SELECT 1 FROM cadastros_areas ca
      WHERE ca.id = ANY(COALESCE(p.areas_vinculadas_ids, ARRAY[]::int[]))
        AND LOWER(TRIM(ca.sigla)) = LOWER(TRIM(u.diretoria))
   )
 LIMIT 1;
```

`podeEditar = true` se a query retornou alguma linha.

---

### 3. `GET /api/permissoes-tap` — listar

Lista todas as permissões TAP ativas, com dados do usuário e de quem concedeu.

**Auth**: 401 se sem token. **403** se NÃO é (`userRole = 'ADMIN'` OR `users.is_superadmin = TRUE`).

**Response 200**: array de
```json
{
  "user_id": 9,
  "user_nome": "novo",
  "user_email": "novo@gmail.com",
  "user_diretoria": "DPE",
  "granted_by": 4,
  "granted_by_nome": "Igor Freitas Costa Cupertino Teixeira",
  "granted_at": "2026-06-01T14:09:59.585Z"
}
```

**SQL**:
```sql
SELECT
    pt.user_id,
    u.name      AS user_nome,
    u.email     AS user_email,
    u.diretoria AS user_diretoria,
    pt.granted_by,
    g.name      AS granted_by_nome,
    pt.granted_at
  FROM permissoes_tap pt
  JOIN users u ON u.id = pt.user_id
  LEFT JOIN users g ON g.id = pt.granted_by
  ORDER BY u.name ASC;
```

> **Pegadinha**: a coluna em `users` é `name` (não `nome`). Esse foi um bug pego no Node que custou ~30 min — não repita.

---

### 4. `POST /api/permissoes-tap` — conceder

Concede permissão TAP a um usuário. **Idempotente** (UPSERT).

**Auth**: 401 / 403 mesma regra do GET listar.

**Request body**:
```json
{ "user_id": 9 }
```

**Validações**:
- `400` se `user_id` ausente / não numérico.
- `404` se o `users.id` não existir.

**SQL**:
```sql
-- 1) garantir que user existe
SELECT 1 FROM users WHERE id = :userId;

-- 2) upsert
INSERT INTO permissoes_tap (user_id, granted_by, granted_at, updated_at)
VALUES (:userId, :grantedBy, NOW(), NOW())
ON CONFLICT (user_id) DO UPDATE
  SET granted_by = EXCLUDED.granted_by,
      updated_at = NOW();

-- 3) retornar a linha (mesma query do GET listar, filtrada por pt.user_id = :userId)
```

**Response 201**: o objeto criado/atualizado (mesmo shape do item da lista).

---

### 5. `DELETE /api/permissoes-tap/{userId}` — revogar

**Auth**: 401 / 403 mesma regra do GET listar. **400** se `userId` não numérico. **404** se a permissão não existir.

**SQL**:
```sql
DELETE FROM permissoes_tap WHERE user_id = :userId;
```

**Response 204** (sem body).

---

## Estrutura sugerida no Java

Seguindo o padrão dos outros services/controllers do projeto:

```
src/main/java/br/jus/tjgo/kaizen/
├── controller/
│   └── PermissoesTapController.java       <-- novo
└── service/
    └── PermissoesTapService.java          <-- novo
```

### `PermissoesTapService.java` (esqueleto)

```java
package br.jus.tjgo.kaizen.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Porte fiel de services/permissoes-tap.service.ts. */
@Service
@RequiredArgsConstructor
public class PermissoesTapService {

    private final JdbcTemplate jdbc;

    public List<Map<String, Object>> listar() {
        return jdbc.queryForList(
            "SELECT pt.user_id, u.name AS user_nome, u.email AS user_email, " +
            "       u.diretoria AS user_diretoria, pt.granted_by, " +
            "       g.name AS granted_by_nome, pt.granted_at " +
            "  FROM permissoes_tap pt " +
            "  JOIN users u ON u.id = pt.user_id " +
            "  LEFT JOIN users g ON g.id = pt.granted_by " +
            " ORDER BY u.name ASC"
        );
    }

    /** Retorna a linha do upsert, ou null se o user não existir. */
    public Map<String, Object> conceder(long userId, long grantedBy) {
        Integer exists = jdbc.query(
            "SELECT 1 FROM users WHERE id = ?",
            ps -> ps.setLong(1, userId),
            rs -> rs.next() ? 1 : null
        );
        if (exists == null) return null;

        jdbc.update(
            "INSERT INTO permissoes_tap (user_id, granted_by, granted_at, updated_at) " +
            "VALUES (?, ?, NOW(), NOW()) " +
            "ON CONFLICT (user_id) DO UPDATE " +
            "  SET granted_by = EXCLUDED.granted_by, updated_at = NOW()",
            userId, grantedBy
        );

        List<Map<String, Object>> rows = jdbc.queryForList(
            "SELECT pt.user_id, u.name AS user_nome, u.email AS user_email, " +
            "       u.diretoria AS user_diretoria, pt.granted_by, " +
            "       g.name AS granted_by_nome, pt.granted_at " +
            "  FROM permissoes_tap pt " +
            "  JOIN users u ON u.id = pt.user_id " +
            "  LEFT JOIN users g ON g.id = pt.granted_by " +
            " WHERE pt.user_id = ?",
            userId
        );
        return rows.isEmpty() ? null : rows.get(0);
    }

    public boolean revogar(long userId) {
        int deleted = jdbc.update("DELETE FROM permissoes_tap WHERE user_id = ?", userId);
        return deleted > 0;
    }

    public boolean temPermissao(long userId) {
        Integer found = jdbc.query(
            "SELECT 1 FROM permissoes_tap WHERE user_id = ? LIMIT 1",
            ps -> ps.setLong(1, userId),
            rs -> rs.next() ? 1 : null
        );
        return found != null;
    }

    /**
     * Match contra cadastros_areas vinculadas — NÃO contra contratos_projetos.diretoria.
     */
    public boolean podeEditarTapDoProjeto(long userId, long projetoId) {
        Integer found = jdbc.query(
            "SELECT 1 " +
            "  FROM permissoes_tap pt " +
            "  JOIN users u             ON u.id = pt.user_id " +
            "  JOIN contratos_projetos p ON p.id = ? " +
            " WHERE pt.user_id = ? " +
            "   AND u.diretoria IS NOT NULL " +
            "   AND EXISTS ( " +
            "     SELECT 1 FROM cadastros_areas ca " +
            "      WHERE ca.id = ANY(COALESCE(p.areas_vinculadas_ids, ARRAY[]::int[])) " +
            "        AND LOWER(TRIM(ca.sigla)) = LOWER(TRIM(u.diretoria)) " +
            "   ) " +
            " LIMIT 1",
            ps -> { ps.setLong(1, projetoId); ps.setLong(2, userId); },
            rs -> rs.next() ? 1 : null
        );
        return found != null;
    }

    public String getDiretoriaUsuario(long userId) {
        return jdbc.query(
            "SELECT diretoria FROM users WHERE id = ?",
            ps -> ps.setLong(1, userId),
            rs -> rs.next() ? rs.getString(1) : null
        );
    }
}
```

### `PermissoesTapController.java` (esqueleto)

```java
package br.jus.tjgo.kaizen.controller;

import br.jus.tjgo.kaizen.auth.AuthContext;
import br.jus.tjgo.kaizen.service.PermissoesTapService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/** Porte fiel de routes/permissoes-tap.ts. Categoria B (strict — exige auth). */
@RestController
@RequestMapping("/api/permissoes-tap")
@RequiredArgsConstructor
public class PermissoesTapController {

    private final PermissoesTapService service;
    private final JdbcTemplate jdbc;

    /** ADMIN role OU is_superadmin pode gerenciar permissões TAP. */
    private boolean canManage(HttpServletRequest req, long userId) {
        String role = AuthContext.getCurrentUser().map(u -> u.role()).orElse(null);
        if ("ADMIN".equals(role)) return true;
        Boolean superadmin = jdbc.query(
            "SELECT is_superadmin FROM users WHERE id = ?",
            ps -> ps.setLong(1, userId),
            rs -> rs.next() ? rs.getBoolean(1) : Boolean.FALSE
        );
        return Boolean.TRUE.equals(superadmin);
    }

    @GetMapping("/me")
    public ResponseEntity<?> me() {
        Long userId = AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        return ResponseEntity.ok(Map.of(
            "temPermissao", service.temPermissao(userId),
            "diretoria",    service.getDiretoriaUsuario(userId)  // pode ser null
        ));
    }

    @GetMapping("/projeto/{projetoId}")
    public ResponseEntity<?> podeEditarProjeto(@PathVariable String projetoId) {
        Long userId = AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        long pid;
        try {
            pid = Long.parseLong(projetoId);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "projetoId inválido"));
        }
        return ResponseEntity.ok(Map.of("podeEditar", service.podeEditarTapDoProjeto(userId, pid)));
    }

    @GetMapping
    public ResponseEntity<?> listar(HttpServletRequest req) {
        Long userId = AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
        if (userId == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage(req, userId)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "Apenas administradores podem listar permissões do TAP"
            ));
        }
        List<Map<String, Object>> lista = service.listar();
        return ResponseEntity.ok(lista);
    }

    @PostMapping
    public ResponseEntity<?> conceder(@RequestBody Map<String, Object> body, HttpServletRequest req) {
        Long grantedBy = AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
        if (grantedBy == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage(req, grantedBy)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "Apenas administradores podem conceder permissão do TAP"
            ));
        }
        Object raw = body == null ? null : body.get("user_id");
        if (raw == null) {
            return ResponseEntity.status(400).body(Map.of("error", "user_id é obrigatório"));
        }
        long userId;
        try {
            userId = Long.parseLong(String.valueOf(raw));
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "user_id deve ser numérico"));
        }
        Map<String, Object> created = service.conceder(userId, grantedBy);
        if (created == null) {
            return ResponseEntity.status(404).body(Map.of("error", "Usuário não encontrado"));
        }
        return ResponseEntity.status(201).body(created);
    }

    @DeleteMapping("/{userId}")
    public ResponseEntity<?> revogar(@PathVariable String userId, HttpServletRequest req) {
        Long actor = AuthContext.getCurrentUser().map(u -> u.id()).orElse(null);
        if (actor == null) {
            return ResponseEntity.status(401).body(Map.of("error", "Não autenticado"));
        }
        if (!canManage(req, actor)) {
            return ResponseEntity.status(403).body(Map.of(
                "error", "Apenas administradores podem revogar permissão do TAP"
            ));
        }
        long target;
        try {
            target = Long.parseLong(userId);
        } catch (NumberFormatException e) {
            return ResponseEntity.status(400).body(Map.of("error", "userId inválido"));
        }
        boolean ok = service.revogar(target);
        if (!ok) {
            return ResponseEntity.status(404).body(Map.of("error", "Permissão não encontrada"));
        }
        return ResponseEntity.noContent().build();
    }
}
```

> Ajuste o nome do método `role()` / `id()` no `AuthenticatedUser` conforme o record real do projeto.

---

## Como testar via curl (após implementar)

> **Pré-requisito**: migration 151 aplicada e usuário `id=9` (`novo`/DPE) existindo no banco. Para um teste rápido em dev, conceda manualmente a permissão:
> ```sql
> INSERT INTO permissoes_tap (user_id, granted_by) VALUES (9, 4)
> ON CONFLICT DO NOTHING;
> ```

```bash
# Token base64 minimal usado nos contract tests (admin):
TOKEN_ADMIN=$(echo '{"userId":4,"role":"ADMIN"}' | base64 -w0)
TOKEN_NOVO=$(echo  '{"userId":9,"role":"VIEWER"}' | base64 -w0)

# /me (user logado)
curl -s http://localhost:8080/api/permissoes-tap/me \
     -H "Authorization: Bearer $TOKEN_NOVO"
# Esperado: {"temPermissao":true,"diretoria":"DPE"}

# /projeto/:id (verifica se user pode editar TAP do projeto)
curl -s http://localhost:8080/api/permissoes-tap/projeto/9 \
     -H "Authorization: Bearer $TOKEN_NOVO"
# Esperado: {"podeEditar":true}  -- se o projeto 9 tem DPE em areas_vinculadas_ids

# Listar (admin only)
curl -s http://localhost:8080/api/permissoes-tap \
     -H "Authorization: Bearer $TOKEN_ADMIN"

# Conceder (admin only)
curl -s -X POST http://localhost:8080/api/permissoes-tap \
     -H "Authorization: Bearer $TOKEN_ADMIN" \
     -H "Content-Type: application/json" \
     -d '{"user_id":7}'

# Revogar (admin only)
curl -s -X DELETE http://localhost:8080/api/permissoes-tap/7 \
     -H "Authorization: Bearer $TOKEN_ADMIN" -w "\nHTTP %{http_code}\n"
# Esperado: HTTP 204
```

Para os contract tests A/B (Node × Java), todos esses endpoints devem casar 1:1 em status code e shape de resposta. Os JSONs do listar/conceder retornam `granted_at` como timestamp ISO-8601 — vale conferir o padrão do projeto (algumas serializações no Java emitem com `Z` e outras sem; o Node emite com `Z`).

---

## Checklist de implementação

- [ ] Garantir que migration 151 foi aplicada no banco de desenvolvimento usado pelo Java.
- [ ] Criar `PermissoesTapService` em `service/`.
- [ ] Criar `PermissoesTapController` em `controller/`.
- [ ] Conferir se há config global de CORS / auth filter — endpoints novos devem herdar automaticamente.
- [ ] Testar os 5 endpoints com os curls acima.
- [ ] Rodar contract tests A/B (`contract-tests/`) — adicionar casos novos para os 5 endpoints (ou rodar sem e adicionar depois — fica a critério).
- [ ] Atualizar `docs/AUTH_AUDIT.md` adicionando `permissoesTap` à lista de **Categoria B (strict)**.

---

## Frontend (Node — já feito, **não** mexer)

Para referência, o frontend (não precisa replicar — é só Node):

| Arquivo | O que faz |
|---|---|
| `frontend/src/services/permissoesTapApi.ts` | Client com `listar`, `conceder`, `revogar`, `minha`, `podeEditarProjeto` |
| `frontend/src/pages/PermissoesTap.tsx` | Tela em Cadastros > Permissões do TAP |
| `frontend/src/pages/CadastroHub.tsx` | Card "Permissões do TAP" |
| `frontend/src/App.tsx` | Rota `/cadastros/permissoes-tap` (ADMIN only) |
| `frontend/src/components/projetos/ProjetoFormDialog.tsx` | Aceita prop `tapEditMode` — filtra payload pros 13 campos |
| `frontend/src/components/gestao/ControleExecucaoNovo.tsx` | Mostra "Editar Projeto" se `podeEditarTap` (consulta `/projeto/:id`) |
| `frontend/src/pages/Contratos.tsx` | Mesma lógica para modal de Contratos |

---

## Arquivos de referência no Node

| Arquivo Node | Equivalente Java |
|---|---|
| `api/sql/migrations/151_permissoes_tap.sql` | (a mesma migration — banco compartilhado) |
| `api/src/services/permissoes-tap.service.ts` | `service/PermissoesTapService.java` |
| `api/src/routes/permissoes-tap.ts` | `controller/PermissoesTapController.java` |
| `api/src/server.ts` (linha que registra `permissoesTapRouter`) | `@RequestMapping("/api/permissoes-tap")` no controller |
