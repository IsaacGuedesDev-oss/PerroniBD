# Especificação técnica — backend do gerador de contratos

## Objetivo

Substituir o armazenamento client-side do protótipo original (uma API de armazenamento local que não persistia de verdade fora do ambiente onde o protótipo foi montado) por um backend real com autenticação de verdade, para que este projeto possa ser publicado com segurança e usado com dados reais de clientes.

> **Nota:** esta especificação já foi implementada — veja [`backend/README.md`](backend/README.md) para a documentação da API real. Este arquivo fica como registro do desenho original.

## Por que isso é necessário

No estado atual, o PIN que protege o painel do Badu esconde só a **tela** — não os dados. Qualquer pessoa com o link consegue abrir o console do navegador e ler todos os contratos salvos diretamente, sem passar pela senha, porque não existe nenhuma barreira de autenticação real entre quem acessa a página e os dados armazenados. Como o formulário coleta CPF e RG — dados sensíveis protegidos pela LGPD — isso não é adequado para uso com clientes reais até esse ponto ser resolvido.

## Stack sugerida

- **Node.js + Express** — framework simples, bem documentado, fácil de hospedar
- **Banco de dados:** PostgreSQL (Railway, Render ou Supabase têm planos gratuitos suficientes para começar). SQLite é aceitável se o volume de contratos for baixo no início.
- **Autenticação do Badu:** e-mail + senha com hash `bcrypt`, sessão via cookie `httpOnly` (mais simples de implementar) ou JWT
- **Hospedagem com HTTPS automático:** Render, Railway ou Fly.io resolvem isso sem configuração manual de certificado

## Modelo de dados — tabela `contratos`

| campo | tipo | observação |
|---|---|---|
| `id` | string (PK) | código tipo `BP-20260918-4F2K` |
| `status` | enum | `aguardando_badu` \| `finalizado` |
| `created_at` | timestamp | |
| `cliente_nome`, `cliente_nacionalidade`, `cliente_profissao`, `cliente_rg`, `cliente_cpf_cnpj` | string | |
| `cliente_end_rua`, `cliente_end_numero`, `cliente_end_bairro`, `cliente_end_cidade`, `cliente_end_cep` | string | |
| `evento_local_rua`, `evento_local_numero`, `evento_local_bairro`, `evento_local_cidade`, `evento_local_cep` | string | |
| `evento_data`, `evento_hora` | date / time | data e horário de início, definidos pelo cliente |
| `duracao_hora_fim`, `duracao_tem_intervalo`, `duracao_intervalo_min` | | preenchidos só pelo Badu, depois que o contrato chega até ele |
| `pagamento_valor_entrada`, `pagamento_valor_restante` | decimal | preenchidos só pelo Badu |
| `assinatura_cliente` (PNG base64), `assinatura_cliente_em` | | |
| `assinatura_badu` (PNG base64), `assinatura_badu_em` | | |

Considere criptografar em repouso os campos `cliente_cpf_cnpj` e `cliente_rg` — com `pgcrypto` no Postgres, ou criptografando na própria aplicação antes de salvar.

## Endpoints

| Método | Rota | Acesso | Descrição |
|---|---|---|---|
| POST | `/api/contratos` | público | cliente cria e assina o contrato |
| GET | `/api/contratos/:id` | público | consulta por código — retorna só o que o cliente já vê hoje (status, nome, data do show, local resumido). **Nunca** retornar CPF/RG aqui. |
| GET | `/api/contratos` | autenticado (Badu) | lista completa, para o painel |
| PATCH | `/api/contratos/:id` | autenticado (Badu) | edita duração/pagamento e registra a assinatura do Badu |
| DELETE | `/api/contratos/:id` | autenticado (Badu) | exclui o contrato |
| GET | `/api/contratos/:id/pdf` | autenticado, ou com o código já finalizado | gera/retorna o PDF final |
| POST | `/api/auth/login` | público | login do Badu (e-mail + senha) |
| POST | `/api/auth/logout` | autenticado | encerra a sessão |

## O que muda no frontend

A estrutura visual (`index.html`, `css/styles.css`) **não muda**. Em `js/app.js`, trocar:

- `saveContract` / `getContract` / `listContracts` / `deleteContract` → chamadas `fetch()` para os endpoints acima, no lugar de `window.storage.*`
- a tela de PIN (`#screen-admin-gate`) → formulário de login de verdade, guardando o token/cookie de sessão retornado por `/api/auth/login`
- a geração do PDF pode continuar no navegador como está (com jsPDF) ou passar para o servidor — as duas opções funcionam; migrar para o servidor é opcional, não bloqueia o resto

## Ordem sugerida de implementação

1. Configurar o banco de dados e a tabela `contratos`
2. Implementar `POST /api/contratos` e `GET /api/contratos/:id` (fluxo do cliente)
3. Implementar o login do Badu e `GET` / `PATCH` / `DELETE /api/contratos` (fluxo do Badu)
4. Trocar as chamadas de armazenamento em `js/app.js` pelos `fetch()` correspondentes
5. Testar o fluxo completo localmente, do preenchimento à geração do PDF
6. Hospedar com HTTPS e só então divulgar o link para clientes reais
