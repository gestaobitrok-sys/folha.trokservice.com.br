// Camada de acesso ao banco SQLite. O app de Folha guarda tudo como um único
// "documento" JSON (o objeto `state` inteiro) - então o banco aqui é só uma
// tabela chave/valor bem simples, com histórico das últimas versões salvas
// (para conseguir recuperar caso algo dê errado num salvamento).
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(path.join(dataDir, 'folha.db'));
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS documents (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS document_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL,
    value TEXT NOT NULL,
    saved_at TEXT NOT NULL
  );
`);

const MAX_HISTORICO = 20; // guarda só as últimas 20 versões por chave, para não crescer sem limite

function getDocument(key) {
  const row = db.prepare('SELECT value, updated_at FROM documents WHERE key = ?').get(key);
  return row ? { value: row.value, updatedAt: row.updated_at } : null;
}

const setTx = db.transaction((key, value, now) => {
  db.prepare(
    'INSERT INTO documents (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at'
  ).run(key, value, now);
  db.prepare('INSERT INTO document_history (key, value, saved_at) VALUES (?, ?, ?)').run(key, value, now);
  const excedentes = db
    .prepare('SELECT id FROM document_history WHERE key = ? ORDER BY id DESC LIMIT -1 OFFSET ?')
    .all(key, MAX_HISTORICO);
  if (excedentes.length) {
    const ids = excedentes.map((r) => r.id);
    const placeholders = ids.map(() => '?').join(',');
    db.prepare(`DELETE FROM document_history WHERE id IN (${placeholders})`).run(...ids);
  }
});

function setDocument(key, value) {
  setTx(key, value, new Date().toISOString());
}

module.exports = { getDocument, setDocument };
