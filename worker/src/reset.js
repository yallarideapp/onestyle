// One-time password-reset links. The token travels only in the emailed link (after the #,
// so it never reaches server logs); only its SHA-256 is stored, for 30 minutes.
import { sha256, randomHex, now, escHtml } from './util.js';
import { sendMail, siteUrl } from './mail.js';

const LIFETIME = 30 * 60;

// A new request keeps the account's two newest unexpired links, so somebody else asking for
// links can't erase the one the owner is about to open. Any use clears them all.
export async function issueReset(env, kind, accountId, generation) {
  const token = randomHex(32);
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM password_resets WHERE expires_at < ?').bind(t),
    env.DB.prepare('DELETE FROM password_resets WHERE kind = ?1 AND account_id = ?2 AND token_hash NOT IN (SELECT token_hash FROM password_resets WHERE kind = ?1 AND account_id = ?2 ORDER BY created_at DESC LIMIT 2)').bind(kind, accountId),
    env.DB.prepare('INSERT INTO password_resets (token_hash, kind, account_id, generation, expires_at, created_at) VALUES (?, ?, ?, ?, ?, ?)').bind(await sha256(token), kind, accountId, generation, t + LIFETIME, t),
  ]);
  return token;
}

export async function findReset(env, kind, token) {
  return env.DB.prepare('SELECT token_hash, account_id, generation FROM password_resets WHERE token_hash = ? AND kind = ? AND expires_at > ?').bind(await sha256(token), kind, now()).first();
}

export const clearResets = (env, kind, accountId) => env.DB.prepare('DELETE FROM password_resets WHERE kind = ? AND account_id = ?').bind(kind, accountId);

// The email holds the shop's name and the link only: nothing a visitor typed.
export async function sendResetEmail(env, { to, token, lang, shopName, admin }) {
  const site = siteUrl(env);
  const ar = lang !== 'en';
  // "/ar#/reset/…" opens the page in Arabic on any device; the token stays after the #.
  const link = `${site}${ar ? '/ar' : '/'}#/${admin ? 'admin-reset' : 'reset'}/${token}`;
  const name = String(shopName || 'One Style').slice(0, 80);
  const subject = ar ? `إعادة تعيين كلمة السر — ${name}` : `Reset your password — ${name}`;
  const lines = ar
    ? [admin ? 'طلب إعادة تعيين كلمة سر لوحة الإدارة.' : 'طلب إعادة تعيين كلمة السر لحسابك.', 'الرابط شغّال 30 دقيقة ولمرة وحدة.', 'إذا ما طلبت هاد، تجاهل الإيميل.']
    : [admin ? 'A password reset was requested for the admin panel.' : 'A password reset was requested for your account.', 'The link works once, for 30 minutes.', 'If you did not ask for this, ignore this email.'];
  const button = ar ? 'غيّر كلمة السر' : 'Choose a new password';
  const dir = ar ? 'rtl' : 'ltr';
  const html = `<div dir="${dir}" style="background:#f4f4f1;padding:28px;font-family:Arial,Helvetica,sans-serif;color:#16181d"><div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:14px;padding:28px"><h1 style="font-size:20px;margin:0 0 16px">${escHtml(name)}</h1><p style="margin:0 0 18px;line-height:1.7">${escHtml(lines[0])}</p><p style="margin:0 0 22px"><a href="${escHtml(link)}" style="display:inline-block;background:#2469e8;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:9px;font-weight:bold">${escHtml(button)}</a></p><p style="margin:0 0 8px;color:#55595f;font-size:14px">${escHtml(lines[1])}</p><p style="margin:0;color:#55595f;font-size:14px">${escHtml(lines[2])}</p></div></div>`;
  const text = [name, '', lines[0], link, '', lines[1], lines[2]].join('\n');
  return sendMail(env, { to, subject, html, text, idempotencyKey: `reset-${(await sha256(token)).slice(0, 32)}` });
}
