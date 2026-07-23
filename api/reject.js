const { currentUser, readBody, ADMIN_EMAIL } = require('./_auth');
const { getFile, deleteFile } = require('./_gh');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const u = await currentUser(req);
  if (!u || u.email.toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ error: 'ممنوع' });
  const { id } = await readBody(req);
  if (!id) return res.status(400).json({ error: 'id مطلوب' });
  const pf = await getFile(`pending/${id}.json`);
  if (!pf) return res.status(404).json({ error: 'غير موجود' });
  await deleteFile(`pending/${id}.json`, `reject ${id}`, pf.sha);
  res.status(200).json({ ok: true });
};
