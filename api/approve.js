const { checkAdmin, ghGetFile, ghPut, ghDelete, json } = require('./_gh');

function extLang(filename){
  const e = (filename.split('.').pop()||'').toLowerCase();
  const map = {js:'JavaScript',ts:'TypeScript',html:'HTML',css:'CSS',py:'Python',php:'PHP',java:'Java',cpp:'C++',c:'C',rb:'Ruby',go:'Go',rs:'Rust',json:'JSON',sh:'Shell'};
  return map[e] || e.toUpperCase() || 'TEXT';
}
function safeName(s){
  return String(s).replace(/[^A-Za-z0-9._-]/g,'_').replace(/^\.+/,'').slice(0,80);
}

module.exports = async (req, res) => {
  if(req.method !== 'POST') return json(res, 405, {error:'method'});
  if(!checkAdmin(req)) return json(res, 401, {error:'unauthorized'});
  try{
    const body = typeof req.body === 'string' ? JSON.parse(req.body||'{}') : (req.body||{});
    const { id, filename } = body;
    if(!id || !filename) return json(res, 400, {error:'id/filename مطلوبان'});
    const fname = safeName(filename);
    if(!fname.includes('.')) return json(res, 400, {error:'اسم الملف يجب أن يحتوي على امتداد'});

    const pf = await ghGetFile(`pending/${id}.json`);
    if(!pf) return json(res, 404, {error:'الطلب غير موجود'});
    const rec = JSON.parse(pf.content);

    // 1. اكتب الكود الخام
    const existing = await ghGetFile(`codes/${fname}`);
    await ghPut(`codes/${fname}`, rec.code, `approve: ${rec.title} (${fname})`, existing?.sha);

    // 2. حدّث المانيفست
    const mf = await ghGetFile('data/manifest.json');
    const arr = mf ? JSON.parse(mf.content) : [];
    const item = {
      filename: fname,
      title: rec.title,
      description: rec.description,
      language: extLang(fname),
      author: rec.author,
      approved_at: new Date().toISOString(),
      submitted_at: rec.created_at
    };
    const idx = arr.findIndex(x => x.filename === fname);
    if(idx >= 0) arr[idx] = item; else arr.push(item);
    await ghPut('data/manifest.json', JSON.stringify(arr,null,2), `manifest: +${fname}`, mf?.sha);

    // 3. احذف الطلب المعلّق
    await ghDelete(`pending/${id}.json`, pf.sha, `approved: ${id}`);

    json(res, 200, {ok:true, url:`/codes/${fname}`});
  }catch(e){
    console.error(e);
    json(res, 500, {error: e.message||'server error'});
  }
};
