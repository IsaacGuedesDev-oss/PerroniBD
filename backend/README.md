# Backend — Badu Contratos

API Node.js + Express, Postgres (via `pg`), login do Badu por e-mail/senha com sessão em cookie `httpOnly`, CPF/CNPJ/RG criptografados em repouso (AES-256-GCM). O próprio servidor serve o frontend estático também.

> Esta é a branch `producao`, pra rodar com dados reais de cliente. A `main` (demo de portfólio) usa SQLite e dados fictícios — não misture os dois.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Preencha `DATABASE_URL` com a connection string de um Postgres (Neon ou Supabase têm plano free). Gere `ENCRYPTION_KEY` e `SESSION_SECRET` (execute duas vezes, um valor pra cada):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Preencha as `BUSINESS_*` (nome, CNPJ, endereço, PIX, conta do contratado) — sem elas, usa placeholders genéricos. Depois:

```bash
npm run create-admin -- badu@exemplo.com "uma-senha-bem-forte"
npm start
```

Abra `http://localhost:3000`.

## Rotas

| Método | Rota | Acesso | Observação |
|---|---|---|---|
| POST | `/api/contratos` | público | cliente cria e assina o contrato |
| GET | `/api/contratos/:id` | público* | resumo (status, nome, data, cidade) — nunca CPF/RG |
| GET | `/api/contratos` | Badu | lista completa, CPF/RG descriptografados |
| PATCH | `/api/contratos/:id` | Badu | grava duração/pagamento e assinatura do Badu |
| DELETE | `/api/contratos/:id` | Badu | exclui |
| GET | `/api/contratos/:id/pdf` | Badu, ou público se `finalizado` | PDF gerado no servidor |
| POST | `/api/auth/login` | público | `{ email, senha }` → cookie de sessão |
| POST | `/api/auth/logout` | Badu | encerra sessão |
| GET | `/api/auth/me` | Badu | confirma sessão válida |
| GET | `/api/config` | público | dados do contratado pro texto do contrato |

`*` com sessão do Badu devolve o registro completo; sem sessão, só o resumo.

## Decisões

- **Postgres via `pg`**: disco do plano gratuito de hospedagens tipo Render é efêmero — arriscado demais pra dados reais de cliente. `src/db.js` cria o schema sozinho na primeira conexão (`CREATE TABLE IF NOT EXISTS`).
- **Sessão**: token de 32 bytes na tabela `sessions`, cookie `httpOnly` assinado. `SameSite=None`+`Secure` automático se `FRONTEND_ORIGIN` estiver definido (deploy separado).
- **Criptografia**: `cliente_cpf_cnpj`/`cliente_rg` cifrados em `src/crypto.js`, descriptografados só pro Badu autenticado. Perder `ENCRYPTION_KEY` torna esses dados irrecuperáveis — ver `PRODUCAO.md`.
- **PDF no servidor** (`pdfkit`, `src/pdf.js`): é a única superfície onde CPF/RG aparece fora do banco, e só sai pro Badu ou pra quem já tem o código de um contrato finalizado.

## Dados do contratado (repo público)

CNPJ, endereço, PIX e conta do contratado vêm de env vars (`src/business.js`), não do código — dados reais de terceiro, repo público. `GET /api/config` expõe isso pro frontend montar o contrato (não é segredo do sistema, é conteúdo do próprio documento; só não fica escrito no histórico do repositório).

## Deploy

Ver [`../PRODUCAO.md`](../PRODUCAO.md) na raiz do repositório.
