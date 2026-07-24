// GitHub repo as datastore
const REPO = process.env.GITHUB_REPO || 'mzml-gg/arab-web';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const API = 'https://api.github.com';

function repoPath(path) {
  return String(path || '').split('/').map(encodeURIComponent).join('/');
}

function authHeaders() {
  return TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {};
}

function requireToken(action = 'تنفيذ العملية') {
  if (!TOKEN) {
    throw new Error(`${action} يحتاج ضبط GITHUB_TOKEN في متغيرات البيئة على Vercel`);
  }
}

async function gh(path, opts = {}) {
  const res = await fetch(`${API}${path}`, {
    ...opts,
    headers: {
      ...authHeaders(),
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': 'arab-code-web',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`GitHub ${res.status}: ${t}`);
  }
  return res;
}

async function getFile(path) {
  const res = await gh(`/repos/${REPO}/contents/${repoPath(path)}?ref=${encodeURIComponent(BRANCH)}`);
  if (res.status === 404) return null;
  const j = await res.json();
  const content = Buffer.from(j.content, 'base64').toString('utf8');
  return { content, sha: j.sha };
}

async function putFile(path, content, message, sha) {
  requireToken('حفظ البيانات');
  const body = {
    message,
    content: Buffer.from(content, 'utf8').toString('base64'),
    branch: BRANCH,
  };
  if (sha) body.sha = sha;
  const res = await gh(`/repos/${REPO}/contents/${repoPath(path)}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`putFile ${path} failed`);
  return res.json();
}

async function deleteFile(path, message, sha) {
  requireToken('حذف البيانات');
  const res = await gh(`/repos/${REPO}/contents/${repoPath(path)}`, {
    method: 'DELETE',
    body: JSON.stringify({ message, sha, branch: BRANCH }),
  });
  return res.ok;
}

async function listDir(path) {
  const res = await gh(`/repos/${REPO}/contents/${repoPath(path)}?ref=${encodeURIComponent(BRANCH)}`);
  if (res.status === 404) return [];
  const j = await res.json();
  return Array.isArray(j) ? j : [];
}

// JSON helpers with retry on sha mismatch
async function readJson(path, fallback) {
  const f = await getFile(path);
  if (!f) return { data: fallback, sha: null };
  try {
    return { data: JSON.parse(f.content), sha: f.sha };
  } catch {
    return { data: fallback, sha: f.sha };
  }
}

async function writeJson(path, data, message) {
  for (let i = 0; i < 3; i++) {
    const current = await getFile(path);
    try {
      await putFile(path, JSON.stringify(data, null, 2), message, current?.sha);
      return true;
    } catch (e) {
      if (i === 2) throw e;
      await new Promise((r) => setTimeout(r, 300 * (i + 1)));
    }
  }
}

module.exports = { gh, getFile, putFile, deleteFile, listDir, readJson, writeJson, REPO, BRANCH };
