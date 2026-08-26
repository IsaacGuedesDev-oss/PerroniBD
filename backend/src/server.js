require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const contratosRoutes = require('./routes/contratos');
const configRoutes = require('./routes/config');

// Falha rápido se faltar alguma env var obrigatória.
['ENCRYPTION_KEY', 'SESSION_SECRET'].forEach(function (name) {
  if (!process.env[name]) {
    console.error(
      'Variável de ambiente ' + name + ' não definida. Copie backend/.env.example para backend/.env ' +
      'e preencha os valores (veja as instruções nos comentários do próprio arquivo).'
    );
    process.exit(1);
  }
});

const app = express();
const PORT = process.env.PORT || 3000;
const FRONTEND_ROOT = path.join(__dirname, '..', '..');

app.disable('x-powered-by');
app.set('trust proxy', 1); // necessário atrás de proxy HTTPS (Render/Railway/Fly.io)

// CSP off (o front usa muito style inline); resto do helmet continua ativo.
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: '3mb' })); // assinaturas em PNG base64 podem pesar algumas centenas de KB
app.use(cookieParser(process.env.SESSION_SECRET));

// CORS só entra se o front estiver em outra origem (FRONTEND_ORIGIN definido).
if (process.env.FRONTEND_ORIGIN) {
  app.use(function (req, res, next) {
    res.setHeader('Access-Control-Allow-Origin', process.env.FRONTEND_ORIGIN);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
  });
}

app.use('/api/auth', authRoutes);
app.use('/api/contratos', contratosRoutes);
app.use('/api/config', configRoutes);

// Serve só as pastas do front, uma a uma — nunca a raiz inteira (tem backend/.env ali).
app.use('/css', express.static(path.join(FRONTEND_ROOT, 'css')));
app.use('/js', express.static(path.join(FRONTEND_ROOT, 'js')));
app.use('/assets', express.static(path.join(FRONTEND_ROOT, 'assets')));
app.get('/', function (req, res) {
  res.sendFile(path.join(FRONTEND_ROOT, 'index.html'));
});

app.use('/api', function (req, res) {
  res.status(404).json({ error: 'Rota não encontrada.' });
});

// Handler de erro genérico — evita vazar stack trace para o cliente.
app.use(function (err, req, res, next) { // eslint-disable-line no-unused-vars
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

app.listen(PORT, function () {
  console.log('Servidor do Badu Contratos rodando em http://localhost:' + PORT);
});
