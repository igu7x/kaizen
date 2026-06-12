# Kaizen — Monorepo (Frontend React + Backend Java)

Este repositório contém **dois projetos** que devem ser tratados como um só.
Features cobrem os dois e geralmente exigem mudanças simultâneas.

---

## ⛔ Regras absolutas (antes de qualquer outra coisa)

1. **NUNCA adicionar `Co-Authored-By: Claude` ou qualquer trailer com `Claude`/`Anthropic` em commits.**
   - Sem trailer no fim da mensagem do commit
   - Sem `--author="Claude..."`
   - Quando criar commit via heredoc, terminar a mensagem na última linha de contexto, NÃO no Co-Authored-By
   - Isso evita o GitHub atribuir contribuições ao usuário "claude" — é importante pro repo do user
2. **NUNCA pushar pro `origin` (GitHub) sem confirmar que nenhum commit do diff tem `Co-Authored-By: Claude`**. Rodar antes:
   ```
   git log origin/main..HEAD --grep="Co-Authored-By.*[Cc]laude" --oneline
   ```
   Se voltar qualquer linha → roda `git filter-branch -f --msg-filter 'sed "/^Co-Authored-By:.*[Cc]laude\|^Co-Authored-By:.*[Aa]nthropic/d"' -- main` ANTES do push.
3. **`git push` é sempre manual do user** (regra do contrato git). Eu posso preparar/staging/commit, mas o push só quando ele autorizar.

---

## Layout

| Subprojeto | Caminho | Stack | Porta |
|---|---|---|---|
| Frontend | `frontend/` | React + TypeScript + Vite | 5173 |
| Backend | `backend/` | Java 21 + Spring Boot 3.3.5 | 8081 |

Banco PostgreSQL local em `localhost:5432`, database `kaizen local` (com espaço no nome).

---

## Git workflow (3 remotes)

Três remotes:
- `origin` → GitHub `igu7x/kaizen` (monorepo completo, backup pessoal)
- `gitlab` → GitLab TJGO `kaizen_bk` (só conteúdo de `backend/`, via subtree)
- `gitlab-ft` → GitLab TJGO `kaizen_ft` (só conteúdo de `frontend/`, via subtree)

Aliases configurados:

| Comando | O que faz |
|---|---|
| `git pull-bk` | Sync de `gitlab/stag` pra pasta `backend/` (merge -X subtree=backend, allow-unrelated) |
| `git pull-ft` | Sync de `gitlab-ft/stag` pra pasta `frontend/` |
| `git pull-tjgo` | Ambos os pulls |
| `git push` | GitHub `origin/main` |
| `git push-bk` | Subtree split de `backend/` → `gitlab/stag` |
| `git push-ft` | Subtree split de `frontend/` → `gitlab-ft/stag` |
| `git push-tjgo` | Ambos os pushes |

Fluxo típico do user:
```
git pull-tjgo            # traz mudanças dos colegas (Arthur, sgrocha, acandrade)
# ...edita código...
git add . && git commit -m "..."   # commit normal, SEM Co-Authored-By Claude
git push                 # github
git push-tjgo            # gitlab (dispara pipelines)
```

---

## Diretrizes pra mudanças

- **Edições coordenadas**: features tocam `frontend/src/` e `backend/src/main/java/` no mesmo commit.
- **Migrations SQL** (Liquibase): `backend/src/main/resources/db/changelog/changes/NNN_descricao.sql` + registro em `db.changelog-master.xml`. Liquibase aplica automaticamente no boot do pod. Avisar a equipe de banco do TJGO APENAS em 4 cenários (destrutiva, pesada, objetos de outro dono, tabela compartilhada).
- **Backend Node legado** (`api/` em outro lugar, fora do monorepo): NÃO mexer. Foi substituído pelo Java.

---

## Estado da migração / cutover (snapshot 2026-06-11)

- ✅ Backend Java rodando em staging OpenShift (`painel-sgjt-stag-api2`)
- ✅ Frontend Vite buildado em staging (`painel-sgjt-stag-frontend2`)
- ✅ Liquibase aplicando migrations 151–154 automaticamente
- ✅ SSO Keycloak funcionando end-to-end (login + callback + logout com `id_token_hint`)
- ✅ Módulo "Desenvolvimento" liberado pra 3 emails (`ifccupertino@`, `acandrade@`, `sgrocha@tjgo.jus.br`)
  - Whitelist em [backend/.../AmbientesController.java#DEV_EMAILS](backend/src/main/java/br/jus/tjgo/kaizen/controller/AmbientesController.java) e [frontend/src/utils/devEmails.ts](frontend/src/utils/devEmails.ts) (manter sincronizado)
- ⏳ Cutover Node→Java em staging — aguardando shadow traffic 48h
- ⏳ Cutover em produção — depois do staging validado

---

## Infraestrutura

- **OpenShift TJGO**: `ocp-prd.tjgo.jus.br`, namespace `painel-sgjt-stag`
- **Pipelines Tekton** (`api2` e `frontend2`): leem branch `stag` (não tag), disparam via `push-bk`/`push-ft`
- **Keycloak**: `sso.tjgo.jus.br/auth/...` (versão antiga, exige `id_token_hint` no logout — vide [AuthController.ssoLogout](backend/src/main/java/br/jus/tjgo/kaizen/controller/AuthController.java))
- **Secrets em staging**: `api2-default` (URLs), `api2-postgres` (DB), `api2-sso` (Keycloak credentials)

---

## Documentação chave

- [`backend/docs/HANDOFF_PERMISSOES_TAP.md`](backend/docs/HANDOFF_PERMISSOES_TAP.md) — feature "Permissões do TAP"
- [`backend/docs/CUTOVER_RUNBOOK.md`](backend/docs/CUTOVER_RUNBOOK.md) — runbook do cutover
- [`backend/contract-tests/SHADOW_TRAFFIC_SPEC.md`](backend/contract-tests/SHADOW_TRAFFIC_SPEC.md) — shadow traffic
- [`backend/deploy/staging-shadow/README.md`](backend/deploy/staging-shadow/README.md) — pacote OpenShift TJGO
