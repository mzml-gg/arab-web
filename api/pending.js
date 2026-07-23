const { currentUser, ADMIN_EMAIL } = require('./_auth');
const { listDir, getFile } = require('./_gh');

module.exports = async (req, res) => {
  const u = await currentUser(req);
  if (!u || u.email.toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ error: 'ممنوع' });
  const items = await listDir('pending');
  const out = [];
  for (const it of items) {
    if (!it.name.endsWith('.json')) continue;
    const f = await getFile(it.path);
    if (!f) continue;
    try { out.push(JSON.parse(f.content)); } catch {}
  }
  out.sort((a, b) => (a.submitted_at < b.submitted_at ? 1 : -1));
  res.status(200).json({ items: out });
};
