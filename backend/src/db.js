const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite'); // built-in desde o Node 22.5 — sem compilação nativa
const { isDemoMode } = require('./demo');

// No modo demo o banco é sempre em memória (ignora DB_PATH de propósito) — reseta a
// cada restart e é re-semeado logo abaixo. Fora do demo, arquivo SQLite normal.
const usingMemoryDb = isDemoMode();
const DB_PATH = usingMemoryDb
  ? ':memory:'
  : (process.env.DB_PATH
    ? path.resolve(__dirname, '..', process.env.DB_PATH)
    : path.join(__dirname, '..', 'data', 'badu.sqlite'));

if (!usingMemoryDb) fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new DatabaseSync(DB_PATH, { enableForeignKeyConstraints: true });
if (!usingMemoryDb) db.exec('PRAGMA journal_mode = WAL;');

db.exec(`
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token TEXT PRIMARY KEY,
    admin_id INTEGER NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS contratos (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'aguardando_badu',
    created_at TEXT NOT NULL,

    cliente_nome TEXT,
    cliente_nacionalidade TEXT,
    cliente_profissao TEXT,
    cliente_rg TEXT,
    cliente_cpf_cnpj TEXT,

    cliente_end_rua TEXT,
    cliente_end_numero TEXT,
    cliente_end_bairro TEXT,
    cliente_end_cidade TEXT,
    cliente_end_cep TEXT,

    evento_local_rua TEXT,
    evento_local_numero TEXT,
    evento_local_bairro TEXT,
    evento_local_cidade TEXT,
    evento_local_cep TEXT,
    evento_data TEXT,
    evento_hora TEXT,

    duracao_hora_fim TEXT,
    duracao_tem_intervalo INTEGER,
    duracao_intervalo_min INTEGER,

    pagamento_valor_entrada REAL,
    pagamento_valor_restante REAL,

    assinatura_cliente TEXT,
    assinatura_cliente_em TEXT,
    assinatura_badu TEXT,
    assinatura_badu_em TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
  CREATE INDEX IF NOT EXISTS idx_contratos_created ON contratos(created_at);
`);

if (isDemoMode()) {
  require('./seed').seedDemoData(db);
}

module.exports = db;
