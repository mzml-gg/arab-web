const { getSettings } = require('../_settings');

// Public, non-sensitive flags the UI needs (no banned words, no admin data).
module.exports = async (req, res) => {
  try {
    const s = await getSettings();
    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({
      settings: {
        direct_delete: s.direct_delete,
        delete_requests_enabled: s.delete_requests_enabled,
        auto_approve: s.auto_approve,
        google_login_enabled: s.google_login_enabled !== false,
        signup_enabled: s.signup_enabled !== false,
      },
    });
  } catch (e) {
    res.status(200).json({ settings: { direct_delete: false, delete_requests_enabled: true, auto_approve: false, google_login_enabled: true, signup_enabled: true } });
  }
};
