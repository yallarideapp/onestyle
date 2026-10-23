/* Live site adapter for Cloudflare (dist/ only; the GitHub Pages preview never loads it).
   Loads the published content first, then the page's own scripts, and connects the bag,
   checkout, admin and shopper accounts to the server (/api). */
(() => {
  'use strict';
  const me = document.currentScript;
  const pageScripts = (me && me.dataset.scripts || '').split(/\s+/).filter(Boolean);
  const startup = document.querySelector('.live-startup');
  let startupState = 'pending';
  const startupText = (ar, en) => document.documentElement.lang === 'ar' ? ar : en;
  function failStartup() {
    if (startupState === 'ready' || startupState === 'failed') return;
    startupState = 'failed';
    clearTimeout(startupTimer);
    if (!startup) return;
    // Keep the original node: a render that fails partway through must not lose the fallback.
    document.getElementById('app').replaceChildren(startup);
    startup.classList.remove('is-loading');
    startup.classList.add('is-failed');
    startup.querySelector('[data-startup-status]').textContent = startupText('تعذّر تحميل المتجر. تصفّح الأجهزة أدناه أو أعد المحاولة.', 'The store could not finish loading. Browse devices below or try again.');
    startup.querySelector('[data-startup-retry]').hidden = false;
    startup.querySelector('details').open = true;
  }
  const startupTimer = setTimeout(failStartup, 15000);
  if (startup) {
    startup.classList.add('is-loading');
    startup.querySelector('[data-startup-status]').textContent = startupText('جارٍ تجهيز المتجر…', 'Getting the store ready…');
    startup.querySelector('[data-startup-retry]').addEventListener('click', () => location.reload());
  }

  // ---------- server ----------
  class ApiError extends Error { constructor(code, status, extra) { super(code); this.code = code; this.status = status; this.extra = extra || {}; } }
  async function request(path, { method = 'GET', body, raw, type, timeout } = {}) {
    const controller = timeout ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
    try {
      let res;
      try {
        res = await fetch(path, {
          method, credentials: 'same-origin', cache: 'no-store',
          ...(controller ? { signal: controller.signal } : {}),
          headers: raw ? { 'Content-Type': type } : body !== undefined ? { 'Content-Type': 'application/json' } : {},
          body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
        });
      } catch { throw new ApiError('network', 0); }
      let data = null;
      try { data = await res.json(); } catch { /* not JSON */ }
      if (!res.ok) throw new ApiError((data && data.error) || 'server', res.status, data || {});
      return data;
    } finally { if (timer) clearTimeout(timer); }
  }

  const live = window.OneStyleLive = { content: null, version: 0, localKey: 'onestyle.live.v1' };
  let app = null; // set by app.js through live.attach()
  const lang = () => (app ? app.lang() : (document.documentElement.lang === 'en' ? 'en' : 'ar'));
  const t = (ar, en) => (lang() === 'ar' ? ar : en);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // The page being shown: admin and reset pages by hash, everything else by its address.
  const route = () => live.currentRoute();
  const clone = (v) => JSON.parse(JSON.stringify(v));
  const randomToken = () => Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('');

  // ---------- wording: the preview's "demo" sentences become live sentences ----------
  // [Arabic preview, English preview, Arabic live, English live]
  const liveWords = [
    ['تجريبي · بانتظار الاعتماد', 'Illustrative · pending confirmation', 'اسأل عن التوفر', 'Ask about availability'],
    ['متوفر في المعاينة', 'Available in preview', 'متوفر', 'Available'],
    ['حسب الطلب في المعاينة', 'On request in preview', 'حسب الطلب', 'On request'],
    ['غير متوفر في المعاينة', 'Unavailable in preview', 'غير متوفر', 'Unavailable'],
    ['غير متاح في المعاينة', 'Unavailable in preview', 'غير متاح', 'Unavailable'],
    ['حد المعاينة 100 جهاز.', 'The preview supports 100 devices.', 'المتجر بيتسع لـ 100 جهاز.', 'The store holds up to 100 devices.'],
    ['معاينة لمتجر مستقل. Apple وأسماء منتجاتها علامات تجارية لأصحابها.', 'An independent retailer preview. Apple and its product names are trademarks of their respective owners.', 'متجر مستقل. Apple وأسماء منتجاتها علامات تجارية لأصحابها.', 'An independent retailer. Apple and its product names are trademarks of their respective owners.'],
    ['عن المعاينة', 'About this preview', 'كيف بيشتغل الطلب', 'How ordering works'],
    ['عن هذه المعاينة', 'About this preview', 'كيف بيشتغل الطلب', 'How ordering works'],
    ['يبدأ من · تجريبي', 'From · demo', 'يبدأ من', 'From'],
    ['اختيارات للمعاينة', 'THE EDIT', 'اختياراتنا', 'THE EDIT'],
    ['الأجهزة اللي عليها عرض هلأ. الأسعار تجريبية.', 'Devices on offer right now. Prices are illustrative.', 'الأجهزة اللي عليها عرض هلأ.', 'Devices on offer right now.'],
    ['الأسعار والتهيئات والتوفر هنا للمعاينة؛ تُعتمد مع المحل قبل الإطلاق.', 'Preview prices, configurations and availability need store confirmation before launch.', 'الأسعار والتوفر ممكن يتغيروا؛ بنأكد طلبك معك بالتلفون.', 'Prices and availability can change; we confirm your order by phone.'],
    ['تهيئة تجريبية', 'PREVIEW CONFIGURATION', 'التهيئة', 'CONFIGURATION'],
    ['سعر تجريبي', 'Illustrative price', 'السعر بالدينار', 'Price in JOD'],
    ['خيارات المعاينة وأسعار ترقيتها تجريبية، وتحتاج اعتماد المحل.', 'Configuration choices and upgrade prices are illustrative and need store approval.', 'بنأكد معك التهيئة والسعر قبل التوصيل.', 'We confirm the configuration and price with you before delivery.'],
    ['المبالغ هنا للمقارنة في المعاينة، وليست عروض بيع.', 'These amounts are for the preview comparison, not live offers.', 'الأسعار ممكن تتغير؛ بنأكدها معك قبل التوصيل.', 'Prices can change; we confirm them with you before delivery.'],
    ['اسأل المحل عن التوفر ورسوم التوصيل. رسوم سلة المعاينة تجريبية.', 'Ask the shop about stock and delivery fees. Preview checkout fees are illustrative.', 'رسوم التوصيل بتظهر عند إتمام الطلب.', 'Delivery fees are shown at checkout.'],
    ['هل الموقع يستقبل طلبات حقيقية؟', 'Does this preview accept real orders?', 'كيف بيشتغل الطلب؟', 'How do orders work?'],
    ['لا، هاي معاينة خاصة. السلة والطلبات والأدمن تعمل محليًا على نفس المتصفح، ولا يُرسل أي طلب للمحل.', 'No. This private preview stores bag and order data in the same browser. Nothing is sent to the shop.', 'اطلب من الموقع وادفع عند الاستلام، وبنتصل فيك لنأكد الطلب قبل التوصيل.', 'Order on the site and pay cash on delivery. We call you to confirm before delivery.'],
    ['تواصل مع المحل مباشرة. أسعار هذه المعاينة للتوضيح وتحتاج اعتماد قبل إطلاق الموقع.', 'Contact the shop directly. Preview prices are illustrative and need approval before launch.', 'لأي سؤال ثاني، تواصل مع المحل مباشرة.', 'For anything else, contact the shop directly.'],
    ['قارن حتى 3 أجهزة. الأسعار للمعاينة.', 'Compare up to 3 devices. All prices are illustrative.', 'قارن حتى 3 أجهزة.', 'Compare up to 3 devices.'],
    ['السعر المبدئي التجريبي', 'Illustrative starting price', 'السعر المبدئي', 'Starting price'],
    ['لوحة الإدارة', 'Admin preview', 'لوحة الإدارة', 'Admin'],
    ['سلة تجريبية — لا يتم إرسال طلبات للمحل.', 'Demo bag — no orders are sent to the shop.', 'الدفع عند الاستلام، وبنتصل فيك لنأكد الطلب.', 'Cash on delivery. We call you to confirm.'],
    ['تظهر رسوم التوصيل التجريبية بالخطوة التالية.', 'Illustrative delivery fees are shown in the next step.', 'رسوم التوصيل بتظهر بالخطوة الجاية.', 'Delivery fees are shown in the next step.'],
    ['جرّب إتمام الطلب', 'Try checkout', 'أكمل الطلب', 'Checkout'],
    ['لوحة الإدارة التجريبية', 'Demo admin panel', 'لوحة الإدارة', 'Admin panel'],
    ['الحد التجريبي 20 قطعة لكل تهيئة.', 'The demo limit is 20 per configuration.', 'الحد 20 قطعة لكل تهيئة.', 'At most 20 per configuration.'],
    ['هذه نسخة عرض خاصة لمتجر One Style: أجهزة، تفاصيل، مقارنة، أداة اختيار الماك، سلة ولوحة إدارة.', 'This private One Style prototype includes devices, details, comparison, a Mac guide, a bag and an admin demo.', 'اختار جهازك وأضفه للسلة، وبعدين أكمل الطلب بالاسم والرقم والعنوان.', 'Choose your device, add it to the bag, then check out with your name, number and address.'],
    ['البيانات محفوظة على متصفحك فقط. لا توجد قاعدة بيانات أو مصادقة أو بوابة دفع فعلية.', 'Data stays in your browser. No database, authentication or live payment gateway is connected.', 'الطلب بيوصل للمحل مباشرة، والدفع عند الاستلام. ما في دفع إلكتروني على الموقع.', 'Your order goes straight to the shop and you pay on delivery. There is no online payment.'],
    ['المعلومات العامة مأخوذة من حساب المحل. الأسعار والتوفر والرسوم والتهيئات المعروضة تحتاج اعتماد المحل قبل النشر. الصور الافتراضية واقعية وتوضيحية للفئات، وليست صور الموديلات الفعلية.', 'Public business details are based on the shop’s profile. Prices, availability, fees and configurations need confirmation before publication. Default images are photoreal category illustrations, not actual model photographs.', 'الصور الافتراضية توضيحية للفئات، وليست صور الموديلات الفعلية.', 'Default images are category illustrations, not actual model photographs.'],
    ['جرّب لوحة الإدارة', 'Try the admin panel', 'لوحة الإدارة', 'Admin panel'],
    // admin
    ['جرّب إضافة جهاز إلى السلة وإرسال طلب تجريبي.', 'Add a device to the bag and place a demo order.', 'الطلبات من الموقع بتظهر هون.', 'Orders from the site show up here.'],
    ['عميل تجريبي', 'Demo customer', 'العميل', 'Customer'],
    ['الطلبات التجريبية', 'Demo orders', 'الطلبات', 'Orders'],
    ['بيانات محفوظة على هذا المتصفح', 'Saved on this browser', 'محفوظة على السيرفر', 'Saved on the server'],
    ['قيمة الطلبات التجريبية', 'Demo order value', 'قيمة الطلبات', 'Order value'],
    ['كتالوج المعاينة', 'Preview catalog', 'الكتالوج', 'Catalog'],
    ['معاينة إدارة المتجر والطلبات من مكان واحد.', 'A preview of your store and orders, in one place.', 'إدارة المتجر والطلبات من مكان واحد.', 'Your store and orders, in one place.'],
    ['طلبات توضيحية وتجاربك على هذه النسخة.', 'Sample orders and orders you place in this preview.', 'الطلبات اللي وصلت من الموقع.', 'Orders placed on the site.'],
    ['طلب تجريبي', 'demo orders', 'طلب', 'orders'],
    ['طلب تجريبي · ', 'DEMO ORDER · ', 'طلب · ', 'ORDER · '],
    ['تحديث الحالة التجريبية', 'Update demo status', 'تحديث الحالة', 'Update status'],
    ['الحفظ يحدّث المعاينة على هذا المتصفح فقط.', 'Saving updates the preview on this browser only.', 'الحفظ بينشر التعديل على الموقع.', 'Saving publishes the change to the site.'],
    ['التعديلات محلية في هذه المعاينة. صدّر ملف التخصيص للاحتفاظ بنسخة ونقله إلى متصفح آخر.', 'Changes are local to this preview. Export a customization file to keep a copy or move it to another browser.', 'التعديلات محفوظة على السيرفر. صدّر ملف التخصيص للاحتفاظ بنسخة.', 'Changes are saved on the server. Export a customization file to keep a copy.'],
    ['الحفظ يحدّث الموقع على هذا المتصفح فقط.', 'Saving updates the website on this browser only.', 'الحفظ بينشر التعديل على الموقع.', 'Saving publishes the change to the site.'],
    ['السعر التجريبي · دينار', 'Demo price · JOD', 'السعر · دينار', 'Price · JOD'],
    ['وضع المعاينة', 'Preview mode', 'الموقع المباشر', 'Live site'],
    ['معاينة محلية — لا توجد طلبات حقيقية', 'Local preview — no real orders', 'الموقع المباشر — الطلبات بتوصل للمحل', 'Live site — orders reach the shop'],
    ['تعذر الحفظ. راجع البيانات؛ قد تكون مساحة المتصفح ممتلئة. جرّب صورة أصغر أو صدّر نسخة من التخصيص.', 'Unable to save. Check the values; browser storage may be full. Try a smaller image or export your customization.', 'تعذر الحفظ. راجع البيانات وجرّب مرة ثانية.', 'Unable to save. Check the values and try again.'],
    ['تعذر حفظ الجهاز. قد تكون مساحة المتصفح ممتلئة.', 'Unable to save the device. Browser storage may be full.', 'تعذر حفظ الجهاز. راجع البيانات.', 'Unable to save the device. Check the values.'],
    ['تم حفظ التخصيص على هذا المتصفح.', 'Customization saved on this browser.', 'انحفظ، وعم ننشره على الموقع…', 'Saved. Publishing to the site…'],
    ['تم استيراد التخصيص على هذا المتصفح.', 'Customization imported on this browser.', 'تم الاستيراد، وعم ننشره على الموقع…', 'Imported. Publishing to the site…'],
    ['تعذر الاستيراد. تأكد أنه ملف تخصيص صحيح وأن مساحة المتصفح متاحة.', 'Unable to import. Check the customization file and available browser storage.', 'تعذر الاستيراد. تأكد أنه ملف تخصيص صحيح.', 'Unable to import. Check the customization file.'],
    ['تعذر حفظ الجهاز. راجع البيانات، أو جرّب صورة أصغر إذا كانت مساحة المتصفح ممتلئة.', 'Unable to save the device. Check the values, or try a smaller image if browser storage is full.', 'تعذر حفظ الجهاز. راجع البيانات وجرّب مرة ثانية.', 'Unable to save the device. Check the values and try again.'],
    ['تم حفظ بيانات الجهاز في هذه المعاينة.', 'Device details saved in this preview.', 'انحفظ الجهاز، وعم ننشره على الموقع…', 'Device saved. Publishing to the site…'],
    ['تم تحديث حالة الطلب التجريبي.', 'Demo order status updated.', 'تم تحديث حالة الطلب.', 'Order status updated.'],
    ['تعديلات الأسعار وحالات الطلبات تُحفظ محليًا. الربط بقاعدة البيانات والدفع الإلكتروني يُجهّز عند تشغيل المتجر الفعلي.', 'Price and order status changes are saved locally. Database and payment integration are prepared for the live store.', 'تعديلات الأسعار وحالات الطلبات بتنحفظ على السيرفر وبتظهر للزبائن مباشرة.', 'Price and order status changes are saved on the server and reach customers straight away.'],
    ['هذا التغيير محلي، ولا يرسل إشعارًا إلى عميل.', 'This is a local change. No customer notification is sent.', 'العميل بيشوف الحالة الجديدة بحسابه إذا طلب وهو داخل. ما بنبعتله إشعار.', 'A signed-in customer sees the new status in their account. No notification is sent.'],
    ['ما قدرنا نحفظ التعديل. جرّب صورة أصغر أو صدّر التعديلات قبل تقليل حجم الصور.', 'Could not save. Try a smaller image or export your edits before reducing image sizes.', 'ما قدرنا نحفظ التعديل. جرّب مرة ثانية.', 'Could not save. Please try again.'],
  ];
  const wordMap = new Map();
  for (const [ar, en, arLive, enLive] of liveWords) { wordMap.set(ar, arLive); wordMap.set(en, enLive); }
  live.text = (s) => (wordMap.has(s) ? wordMap.get(s) : s);

  // ---------- shopper session ----------
  const shopper = { checked: false, signedIn: false, customer: null, resetAvailable: false, orders: null, ordersError: false, tab: 'signin', message: '', error: '', busy: false };
  function setShopper(data) {
    shopper.checked = true;
    shopper.signedIn = !!(data && data.signedIn && data.customer);
    shopper.customer = shopper.signedIn ? data.customer : null;
    shopper.resetAvailable = !!(data && data.resetAvailable);
    if (!shopper.signedIn) shopper.orders = null;
  }

  // ---------- boot: published content first, then the page's scripts ----------
  (async () => {
    const [content, session] = await Promise.allSettled([request('/api/content', { timeout: 8000 }), request('/api/customer/session', { timeout: 4000 })]);
    // Never present the bundled sample catalogue as current stock when the API is unavailable.
    if (startupState === 'failed' || content.status !== 'fulfilled' || !content.value?.content?.settings || !Array.isArray(content.value.content.catalog)) throw new Error('startup-content');
    live.content = content.value.content; live.version = content.value.version; setSlugs(live.content.slugs);
    // Old "#/product/…" links move to the real address; the admin keeps its "#/admin" address.
    const hash = location.hash;
    if (/^\/admin(\/|$)/.test(location.pathname)) history.replaceState(null, '', `/#${location.pathname}`);
    else if (hash.startsWith('#/') && !HASH_ONLY.test(hash)) history.replaceState(null, '', live.pathFor(hash.slice(1), isArPath(location.pathname) ? 'ar' : savedLang()));
    else if (!HASH_ONLY.test(hash) && !isArPath(location.pathname) && savedLang() === 'ar') history.replaceState(null, '', `/ar${location.pathname === '/' ? '' : location.pathname}${location.search}`);
    if (session.status === 'fulfilled') setShopper(session.value);
    if (/^\/admin(\/|$)/.test(route())) await loadAdminStatus().catch(() => {});
    for (const src of pageScripts) {
      if (startupState === 'failed') return;
      await new Promise((resolve, reject) => {
        const s = document.createElement('script'); s.src = src; s.async = false;
        s.onload = resolve; s.onerror = () => reject(new Error('startup-script'));
        document.head.appendChild(s);
      });
    }
    if (startupState !== 'ready') failStartup();
  })().catch(failStartup);

  live.attach = (bridge) => {
    app = bridge;
    observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['href'] });
  };

  // ---------- errors ----------
  const errorText = (code) => ({
    'bad-name': t('اكتب اسمك (حرفين على الأقل).', 'Enter your name (at least 2 letters).'),
    'bad-phone': t('اكتب رقم موبايل أردني صحيح، مثل 0791234567.', 'Enter a valid Jordanian mobile number, like 0791234567.'),
    'bad-city': t('اختار المدينة.', 'Choose a city.'),
    'bad-address': t('اكتب عنوان التوصيل.', 'Enter the delivery address.'),
    'price-changed': t('تغيّر سعر بالسلة. راجع السلة وجرّب مرة ثانية.', 'A price in your bag changed. Check your bag and try again.'),
    'sold-out': t('جهاز بالسلة صار غير متوفر. راجع السلة.', 'A device in your bag is no longer available. Check your bag.'),
    unknown: t('جهاز بالسلة ما عاد موجود. راجع السلة.', 'A device in your bag is no longer listed. Check your bag.'),
    'orders-off': t('الطلب من الموقع متوقف حالياً. ابعتلنا على واتساب.', 'Ordering on the site is paused. Message us on WhatsApp.'),
    'rate-limited': t('طلبات كثيرة من نفس الجهاز. جرّب بعد شوي.', 'Too many requests from this device. Try again later.'),
    locked: t('محاولات كثيرة. استنى 15 دقيقة وجرّب مرة ثانية.', 'Too many tries. Wait 15 minutes and try again.'),
    'too-fast': t('خذ ثانية وراجع البيانات، وبعدين أرسل.', 'Take a second to check your details, then send.'),
    'too-many-lines': t('السلة فيها أنواع كثيرة لطلب واحد (20 كحد أقصى).', 'Your bag has too many different items for one order (20 at most).'),
    'bad-qty': t('الكمية 20 كحد أقصى لكل جهاز.', 'At most 20 of each item.'),
    'weak-password': t('كلمة السر لازم تكون 8 خانات أو أكثر، وفيها حرف واحد على الأقل.', 'The password needs at least 8 characters, including at least one letter.'),
    'common-password': t('كلمة السر هاي مشهورة وسهل حدا يخمّنها. اختار غيرها.', 'That password is too common and easy to guess. Choose another one.'),
    'weak-admin-password': t('كلمة سر اللوحة لازم تكون 10 خانات أو أكثر.', 'The admin password needs at least 10 characters.'),
    'bad-email': t('اكتب إيميل صحيح.', 'Enter a valid email address.'),
    'email-in-use': t('في حساب بهالإيميل. سجّل دخول.', 'An account already uses this email. Sign in instead.'),
    'bad-credentials': t('الإيميل أو كلمة السر غلط.', 'Wrong email or password.'),
    'bad-password': t('كلمة السر غلط.', 'Wrong password.'),
    'bad-code': t('رمز الإعداد غلط.', 'Wrong setup code.'),
    'not-configured': t('رمز الإعداد مش مضبوط على السيرفر بعد (SETUP_CODE).', 'The setup code is not set on the server yet (SETUP_CODE).'),
    'reset-expired': t('الرابط انتهى أو استُعمل. اطلب رابط جديد.', 'This link has expired or was already used. Ask for a new one.'),
    'reset-off': t('إرجاع كلمة السر بالإيميل مش مفعّل.', 'Password reset by email is not set up.'),
    'signed-out': t('انتهت الجلسة. سجّل دخول من جديد.', 'Your session ended. Please sign in again.'),
    mismatch: t('كلمتين السر مش متطابقات.', 'The two passwords do not match.'),
    network: t('ما قدرنا نوصل للموقع. تأكد من الإنترنت وجرّب مرة ثانية.', 'We could not reach the site. Check your connection and try again.'),
  }[code] || t('صار خطأ. جرّب مرة ثانية.', 'Something went wrong. Please try again.'));

  // ---------- admin: publishing ----------
  // Admin saves are applied on screen at once and published in order, one at a time. Pasted
  // pictures (data: URLs) are uploaded first and replaced by their photo address.
  const uploaded = new Map();
  let publishing = null;
  let publishAgain = false;
  live.persist = () => { publishAgain = true; if (!publishing) publishing = runPublish(); return true; };

  function mapStrings(value, fn) {
    if (typeof value === 'string') return fn(value);
    if (Array.isArray(value)) return value.map((v) => mapStrings(v, fn));
    if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, mapStrings(v, fn)]));
    return value;
  }
  // Decoded here rather than with fetch(), which the site's security policy keeps to its own address.
  function dataUrlBlob(dataUrl) {
    const match = dataUrl.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/);
    if (!match) throw new ApiError('bad-image', 400);
    const bytes = atob(match[2].replace(/\s/g, ''));
    const out = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i += 1) out[i] = bytes.charCodeAt(i);
    return new Blob([out], { type: match[1] });
  }
  async function uploadImages(content) {
    const pending = new Set();
    mapStrings(content, (s) => { if (s.startsWith('data:image/') && !uploaded.has(s)) pending.add(s); return s; });
    for (const dataUrl of pending) {
      const blob = dataUrlBlob(dataUrl);
      const result = await request('/api/admin/photo', { method: 'POST', raw: blob, type: blob.type });
      uploaded.set(dataUrl, result.url);
    }
    return mapStrings(content, (s) => uploaded.get(s) || s);
  }
  async function runPublish() {
    let done = false;
    try {
      while (publishAgain) {
        publishAgain = false;
        await new Promise((resolve) => setTimeout(resolve, 0)); // the admin assigns its new state right after saving
        const state = app.state();
        const content = await uploadImages({ settings: state.settings, catalog: state.products });
        const result = await request('/api/admin/content', { method: 'PUT', body: { baseVersion: live.version, content } });
        live.version = result.version;
        setSlugs(result.content.slugs);
        // Keep any newer edits made meanwhile; only swap pasted pictures for their addresses.
        const now = app.state();
        app.applyPublished(mapStrings({ settings: now.settings, catalog: now.products }, (s) => uploaded.get(s) || s));
      }
      done = true;
      decorateProductAddresses(document);
      app.toast(t('انحفظ على الموقع.', 'Saved to the site.'));
    } catch (error) {
      publishAgain = false;
      if (error.code === 'signed-out') { admin.signedIn = false; app.toast(errorText('signed-out')); app.render(); }
      else {
        app.toast(error.code === 'conflict'
          ? t('في تعديل أحدث على الموقع. رجّعنا آخر نسخة منشورة؛ أعد تعديلك.', 'The site has a newer version. We loaded it; please redo your change.')
          : error.code === 'network' ? errorText('network') : t('ما انحفظ التعديل على الموقع. رجّعنا آخر نسخة منشورة.', 'The change was not saved to the site. We loaded the last published version.'));
        await reloadPublished().catch(() => {});
      }
    } finally { publishing = null; if (done && publishAgain) live.persist(); }
  }
  // Fresh content after a failed order. A signed-in admin keeps the full content (hidden devices,
  // stock counts), so a later save from the admin can't drop them.
  const refreshContent = () => request(admin.signedIn ? '/api/admin/content' : '/api/content')
    .then((d) => { live.version = d.version; if (d.content.slugs) setSlugs(d.content.slugs); app.applyPublished(d.content); }).catch(() => {});
  async function reloadPublished() {
    const data = await request('/api/admin/content');
    live.version = data.version;
    setSlugs(data.content.slugs);
    app.applyPublished(data.content);
    app.render();
  }

  // ---------- admin: sign-in, orders ----------
  const admin = { known: false, setup: false, signedIn: false, resetAvailable: false, view: 'login', message: '', error: '', orders: [], loaded: false, poll: null };
  const telegram = { data: null, loaded: false, loading: false, busy: false, error: '', message: '', epoch: 0 };
  async function loadAdminStatus() {
    const data = await request('/api/admin/status');
    Object.assign(admin, { known: true, setup: data.setup, signedIn: data.signedIn, resetAvailable: data.resetAvailable });
    if (admin.signedIn) {
      // The admin edits everything, hidden devices included.
      const content = await request('/api/admin/content');
      live.version = content.version;
      setSlugs(content.content.slugs);
      if (app) app.applyPublished(content.content);
    }
  }
  live.adminReady = () => admin.signedIn;
  live.orders = () => clone(admin.orders);
  async function loadOrders({ redraw = true } = {}) {
    const data = await request('/api/admin/orders');
    const changed = JSON.stringify(data.orders) !== JSON.stringify(admin.orders);
    admin.orders = data.orders; admin.loaded = true;
    if (redraw && changed && /^\/admin(\/|$)/.test(route()) && quietAdminView()) app.render();
  }
  // Redraw only on order pages and only while nothing is being typed.
  const quietAdminView = () => /^\/admin(\/orders?.*)?$/.test(route()) && !document.activeElement?.closest?.('form');
  live.updateOrder = (id, status) => {
    const order = admin.orders.find((o) => o.id === id);
    if (!order) return false;
    const previous = order.status;
    order.status = status;
    request(`/api/admin/orders/${encodeURIComponent(id)}`, { method: 'PATCH', body: { status } }).catch((error) => {
      order.status = previous;
      app.toast(error.code === 'signed-out' ? errorText('signed-out') : t('ما انحفظت حالة الطلب. جرّب مرة ثانية.', 'The order status was not saved. Try again.'));
      if (error.code === 'signed-out') admin.signedIn = false;
      app.render();
    });
    return true;
  };
  function startPolling() {
    if (admin.poll) return;
    admin.poll = setInterval(() => {
      if (!/^\/admin(\/|$)/.test(route()) || !admin.signedIn) { clearInterval(admin.poll); admin.poll = null; return; }
      if (document.visibilityState === 'visible') loadOrders().catch(() => {});
    }, 15000);
  }

  // The sign-in card shown instead of the admin until the owner is signed in.
  live.adminGate = () => {
    if (!admin.known) { loadAdminStatus().then(() => app.render()).catch(() => { admin.known = true; app.render(); }); return gateCard(`<p class="live-note">${t('عم نحمّل…', 'Loading…')}</p>`); }
    if (admin.signedIn) return null;
    const switcher = `<button type="button" class="text-button" data-live="lang">${t('English', 'العربية')}</button>`;
    let body;
    if (!admin.setup) {
      body = `<h1>${t('أول دخول للوحة', 'First sign-in')}</h1><p class="live-note">${t('اكتب رمز الإعداد واختار كلمة سر 10 خانات أو أكثر، واحفظها ببرنامج كلمات السر على تلفونك.', 'Enter the setup code and choose a password of 10 characters or more, and save it in your phone’s password manager.')}</p>
        <form data-live-form="admin-setup">${field(t('رمز الإعداد', 'Setup code'), 'code', { type: 'password', auto: 'off' })}${field(t('كلمة السر الجديدة', 'New password'), 'password', { type: 'password', auto: 'new-password', min: 10 })}${field(t('أعد كلمة السر', 'Repeat the password'), 'repeat', { type: 'password', auto: 'new-password', min: 10 })}${alerts(admin)}<button class="button primary full" type="submit">${t('ادخل', 'Sign in')}</button></form>`;
    } else if (admin.view === 'forgot') {
      body = `<h1>${t('نسيت كلمة السر؟', 'Forgot the password?')}</h1><p class="live-note">${t('بنبعت رابط لإيميل المدير المسجّل على السيرفر. الرابط شغّال 30 دقيقة.', 'We send a link to the admin email set on the server. It works for 30 minutes.')}</p>
        <form data-live-form="admin-forgot">${alerts(admin)}<button class="button primary full" type="submit">${t('ابعت الرابط', 'Send the link')}</button><button class="text-button" type="button" data-live="admin-view" data-view="login">${t('رجوع', 'Back')}</button></form>`;
    } else {
      body = `<h1>${t('لوحة الإدارة', 'Admin panel')}</h1>
        <form data-live-form="admin-login">${field(t('كلمة السر', 'Password'), 'password', { type: 'password', auto: 'current-password' })}${alerts(admin)}<button class="button primary full" type="submit">${t('ادخل', 'Sign in')}</button>${admin.resetAvailable ? `<button class="text-button" type="button" data-live="admin-view" data-view="forgot">${t('نسيت كلمة السر؟', 'Forgot the password?')}</button>` : ''}</form>`;
    }
    return gateCard(body + switcher);
  };
  const gateCard = (inner) => `<div class="live-gate" dir="${lang() === 'ar' ? 'rtl' : 'ltr'}"><div class="live-card">${inner}<a class="text-button live-back" href="#/">${t('رجوع للمتجر', 'Back to the store')}</a></div></div>`;

  // After the admin draws a page: sign-out and password buttons, and live orders.
  live.decorateAdmin = (root) => {
    const bottom = root.querySelector('.admin-sidebar-bottom');
    if (bottom && !bottom.querySelector('[data-live="admin-logout"]')) {
      bottom.insertAdjacentHTML('beforeend', `<button type="button" class="admin-nav-link live-admin-button" data-live="admin-password">${t('تغيير كلمة السر', 'Change password')}</button><button type="button" class="admin-nav-link live-admin-button" data-live="admin-logout">${t('تسجيل خروج', 'Sign out')}</button>`);
    }
    decorateProductAddresses(root);
    decorateTelegram(root);
    if (!admin.loaded) loadOrders().catch((error) => { if (error.code === 'signed-out') { admin.signedIn = false; app.render(); } });
    startPolling();
  };

  // ---------- private Telegram connection (live admin only) ----------
  const telegramError = (code) => ({
    'telegram-token': t('توكن البوت غير صحيح. انسخه كاملًا من BotFather.', 'The bot token is invalid. Copy the complete token from BotFather.'),
    'telegram-chat': t('راجع Chat ID وافتح البوت واضغط Start. للمجموعة، أضف البوت أولًا.', 'Check the Chat ID and press Start in your bot. For a group, add the bot first.'),
    'telegram-blocked': t('البوت ممنوع من إرسال الرسائل. اضغط Start أو أعد إضافته للمجموعة.', 'The bot cannot send messages. Press Start or add it to the group again.'),
    'telegram-updates-busy': t('البوت متصل بخدمة أخرى. أدخل Chat ID يدويًا؛ لم نغيّر إعداداته.', 'This bot is connected to another service. Enter the Chat ID manually; its settings have not been changed.'),
    'telegram-rate-limited': t('تلغرام طلب الانتظار. جرّب بعد قليل.', 'Telegram asked us to wait. Try again shortly.'),
    'telegram-unavailable': t('تعذّر الاتصال بتلغرام. الإعدادات والطلبات المحفوظة باقية؛ جرّب مجددًا.', 'Telegram could not be reached. Saved settings and orders are safe; try again.'),
    'telegram-not-configured': t('احفظ الاتصال أولًا، ثم أرسل رسالة تجربة.', 'Save the connection first, then send a test message.'),
    'telegram-conflict': t('تغيّر الاتصال في جلسة أخرى. اضغط تحديث الاتصال قبل التعديل.', 'The connection changed in another session. Refresh it before editing.'),
  })[code] || errorText(code);

  function telegramPanel() {
    if (!telegram.loaded) return `<h2>Telegram · ${t('تنبيهات الطلبات', 'Order alerts')}</h2><p>${t('جارٍ تحميل الاتصال…', 'Loading the connection…')}</p>`;
    if (!telegram.data) return `<h2>Telegram · ${t('تنبيهات الطلبات', 'Order alerts')}</h2><p class="live-alert" role="alert">${esc(telegram.error)}</p><button class="admin-btn" type="button" data-live="telegram-refresh">${t('إعادة المحاولة', 'Try again')}</button>`;
    const d = telegram.data;
    const status = d.configured ? `${d.enabled ? t('مفعّل', 'On') : t('متوقف', 'Off')} · @${esc(d.botUsername)} · <bdi>${esc(d.chatId)}</bdi>` : t('غير متصل بعد', 'Not connected yet');
    const delivery = d.lastResult ? `<p class="admin-field-note">${t('آخر محاولة:', 'Last attempt:')} <bdi>${esc(d.lastAttemptAt ? new Date(d.lastAttemptAt).toLocaleString(lang() === 'ar' ? 'ar-JO' : 'en-GB') : '')}</bdi> · ${d.lastResult === 'sent' ? t('وصلت الرسالة إلى تلغرام ✓', 'Telegram accepted the message ✓') : esc(telegramError(d.lastResult))}</p>` : '';
    return `<h2>Telegram · ${t('تنبيهات الطلبات', 'Order alerts')}</h2>
      <p>${t('أدخل توكن البوت وChat ID هنا. التنبيهات تصل من السيرفر حتى لو لوحة الإدارة مغلقة.', 'Enter the bot token and Chat ID here. Alerts are sent by the server even when the admin panel is closed.')}</p>
      <p class="admin-alert-status" data-on="${d.enabled}">${status}</p>
      <form data-live-telegram-form novalidate><fieldset${telegram.busy ? ' disabled' : ''}>
        <div class="admin-edit-grid">
          <label class="admin-label">${t('توكن البوت', 'Bot token')}<input class="admin-input" name="token" type="password" dir="ltr" autocomplete="off" maxlength="160" placeholder="${d.configured ? t('محفوظ · اتركه فارغًا للإبقاء عليه', 'Saved · leave blank to keep it') : t('من BotFather', 'From BotFather')}"><small class="admin-field-note">${t('BotFather ← /newbot. التوكن يُحفظ على السيرفر فقط، ولا يظهر في التصدير أو المتجر.', 'BotFather → /newbot. The token stays on the server and is excluded from exports and the storefront.')}</small></label>
          <label class="admin-label">Chat ID<input class="admin-input" name="chatId" dir="ltr" inputmode="text" maxlength="17" value="${esc(d.chatId)}"><small class="admin-field-note">${t('افتح البوت واضغط Start، ثم اضغط «اعثر على المحادثة». للمجموعة أضف البوت وأرسل رسالة فيها.', 'Open the bot and press Start, then choose “Find chat”. For a group, add the bot and send a message there.')}</small></label>
        </div>
        <div data-telegram-chats></div>
        <label class="live-telegram-toggle"><input name="enabled" type="checkbox"${!d.configured || d.enabled ? ' checked' : ''}>${t('إرسال تنبيه لكل طلب جديد', 'Send an alert for each new order')}</label>
        <p class="admin-field-note">${t('الرسالة فيها رقم الطلب، الأجهزة والمجموع ورابط الطلب. أرقام العملاء وعناوينهم تبقى داخل اللوحة.', 'Messages include the order number, items, total and order link. Customer phone numbers and addresses stay in admin.')}</p>
        <div class="admin-backup-actions">
          <button class="admin-btn admin-btn-primary" type="submit">${t('حفظ الاتصال', 'Save connection')}</button>
          <button class="admin-btn" type="button" data-live="telegram-chats">${t('اعثر على المحادثة', 'Find chat')}</button>
          ${d.configured ? `<button class="admin-btn" type="button" data-live="telegram-test">${t('إرسال رسالة تجربة', 'Send test message')}</button><button class="admin-btn admin-danger" type="button" data-live="telegram-remove">${t('إزالة الاتصال', 'Remove connection')}</button>` : ''}
          <button class="admin-btn" type="button" data-live="telegram-refresh">${t('تحديث الاتصال', 'Refresh connection')}</button>
        </div>
        <p class="admin-form-feedback${telegram.error ? ' is-error' : ''}" role="status" data-telegram-feedback>${esc(telegram.busy ? t('جارٍ الاتصال…', 'Connecting…') : telegram.error || telegram.message)}</p>
      </fieldset></form>${delivery}`;
  }

  function paintTelegram() {
    const panel = document.querySelector('[data-live-telegram]');
    if (panel) panel.innerHTML = telegramPanel();
  }
  async function loadTelegram() {
    if (telegram.loading || telegram.busy) return;
    telegram.loading = true; telegram.loaded = false; paintTelegram();
    const epoch = telegram.epoch;
    try { const data = await request('/api/admin/telegram', { timeout: 10000 }); if (epoch === telegram.epoch && admin.signedIn) { telegram.data = data; telegram.error = ''; } }
    catch (error) { if (epoch === telegram.epoch && admin.signedIn) { telegram.data = null; telegram.error = telegramError(error.code); } }
    finally { if (epoch === telegram.epoch) { telegram.loading = false; if (admin.signedIn) { telegram.loaded = true; paintTelegram(); } } }
  }
  function decorateTelegram(root) {
    if (route() !== '/admin/settings' || !admin.signedIn) return;
    const main = root.querySelector('.admin-main');
    if (main && !main.querySelector('[data-live-telegram]')) main.insertAdjacentHTML('beforeend', `<section class="admin-panel admin-pad admin-backup live-telegram" data-live-telegram>${telegramPanel()}</section>`);
    if (!telegram.loaded) loadTelegram();
  }
  async function submitTelegram(form, action = 'save') {
    if (telegram.busy || telegram.loading || !form) return;
    telegram.busy = true;
    const epoch = telegram.epoch;
    const token = form.elements.namedItem('token').value.trim();
    const chatId = form.elements.namedItem('chatId').value.trim();
    const enabled = form.elements.namedItem('enabled').checked;
    const controls = [...form.querySelectorAll('input,button,select')];
    const feedback = form.querySelector('[data-telegram-feedback]');
    controls.forEach((control) => { control.disabled = true; });
    feedback.classList.remove('is-error'); feedback.textContent = t('جارٍ الاتصال…', 'Connecting…');
    telegram.error = ''; telegram.message = '';
    try {
      if (action === 'chats') {
        const result = await request('/api/admin/telegram/chats', { method: 'POST', body: token ? { token } : {}, timeout: 15000 });
        if (epoch !== telegram.epoch || !admin.signedIn) return;
        if (!form.isConnected) { telegram.message = t('تغيّرت الصفحة أثناء البحث. أعد البحث عن المحادثة.', 'The page changed during lookup. Find the chat again.'); return; }
        const box = form.querySelector('[data-telegram-chats]');
        box.innerHTML = result.chats.length ? `<label class="admin-label">${t('اختر المحادثة المطلوبة', 'Choose the destination chat')}<select class="admin-input" data-telegram-chat-select><option value="">${t('اختر محادثة', 'Choose a chat')}</option>${result.chats.map((chat) => `<option value="${esc(chat.id)}">${esc(chat.label)} · ${esc(chat.id)}</option>`).join('')}</select></label>` : '';
        if (result.chats.length === 1) { form.elements.namedItem('chatId').value = result.chats[0].id; box.querySelector('select').value = result.chats[0].id; }
        feedback.textContent = result.chats.length ? t('راجع المحادثة ثم احفظ الاتصال.', 'Check the destination, then save the connection.') : t('لم تظهر محادثة. اضغط Start في البوت أو أرسل رسالة جديدة، ثم جرّب مرة أخرى.', 'No chat found. Press Start or send the bot a new message, then try again.');
        return;
      }
      const path = '/api/admin/telegram' + (action === 'test' ? '/test' : '');
      const method = action === 'remove' ? 'DELETE' : action === 'test' ? 'POST' : 'PUT';
      const body = action === 'save' ? { baseVersion: telegram.data.version, token, chatId, enabled } : action === 'remove' ? { baseVersion: telegram.data.version } : {};
      const data = await request(path, { method, body, timeout: 20000 });
      if (epoch !== telegram.epoch || !admin.signedIn) return;
      telegram.data = data;
      telegram.message = action === 'test' ? t('تلغرام استقبل رسالة التجربة. تحقق من المحادثة.', 'Telegram accepted the test message. Check the chat.') : action === 'remove' ? t('أُزيل الاتصال والتوكن المحفوظ.', 'The connection and saved token were removed.') : t('تم حفظ الاتصال.', 'Connection saved.');
      telegram.busy = false; paintTelegram();
    } catch (error) {
      if (epoch !== telegram.epoch || !admin.signedIn) return;
      telegram.error = telegramError(error.code);
      feedback.classList.add('is-error'); feedback.textContent = telegram.error;
      if (error.code === 'signed-out') { admin.signedIn = false; telegram.loaded = false; telegram.data = null; telegram.epoch += 1; telegram.busy = false; telegram.loading = false; app.render(); }
    } finally {
      if (epoch === telegram.epoch) {
        telegram.busy = false; controls.forEach((control) => { control.disabled = false; });
        if (!form.isConnected) paintTelegram();
        document.querySelector('[data-live-telegram] fieldset')?.removeAttribute('disabled');
      }
    }
  }
  document.addEventListener('change', (event) => {
    if (!event.target.matches?.('[data-telegram-chat-select]')) return;
    event.target.closest('form').elements.namedItem('chatId').value = event.target.value;
  });

  // ---------- addresses: real paths for Google ----------
  // English pages sit at /shop, /mac, /devices/<slug>; Arabic ones under /ar. The admin and
  // reset links stay on the home address after a # (a reset token never reaches the server).
  const HASH_ONLY = /^#\/(admin|reset\/|admin-reset\/)/;
  const FIXED = ['shop', 'guide', 'service', 'compare', 'account'];
  const isArPath = (p) => p === '/ar' || p.startsWith('/ar/');
  const decode = (p) => { try { return decodeURIComponent(p); } catch { return p; } };
  let slugMap = {};
  function setSlugs(map) {
    slugMap = {};
    for (const [id, value] of Object.entries(map || {})) slugMap[id] = typeof value === 'string' ? value : value && value.slug;
  }
  const idForSlug = (slug) => Object.keys(slugMap).find((id) => slugMap[id] === slug) || null;
  const savedLang = () => { try { return JSON.parse(localStorage.getItem(live.localKey) || '{}').lang === 'ar' ? 'ar' : 'en'; } catch { return 'en'; } };
  // Admin and reset pages live after the #: "/ar#/…" opens them in Arabic, "/#/…" in the language last used.
  live.pathLang = (fallback) => (isArPath(location.pathname) ? 'ar' : HASH_ONLY.test(location.hash) ? (fallback === 'ar' ? 'ar' : 'en') : 'en');
  live.pathFor = (route, language) => {
    const r = String(route || '/').replace(/^#/, '') || '/';
    if (/^\/(admin|reset\/|admin-reset\/)/.test(r)) return `/#${r}`;
    const parts = r.split('/').filter(Boolean).map(decode);
    let rest = '';
    if (parts[0] === 'product' && parts[1]) rest = `/devices/${encodeURIComponent(slugMap[parts[1]] || parts[1])}`;
    else if (parts[0] === 'shop' && parts[1]) rest = `/${encodeURIComponent(parts[1])}`;
    else if (parts.length) rest = `/${parts.map(encodeURIComponent).join('/')}`;
    return `${language === 'ar' ? '/ar' : ''}${rest}` || '/';
  };
  const knownCategory = (id) => id === 'used-like-new' || !!(window.StoreDemo && window.StoreDemo.getCategories().some((c) => c.id === id));
  live.currentRoute = () => {
    if (HASH_ONLY.test(location.hash)) return location.hash.slice(1);    let p = location.pathname;
    if (isArPath(p)) p = p.slice(3);
    const parts = p.split('/').filter(Boolean).map(decode);
    if (!parts.length) return '/';
    if (parts[0] === 'devices' && parts.length === 2) { const id = idForSlug(parts[1]); return id ? `/product/${id}` : '/not-found'; }
    if (parts.length === 1 && FIXED.includes(parts[0])) return `/${parts[0]}`;
    if (parts.length === 1 && knownCategory(parts[0])) return `/shop/${parts[0]}`;
    return '/not-found';
  };
  live.go = (target) => {
    const url = live.pathFor(String(target).replace(/^#/, ''), app.lang());
    if (url !== location.pathname + location.search + location.hash) history.pushState(null, '', url);
    app.render();
    window.scrollTo(0, 0);
    document.getElementById('main')?.focus({ preventScroll: true });
  };
  live.replace = (target) => history.replaceState(null, '', live.pathFor(String(target).replace(/^#/, ''), app.lang()));
  live.langChanged = (language) => history.replaceState(null, '', live.pathFor(live.currentRoute(), language));
  window.addEventListener('popstate', () => { if (app) { app.render(); window.scrollTo(0, 0); } });

  // Links in the page are written as "#/…"; give them their real address, for Google and for
  // "open in a new tab", and handle the click without reloading the page.
  function rewriteLinks(root) {
    if (!app || !root || !root.querySelectorAll) return;
    const links = root.matches && root.matches('a[href^="#/"]') ? [root] : [];
    links.push(...root.querySelectorAll('a[href^="#/"]'));
    for (const a of links) { const r = a.getAttribute('href').slice(1); a.dataset.liveRoute = r; a.setAttribute('href', live.pathFor(r, app.lang())); }
  }
  live.afterRender = () => {
    rewriteLinks(document.body);
    const skip = document.querySelector('.skip-link');
    if (skip) skip.textContent = t('تجاوز إلى المحتوى', 'Skip to content');
    // A slow final script may still complete after the fallback appeared; let it recover.
    startupState = 'ready';
    clearTimeout(startupTimer);
  };
  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === 'attributes') rewriteLinks(record.target);
      else for (const node of record.addedNodes) if (node.nodeType === 1) rewriteLinks(node);
    }
    // The admin redraws parts of itself after a save; put the live buttons back.
    const shell = document.querySelector('#app .admin-shell');
    if (shell && admin.signedIn && !shell.querySelector('[data-live="admin-logout"]')) live.decorateAdmin(document.getElementById('app'));
    else if (shell && Array.from(shell.querySelectorAll('form[data-admin-product-form]')).some((f) => !f.querySelector('.live-product-address'))) decorateProductAddresses(shell);
  });
  document.addEventListener('click', (event) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const a = event.target.closest && event.target.closest('a[data-live-route]');
    if (!a || (a.target && a.target !== '_self') || a.closest('[data-action]')) return;
    event.preventDefault();
    live.go(a.dataset.liveRoute);
  });
  live.title = (path) => {
    if (path === '/account') return t('حسابي', 'My account');
    if (/^\/(reset|admin-reset)\//.test(path)) return t('كلمة سر جديدة', 'New password');
    const product = path.match(/^\/product\/(.+)$/);
    if (product && window.StoreDemo) { const p = window.StoreDemo.getAllProducts().find((x) => x.id === decode(product[1])); if (p) return `${p.name}${p.chip ? ` ${p.chip}` : ''}`; }
    if (path === '/shop/used-like-new') return t('مستعمل كالجديد', 'Used — like new');
    const category = path.match(/^\/shop\/(.+)$/);
    if (category && window.StoreDemo) { const c = window.StoreDemo.getCategories().find((x) => x.id === decode(category[1])); if (c) return lang() === 'ar' ? c.labelAr : c.labelEn; }
    return null;
  };

  // Each device form in the admin shows the device's public address with a copy button.
  function decorateProductAddresses(root) {
    if (!app) return;
    const products = window.StoreDemo ? window.StoreDemo.getAllProducts() : [];
    root.querySelectorAll('form[data-admin-product-form]').forEach((form) => {
      const p = products.find((x) => x.id === form.dataset.adminProductForm);
      if (!p) return;
      let box = form.querySelector('.live-product-address');
      if (!box) { form.insertAdjacentHTML('afterbegin', '<div class="live-product-address"></div>'); box = form.querySelector('.live-product-address'); }
      const slug = slugMap[p.id];
      if (p.hidden || !slug) { box.innerHTML = `<span>${p.hidden ? t('مخفي: ما إله عنوان عام.', 'Hidden: no public address.') : t('العنوان بيظهر بعد الحفظ.', 'The address appears after saving.')}</span>`; return; }
      const en = `${location.origin}/devices/${slug}`;
      const ar = `${location.origin}/ar/devices/${slug}`;
      box.innerHTML = [[t('العنوان', 'Address'), en], [t('بالعربي', 'Arabic'), ar]].map(([label, url]) => `<div><span>${esc(label)}</span><code dir="ltr">${esc(url)}</code><button type="button" class="admin-btn" data-live="copy" data-url="${esc(url)}">${t('انسخ', 'Copy')}</button></div>`).join('');
    });
  }

  // ---------- storefront: account link, routes ----------
  const personIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>';
  live.headerLink = () => {
    const label = shopper.signedIn ? t('حسابي', 'My account') : t('تسجيل الدخول', 'Sign in');
    return `<a class="icon-button live-account-link${route().startsWith('/account') ? ' active' : ''}" href="#/account" aria-label="${esc(label)}" title="${esc(label)}">${personIcon}</a>`;
  };
  live.menuLink = (arrow) => `<a href="#/account">${shopper.signedIn ? t('حسابي', 'My account') : t('تسجيل الدخول', 'Sign in')}${arrow}</a>`;

  // A reset token is taken out of the address as soon as the page opens, and kept here.
  let pendingReset = null;
  live.route = (path) => {
    if (path === '/account') return accountPage();
    const reset = path.match(/^\/(reset|admin-reset)\/([a-f0-9]{64})?$/);
    if (reset) {
      if (reset[2]) { pendingReset = { kind: reset[1], token: reset[2] }; history.replaceState(null, '', `${isArPath(location.pathname) ? '/ar' : '/'}#/${reset[1]}/`); }
      const token = pendingReset && pendingReset.kind === reset[1] ? pendingReset.token : '';
      return resetPage(reset[1] === 'admin-reset', token);
    }
    return null;
  };

  function field(label, name, { type = 'text', value = '', auto = '', min = 0, max = 200, required = true, dir = '' } = {}) {
    return `<label class="live-field"><span>${esc(label)}</span><input name="${name}" type="${type}" value="${esc(value)}"${auto ? ` autocomplete="${auto}"` : ''}${min ? ` minlength="${min}"` : ''} maxlength="${max}"${required ? ' required' : ''}${dir ? ` dir="${dir}"` : ''}></label>`;
  }
  const alerts = (state) => `${state.error ? `<p class="live-alert" role="alert">${esc(state.error)}</p>` : ''}${state.message ? `<p class="live-success" role="status">${esc(state.message)}</p>` : ''}`;
  const statusName = (s) => ({ new: t('جديد', 'New'), confirmed: t('تأكد', 'Confirmed'), shipped: t('طلع للتوصيل', 'Out for delivery'), delivered: t('انسلّم', 'Delivered'), cancelled: t('ملغي', 'Cancelled') }[s] || s);
  const dateText = (iso) => { const d = new Date(iso); return Number.isNaN(d.getTime()) ? '' : new Intl.DateTimeFormat(lang() === 'ar' ? 'ar-JO' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(d); };

  function accountPage() {
    if (!shopper.checked) { refreshShopper().then(() => app.render()); return `<section class="section-width live-account"><p>${t('عم نحمّل…', 'Loading…')}</p></section>`; }
    const head = `<div class="page-heading"><div class="eyebrow">${t('حسابك', 'YOUR ACCOUNT')}</div><h1>${shopper.signedIn ? t('حسابي', 'My account') : t('تسجيل الدخول', 'Sign in')}</h1></div>`;
    if (!shopper.signedIn) {
      if (shopper.tab === 'forgot') {
        return `<section class="section-width live-account">${head}<div class="live-card"><h2>${t('نسيت كلمة السر؟', 'Forgot your password?')}</h2><p class="live-note">${t('اكتب إيميل حسابك وبنبعتلك رابط لكلمة سر جديدة. الرابط شغّال 30 دقيقة.', 'Enter your account email and we will send a link for a new password. It works for 30 minutes.')}</p>
          <form data-live-form="forgot">${field(t('الإيميل', 'Email'), 'email', { type: 'email', auto: 'email', dir: 'ltr', max: 254 })}${alerts(shopper)}<button class="button primary full" type="submit">${t('ابعت الرابط', 'Send the link')}</button><button class="text-button" type="button" data-live="tab" data-tab="signin">${t('رجوع لتسجيل الدخول', 'Back to sign in')}</button></form></div></section>`;
      }
      const create = shopper.tab === 'create';
      const tabs = `<div class="live-tabs" role="tablist"><button type="button" role="tab" aria-selected="${!create}" data-live="tab" data-tab="signin">${t('تسجيل الدخول', 'Sign in')}</button><button type="button" role="tab" aria-selected="${create}" data-live="tab" data-tab="create">${t('حساب جديد', 'Create account')}</button></div>`;
      const form = create
        ? `<form data-live-form="register">${field(t('الاسم', 'Name'), 'name', { auto: 'name', min: 2, max: 80 })}${field(t('الإيميل', 'Email'), 'email', { type: 'email', auto: 'email', dir: 'ltr', max: 254 })}${field(t('رقم الموبايل (اختياري)', 'Mobile (optional)'), 'phone', { type: 'tel', auto: 'tel', dir: 'ltr', max: 20, required: false })}${field(t('كلمة السر (8 خانات أو أكثر وفيها حرف)', 'Password (8+ characters, with a letter)'), 'password', { type: 'password', auto: 'new-password', min: 8 })}${field(t('أعد كلمة السر', 'Repeat the password'), 'repeat', { type: 'password', auto: 'new-password', min: 8 })}${alerts(shopper)}<button class="button primary full" type="submit">${t('أنشئ الحساب', 'Create account')}</button></form>`
        : `<form data-live-form="login">${field(t('الإيميل', 'Email'), 'email', { type: 'email', auto: 'email', dir: 'ltr', max: 254 })}${field(t('كلمة السر', 'Password'), 'password', { type: 'password', auto: 'current-password' })}${alerts(shopper)}<button class="button primary full" type="submit">${t('ادخل', 'Sign in')}</button>${shopper.resetAvailable ? `<button class="text-button" type="button" data-live="tab" data-tab="forgot">${t('نسيت كلمة السر؟', 'Forgot your password?')}</button>` : ''}</form>`;
      return `<section class="section-width live-account">${head}<div class="live-card">${tabs}${form}<p class="live-note">${t('الحساب بيحفظ طلباتك وبيعبّي اسمك ورقمك عند الطلب. بتقدر تطلب كضيف كمان.', 'An account keeps your orders and fills in your name and number at checkout. You can also order as a guest.')}</p></div></section>`;
    }
    const c = shopper.customer;
    if (shopper.orders === null && !shopper.ordersError) loadMyOrders();
    const orders = shopper.ordersError ? `<p class="live-alert">${errorText('network')}</p>` : shopper.orders === null ? `<p class="live-note">${t('عم نحمّل الطلبات…', 'Loading orders…')}</p>` : shopper.orders.length
      ? `<ul class="live-orders">${shopper.orders.map((o) => `<li><div class="live-order-head"><strong dir="ltr">${esc(o.id)}</strong><span class="live-status s-${esc(o.status)}">${esc(statusName(o.status))}</span></div><p class="live-note">${esc(dateText(o.date))} · ${o.fulfilment === 'pickup' ? t('استلام من المحل', 'Store collection') : t('توصيل', 'Delivery')}</p><ul>${o.items.map((i) => `<li><span dir="ltr">${esc(i.name)}</span> × ${i.quantity}<small dir="ltr">${esc(i.variant)}</small></li>`).join('')}</ul><p class="live-order-total">${t('المجموع', 'Total')}: <strong>${esc(app.money(o.total))}</strong></p></li>`).join('')}</ul>`
      : `<p class="live-note">${t('لسا ما في طلبات على حسابك.', 'No orders on your account yet.')}</p>`;
    return `<section class="section-width live-account">${head}${shopper.lastForm === 'password' ? '' : alerts(shopper)}<div class="live-grid">
      <div class="live-card"><h2>${t('بياناتي', 'My details')}</h2><p class="live-note" dir="ltr">${esc(c.email)}</p><form data-live-form="profile">${field(t('الاسم', 'Name'), 'name', { value: c.name, auto: 'name', min: 2, max: 80 })}${field(t('رقم الموبايل', 'Mobile'), 'phone', { type: 'tel', value: c.phone, auto: 'tel', dir: 'ltr', max: 20, required: false })}<button class="button primary full" type="submit">${t('احفظ', 'Save')}</button></form>
        <details class="live-details"${shopper.lastForm === 'password' ? ' open' : ''}><summary>${t('تغيير كلمة السر', 'Change password')}</summary><form data-live-form="password">${field(t('كلمة السر الحالية', 'Current password'), 'current', { type: 'password', auto: 'current-password' })}${field(t('كلمة السر الجديدة (8 خانات أو أكثر وفيها حرف)', 'New password (8+ characters, with a letter)'), 'password', { type: 'password', auto: 'new-password', min: 8 })}${field(t('أعد كلمة السر', 'Repeat the password'), 'repeat', { type: 'password', auto: 'new-password', min: 8 })}${shopper.lastForm === 'password' ? alerts(shopper) : ''}<button class="button primary full" type="submit">${t('غيّر كلمة السر', 'Change password')}</button></form></details>
        <button class="text-button" type="button" data-live="logout">${t('تسجيل خروج', 'Sign out')}</button></div>
      <div class="live-card"><h2>${t('طلباتي', 'My orders')}</h2>${orders}</div></div></section>`;
  }

  function resetPage(isAdmin, token) {
    const state = isAdmin ? admin : shopper;
    if (!token) return `<section class="section-width live-account"><div class="live-card"><h1>${t('كلمة سر جديدة', 'New password')}</h1><p class="live-alert">${errorText('reset-expired')}</p></div></section>`;
    return `<section class="section-width live-account"><div class="live-card"><h1>${isAdmin ? t('كلمة سر جديدة للوحة', 'New admin password') : t('كلمة سر جديدة', 'New password')}</h1><p class="live-note">${isAdmin ? t('اختار كلمة سر 10 خانات أو أكثر.', 'Choose a password of 10 characters or more.') : t('اختار كلمة سر 8 خانات أو أكثر وفيها حرف واحد على الأقل.', 'Choose a password of 8 characters or more, with at least one letter.')}</p>
      <form data-live-form="${isAdmin ? 'admin-reset' : 'reset'}" data-token="${esc(token)}">${field(t('كلمة السر الجديدة', 'New password'), 'password', { type: 'password', auto: 'new-password', min: isAdmin ? 10 : 8 })}${field(t('أعد كلمة السر', 'Repeat the password'), 'repeat', { type: 'password', auto: 'new-password', min: isAdmin ? 10 : 8 })}${alerts(state)}<button class="button primary full" type="submit">${t('احفظ كلمة السر', 'Save the password')}</button></form></div></section>`;
  }

  async function refreshShopper() {
    try { setShopper(await request('/api/customer/session')); } catch { shopper.checked = true; }
  }
  async function loadMyOrders() {
    try { const data = await request('/api/customer/orders'); shopper.orders = data.orders; shopper.ordersError = false; }
    catch (error) { if (error.code === 'signed-out') setShopper(null); else shopper.ordersError = true; }
    if (route() === '/account') app.render();
  }

  // ---------- checkout ----------
  // Finds a bag line's finish, memory and storage, also for lines saved before choices were kept.
  function resolveChoice(product, item) {
    const c = item.choice;
    const okColor = (i) => Number.isInteger(i) && i >= 0 && i < product.colors.length;
    if (c && okColor(c.color) && (!product.ramOptions || product.ramOptions.includes(c.ram)) && (!product.storageOptions || product.storageOptions.includes(c.storage))) {
      return { color: c.color, ram: product.ramOptions ? c.ram : null, storage: product.storageOptions ? c.storage : null };
    }
    const cfg = window.OneStyleConfig;
    for (const ram of product.ramOptions || [null]) {
      for (const storage of product.storageOptions || [null]) {
        for (let color = 0; color < product.colors.length; color++) {
          const choice = { color, ram, storage };
          if (cfg.configurationText(product, choice) === item.variant) return choice;
        }
      }
    }
    return null;
  }
  // Prices the bag from the published catalog, the way the server does (fils, rounded per unit).
  function priceBag() {
    const cfg = window.OneStyleConfig;
    const { products, bag } = app.state();
    const lines = []; const dropped = []; let changed = false;
    for (const item of bag) {
      const product = products.find((p) => p.id === item.productId && !p.hidden);
      const choice = product && product.availability !== 'unavailable' ? resolveChoice(product, item) : null;
      if (!choice) { dropped.push(item); continue; }
      const unitPrice = cfg.unitPrice(product, choice);
      if (unitPrice !== item.unitPrice) changed = true;
      const variant = cfg.configurationText(product, choice);
      const same = lines.find((l) => l.productId === product.id && l.choice.color === choice.color && l.choice.ram === choice.ram && l.choice.storage === choice.storage);
      if (same) { same.quantity = Math.min(20, same.quantity + item.quantity); changed = true; continue; }
      lines.push({ productId: product.id, name: product.name, variant, color: product.colors[choice.color].hex, choice, unitPrice, quantity: item.quantity });
    }
    if (dropped.length || changed) app.setBag(lines.map((l) => ({ productId: l.productId, variant: l.variant, color: l.color, choice: l.choice, unitPrice: l.unitPrice, quantity: l.quantity })));
    const subtotalFils = lines.reduce((sum, l) => sum + Math.round(l.unitPrice * 1000) * l.quantity, 0);
    return { lines, subtotalFils, dropped: dropped.length, changed };
  }
  const whatsappText = (lines, number) => {
    const rows = lines.map((l) => `- ${l.name} (${l.variant}) × ${l.quantity}`);
    return [t('مرحبا، بدي أطلب:', 'Hello, I would like to order:'), ...rows, number ? `${t('رقم الطلب', 'Order number')}: ${number}` : ''].filter(Boolean).join('\n');
  };
  const whatsappHref = (text) => `https://wa.me/${String(app.state().settings.brand.internationalPhone || '').replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;

  let checkoutToken = '';
  let checkoutStarted = 0;
  live.checkout = () => {
    const cfg = window.OneStyleConfig;
    const { settings } = app.state();
    const priced = priceBag();
    if (!priced.lines.length) { app.openBag(); return; }
    const notice = priced.dropped ? `<p class="live-alert">${t('في جهاز بالسلة ما عاد متوفر وانشال.', 'A device in your bag is no longer available and was removed.')}</p>` : priced.changed ? `<p class="live-alert">${t('تحدّثت أسعار السلة حسب آخر أسعار المحل.', 'Bag prices were updated to the shop’s latest prices.')}</p>` : '';
    if (settings.checkout.ordersOn !== true) {
      app.openModal(`${app.modalHead(t('أكمل الطلب', 'Checkout'))}${notice}<p class="modal-note">${t('الطلب من الموقع متوقف حالياً. ابعتلنا طلبك على واتساب وبنرد عليك.', 'Ordering on the site is paused. Send us your order on WhatsApp and we will reply.')}</p><a class="button primary full" href="${esc(whatsappHref(whatsappText(priced.lines)))}" target="_blank" rel="noopener noreferrer">${t('ابعت الطلب على واتساب', 'Send the order on WhatsApp')}</a><button class="text-button full" type="button" data-action="bag">${t('ارجع للسلة', 'Back to bag')}</button>`, 'drawer');
      return;
    }
    if (!checkoutToken) { checkoutToken = randomToken(); checkoutStarted = Date.now(); }
    const c = shopper.customer || {};
    let draft = {};
    try { draft = JSON.parse(localStorage.getItem('onestyle.live.checkout') || '{}') || {}; } catch { /* none */ }
    const value = (key) => draft[key] || (key === 'name' ? c.name : key === 'phone' ? c.phone : '') || '';
    const pickup = draft.fulfilment === 'pickup';
    const fee = (f, city) => cfg.deliveryFee(settings, f, city);
    const city = draft.city === 'Other' ? 'Other' : 'Amman';
    const shippingFils = Math.round(fee(pickup ? 'pickup' : 'delivery', city) * 1000);
    app.openModal(`${app.modalHead(t('أكمل الطلب', 'Checkout'))}${notice}<p class="modal-note">${t('الدفع عند الاستلام. بنتصل فيك لنأكد الطلب قبل التوصيل.', 'Cash on delivery. We call you to confirm before delivery.')}</p>
      ${shopper.signedIn ? '' : `<p class="modal-note"><a href="#/account" data-live="go-account">${t('سجّل دخول لحفظ الطلب بحسابك', 'Sign in to keep the order in your account')}</a> ${t('أو كمّل كضيف.', 'or continue as a guest.')}</p>`}
      <form id="checkout-form" data-live-form="checkout" novalidate><p class="live-alert" id="live-checkout-alert" role="alert" hidden></p>
      <label>${t('الاسم', 'Name')}<input name="name" required minlength="2" maxlength="80" autocomplete="name" value="${esc(value('name'))}"></label>
      <label>${t('رقم الموبايل', 'Mobile number')}<input name="phone" required maxlength="20" inputmode="tel" autocomplete="tel" dir="ltr" placeholder="07XXXXXXXX" value="${esc(value('phone'))}"></label>
      <div class="checkout-row"><label>${t('طريقة الاستلام', 'Fulfilment')}<select name="fulfilment"><option value="delivery"${pickup ? '' : ' selected'}>${t('توصيل', 'Delivery')}</option><option value="pickup"${pickup ? ' selected' : ''}>${t('استلام من المحل', 'Store collection')}</option></select></label>
      <label>${t('المدينة', 'City')}<select name="city"${pickup ? ' disabled' : ''}><option value="Amman"${city === 'Amman' ? ' selected' : ''}>${t('عمّان', 'Amman')}</option><option value="Other"${city === 'Other' ? ' selected' : ''}>${t('محافظة أخرى', 'Other governorate')}</option></select></label></div>
      <label class="live-address"${pickup ? ' hidden' : ''}>${t('العنوان', 'Address')}<textarea name="address" maxlength="300" rows="2" autocomplete="street-address" placeholder="${t('المنطقة، الشارع، أقرب معلم', 'Area, street, nearest landmark')}">${esc(value('address'))}</textarea></label>
      <label>${t('ملاحظات (اختياري)', 'Notes (optional)')}<textarea name="notes" maxlength="300" rows="2"></textarea></label>
      <label class="live-hp" aria-hidden="true">Website<input name="website" tabindex="-1" autocomplete="off"></label>
      <div class="checkout-totals"><div><span>${t('المجموع الفرعي', 'Subtotal')}</span><strong>${app.money(priced.subtotalFils / 1000)}</strong></div><div><span>${t('التوصيل', 'Delivery')}</span><strong id="live-shipping">${app.shipLabel(shippingFils / 1000)}</strong></div><div class="grand-total"><span>${t('الإجمالي', 'Total')}</span><strong id="live-total">${app.money((priced.subtotalFils + shippingFils) / 1000)}</strong></div></div>
      <p class="modal-note">${t('بنستعمل اسمك ورقمك وعنوانك بس لتأكيد الطلب وتوصيله.', 'We use your name, number and address only to confirm and deliver your order.')}</p>
      <button class="button primary full" type="submit">${t('أرسل الطلب', 'Place order')}</button><button class="text-button full" type="button" data-action="bag">${t('ارجع للسلة', 'Back to bag')}</button></form>`, 'drawer');
    const form = document.getElementById('checkout-form');
    const update = () => {
      const f = form.fulfilment.value; const ct = form.city.value;
      form.city.disabled = f === 'pickup';
      form.querySelector('.live-address').hidden = f === 'pickup';
      const ship = Math.round(fee(f, ct) * 1000);
      document.getElementById('live-shipping').textContent = app.shipLabel(ship / 1000);
      document.getElementById('live-total').textContent = app.money((priced.subtotalFils + ship) / 1000);
    };
    form.addEventListener('change', update);
    form.phone.addEventListener('input', () => { const v = form.phone.value.replace(/[٠-٩]/g, (d) => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d)); if (v !== form.phone.value) form.phone.value = v; });
  };

  async function submitCheckout(form) {
    const cfg = window.OneStyleConfig;
    const alertBox = document.getElementById('live-checkout-alert');
    const show = (code) => { alertBox.textContent = errorText(code); alertBox.hidden = false; alertBox.scrollIntoView({ block: 'nearest' }); };
    const data = Object.fromEntries(new FormData(form).entries());
    const fulfilment = form.fulfilment.value === 'pickup' ? 'pickup' : 'delivery';
    const city = form.city.value === 'Other' ? 'Other' : 'Amman';
    const draft = { name: String(data.name || '').trim(), phone: String(data.phone || '').trim(), fulfilment, city, address: String(data.address || '').trim() };
    try { localStorage.setItem('onestyle.live.checkout', JSON.stringify(draft)); } catch { /* private mode */ }
    if (Array.from(draft.name).length < 2) return show('bad-name');
    if (!/^(\+?962|0)?7[789]\d{7}$/.test(draft.phone.replace(/[\s()-]/g, '').replace(/^00/, '+'))) return show('bad-phone');
    if (fulfilment === 'delivery' && draft.address.length < 4) return show('bad-address');
    const priced = priceBag();
    if (!priced.lines.length) { app.closeModal(); app.openBag(); return; }
    const shippingFils = Math.round(cfg.deliveryFee(app.state().settings, fulfilment, city) * 1000);
    const button = form.querySelector('[type=submit]');
    button.disabled = true; button.textContent = t('عم نرسل…', 'Sending…');
    try {
      const result = await request('/api/order', { method: 'POST', body: {
        token: checkoutToken, website: String(data.website || ''), elapsedMs: Date.now() - checkoutStarted, lang: lang(), fulfilment,
        customer: { name: draft.name, phone: draft.phone, city: fulfilment === 'delivery' ? city : '', address: fulfilment === 'delivery' ? draft.address : '', notes: String(data.notes || '').trim() },
        lines: priced.lines.map((l) => ({ productId: l.productId, color: l.choice.color, ram: l.choice.ram, storage: l.choice.storage, quantity: l.quantity })),
        totalFils: priced.subtotalFils + shippingFils,
      } });
      checkoutToken = '';
      app.setBag([]);
      if (shopper.signedIn) shopper.orders = null;
      app.openModal(`${app.modalHead(t('وصلنا طلبك', 'We got your order'))}<div class="order-success"><h3>${t('شكراً! رقم طلبك:', 'Thank you! Your order number:')}</h3><code dir="ltr">${esc(result.number)}</code><p>${t('بنتصل فيك قريباً لنأكد الطلب والتوصيل. الدفع عند الاستلام.', 'We will call you soon to confirm the order and delivery. Payment is cash on delivery.')}</p><p><strong>${t('الإجمالي', 'Total')}: ${app.money(result.total)}</strong></p><a class="button primary full" href="${esc(whatsappHref(whatsappText(priced.lines, result.number)))}" target="_blank" rel="noopener noreferrer">${t('ابعت رقم الطلب على واتساب', 'Send the order number on WhatsApp')}</a>${shopper.signedIn ? `<a class="text-button full" href="#/account">${t('شوف طلباتي', 'View my orders')}</a>` : ''}<button class="text-button full" type="button" data-action="close-modal">${t('كمّل تصفّح', 'Continue browsing')}</button></div>`, 'drawer');
    } catch (error) {
      if (['price-changed', 'sold-out', 'unknown'].includes(error.code)) {
        await refreshContent();
        priceBag();
      }
      if (error.code === 'orders-off') await refreshContent();
      button.disabled = false; button.textContent = t('أرسل الطلب', 'Place order');
      show(error.code);
    }
  }

  // ---------- events ----------
  async function submitForm(form) {
    const kind = form.dataset.liveForm;
    const v = (name) => (form.elements.namedItem(name)?.value ?? '');
    const button = form.querySelector('[type=submit]');
    const state = kind.startsWith('admin') ? admin : shopper;
    state.error = ''; state.message = ''; state.lastForm = kind;
    // After an error the page is drawn again: keep what was typed (never passwords) and show the message.
    const typed = [...form.elements].filter((el) => el.name && 'value' in el && !/^(password|submit|button|hidden|file)$/.test(el.type)).map((el) => [el.name, el.value]);
    const redraw = () => {
      app.render();
      const next = document.querySelector(`form[data-live-form="${kind}"]`);
      if (!state.error) { const done = next && next.querySelector('.live-success'); if (done) done.scrollIntoView({ block: 'center' }); return; }
      if (!next) return;
      for (const [name, value] of typed) { const el = next.elements.namedItem(name); if (el && 'value' in el && !el.value) el.value = value; }
      const box = next.querySelector('.live-alert') || document.querySelector('.live-alert');
      if (box) box.scrollIntoView({ block: 'nearest' });
      const first = next.querySelector('input[type=password]'); if (first) first.focus({ preventScroll: true });
    };
    const repeatOk = () => { if (form.elements.namedItem('repeat') && v('repeat') !== v('password')) { state.error = errorText('mismatch'); redraw(); return false; } return true; };
    if (button) button.disabled = true;
    try {
      if (kind === 'checkout') { if (button) button.disabled = false; return submitCheckout(form); }
      if (kind === 'login') { setShopper({ ...(await request('/api/customer/login', { method: 'POST', body: { email: v('email'), password: v('password') } })), signedIn: true, resetAvailable: shopper.resetAvailable }); shopper.orders = null; }
      else if (kind === 'register') { if (!repeatOk()) return; const res = await request('/api/customer/register', { method: 'POST', body: { name: v('name'), email: v('email'), phone: v('phone'), password: v('password') } }); setShopper({ signedIn: true, customer: res.customer, resetAvailable: shopper.resetAvailable }); shopper.orders = []; }
      else if (kind === 'profile') { const res = await request('/api/customer/profile', { method: 'PATCH', body: { name: v('name'), phone: v('phone') } }); shopper.customer = res.customer; shopper.message = t('انحفظت بياناتك.', 'Your details were saved.'); }
      else if (kind === 'password') { if (!repeatOk()) return; await request('/api/customer/password', { method: 'POST', body: { current: v('current'), password: v('password') } }); shopper.message = t('تغيّرت كلمة السر. الأجهزة الثانية طلعت من حسابك.', 'Password changed. Other devices were signed out.'); }
      else if (kind === 'forgot') { await request('/api/customer/forgot', { method: 'POST', body: { email: v('email'), lang: lang() } }); shopper.message = t('إذا الإيميل إله حساب، وصلك رابط خلال دقائق. شيك على البريد غير المرغوب كمان.', 'If the email has an account, a link is on its way. Check your spam folder too.'); }
      else if (kind === 'reset') { if (!repeatOk()) return; const res = await request('/api/customer/reset', { method: 'POST', body: { token: form.dataset.token, password: v('password') } }); setShopper({ signedIn: true, customer: res.customer, resetAvailable: shopper.resetAvailable }); shopper.orders = null; shopper.message = t('تغيّرت كلمة السر، وانت داخل على حسابك.', 'Your password was changed and you are signed in.'); pendingReset = null; history.replaceState(null, '', live.pathFor('/account', lang())); }
      else if (kind === 'admin-setup') { if (!repeatOk()) return; await request('/api/admin/setup', { method: 'POST', body: { code: v('code'), password: v('password') } }); await loadAdminStatus(); }
      else if (kind === 'admin-login') { await request('/api/admin/login', { method: 'POST', body: { password: v('password') } }); await loadAdminStatus(); }
      else if (kind === 'admin-forgot') { await request('/api/admin/forgot', { method: 'POST', body: {} }); admin.message = t('إذا كان إيميل المدير مضبوط، وصل الرابط خلال دقائق.', 'If the admin email is set, the link is on its way.'); }
      else if (kind === 'admin-reset') { if (!repeatOk()) return; await request('/api/admin/reset', { method: 'POST', body: { token: form.dataset.token, password: v('password') } }); pendingReset = null; history.replaceState(null, '', '/#/admin'); await loadAdminStatus(); }
      else if (kind === 'admin-password') {
        if (!repeatOk()) return;
        await request('/api/admin/password', { method: 'POST', body: { current: v('current'), password: v('password') } });
        app.closeModal(); app.toast(t('تغيّرت كلمة السر. الأجهزة الثانية طلعت من اللوحة.', 'Password changed. Other devices were signed out of the admin.'));
        return;
      }
    } catch (error) {
      state.error = errorText(error.code);
      if (kind === 'admin-password') { const box = form.querySelector('.live-alert'); if (box) { box.textContent = state.error; box.hidden = false; } return; }
    } finally { if (button && button.isConnected) button.disabled = false; }
    redraw();
  }

  document.addEventListener('submit', (event) => {
    if (event.target.matches?.('form[data-live-telegram-form]')) { event.preventDefault(); submitTelegram(event.target); return; }
    const form = event.target.closest && event.target.closest('form[data-live-form]');
    if (!form) return;
    event.preventDefault();
    submitForm(form);
  });
  document.addEventListener('click', async (event) => {
    const el = event.target.closest && event.target.closest('[data-live]');
    if (!el) return;
    const action = el.dataset.live;
    if (action === 'telegram-refresh') { telegram.loaded = false; telegram.message = ''; loadTelegram(); }
    else if (['telegram-chats', 'telegram-test', 'telegram-remove'].includes(action)) { submitTelegram(el.closest('form'), action.slice('telegram-'.length)); }
    else if (action === 'tab') { shopper.tab = el.dataset.tab; shopper.error = ''; shopper.message = ''; app.render(); }
    else if (action === 'lang') { app.toggleLang(); }
    else if (action === 'admin-view') { admin.view = el.dataset.view; admin.error = ''; admin.message = ''; app.render(); }
    else if (action === 'logout') {
      await request('/api/customer/logout', { method: 'POST', body: {} }).catch(() => {});
      setShopper({ signedIn: false, resetAvailable: shopper.resetAvailable }); shopper.message = ''; app.render();
    } else if (action === 'admin-logout') {
      await request('/api/admin/logout', { method: 'POST', body: {} }).catch(() => {});
      Object.assign(admin, { signedIn: false, orders: [], loaded: false, view: 'login', error: '', message: '' });
      Object.assign(telegram, { data: null, loaded: false, loading: false, busy: false, error: '', message: '', epoch: telegram.epoch + 1 }); app.render();
    } else if (action === 'admin-password') {
      app.openModal(`${app.modalHead(t('تغيير كلمة السر', 'Change password'))}<form data-live-form="admin-password"><p class="live-alert" role="alert" hidden></p><label>${t('كلمة السر الحالية', 'Current password')}<input name="current" type="password" autocomplete="current-password" required></label><label>${t('كلمة السر الجديدة (10 خانات أو أكثر)', 'New password (10+ characters)')}<input name="password" type="password" autocomplete="new-password" minlength="10" required></label><label>${t('أعد كلمة السر', 'Repeat the password')}<input name="repeat" type="password" autocomplete="new-password" minlength="10" required></label><button class="button primary full" type="submit">${t('غيّر كلمة السر', 'Change password')}</button></form>`);
    } else if (action === 'go-account') { app.closeModal(); }
    else if (action === 'copy') {
      try { await navigator.clipboard.writeText(el.dataset.url); app.toast(t('انسخ العنوان.', 'Address copied.')); }
      catch { window.prompt(t('انسخ العنوان:', 'Copy the address:'), el.dataset.url); }
    }
  });

})();
