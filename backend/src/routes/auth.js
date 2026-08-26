const express = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const {
  createSession,
  destroySession,
  setSessionCookie,
  clearSessionCookie,
  getTokenFromRequest,
  requireAuth
} = require('../auth');

const router = express.Router();

// Freia tentativas de força bruta no login: 10 tentativas a cada 15 min por IP.
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas de login. Aguarde alguns minutos e tente de novo.' }
});

router.post('/login', loginLimiter, (req, res) => {
  const email = String((req.body && req.body.email) || '').trim().toLowerCase();
  const senha = String((req.body && req.body.senha) || '');

  if (!email || !senha) {
    return res.status(400).json({ error: 'Informe e-mail e senha.' });
  }

  const admin = db.prepare('SELECT * FROM admins WHERE email = ?').get(email);
  // Mensagem genérica em ambos os casos, para não indicar se o e-mail existe.
  const invalid = () => res.status(401).json({ error: 'E-mail ou senha inválidos.' });

  if (!admin) return invalid();

  const ok = bcrypt.compareSync(senha, admin.password_hash);
  if (!ok) return invalid();

  const { token } = createSession(admin.id);
  setSessionCookie(res, token);
  res.json({ ok: true, email: admin.email });
});

router.post('/logout', requireAuth, (req, res) => {
  destroySession(getTokenFromRequest(req));
  clearSessionCookie(res);
  res.json({ ok: true });
});

// Confirma a sessão atual (usado pra pular a tela de login se já estiver logado).
router.get('/me', requireAuth, (req, res) => {
  res.json({ email: req.admin.email });
});

module.exports = router;
