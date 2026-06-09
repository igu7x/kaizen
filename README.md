# kaizen-api-java

Backend Java (Spring Boot 3.3 / Java 21) do **Kaizen** — reescrita fiel do backend Node/Express
(`../kaizen-source/api`). Contrato HTTP e comportamento idênticos: o cutover é só trocar a URL base
no frontend. Node continua em `:8080`; este backend roda em `:8081`.

## Stack
- Spring Boot 3.3.5, Java 21 LTS, Maven
- JdbcTemplate (SQL bruto, **não** JPA) sobre PostgreSQL
- Spring Security com filtro JWT permissivo (Keycloak + base64 de dev)
- JJWT 0.12.6, Lombok
- Contract tests (Sprint 10): RestAssured + JsonUnit

## Setup local

1. **Java 21** e **Maven 3.9+** instalados (`java --version`, `mvn --version`).
2. **Banco**: PostgreSQL em `localhost:5432`, database `kaizen_java_dev`.
3. **Segredos** (não versionados): copie o template e preencha a senha do banco:
   ```bash
   cp src/main/resources/application-local.yml.example src/main/resources/application-local.yml
   # edite application-local.yml e defina spring.datasource.password
   ```
   Alternativamente, exporte variáveis de ambiente (têm precedência sobre os defaults):
   `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `PORT`.
4. **Rodar**:
   ```bash
   mvn spring-boot:run
   ```
5. **Smoke test** (Bearer base64 de dev — só em desenvolvimento):
   ```bash
   TOKEN=$(printf '{"userId":N}' | base64 | tr -d '\n')   # N = userId válido, NÃO use 1
   curl -H "Authorization: Bearer $TOKEN" http://localhost:8081/api/...
   ```
   `users.id = 1` está `is_deleted = TRUE` no dev DB — use outro id (Bug #8 em `docs/JAVA_BUGS_TO_AVOID.md`).

## Variáveis de ambiente

| Var | Default | Descrição |
|---|---|---|
| `PORT` | `8081` | Porta HTTP (Node usa 8080) |
| `DB_HOST` / `DB_PORT` | `localhost` / `5432` | Postgres |
| `DB_NAME` | `kaizen_java_dev` | Database |
| `DB_USER` | `postgres` | Usuário do banco |
| `DB_PASSWORD` | — | Senha do banco (segredo; via env ou `application-local.yml`) |
| `SPRING_PROFILES_ACTIVE` | `local` | Profile ativo |
| `CORS_ORIGINS` | — | Origins extras (CSV) além da lista fixa + regex `*.tjgo.jus.br` |
| `FRONTEND_URL` | `http://localhost:5173` | URL do frontend |
| `NODE_ENV` | `development` | Reportado em `/health` e `/api` |

## Documentação viva (`docs/`)
- `KNOWN_DIVERGENCES.md` — divergências propositais Node × Java (manter vivo no Sprint 10)
- `POST_CUTOVER_BUGS.md` — defeitos reais do Node a corrigir pós-cutover
- `AUTH_AUDIT.md` — classificação dos 16 controllers em Cat. A (permissivo) / B (strict)
- `JAVA_BUGS_TO_AVOID.md` — 8 armadilhas da 1ª tentativa, evitadas desde o Sprint 0
- `PATTERNS_QUE_FUNCIONARAM.md` — receitas validadas (Jackson, CORS, AuthContext, etc.)

## Disciplina (regra de ouro)
Commit + push pro remote **após cada sprint**. A 1ª tentativa foi perdida por falta de versionamento.
