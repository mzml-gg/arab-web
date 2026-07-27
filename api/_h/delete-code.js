const { currentUser, readBody, isAdminEmail } = require('../_auth');
const { getFile, deleteFile, readJson, writeJson } = require('../_gh');

// POST /api/delete-code { filename }
// Direct delete: allowed for admin, or for verified user who owns the code.
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const me = await currentUser(req);
  if (!me) return res.status(401).json({ error: 'سجل دخول أولاً' });
  try {
    const { filename } = await readBody(req);
    if (!filename || !/^[a-zA-Z0-9._-]{1,60}$/.test(filename))
      return res.status(400).json({ error: 'اسم ملف غير صالح' });

    const { data: manifest, sha } = await readJson('data/manifest.json', { codes: [] });
    const entry = (manifest.codes || []).find((c) => c.filename === filename);
    if (!entry) return res.status(404).json({ error: 'الكود غير موجود' });

    const isAdmin = isAdminEmail(me.email);
    const isOwnerVerified =
      me.username.toLowerCase() === (entry.author || '').toLowerCase() &&
      (isAdmin || !!me.is_verified_badge);
    if (!isAdmin && !isOwnerVerified) {
      return res.status(403).json({ error: 'الحذف المباشر متاح للحسابات الموثقة فقط' });
    }

    manifest.codes = manifest.codes.filter((c) => c.filename !== filename);
    await writeJson('data/manifest.json', manifest, `delete: -${filename}`);
    const f = await getFile(`codes/${filename}`);
    if (f) await deleteFile(`codes/${filename}`, `delete ${filename} by ${me.username}`, f.sha);
    res.status(200).json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'خطأ داخلي: ' + (e.message || 'unknown') });
  }
};
