// Shared store for code interactions: comments + likes + reports, kept in data/interactions.json
// Schema: { comments: [...], likes: {...}, reports: [...], likeTotals: {...} }
// comments: { id, code, author, display_name, avatar_url, is_verified_badge, text, line, created_at }
// likes: { "<username>|<code>": true }
// reports: { id, code, reporter, email, text, created_at, status: 'open'|'dismissed' }
const { readJson, writeJson } = require('./_gh');
const { currentUser } = require('./_auth');
const { getSettings } = require('./_settings');

const PATH = 'data/interactions.json';

async function loadInteractions() {
  const { data } = await readJson(PATH, { comments: [], likes: {}, reports: [], likeTotals: {} });
  if (!Array.isArray(data.comments)) data.comments = [];
  if (!data.likes) data.likes = {};
  if (!Array.isArray(data.reports)) data.reports = [];
  if (!data.likeTotals) data.likeTotals = {};
  return data;
}

async function saveInteractions(d) {
  await writeJson(PATH, d, 'interactions: update');
  return d;
}

function nextId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

async function requireAuth(req) {
  const me = await currentUser(req);
  if (!me) {
    const err = new Error('سجّل دخول أولاً');
    err.status = 401;
    throw err;
  }
  return me;
}

// Profanity guard: returns matched words or null. Uses admin-configured banned_words.
async function scanForCurses(text) {
  const settings = await getSettings();
  const words = Array.isArray(settings.banned_words) ? settings.banned_words : [];
  const hay = String(text || '').toLowerCase();
  const found = [];
  for (const w of words) {
    const t = String(w || '').trim().toLowerCase();
    if (!t) continue;
    if (hay.includes(t)) found.push(w);
  }
  return found.length ? found : null;
}

module.exports = { loadInteractions, saveInteractions, nextId, requireAuth, scanForCurses };
