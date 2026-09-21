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

// Mesma ideia, pro endpoint público de assinatura final do cliente.
const signLimiter = rateLimit({
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

// POST /api/contratos — público: o cliente preenche os dados (sem assinar ainda —
// a assinatura dele só acontece no fim, depois que o Badu revisar e assinar primeiro).
router.post('/', createLimiter, async (req, res, next) => {
  try {
    var body = req.body || {};
    var cliente = body.cliente || {};
    var evento = body.evento || {};

    var missing = [];
    REQUIRED_CLIENTE_FIELDS.forEach(function (f) { if (!String(cliente[f] || '').trim()) missing.push('cliente.' + f); });
    REQUIRED_EVENTO_FIELDS.forEach(function (f) { if (!String(evento[f] || '').trim()) missing.push('evento.' + f); });

    if (missing.length) {
      return res.status(400).json({ error: 'Campos obrigatórios ausentes.', campos: missing });
    }

    var id = await genId();
    var createdAt = new Date().toISOString();
    var row = createBodyToRow(id, createdAt, body);

    var cols = Object.keys(row);
    var placeholders = cols.map(function (_, i) { return '$' + (i + 1); }).join(', ');
    var sql = 'INSERT INTO contratos (' + cols.join(', ') + ') VALUES (' + placeholders + ')';
    var vals = cols.map(function (c) { return row[c]; });
    await pool.query(sql, vals);

    var saved = await getContractRow(id);
    res.status(201).json(rowToFullContract(saved));
  } catch (e) { next(e); }
});

// GET /api/contratos/:id — resumo público sem sessão; registro completo com sessão do
// Badu, ou quando o contrato já está "aguardando_cliente" (o próprio cliente precisa ver
// o contrato inteiro — já revisado e assinado pelo Badu — para conferir e assinar por
// último). Antes disso, e depois de finalizado, só o resumo público.
router.get('/:id', attachOptionalAuth, async (req, res, next) => {
  try {
    var row = await getContractRow(req.params.id.toUpperCase());
    if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });
    if (req.admin || row.status === 'aguardando_cliente') return res.json(rowToFullContract(row));
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

// PATCH /api/contratos/:id — autenticado (Badu): revisa/corrige os dados do evento e do
// endereço do cliente (nunca nome/RG/CPF-CNPJ/nacionalidade/profissão — isso é fixado pelo
// cliente), define equipamentos/duração/pagamento e assina. Assinar aqui NÃO finaliza o
// contrato — manda pro cliente assinar por último (ver PATCH /:id/assinatura-cliente).
// Bloqueado depois que o cliente já assinou (status 'finalizado').
router.patch('/:id', requireAuth, async (req, res, next) => {
  try {
    var row = await getContractRow(req.params.id.toUpperCase());
    if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });
    if (row.status === 'finalizado') {
      return res.status(409).json({ error: 'Este contrato já foi assinado pelo cliente e não pode mais ser editado.' });
    }

    var body = req.body || {};
    var sets = [];
    var vals = [];
    var n = 1;
    function addSet(col, val) { sets.push(col + ' = $' + n); vals.push(val); n++; }

    if (body.cliente) {
      // Só o endereço do cliente é editável pelo Badu — nome, RG, CPF/CNPJ, nacionalidade
      // e profissão são informações pessoais que o cliente preencheu e ficam fixas.
      var cl = body.cliente;
      if (cl.endRua !== undefined) addSet('cliente_end_rua', cl.endRua || '');
      if (cl.endNumero !== undefined) addSet('cliente_end_numero', cl.endNumero || '');
      if (cl.endBairro !== undefined) addSet('cliente_end_bairro', cl.endBairro || '');
      if (cl.endCidade !== undefined) addSet('cliente_end_cidade', cl.endCidade || '');
      if (cl.endCep !== undefined) addSet('cliente_end_cep', cl.endCep || '');
    }
    if (body.evento) {
      var ev = body.evento;
      if (ev.localRua !== undefined) addSet('evento_local_rua', ev.localRua || '');
      if (ev.localNumero !== undefined) addSet('evento_local_numero', ev.localNumero || '');
      if (ev.localBairro !== undefined) addSet('evento_local_bairro', ev.localBairro || '');
      if (ev.localCidade !== undefined) addSet('evento_local_cidade', ev.localCidade || '');
      if (ev.localCep !== undefined) addSet('evento_local_cep', ev.localCep || '');
      if (ev.data !== undefined) addSet('evento_data', ev.data || '');
      if (ev.hora !== undefined) addSet('evento_hora', ev.hora || '');
    }
    if (body.equipamentos) {
      var eq = body.equipamentos;
      addSet('equip_fornece_som', !!eq.fornecerSom);
      addSet('equip_fornece_iluminacao', !!eq.fornecerIluminacao);
      addSet('equip_fornece_dj', !!eq.fornecerDj);
    }
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
      addSet('status', 'aguardando_cliente');
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

// PATCH /api/contratos/:id/assinatura-cliente — público: assinatura final do cliente,
// só aceita quando o contrato já está "aguardando_cliente" (Badu já revisou e assinou).
// É essa assinatura que finaliza o contrato de verdade.
router.patch('/:id/assinatura-cliente', signLimiter, async (req, res, next) => {
  try {
    var row = await getContractRow(req.params.id.toUpperCase());
    if (!row) return res.status(404).json({ error: 'Contrato não encontrado.' });
    if (row.status !== 'aguardando_cliente') {
      return res.status(403).json({ error: 'Este contrato ainda não está pronto para sua assinatura.' });
    }

    var body = req.body || {};
    if (!body.assinaturaCliente) {
      return res.status(400).json({ error: 'Assinatura obrigatória.' });
    }

    await pool.query(
      'UPDATE contratos SET assinatura_cliente = $1, assinatura_cliente_em = $2, status = $3 WHERE id = $4',
      [body.assinaturaCliente, body.assinaturaClienteEm || new Date().toISOString(), 'finalizado', row.id]
    );

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
