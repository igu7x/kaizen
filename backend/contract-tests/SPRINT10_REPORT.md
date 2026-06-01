# Sprint 10 — Relatório de Contract Tests A/B (Node × Java)

**Setup**: Node em `:8080` e Java em `:8081`, **ambos lendo o mesmo banco `kaizen_java_dev`** (Node apontado temporariamente via `DB_NAME=kaizen_java_dev PORT=8080 npm run dev`, override por env — sem editar arquivos do Node). Logo: qualquer divergência = comportamento do Java vs Node, não diferença de dado.

Harness (committado em `contract-tests/`):
- `ab-compare.ps1` — Tier 1: GETs read-only, comparação byte-a-byte + classificação `EXACT` / `COSMETIC` / `VALUE`.
- `ab-workflow.ps1` — Tier 3: ciclo de vida de Processo de Negócio em cada backend, compara sequência de status codes + estado final no banco (behavioral, imune a cosmético).

Token: base64 `{"userId":4}` (superadmin SGJT, usuário vivo — ver KNOWN #7).

---

## Tier 1 — GETs read-only (47 endpoints)

| Resultado | Qtde | % |
|---|---|---|
| **EXACT** (byte-a-byte idêntico) | 38 | 81% |
| **COSMETIC** (canônico idêntico; só whitespace/ordem JSONB) | 2 | 4% |
| **VALUE** (divergência real de valor) | 7 | 15% |
| STATUS-DIFF (status HTTP divergente) | **0** | 0% |
| **Funcionalmente equivalentes (exact+cosmetic)** | **40** | **85%** |

**0 divergências de status HTTP** em 47 endpoints — o contrato de status/roteamento está 100% fiel.

## Tier 3 — Workflow (Processo de Negócio, 3 camadas)

**Paridade behavioral TOTAL.** Node e Java produziram:
- sequência de status codes idêntica: `201,200,403,200,403,200,403,200,200,200,200` (criar → enviar → autor 403/ok → diretoria 403/ok → final 403/ok → reenviar → 2º ciclo → recusar)
- estado final idêntico: `validado_final/1.0/ciclos1/snap1` → `1.1/ciclos2/snap2` → `recusado/final`

A lógica do módulo mais complexo (identity-based 3 camadas + bump de versão + snapshot + recusa) é byte-idêntica em comportamento.

---

## Divergências classificadas

### KNOWN aplicadas (já documentadas — não são regressão do Java)
- **`GET /api/gestao-estrategica/projetos` → 500/500** — `POST_CUTOVER_BUGS #2`: o Node referencia a tabela inexistente `instrumentos_planejamento` (correto seria `cadastros_instrumentos_planejamento`); o Java replicou fielmente → **ambos 500**. Status idêntico. O **texto** do corpo diverge (Java vaza `bad SQL grammar [...]`; Node devolve `"Erro ao listar projetos"`) — mesma classe do `KNOWN #10` (frontend reage ao status, não ao texto). Ver também "Recomendações" (não vazar SQL no 500).
- **`GET /api/home/resumo` → `projetos {0,0,0}`** — `KNOWN #9` / `POST_CUTOVER_BUGS #1`: bug de `data_fim_prevista` inexistente, replicado fiel. Endpoint deu **EXACT** (idêntico nos dois, incluindo o `{0,0,0}`).

### NOVAS divergências (serializer-level; candidatas a fix no Sprint 11)

**A) Whitespace de JSONB** — *cosmética, funcionalmente idêntica.*
O Postgres renderiza o texto de colunas `jsonb` com espaços (`{"id": 251, "nome": ...}`). O Java lê o `PGobject` e escreve o texto **cru** (`writeRawValue`), preservando os espaços. O driver `pg` do Node **parseia** o jsonb e o `res.json` re-emite **compacto** (sem espaços).
- Afeta: toda coluna jsonb (`update_keys`, `tecnicas_snapshot_publicado`, `proprietarios`, `atores`, `documentos_anexados`, `snapshot`, etc.).
- Evidência pura: `/api/pca-items/stats`, `/api/processos-negocio` (canônico idêntico).
- **Fix proposto**: no serializer de `PGobject` (JacksonConfig), em vez de `writeRawValue(raw)`, parsear (`objectMapper.readTree`) e `writeTree` → saída compacta idêntica ao Node. Correção central única.

