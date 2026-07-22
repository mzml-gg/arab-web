const { checkAdmin, ghGetFile, ghDelete, json } = require('./_gh');

module.exports = async (req, res) => {
  if(req.method !== 'POST') return json(res, 405, {error:'method'});
  if(!checkAdmin(req)) return json(res, 401, {error:'unauthorized'});
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body||{});
    const { id } = body;
    if(!id) return json(res, 400, {error:'id مطلوب'});
    const pf = await ghGetFile(`pending/${id}.json`);
    if(!pf) return json(res, 404, {error:'غير موجود'});
    await ghDelete(`pending/${id}.json`, pf.sha, `reject: ${id}`);
    json(res, 200, {ok:true});
  }catch(e){
    console.error(e);
    json(res, 500, {error:'server error'});
  }
};
