# Cutover Runbook — Node → Java (Kaizen / TJGO)

Procedimento de troca do backend de produção de **Node/Express** para **Java/Spring Boot**, com
plano de **rollback ensaiado (≤ 5 min)**. O frontend, o banco (208 migrations) e o contrato de API
**não mudam** — só o processo que serve `/api`.

> **Pré-condição**: suíte de contract tests verde (`STATUS-DIFF=0`, `VALUE=0` fora KNOWN) na suíte
> sintética **e** no shadow traffic (ver `contract-tests/SHADOW_TRAFFIC_SPEC.md`).

---

## 1. Checklist PRÉ-cutover (D-1)

### 1.1 Usuários soft-deletados (CRÍTICO — KNOWN_DIVERGENCES #7)
O Java filtra `is_deleted = FALSE` em 100% das autenticações. Um admin/superadmin soft-deletado **para de logar**. Rodar contra o banco de **produção**:
```sql
SELECT id, name, email, role, is_superadmin, is_deleted
FROM users
WHERE is_deleted = TRUE AND (role IN ('ADMIN','MANAGER') OR is_superadmin = TRUE);
```
Se houver alguém importante na lista, restaurar **antes** do cutover:
```sql
UPDATE users SET is_deleted = FALSE WHERE id IN (...);
```
> No dev confirmou-se ids 1,2,3 soft-deletados (herança de smoke tests) — em prod, conferir os reais.

### 1.2 Validadores hardcoded (KNOWN #6)
Confirmar que os 4 e-mails de `VALIDADORES_FINAIS` (`util/Validadores.java`) estão corretos e ativos em produção:
`gmpdmaciel`, `dcamaral`, `ifccupertino`, `jdnascimento` @tjgo.jus.br. A regra de "diretoria" vem de `cadastros_areas.gestor_user_id` (dinâmica) — conferir que as áreas têm gestor setado.

### 1.3 Configuração / segredos do Java (env, NÃO versionados)
- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` → banco de **produção**.
- `PORT` → porta que o proxy/ingress espera (o Node usa 8080; o Java pode assumir a mesma).
- `SPRING_PROFILES_ACTIVE` → perfil de produção (sem `application-local.yml`).
- SSO/Keycloak: `SSO_ENABLED`, `KEYCLOAK_*`, `FRONTEND_URL`, `CORS_ORIGINS` conforme o ambiente.
- `TZ` do processo/container = `America/Sao_Paulo` (o serializer de `date` assume esse fuso — fix C).

### 1.4 Build e fumaça
- `mvn -q clean package` (gera o jar; roda testes).
- Subir o jar apontando para uma **réplica** de produção e rodar `contract-tests/ab-compare.ps1` + `ab-workflow.ps1` contra o Node de prod (read-only) → paridade.
- `GET /actuator/health` = `{"status":"UP"}`; `GET /actuator/info` mostra `app.version`.

### 1.5 Backup
- Snapshot/backup do banco de produção imediatamente antes (o cutover **não** muda schema, mas é higiene).
- Garantir que o artefato/imagem do **Node atual** está versionado e pronto para redeploy (rollback).

---

## 2. Cutover (D-Day, janela de baixo tráfego)

1. **Anunciar** janela (banner/canal). Idealmente fora do horário de pico.
2. **Subir o Java** ao lado do Node (porta distinta), aguardar `/actuator/health = UP` e rodar um smoke read-only rápido (login + `GET /api/home/resumo` + 2-3 telas) apontando direto no Java.
3. **Trocar o roteamento** no proxy/ingress para o Java:
   - nginx: `proxy_pass http://kaizen_java;` + `nginx -s reload`.
   - k8s/OpenShift: apontar o `Service`/`Route` para o deployment Java (ou trocar o label do selector).
4. **Validação imediata (T+0 a T+5 min)** — ver seção 4.
5. **Manter o Node de pé e quente** por ≥ 24-48h (rollback instantâneo).

---

## 3. Rollback (ENSAIADO — alvo ≤ 5 min)

> Ensaiar este passo em staging ANTES do cutover real, cronometrando.

**Gatilho**: qualquer um de — taxa de erro 5xx acima do baseline, falha de login (ver 1.1),
divergência de comportamento reportada, `/actuator/health` ≠ UP de forma persistente.

**Passos** (o Node nunca foi desligado):
1. Reapontar o proxy/ingress de volta para o **Node :8080**:
   - nginx: reverter `proxy_pass http://kaizen_node;` + `nginx -s reload` (segundos).
   - k8s/OpenShift: reverter o `Service`/`Route` selector para o deployment Node.
2. Confirmar `GET /health` (Node) e um login OK.
3. Comunicar rollback. O banco **não** precisa de restauração (schema inalterado; sem migration no cutover).
4. Coletar logs do Java (`log.error` com stack — fix D loga tudo no servidor) para diagnóstico.

**Por que ≤ 5 min é realista**: rollback = um reload de proxy / troca de selector. Não há migração de
dados nem mudança de schema para reverter. O Node fica quente em paralelo.

---

## 4. Validação PÓS-cutover (T+0 a T+30 min)

- [ ] Login local e via SSO funcionam (testar um ADMIN, um MANAGER, um VIEWER reais).
- [ ] `GET /api/home/resumo` retorna pendências esperadas (não 401/500).
- [ ] Abrir 1 processo de negócio e validar uma camada (smoke do fluxo identity-based).
- [ ] `GET /actuator/metrics` — latência (`http.server.requests`) e erros dentro do baseline.
- [ ] Logs do servidor sem `Erro nao tratado` recorrente (fix D registra stack completo).
- [ ] Conferir que campos numéricos/datas aparecem certos no frontend (fixes B/C/E).

---

## 5. Pós-cutover (D+1 a D+7)
- Monitorar 5xx, latência e tickets.
- Após 48-72h estáveis: desprovisionar o Node (manter artefato versionado por garantia).
- Reavaliar com produto os bugs pré-existentes catalogados (decisão de produto, fora da fidelidade):
  - `POST_CUTOVER_BUGS #1` — Home `projetos {0,0,0}` (`data_fim_prevista` inexistente).
  - `POST_CUTOVER_BUGS #2` — `gestao-estrategica/projetos` 500 (`instrumentos_planejamento` inexistente).
  - Demais entradas de `POST_CUTOVER_BUGS.md`.

---

## Pontos críticos (resumo)
| Risco | Mitigação |
|---|---|
| Admin soft-deletado não loga | Checklist 1.1 (query + restore) |
| TZ errado nas datas | `TZ=America/Sao_Paulo` no container (1.3) |
| Divergência sob tráfego real | Shadow traffic 48h verde antes (SHADOW_TRAFFIC_SPEC) |
| Indisponibilidade no cutover | Node quente em paralelo; rollback por reload ≤ 5 min |
| Segredos vazando | Env vars (nunca versionar); 500 sanitizado (fix D) |
