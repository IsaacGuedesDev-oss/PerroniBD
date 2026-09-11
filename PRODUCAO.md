# Colocando em produção real (dados de clientes de verdade)

Perder o banco ou a chave de criptografia aqui significa perder contratos assinados de
clientes reais. Checklist antes de divulgar o link pro Badu usar de verdade.

## Por que isso é uma branch separada

Este código vive na branch `producao`, não na `main`. A `main` é o que a demo pública
(`perronibd.onrender.com`) roda — continua em SQLite, intocada, sem seed de dados
fictícios nem o aviso de modo demo (que só existiam ali). A branch `producao` migrou o
banco pra Postgres, porque o disco do plano gratuito do Render é efêmero: sem isso, um
redeploy apagaria contratos reais. Suba a produção como um **serviço novo**, apontando
pra branch `producao` — nunca reaproveite o serviço da demo.

## 1. Banco Postgres

Crie um projeto Postgres (Neon, Supabase, ou o gerenciado da própria hospedagem) dedicado
só a esta instância. Copie a connection string pra `DATABASE_URL`.

## 2. Deploy — um serviço só ou separado

**Um serviço só (mais simples):** o próprio backend já serve o frontend na mesma origem.
No Render: **New +** → **Web Service** → conecte o repo → Root Directory: `backend` ·
Branch: `producao` · Build: `npm install` · Start: `npm start`.

**Frontend e backend separados:** backend como acima, mais `FRONTEND_ORIGIN` = URL do
frontend (sem `/` no final) — libera CORS e ativa `SameSite=None` no cookie de sessão.
No frontend, antes de subir (Vercel/Netlify), edite a `<meta name="api-base">` no topo do
`index.html` com a URL do backend + `/api`:
```html
<meta name="api-base" content="https://seu-backend.onrender.com/api">
```
Depois, New Project apontando pro repo, sem build command, publish directory = raiz.

## 3. Variáveis de ambiente

Veja `backend/.env.example` pra lista completa. As que importam pra produção real:

| Variável | Produção real |
|---|---|
| `DATABASE_URL` | Postgres desta instância, dedicado |
| `NODE_ENV` | `production` |
| `BUSINESS_NOME_ARTISTA` / `BUSINESS_NOME_EMPRESA` | `Badu Perrone` / `Badu Produções Ltda.` |
| `BUSINESS_CNPJ`, `BUSINESS_REPRESENTANTE`, `BUSINESS_END_*`, `BUSINESS_PIX`, `BUSINESS_BANCO_*` | dados reais do Badu |
| `ENCRYPTION_KEY`, `SESSION_SECRET` | geradas na hora, exclusivas desta instância |
| `FRONTEND_ORIGIN` | só se front e back forem serviços separados |

## 4. Criar o admin real do Badu

Não existe seed automático nesta branch. Depois do primeiro deploy, rode uma vez (via
shell da hospedagem, ou localmente apontando pro `DATABASE_URL` de produção):

```bash
npm run create-admin -- email-do-badu@exemplo.com "senha-forte-de-verdade"
```

## 5. Backup da chave de criptografia — não pule isto

`ENCRYPTION_KEY` cifra o CPF/CNPJ/RG de todo cliente. **Se essa chave for perdida, os dados
já salvos ficam permanentemente ilegíveis** — não tem como recuperar, nem trocando a chave
depois. Guarde `ENCRYPTION_KEY`, `SESSION_SECRET` e a senha do admin num gerenciador de
senhas ou outro lugar seguro fora do Render, assim que gerar — não só no painel da
hospedagem.

## 6. Backup do banco

Postgres gerenciado (Neon/Supabase) normalmente já faz backup automático — confirme o
plano escolhido. Considere também exportar o banco periodicamente (`pg_dump`) se o volume
de contratos justificar.

## 7. Teste antes de divulgar

Com a instância no ar: cria um contrato de teste (dados fictícios, não reais), assina como
cliente, entra como Badu, finaliza, baixa o PDF, e confirma que reiniciar o serviço não
apaga os dados. Só depois disso passe o link real pro Badu.
