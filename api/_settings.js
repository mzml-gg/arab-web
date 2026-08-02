const { readJson, writeJson } = require('./_gh');

const PATH = 'data/settings.json';

const DEFAULT_BANNED = [
  'porn', 'porno', 'pornhub', 'xnxx', 'xvideos', 'xhamster', 'sex', 'sexy',
  'nude', 'nudes', 'nsfw', 'hentai', 'onlyfans', 'escort', 'viagra', 'incest',
  'rape', 'child porn', 'cp video', 'carding', 'cc checker', 'ddos', 'botnet',
  'ransomware', 'keylogger', 'stealer', 'rat malware', 'phishing', 'sqlmap dump',
  'اباحي', 'إباحي', 'اباحية', 'إباحية', 'اباحيه', 'سكس', 'جنس', 'عاري', 'عارية',
  'خلاعة', 'خلاعه', 'دعارة', 'دعاره', 'مخدرات', 'حشيش', 'اختراق حسابات',
  'تهكير حسابات', 'سرقة حسابات', 'كروت مسروقة', 'بطاقات مسروقة',
];

const DEFAULTS = {
  auto_approve: false,
  filter_enabled: true,
  banned_words: DEFAULT_BANNED,
};

async function getSettings() {
  const { data } = await readJson(PATH, {});
  return {
    auto_approve: !!data.auto_approve,
    filter_enabled: data.filter_enabled === undefined ? true : !!data.filter_enabled,
    banned_words: Array.isArray(data.banned_words) && data.banned_words.length
      ? data.banned_words
      : DEFAULT_BANNED,
  };
}

async function saveSettings(next) {
  await writeJson(PATH, next, 'settings: update');
  return next;
}

// Returns the matched banned word, or null when clean.
function scanContent({ title = '', description = '', code = '', filename = '' }, words) {
  const hay = `${title}\n${description}\n${filename}\n${code}`.toLowerCase();
  for (const w of words || []) {
    const t = String(w || '').trim().toLowerCase();
    if (!t) continue;
    if (hay.includes(t)) return t;
  }
  return null;
}

module.exports = { getSettings, saveSettings, scanContent, DEFAULTS, DEFAULT_BANNED };
