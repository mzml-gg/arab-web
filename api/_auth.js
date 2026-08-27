// Auth Helper for Cloudflare Workers
import { readJson, writeJson } from './_gh';

// Note: In Workers, we should use Web Crypto for JWT or a compatible library.
// For now, we'll keep using jsonwebtoken but ensure it's bundled.
// If it fails, we will switch to jose or manual Web Crypto.
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

const USERS_PATH = 'data/users.json';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export const getSecret = () => globalThis.process.env.JWT_SECRET || 'change-me';
export const getAdminEmail = () => (globalThis.process.env.ADMIN_EMAIL || 'mzmlzip@gmail.com').toLowerCase();

export function sign(payload) { 
  return jwt.sign(payload, getSecret(), { expiresIn: '30d' }); 
}

export function verify(token) { 
  try { return jwt.verify(token, getSecret()); } catch { return null; } 
}

export function parseCookies(request) {
  const cookieHeader = request.headers.get('Cookie') || '';
  const out = {};
  cookieHeader.split(';').forEach((c) => {
    const [k, ...v] = c.trim().split('=');
    if (k) out[k] = decodeURIComponent(v.join('='));
  });
  return out;
}

export function setSessionCookie(token) {
  return `session=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${60 * 60 * 24 * 30}`;
}

export function clearSessionCookie() {
  return 'session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0';
}

export async function loadUsers() {
  const { data } = await readJson(USERS_PATH, { users: [] });
  if (!data.users) data.users = [];
  return data;
}

export async function saveUsers(data, msg) {
  await writeJson(USERS_PATH, data, msg || 'chore: update users');
}

export function isAdminEmail(email) { 
  return (email || '').toLowerCase() === getAdminEmail(); 
}

export function publicUser(u) {
  if (!u) return null;
  const admin = isAdminEmail(u.email);
  return {
    username: u.username,
    display_name: u.display_name || u.username,
    email: u.email,
    verified: !!u.verified,
    is_admin: admin,
    is_verified_badge: admin || !!u.is_verified_badge,
    avatar_url: u.avatar_url || null,
    bio: u.bio || '',
    links: Array.isArray(u.links) ? u.links : [],
    created_at: u.created_at,
  };
}

export async function currentUser(request) {
  const cookies = parseCookies(request);
  const t = cookies.session;
  if (!t) return null;
  const p = verify(t);
  if (!p) return null;
  const { users } = await loadUsers();
  const u = users.find((x) => x.username.toLowerCase() === p.u.toLowerCase());
  return u || null;
}

export async function readBody(request) {
  try {
    // Clone request to avoid stream issues if needed, though usually one-time is fine
    const body = await request.clone().json();
    return body || {};
  } catch (e) {
    return {};
  }
}

export function randomToken(n = 24) {
  const array = new Uint8Array(n);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

export { bcrypt, jwt, USERS_PATH, EMAIL_RE, USERNAME_RE };
export const ADMIN_EMAIL = getAdminEmail();
