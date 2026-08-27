const REPO = (process.env.GITHUB_REPO || 'mzml-gg/arab-web').trim();
const BRANCH = (process.env.GITHUB_BRANCH || 'main').trim();
const TOKEN = (process.env.GITHUB_TOKEN || '').trim();
const API = 'https://api.github.com';

const CACHE = new Map();
const CACHE_TTL = 10000; // 10 seconds cache for GET requests

async function gh(path, opts = {}, retries = 2) {
  const headers = {
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'arab-code-web',
    ...(opts.headers || {})
  };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  // Cache handling for GET requests
  const isGet = !opts.method || opts.method === 'GET';
  if (isGet && CACHE.has(path)) {
    const entry = CACHE.get(path);
    if (Date.now() - entry.time < CACHE_TTL) return entry.res.clone();
  }

  try {
    const res = await fetch(`${API}${path}`, { ...opts, headers });
    if (!res.ok) {
      if (res.status === 409 && retries > 0) { // Conflict retry (common in GH API)
        await new Promise(r => setTimeout(r, 1000));
        return gh(path, opts, retries - 1);
      }
      const text = await res.text();
      console.error(`GH ERROR: ${res.status} ${text} on ${path}`);
      throw new Error(`خطأ في الاتصال بقاعدة البيانات (${res.status})`);
    }
    
    if (isGet) {
      CACHE.set(path, { res: res.clone(), time: Date.now() });
    } else {
      // Clear cache on mutations to ensure fresh data
      CACHE.clear();
    }
    
    return res;
  } catch (e) {
    if (retries > 0) {
      await new Promise(r => setTimeout(r, 1000));
      return gh(path, opts, retries - 1);
    }
    throw e;
  }
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