**B) `bigint` / `COUNT` como string** — *divergência de valor, a mais difundida.*
O driver `pg` retorna `int8`/`COUNT(*)`/`numeric` como **string**; o JdbcTemplate retorna `Long` → Jackson emite **número**.
- Evidência: `total_respostas` → Node `"13"` vs Java `13` (`/api/avaliacao-gestor`, `/api/avaliacao-integrada`, `/api/autoavaliacao`); `total_projetos`/`total_instrumentos_subordinados` (`/api/planos-programas/instrumentos`); `total_competencias` (`/api/competencias-gestor`).
- `int4` (ids SERIAL) **não** diverge (número nos dois) — por isso a maioria dos endpoints passou EXACT.
- **Fix proposto**: serializar agregados/`bigint` como string. Cuidado: precisa distinguir `int8` de `int4` (só `int8`/`numeric`/`COUNT` viram string no pg). Avaliar serializer dedicado ou cast `::text` nos COUNT das queries.

**C) Coluna `date` com timezone divergente** — *divergência de valor.*
Coluna tipo `date`: Node renderiza meia-noite **local** (America/São_Paulo, UTC-3) → `...T03:00:00.000Z`; o serializer de `java.sql.Date` (JacksonConfig) usa meia-noite **UTC** → `...T00:00:00.000Z`.
- Evidência: `/api/sprints` (`data_inicio`, `data_fim`).
- **Fix proposto**: no serializer de `java.sql.Date`, usar o fuso default do sistema (America/São_Paulo) em vez de `ZoneOffset.UTC`, para casar com a renderização do `pg`/Node.

---

## Recomendações para o Sprint 11 (hardening)
1. **(A)** Serializer de `PGobject` → parse + recompacta (compacto) — elimina 2 COSMETIC + parte de 4 VALUE.
2. **(B)** `bigint`/`COUNT`/`numeric` → string (paridade `pg`). Maior ganho em endpoints VALUE.
3. **(C)** `java.sql.Date` → fuso local. Corrige datas.
4. **(D)** `GlobalExceptionHandler`: para 500 genérico, devolver mensagem curada (não vazar `bad SQL grammar`/SQL). Reduz info-leak e aproxima do Node.
5. Reavaliar (já KNOWN/POST_CUTOVER) se vale corrigir os bugs pré-existentes `instrumentos_planejamento` (#2) e `data_fim_prevista` (#1) — decisão de produto, fora da fidelidade.

Após (A)+(B)+(C), o esperado é Tier 1 → praticamente 100% EXACT.

---

## Sprint 11 — Resultado pós-fix (A/B/C/D + E)

Fixes aplicados em `JacksonConfig` e `GlobalExceptionHandler`:
- **A** PGobject → parse + re-emite compacto (sem whitespace do jsonb).
- **B** `Long`/`BigInteger` (int8/COUNT) → String (paridade `pg`); `int4` segue número.
- **C** `java.sql.Date` → meia-noite local `America/Sao_Paulo` (`T03:00:00.000Z`).
- **D** 500 genérico → `"Erro interno do servidor"` (stack só no log; sem vazar SQL).
- **E** (nova, surgida no re-run) `Double` → formato JS (`153481760.94`, não `1.5348176094E8`; inteiros sem `.0`).

Re-execução da suíte (mesmo setup, mesmo banco):

| | Antes | Depois |
|---|---|---|
| Tier 1 EXACT (byte-a-byte) | 38/47 | **46/47** |
| Tier 1 COSMETIC | 2 | **0** |
| Tier 1 VALUE | 7 | **1** |
| Tier 1 STATUS-DIFF | 0 | 0 |
| Tier 3 workflow | paridade total | **paridade total** |

O **único** VALUE remanescente é `GET /api/gestao-estrategica/projetos` → **500/500** (KNOWN `POST_CUTOVER #2`: tabela `instrumentos_planejamento` inexistente, replicado fiel). O corpo agora é a mensagem curada do fix D (`"Erro interno do servidor"` vs `"Erro ao listar projetos"` no Node) — divergência de texto em rota de erro, status idêntico, classe do `KNOWN #10`. **Não é regressão nem divergência de regra de negócio.**

**Conclusão**: 47/47 status idêntico, 46/47 byte-a-byte, 100% paridade comportamental. Sem nenhuma divergência de regra de negócio. Backend Java fiel ao Node.
