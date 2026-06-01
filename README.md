# Kaizen — Plataforma de Governança Judiciária e Tecnológica (TJGO)

Monorepo com **frontend React** + **backend Java/Spring Boot**.

> Este repositório é a versão pessoal/principal do autor. A versão institucional (com backend Node legado) vive em outro lugar e é mantida pela equipe TJGO.

## Estrutura

```
kaizen/
├── backend/    ← API Java 21 + Spring Boot 3.3.5 (porta 8081)
├── frontend/   ← React + Vite + TypeScript (porta 5173)
└── kaizen.code-workspace   ← workspace VS Code para abrir os dois juntos
```

## Como rodar localmente

### Pré-requisitos
- Java 21 + Maven
- Node.js 20+
- PostgreSQL 14+ rodando em `localhost:5432` com a database `kaizen local` (com espaço no nome) já populada

### 1. Backend Java

```powershell
cd backend
mvn package -DskipTests
$env:DB_HOST="localhost"; $env:DB_PORT="5432"; $env:DB_NAME="kaizen local"
$env:DB_USER="postgres"; $env:DB_PASSWORD="<sua_senha>"
$env:PORT="8081"; $env:TZ="America/Sao_Paulo"
$env:SPRING_PROFILES_ACTIVE="local"; $env:SSO_ENABLED="false"
java "-Duser.timezone=America/Sao_Paulo" -jar target\kaizen-api-java-1.0.0.jar
```

Aguardar `Started KaizenApiJavaApplication`. Testar: `curl http://localhost:8081/actuator/health`.

### 2. Frontend React

```powershell
cd frontend
npm install   # só na primeira vez
npm run dev
```

Acessar http://localhost:5173.

> Em `frontend/.env.local` (não versionado), a variável `VITE_API_URL` já está configurada para apontar para o backend Java (`http://localhost:8081`).

## Documentação importante

| Arquivo | Conteúdo |
|---|---|
| [`backend/docs/HANDOFF_PERMISSOES_TAP.md`](backend/docs/HANDOFF_PERMISSOES_TAP.md) | Spec da feature "Permissões do TAP" a implementar no Java (já existe no frontend). |
| [`backend/docs/CUTOVER_RUNBOOK.md`](backend/docs/CUTOVER_RUNBOOK.md) | Runbook do cutover Node → Java (procedimento, rollback). |
| [`backend/contract-tests/SHADOW_TRAFFIC_SPEC.md`](backend/contract-tests/SHADOW_TRAFFIC_SPEC.md) | Spec do shadow traffic 48h pré-cutover. |
| [`backend/deploy/staging-shadow/README.md`](backend/deploy/staging-shadow/README.md) | Pacote pra equipe de infra do TJGO subir o Java em staging. |
| [`backend/docs/AUTH_AUDIT.md`](backend/docs/AUTH_AUDIT.md) | Categorização dos controllers em Categoria A (permissivos) e B (strict). |
| [`backend/docs/JAVA_BUGS_TO_AVOID.md`](backend/docs/JAVA_BUGS_TO_AVOID.md) | Bugs já pegos que não devem se repetir. |
| [`CLAUDE.md`](CLAUDE.md) | Instruções pro Claude Code entender o layout do monorepo. |

## Status

- Migração Node → Java: **cutover-ready** (11 sprints completos, 100% paridade comportamental, 46/47 endpoints byte-EXACT em contract tests).
- Feature "Permissões do TAP": implementada no frontend; backend Java aguarda implementação pós-cutover (ver handoff).
