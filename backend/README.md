# Backend — Badu Contratos

API Node.js + Express, SQLite (`node:sqlite`, sem dependência nativa pra compilar), login do Badu por e-mail/senha com sessão em cookie `httpOnly`, CPF/CNPJ/RG criptografados em repouso (AES-256-GCM). O próprio servidor serve o frontend estático também.

## Setup

```bash
cd backend
npm install
cp .env.example .env
```

Gere `ENCRYPTION_KEY` e `SESSION_SECRET` (execute duas vezes, um valor pra cada):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Preencha as `BUSINESS_*` (nome, CNPJ, endereço, PIX, conta do contratado) — sem elas, usa placeholders genéricos. Depois:

```bash
npm run create-admin -- badu@exemplo.com "uma-senha-bem-forte"
npm start
```

Abra `http://localhost:3000`. Requer Node 22.5+ (usa `node:sqlite`).

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
| GET | `/api/config` | público | dados do contratado pro texto do contrato + flag de modo demo |

`*` com sessão do Badu devolve o registro completo; sem sessão, só o resumo.

## Decisões

- **SQLite via `node:sqlite`** em vez de `better-sqlite3`: mesma ideia, sem binário nativo pra compilar. Migrar pra Postgres depois é só trocar `src/db.js`.
- **Sessão**: token de 32 bytes na tabela `sessions`, cookie `httpOnly` assinado. `SameSite=None`+`Secure` automático se `FRONTEND_ORIGIN` estiver definido (deploy separado).
- **Criptografia**: `cliente_cpf_cnpj`/`cliente_rg` cifrados em `src/crypto.js`, descriptografados só pro Badu autenticado.
- **PDF no servidor** (`pdfkit`, `src/pdf.js`): é a única superfície onde CPF/RG aparece fora do banco, e só sai pro Badu ou pra quem já tem o código de um contrato finalizado.

## Dados do contratado (repo público)

CNPJ, endereço, PIX e conta do contratado vêm de env vars (`src/business.js`), não do código — dados reais de terceiro, repo público. `GET /api/config` expõe isso pro frontend montar o contrato (não é segredo do sistema, é conteúdo do próprio documento; só não fica escrito no histórico do repositório).

## Modo demo

`DEMO_MODE=true`: banco em memória (reseta a cada restart), `src/seed.js` semeia um admin de teste e dois contratos fictícios a cada boot, frontend mostra aviso fixo no topo.

```bash
DEMO_MODE=true npm start
```

## Deploy

Ver [`../DEPLOY.md`](../DEPLOY.md) pro passo a passo completo (Render, com ou sem frontend separado).
