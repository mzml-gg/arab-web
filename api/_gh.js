const REPO = process.env.GITHUB_REPO || 'mzml-gg/arab-web';
const BRANCH = process.env.GITHUB_BRANCH || 'main';
const TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const API = 'https://api.github.com';

async function gh(path, opts = {}) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'arab-code-web',
    ...(opts.headers || {})
  };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    console.error(`GH ERROR: ${res.status} ${text} on ${path}`);
    throw new Error(`خطأ في الاتصال بقاعدة البيانات (${res.status})`);
  }
  return res;
}

async function getFile(path) {
  try {
    const res = await gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`);
    const j = await res.json();
    return { content: Buffer.from(j.content, 'base64').toString('utf8'), sha: j.sha };
  } catch (e) {
    if (e.message.includes('404')) return null;
    throw e;
  }
}

async function listDir(path) {
  try {
    const res = await gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}?ref=${BRANCH}`);
    return await res.json();
  } catch (e) {
    if (e.message.includes('404')) return [];
    throw e;
  }
}

async function putFile(path, content, message, sha) {
  const body = { message, content: Buffer.from(content).toString('base64'), branch: BRANCH };
  if (sha) body.sha = sha;
  return gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}`, { method: 'PUT', body: JSON.stringify(body) });
}

async function deleteFile(path, message, sha) {
  const body = { message, sha, branch: BRANCH };
  return gh(`/repos/${REPO}/contents/${encodeURIComponent(path)}`, { method: 'DELETE', body: JSON.stringify(body) });
}

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
  const { sha } = await readJson(path, null);
  return putFile(path, JSON.stringify(data, null, 2), message, sha);
}

module.exports = { getFile, putFile, deleteFile, listDir, readJson, writeJson, REPO, BRANCH };
