# Kaizen — Monorepo (Frontend React + Backend Java)

Este repositório contém **dois projetos** que devem ser tratados como um só.
Features cobrem os dois e geralmente exigem mudanças simultâneas.

## Layout

| Subprojeto | Caminho | Stack | Porta |
|---|---|---|---|
| Frontend | `frontend/` | React + TypeScript + Vite | 5173 |
| Backend | `backend/` | Java 21 + Spring Boot 3.3.5 | 8081 |

Banco PostgreSQL local em `localhost:5432`, database `kaizen local` (com espaço no nome).

## Diretrizes pra mudanças

- **Edições coordenadas**: features tocam `frontend/src/` e `backend/src/main/java/` no mesmo commit.
- **Migrations SQL**: ficam em `backend/sql/migrations/` (mover de `kaizen/api/sql/migrations/` se preciso). Numeração sequencial. **Avisar o usuário ao criar** (memória do usuário).
- **Sem mexer em código relacionado ao backend Node**: este monorepo é só Java + Frontend. O Node legado (em produção até o cutover) vive no repo institucional do TJGO separado.

## Como subir local

Ver [README.md](README.md) seção "Como rodar localmente".

## Documentação chave

- [`backend/docs/HANDOFF_PERMISSOES_TAP.md`](backend/docs/HANDOFF_PERMISSOES_TAP.md) — feature "Permissões do TAP" a portar pro Java.
- [`backend/docs/CUTOVER_RUNBOOK.md`](backend/docs/CUTOVER_RUNBOOK.md) — runbook do cutover.
- [`backend/contract-tests/SHADOW_TRAFFIC_SPEC.md`](backend/contract-tests/SHADOW_TRAFFIC_SPEC.md) — shadow traffic 48h.
- [`backend/deploy/staging-shadow/README.md`](backend/deploy/staging-shadow/README.md) — pacote OpenShift TJGO.

## Estado da migração (snapshot 2026-06-01)

- 11 sprints completos. Java em **cutover-ready**.
- Validado A/B localmente: **8/9 endpoints byte-EXACT** (Node :3001 vs Java :8081, mesmo banco).
- Fix do `NoResourceFoundException` aplicado (404 fiel ao Node).
- Feature "Permissões do TAP": frontend pronto, backend Java pendente (ver handoff).
