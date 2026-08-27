const nodemailer = require('nodemailer');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).send('Method Not Allowed');
  
  const proxyKey = req.headers['x-proxy-key'];
  if (proxyKey !== process.env.MAIL_PROXY_KEY) {
    return res.status(401).json({ error: 'Unauthorized Proxy Access' });
  }

  const { to, subject, html } = req.body;
  if (!to || !subject || !html) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465', 10),
    secure: String(process.env.SMTP_SECURE || 'true') === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  try {
    await transporter.sendMail({
      from: `"ARAB code" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Mail Error:', error);
    return res.status(500).json({ error: error.message });
  }
};
