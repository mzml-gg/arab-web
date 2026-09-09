const routes = {
  login: ['./_h/login'],
  signup: ['./_h/signup'],
  logout: ['./_h/logout'],
  me: ['./_h/me'],
  list: ['./_h/list'],
  search: ['./_h/search'],
  submit: ['./_h/submit'],
  approve: ['./_h/approve'],
  reject: ['./_h/reject'],
  pending: ['./_h/pending'],
  user: ['./_h/user'],
  verify: ['./_h/verify'],
  'forgot-password': ['./_h/forgot-password'],
  'reset-password': ['./_h/reset-password'],
  'update-profile': ['./_h/update-profile'],
  'upload-avatar': ['./_h/upload-avatar'],
  'delete-request': ['./_h/delete-request'],
  'delete-requests': ['./_h/delete-requests'],
  'resolve-delete': ['./_h/resolve-delete'],
  'delete-code': ['./_h/delete-code'],
  users: ['./_h/users'],
  settings: ['./_h/settings'],
  'public-settings': ['./_h/public-settings'],
  'toggle-verify': ['./_h/toggle-verify'],
  raw: ['./_h/raw'],
  broadcast: ['./_h/broadcast'],
  stats: ['./_h/stats'],
  'change-email': ['./_h/account', 'changeEmail'],
  'confirm-email': ['./_h/account', 'confirmEmail'],
  'change-username': ['./_h/account', 'changeUsername'],
  'delete-account': ['./_h/account', 'deleteAccount'],
  google: ['./_h/google', 'start'],
  'google-callback': ['./_h/google', 'callback'],
  comments: ['./_h/comments'],
  'report-check': ['./_report', 'reportCheck'],
  reports: ['./_report', 'reports'],
  'report-dismiss': ['./_report', 'reportDismiss'],
  ban: ['./_h/ban'],
  messages: ['./_h/messages'],
};

function loadHandler(route) {
  const spec = routes[route];
  if (!spec) return null;
  const mod = require(spec[0]);
  return spec[1] ? mod[spec[1]] : mod;
}

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
    let p = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
    if (!p || p === 'index') p = 'me';
    const handler = loadHandler(p);
    if (typeof handler !== 'function') {
      return res.status(404).json({ error: 'Not found: ' + p });
    }
    return await handler(req, res);
  } catch (e) {
    console.error('router error:', e);
    return res.status(500).json({ error: 'خطأ داخلي: ' + (e && e.message ? e.message : 'unknown') });
  }
};
