const { bcrypt, loadUsers, sign, setSessionCookie, readBody, ADMIN_EMAIL } = require('./_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { email, password } = await readBody(req);
    if (!email || !password) return res.status(400).json({ error: 'البيانات ناقصة' });
    const data = await loadUsers();
    const u = data.users.find((x) => x.email.toLowerCase() === email.toLowerCase());
    if (!u) return res.status(401).json({ error: 'بيانات دخول خاطئة' });
    const ok = await bcrypt.compare(password, u.password_hash);
    if (!ok) return res.status(401).json({ error: 'بيانات دخول خاطئة' });
    if (!u.verified) return res.status(403).json({ error: 'الحساب غير مفعّل. راجع بريدك.' });
    const token = sign({ u: u.username, e: u.email });
    setSessionCookie(res, token);
    res.status(200).json({
      ok: true,
      user: { username: u.username, email: u.email, is_admin: u.email.toLowerCase() === ADMIN_EMAIL },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
};
