require('dotenv').config();
const path = require('path');
const express = require('express');
const cookieSession = require('cookie-session');
const db = require('./db');

const APP_PASSWORD = process.env.APP_PASSWORD;
const SESSION_SECRET = process.env.SESSION_SECRET;
const PORT = process.env.PORT || 3003;
const COOKIE_SECURE = process.env.COOKIE_SECURE === 'true';
const DOC_KEY = 'estado';

if (!APP_PASSWORD || !SESSION_SECRET) {
  console.error('Defina APP_PASSWORD e SESSION_SECRET no arquivo .env antes de iniciar o servidor.');
  process.exit(1);
}

const app = express();
app.set('trust proxy', 1);
app.use(express.json({ limit: '30mb' }));

app.use(
  cookieSession({
    name: 'trok_folha_session',
    keys: [SESSION_SECRET],
    maxAge: 30 * 24 * 60 * 60 * 1000, // 30 dias
    httpOnly: true,
    sameSite: 'lax',
    secure: COOKIE_SECURE
  })
);

// ---- Login (aberto, sem autenticação) ----
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.post('/login', (req, res) => {
  const senha = req.body && req.body.senha;
  if (senha && senha === APP_PASSWORD) {
    req.session.auth = true;
    return res.json({ ok: true });
  }
  return res.status(401).json({ ok: false, error: 'Senha incorreta.' });
});

app.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

// ---- A partir daqui, exige login ----
function requireAuth(req, res, next) {
  if (req.session && req.session.auth) return next();
  if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'not_authenticated' });
  return res.redirect('/login');
}
app.use(requireAuth);

app.use(express.static(path.join(__dirname, 'public')));

// Espelha a API que o app espera de "window.storage": get(key) / set(key, value).
// Como o app só usa uma chave ('estado'), simplificamos para um único documento.
app.get('/api/state', (req, res) => {
  const doc = db.getDocument(DOC_KEY);
  res.json({ value: doc ? doc.value : null });
});

app.put('/api/state', (req, res) => {
  const value = req.body && req.body.value;
  if (typeof value !== 'string') return res.status(400).json({ error: 'invalid_payload' });
  db.setDocument(DOC_KEY, value);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Servidor de Folha de Pagamento rodando na porta ${PORT}`);
});
