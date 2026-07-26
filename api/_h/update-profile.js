const { currentUser, readBody, loadUsers, saveUsers } = require('../_auth');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const u = await currentUser(req);
  if (!u) return res.status(401).json({ error: 'سجل دخول أولاً' });
  try {
    const { avatar_url } = await readBody(req);
    if (avatar_url && !/^https:\/\/[^\s]+$/i.test(avatar_url)) {
      return res.status(400).json({ error: 'رابط الصورة غير صالح' });
    }
    const data = await loadUsers();
    const idx = data.users.findIndex((x) => x.username.toLowerCase() === u.username.toLowerCase());
    if (idx === -1) return res.status(404).json({ error: 'المستخدم غير موجود' });
    data.users[idx].avatar_url = avatar_url || null;
    await saveUsers(data, `profile: ${u.username} avatar`);
    res.status(200).json({ ok: true, avatar_url: avatar_url || null });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'خطأ داخلي: ' + (e.message || 'unknown') });
  }
};
