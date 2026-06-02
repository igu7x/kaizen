# Pacote de Deploy — Staging do Kaizen (Frontend + Backend)

> **Para a equipe de infra do TJGO.**
>
> Este pacote sobe o monorepo **Kaizen** (frontend React + backend Java) em
> STAGING no OpenShift como um ambiente **próprio** — diferente do shadow
> traffic já entregue em `backend/deploy/staging-shadow/`, este aqui serve
> usuários reais para testes pré-produção.

---

## 1. Visão geral

### Topologia

```
   navegador                                    cluster OpenShift
   ────────                                     ─────────────────
       │
       │  HTTPS                  ┌──────────────────────────────┐
       └──────► Route (público)──┤ Service kaizen-frontend       │
                                  │   ↓                           │
                                  │ Pod nginx (serve React /dist) │
                                  │   ↓ proxy /api/*              │
                                  │   ↓ proxy /actuator/*         │
                                  │ Service kaizen-backend        │
                                  │   ↓                           │
                                  │ Pod Java (Spring Boot :8081)  │
                                  │   ↓                           │
                                  │ Postgres (já existente)       │
                                  └──────────────────────────────┘
```

- **1 Route pública** (frontend). Backend NÃO é exposto.
- O nginx do frontend faz proxy de `/api/*` para o `Service kaizen-backend` (ClusterIP, interno).
- **Sem CORS** — frontend e backend compartilham a mesma origem do ponto de vista do navegador.

### O que NÃO está aqui

- Provisionamento de Postgres (assume que vocês têm staging ou usam o mesmo do TJGO).
- Provisionamento do Keycloak (assume que já existe).
- Apontamento de DNS (a Route já cuida disso, mas talvez precisem de CNAME).

---

## 2. Arquivos neste pacote

| Arquivo | Para que serve |
|---|---|
| `Dockerfile.backend` | Build multistage do Java (UBI9 JDK 21 → UBI9 JRE 21). Contexto: pasta `backend/`. |
| `Dockerfile.frontend` | Build multistage do React (Node 20 + Vite → nginx-122 UBI9). Contexto: pasta `frontend/`. |
| `nginx-frontend.conf` | Config nginx que serve o React + proxy `/api/*` e `/actuator/*` pro backend. Inclui SPA fallback e cache de assets. |
| `openshift-backend.yaml` | `ConfigMap` + `Secret` stub + `Deployment` + `Service` (ClusterIP). **Sem Route**. |
| `openshift-frontend.yaml` | `Deployment` + `Service` + **`Route`** pública. |
| `gitlab-ci.yml` | Pipeline: 2 jobs `build:*` (buildah) + 1 job `deploy:staging` (`oc apply`). Deploy é `when: manual`. |

---

## 3. Antes de aplicar — variáveis que precisamos preencher

Substituam nos YAMLs antes do `oc apply`. Procurem por `<<>>`.

| Placeholder | Onde | O que é |
|---|---|---|
| `<<NAMESPACE>>` | ambos YAMLs | Namespace de staging do Kaizen |
| `<<IMAGE_BACKEND>>` | `openshift-backend.yaml` | `image:tag` do backend (saída do CI) |
| `<<IMAGE_FRONTEND>>` | `openshift-frontend.yaml` | `image:tag` do frontend (saída do CI) |
| `<<DB_HOST>>`, `<<DB_NAME>>` | `openshift-backend.yaml` | Postgres de staging |
| `<<KEYCLOAK_URL>>`, `<<KEYCLOAK_REALM>>`, `<<KEYCLOAK_CLIENT_ID>>` | `openshift-backend.yaml` | Keycloak de staging |
| `<<FRONTEND_URL>>` | `openshift-backend.yaml` | Será `https://<HOST>` |
| `<<HOST>>` | `openshift-frontend.yaml` | Hostname público (ex: `kaizen-stag.apps.ocp-prd.tjgo.jus.br`) |

### Secrets (NÃO versionar)

Criem manualmente uma vez:

