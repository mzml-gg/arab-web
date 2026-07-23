const { currentUser, readBody, randomToken } = require('./_auth');
const { writeJson } = require('./_gh');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'سجل دخول أولاً' });
  if (!u.verified) return res.status(403).json({ error: 'فعّل بريدك أولاً' });
  try {
    const { title, description, language, code } = await readBody(req);
    if (!title || !code) return res.status(400).json({ error: 'العنوان والكود مطلوبان' });
    if (code.length > 200000) return res.status(400).json({ error: 'الكود طويل جداً' });
    const id = Date.now().toString(36) + '-' + randomToken(4);
    const entry = {
      id,
      title: String(title).slice(0, 120),
      description: String(description || '').slice(0, 600),
      language: String(language || 'txt').slice(0, 20),
      code,
      author: u.username,
      submitted_at: new Date().toISOString(),
    };
    await writeJson(`pending/${id}.json`, entry, `submit: ${u.username} - ${entry.title}`);
    res.status(200).json({ ok: true, id });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
};
