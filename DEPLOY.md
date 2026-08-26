# Deploy

Um serviço só (recomendado) ou frontend/backend separados. Em ambos, é você quem cria a conta e clica os botões — isto é só o roteiro.

## Opção A — um serviço só (usada na demo atual)

O próprio backend já serve o frontend na mesma origem.

1. Conta em [render.com](https://render.com) (tem plano free).
2. **New +** → **Web Service** → conecte o repo `PerroniBD`.
3. Root Directory: `backend` · Runtime: Node · Build: `npm install` · Start: `npm start`.
4. Env vars (veja `backend/.env.example` pra lista completa):
   - `ENCRYPTION_KEY`, `SESSION_SECRET` — gere cada uma com `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` (execuções separadas, valores diferentes)
   - `DEMO_MODE=true`, `DEMO_ADMIN_EMAIL=admin@demo.com`, `DEMO_ADMIN_SENHA=demo12345`
   - `BUSINESS_NOME_ARTISTA=Badu Perrone`, `BUSINESS_NOME_EMPRESA=Badu Produções` (marca pública, ok preencher)
   - as outras `BUSINESS_*` (CNPJ, endereço, PIX, conta) — deixe em branco, usa placeholder
   - `FRONTEND_ORIGIN` — em branco (só serve pra Opção B)
5. Criar. Primeiro deploy demora alguns minutos.
6. Testa a URL que o Render dá e cola no README, seção Demo.

Existe também um `backend/render.yaml` (Blueprint) com esses mesmos campos pré-preenchidos, se preferir "New > Blueprint" em vez de configurar manual.

**Plano free:** hiberna sem uso, demora ~30-50s pra acordar. Como o banco demo é em memória, os dados voltam ao estado inicial (seed) cada vez que acorda — esperado, não é bug.

## Opção B — frontend e backend separados

Backend: mesmos passos da Opção A, mais `FRONTEND_ORIGIN` = URL do frontend (sem `/` no final) — libera CORS e ativa `SameSite=None` no cookie de sessão.

Frontend (Vercel/Netlify): antes de subir, edite a `<meta name="api-base">` no topo do `index.html` com a URL do backend + `/api`:
```html
<meta name="api-base" content="https://seu-backend.onrender.com/api">
```
Depois, New Project apontando pro repo, sem build command, publish directory = raiz.

## Variáveis — referência rápida

| Variável | Numa demo pública |
|---|---|
| `ENCRYPTION_KEY`, `SESSION_SECRET` | geradas na hora, nunca reaproveitar o exemplo |
| `DEMO_MODE` | `true` |
| `DEMO_ADMIN_EMAIL` / `DEMO_ADMIN_SENHA` | credenciais de teste públicas |
| `BUSINESS_CNPJ`, `BUSINESS_PIX`, `BUSINESS_BANCO_*`, `BUSINESS_REPRESENTANTE`, `BUSINESS_END_*` | em branco |
| `BUSINESS_NOME_ARTISTA`, `BUSINESS_NOME_EMPRESA`, `BUSINESS_CIDADE_UF` | pode preencher, é marca pública |

Pra uma instância de produção de verdade (não demo): `DEMO_MODE=false`, disco persistente, `BUSINESS_*` com os dados reais — trate o `.env` como segredo de produção.
