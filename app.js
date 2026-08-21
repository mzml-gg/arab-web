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
  try { const { user, ban } = await api('/api/me'); if (user) user.ban = ban || null; return user; } catch { return null; }
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

function codeCard(c, opts = {}) {
  const file = c.filename || c.title;
  const likes = opts.likes != null ? opts.likes : (c.like_count != null ? c.like_count : null);
  const likeBadge = likes !== null
    ? `<span style="color:${likes > 0 ? '#e05252' : 'var(--muted)'};font-size:12px;font-weight:700;display:inline-flex;align-items:center;gap:4px;">${heartSvg(likes > 0)} ${likes}</span>`
    : '';
  return `<article class="code-card" onclick="location.href='/c/${encodeURIComponent(file)}'">
    <div>
      <h3 class="card-title">${esc(c.title || file)}${c.admin_added ? ' <span class="admin-mark" title="مضاف من الإدارة">' + verifiedBadge('مضاف من الإدارة') + '</span>' : ''}</h3>
      <p class="card-desc">${esc(c.description || 'لا يوجد وصف لهذا الكود')}</p>
    </div>
    <div class="card-footer">
      ${authorLink(c)}
      <span class="lang-badge">${esc(c.language || 'txt')}</span>
      ${likeBadge}
    </div>
  </article>`;
}

window.api = api; window.esc = esc;
window.avatarNode = avatarNode; window.avatarUrl = avatarUrl; window.isVerified = isVerified; window.authorLink = authorLink; window.verifiedBadge = verifiedBadge;
window.renderNav = renderNav; window.doLogout = doLogout;
window.openSearch = openSearch; window.closeSearch = closeSearch;
window.codeCard = codeCard; window.loadMe = loadMe;

