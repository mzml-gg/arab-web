// Mail Helper for Cloudflare Workers (using Vercel SMTP Proxy)
const VERCEL_MAIL_PROXY = 'https://arab-web.vercel.app/api/mail-proxy'; // You need to deploy this on Vercel
const PROXY_KEY = globalThis.process?.env?.MAIL_PROXY_KEY || 'arab-code-secret-key-123';

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

export function shell(inner) {
  return `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ARAB code</title></head>
<body style="margin:0;padding:24px;background:#0a0a0a;font-family:'Segoe UI',Tahoma,sans-serif;color:#f5e6c3;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#0d0d0d;border:2px solid #d4a24a;border-radius:14px;overflow:hidden;">
    <tr><td style="padding:24px;text-align:center;background:linear-gradient(180deg,#1a1206 0%,#0d0d0d 100%);border-bottom:1px solid #3a2a10;">
      <h1 style="margin:0;font-size:24px;color:#f2c675;letter-spacing:2px;">ARAB code</h1>
      <p style="margin:6px 0 0;color:#a08454;font-size:12px;">منصة نشر الأكواد العربية</p>
    </td></tr>
    <tr><td style="padding:26px;">${inner}</td></tr>
    <tr><td style="padding:14px;text-align:center;background:#080808;color:#6a5a3a;font-size:11px;border-top:1px solid #2a1e0c;">© ARAB code</td></tr>
  </table>
</body></html>`;
}

export async function sendMail({ to, subject, html }) {
  try {
    const res = await fetch(VERCEL_MAIL_PROXY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-proxy-key': PROXY_KEY },
      body: JSON.stringify({ to, subject, html })
    });
    return res.ok;
  } catch (e) {
    console.error('Mail Proxy Error:', e);
    return false;
  }
}

export async function sendVerification({ to, username, verifyUrl }) {
  const html = `<!doctype html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>ARAB code</title></head>
<body style="margin:0;padding:24px;background:#0a0a0a;font-family:'Segoe UI',Tahoma,sans-serif;color:#f5e6c3;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:560px;margin:auto;background:#0d0d0d;border:2px solid #d4a24a;border-radius:14px;overflow:hidden;">
    <tr><td style="padding:28px 24px;text-align:center;background:linear-gradient(180deg,#1a1206 0%,#0d0d0d 100%);border-bottom:1px solid #3a2a10;">
      <div style="display:inline-block;width:70px;height:70px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#ffb64d 0%,#c8721a 45%,#4a1e05 100%);box-shadow:0 0 40px #ff8a2a55;"></div>
      <h1 style="margin:16px 0 4px;font-size:26px;color:#f2c675;letter-spacing:2px;">ARAB code</h1>
      <p style="margin:0;color:#a08454;font-size:13px;">منصة نشر الأكواد العربية</p>
    </td></tr>
    <tr><td style="padding:28px 26px;">
      <h2 style="margin:0 0 12px;color:#f2c675;font-size:20px;">مرحباً ${escapeHtml(username)} 👋</h2>
      <p style="margin:0 0 18px;line-height:1.8;color:#d8c9a3;font-size:15px;">
        شكراً لتسجيلك في <b style="color:#f2c675;">ARAB code</b>. اضغط الزر التالي لتأكيد بريدك الإلكتروني وتفعيل حسابك:
      </p>
      <div style="text-align:center;margin:24px 0;">
        <a href="${verifyUrl}" style="display:inline-block;padding:14px 40px;background:linear-gradient(135deg,#e6a44a,#c67a1e);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:10px;font-size:15px;box-shadow:0 6px 20px #e6a44a55;">تأكيد البريد الإلكتروني</a>
      </div>
      <p style="margin:18px 0 0;color:#8a7550;font-size:12px;line-height:1.6;">
        إذا لم يعمل الزر، افتح الرابط التالي:<br>
        <span style="color:#c8a05a;word-break:break-all;">${verifyUrl}</span>
      </p>
    </td></tr>
    <tr><td style="padding:16px;text-align:center;background:#080808;border-top:1px solid #2a1e0a;color:#6a5a3a;font-size:11px;">
      © ARAB code · جميع الحقوق محفوظة
    </td></tr>
  </table>
</body></html>`;
  return sendMail({ to, subject: '✨ تأكيد حسابك في ARAB code', html });
}

export async function sendWelcomeCredentials({ to, display, username, password, loginUrl }) {
  const row = (label, value) =>
    `<tr>
      <td style="padding:9px 12px;color:#a08454;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:9px 12px;color:#f2c675;font-size:14px;font-weight:bold;direction:ltr;text-align:left;word-break:break-all;">${escapeHtml(value)}</td>
    </tr>`;
  const html = shell(`
    <h2 style="margin:0 0 10px;color:#f2c675;font-size:20px;">مرحباً بك في منصة ARAB CODE يا ${escapeHtml(display)} 👋</h2>
    <p style="margin:0 0 16px;line-height:1.9;color:#d8c9a3;font-size:15px;">
      تم إنشاء حسابك عبر <b style="color:#f2c675;">تسجيل الدخول بجوجل</b>، وأنشأنا لك كلمة سر تلقائية.
    </p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#150f04;border:1px solid #3a2a10;border-radius:12px;overflow:hidden;">
      ${row('يوزرك :', username)}
      ${row('كلمه السر :', password)}
    </table>
    <div style="text-align:center;margin:22px 0 6px;">
      <a href="${loginUrl}" style="display:inline-block;padding:13px 36px;background:linear-gradient(135deg,#e6a44a,#c67a1e);color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:10px;font-size:15px;">الدخول إلى المنصة</a>
    </div>
  `);
  return sendMail({ to, subject: '🎉 مرحباً بك في منصة ARAB CODE — بيانات حسابك', html });
}

export async function sendAccountNotice({ to, username, title, text }) {
  return sendMail({
    to,
    subject: title + ' · ARAB code',
    html: shell(`
      <h2 style="margin:0 0 12px;color:#f2c675;font-size:20px;">${escapeHtml(title)}</h2>
      <p style="margin:0 0 10px;color:#a08454;font-size:13px;">مرحباً ${escapeHtml(username)} 👋</p>
      <div style="color:#d8c9a3;font-size:15px;line-height:2;">${escapeHtml(text).replace(/\r?\n/g, '<br>')}</div>
    `),
  });
}
