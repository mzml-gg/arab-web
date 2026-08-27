// Cloudflare Pages Function - API Dispatcher
const routes = {
  login: require('../../api/_h/login'),
  signup: require('../../api/_h/signup'),
  logout: require('../../api/_h/logout'),
  me: require('../../api/_h/me'),
  list: require('../../api/_h/list'),
  search: require('../../api/_h/search'),
  submit: require('../../api/_h/submit'),
  approve: require('../../api/_h/approve'),
  reject: require('../../api/_h/reject'),
  pending: require('../../api/_h/pending'),
  user: require('../../api/_h/user'),
  verify: require('../../api/_h/verify'),
  'forgot-password': require('../../api/_h/forgot-password'),
  'reset-password': require('../../api/_h/reset-password'),
  'update-profile': require('../../api/_h/update-profile'),
  'upload-avatar': require('../../api/_h/upload-avatar'),
  'delete-request': require('../../api/_h/delete-request'),
  'delete-requests': require('../../api/_h/delete-requests'),
  'resolve-delete': require('../../api/_h/resolve-delete'),
  'delete-code': require('../../api/_h/delete-code'),
  users: require('../../api/_h/users'),
  settings: require('../../api/_h/settings'),
  'public-settings': require('../../api/_h/public-settings'),
  'toggle-verify': require('../../api/_h/toggle-verify'),
  raw: require('../../api/_h/raw'),
  broadcast: require('../../api/_h/broadcast'),
  stats: require('../../api/_h/stats'),
  'change-email': require('../../api/_h/account').changeEmail,
  'confirm-email': require('../../api/_h/account').confirmEmail,
  'change-username': require('../../api/_h/account').changeUsername,
  'delete-account': require('../../api/_h/account').deleteAccount,
  google: require('../../api/_h/google').start,
  'google-callback': require('../../api/_h/google').callback,
  comments: require('../../api/_h/comments'),
  'report-check': require('../../api/_report').reportCheck,
  reports: require('../../api/_report').reports,
  'report-dismiss': require('../../api/_report').reportDismiss,
  ban: require('../../api/_h/ban'),
  messages: require('../../api/_h/messages'),
};

export async function onRequest(context) {
  const { request, env, params } = context;
  
  // Inject env variables to process.env for compatibility with existing code
  Object.assign(process.env, env);

  try {
    const url = new URL(request.url);
    const path = params.path ? params.path.join('/') : 'me';
    const handler = routes[path];

    if (!handler) {
      return new Response(JSON.stringify({ error: 'Not found: ' + path }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Mock res object for compatibility with Vercel/Express style handlers
    let responseBody = '';
    let responseStatus = 200;
    let responseHeaders = { 'Content-Type': 'application/json' };

    const res = {
      status(code) { responseStatus = code; return this; },
      json(data) { responseBody = JSON.stringify(data); return this; },
      send(data) { responseBody = data; return this; },
      setHeader(name, value) { responseHeaders[name] = value; return this; },
      end(data) { if(data) responseBody = data; return this; }
    };

    // Adapt request for compatibility
    const req = {
      url: request.url,
      method: request.method,
      headers: Object.fromEntries(request.headers),
      body: await request.clone().text(),
      query: Object.fromEntries(url.searchParams),
      env: env // Cloudflare specific
    };

    await handler(req, res);

    return new Response(responseBody, {
      status: responseStatus,
      headers: responseHeaders
    });
  } catch (e) {
    console.error('Cloudflare Function Error:', e);
    return new Response(JSON.stringify({ error: 'خطأ داخلي: ' + (e.message || 'unknown') }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
