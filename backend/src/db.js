const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // A maioria dos Postgres gerenciados grátis (Neon, Supabase) exige SSL mas usa
  // certificado que o Node não valida por padrão — comum relaxar isso pro client.
  ssl: process.env.DATABASE_URL && process.env.DATABASE_URL.includes('sslmode=disable')
    ? false
    : { rejectUnauthorized: false }
});

const SCHEMA_SQL = `
  CREATE TABLE IF NOT EXISTS admins (
    id SERIAL PRIMARY KEY,
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
    duracao_tem_intervalo BOOLEAN,
    duracao_intervalo_min INTEGER,

    pagamento_valor_entrada DOUBLE PRECISION,
    pagamento_valor_restante DOUBLE PRECISION,

    assinatura_cliente TEXT,
    assinatura_cliente_em TEXT,
    assinatura_badu TEXT,
    assinatura_badu_em TEXT
  );

  CREATE INDEX IF NOT EXISTS idx_sessions_admin ON sessions(admin_id);
  CREATE INDEX IF NOT EXISTS idx_contratos_created ON contratos(created_at);
`;

// Datas/horas ficam como TEXT (não TIMESTAMPTZ) de propósito: o resto do código já
// trabalha com strings ISO geradas em JS, e TIMESTAMPTZ viraria objeto Date no driver
// pg — mudança de tipo que quebraria código que hoje trata isso como string.

let ready = null;

// Roda a criação do schema (idempotente) — chamado uma vez em server.js antes de
// subir o servidor.
function init() {
  if (!ready) {
    ready = pool.query(SCHEMA_SQL);
  }
  return ready;
}

module.exports = { pool, init };
