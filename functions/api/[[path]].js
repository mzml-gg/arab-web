// Cloudflare Pages Function - API Dispatcher
import { readJson, listDir, getFile, putFile, writeJson, deleteFile } from '../../api/_gh';
import { enrichCodes, userMap, liveAuthor } from '../../api/_enrich';
import { loadUsers, saveUsers, currentUser, isAdminEmail, publicUser, readBody, bcrypt, sign, setSessionCookie, clearSessionCookie, randomToken, USERNAME_RE, EMAIL_RE, ADMIN_EMAIL } from '../../api/_auth';
import { getSettings, saveSettings, scanContent, DEFAULT_BANNED } from '../../api/_settings';
import { resolveFilename } from '../../api/_resolve';
import { loadInteractions, saveInteractions, nextId, requireAuth, scanForCurses } from '../../api/_interact';

// Helper to create a response
const jsonResponse = (data, status = 200, cache = 'no-store', headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 
    'Content-Type': 'application/json',
    'Cache-Control': cache,
    ...headers
  }
});

const htmlResponse = (html, status = 200, headers = {}) => new Response(html, {
  status,
  headers: { 
    'Content-Type': 'text/html; charset=utf-8',
    ...headers
  }
});

function pageMsg(msg, ok) {
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ARAB code</title>
  <link rel="stylesheet" href="/styles.css"></head>
  <body class="center-page"><div class="msg-card ${ok ? 'ok' : 'err'}">
    <div class="sphere-mini"></div><h1>${msg}</h1>
    <a href="/" class="btn primary">الذهاب للرئيسية</a>
  </div></body></html>`;
}

function slugify(s) {
  return String(s || 'code').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'code';
}

async function publish({ title, description, language, code, u, isAdmin }) {
  const lang = String(language || 'txt').slice(0, 20);
  const base = slugify(title);
  let filename = `${base}.${lang}`;
  const { data: manifest } = await readJson('data/manifest.json', { codes: [] });
  if (!manifest.codes) manifest.codes = [];
  let i = 1;
  while (manifest.codes.some((c) => c.filename === filename)) {
    filename = `${base}-${i}.${lang}`;
    i++;
  }
  const codePath = `codes/${filename}`;
  const existing = await getFile(codePath);
  await putFile(codePath, code, `publish: ${filename} by ${u.username}`, existing?.sha);
  manifest.codes.unshift({
    filename,
    title: String(title).slice(0, 120),
    description: String(description || '').slice(0, 600),
    language: lang,
    author: u.username,
    author_avatar: u.avatar_url || null,
    author_verified: isAdmin || !!u.is_verified_badge,
    admin_added: isAdmin,
    approved_at: new Date().toISOString(),
  });
  await writeJson('data/manifest.json', manifest, `manifest: +${filename}`);
  return filename;
}

// Google OAuth Helpers
function baseUrl(request, env) {
  return (env.PUBLIC_BASE_URL || `https://${request.headers.get('host')}`).replace(/\/+$/, '');
}
function redirectUri(request, env) {
  return `${baseUrl(request, env)}/api/google-callback`;
}
function genPassword() {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789@#$%';
  let out = '';
  const buf = new Uint8Array(12);
  crypto.getRandomValues(buf);
  for (let i = 0; i < 12; i++) out += chars[buf[i] % chars.length];
  return out;
}
function uniqueUsername(users, email, name) {
  let base = String(email || '').split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
  if (base.length < 3) base = ('dev' + base).slice(0, 20);
  base = base.slice(0, 16);
  if (!USERNAME_RE.test(base)) base = 'dev' + Math.floor(Math.random() * 1000);
  let candidate = base;
  let i = 1;
  const taken = new Set(users.map((u) => u.username.toLowerCase()));
  while (taken.has(candidate.toLowerCase())) candidate = `${base}${++i}`.slice(0, 20);
  return candidate;
}
function decodeIdToken(idToken) {
  const part = String(idToken || '').split('.')[1];
  if (!part) return null;
  try {
    const bin = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(bin);
  } catch { return null; }
}

