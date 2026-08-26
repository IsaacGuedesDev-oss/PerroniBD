#!/usr/bin/env node
// Cria (ou atualiza a senha de) o usuário do Badu que faz login no painel.
// Uso:
//   node scripts/create-admin.js email@exemplo.com "senha-forte"
// ou, via npm:
//   npm run create-admin -- email@exemplo.com "senha-forte"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const db = require('../src/db');

const [, , emailArg, senhaArg] = process.argv;

if (!emailArg || !senhaArg) {
  console.error('Uso: node scripts/create-admin.js <email> <senha>');
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();
const senha = senhaArg;

if (senha.length < 8) {
  console.error('A senha precisa ter pelo menos 8 caracteres.');
  process.exit(1);
}

const hash = bcrypt.hashSync(senha, 12);
const existing = db.prepare('SELECT id FROM admins WHERE email = ?').get(email);

if (existing) {
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  console.log('Senha atualizada para ' + email);
} else {
  db.prepare(
    'INSERT INTO admins (email, password_hash, created_at) VALUES (?, ?, ?)'
  ).run(email, hash, new Date().toISOString());
  console.log('Usuário criado: ' + email);
}
