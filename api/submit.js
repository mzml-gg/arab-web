const { ghGetFile, ghPut, json } = require('./_gh');

module.exports = async (req, res) => {
  if(req.method !== 'POST') return json(res, 405, {error:'method'});
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body||{});
    const { title, description, filename_hint, code, author, author_email } = body;
    if(!title || !code) return json(res, 400, {error:'العنوان والكود مطلوبان'});
    if(code.length > 200000) return json(res, 400, {error:'الكود كبير جداً'});
    const id = Date.now().toString(36) + Math.random().toString(36).slice(2,7);
    const rec = {
      id, title: String(title).slice(0,120),
      description: String(description||'').slice(0,240),
      filename_hint: String(filename_hint||'').slice(0,60),
      code: String(code),
      author: String(author||'مجهول').slice(0,40),
      author_email: String(author_email||'').slice(0,120),
      created_at: new Date().toISOString()
    };
    await ghPut(`pending/${id}.json`, JSON.stringify(rec,null,2), `submit: ${rec.title}`);
    json(res, 200, {ok:true, id});
  }catch(e){
    console.error(e);
    json(res, 500, {error:'server error'});
  }
};
