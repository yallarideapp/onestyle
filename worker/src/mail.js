// Email through the Resend API. Used for order alerts (optional) and password-reset links.

// Tests may point RESEND_URL at a local stand-in that records requests; nothing else.
function endpoint(env) {
  const custom = (env.RESEND_URL || '').trim();
  if (custom) {
    try { const url = new URL(custom); if (['127.0.0.1', 'localhost'].includes(url.hostname)) return url.toString(); } catch { /* fall through */ }
  }
  return 'https://api.resend.com/emails';
}

// Reset links need a verified sending domain and the site's public address.
// SITE_URL is the public https address (http only for a local test server).
const SITE = /^(https:\/\/[a-z0-9.-]+(:\d+)?|http:\/\/(127\.0\.0\.1|localhost)(:\d+)?)(\/[a-z0-9._~/-]*)?$/i;
export const siteUrl = (env) => { const value = String(env.SITE_URL || '').trim().replace(/\/+$/, ''); return SITE.test(value) ? value : ''; };
export const resetReady = (env) => Boolean(env.RESEND_API_KEY && env.MAIL_FROM && siteUrl(env));

export async function sendMail(env, { to, subject, html, text, idempotencyKey, from }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 6000);
  try {
    const res = await fetch(endpoint(env), {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify({ from: from || env.MAIL_FROM, to: [to], subject, html, text }),
    });
    if (!res.ok) console.error('mail status', res.status, (await res.text()).slice(0, 300));
    return res.ok;
  } finally { clearTimeout(timer); }
}
