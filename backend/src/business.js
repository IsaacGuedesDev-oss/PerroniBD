// Dados do contratado (nome, CNPJ, endereço, PIX, conta) pro texto do contrato e o PDF.
// Vêm do .env, não do código — são dados reais de terceiro e o repo é público.
function getBusinessInfo() {
  return {
    nomeArtista: process.env.BUSINESS_NOME_ARTISTA || 'Nome do Artista',
    nomeEmpresa: process.env.BUSINESS_NOME_EMPRESA || 'Nome da Produtora Ltda.',
    cnpj: process.env.BUSINESS_CNPJ || '00.000.000/0000-00',
    representante: process.env.BUSINESS_REPRESENTANTE || 'Nome do Representante Legal',
    endRua: process.env.BUSINESS_END_RUA || 'Rua Exemplo',
    endNumero: process.env.BUSINESS_END_NUMERO || '0',
    endBairro: process.env.BUSINESS_END_BAIRRO || 'Bairro Exemplo',
    endCep: process.env.BUSINESS_END_CEP || '00000-000',
    cidadeUf: process.env.BUSINESS_CIDADE_UF || 'Cidade - UF',
    pix: process.env.BUSINESS_PIX || 'chave-pix@exemplo.com',
    bancoConta: process.env.BUSINESS_BANCO_CONTA || '00000000-0',
    bancoAgencia: process.env.BUSINESS_BANCO_AGENCIA || '0000',
    bancoNome: process.env.BUSINESS_BANCO_NOME || 'Nome do Banco'
  };
}

module.exports = { getBusinessInfo };
