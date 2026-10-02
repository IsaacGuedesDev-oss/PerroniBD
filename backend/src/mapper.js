// Converte entre as linhas planas da tabela `contratos` (schema do BACKEND_SPEC.md)
// e o formato aninhado que o frontend (js/app.js) já usa internamente.
const { encrypt, decrypt } = require('./crypto');

function toBool(v) {
  return v === 1 || v === true;
}

// Mais de 11 dígitos = CNPJ (pessoa jurídica); 11 ou menos = CPF (pessoa física).
function isPessoaJuridica(cpfCnpj) {
  return String(cpfCnpj || '').replace(/\D/g, '').length > 11;
}

// Linha do banco -> objeto completo (uso interno / painel do Badu autenticado).
function rowToFullContract(row) {
  if (!row) return null;
  var temDuracao = !!row.duracao_hora_fim;
  var temPagamento = row.pagamento_valor_entrada !== null && row.pagamento_valor_restante !== null;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    cliente: {
      nome: row.cliente_nome || '',
      nacionalidade: row.cliente_nacionalidade || '',
      profissao: row.cliente_profissao || '',
      rg: decrypt(row.cliente_rg) || '',
      cpfCnpj: decrypt(row.cliente_cpf_cnpj) || '',
      email: row.cliente_email || '',
      endRua: row.cliente_end_rua || '',
      endNumero: row.cliente_end_numero || '',
      endBairro: row.cliente_end_bairro || '',
      endCidade: row.cliente_end_cidade || '',
      endCep: row.cliente_end_cep || ''
    },
    evento: {
      localRua: row.evento_local_rua || '',
      localNumero: row.evento_local_numero || '',
      localBairro: row.evento_local_bairro || '',
      localCidade: row.evento_local_cidade || '',
      localCep: row.evento_local_cep || '',
      data: row.evento_data || '',
      hora: row.evento_hora || '',
      horaInicioEvento: row.evento_hora_inicio_evento || '',
      horaFimEvento: row.evento_hora_fim_evento || '',
      observacao: row.evento_observacao || ''
    },
    nomeArtista: row.nome_artista || null,
    duracaoFinal: temDuracao ? {
      horaFim: row.duracao_hora_fim,
      temIntervalo: toBool(row.duracao_tem_intervalo),
      intervaloMin: row.duracao_intervalo_min,
      valorHoraExtra: row.duracao_valor_hora_extra
    } : null,
    equipamentos: {
      fornecerSom: row.equip_fornece_som !== false,
      fornecerIluminacao: row.equip_fornece_iluminacao !== false,
      fornecerDj: row.equip_fornece_dj !== false
    },
    pagamento: temPagamento ? {
      valorEntrada: row.pagamento_valor_entrada,
      valorRestante: row.pagamento_valor_restante
    } : null,
    assinaturaCliente: row.assinatura_cliente || null,
    assinaturaClienteEm: row.assinatura_cliente_em || null,
    assinaturaBadu: row.assinatura_badu || null,
    assinaturaBaduEm: row.assinatura_badu_em || null
  };
}

// Linha do banco -> resumo público (o que o cliente pode ver sem autenticação).
// Nunca inclui CPF/RG, endereço do cliente, valores de pagamento ou assinaturas.
function rowToPublicSummary(row) {
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
    createdAt: row.created_at,
    cliente: {
      nome: row.cliente_nome || ''
    },
    evento: {
      data: row.evento_data || '',
      hora: row.evento_hora || '',
      localCidade: row.evento_local_cidade || ''
    }
  };
}

// Corpo recebido em POST /api/contratos -> valores das colunas para o INSERT.
function createBodyToRow(id, createdAt, body) {
  var cliente = body.cliente || {};
  var evento = body.evento || {};
  // Pessoa jurídica não tem nacionalidade/profissão/RG — ignora o que vier nesses
  // campos nesse caso, independente do que o front mandar.
  var pj = isPessoaJuridica(cliente.cpfCnpj);
  return {
    id: id,
    status: 'aguardando_badu',
    created_at: createdAt,
    cliente_nome: cliente.nome || '',
    cliente_nacionalidade: pj ? '' : (cliente.nacionalidade || ''),
    cliente_profissao: pj ? '' : (cliente.profissao || ''),
    cliente_rg: pj ? null : encrypt(cliente.rg || ''),
    cliente_cpf_cnpj: encrypt(cliente.cpfCnpj || ''),
    cliente_email: cliente.email || '',
    cliente_end_rua: cliente.endRua || '',
    cliente_end_numero: cliente.endNumero || '',
    cliente_end_bairro: cliente.endBairro || '',
    cliente_end_cidade: cliente.endCidade || '',
    cliente_end_cep: cliente.endCep || '',
    evento_local_rua: evento.localRua || '',
    evento_local_numero: evento.localNumero || '',
    evento_local_bairro: evento.localBairro || '',
    evento_local_cidade: evento.localCidade || '',
    evento_local_cep: evento.localCep || '',
    evento_data: evento.data || '',
    evento_hora: evento.hora || '',
    evento_hora_inicio_evento: evento.horaInicioEvento || '',
    evento_hora_fim_evento: evento.horaFimEvento || '',
    evento_observacao: evento.observacao || ''
  };
}

module.exports = { rowToFullContract, rowToPublicSummary, createBodyToRow, isPessoaJuridica };
