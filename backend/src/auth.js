const crypto = require('crypto');
const { pool } = require('./db');

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 dias
const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || 'badu_session';

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

async function createSession(adminId) {
  const token = generateToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await pool.query(
    'INSERT INTO sessions (token, admin_id, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [token, adminId, now.toISOString(), expiresAt.toISOString()]
  );
  return { token, expiresAt };
}

async function destroySession(token) {
  if (!token) return;
  await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
}

async function getAdminByToken(token) {
  if (!token) return null;
  const { rows } = await pool.query(
    `SELECT s.token, s.expires_at, a.id AS admin_id, a.email
     FROM sessions s JOIN admins a ON a.id = s.admin_id
     WHERE s.token = $1`,
    [token]
  );
  const row = rows[0];
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await destroySession(token);
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
async function requireAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    const admin = await getAdminByToken(token);
    if (!admin) {
      return res.status(401).json({ error: 'Não autenticado. Faça login novamente.' });
    }
    req.admin = admin;
    req.sessionToken = token;
    next();
  } catch (e) { next(e); }
}

// Identifica o admin se houver sessão, mas não bloqueia se não houver.
async function attachOptionalAuth(req, res, next) {
  try {
    const token = getTokenFromRequest(req);
    req.admin = (await getAdminByToken(token)) || null;
    next();
  } catch (e) { next(e); }
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