export async function onRequest(context) {
  const { request, env, params } = context;
  
  // Set global variables for compatibility
  globalThis.process = globalThis.process || { env: {} };
  Object.assign(globalThis.process.env, env);

  const url = new URL(request.url);
  const path = params.path ? params.path.join('/') : '';
  const method = request.method;

  try {
    // 1. API LIST
    if (path === 'list') {
      const { data } = await readJson('data/manifest.json', { codes: [] });
      const codes = await enrichCodes(data.codes || []);
      return jsonResponse({ codes });
    }

    // 2. API SEARCH
    if (path === 'search') {
      const q = (url.searchParams.get('q') || '').trim().toLowerCase();
      if (!q) return jsonResponse({ codes: [] });
      const { data } = await readJson('data/manifest.json', { codes: [] });
      const out = (data.codes || []).filter((c) => (
        (c.title && c.title.toLowerCase().includes(q))
        || (c.description && c.description.toLowerCase().includes(q))
        || (c.filename && c.filename.toLowerCase().includes(q))
        || (c.author && c.author.toLowerCase().includes(q))
        || (c.language && c.language.toLowerCase().includes(q))
      ));
      return jsonResponse({ codes: await enrichCodes(out) });
    }

    // 3. API USER
    if (path === 'user') {
      const username = url.searchParams.get('username');
      if (!username) return jsonResponse({ error: 'username مطلوب' }, 400);
      const { users } = await loadUsers();
      const u = users.find((x) => x.username.toLowerCase() === String(username).toLowerCase());
      if (!u) return jsonResponse({ error: 'المستخدم غير موجود' }, 404);

      const me = await currentUser(request);
      const isSelf = !!(me && me.username.toLowerCase() === u.username.toLowerCase());

      const { data } = await readJson('data/manifest.json', { codes: [] });
      const mine = (data.codes || []).filter((c) => c.author && c.author.toLowerCase() === u.username.toLowerCase());
      const codes = await enrichCodes(mine);

      let pending = [];
      if (isSelf) {
        const items = await listDir('pending');
        for (const it of items) {
          if (!it.name.endsWith('.json')) continue;
          const f = await getFile(it.path);
          if (!f) continue;
          try {
            const j = JSON.parse(f.content);
            if (j.author && j.author.toLowerCase() === u.username.toLowerCase()) {
              pending.push({ id: j.id, title: j.title, submitted_at: j.submitted_at, language: j.language });
            }
          } catch {}
        }
      }

      const admin = isAdminEmail(u.email);
      return jsonResponse({
        user: {
          username: u.username,
          display_name: u.display_name || u.username,
          bio: u.bio || '',
          links: Array.isArray(u.links) ? u.links : [],
          banner_url: u.banner_url || null,
          location: u.location || '',
          website: u.website || '',
          created_at: u.created_at,
          is_admin: admin,
          is_verified_badge: admin || !!u.is_verified_badge,
          avatar_url: u.avatar_url || null,
        },
        codes,
        count: codes.length,
        is_self: isSelf,
        pending,
      });
    }

    // 4. API ME
    if (path === 'me') {
      const u = await currentUser(request);
      const out = { user: publicUser(u) };
      if (u) {
        try {
          const { data: bans } = await readJson('data/bans.json', {});
          const b = bans[String(u.username).toLowerCase()] || null;
          if (b && b.banned) {
            out.ban = { reason: b.reason || 'أسباب أمنية', banned_at: b.banned_at };
          }
        } catch (e) {}
      }
      return jsonResponse(out);
    }

    // 5. API LOGIN
    if (path === 'login') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      let { email, password } = await readBody(request);
      email = (email || '').trim();
      if (!email || !password) return jsonResponse({ error: 'الإيميل وكلمة السر مطلوبان' }, 400);
      
      const { users } = await loadUsers();
      const u = users.find((x) => x.email && x.email.toLowerCase() === email.toLowerCase());
      if (!u || !u.password_hash) return jsonResponse({ error: 'بيانات دخول خاطئة' }, 401);
      
      let ok = false;
      try { ok = await bcrypt.compare(password, u.password_hash); } catch (e) { ok = false; }
      if (!ok) return jsonResponse({ error: 'بيانات دخول خاطئة' }, 401);
      
      if (!u.verified) return jsonResponse({ error: 'الحساب غير مفعّل. راجع بريدك.' }, 403);
      
      const token = sign({ u: u.username, e: u.email });
      const cookie = setSessionCookie(token);
      
      return jsonResponse({
        ok: true,
        user: publicUser(u),
      }, 200, 'no-store', { 'Set-Cookie': cookie });
    }

    // 6. API LOGOUT
    if (path === 'logout') {
      const cookie = clearSessionCookie();
      return jsonResponse({ ok: true }, 200, 'no-store', { 'Set-Cookie': cookie });
    }

    // 7. API PUBLIC SETTINGS
    if (path === 'public-settings') {
      try {
        const s = await getSettings();
        return jsonResponse({
          settings: {
            direct_delete: s.direct_delete,
            delete_requests_enabled: s.delete_requests_enabled,
            auto_approve: s.auto_approve,
            google_login_enabled: s.google_login_enabled !== false,
            signup_enabled: s.signup_enabled !== false,
            email_change_enabled: s.email_change_enabled !== false,
            username_change_enabled: s.username_change_enabled !== false,
            account_delete_enabled: s.account_delete_enabled !== false,
          },
        });
      } catch (e) {
        return jsonResponse({ settings: { direct_delete: false, delete_requests_enabled: true, auto_approve: false, google_login_enabled: true, signup_enabled: true, email_change_enabled: true, username_change_enabled: true, account_delete_enabled: true } });
      }
    }

    // 8. API RAW
    if (path === 'raw') {
      const file = url.searchParams.get('file');
      if (!file || !/^[a-zA-Z0-9._-]{1,80}$/.test(file)) return jsonResponse({ error: 'اسم غير صالح' }, 400);
      let name = file;
      let f = await getFile(`codes/${name}`);
      if (!f) {
        const resolved = await resolveFilename(file);
        if (resolved && resolved !== name) {
          name = resolved;
          f = await getFile(`codes/${name}`);
        }
      }
      if (!f) return jsonResponse({ error: 'غير موجود' }, 404);
      
      return new Response(f.content, {
        status: 200,
        headers: {
          'Content-Type': 'text/plain; charset=utf-8',
          'X-Code-Filename': name,
          'Cache-Control': 's-maxage=60, stale-while-revalidate=300'
        }
      });
    }

    // 9. API SUBMIT
    if (path === 'submit') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const u = await currentUser(request);
      if (!u) return jsonResponse({ error: 'سجل دخول أولاً' }, 401);
      if (!u.verified) return jsonResponse({ error: 'فعّل بريدك أولاً' }, 403);
      
      const { title, description, language, code } = await readBody(request);
      if (!title || !code) return jsonResponse({ error: 'العنوان والكود مطلوبان' }, 400);
      if (code.length > 200000) return jsonResponse({ error: 'الكود طويل جداً' }, 400);

      const isAdmin = isAdminEmail(u.email);
      const isVerified = isAdmin || !!u.is_verified_badge;
      const settings = await getSettings();

      if (settings.filter_enabled && !isAdmin) {
        const hit = scanContent({ title, description, code }, settings.banned_words);
        if (hit) {
          return jsonResponse({
            error: `لقد اكتشفنا أن كودك (${title}) لديه انتهاكات في قواعد معينة وتم رفضه تلقائياً.`,
            filtered: true,
          }, 400);
        }
      }

      if (isVerified || settings.auto_approve) {
        const filename = await publish({ title, description, language, code, u, isAdmin });
        return jsonResponse({ ok: true, published: true, url: `/c/${filename}` });
      }

      const id = Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
      const entry = {
        id,
        title: String(title).slice(0, 120),
        description: String(description || '').slice(0, 600),
        language: String(language || 'txt').slice(0, 20),
        code,
        author: u.username,
        author_avatar: u.avatar_url || null,
        author_verified: false,
        author_is_admin: false,
        submitted_at: new Date().toISOString(),
      };
      await writeJson(`pending/${id}.json`, entry, `submit: ${u.username} - ${entry.title}`);
      return jsonResponse({ ok: true, published: false, id });
    }

    // 10. API SIGNUP
    if (path === 'signup') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const settings = await getSettings();
      if (settings.signup_enabled === false) return jsonResponse({ error: 'التسجيل الجديد متوقف مؤقتاً' }, 403);
      
      let { username, email, password, phone } = await readBody(request);
      username = (username || '').trim();
      email = (email || '').trim();
      phone = (phone || '').trim();

      if (!username || !email || !password) return jsonResponse({ error: 'الاسم والإيميل وكلمة السر مطلوبة' }, 400);
      if (!USERNAME_RE.test(username)) return jsonResponse({ error: 'اسم المستخدم: 3-20 حرف/رقم/شرطة سفلية' }, 400);
      if (!EMAIL_RE.test(email)) return jsonResponse({ error: 'إيميل غير صالح' }, 400);
      if (password.length < 8) return jsonResponse({ error: 'كلمة السر 8 أحرف على الأقل' }, 400);

      const data = await loadUsers();
      const emailLower = email.toLowerCase();
      if (data.users.some((u) => u.username.toLowerCase() === username.toLowerCase()))
        return jsonResponse({ error: 'اسم المستخدم مستخدم مسبقاً' }, 400);
      if (data.users.some((u) => u.email.toLowerCase() === emailLower))
        return jsonResponse({ error: 'الإيميل مسجل مسبقاً' }, 400);

      const password_hash = await bcrypt.hash(password, 10);
      const isAdmin = emailLower === ADMIN_EMAIL;
      const verification_token = randomToken(24);
      const user = {
        username, email, phone: phone || '',
        password_hash,
        display_name: isAdmin ? 'arab top' : username,
        verified: isAdmin ? true : false,
        is_verified_badge: isAdmin ? true : false,
        verification_token: isAdmin ? null : verification_token,
        created_at: new Date().toISOString(),
      };
      data.users.push(user);
      await writeJson('data/users.json', data, `chore: register ${username}`);
      
      return jsonResponse({ ok: true, needs_verification: !isAdmin });
    }

    // 11. API VERIFY
    if (path === 'verify') {
      const token = url.searchParams.get('token');
      const u = url.searchParams.get('u');
      if (!token || !u) return htmlResponse(pageMsg('رابط غير صالح', false), 400);
      
      const data = await loadUsers();
      const user = data.users.find((x) => x.username.toLowerCase() === String(u).toLowerCase());
      if (!user || user.verification_token !== token) {
        return htmlResponse(pageMsg('رابط التحقق غير صالح أو منتهي الصلاحية.', false), 400);
      }
      
      user.verified = true;
      user.verification_token = null;
      await writeJson('data/users.json', data, `chore: verify ${user.username}`);
      
      const t = sign({ u: user.username, e: user.email });
      const cookie = setSessionCookie(t);
      return htmlResponse(pageMsg('تم تفعيل حسابك بنجاح ✓', true), 200, { 'Set-Cookie': cookie });
    }

    // 12. API UPDATE PROFILE
    if (path === 'update-profile') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const u = await currentUser(request);
      if (!u) return jsonResponse({ error: 'سجل دخول أولاً' }, 401);
      
      const body = await readBody(request);
      const data = await loadUsers();
      const idx = data.users.findIndex((x) => x.username.toLowerCase() === u.username.toLowerCase());
      if (idx === -1) return jsonResponse({ error: 'المستخدم غير موجود' }, 404);
      const rec = data.users[idx];
      const URL_RE = /^https:\/\/[^\s]{4,300}$/i;

      if ('avatar_url' in body) {
        if (body.avatar_url && !URL_RE.test(body.avatar_url)) return jsonResponse({ error: 'رابط الصورة غير صالح' }, 400);
        rec.avatar_url = body.avatar_url || null;
      }
      if ('banner_url' in body) {
        if (body.banner_url && !URL_RE.test(body.banner_url)) return jsonResponse({ error: 'رابط الغلاف غير صالح' }, 400);
        rec.banner_url = body.banner_url || null;
      }
      if ('display_name' in body) rec.display_name = String(body.display_name || '').slice(0, 40) || rec.username;
      if ('bio' in body) rec.bio = String(body.bio || '').slice(0, 8000);
      if ('location' in body) rec.location = String(body.location || '').slice(0, 60);
      if ('website' in body) {
        const w = String(body.website || '').trim();
        if (w && !URL_RE.test(w)) return jsonResponse({ error: 'رابط الموقع يجب أن يبدأ بـ https://' }, 400);
        rec.website = w;
      }
      if ('links' in body) {
        if (!Array.isArray(body.links)) return jsonResponse({ error: 'الروابط غير صالحة' }, 400);
        const links = [];
        for (const l of body.links.slice(0, 12)) {
          const label = String((l && l.label) || '').trim().slice(0, 30);
          const url = String((l && l.url) || '').trim();
          if (!label || !url) continue;
          if (!URL_RE.test(url) && !/^mailto:|^https:\/\//i.test(url)) return jsonResponse({ error: `رابط غير صالح: ${label}` }, 400);
          links.push({ label, url, icon: String((l && l.icon) || '').slice(0, 4) });
        }
        rec.links = links;
      }

      rec.profile_updated_at = new Date().toISOString();
      data.users[idx] = rec;
      await writeJson('data/users.json', data, `profile: ${u.username} update`);
      return jsonResponse({ ok: true, profile: publicUser(rec) });
    }

    // 13. API FORGOT PASSWORD
    if (path === 'forgot-password') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const { email } = await readBody(request);
      if (!email || !EMAIL_RE.test(email)) return jsonResponse({ error: 'إيميل غير صالح' }, 400);
      
      const data = await loadUsers();
      const u = data.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
      if (u) {
        const reset_token = randomToken(32);
        u.reset_token = reset_token;
        u.reset_expires = Date.now() + 3600000;
        await writeJson('data/users.json', data, `chore: reset request for ${u.username}`);
      }
      return jsonResponse({ ok: true });
    }

    // 14. API RESET PASSWORD
    if (path === 'reset-password') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const { email, token, password } = await readBody(request);
      if (!email || !token || !password) return jsonResponse({ error: 'بيانات ناقصة' }, 400);
      if (password.length < 8) return jsonResponse({ error: 'كلمة السر 8 أحرف على الأقل' }, 400);
      
      const data = await loadUsers();
      const u = data.users.find((x) => 
        x.email.toLowerCase() === email.toLowerCase() && 
        x.reset_token === token && 
        x.reset_expires > Date.now()
      );
      if (!u) return jsonResponse({ error: 'رابط غير صالح أو منتهي الصلاحية' }, 400);
      
      u.password_hash = await bcrypt.hash(password, 10);
      u.reset_token = null;
      u.reset_expires = null;
      await writeJson('data/users.json', data, `chore: reset password for ${u.username}`);
      return jsonResponse({ ok: true });
    }

    // 15. API COMMENTS
    if (path === 'comments') {
      if (method === 'POST') {
        const me = await requireAuth(request);
        const body = await readBody(request);
        const code = String(body.code || '').trim();
        const text = String(body.text || '').trim();
        if (!code || !text) return jsonResponse({ error: 'التعليق مطلوب' }, 400);
        if (text.length > 1000) return jsonResponse({ error: 'التعليق طويل جداً (حد أقصى ١٠٠٠ حرف)' }, 400);

        const settings = await getSettings();
        if (settings.filter_enabled) {
          const curses = await scanForCurses(text);
          if (curses) {
            return jsonResponse({ 
              warning: true, 
              matched: curses, 
              message: 'تعليقك يحتوي كلمات غير لائقة. عدّله أو أرسله كما هو — وإذا تم نشره سيصل تحذير للإدارة تلقائياً.' 
            }, 409);
          }
        }

        const interaction = await loadInteractions();
        const entry = {
          id: nextId(),
          code,
          author: me.username,
          display_name: me.display_name || me.username,
          avatar_url: me.avatar_url || null,
          is_verified_badge: isAdminEmail(me.email) || !!me.is_verified_badge,
          text,
          line: body.line != null ? Number(body.line) : null,
          created_at: new Date().toISOString(),
        };
        interaction.comments.unshift(entry);
        await saveInteractions(interaction);
        return jsonResponse({ comment: entry }, 201);
      }

      if (method === 'DELETE') {
        const me = await requireAuth(request);
        const body = await readBody(request);
        const interaction = await loadInteractions();
        const idx = interaction.comments.findIndex((c) => c.id === body.id);
        if (idx === -1) return jsonResponse({ error: 'التعليق غير موجود' }, 404);
        if (interaction.comments[idx].author.toLowerCase() !== String(me.username).toLowerCase() && !isAdminEmail(me.email)) {
          return jsonResponse({ error: 'ممنوع' }, 403);
        }
        interaction.comments.splice(idx, 1);
        await saveInteractions(interaction);
        return jsonResponse({ ok: true });
      }

      // GET
      const code = url.searchParams.get('code') || '';
      const interaction = await loadInteractions();
      let list = code ? interaction.comments.filter((c) => c.code === code) : interaction.comments;
      list = list.slice(0, 200);
      return jsonResponse({ comments: list });
    }

    // 16. API LIKES
    if (path === 'likes') {
      const me = await currentUser(request);
      const code = url.searchParams.get('code');
      const top = url.searchParams.get('top');

      if (method === 'POST') {
        if (!me) return jsonResponse({ error: 'سجّل دخول أولاً' }, 401);
        const body = await readBody(request);
        const target = String(body.code || '').trim();
        if (!target) return jsonResponse({ error: 'حدد الكود' }, 400);
        const interaction = await loadInteractions();
        const key = `${String(me.username).toLowerCase()}|${target}`;
        const had = !!interaction.likes[key];
        if (had) delete interaction.likes[key];
        else interaction.likes[key] = true;
        interaction.likeTotals = interaction.likeTotals || {};
        interaction.likeTotals[target] = Object.keys(interaction.likes)
          .filter((k) => k.endsWith('|' + target)).length;
        await saveInteractions(interaction);
        return jsonResponse({ liked: !had, total: interaction.likeTotals[target] || 0 });
      }

      if (top === '1') {
        const interaction = await loadInteractions();
        const totals = interaction.likeTotals || {};
        const { data: manifest } = await readJson('data/manifest.json', { codes: [] });
        const enriched = await enrichCodes(manifest.codes || []);
        const rows = enriched
          .filter((c) => (totals[c.filename] || 0) > 0)
          .map((c) => ({
            code: c.filename,
            title: c.title,
            description: c.description,
            language: c.language,
            author: c.author,
            author_display: c.display_name,
            author_avatar: c.avatar_url,
            author_verified: c.is_verified_badge,
            total: totals[c.filename] || 0,
          }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 50);
        return jsonResponse({ codes: rows });
      }

      if (code) {
        const interaction = await loadInteractions();
        const totals = interaction.likeTotals || {};
        const total = totals[code] || 0;
        const like = me ? !!interaction.likes[`${String(me.username).toLowerCase()}|${code}`] : false;
        return jsonResponse({ like, total });
      }

      return jsonResponse({ like: false, total: 0 });
    }

    // 17. ADMIN: PENDING
    if (path === 'pending') {
      const u = await currentUser(request);
      if (!u || u.email.toLowerCase() !== ADMIN_EMAIL) return jsonResponse({ error: 'ممنوع' }, 403);
      const items = await listDir('pending');
      const m = await userMap();
      const out = [];
      for (const it of items) {
        if (!it.name.endsWith('.json')) continue;
        const f = await getFile(it.path);
        if (!f) continue;
        try {
          const j = JSON.parse(f.content);
          out.push(liveAuthor(j, m.get(String(j.author || '').toLowerCase())));
        } catch {}
      }
      out.sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
      return jsonResponse({ items: out });
    }

    // 18. ADMIN: APPROVE
    if (path === 'approve') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const u = await currentUser(request);
      if (!u || !isAdminEmail(u.email)) return jsonResponse({ error: 'ممنوع' }, 403);
      const { id, filename } = await readBody(request);
      if (!id || !filename) return jsonResponse({ error: 'id و filename مطلوبان' }, 400);
      if (!/^[a-zA-Z0-9._-]{1,60}$/.test(filename)) return jsonResponse({ error: 'اسم ملف غير صالح' }, 400);

      const pf = await getFile(`pending/${id}.json`);
      if (!pf) return jsonResponse({ error: 'الطلب غير موجود' }, 404);
      const entry = JSON.parse(pf.content);

      const codePath = `codes/${filename}`;
      const existing = await getFile(codePath);
      await putFile(codePath, entry.code, `approve: ${filename} by ${entry.author}`, existing?.sha);

      const { data: manifest } = await readJson('data/manifest.json', { codes: [] });
      if (!manifest.codes) manifest.codes = [];
      manifest.codes = manifest.codes.filter((c) => c.filename !== filename);
      manifest.codes.unshift({
        filename,
        title: entry.title,
        description: entry.description,
        language: entry.language,
        author: entry.author,
        author_avatar: entry.author_avatar || null,
        author_verified: !!entry.author_verified,
        admin_added: !!entry.author_is_admin,
        approved_at: new Date().toISOString(),
      });
      await writeJson('data/manifest.json', manifest, `manifest: +${filename}`);
      await deleteFile(`pending/${id}.json`, `approved ${id}`, pf.sha);

      return jsonResponse({ ok: true, url: `/c/${filename}` });
    }

    // 19. ADMIN: REJECT
    if (path === 'reject') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const u = await currentUser(request);
      if (!u || u.email.toLowerCase() !== ADMIN_EMAIL) return jsonResponse({ error: 'ممنوع' }, 403);
      const { id, reason } = await readBody(request);
      if (!id) return jsonResponse({ error: 'id مطلوب' }, 400);
      const pf = await getFile(`pending/${id}.json`);
      if (!pf) return jsonResponse({ error: 'غير موجود' }, 404);
      await deleteFile(`pending/${id}.json`, `reject ${id}`, pf.sha);
      return jsonResponse({ ok: true });
    }

    // 20. DELETE CODE
    if (path === 'delete-code') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const me = await currentUser(request);
      if (!me) return jsonResponse({ error: 'سجل دخول أولاً' }, 401);
      let { filename } = await readBody(request);
      if (!filename || !/^[a-zA-Z0-9._-]{1,80}$/.test(filename)) return jsonResponse({ error: 'اسم ملف غير صالح' }, 400);
      filename = await resolveFilename(filename);

      const { data: manifest } = await readJson('data/manifest.json', { codes: [] });
      const entry = (manifest.codes || []).find((c) => c.filename === filename);
      if (!entry) return jsonResponse({ error: 'الكود غير موجود' }, 404);

      const settings = await getSettings();
      const isAdmin = isAdminEmail(me.email);
      const isOwner = me.username.toLowerCase() === (entry.author || '').toLowerCase();
      const allowed = isAdmin || (isOwner && (settings.direct_delete || !!me.is_verified_badge));
      if (!allowed) return jsonResponse({ error: 'الحذف المباشر غير مفعّل لحسابك، أرسل طلب حذف للإدارة' }, 403);

      manifest.codes = manifest.codes.filter((c) => c.filename !== filename);
      await writeJson('data/manifest.json', manifest, `delete: -${filename}`);
      const f = await getFile(`codes/${filename}`);
      if (f) await deleteFile(`codes/${filename}`, `delete ${filename} by ${me.username}`, f.sha);
      return jsonResponse({ ok: true });
    }

    // 21. ADMIN: USERS
    if (path === 'users') {
      const me = await currentUser(request);
      if (!me || !isAdminEmail(me.email)) return jsonResponse({ error: 'ممنوع' }, 403);
      const { users } = await loadUsers();
      const filter = url.searchParams.get('filter') || 'all';
      let list = users.map(publicUser);
      if (filter === 'verified') list = list.filter((u) => u.is_verified_badge);
      else if (filter === 'unverified') list = list.filter((u) => !u.is_verified_badge && !u.is_admin);
      list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
      return jsonResponse({ users: list });
    }

    // 22. ADMIN: STATS
    if (path === 'stats') {
      const me = await currentUser(request);
      if (!me || !isAdminEmail(me.email)) return jsonResponse({ error: 'ممنوع' }, 403);
      const { users } = await loadUsers();
      const { data: man } = await readJson('data/manifest.json', { codes: [] });
      const items = await listDir('pending');
      const codes = man.codes || [];
      const byLang = {};
      codes.forEach((c) => { const l = c.language || 'txt'; byLang[l] = (byLang[l] || 0) + 1; });
      const week = Date.now() - 7 * 864e5;
      return jsonResponse({
        stats: {
          users: users.length,
          verified_users: users.filter((u) => u.is_verified_badge).length,
          google_users: users.filter((u) => u.provider === 'google').length,
          unconfirmed_users: users.filter((u) => !u.verified).length,
          codes: codes.length,
          pending: items.filter((i) => i.name.endsWith('.json')).length,
          new_users_week: users.filter((u) => u.created_at && Date.parse(u.created_at) > week).length,
          top_languages: Object.entries(byLang).sort((a, b) => b[1] - a[1]).slice(0, 6),
        },
      });
    }

    // 23. ADMIN: SETTINGS
    if (path === 'settings') {
      const me = await currentUser(request);
      if (!me || !isAdminEmail(me.email)) return jsonResponse({ error: 'ممنوع' }, 403);
      if (method === 'GET') return jsonResponse({ settings: await getSettings() });
      if (method === 'POST') {
        const body = await readBody(request);
        const cur = await getSettings();
        const pick = (k) => (body[k] === undefined ? cur[k] : !!body[k]);
        const next = {
          auto_approve: pick('auto_approve'),
          filter_enabled: pick('filter_enabled'),
          direct_delete: pick('direct_delete'),
          delete_requests_enabled: pick('delete_requests_enabled'),
          google_login_enabled: pick('google_login_enabled'),
          signup_enabled: pick('signup_enabled'),
          email_change_enabled: pick('email_change_enabled'),
          username_change_enabled: pick('username_change_enabled'),
          account_delete_enabled: pick('account_delete_enabled'),
          banned_words: Array.isArray(body.banned_words)
            ? body.banned_words.map((w) => String(w).trim()).filter(Boolean).slice(0, 400)
            : cur.banned_words,
        };
        if (!next.banned_words.length) next.banned_words = DEFAULT_BANNED;
        await saveSettings(next);
        return jsonResponse({ ok: true, settings: next });
      }
      return jsonResponse({ error: 'Method not allowed' }, 405);
    }

    // 24. GOOGLE OAUTH START
    if (path === 'google') {
      const s = await getSettings();
      if (s.google_login_enabled === false) return new Response('تسجيل الدخول بجوجل معطّل حالياً', { status: 403 });
      const clientId = env.GOOGLE_CLIENT_ID;
      if (!clientId) return new Response('GOOGLE_CLIENT_ID غير مضبوط', { status: 500 });
      
      const state = crypto.randomUUID().replace(/-/g, '');
      const oauthUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      oauthUrl.searchParams.set('client_id', clientId);
      oauthUrl.searchParams.set('redirect_uri', redirectUri(request, env));
      oauthUrl.searchParams.set('response_type', 'code');
      oauthUrl.searchParams.set('scope', 'openid email profile');
      oauthUrl.searchParams.set('state', state);
      oauthUrl.searchParams.set('prompt', 'select_account');
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': oauthUrl.toString(),
          'Set-Cookie': `g_state=${state}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600`
        }
      });
    }

    // 25. GOOGLE OAUTH CALLBACK
    if (path === 'google-callback') {
      const code = url.searchParams.get('code');
      const state = url.searchParams.get('state');
      const cookieState = (request.headers.get('cookie') || '').split(';').map(c => c.trim()).find(c => c.startsWith('g_state='));
      
      const failRedirect = (msg) => new Response(null, { status: 302, headers: { 'Location': '/auth?error=' + encodeURIComponent(msg) } });
      
      if (!code) return failRedirect('تم إلغاء تسجيل الدخول بجوجل');
      if (!cookieState || decodeURIComponent(cookieState.split('=')[1]) !== state) return failRedirect('جلسة جوجل غير صالحة');

      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID || '',
          client_secret: env.GOOGLE_CLIENT_SECRET || '',
          redirect_uri: redirectUri(request, env),
          grant_type: 'authorization_code',
        }),
      });
      const tok = await tokenRes.json();
      if (!tokenRes.ok) return failRedirect('فشل التحقق مع جوجل');
      const claims = decodeIdToken(tok.id_token);
      const email = (claims && claims.email || '').toLowerCase();
      if (!email || claims.email_verified === false) return failRedirect('بريد جوجل غير مُفعّل');

      const data = await loadUsers();
      let user = data.users.find((u) => (u.email || '').toLowerCase() === email);
      let isNew = false;

      if (!user) {
        const s = await getSettings();
        if (s.signup_enabled === false) return failRedirect('التسجيل الجديد متوقف مؤقتاً');
        isNew = true;
        const username = uniqueUsername(data.users, email, claims.name);
        user = {
          username,
          email,
          phone: '',
          password_hash: await bcrypt.hash(genPassword(), 10),
          display_name: claims.name || username,
          avatar_url: claims.picture || null,
          verified: true,
          is_verified_badge: email === ADMIN_EMAIL,
          provider: 'google',
          created_at: new Date().toISOString(),
        };
        data.users.push(user);
        await saveUsers(data, `chore: google signup ${username}`);
      } else if (!user.verified) {
        user.verified = true;
        user.verification_token = null;
        if (!user.avatar_url && claims.picture) user.avatar_url = claims.picture;
        await saveUsers(data, `chore: google verify ${user.username}`);
      }

      const t = sign({ u: user.username, e: user.email });
      const cookie = setSessionCookie(t);
      const dest = email === ADMIN_EMAIL ? '/admin' : (isNew ? '/?welcome=1' : '/');
      
      return new Response(null, {
        status: 302,
        headers: {
          'Location': dest,
          'Set-Cookie': [
            cookie,
            'g_state=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0'
          ].join(', ')
        }
      });
    }

    // 26. ACCOUNT: CHANGE EMAIL
    if (path === 'change-email') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const me = await currentUser(request);
      if (!me) return jsonResponse({ error: 'سجل دخول أولاً' }, 401);
      const s = await getSettings();
      if (s.email_change_enabled === false) return jsonResponse({ error: 'تغيير البريد متوقف حالياً' }, 403);
      if (isAdminEmail(me.email)) return jsonResponse({ error: 'لا يمكن تغيير بريد حساب الإدارة' }, 403);

      const { email, password } = await readBody(request);
      const emailLower = String(email || '').trim().toLowerCase();
      if (!EMAIL_RE.test(emailLower)) return jsonResponse({ error: 'بريد غير صالح' }, 400);
      if (emailLower === String(me.email || '').toLowerCase()) return jsonResponse({ error: 'هذا بريدك الحالي' }, 400);
      
      let ok = false;
      try { ok = await bcrypt.compare(String(password || ''), me.password_hash); } catch { ok = false; }
      if (!ok) return jsonResponse({ error: 'كلمة السر غير صحيحة' }, 401);

      const data = await loadUsers();
      if (data.users.some((u) => (u.email || '').toLowerCase() === emailLower)) return jsonResponse({ error: 'البريد مستخدم بحساب آخر' }, 409);
      
      const i = data.users.findIndex(x => x.username.toLowerCase() === me.username.toLowerCase());
      const token = randomToken(20);
      data.users[i].pending_email = emailLower;
      data.users[i].pending_email_token = token;
      data.users[i].pending_email_at = new Date().toISOString();
      await saveUsers(data, `account: ${me.username} email change requested`);
      
      // Email sending logic omitted as Cloudflare Workers need specialized setup (Resend/SendGrid)
      return jsonResponse({ ok: true, message: 'تم طلب تغيير البريد (تحتاج لإعداد SMTP لإرسال الرابط)' });
    }

    // 27. ACCOUNT: CONFIRM EMAIL
    if (path === 'confirm-email') {
      const u = url.searchParams.get('u');
      const token = url.searchParams.get('token');
      if (!u || !token) return htmlResponse(pageMsg('رابط غير صالح', false), 400);
      const data = await loadUsers();
      const i = data.users.findIndex(x => x.username.toLowerCase() === u.toLowerCase());
      if (i === -1) return htmlResponse(pageMsg('رابط غير صالح', false), 400);
      const rec = data.users[i];
      if (!rec.pending_email || rec.pending_email_token !== token) return htmlResponse(pageMsg('رابط التأكيد غير صالح أو منتهي.', false), 400);
      
      rec.email = rec.pending_email;
      rec.verified = true;
      rec.pending_email = null;
      rec.pending_email_token = null;
      await saveUsers(data, `account: ${rec.username} email changed`);
      
      const t = sign({ u: rec.username, e: rec.email });
      const cookie = setSessionCookie(t);
      return htmlResponse(pageMsg('تم تغيير بريدك بنجاح ✓', true), 200, { 'Set-Cookie': cookie });
    }

    // 28. ACCOUNT: CHANGE USERNAME
    if (path === 'change-username') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const me = await currentUser(request);
      if (!me) return jsonResponse({ error: 'سجل دخول أولاً' }, 401);
      const s = await getSettings();
      if (s.username_change_enabled === false) return jsonResponse({ error: 'تغيير اسم المستخدم متوقف حالياً' }, 403);

      const { username, password } = await readBody(request);
      const next = String(username || '').trim();
      if (!USERNAME_RE.test(next)) return jsonResponse({ error: 'اسم المستخدم غير صالح' }, 400);
      if (next.toLowerCase() === me.username.toLowerCase()) return jsonResponse({ error: 'هذا اسمك الحالي' }, 400);
      
      let ok = false;
      try { ok = await bcrypt.compare(String(password || ''), me.password_hash); } catch { ok = false; }
      if (!ok) return jsonResponse({ error: 'كلمة السر غير صحيحة' }, 401);

      const data = await loadUsers();
      if (data.users.some(u => u.username.toLowerCase() === next.toLowerCase())) return jsonResponse({ error: 'اسم المستخدم محجوز' }, 409);
      
      const i = data.users.findIndex(x => x.username.toLowerCase() === me.username.toLowerCase());
      const old = data.users[i].username;
      data.users[i].username = next;
      await saveUsers(data, `account: ${old} -> ${next}`);
      
      // Update manifest
      const { data: manifest } = await readJson('data/manifest.json', { codes: [] });
      let touched = false;
      (manifest.codes || []).forEach(c => {
        if ((c.author || '').toLowerCase() === old.toLowerCase()) { c.author = next; touched = true; }
      });
      if (touched) await writeJson('data/manifest.json', manifest, `manifest: rename author ${old} -> ${next}`);

      const t = sign({ u: next, e: data.users[i].email });
      const cookie = setSessionCookie(t);
      return jsonResponse({ ok: true, username: next }, 200, 'no-store', { 'Set-Cookie': cookie });
    }

    // 29. UPLOAD AVATAR (PROXY TO NEZUKO)
    if (path === 'upload-avatar') {
      if (method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);
      const u = await currentUser(request);
      if (!u) return jsonResponse({ error: 'سجل دخول أولاً' }, 401);
      const { data_url, filename } = await readBody(request);
      if (!data_url || !/^data:image\/(png|jpe?g|gif|webp);base64,/.test(data_url)) return jsonResponse({ error: 'ملف صورة غير صالح' }, 400);
      
      const m = data_url.match(/^data:(image\/[a-z+.-]+);base64,(.+)$/i);
      const mime = m[1];
      const b64 = m[2];
      const bin = atob(b64);
      const buf = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
      if (buf.length > 3 * 1024 * 1024) return jsonResponse({ error: 'الصورة أكبر من 3 ميغا' }, 400);
      
      const NEZUKO_URL = 'https://nezukouploads.servegame.net/api/upload';
      const NEZUKO_KEY = env.NEZUKO_API_KEY || 'nzk_f250ea202babe341bc1c064d168054d4f6ba14bace44eab981cc0a1b435e9992';
      
      const fd = new FormData();
      const ext = mime.split('/')[1].replace('jpeg', 'jpg');
      const name = (filename || `avatar_${u.username}`).replace(/[^\w.-]/g, '_').slice(0, 40) + '.' + ext;
      fd.append('file', new Blob([buf], { type: mime }), name);
      
      const r = await fetch(NEZUKO_URL, {
        method: 'POST',
        headers: { 'x-api-key': NEZUKO_KEY },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok || !j.success) return jsonResponse({ error: 'فشل رفع الصورة', detail: j }, 502);
      return jsonResponse({ ok: true, url: j.file.url });
    }

    // 30. REPORTS
    if (path === 'reports') {
      const me = await requireAuth(request);
      if (method === 'GET') {
        if (!isAdminEmail(me.email)) return jsonResponse({ error: 'ممنوع' }, 403);
        const onlyOpen = url.searchParams.get('status') !== 'all';
        const interaction = await loadInteractions();
        let list = [...(interaction.reports || [])];
        if (onlyOpen) list = list.filter(r => r.status !== 'dismissed');
        return jsonResponse({ reports: list.slice(0, 200) });
      }
      const { text } = await readBody(request);
      if (!text) return jsonResponse({ error: 'نص البلاغ مطلوب' }, 400);
      const interaction = await loadInteractions();
      interaction.reports = interaction.reports || [];
      const report = {
        id: nextId(),
        reporter: me.username,
        text: String(text).slice(0, 1000),
        created_at: new Date().toISOString(),
        status: 'open',
      };
      interaction.reports.unshift(report);
      await saveInteractions(interaction);
      return jsonResponse({ report }, 201);
    }

    // 31. REPORT CHECK
    if (path === 'report-check') {
      await requireAuth(request);
      const { text } = await readBody(request);
      const settings = await getSettings();
      if (settings.filter_enabled) {
        const matched = scanForCurses(text);
        if (matched) return jsonResponse({ blocked: true, matched, warning: 'تعليقك يحتوي كلمات غير لائقة.' }, 409);
      }
      return jsonResponse({ blocked: false });
    }

    // 32. BAN
    if (path === 'ban') {
      const me = await requireAuth(request);
      if (!isAdminEmail(me.email)) return jsonResponse({ error: 'ممنوع' }, 403);
      if (method === 'GET') {
        const { data: bans } = await readJson('data/bans.json', {});
        return jsonResponse({ bans });
      }
      const { username, reason, banned } = await readBody(request);
      if (!username) return jsonResponse({ error: 'username مطلوب' }, 400);
      const { data: bans } = await readJson('data/bans.json', {});
      if (banned) {
        bans[username.toLowerCase()] = { banned: true, reason, banned_at: new Date().toISOString() };
      } else {
        delete bans[username.toLowerCase()];
      }
      await writeJson('data/bans.json', bans, `ban: ${username} -> ${banned}`);
      return jsonResponse({ ok: true });
    }

    // Default Fallback
    return jsonResponse({ 
      error: 'هذا المسار قيد النقل إلى Cloudflare: ' + path,
      status: 'migrating'
    }, 501);

  } catch (e) {
    console.error(`API Error on ${path}:`, e);
    return jsonResponse({ 
      error: 'خطأ داخلي: ' + (e.message || 'unknown'),
      path: path
    }, 500);
  }
}
