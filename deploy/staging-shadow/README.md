# Pacote de Cutover — Kaizen Node → Java (Shadow Traffic em STAGING)

> **Para a equipe de infra do TJGO.**
>
> Este pacote contém o necessário para subir o novo backend **Java** ao lado do
> backend **Node** atual em STAGING e validar paridade via shadow traffic por
> 48 h antes do cutover real em produção.
>
> O usuário final continua sendo servido 100 % pelo Node. O Java só **recebe
> cópia de requisições GET** e descarta a resposta. Não há mudança de schema
> de banco.

---

## 1. Arquivos neste pacote

| Arquivo | Para que serve |
|---|---|
| `Dockerfile` | Build multistage do `kaizen-api-java` (Java 21, Spring Boot 3.3.5). Roda em qualquer registry compatível com OpenShift. |
| `.dockerignore` | Reduz o contexto enviado ao build. |
| `openshift-deployment.yaml` | `ConfigMap` + `Secret` stub + `Deployment` + `Service` (ClusterIP). **Não expõe Route**. |
| `nginx-mirror.conf` | Bloco de mirror para o ingress nginx. Espelha 100 % dos `GET /api/*` para o Java. |
| `gitlab-ci-snippet.yml` | Trecho sugerido para o `.gitlab-ci.yml` que já existe no repo do Node, para o build do Java entrar no pipeline. |

---

## 2. Topologia alvo (Fase 1 — 100 % GET, mesmo banco)

```
                 ┌──────► Node :8080  ──► resposta ao usuário (canal único)
   cliente ──► nginx
                 └─(mirror GET)─► Java :8081  ──► resposta DESCARTADA + logada p/ A/B
```

- **Mesmo banco**: o Java aponta para o **mesmo Postgres do Node** em staging. Como o shadow só espelha `GET` (e o `nginx-mirror.conf` bloqueia o resto com `return 204`), não há risco de duplicar escrita.
- **Sem Route pública**: o `Service` do Java é `ClusterIP`. Só o ingress nginx vê.

---

## 3. Antes de aplicar — informações que precisamos de vocês

Preencher e substituir nos arquivos antes do `oc apply`:

| Placeholder | Onde aparece | O que é |
|---|---|---|
| `<<NAMESPACE>>` | `openshift-deployment.yaml` | Namespace de staging do Kaizen |
| `<<IMAGE>>` | `openshift-deployment.yaml` | Image:tag a deployar (saída do CI; exemplo: `image-registry.openshift-image-registry.svc:5000/<ns>/kaizen-api-java:sha-6e6c3ae`) |
| `<<DB_HOST>>`, `<<DB_NAME>>` | `openshift-deployment.yaml` | Postgres de staging. Mesmo banco usado pelo Node hoje. |
| `<<KEYCLOAK_URL>>`, `<<KEYCLOAK_REALM>>`, `<<KEYCLOAK_CLIENT_ID>>` | `openshift-deployment.yaml` | Idênticos aos que o Node usa em staging |
| `<<FRONTEND_URL>>` | `openshift-deployment.yaml` | URL pública do frontend de staging |
| `kaizen-api-node` (upstream) | `nginx-mirror.conf` | Nome do `Service` do Node atual. Substituir pelo real. |
| `kaizen-api-java` (upstream) | `nginx-mirror.conf` | Já bate com o `Service` que este pacote cria. |

Secrets que vocês criam manualmente (NÃO versionar valores):

```bash
oc -n <<NAMESPACE>> create secret generic kaizen-api-java-secret \
    --from-literal=DB_PASSWORD='<<senha>>' \
    --from-literal=JWT_SECRET='<<segredo-do-node>>'
```

> `JWT_SECRET` precisa ser **o mesmo** que o Node usa em staging — o Java valida tokens emitidos pelo Node. Não rotacionar agora.

---

## 4. Passo a passo (D-0)

1. **Build da imagem** (GitLab CI ou local + push):
   ```bash
   # exemplo local — em produção isso vai pelo CI
   docker build -t image-registry.../kaizen-api-java:sha-6e6c3ae -f deploy/staging-shadow/Dockerfile .
   docker push image-registry.../kaizen-api-java:sha-6e6c3ae
   ```

2. **Criar Secret** no namespace de staging (comando acima).

3. **Substituir placeholders e aplicar manifestos**:
   ```bash
   sed -e 's/<<NAMESPACE>>/kaizen-stag/' \
       -e 's|<<IMAGE>>|image-registry.../kaizen-api-java:sha-6e6c3ae|' \
       -e 's/<<DB_HOST>>/postgres-stag.svc/' \
       -e 's/<<DB_NAME>>/kaizen_stag/' \
       -e 's|<<KEYCLOAK_URL>>|https://sso-stag.tjgo.jus.br|' \
       -e 's/<<KEYCLOAK_REALM>>/kaizen/' \
       -e 's/<<KEYCLOAK_CLIENT_ID>>/kaizen-api/' \
       -e 's|<<FRONTEND_URL>>|https://painel-sgjt-stag.apps.ocp-prd.tjgo.jus.br|' \
       openshift-deployment.yaml | oc apply -f -
   ```

