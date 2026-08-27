// GitHub Datastore Layer for Cloudflare Workers
const API = 'https://api.github.com';
const CACHE = new Map();
const CACHE_TTL = 10000;

async function gh(path, opts = {}, retries = 2) {
  const env = globalThis.process.env;
  const REPO = (env.GITHUB_REPO || 'mzml-gg/arab-web').trim();
  const BRANCH = (env.GITHUB_BRANCH || 'main').trim();
  const TOKEN = (env.GITHUB_TOKEN || '').trim();

  const headers = {
    'Accept': 'application/vnd.github+json',
    'Content-Type': 'application/json',
    'User-Agent': 'arab-code-web',
    ...(opts.headers || {})
  };
  if (TOKEN) headers['Authorization'] = `Bearer ${TOKEN}`;

  const isGet = !opts.method || opts.method === 'GET';
  const fullPath = path.includes('?') ? `${path}&ref=${BRANCH}` : `${path}?ref=${BRANCH}`;
  const url = `${API}/repos/${REPO}${fullPath}`;

  if (isGet && CACHE.has(url)) {
    const entry = CACHE.get(url);
    if (Date.now() - entry.time < CACHE_TTL) return entry.res.clone();
  }

  try {
    const res = await fetch(url, { ...opts, headers });
    if (!res.ok) {
      if (res.status === 409 && retries > 0) {
        await new Promise(r => setTimeout(r, 1000));
        return gh(path, opts, retries - 1);
      }
      const text = await res.text();
      console.error(`GH ERROR: ${res.status} ${text} on ${url}`);
      throw new Error(`خطأ في الاتصال بقاعدة البيانات (${res.status})`);
    }
    
    if (isGet) {
      CACHE.set(url, { res: res.clone(), time: Date.now() });
    } else {
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

export async function getFile(path) {
  try {
    const res = await gh(`/contents/${encodeURIComponent(path)}`);
    const j = await res.json();
    // Use standard Web APIs for base64 decoding in Workers
    const content = atob(j.content.replace(/\n/g, ''));
    const utf8Content = new TextDecoder().decode(Uint8Array.from(content, c => c.charCodeAt(0)));
    return { content: utf8Content, sha: j.sha };
  } catch (e) {
    if (e.message.includes('404')) return null;
    throw e;
  }
}

export async function listDir(path) {
  try {
    const res = await gh(`/contents/${encodeURIComponent(path)}`);
    return await res.json();
  } catch (e) {
    if (e.message.includes('404')) return [];
    throw e;
  }
}

export async function putFile(path, content, message, sha) {
  const env = globalThis.process.env;
  const BRANCH = (env.GITHUB_BRANCH || 'main').trim();
  // Use standard Web APIs for base64 encoding in Workers
  const base64Content = btoa(unescape(encodeURIComponent(content)));
  const body = { message, content: base64Content, branch: BRANCH };
  if (sha) body.sha = sha;
  return gh(`/contents/${encodeURIComponent(path)}`, { 
    method: 'PUT', 
    body: JSON.stringify(body) 
  });
}

export async function deleteFile(path, message, sha) {
  const env = globalThis.process.env;
  const BRANCH = (env.GITHUB_BRANCH || 'main').trim();
  const body = { message, sha, branch: BRANCH };
  return gh(`/contents/${encodeURIComponent(path)}`, { 
    method: 'DELETE', 
    body: JSON.stringify(body) 
  });
}

export async function readJson(path, fallback) {
  const f = await getFile(path);
  if (!f) return { data: fallback, sha: null };
  try {
    return { data: JSON.parse(f.content), sha: f.sha };
  } catch {
    return { data: fallback, sha: f.sha };
  }
}

export async function writeJson(path, data, message) {
  const { sha } = await readJson(path, null);
  return putFile(path, JSON.stringify(data, null, 2), message, sha);
}
