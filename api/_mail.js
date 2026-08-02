const nodemailer = require('nodemailer');

function transporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

function verifyEmailHtml({ username, verifyUrl }) {
  return `<!doctype html>
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
      <p style="margin:18px 0 0;color:#6a5a3a;font-size:12px;">إذا لم تنشئ هذا الحساب فتجاهل هذه الرسالة.</p>
    </td></tr>
    <tr><td style="padding:16px;text-align:center;background:#080808;border-top:1px solid #2a1e0a;color:#6a5a3a;font-size:11px;">
      © ARAB code · جميع الحقوق محفوظة
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));
}

async function sendVerification({ to, username, verifyUrl }) {
  const t = transporter();
  await t.sendMail({
    from: `"ARAB code" <${process.env.SMTP_USER}>`,
    to,
    subject: '✨ تأكيد حسابك في ARAB code',
    html: verifyEmailHtml({ username, verifyUrl }),
  });
}

async function sendMail({ to, subject, html }) {
  const t = transporter();
  await t.sendMail({
    from: `"ARAB code" <${process.env.SMTP_USER}>`,
    to,
    subject,
    html,
  });
}

const SUPPORT_WA_1 = '249918614328';
const SUPPORT_WA_2 = '96879361317';
const SUPPORT_EMAIL = 'mzmlzip@gmail.com';

function supportButtons() {
  const btn = (href, label, bg) =>
    `<a href="${href}" style="display:inline-block;margin:6px 4px;padding:12px 22px;background:${bg};color:#0a0a0a;text-decoration:none;font-weight:bold;border-radius:10px;font-size:14px;">${label}</a>`;
  return `<div style="text-align:center;margin:22px 0 6px;">
    ${btn(`https://wa.me/${SUPPORT_WA_1}`, '💬 واتساب +' + SUPPORT_WA_1, 'linear-gradient(135deg,#5ce18b,#25d366)')}
    ${btn(`mailto:${SUPPORT_EMAIL}`, '✉️ ' + SUPPORT_EMAIL, 'linear-gradient(135deg,#e6a44a,#c67a1e)')}
    ${btn(`https://wa.me/${SUPPORT_WA_2}`, '💬 واتساب +' + SUPPORT_WA_2, 'linear-gradient(135deg,#5ce18b,#25d366)')}
  </div>`;
}

function shell(inner) {
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

function rejectionHtml({ username, title, reason, auto }) {
  return shell(`
    <h2 style="margin:0 0 12px;color:#ff8f6b;font-size:19px;">تم رفض الكود ✖</h2>
    <p style="margin:0 0 14px;line-height:1.9;color:#d8c9a3;font-size:15px;">
      مرحباً <b style="color:#f2c675;">${escapeHtml(username)}</b>،<br>
      ${auto
        ? `لقد اكتشفنا أن كودك <b style="color:#f2c675;">(${escapeHtml(title)})</b> لديه انتهاكات في قواعد معينة وتم رفضه تلقائياً.`
        : `تم رفض كودك <b style="color:#f2c675;">(${escapeHtml(title)})</b> من قِبل الإدارة.`}
    </p>
    ${reason ? `<div style="background:#150f04;border:1px solid #3a2a10;border-radius:10px;padding:14px;color:#e2d3ad;font-size:14px;line-height:1.8;">
      <b style="color:#f2c675;">السبب:</b><br>${escapeHtml(reason)}
    </div>` : ''}
    <p style="margin:18px 0 0;color:#a08454;font-size:13px;line-height:1.8;">
      يمكنك التحدث مع الدعم عبر البريد الأساسي أو واتساب:
    </p>
    ${supportButtons()}
  `);
}

async function sendRejection({ to, username, title, reason, auto }) {
  return sendMail({
    to,
    subject: auto ? '⚠️ تم رفض كودك تلقائياً · ARAB code' : '⚠️ تم رفض كودك · ARAB code',
    html: rejectionHtml({ username, title, reason, auto }),
  });
}

module.exports = { sendVerification, sendMail, sendRejection, rejectionHtml, shell };
