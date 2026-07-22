const { ghGetFile, json, OWNER, REPO, TOKEN } = require('./_gh');

// بحث داخل محتوى الأكواد باستخدام GitHub Code Search
module.exports = async (req, res) => {
  const q = (req.query?.q || '').toString().trim();
  if(!q) return json(res, 200, []);
  try{
    const query = `${q} repo:${OWNER}/${REPO} path:codes`;
    const r = await fetch(`https://api.github.com/search/code?q=${encodeURIComponent(query)}&per_page=30`,{
      headers:{
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'arab-code-web'
      }
    });
    if(!r.ok){ return json(res, 200, []); }
    const j = await r.json();
    const mf = await ghGetFile('data/manifest.json');
    const arr = mf ? JSON.parse(mf.content) : [];
    const byName = Object.fromEntries(arr.map(x=>[x.filename,x]));
    const out = [];
    for(const item of (j.items||[])){
      const name = item.name;
      if(byName[name]) out.push(byName[name]);
    }
    json(res, 200, out);
  }catch(e){
    console.error(e);
    json(res, 200, []);
  }
};
