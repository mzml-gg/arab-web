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

module.exports = { sendVerification };
