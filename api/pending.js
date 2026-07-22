const { checkAdmin, ghList, ghGetFile, json } = require('./_gh');

module.exports = async (req, res) => {
  if(!checkAdmin(req)) return json(res, 401, {error:'unauthorized'});
  try{
    const files = await ghList('pending');
    const items = [];
    for(const f of files){
      if(!f.name.endsWith('.json')) continue;
      const g = await ghGetFile(`pending/${f.name}`);
      if(g){
        try{ items.push({...JSON.parse(g.content), _sha: g.sha}); }catch{}
      }
    }
    items.sort((a,b)=> (a.created_at||'').localeCompare(b.created_at||''));
    json(res, 200, items);
  }catch(e){
    console.error(e);
    json(res, 500, {error:'server error'});
  }
};
