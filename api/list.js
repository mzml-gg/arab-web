const { readJson } = require('./_gh');
module.exports = async (req, res) => {
  const { data } = await readJson('data/manifest.json', { codes: [] });
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=120');
  res.status(200).json({ codes: data.codes || [] });
};
