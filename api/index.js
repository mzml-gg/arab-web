// Single dispatcher — keeps us under Vercel Hobby's 12-function cap
const routes = {
  login: require('./_h/login'),
  signup: require('./_h/signup'),
  logout: require('./_h/logout'),
  me: require('./_h/me'),
  list: require('./_h/list'),
  search: require('./_h/search'),
  submit: require('./_h/submit'),
  approve: require('./_h/approve'),
  reject: require('./_h/reject'),
  pending: require('./_h/pending'),
  user: require('./_h/user'),
  verify: require('./_h/verify'),
  'forgot-password': require('./_h/forgot-password'),
  'reset-password': require('./_h/reset-password'),
};

module.exports = async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    // strip /api/ prefix
    let p = url.pathname.replace(/^\/api\//, '').replace(/\/+$/, '');
    if (!p || p === 'index') p = 'me'; // fallback
    const h = routes[p];
    if (!h) return res.status(404).json({ error: 'Not found: ' + p });
    return h(req, res);
  } catch (e) {
    console.error('router error:', e);
    res.status(500).json({ error: 'خطأ داخلي: ' + (e && e.message ? e.message : 'unknown') });
  }
};