4. **Smoke direto no Java** (porta interna, sem mirror ainda):
   ```bash
   oc -n kaizen-stag port-forward svc/kaizen-api-java 8081:8081
   # em outro shell:
   curl -fsS http://localhost:8081/actuator/health   # esperado: {"status":"UP"}
   curl -fsS http://localhost:8081/actuator/info     # esperado: app.version=1.0
   ```

5. **Configurar mirror no ingress nginx**. Duas opções:

   - **Opção A — `server-snippet` no Ingress** (se o ingress controller é nginx-ingress padrão):
     ```yaml
     metadata:
       annotations:
         nginx.ingress.kubernetes.io/server-snippet: |
           # colar aqui o bloco `location = /__shadow { ... }` do nginx-mirror.conf
         nginx.ingress.kubernetes.io/configuration-snippet: |
           mirror /__shadow;
           mirror_request_body off;
     ```

   - **Opção B — ConfigMap do nginx-controller** (mais limpo, mas global): adicionar o conteúdo de `nginx-mirror.conf` num `ConfigMap` referenciado pelo `nginx-ingress` controller.

   Escolham a forma que melhor encaixa no padrão de vocês.

6. **Validar o mirror**: abrir o painel de staging no navegador, fazer login, navegar. Conferir:
   - Logs do Node continuam servindo o usuário (status 200, latência normal).
   - Logs do Java mostram requisições chegando com header `X-Shadow: 1`.
   - Arquivo `/var/log/nginx/shadow_access.log` (ou destino equivalente) está acumulando entradas JSON.

---

## 5. Coleta A/B e critério de Go/No-Go

Por 48 h, comparar:

- **Para cada requisição** (par `req_id` de Node × Java): status code e hash do corpo.
- **Critérios de aprovação** (mesma régua da suíte sintética em `contract-tests/`):
  - `STATUS-DIFF == 0` (descontadas KNOWN — ver `docs/KNOWN_DIVERGENCES.md`).
  - `VALUE-DIFF == 0` (idem).
- **KNOWN aceitáveis** (já documentadas como bugs do Node replicados fielmente):
  - `Home /resumo projetos {0,0,0}` (POST_CUTOVER #1).
  - `gestao-estrategica/projetos` 500 (POST_CUTOVER #2 — ambos retornam 500 com a mesma mensagem curada após fix D).
  - Demais entradas de `docs/KNOWN_DIVERGENCES.md`.

Quem analisa o log? Sugestão: rodar um script offline (Python/PowerShell) que parseia o `shadow_access.log` e compara com o `access_log` do Node. Se vocês têm Loki ou ELK, faz mais sentido streamar para lá e queryar.

---

## 6. Desligar o shadow

Sem impacto no usuário:

- **Opção A (snippet no Ingress)**: remover as duas annotations e reaplicar o Ingress.
- **Opção B (ConfigMap)**: remover o bloco `mirror` + recarregar o controller.

Pode também escalar o Deployment para 0 réplicas pra liberar recursos enquanto não está usando:

```bash
oc -n kaizen-stag scale deployment/kaizen-api-java --replicas=0
```

---

## 7. Cutover real (depois das 48 h em verde)

Não executar agora. Procedimento completo em [`../../docs/CUTOVER_RUNBOOK.md`](../../docs/CUTOVER_RUNBOOK.md). Resumo:

1. Checklist PRÉ-cutover (D-1) — query do KNOWN #7 (admins soft-deletados) **contra produção**, conferir `VALIDADORES_FINAIS`, env vars, backup.
2. Em produção, repetir o deploy do Java (ajustando namespace e env de produção).
3. Trocar o `proxy_pass` do ingress de produção: Node → Java.
4. Validar T+0 a T+30 min (login, /home/resumo, smoke de processo).
5. Manter Node quente por 24-48 h pra rollback (≤ 5 min via reapontar `proxy_pass`).

---

## 8. O que vocês precisam nos retornar

- **OK na imagem buildada** (registry + tag).
- **OK no Secret criado** (sem precisar revelar valores).
- **OK na config nginx aplicada** + endereço do `shadow_access.log` pra começarmos a comparar.
- **Janela de 48 h** combinada para o monitoramento.

Qualquer dúvida sobre o conteúdo, falar com o time de desenvolvimento (referência: commit `6e6c3ae`, branch principal do projeto Java).
