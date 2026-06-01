# Instruções para Deploy

## ⚠️ IMPORTANTE — Variáveis de Build (Vite)

As variáveis `VITE_*` são **gravadas no bundle em tempo de build**, não em runtime.
Um build feito com a URL de staging **não pode ser usado em produção**, mesmo que o domínio seja diferente.

Sempre confira qual URL está no bundle antes de fazer deploy:
```bash
grep -r "painel-sgjt-stag\|kaizen-api" frontend/dist/assets/ | head -5
```

---

## Build para PRODUÇÃO (`kaizen.tjgo.jus.br`)

```powershell
# Windows PowerShell
$env:VITE_APP_ENV="production"
npm run build
```

```cmd
# Windows CMD
set VITE_APP_ENV=production && npm run build
```

```bash
# Linux/Mac
VITE_APP_ENV=production npm run build
```

**GitLab CI/CD — variável do pipeline de produção:**
```yaml
variables:
  VITE_APP_ENV: "production"
```

A API usada será: `https://kaizen-api.tjgo.jus.br`

---

## Build para STAGING (`painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br`)

```powershell
# Windows PowerShell
$env:VITE_APP_ENV="staging"
npm run build
```

```cmd
# Windows CMD
set VITE_APP_ENV=staging && npm run build
```

```bash
# Linux/Mac
VITE_APP_ENV=staging npm run build
```

**GitLab CI/CD — variável do pipeline de staging:**
```yaml
variables:
  VITE_APP_ENV: "staging"
```

A API usada será: `https://painel-sgjt-stag-api.apps.ocp-prd.tjgo.jus.br`

---

## Build para DESENVOLVIMENTO LOCAL

Crie `.env.local` na raiz de `frontend/`:
```
VITE_API_URL=http://localhost:3001
```

Depois execute:
```bash
npm run dev
```

---

## URLs por Ambiente

| Ambiente   | `VITE_APP_ENV` | API usada                                                         | Frontend                                               |
|------------|----------------|-------------------------------------------------------------------|--------------------------------------------------------|
| Local      | (não definido) | `http://localhost:3001`                                           | `http://localhost:5173`                                |
| Staging    | `staging`      | `https://painel-sgjt-stag-api.apps.ocp-prd.tjgo.jus.br`          | `https://painel-sgjt-stag-frontend.apps.ocp-prd.tjgo.jus.br` |
| Produção   | `production`   | `https://kaizen-api.tjgo.jus.br`                                  | `https://kaizen.tjgo.jus.br`                           |

---

## Variáveis de ambiente disponíveis

| Variável                  | Descrição                                              | Quando usar                                  |
|---------------------------|--------------------------------------------------------|----------------------------------------------|
| `VITE_APP_ENV`            | Define o ambiente: `production`, `staging`, `development` | **Recomendado** — controle principal         |
| `VITE_API_URL`            | URL explícita da API (sobrescreve tudo)                | Quando precisar apontar para URL customizada  |
| `VITE_API_URL_STAGING`    | Override da URL de staging                             | Para mudar a URL de staging sem alterar código |
| `VITE_API_URL_PRODUCTION` | Override da URL de produção                            | Para mudar a URL de produção sem alterar código |
