// Filename Resolver for Cloudflare Workers
import { readJson } from './_gh';

export async function resolveFilename(name) {
  const raw = String(name || '').trim();
  if (!raw) return null;
  const { data } = await readJson('data/manifest.json', { codes: [] });
  const codes = data.codes || [];
  const strip = (s) => String(s).replace(/\.[^.]+$/, '');

  const exact = codes.find((c) => c.filename === raw);
  if (exact) return exact.filename;

  const base = strip(raw);
  const byBase = codes.find((c) => strip(c.filename) === base);
  if (byBase) return byBase.filename;

  const byPrefix = codes.find((c) => c.filename.startsWith(raw + '.'));
  if (byPrefix) return byPrefix.filename;

  return raw;
}
