const { ghGetFile, json } = require('./_gh');

module.exports = async (req, res) => {
  try{
    const f = await ghGetFile('data/manifest.json');
    const arr = f ? JSON.parse(f.content) : [];
    arr.sort((a,b)=> (b.approved_at||'').localeCompare(a.approved_at||''));
    res.setHeader('Cache-Control','public, max-age=30');
    json(res, 200, arr);
  }catch(e){
    console.error(e);
    json(res, 500, {error:'server error'});
  }
};
