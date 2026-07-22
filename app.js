// ARAB code — client utilities

const USER_KEY = 'arab_code_user';
const ADMIN_KEY = 'arab_code_admin_token';

function getUser(){
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null'); }
  catch { return null; }
}
function setUser(u){ localStorage.setItem(USER_KEY, JSON.stringify(u)); }
function clearUser(){ localStorage.removeItem(USER_KEY); }

function getAdminToken(){ return localStorage.getItem(ADMIN_KEY) || ''; }
function setAdminToken(t){ localStorage.setItem(ADMIN_KEY, t); }
function clearAdminToken(){ localStorage.removeItem(ADMIN_KEY); }

function extLang(filename){
  const e = (filename.split('.').pop() || '').toLowerCase();
  const map = {js:'JavaScript',ts:'TypeScript',html:'HTML',css:'CSS',py:'Python',php:'PHP',java:'Java',cpp:'C++',c:'C',rb:'Ruby',go:'Go',rs:'Rust',json:'JSON',sh:'Shell'};
  return map[e] || e.toUpperCase() || 'TEXT';
}

async function loadLatest(){
  const el = document.getElementById('latest-list');
  if(!el) return;
  try{
    const r = await fetch('/api/list');
    const items = await r.json();
    if(!items.length){ el.innerHTML = '<div class="empty">لا توجد أكواد منشورة بعد.</div>'; return; }
    el.innerHTML = items.slice(0,12).map(cardHtml).join('');
  }catch(e){
    el.innerHTML = '<div class="empty">تعذر تحميل القائمة.</div>';
  }
}

function cardHtml(it){
  return `<div class="card">
    <h4>${escapeHtml(it.title||it.filename)}</h4>
    <div class="desc">${escapeHtml(it.description||'')}</div>
    <div class="meta">
      <span class="lang">${escapeHtml(it.language||extLang(it.filename))}</span>
      <span>@${escapeHtml(it.author||'مجهول')}</span>
    </div>
    <a class="open" href="/codes/${encodeURIComponent(it.filename)}" target="_blank">فتح الكود ↗</a>
  </div>`;
}

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function renderUserBar(elId){
  const el = document.getElementById(elId);
  if(!el) return;
  const u = getUser();
  if(u){
    el.innerHTML = `<p>مرحباً <strong>@${escapeHtml(u.username)}</strong></p>
    <button class="btn btn-ghost btn-sm" onclick="clearUser();location.reload()">خروج</button>`;
  }else{
    el.innerHTML = `<p class="hint">لست مسجلاً — <a href="/account.html" style="color:var(--primary)">أنشئ حساباً</a> لتتبع طلباتك.</p>`;
  }
}