// --- Interaction helpers (comments / likes / reports / ban overlay) ---
function heartSvg(filled) {
  return `<svg viewBox="0 0 24 24" width="16" height="16" fill="${filled ? '#e05252' : 'none'}" stroke="${filled ? '#e05252' : 'currentColor'}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}
async function loadLike(code) {
  try { return await api('/api/likes?code=' + encodeURIComponent(code)); } catch { return { like: false, total: 0 }; }
}
async function toggleLike(code) {
  return api('/api/likes', { method: 'POST', body: JSON.stringify({ code }) });
}
async function loadComments(code) {
  try { const r = await api('/api/comments?code=' + encodeURIComponent(code)); return r.comments || []; } catch { return []; }
}
// Warning check BEFORE sending a comment/report. Returns { ok } or { ok:false, warning }.
async function checkProfanity(text) {
  try {
    await api('/api/report-check', { method: 'POST', body: JSON.stringify({ text }) });
    return { ok: true };
  } catch (e) {
    let msg = e.message;
    try { const d = JSON.parse(msg.replace(/^HTTP \d+:\s*/, '')); msg = d.warning || d.error || msg; } catch {}
    return { ok: false, warning: msg };
  }
}
async function submitReport(text) {
  return api('/api/reports', { method: 'POST', body: JSON.stringify({ text }) });
}
async function renderBanOverlay(me) {
  if (!me || !me.ban) return;
  if (document.getElementById('ban-overlay')) return;
  const div = document.createElement('div');
  div.id = 'ban-overlay';
  div.innerHTML = `<div style="position:fixed;inset:0;z-index:9999;display:grid;place-items:center;padding:20px;background:rgba(5,5,5,.92);">
    <div style="max-width:460px;width:100%;background:#12100a;border:2px solid #e05252;border-radius:22px;padding:34px 28px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,.6);">
      <div style="width:74px;height:74px;margin:0 auto 16px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#e05252 0%,#5c1212 100%);display:grid;place-items:center;font-size:34px;">🚫</div>
      <h2 style="margin:0 0 12px;color:#e05252;font-size:22px;">تم إغلاق هذا الحساب</h2>
      <p style="margin:0 0 8px;color:#d8c9a3;font-size:15px;line-height:1.9;">لقد تم غلق هذا الحساب لأسباب أمنية${me.ban.reason ? ' (<b>' + esc(me.ban.reason) + '</b>)' : ''}.</p>
      <p style="margin:14px 0 0;color:#a08454;font-size:13.5px;line-height:1.8;">يمكنك التواصل مع الدعم عبر تطبيق واتساب لإعادة تفعيل حسابك، اضغط على الزر أدناه.</p>
      <div style="margin-top:20px;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
        <a href="https://wa.me/249918614328" style="display:inline-flex;align-items:center;gap:8px;padding:13px 28px;background:linear-gradient(135deg,#5ce18b,#25d366);color:#0a0a0a;text-decoration:none;font-weight:800;border-radius:12px;font-size:15px;">💬 واتساب — التواصل مع الدعم</a>
      </div>
    </div>
  </div>`;
  document.body.appendChild(div);
  document.body.style.overflow = 'hidden';
}
window.heartSvg = heartSvg; window.loadLike = loadLike; window.toggleLike = toggleLike;
window.loadComments = loadComments; window.checkProfanity = checkProfanity;
window.submitReport = submitReport; window.renderBanOverlay = renderBanOverlay;

/* --- Visual Effects (Falcon & Fire) --- */
(function() {
    const css = `
    .falcon-container { position: fixed; top: -150px; left: -150px; width: 100px; height: 100px; z-index: 10000; pointer-events: none; }
    .falcon-svg { width: 100%; height: 100%; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.4)); }
    @keyframes flyIn {
        0% { transform: translate(-100px, -100px) rotate(20deg) scale(1.5); opacity: 0; }
        30% { transform: translate(40vw, 20vh) rotate(-10deg) scale(1.2); opacity: 1; }
        100% { transform: translate(var(--target-x), var(--target-y)) rotate(0deg) scale(0.6); opacity: 1; }
    }
    .falcon-active { animation: flyIn 3.5s forwards cubic-bezier(0.4, 0, 0.2, 1); }
    .fire-container { position: absolute; bottom: 0; left: 0; width: 100%; height: 40px; overflow: hidden; pointer-events: none; border-radius: 0 0 12px 12px; }
    .fire-particle { position: absolute; bottom: -10px; width: 6px; height: 6px; background: #ff4500; border-radius: 50%; filter: blur(2px); animation: rise 1s infinite ease-in; }
    @keyframes rise { 0% { transform: translateY(0) scale(1); opacity: 0.8; } 100% { transform: translateY(-40px) scale(0); opacity: 0; } }
    .fire-glow { position: absolute; bottom: 0; width: 100%; height: 100%; background: linear-gradient(to top, rgba(255,69,0,0.2), transparent); }
    .code-card { position: relative; }
    `;
    const style = document.createElement('style');
    style.innerHTML = css;
    document.head.appendChild(style);

    const FALCON_SVG = '<svg viewBox="0 0 100 100"><path d="M50 10 L70 40 L95 50 L70 60 L50 90 L30 60 L5 50 L30 40 Z" fill="#333"/><path d="M50 25 L60 45 L85 50 L60 55 L50 75 L40 55 L15 50 L40 45 Z" fill="#666"/></svg>';

    window.addEventListener('load', () => {
        const falcon = document.createElement('div');
        falcon.className = 'falcon-container';
        falcon.innerHTML = FALCON_SVG;
        document.body.appendChild(falcon);
        
        const target = document.querySelector('.code-header') || document.querySelector('header');
        if (target) {
            const r = target.getBoundingClientRect();
            falcon.style.setProperty('--target-x', (r.left + r.width/2 - 50) + 'px');
            falcon.style.setProperty('--target-y', (r.top - 40) + 'px');
        }
        falcon.classList.add('falcon-active');

        document.querySelectorAll('.code-card').forEach(card => {
            const fire = document.createElement('div');
            fire.className = 'fire-container';
            fire.innerHTML = '<div class="fire-glow"></div>';
            for(let i=0; i<15; i++) {
                const p = document.createElement('div');
                p.className = 'fire-particle';
                p.style.left = (Math.random()*100) + '%';
                p.style.animationDelay = (Math.random()) + 's';
                fire.appendChild(p);
            }
            card.appendChild(fire);
        });
    });
})();


// --- Advanced Visual Effects: Falcon & Fire ---
(function() {
  const isCodePage = window.location.pathname.includes('/c/');
  const isProfilePage = window.location.pathname.includes('/u/');
  const isHomePage = window.location.pathname === '/' || window.location.pathname.includes('index');

  const style = document.createElement('style');
  style.textContent = `
    .falcon-anim {
      position: fixed;
      width: 80px;
      height: 80px;
      z-index: 10000;
      pointer-events: none;
      filter: drop-shadow(0 5px 15px rgba(0,0,0,0.4));
      transition: all 1.5s cubic-bezier(0.4, 0, 0.2, 1);
      opacity: 0;
      transform: translate(-100px, 50vh) rotate(30deg);
    }
    @keyframes falcon-fly {
      0% { opacity: 0; transform: translate(-100px, 60vh) rotate(20deg) scale(0.5); }
      20% { opacity: 1; transform: translate(20vw, 20vh) rotate(-10deg) scale(1.2); }
      50% { transform: translate(60vw, 40vh) rotate(10deg) scale(1); }
      100% { opacity: 1; transform: translate(var(--tx), var(--ty)) rotate(0deg) scale(var(--s, 1)); }
    }
    .falcon-active {
      animation: falcon-fly 3.5s forwards ease-in-out;
    }
    .falcon-shrink {
      transform: translate(var(--tx), var(--ty)) scale(0.4) !important;
      opacity: 0.7;
    }
    .fire-container {
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      height: 60px;
      pointer-events: none;
      z-index: 5;
      background: linear-gradient(to top, rgba(255,69,0,0.2), transparent);
      border-radius: 0 0 12px 12px;
    }
    .fire-p {
      position: absolute;
      bottom: -5px;
      width: 8px;
      height: 8px;
      background: #ff4500;
      border-radius: 50%;
      filter: blur(2px);
      animation: fire-rise var(--d) infinite ease-out;
    }
    @keyframes fire-rise {
      0% { transform: translateY(0) scale(1); opacity: 0.9; background: #ff4500; }
      50% { background: #ffa500; opacity: 0.6; }
      100% { transform: translateY(-50px) scale(0); opacity: 0; background: #ffff00; }
    }
  `;
  document.head.appendChild(style);

  const falconSVG = `
    <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <path d="M50 15 L35 45 L10 50 L35 55 L50 85 L65 55 L90 50 L65 45 Z" fill="#2c3e50" stroke="#000" stroke-width="1"/>
      <path d="M50 20 L40 45 L20 50 L40 55 L50 80 L60 55 L80 50 L60 45 Z" fill="#34495e"/>
      <circle cx="50" cy="48" r="5" fill="#f1c40f"/>
      <path d="M45 48 Q50 40 55 48" fill="none" stroke="#000" stroke-width="1"/>
      <path d="M30 40 L15 35 M70 40 L85 35" stroke="#2c3e50" stroke-width="2" stroke-linecap="round"/>
    </svg>
  `;

  function spawnFalcon(x, y, shrink = false) {
    const el = document.createElement('div');
    el.className = 'falcon-anim';
    el.innerHTML = falconSVG;
    document.body.appendChild(el);
    
    // Force reflow
    el.getBoundingClientRect();
    el.style.setProperty('--tx', x + 'px');
    el.style.setProperty('--ty', y + 'px');
    el.classList.add('falcon-active');

    if (shrink) {
      setTimeout(() => el.classList.add('falcon-shrink'), 3600);
    }
  }

  // Logic
  if (isCodePage) {
    setTimeout(() => {
      const target = document.querySelector('pre') || document.querySelector('.code-content');
      if (target) {
        const r = target.getBoundingClientRect();
        spawnFalcon(r.left + 50, r.top - 60);
      }
    }, 1500);
  }

  if (isProfilePage) {
    setTimeout(() => {
      const target = document.querySelector('.profile-avatar') || document.querySelector('.user-badge') || document.querySelector('h2');
      if (target) {
        const r = target.getBoundingClientRect();
        spawnFalcon(r.left + (r.width/2) - 40, r.top - 20, true);
      }
    }, 1000);
  }

  if (isHomePage) {
    const addFire = () => {
      document.querySelectorAll('.code-card').forEach((card, i) => {
        if (i >= 5 && i <= 7 && !card.querySelector('.fire-container')) {
          const c = document.createElement('div');
          c.className = 'fire-container';
          for(let j=0; j<20; j++) {
            const p = document.createElement('div');
            p.className = 'fire-p';
            p.style.left = Math.random()*100 + '%';
            p.style.setProperty('--d', (0.6 + Math.random()*0.8) + 's');
            p.style.animationDelay = Math.random() + 's';
            c.appendChild(p);
          }
          card.style.position = 'relative';
          card.appendChild(c);
        }
      });
    };
    setInterval(addFire, 1000);
  }
})();
