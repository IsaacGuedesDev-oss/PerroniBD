const express = require('express');
const rateLimit = require('express-rate-limit');
const { pool } = require('../db');
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

async function getContractRow(id) {
  const { rows } = await pool.query('SELECT * FROM contratos WHERE id = $1', [id]);
  return rows[0];
}

// POST /api/contratos — público: o cliente cria e assina o contrato.
router.post('/', createLimiter, async (req, res, next) => {
  try {
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

    var id = await genId();
    var createdAt = new Date().toISOString();
    var row = createBodyToRow(id, createdAt, body);
    row.assinatura_cliente_em = body.assinaturaClienteEm || createdAt;

    var cols = Object.keys(row);
    var placeholders = cols.map(function (_, i) { return '$' + (i + 1); }).join(', ');
    var sql = 'INSERT INTO contratos (' + cols.join(', ') + ') VALUES (' + placeholders + ')';
    var vals = cols.map(function (c) { return row[c]; });
    await pool.query(sql, vals);

    var saved = await getContractRow(id);
    res.status(201).json(rowToFullContract(saved));
  } catch (e) { next(e); }
});

// GET /api/contratos/:id — resumo público sem sessão; registro completo com sessão do Badu.
router.get('/:id', attachOptionalAuth, async (req, res, next) => {
  try {
    var row = await getContractRow(req.params.id.toUpperCase());
    if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });
    if (req.admin) return res.json(rowToFullContract(row));
    res.json(rowToPublicSummary(row));
  } catch (e) { next(e); }
});

// GET /api/contratos — autenticado (Badu): lista completa para o painel.
router.get('/', requireAuth, async (req, res, next) => {
  try {
    var { rows } = await pool.query('SELECT * FROM contratos ORDER BY created_at DESC');
    res.json(rows.map(rowToFullContract));
  } catch (e) { next(e); }
});

// PATCH /api/contratos/:id — autenticado (Badu): edita duração/pagamento e assina.
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    var row = await getContractRow(req.params.id.toUpperCase());
    if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });

    var body = req.body || {};
    var sets = [];
    var vals = [];
    var n = 1;
    function addSet(col, val) { sets.push(col + ' = $' + n); vals.push(val); n++; }

    if (body.duracaoFinal) {
      var d = body.duracaoFinal;
      addSet('duracao_hora_fim', d.horaFim || null);
      addSet('duracao_tem_intervalo', !!d.temIntervalo);
      addSet('duracao_intervalo_min', d.temIntervalo && d.intervaloMin != null ? Number(d.intervaloMin) : null);
      addSet('duracao_valor_hora_extra', d.valorHoraExtra != null ? Number(d.valorHoraExtra) : null);
    }
    if (body.pagamento) {
      var p = body.pagamento;
      addSet('pagamento_valor_entrada', p.valorEntrada != null ? Number(p.valorEntrada) : null);
      addSet('pagamento_valor_restante', p.valorRestante != null ? Number(p.valorRestante) : null);
    }
    if (body.assinaturaBadu) {
      addSet('assinatura_badu', body.assinaturaBadu);
      addSet('assinatura_badu_em', body.assinaturaBaduEm || new Date().toISOString());
      addSet('status', 'finalizado');
    }

    if (!sets.length) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar foi enviado.' });
    }

    vals.push(row.id);
    await pool.query('UPDATE contratos SET ' + sets.join(', ') + ' WHERE id = $' + n, vals);

    var updated = await getContractRow(row.id);
    res.json(rowToFullContract(updated));
  } catch (e) { next(e); }
});

// DELETE /api/contratos/:id — autenticado (Badu).
router.delete('/:id', requireAuth, async (req, res, next) => {
  try {
    var result = await pool.query('DELETE FROM contratos WHERE id = $1', [req.params.id.toUpperCase()]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Contrato não encontrado.' });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

// GET /api/contratos/:id/pdf — Badu autenticado, ou público se já finalizado.
router.get('/:id/pdf', attachOptionalAuth, async (req, res, next) => {
  try {
    var row = await getContractRow(req.params.id.toUpperCase());
    if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });
    if (!req.admin && row.status !== 'finalizado') {
      return res.status(403).json({ error: 'Este contrato ainda não foi finalizado pelo Badu.' });
    }

    var contract = rowToFullContract(row);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="contrato-' + contract.id + '.pdf"');
    var doc = buildContractPDF(contract);
    doc.pipe(res);
  } catch (e) { next(e); }
});

module.exports = router;
