const express = require('express');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { genId } = require('../idgen');
const { rowToFullContract, rowToPublicSummary, createBodyToRow } = require('../mapper');
const { buildContractPDF } = require('../pdf');
const { requireAuth, attachOptionalAuth } = require('../auth');

const router = express.Router();

const REQUIRED_CLIENTE_FIELDS = ['nome', 'nacionalidade', 'profissao', 'rg', 'cpfCnpj', 'endRua', 'endNumero', 'endBairro', 'endCidade', 'endCep'];
const REQUIRED_EVENTO_FIELDS = ['localRua', 'localNumero', 'localBairro', 'localCidade', 'localCep', 'data', 'hora'];

// Limita criações de contrato para reduzir spam/abuso do endpoint público.
const createLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' }
});

function getContractRow(id) {
  return db.prepare('SELECT * FROM contratos WHERE id = ?').get(id);
}

// POST /api/contratos — público: o cliente cria e assina o contrato.
router.post('/', createLimiter, (req, res) => {
  var body = req.body || {};
  var cliente = body.cliente || {};
  var evento = body.evento || {};

  var missing = [];
  REQUIRED_CLIENTE_FIELDS.forEach(function (f) { if (!String(cliente[f] || '').trim()) missing.push('cliente.' + f); });
  REQUIRED_EVENTO_FIELDS.forEach(function (f) { if (!String(evento[f] || '').trim()) missing.push('evento.' + f); });
  if (!body.assinaturaCliente) missing.push('assinaturaCliente');

  if (missing.length) {
    return res.status(400).json({ error: 'Campos obrigatórios ausentes.', campos: missing });
  }

  var id = genId();
  var createdAt = new Date().toISOString();
  var row = createBodyToRow(id, createdAt, body);
  row.assinatura_cliente_em = body.assinaturaClienteEm || createdAt;

  var cols = Object.keys(row);
  var placeholders = cols.map(function () { return '?'; }).join(', ');
  var sql = 'INSERT INTO contratos (' + cols.join(', ') + ') VALUES (' + placeholders + ')';
  var vals = cols.map(function (c) { return row[c]; });
  db.prepare(sql).run(...vals);

  var saved = getContractRow(id);
  res.status(201).json(rowToFullContract(saved));
});

// GET /api/contratos/:id — resumo público sem sessão; registro completo com sessão do Badu.
router.get('/:id', attachOptionalAuth, (req, res) => {
  var row = getContractRow(req.params.id.toUpperCase());
  if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });
  if (req.admin) return res.json(rowToFullContract(row));
  res.json(rowToPublicSummary(row));
});

// GET /api/contratos — autenticado (Badu): lista completa para o painel.
router.get('/', requireAuth, (req, res) => {
  var rows = db.prepare('SELECT * FROM contratos ORDER BY created_at DESC').all();
  res.json(rows.map(rowToFullContract));
});

// PATCH /api/contratos/:id — autenticado (Badu): edita duração/pagamento e assina.
router.patch('/:id', requireAuth, (req, res) => {
  var row = getContractRow(req.params.id.toUpperCase());
  if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });

  var body = req.body || {};
  var sets = [];
  var vals = [];

  if (body.duracaoFinal) {
    var d = body.duracaoFinal;
    sets.push('duracao_hora_fim = ?'); vals.push(d.horaFim || null);
    sets.push('duracao_tem_intervalo = ?'); vals.push(d.temIntervalo ? 1 : 0);
    sets.push('duracao_intervalo_min = ?'); vals.push(d.temIntervalo && d.intervaloMin != null ? Number(d.intervaloMin) : null);
  }
  if (body.pagamento) {
    var p = body.pagamento;
    sets.push('pagamento_valor_entrada = ?'); vals.push(p.valorEntrada != null ? Number(p.valorEntrada) : null);
    sets.push('pagamento_valor_restante = ?'); vals.push(p.valorRestante != null ? Number(p.valorRestante) : null);
  }
  if (body.assinaturaBadu) {
    sets.push('assinatura_badu = ?'); vals.push(body.assinaturaBadu);
    sets.push('assinatura_badu_em = ?'); vals.push(body.assinaturaBaduEm || new Date().toISOString());
    sets.push('status = ?'); vals.push('finalizado');
  }

  if (!sets.length) {
    return res.status(400).json({ error: 'Nenhum campo para atualizar foi enviado.' });
  }

  vals.push(row.id);
  db.prepare('UPDATE contratos SET ' + sets.join(', ') + ' WHERE id = ?').run(...vals);

  var updated = getContractRow(row.id);
  res.json(rowToFullContract(updated));
});

// DELETE /api/contratos/:id — autenticado (Badu).
router.delete('/:id', requireAuth, (req, res) => {
  var info = db.prepare('DELETE FROM contratos WHERE id = ?').run(req.params.id.toUpperCase());
  if (Number(info.changes) === 0) return res.status(404).json({ error: 'Contrato não encontrado.' });
  res.json({ ok: true });
});

// GET /api/contratos/:id/pdf — Badu autenticado, ou público se já finalizado.
router.get('/:id/pdf', attachOptionalAuth, (req, res) => {
  var row = getContractRow(req.params.id.toUpperCase());
  if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });
  if (!req.admin && row.status !== 'finalizado') {
    return res.status(403).json({ error: 'Este contrato ainda não foi finalizado pelo Badu.' });
  }

  var contract = rowToFullContract(row);
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="contrato-' + contract.id + '.pdf"');
  var doc = buildContractPDF(contract);
  doc.pipe(res);
});

module.exports = router;
