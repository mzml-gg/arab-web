const { readJson } = require('./_gh');
module.exports = async (req, res) => {
  const q = String(req.query?.q || '').trim().toLowerCase();
  if (!q) return res.status(200).json({ codes: [] });
  const { data } = await readJson('data/manifest.json', { codes: [] });
  const out = (data.codes || []).filter((c) => {
    return (c.title && c.title.toLowerCase().includes(q))
      || (c.description && c.description.toLowerCase().includes(q))
      || (c.filename && c.filename.toLowerCase().includes(q))
      || (c.author && c.author.toLowerCase().includes(q))
      || (c.language && c.language.toLowerCase().includes(q));
  });
  res.status(200).json({ codes: out });
};
