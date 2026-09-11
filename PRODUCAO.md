# Colocando em produção real (dados de clientes de verdade)

Isto é diferente da demo do portfólio: aqui, perder o banco ou a chave de criptografia
significa perder contratos assinados de clientes reais. Checklist antes de divulgar o link
pro Badu usar de verdade.

## Por que isso é uma branch separada

Este código vive na branch `producao`, não na `main`. A `main` é o que a demo pública
(`perronibd.onrender.com`) roda — continua em SQLite, intocada. A branch `producao` migrou
o banco pra Postgres, porque o disco do plano gratuito do Render é efêmero: sem isso, um
redeploy apagaria contratos reais. Suba a produção como um **serviço novo** no Render (ou
onde for), apontando pra branch `producao` — nunca reaproveite o serviço da demo.

## 1. Banco Postgres

Crie um projeto **separado** do que for usado pra demo (Neon, Supabase, ou o Postgres
gerenciado da própria hospedagem). Copie a connection string pra `DATABASE_URL`.

## 2. Variáveis de ambiente

Diferenças em relação à demo:

| Variável | Produção real |
|---|---|
| `DATABASE_URL` | Postgres dedicado à produção, nunca o mesmo da demo |
| `DEMO_MODE` | `false` (ou omitida) |
| `DEMO_ADMIN_*` | não usadas fora do modo demo |
| `NODE_ENV` | `production` |
| `BUSINESS_NOME_ARTISTA` / `BUSINESS_NOME_EMPRESA` | `Badu Perrone` / `Badu Produções` |
| `BUSINESS_CNPJ`, `BUSINESS_REPRESENTANTE`, `BUSINESS_END_*`, `BUSINESS_PIX`, `BUSINESS_BANCO_*` | dados reais do Badu — aqui sim, preenchidos |
| `ENCRYPTION_KEY`, `SESSION_SECRET` | geradas na hora, exclusivas desta instância |

## 3. Criar o admin real do Badu

Sem `DEMO_MODE`, não existe seed automático. Depois do primeiro deploy, rode uma vez
(via shell da hospedagem ou localmente apontando pro `DATABASE_URL` de produção):

```bash
npm run create-admin -- email-do-badu@exemplo.com "senha-forte-de-verdade"
```

## 4. Backup da chave de criptografia — não pule isto

`ENCRYPTION_KEY` cifra o CPF/CNPJ/RG de todo cliente. **Se essa chave for perdida, os dados
já salvos ficam permanentemente ilegíveis** — não tem como recuperar, nem trocando a chave
depois. Guarde `ENCRYPTION_KEY`, `SESSION_SECRET` e a senha do admin num gerenciador de
senhas ou outro lugar seguro fora do Render, assim que gerar — não só no painel da
hospedagem.

## 5. Backup do banco

Postgres gerenciado (Neon/Supabase) normalmente já faz backup automático — confirme o
plano escolhido. Considere também exportar o banco periodicamente (`pg_dump`) se o volume
de contratos justificar.

## 6. Teste antes de divulgar

Com a instância no ar: cria um contrato de teste (dados fictícios, não reais), assina como
cliente, entra como Badu, finaliza, baixa o PDF, confirma que reiniciar o serviço não
apaga os dados (diferente da demo — aqui os dados devem persistir). Só depois disso passe
o link real pro Badu.
