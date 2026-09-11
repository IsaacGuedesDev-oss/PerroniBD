#!/usr/bin/env node
// Cria (ou atualiza a senha de) o usuário do Badu que faz login no painel.
// Uso:
//   node scripts/create-admin.js email@exemplo.com "senha-forte"
// ou, via npm:
//   npm run create-admin -- email@exemplo.com "senha-forte"
require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, init } = require('../src/db');

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

(async () => {
  await init();
  const hash = bcrypt.hashSync(senha, 12);
  const { rows } = await pool.query('SELECT id FROM admins WHERE email = $1', [email]);

  if (rows[0]) {
    await pool.query('UPDATE admins SET password_hash = $1 WHERE id = $2', [hash, rows[0].id]);
    console.log('Senha atualizada para ' + email);
  } else {
    await pool.query(
      'INSERT INTO admins (email, password_hash, created_at) VALUES ($1, $2, $3)',
      [email, hash, new Date().toISOString()]
    );
    console.log('Usuário criado: ' + email);
  }
  await pool.end();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
