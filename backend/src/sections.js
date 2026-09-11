// Texto das cláusulas do contrato, em texto puro, pro PDF gerado no servidor.
const { getBusinessInfo } = require('./business');

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

function dateLong(iso) {
  if (!iso) return '';
  var parts = iso.split('-').map(Number);
  var y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || !d) return '';
  return d + ' de ' + MESES[m - 1] + ' de ' + y;
}
function dateShort(iso) {
  if (!iso) return '';
  var parts = iso.split('-').map(Number);
  var y = parts[0], m = parts[1], d = parts[2];
  if (!y || !m || !d) return '';
  return String(d).padStart(2, '0') + '/' + String(m).padStart(2, '0') + '/' + y;
}
function formatBRL(v) {
  var n = Number(v);
  if (isNaN(n)) return '';
  return 'R$ ' + n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function V(val) {
  return (val === undefined || val === null || val === '') ? '—' : val;
}
function PEND(text) {
  return text;
}

function buildSections(c) {
  var biz = getBusinessInfo();
  var dLong = dateLong(c.evento.data);
  var dShort = dateShort(c.evento.data);
  var hIni = c.evento.hora;

  var sections = [];

  sections.push({ heading: null, paragraphs: [
    'CONTRATANTE: ' + V(c.cliente.nome) + ', ' + V(c.cliente.nacionalidade) + ', ' + V(c.cliente.profissao) + ', com sede na ' + V(c.cliente.endRua) + ', nº ' + V(c.cliente.endNumero) + ', ' + V(c.cliente.endBairro) + ', ' + V(c.cliente.endCidade) + ', CEP ' + V(c.cliente.endCep) + '. CPF/CNPJ: ' + V(c.cliente.cpfCnpj) + '. RG: ' + V(c.cliente.rg) + '.',
    'CONTRATADO: ' + biz.nomeEmpresa + ', inscrita no CNPJ sob o nº ' + biz.cnpj + ', representada pelo titular ' + biz.representante + ', domiciliado na ' + biz.endRua + ', nº ' + biz.endNumero + ', bairro ' + biz.endBairro + ', CEP ' + biz.endCep + ', ' + biz.cidadeUf + '.',
    'As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Apresentação do Artista ' + biz.nomeArtista + ', que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.'
  ]});

  sections.push({ heading: 'Do objeto do contrato', paragraphs: [
    '1. Este contrato tem como objeto a apresentação do Artista ' + biz.nomeArtista + ', neste ato representado pela empresa ' + biz.nomeEmpresa + ', o CONTRATADO, ao público presente no endereço: ' + V(c.evento.localRua) + ', nº ' + V(c.evento.localNumero) + ', ' + V(c.evento.localBairro) + ', ' + V(c.evento.localCidade) + ', CEP ' + V(c.evento.localCep) + ', no dia ' + V(dLong || null) + ', às ' + V(hIni) + '. Informações fornecidas pelo CONTRATANTE.'
  ]});

  var durParagraphs = [];
  if (c.duracaoFinal && c.duracaoFinal.horaFim) {
    var interText = c.duracaoFinal.temIntervalo
      ? ('com intervalo de ' + V(c.duracaoFinal.intervaloMin) + ' minutos no meio desse período')
      : 'sem intervalo, em apresentação contínua';
    durParagraphs.push('2. Início do evento às ' + V(hIni) + ' do dia ' + V(dShort || null) + ', com previsão de término às ' + V(c.duracaoFinal.horaFim) + ', ' + interText + '.');
  } else {
    durParagraphs.push('2. Início do evento às ' + V(hIni) + ' do dia ' + V(dShort || null) + '. ' + PEND('O horário previsto de término e a existência ou não de intervalo serão confirmados por ' + biz.nomeEmpresa + ' antes da assinatura do CONTRATADO.'));
  }
  var horaExtraText = (c.duracaoFinal && c.duracaoFinal.valorHoraExtra != null)
    ? ('será cobrado o adicional por hora de ' + V(formatBRL(c.duracaoFinal.valorHoraExtra)) + '.')
    : PEND('o valor do adicional por hora será definido por ' + biz.nomeEmpresa + ' e confirmado nesta cláusula antes da assinatura do CONTRATADO.');
  durParagraphs.push('3. Caso o artista ultrapasse o tempo estabelecido na cláusula anterior, será de sua inteira responsabilidade, não existindo acréscimo ao pagamento a ser efetuado pelo CONTRATADO. Porém, após o término da apresentação anunciado pelo artista, havendo desejo do CONTRATANTE e disponibilidade do CONTRATADO, ' + horaExtraText);
  sections.push({ heading: 'Da duração do show', paragraphs: durParagraphs });

  sections.push({ heading: 'Do repertório', paragraphs: [
    '4. O repertório musical a ser apresentado no dia do show será escolhido a critério do CONTRATADO, ficando impossibilitado ao CONTRATANTE opor-se à escolha das músicas, podendo somente o CONTRATANTE dar sugestões sobre o repertório, sem vinculação de aceitação pelo CONTRATADO.'
  ]});

  sections.push({ heading: 'Dos equipamentos', paragraphs: [
    '5. O CONTRATADO fornecerá todo instrumento musical necessário à apresentação, comprometendo-se ao fornecimento da estrutura de som, iluminação e DJ. A CONTRATANTE compromete-se a garantir:',
    { list: [
      'Fornecimento de energia 110v ou 220v, próximo ao local do show;',
      'Local coberto para a realização e devida proteção dos equipamentos em caso de chuva.'
    ]}
  ]});

  sections.push({ heading: 'Das despesas', paragraphs: [
    '6. As despesas com alvarás são de responsabilidade exclusiva da CONTRATANTE.',
    '7. Diante da necessidade de viagem do artista CONTRATADO, as despesas com transporte e hospedagem ficam sob responsabilidade do CONTRATADO. As despesas de refeições durante a apresentação ficam por conta da CONTRATANTE.'
  ]});

  sections.push({ heading: 'Das condições', paragraphs: [
    '8. A CONTRATANTE compromete-se a oferecer policiamento ou segurança, palco e suprimento de energia elétrica condizentes com o equipamento, responsabilizando-se por qualquer risco que possa expor terceiros.',
    '9. Este contrato não é passível de transferência por nenhuma das partes a outra empresa ou clube.'
  ]});

  var payParagraphs = [];
  if (c.pagamento && c.pagamento.valorEntrada != null && c.pagamento.valorRestante != null) {
    var total = Number(c.pagamento.valorEntrada) + Number(c.pagamento.valorRestante);
    payParagraphs.push('10. A CONTRATANTE se compromete a pagar a quantia total de ' + V(formatBRL(total)) + ' ao CONTRATADO em contraprestação à apresentação, sendo ' + V(formatBRL(c.pagamento.valorEntrada)) + ' de entrada e ' + V(formatBRL(c.pagamento.valorRestante)) + ' a serem pagos até a semana do show.');
  } else {
    payParagraphs.push('10. ' + PEND('O valor total do cachê, o valor de entrada e o saldo a pagar até a semana do show serão definidos por ' + biz.nomeEmpresa + ' e confirmados nesta cláusula antes da assinatura do CONTRATADO.'));
  }
  payParagraphs.push('Dados para pagamento — PIX: ' + biz.pix + ', ou Conta ' + biz.bancoConta + ', Agência ' + biz.bancoAgencia + ', Banco ' + biz.bancoNome + ', titular ' + biz.representante + '.');
  sections.push({ heading: 'Do pagamento', paragraphs: payParagraphs });

  sections.push({ heading: 'Vedações', paragraphs: [
    '11. O CONTRATADO se compromete a não utilizar técnica de apresentação que utilize pirotecnia (fogos de artifício, sinalizadores ou assemelhados), visando a máxima segurança do público.'
  ]});

  sections.push({ heading: 'Da rescisão', paragraphs: [
    '12. O presente contrato será rescindido caso uma das partes descumpra o pactuado nas cláusulas deste instrumento.',
    '13. Caso ocorra impedimento à realização da apresentação, ligado a caso fortuito ou força maior, as partes deverão pactuar outra data ou proceder à devolução dos valores e à reposição do que foi gasto nos preparativos.'
  ]});

  sections.push({ heading: 'Da multa', paragraphs: [
    '14. A parte que der causa à rescisão do presente instrumento pagará multa de 50% do valor do contrato.'
  ]});

  sections.push({ heading: 'Do foro', paragraphs: [
    '15. Para dirimir quaisquer controvérsias oriundas deste contrato, as partes elegem o foro da comarca de Itatiba - SP.'
  ]});

  sections.push({ heading: null, paragraphs: [
    'Por estarem assim justos e contratados, firmam o presente instrumento de forma eletrônica, com data e hora do aceite de cada parte registradas abaixo.'
  ]});

  return sections;
}

module.exports = { buildSections, dateLong, dateShort, formatBRL };
