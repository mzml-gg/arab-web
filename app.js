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

function avatarLetter(name) { return (name || '?').trim().charAt(0).toUpperCase(); }

// Always resolves the LIVE avatar coming from the API (never a stale snapshot).
function avatarUrl(entry) {
  if (!entry) return null;
  return entry.avatar_url || entry.author_avatar || entry.avatar || null;
}

function avatarNode(user, size = '') {
  const name = typeof user === 'string' ? user : (user && (user.username || user.author)) || '?';
  const url = typeof user === 'object' ? avatarUrl(user) : null;
  const cls = 'avatar' + (size ? ' ' + size : '');
  if (url) return `<span class="${cls}"><img src="${esc(url)}" alt="${esc(name)}" loading="lazy"></span>`;
  return `<span class="${cls}">${esc(avatarLetter(name))}</span>`;
}

function verifiedBadge(title) {
  return `<span class="verified-badge" title="${esc(title || 'حساب موثّق')}">
    <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
      <path fill="#a259ff" d="M12 1l2.6 2.1 3.3-.3.8 3.2 3 1.5-1.2 3.1 1.2 3.1-3 1.5-.8 3.2-3.3-.3L12 20l-2.6-1.9-3.3.3-.8-3.2-3-1.5 1.2-3.1L2.3 7.5l3-1.5.8-3.2 3.3.3z"/>
      <path fill="#fff" d="M10.6 14.2l-2.4-2.4 1.1-1.1 1.3 1.3 3.7-3.7 1.1 1.1z"/>
    </svg>
  </span>`;
}

// Single source of truth for "is this author verified?" across every page.
function isVerified(entry) {
  if (!entry) return false;
  return !!(entry.author_verified || entry.is_verified_badge || entry.is_admin || entry.author_is_admin);
}

function authorLink(entry, opts = {}) {
  const username = entry.author || entry.username || 'unknown';
  const name = entry.author_display || entry.display_name || username;
  return `<a href="/u/${encodeURIComponent(username)}" class="author" onclick="event.stopPropagation()">
    ${avatarNode({ username, avatar_url: avatarUrl(entry) }, opts.size || 'sm')}
    <span class="uname">${esc(name)}</span>
    ${isVerified(entry) ? verifiedBadge() : ''}
  </a>`;
}

async function loadMe() {
  try { const { user } = await api('/api/me'); return user; } catch { return null; }
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
      ${authorLink({ username: me.username, author_avatar: me.avatar_url, author_verified: me.is_verified_badge })}
      <button class="icon-btn" title="خروج" onclick="doLogout()"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg></button>`;
  } else {
    el.innerHTML = `${searchBtn}<a class="btn primary" href="/auth">دخول</a>`;
  }
}

async function doLogout() { await api('/api/logout', { method: 'POST' }); location.href = '/'; }

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
  input.addEventListener('input', () => { clearTimeout(t); t = setTimeout(runSearch, 250); });
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
  const file = c.filename || c.title;
  return `<article class="code-card" onclick="location.href='/c/${encodeURIComponent(file)}'">
    <div>
      <h3 class="card-title">${esc(c.title || file)}${c.admin_added ? ' <span class="admin-mark" title="مضاف من الإدارة">' + verifiedBadge('مضاف من الإدارة') + '</span>' : ''}</h3>
      <p class="card-desc">${esc(c.description || 'لا يوجد وصف لهذا الكود')}</p>
    </div>
    <div class="card-footer">
      ${authorLink(c)}
      <span class="lang-badge">${esc(c.language || 'txt')}</span>
    </div>
  </article>`;
}

window.api = api; window.esc = esc;
window.avatarNode = avatarNode; window.avatarUrl = avatarUrl; window.isVerified = isVerified; window.authorLink = authorLink; window.verifiedBadge = verifiedBadge;
window.renderNav = renderNav; window.doLogout = doLogout;
window.openSearch = openSearch; window.closeSearch = closeSearch;
window.codeCard = codeCard; window.loadMe = loadMe;
