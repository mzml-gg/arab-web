// Shared store for code interactions for Cloudflare Workers
import { readJson, writeJson } from './_gh';
import { currentUser } from './_auth';
import { getSettings } from './_settings';

const PATH = 'data/interactions.json';

export async function loadInteractions() {
  const { data } = await readJson(PATH, { comments: [], likes: {}, reports: [], likeTotals: {} });
  if (!Array.isArray(data.comments)) data.comments = [];
  if (!data.likes) data.likes = {};
  if (!Array.isArray(data.reports)) data.reports = [];
  if (!data.likeTotals) data.likeTotals = {};
  return data;
}

export async function saveInteractions(d) {
  await writeJson(PATH, d, 'interactions: update');
  return d;
}

export function nextId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export async function requireAuth(request) {
  const me = await currentUser(request);
  if (!me) {
    const err = new Error('سجّل دخول أولاً');
    err.status = 401;
    throw err;
  }
  return me;
}

export async function scanForCurses(text) {
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
