// Shared by the build's emergency shell and the Worker's page-specific first paint.
// body is already escaped HTML rendered by pages.js, never untrusted content.
const esc = (value) => String(value).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function startupShell(brand = {}, lang = 'en', body = '<p>Device information is temporarily unavailable. Please try again.</p>') {
  const name = brand.name || 'One Style';
  const logoSrc = (brand.logoImage || '').replace(/^(assets|api)\//, '/$1/');
  const logo = logoSrc ? `<img src="${esc(logoSrc)}" alt="${esc(name)}">`
    : name === 'One Style' ? '<span dir="ltr">One<strong>STYLE</strong><small>.jo</small><i></i></span>' : esc(name);
  const ar = lang === 'ar';
  return `<div class="live-startup" id="main" tabindex="-1">
    <div class="live-startup-intro">
      <div class="live-startup-brand">${logo}</div>
      <p class="live-startup-subtitle" dir="ltr">Apple specialized</p>
      <div class="live-startup-progress" aria-hidden="true"></div>
      <p data-startup-status role="status" aria-live="polite"></p>
      <button class="button primary" data-startup-retry hidden>${ar ? 'إعادة المحاولة' : 'Try again'}</button>
    </div>
    <details class="live-startup-catalog">
      <summary>${ar ? 'تصفّح الأجهزة' : 'Browse devices'}</summary>
      ${body}
      <a class="live-startup-home" href="${ar ? '/ar' : '/'}">${ar ? 'الرئيسية' : 'Home'}</a>
    </details>
  </div>`;
}
