# Badu Perrone — Gerador de Contratos

Geração de contratos de apresentação pro artista Badu Perrone. Cliente preenche o formulário, revisa e assina na tela; o Badu confirma duração/pagamento e assina também; PDF final sai pros dois lados.

> Esta é a branch `producao` — o sistema real, com Postgres e dados reais do Badu. A demo de portfólio (dados fictícios) fica na branch `main`.

## Sobre o projeto

Sistema feito pra um cliente real (Badu Perrone Produções, Itatiba-SP). Esta branch é a versão que roda com dados reais de clientes — ver checklist completo em [`PRODUCAO.md`](PRODUCAO.md) antes de colocar no ar.

## Segurança

- CPF/CNPJ e RG criptografados em repouso (AES-256-GCM, `backend/src/crypto.js`)
- Sessão via cookie `httpOnly`, senha com `bcrypt` — sem localStorage/JWT no front
- Consulta pública nunca devolve CPF/RG; o PDF completo só sai pro Badu autenticado ou pra quem já tem o código de um contrato finalizado
- Dados do contratado (CNPJ, endereço, PIX, conta) vêm de variável de ambiente, não do código (`backend/src/business.js`)
- Perder `ENCRYPTION_KEY` torna CPF/RG já salvos irrecuperáveis — ver aviso em `PRODUCAO.md`

## Estrutura

```
badu-contratos/
├── index.html          # telas (landing, formulário, painel do Badu)
├── css/styles.css
├── js/app.js            # formulário, assinatura, chamadas à API, painel admin
├── assets/badu-*.jpg    # fotos do carrossel (material de divulgação do artista)
├── backend/             # API + banco (ver backend/README.md)
├── BACKEND_SPEC.md       # spec original do backend
├── PRODUCAO.md           # checklist de deploy real
└── LICENSE
```

## Rodar localmente

```bash
cd backend
npm install
cp .env.example .env        # preencha DATABASE_URL, ENCRYPTION_KEY e SESSION_SECRET
npm run create-admin -- badu@exemplo.com "uma-senha-bem-forte"
npm start
```

Abra `http://localhost:3000`. Detalhes de cada rota em [`backend/README.md`](backend/README.md).

## Funcionalidades

- Formulário em 3 passos (contratante, endereço, evento) + revisão + assinatura na tela
- Texto do contrato com cláusulas fixas e campos variáveis destacados
- Código de acompanhamento (`BP-20260918-4F2K`) e consulta de status
- Login do Badu (e-mail/senha, cookie httpOnly), painel com:
  - Lista de contratos por data, contador de pendentes/finalizados
  - Edição de duração, intervalo e valores (entrada/restante)
  - Prévia em tempo real, assinatura do Badu, exclusão com confirmação
- PDF final gerado no servidor (`pdfkit`), com as duas assinaturas
- CPF/CNPJ/RG criptografados em repouso, banco Postgres persistente

## Licença

MIT, só pro código (ver [`LICENSE`](LICENSE)). Não cobre o nome/marca "Badu Perrone" / "Badu Produções", as fotos em `assets/` nem o texto do contrato — isso é do cliente.
