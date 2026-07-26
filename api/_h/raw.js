const { getFile } = require('../_gh');

module.exports = async (req, res) => {
  const { file } = req.query || {};
  if (!file || !/^[a-zA-Z0-9._-]{1,80}$/.test(file)) return res.status(400).json({ error: 'اسم غير صالح' });
  const f = await getFile(`codes/${file}`);
  if (!f) return res.status(404).json({ error: 'غير موجود' });
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
  res.status(200).send(f.content);
};
