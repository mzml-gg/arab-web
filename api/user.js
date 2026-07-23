const { loadUsers } = require('./_auth');
const { readJson } = require('./_gh');

module.exports = async (req, res) => {
  const { username } = req.query || {};
  if (!username) return res.status(400).json({ error: 'username مطلوب' });
  const { users } = await loadUsers();
  const u = users.find((x) => x.username.toLowerCase() === String(username).toLowerCase());
  if (!u) return res.status(404).json({ error: 'المستخدم غير موجود' });
  const { data } = await readJson('data/manifest.json', { codes: [] });
  const codes = (data.codes || []).filter((c) => c.author && c.author.toLowerCase() === u.username.toLowerCase());
  res.status(200).json({
    user: { username: u.username, created_at: u.created_at, verified: !!u.verified },
    codes,
    count: codes.length,
  });
};
