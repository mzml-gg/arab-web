const { currentUser, readBody, ADMIN_EMAIL } = require('./_auth');
const { getFile, putFile, deleteFile, readJson, writeJson } = require('./_gh');

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const u = await currentUser(req);
  if (!u || u.email.toLowerCase() !== ADMIN_EMAIL) return res.status(403).json({ error: 'ممنوع' });
  try {
    const { id, filename } = await readBody(req);
    if (!id || !filename) return res.status(400).json({ error: 'id و filename مطلوبان' });
    if (!/^[a-zA-Z0-9._-]{1,60}$/.test(filename)) return res.status(400).json({ error: 'اسم ملف غير صالح' });

    const pf = await getFile(`pending/${id}.json`);
    if (!pf) return res.status(404).json({ error: 'الطلب غير موجود' });
    const entry = JSON.parse(pf.content);

    // Save code file
    const codePath = `codes/${filename}`;
    const existing = await getFile(codePath);
    await putFile(codePath, entry.code, `approve: ${filename} by ${entry.author}`, existing?.sha);

    // Update manifest
    const { data: manifest } = await readJson('data/manifest.json', { codes: [] });
    if (!manifest.codes) manifest.codes = [];
    manifest.codes = manifest.codes.filter((c) => c.filename !== filename);
    manifest.codes.unshift({
      filename,
      title: entry.title,
      description: entry.description,
      language: entry.language,
      author: entry.author,
      approved_at: new Date().toISOString(),
    });
    await writeJson('data/manifest.json', manifest, `manifest: +${filename}`);

    // Remove pending
    await deleteFile(`pending/${id}.json`, `approved ${id}`, pf.sha);

    res.status(200).json({ ok: true, url: `/codes/${filename}` });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'خطأ داخلي' });
  }
};
