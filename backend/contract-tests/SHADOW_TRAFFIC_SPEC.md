# Shadow Traffic — Spec de validação pré-cutover (Kaizen Node → Java)

Objetivo: rodar o backend Java em paralelo ao Node **em staging**, espelhando o tráfego real de
produção/staging para o Java **sem afetar o usuário** (as respostas do Java são descartadas), e
comparar A/B contra o Node. É a validação final antes do cutover: confirma paridade sob tráfego
real, com dados reais e padrões de uso reais — além da suíte sintética (`ab-compare.ps1` / `ab-workflow.ps1`).

## Princípios
1. **Não-intrusivo**: o usuário continua sendo servido **100% pelo Node**. O Java recebe uma *cópia* das requisições.
2. **Read-only primeiro**: na 1ª fase, espelhar **somente GET** (idempotentes). POST/PUT/PATCH/DELETE só depois (ver "Writes").
3. **Resposta do shadow é descartada** pelo proxy (mirror), nunca retorna ao cliente.
4. **Comparação assíncrona**: logar requisição + resposta de ambos e comparar fora do caminho crítico.

## Topologia
```
                ┌────────────► Node :8080  ──► resposta ao usuário
   cliente ──► proxy (mirror)
                └----(cópia)--► Java :8081  ──► resposta DESCARTADA + logada p/ A/B
```

## Opção A — nginx `mirror` (mais simples)
```nginx
upstream kaizen_node { server 127.0.0.1:8080; }
upstream kaizen_java { server 127.0.0.1:8081; }

server {
    listen 80;

    location / {
        # tráfego primário (serve o usuário)
        proxy_pass http://kaizen_node;

        # espelha uma cópia para o Java (resposta ignorada pelo nginx)
        mirror /__shadow;
        mirror_request_body on;
    }

    location = /__shadow {
        internal;
        proxy_pass http://kaizen_java$request_uri;
        # propaga Authorization para o Java autenticar igual ao Node
        proxy_set_header Authorization $http_authorization;
        proxy_set_header X-Shadow "1";
        # respostas do mirror são descartadas pelo nginx
    }
}
```
- **Fase 1 (read-only)**: restringir o mirror a GET — `if ($request_method != GET) { return 200; }` dentro de `/__shadow`, ou usar `limit_except`.
- O log A/B sai do `access_log` de ambos os upstreams + um coletor (ver "Coleta & comparação").

## Opção B — Envoy (mais controle, %, headers)
`request_mirror_policies` na route, com `runtime_fraction` para espelhar só uma fração do tráfego (ex: 10% → 100%):
```yaml
routes:
  - match: { prefix: "/" }
    route:
      cluster: kaizen_node
      request_mirror_policies:
        - cluster: kaizen_java
          runtime_fraction:
            default_value: { numerator: 10, denominator: HUNDRED }   # comece em 10%
```
Vantagens: rampa de % configurável, métricas nativas, fácil ligar/desligar sem reload.

## Banco de dados no shadow
- **GET (read-only)**: Java pode apontar para o **mesmo banco** do Node (leituras não mutam) → A/B byte-a-byte real. **Recomendado para a fase 1.**
- **Writes**: NÃO espelhar writes contra o mesmo banco (duplicaria escrita). Opções:
  1. Pular writes no shadow (fase 1/2) — valida só leitura.
  2. Java aponta para uma **réplica/cópia** do banco para exercitar writes isoladamente (não compara byte-a-byte, valida que não explode).
  3. Writes idempotentes com marker `__shadow__` + cleanup (como no `ab-workflow.ps1`), em janela controlada.

## Coleta & comparação A/B
- Marcar o tráfego shadow com header `X-Shadow: 1`.
- Para cada par (mesma request), capturar: método, path, status, corpo (hash + amostra).
- Comparar com a MESMA classificação da suíte sintética: `EXACT` / `COSMETIC` / `VALUE` / `STATUS-DIFF`.
- Aplicar as KNOWN (ver `docs/KNOWN_DIVERGENCES.md`): ignorar texto de corpo em 4xx/5xx (status é o contrato), `projetos {0,0,0}` (#9), etc.
- **Critério de aprovação**: `STATUS-DIFF == 0` e `VALUE == 0` (descontadas KNOWN) por ≥ 48h de tráfego representativo (incluindo picos e jobs).

## Fases sugeridas
1. **Fase 1** — mirror 100% GET, mesmo banco, 48h. Meta: 0 STATUS-DIFF / 0 VALUE (fora KNOWN).
2. **Fase 2** — incluir workflows multi-step de leitura (telas que encadeiam GETs).
3. **Fase 3** — writes em réplica/marker controlado (opcional, se houver apetite).
4. **Go/No-Go** — relatório de paridade sob tráfego real → decisão de cutover (ver `docs/CUTOVER_RUNBOOK.md`).

## Desligar
Remover o bloco `mirror` (nginx) ou zerar `runtime_fraction` (Envoy) e `reload`. Sem impacto no usuário.
