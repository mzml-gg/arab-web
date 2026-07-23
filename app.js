// Shared client helpers
async function api(path, opts = {}) {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) },
    ...opts,
  });
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

function avatarLetter(name) {
  return (name || '?').trim().charAt(0).toUpperCase();
}

function avatarHTML(username, cls = '') {
  return `<a href="/u/${encodeURIComponent(username)}" class="author"><span class="avatar ${cls}">${esc(avatarLetter(username))}</span><span>${esc(username)}</span></a>`;
}

async function loadMe() {
  try {
    const { user } = await api('/api/me');
    return user;
  } catch { return null; }
}

async function renderNav() {
  const el = document.getElementById('nav-actions');
  if (!el) return;
  const me = await loadMe();
  const searchBtn = `<button class="icon-btn" title="بحث" onclick="openSearch()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.35-4.35"/></svg></button>`;
  if (me) {
    const adminLink = me.is_admin ? `<a class="btn ghost" href="/admin">الإدارة</a>` : '';
    el.innerHTML = `${searchBtn}
      <a class="btn" href="/submit">+ كود</a>
      ${adminLink}
      <a href="/u/${encodeURIComponent(me.username)}" class="author">${avatarHTML(me.username)}</a>
      <button class="icon-btn" title="خروج" onclick="doLogout()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>`;
  } else {
    el.innerHTML = `${searchBtn}<a class="btn primary" href="/auth">دخول</a>`;
  }
}

async function doLogout() {
  await api('/api/logout', { method: 'POST' });
  location.href = '/';
}

// Search overlay
function ensureSearchOverlay() {
  if (document.getElementById('search-overlay')) return;
  const div = document.createElement('div');
  div.id = 'search-overlay';
  div.className = 'search-overlay';
  div.innerHTML = `<div class="search-box">
    <input id="search-input" type="text" placeholder="ابحث عن كود..." autocomplete="off"/>
    <div class="search-results grid" id="search-results"></div>
  </div>`;
  div.addEventListener('click', (e) => { if (e.target === div) closeSearch(); });
  document.body.appendChild(div);
  const input = div.querySelector('#search-input');
  let t;
  input.addEventListener('input', () => {
    clearTimeout(t);
    t = setTimeout(runSearch, 250);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSearch(); });
}
function openSearch() { ensureSearchOverlay(); document.getElementById('search-overlay').classList.add('open'); document.getElementById('search-input').focus(); }
function closeSearch() { const o = document.getElementById('search-overlay'); if (o) o.classList.remove('open'); }
async function runSearch() {
  const q = document.getElementById('search-input').value.trim();
  const box = document.getElementById('search-results');
  if (!q) { box.innerHTML = ''; return; }
  try {
    const { codes } = await api('/api/search?q=' + encodeURIComponent(q));
    if (!codes.length) { box.innerHTML = '<p style="color:var(--muted);text-align:center;padding:30px">لا نتائج</p>'; return; }
    box.innerHTML = codes.map(codeCard).join('');
  } catch (e) { box.innerHTML = `<p style="color:var(--danger)">${esc(e.message)}</p>`; }
}

function codeCard(c) {
  return `<a href="/c/${encodeURIComponent(c.filename)}" class="card" style="text-decoration:none">
    <h3>${esc(c.title)}</h3>
    <p>${esc(c.description || '').slice(0, 120)}</p>
    <div class="meta">
      ${avatarHTML(c.author || 'unknown')}
      <span class="lang-tag">${esc(c.language || 'txt')}</span>
    </div>
  </a>`;
}

window.api = api; window.esc = esc; window.avatarHTML = avatarHTML;
window.renderNav = renderNav; window.doLogout = doLogout;
window.openSearch = openSearch; window.closeSearch = closeSearch;
window.codeCard = codeCard; window.loadMe = loadMe;
