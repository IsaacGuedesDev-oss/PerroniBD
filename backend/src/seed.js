// Semeia um admin e dois contratos fictícios pro modo demo. Nada aqui é dado real.
const bcrypt = require('bcryptjs');
const { encrypt } = require('./crypto');
const { makeFakeSignaturePNG } = require('./signature');

const DEMO_ADMIN_EMAIL = (process.env.DEMO_ADMIN_EMAIL || 'admin@demo.com').trim().toLowerCase();
const DEMO_ADMIN_SENHA = process.env.DEMO_ADMIN_SENHA || 'demo12345';

function seedDemoData(db) {
  seedDemoAdmin(db);
  seedDemoContrato(db, {
    id: 'BP-DEMO-0001',
    status: 'aguardando_badu',
    nome: 'Cliente Demonstração',
    diasNoFuturo: 21
  });
  seedDemoContrato(db, {
    id: 'BP-DEMO-0002',
    status: 'finalizado',
    nome: 'Contrato Exemplo Finalizado',
    diasNoFuturo: 10,
    duracaoFinal: { horaFim: '23:30', temIntervalo: true, intervaloMin: 20 },
    pagamento: { valorEntrada: 1500, valorRestante: 2500 }
  });
}

function seedDemoAdmin(db) {
  var existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(DEMO_ADMIN_EMAIL);
  if (existing) return;
  var hash = bcrypt.hashSync(DEMO_ADMIN_SENHA, 10);
  db.prepare(
    'INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?)'
  ).run(DEMO_ADMIN_EMAIL, hash, new Date().toISOString());
}

function seedDemoContrato(db, opts) {
  var existing = db.prepare('SELECT id FROM contratos WHERE id = ?').get(opts.id);
  if (existing) return;

  var createdAt = new Date().toISOString();
  var eventoData = new Date(Date.now() + opts.diasNoFuturo * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  var fakeSig = makeFakeSignaturePNG();

  var row = {
    id: opts.id,
    status: opts.status,
    created_at: createdAt,
    cliente_nome: opts.nome,
    cliente_nacionalidade: 'Brasileira',
    cliente_profissao: 'Profissão de Exemplo',
    cliente_rg: encrypt('00.000.000-0'),
    cliente_cpf_cnpj: encrypt('000.000.000-00'),
    cliente_end_rua: 'Rua Fictícia',
    cliente_end_numero: '123',
    cliente_end_bairro: 'Bairro Exemplo',
    cliente_end_cidade: 'Cidade Demo',
    cliente_end_cep: '00000-000',
    evento_local_rua: 'Salão de Festas Exemplo',
    evento_local_numero: '456',
    evento_local_bairro: 'Bairro do Evento',
    evento_local_cidade: 'Cidade Demo',
    evento_local_cep: '00000-000',
    evento_data: eventoData,
    evento_hora: '20:00',
    duracao_hora_fim: opts.duracaoFinal ? opts.duracaoFinal.horaFim : null,
    duracao_tem_intervalo: opts.duracaoFinal ? (opts.duracaoFinal.temIntervalo ? 1 : 0) : null,
    duracao_intervalo_min: opts.duracaoFinal ? opts.duracaoFinal.intervaloMin : null,
    pagamento_valor_entrada: opts.pagamento ? opts.pagamento.valorEntrada : null,
    pagamento_valor_restante: opts.pagamento ? opts.pagamento.valorRestante : null,
    assinatura_cliente: fakeSig,
    assinatura_cliente_em: createdAt,
    assinatura_badu: opts.status === 'finalizado' ? fakeSig : null,
    assinatura_badu_em: opts.status === 'finalizado' ? createdAt : null
  };

  var cols = Object.keys(row);
  var placeholders = cols.map(function () { return '?'; }).join(', ');
  var sql = 'INSERT INTO contratos (' + cols.join(', ') + ') VALUES (' + placeholders + ')';
  db.prepare(sql).run(...cols.map(function (c) { return row[c]; }));
}

module.exports = { seedDemoData, DEMO_ADMIN_EMAIL, DEMO_ADMIN_SENHA };