```bash
oc -n <<NAMESPACE>> create secret generic kaizen-backend-secret \
    --from-literal=DB_PASSWORD='<<senha-do-postgres>>' \
    --from-literal=JWT_SECRET='<<segredo-jwt>>'
```

> `JWT_SECRET` precisa ser o mesmo usado pelo Node em produção (se ainda
> existir) ou um valor compartilhado entre frontend e backend.

---

## 4. Passo a passo (primeira vez)

### 4.1 Build local (validação opcional)

A partir da raiz do monorepo:

```bash
docker build -t kaizen-backend:test  -f deploy/staging/Dockerfile.backend  backend/
docker build -t kaizen-frontend:test -f deploy/staging/Dockerfile.frontend frontend/
```

Se passou aqui, passa no CI.

### 4.2 Criar Secret no namespace

Ver seção 3 acima.

### 4.3 Configurar o CI

Em GitLab → **Settings → CI/CD → Variables**, adicionar:

| Variável | Exemplo |
|---|---|
| `IMAGE_REGISTRY` | `image-registry.openshift-image-registry.svc:5000/<namespace>` |
| `REGISTRY_USER` / `REGISTRY_PASSWORD` | credenciais de push |
| `OC_TOKEN_STAGING` (PROTECTED) | service account token |
| `OC_SERVER_STAGING` | URL do master |
| `OC_NAMESPACE_STAGING` | `kaizen-stag` |
| `DB_HOST_STAGING`, `DB_NAME_STAGING` | host/nome do Postgres |
| `KEYCLOAK_URL_STAGING`, `KEYCLOAK_REALM_STAGING`, `KEYCLOAK_CLIENT_ID_STAGING` | Keycloak |
| `FRONTEND_URL_STAGING` | `https://kaizen-stag.apps.ocp-prd.tjgo.jus.br` |
| `HOST_STAGING` | `kaizen-stag.apps.ocp-prd.tjgo.jus.br` |

### 4.4 Disparar o pipeline

Push para `main` → builds rodam automaticamente. **Deploy é manual** (botão "play" no GitLab). Ao clicar, o `gitlab-ci.yml`:

1. Loga no OpenShift via `OC_TOKEN_STAGING`.
2. Substitui placeholders nos YAMLs.
3. `oc apply -f` nos dois manifestos.
4. Aguarda `rollout status` dos dois Deployments.
5. Lista routes/svcs/pods criados.

---

## 5. Pós-deploy — checklist

- [ ] `https://<HOST>/healthz` retorna `ok\n` (nginx UP).
- [ ] `https://<HOST>/actuator/health` retorna `{"status":"UP"}` (backend UP via proxy).
- [ ] Abrir `https://<HOST>` no navegador, fazer login (local ou SSO), navegar uma tela com dados (ex.: `/cadastros/areas`).
- [ ] Logs do nginx (`oc logs deploy/kaizen-frontend`) e do backend (`oc logs deploy/kaizen-backend`) sem erro.
- [ ] `/actuator/metrics` mostra latência dentro do esperado.

---

## 6. Atualizações futuras

Push em `main` → builds rodam → "play" no deploy. O `RollingUpdate` mantém o serviço UP durante a troca de versão (1 pod novo sobe antes do antigo cair).

Para escalar (caso precise mais capacidade em staging):

```bash
oc -n <<NAMESPACE>> scale deployment/kaizen-backend  --replicas=2
oc -n <<NAMESPACE>> scale deployment/kaizen-frontend --replicas=2
```

---

## 7. Rollback

```bash
oc -n <<NAMESPACE>> rollout undo deployment/kaizen-backend
oc -n <<NAMESPACE>> rollout undo deployment/kaizen-frontend
```

Volta para a versão imediatamente anterior. O Postgres é compartilhado e não muda, então o rollback é só de aplicação.

---

## 8. Suporte / dúvidas

- Repositório: https://github.com/igu7x/new-kaizen
- Branch principal: `main`
- Owner: Igor Teixeira (`teixeiraigor09@gmail.com`)
- Docs adicionais em `backend/docs/` (cutover runbook, auth audit, etc.)
