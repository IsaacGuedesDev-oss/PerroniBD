const crypto = require('crypto');
const db = require('./db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'badu_session';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function createSession(adminId) {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  db.prepare(
    'INSERT INTO sessions (token, admin_id, created_at, expires_at) VALUES (?, ?, ?, ?)'
  ).run(token, adminId, now.toISOString(), expiresAt.toISOString());
  return { token, expiresAt };
}

function destroySession(token) {
  if (!token) return;
  db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
}

function getAdminByToken(token) {
  if (!token) return null;
  const row = db.prepare(
    `SELECT s.token, s.expires_at, a.id AS admin_id, a.email
     FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token = ?`
  ).get(token);
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    destroySession(token);
    return null;
  }
  return { id: row.admin_id, email: row.email };
}

function cookieOptions() {
  // Com front e back em origens diferentes (FRONTEND_ORIGIN definido), o cookie precisa
  // de SameSite=None + Secure pra acompanhar fetch() cross-site. Mesma origem: Lax basta.
  var crossOrigin = !!process.env.FRONTEND_ORIGIN;
  return {
    httpOnly: true,
    sameSite: crossOrigin ? 'none' : 'lax',
    secure: crossOrigin || process.env.NODE_ENV === 'production',
    signed: true,
    maxAge: SESSION_TTL_MS,
    path: '/'
  };
}

function setSessionCookie(res, token) {
  res.cookie(COOKIE_NAME, token, cookieOptions());
}

function clearSessionCookie(res) {
  res.clearCookie(COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}

function getTokenFromRequest(req) {
  return req.signedCookies ? req.signedCookies[COOKIE_NAME] : undefined;
}

// Middleware: exige sessão válida do Badu. Em caso de sucesso, popula req.admin.
function requireAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  const admin = getAdminByToken(token);
  if (!admin) {
    return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
  }
  req.admin = admin;
  req.sessionToken = token;
  next();
}

// Identifica o admin se houver sessão, mas não bloqueia se não houver.
function attachOptionalAuth(req, res, next) {
  const token = getTokenFromRequest(req);
  req.admin = getAdminByToken(token) || null;
  next();
}

module.exports = {
  COOKIE_NAME,
  createSession,
  destroySession,
  getAdminByToken,
  setSessionCookie,
  clearSessionCookie,
  getTokenFromRequest,
  requireAuth,
  attachOptionalAuth
};
