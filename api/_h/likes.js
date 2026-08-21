// GET  /api/likes?code=<filename>          -> { like, total } for a code (like = whether requester liked)
// GET  /api/likes?top=1                    -> { codes: [ {code, author, title, total, ...} ] } sorted by likes
// POST /api/likes                          -> { code } toggle like
const { currentUser, readBody } = require('../_auth');
const { loadInteractions, saveInteractions, requireAuth } = require('../_interact');
const { listDir, getFile } = require('../_gh');
const { enrichCodes } = require('../_enrich');
const manifest = require('../../data/manifest.json');

function manifestMeta() {
  const codes = [];
  const items = (manifest && manifest.codes) || [];
  for (const it of items) {
    const code = typeof it === 'string' ? { filename: it } : it;
    codes.push({ filename: code.filename, title: code.title || code.filename, description: code.description || '', language: code.language || '' });
  }
  return codes;
}

module.exports = async (req, res) => {
  try {
    const me = await currentUser(req);
    const url = new URL(req.url, 'http://x');
    const code = url.searchParams.get('code');
    const top = url.searchParams.get('top');

    if (req.method === 'POST') {
      if (!me) return res.status(401).json({ error: 'سجّل دخول أولاً' });
      const body = await readBody(req);
      const target = String(body.code || '').trim();
      if (!target) return res.status(400).json({ error: 'حدد الكود' });
      const interaction = await loadInteractions();
      const key = `${String(me.username).toLowerCase()}|${target}`;
      const had = !!interaction.likes[key];
      if (had) delete interaction.likes[key];
      else interaction.likes[key] = true;
      interaction.likeTotals = interaction.likeTotals || {};
      interaction.likeTotals[target] = Object.keys(interaction.likes)
        .filter((k) => k.endsWith('|' + target)).length;
      await saveInteractions(interaction);
      return res.status(200).json({ liked: !had, total: interaction.likeTotals[target] || 0 });
    }

    if (top === '1') {
      const interaction = await loadInteractions();
      const totals = interaction.likeTotals || {};
      const codes = manifestMeta();
      const enriched = await enrichCodes(codes);
      const rows = enriched
        .filter((c) => (totals[c.filename] || 0) > 0)
        .map((c) => ({
          code: c.filename,
          title: c.title,
          description: c.description,
          language: c.language,
          author: c.author,
          author_display: c.author_display,
          author_avatar: c.author_avatar,
          author_verified: c.author_verified,
          total: totals[c.filename] || 0,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 50);
      return res.status(200).json({ codes: rows });
    }

    if (code) {
      const interaction = await loadInteractions();
      const totals = interaction.likeTotals || {};
      const total = totals[code] || 0;
      const like = me ? !!interaction.likes[`${String(me.username).toLowerCase()}|${code}`] : false;
      return res.status(200).json({ like, total });
    }

    return res.status(200).json({ like: false, total: 0 });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
};
