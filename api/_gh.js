// Shared GitHub helper
const OWNER = process.env.GITHUB_OWNER;
const REPO = process.env.GITHUB_REPO;
const TOKEN = process.env.GITHUB_TOKEN;
const BRANCH = process.env.GITHUB_BRANCH || 'main';

const API = 'https://api.github.com';

function h(){
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Accept': 'application/vnd.github+json',
    'User-Agent': 'arab-code-web',
    'X-GitHub-Api-Version': '2022-11-28'
  };
}

async function ghGet(path){
  const r = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}?ref=${BRANCH}`,{headers:h()});
  if(r.status===404) return null;
  if(!r.ok) throw new Error(`GH GET ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function ghList(dir){
  const j = await ghGet(dir);
  if(!j) return [];
  return Array.isArray(j) ? j : [j];
}
async function ghGetFile(path){
  const j = await ghGet(path);
  if(!j) return null;
  const content = Buffer.from(j.content, 'base64').toString('utf8');
  return { content, sha: j.sha };
}
async function ghPut(path, content, message, sha){
  const body = {
    message,
    content: Buffer.from(content,'utf8').toString('base64'),
    branch: BRANCH
  };
  if(sha) body.sha = sha;
  const r = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`,{
    method:'PUT', headers:{...h(),'Content-Type':'application/json'}, body: JSON.stringify(body)
  });
  if(!r.ok) throw new Error(`GH PUT ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}
async function ghDelete(path, sha, message){
  const r = await fetch(`${API}/repos/${OWNER}/${REPO}/contents/${path}`,{
    method:'DELETE', headers:{...h(),'Content-Type':'application/json'},
    body: JSON.stringify({message, sha, branch: BRANCH})
  });
  if(!r.ok) throw new Error(`GH DEL ${path} ${r.status}: ${await r.text()}`);
  return r.json();
}

function checkAdmin(req){
  const token = req.headers['x-admin-token'];
  if(!token) return false;
  try{
    const [email, password] = Buffer.from(token,'base64').toString('utf8').split(':');
    return email === process.env.ADMIN_EMAIL && password === process.env.ADMIN_PASSWORD;
  }catch{ return false; }
}

function json(res, code, data){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  res.setHeader('Cache-Control','no-store');
  res.status(code).send(JSON.stringify(data));
}

module.exports = { ghGet, ghList, ghGetFile, ghPut, ghDelete, checkAdmin, json, OWNER, REPO, TOKEN, BRANCH };
