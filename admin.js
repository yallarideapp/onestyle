(function () {
  'use strict';

  const boundRoots = new WeakSet();
  const icons = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    box: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
    arrow: '<path d="m14 5-7 7 7 7M7 12h13"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    trend: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    external: '<path d="M15 3h6v6M21 3l-9 9M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.grid) + '</svg>'; }
  function api() { return window.StoreDemo || {}; }
  function english() { const v = api().lang; return (typeof v === 'function' ? v() : v) === 'en'; }
  function t(ar, en) { return english() ? en : ar; }
  function esc(value) { return String(value == null ? '' : value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
  function money(n) { return typeof api().formatMoney === 'function' ? esc(api().formatMoney(Number(n) || 0)) : esc((Number(n) || 0).toFixed(2)) + ' ' + t('د.أ', 'JOD'); }
  function products() { return typeof api().getAllProducts === 'function' ? api().getAllProducts() : typeof api().getProducts === 'function' ? api().getProducts() : []; }
  function orders() { return typeof api().getOrders === 'function' ? api().getOrders() : []; }
  function dateLabel(value) { const d = new Date(value); return Number.isNaN(d.getTime()) ? esc(value || '—') : esc(new Intl.DateTimeFormat(english() ? 'en-GB' : 'ar-JO', {day:'numeric',month:'short'}).format(d)); }
  const statuses = ['new', 'confirmed', 'shipped', 'delivered', 'cancelled'];
  function normalizedStatus(status) { return status === 'pending' ? 'new' : status === 'processing' ? 'confirmed' : status === 'completed' ? 'delivered' : status || 'new'; }
  function newestOrders(list) { return list.slice().sort((a,b) => (new Date(b.date).getTime() || 0) - (new Date(a.date).getTime() || 0)); }
  function statusText(status) {
    return ({new:t('جديد','New'),confirmed:t('مؤكد','Confirmed'),shipped:t('قيد التوصيل','Shipped'),delivered:t('مكتمل','Delivered'),cancelled:t('ملغى','Cancelled')})[normalizedStatus(status)] || esc(status);
  }
  function statusBadge(status) { const key = normalizedStatus(status); return '<span class="admin-status admin-status-' + (statuses.includes(key) ? key : 'new') + '"><i></i>' + statusText(status) + '</span>'; }
  function currentView(view) {
    const hash = (window.location.hash || '').replace(/^#\/?admin\/?/, '');
    if (view && view !== 'overview') return view.replace(/^\/?admin\/?/, '');
    return /^(orders|products|content|appearance|settings|order[/:])/.test(hash) ? hash : 'overview';
  }
  function orderRows(list) {
    if (!list.length) return '<div class="admin-empty">' + icon('bag') + '<h3>' + t('لا توجد طلبات بعد','No orders yet') + '</h3><p>' + t('جرّب إضافة جهاز إلى السلة وإرسال طلب تجريبي.','Add a device to the bag and place a demo order.') + '</p><a class="admin-btn admin-btn-primary" href="#/">' + t('افتح المتجر','Open the store') + '</a></div>';
    return '<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>' + t('الطلب','Order') + '</th><th>' + t('العميل','Customer') + '</th><th>' + t('الحالة','Status') + '</th><th>' + t('الإجمالي','Total') + '</th><th>' + t('التفاصيل','Details') + '</th></tr></thead><tbody>' + list.map(o => '<tr><td><a class="admin-order-id" href="#/admin/order/' + encodeURIComponent(o.id) + '">' + esc(o.id) + '</a><small>' + dateLabel(o.date) + '</small></td><td><strong>' + esc(o.customer && o.customer.name || t('عميل تجريبي','Demo customer')) + '</strong><small>' + esc(o.customer && o.customer.city || '—') + '</small></td><td>' + statusBadge(o.status) + '</td><td class="admin-nowrap">' + money(o.total) + '</td><td><a class="admin-row-link" href="#/admin/order/' + encodeURIComponent(o.id) + '" aria-label="' + esc(t('تفاصيل الطلب ','Order details ') + o.id) + '">' + t('عرض','View') + icon('arrow') + '</a></td></tr>').join('') + '</tbody></table></div>';
  }
  function overview() {
    const all = orders(), active = all.filter(o => !['delivered','cancelled'].includes(normalizedStatus(o.status))), complete = all.filter(o => normalizedStatus(o.status) === 'delivered');
    const sum = all.filter(o => normalizedStatus(o.status) !== 'cancelled').reduce((n,o) => n + (Number(o.total) || 0), 0);
    const cards = [
      ['bag',t('الطلبات التجريبية','Demo orders'), String(all.length), t('بيانات محفوظة على هذا المتصفح','Saved on this browser')],
      ['clock',t('طلبات قيد المتابعة','Orders to follow up'),String(active.length),t('تحتاج تأكيدًا أو توصيلًا','Awaiting confirmation or delivery')],
      ['trend',t('قيمة الطلبات التجريبية','Demo order value'),money(sum),t('لا تمثل مبيعات فعلية','Does not represent real sales')],
      ['box',t('الأجهزة المعروضة','Catalog devices'),String(products().length),t('كتالوج المعاينة','Preview catalog')]
    ];
    return '<div class="admin-heading"><div><p class="admin-eyebrow">' + t('ONE STYLE · نظرة عامة','ONE STYLE · OVERVIEW') + '</p><h1>' + t('كل شيء تحت نظرك.','Everything, in view.') + '</h1><p>' + t('معاينة إدارة المتجر والطلبات من مكان واحد.','A preview of your store and orders, in one place.') + '</p></div><a class="admin-btn" href="#/admin/products">' + icon('box') + t('إدارة الأجهزة','Manage devices') + '</a></div><div class="admin-stats">' + cards.map(c => '<article class="admin-stat"><span class="admin-stat-icon">' + icon(c[0]) + '</span><p>' + c[1] + '</p><strong>' + c[2] + '</strong><small>' + c[3] + '</small></article>').join('') + '</div><section class="admin-panel"><div class="admin-panel-heading"><div><h2>' + t('آخر الطلبات','Recent orders') + '</h2><p>' + t('طلبات توضيحية وتجاربك على هذه النسخة.','Sample orders and orders you place in this preview.') + '</p></div><a class="admin-row-link" href="#/admin/orders">' + t('كل الطلبات','All orders') + icon('arrow') + '</a></div>' + orderRows(newestOrders(all).slice(0,5)) + '</section><div class="admin-bottom-note">' + icon('check') + '<p>' + t('تعديلات الأسعار وحالات الطلبات تُحفظ محليًا. الربط بقاعدة البيانات والدفع الإلكتروني يُجهّز عند تشغيل المتجر الفعلي.','Price and order status changes are saved locally. Database and payment integration are prepared for the live store.') + '</p></div>';
  }
  function ordersView() { return '<div class="admin-heading"><div><p class="admin-eyebrow">' + t('إدارة المتجر','STORE MANAGEMENT') + '</p><h1>' + t('الطلبات','Orders') + '</h1><p>' + t('افتح أي طلب لمراجعة الأجهزة وبيانات التوصيل.','Open an order to review devices and delivery details.') + '</p></div><span class="admin-count">' + orders().length + ' ' + t('طلب تجريبي','demo orders') + '</span></div><section class="admin-panel">' + orderRows(newestOrders(orders())) + '</section>'; }
  function orderDetail(id) {
    const order = orders().find(o => String(o.id) === String(id));
    if (!order) return '<div class="admin-empty">' + icon('bag') + '<h1>' + t('الطلب غير موجود','Order not found') + '</h1><a class="admin-btn" href="#/admin/orders">' + t('العودة للطلبات','Back to orders') + '</a></div>';
    const customer = order.customer || {}, items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((n,item) => n + (Number(item.quantity)||0) * (Number(item.unitPrice)||0),0);
    return '<a class="admin-back" href="#/admin/orders">' + icon('arrow') + t('العودة للطلبات','Back to orders') + '</a><div class="admin-heading"><div><p class="admin-eyebrow">' + t('طلب تجريبي · ','DEMO ORDER · ') + dateLabel(order.date) + '</p><h1 class="admin-order-title">' + esc(order.id) + '</h1></div>' + statusBadge(order.status) + '</div><div class="admin-detail-grid"><section class="admin-panel"><div class="admin-panel-heading"><h2>' + t('الأجهزة المطلوبة','Ordered devices') + '</h2></div><div class="admin-order-items">' + items.map(item => '<article class="admin-order-item"><span class="admin-item-icon">' + icon('box') + '</span><div><h3>' + esc(item.name) + '</h3><p>' + esc(typeof item.variant === 'object' && item.variant ? Object.values(item.variant).filter(Boolean).join(' · ') : item.variant || t('المواصفات المختارة','Selected configuration')) + '</p><small>' + t('الكمية: ','Quantity: ') + esc(item.quantity) + ' · ' + money(item.unitPrice) + '</small></div><strong>' + money((Number(item.quantity)||0) * (Number(item.unitPrice)||0)) + '</strong></article>').join('') + '</div><dl class="admin-totals"><div><dt>' + t('قيمة الأجهزة','Devices subtotal') + '</dt><dd>' + money(subtotal) + '</dd></div><div><dt>' + t('التوصيل','Delivery') + '</dt><dd>' + money(Math.max(0,(Number(order.total)||0)-subtotal)) + '</dd></div><div class="admin-total"><dt>' + t('الإجمالي','Total') + '</dt><dd>' + money(order.total) + '</dd></div></dl></section><div class="admin-detail-side"><section class="admin-panel admin-pad"><h2>' + t('بيانات التوصيل','Delivery details') + '</h2><dl class="admin-customer"><div><dt>' + t('الاسم','Name') + '</dt><dd>' + esc(customer.name || '—') + '</dd></div><div><dt>' + t('الهاتف','Phone') + '</dt><dd dir="ltr">' + esc(customer.phone || '—') + '</dd></div><div><dt>' + t('المدينة','City') + '</dt><dd>' + esc(customer.city || '—') + '</dd></div><div><dt>' + t('العنوان','Address') + '</dt><dd>' + esc(customer.address || '—') + '</dd></div></dl></section><section class="admin-panel admin-pad"><h2>' + t('حالة الطلب','Order status') + '</h2><form data-admin-order-form="' + esc(order.id) + '"><label class="admin-label" for="admin-status-select">' + t('تحديث الحالة التجريبية','Update demo status') + '</label><select class="admin-input" id="admin-status-select" name="status">' + statuses.map(s => '<option value="' + s + '"' + (normalizedStatus(order.status) === s ? ' selected' : '') + '>' + statusText(s) + '</option>').join('') + '</select><button type="submit" class="admin-btn admin-btn-primary admin-full">' + icon('check') + t('حفظ الحالة','Save status') + '</button><p class="admin-field-note">' + t('هذا التغيير محلي، ولا يرسل إشعارًا إلى عميل.','This is a local change. No customer notification is sent.') + '</p><p class="admin-form-feedback" role="status"></p></form></section></div></div>';
  }
  function productArt(product) {
    if (product.image) return '<img src="' + esc(product.image) + '" alt="" loading="lazy">';
    const fallback=typeof api().getProductImage==='function'?api().getProductImage(product):'';if(fallback)return '<img src="'+esc(fallback)+'" alt="" loading="lazy">';

    return icon('box');
  }
  function availabilityValue(p) { return ['demo','available','unavailable','on-order'].includes(p.availability) ? p.availability : 'demo'; }
  function settings() { return typeof api().getSettings === 'function' ? api().getSettings() : {}; }
  function field(label, name, value, options) {
    const o = options || {}, attrs = ' name="' + esc(name) + '"' + (o.dir ? ' dir="' + esc(o.dir) + '"' : ' dir="auto"') + (o.required ? ' required' : '') + (o.maxLength ? ' maxlength="' + o.maxLength + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.step ? ' step="' + o.step + '"' : '');
    return '<label class="admin-label admin-edit-field' + (o.wide ? ' admin-field-wide' : '') + '"><span>' + esc(label) + '</span>' + (o.textarea ? '<textarea class="admin-input admin-textarea" rows="3"' + attrs + '>' + esc(value) + '</textarea>' : '<input class="admin-input" type="' + (o.type || 'text') + '"' + attrs + ' value="' + esc(value) + '">') + (o.note ? '<small class="admin-field-note">' + esc(o.note) + '</small>' : '') + '</label>';
  }
  function bilingualFields(group, name, label, textarea) {
    return field(label + ' · العربية', name + 'Ar', group[name + 'Ar'], {textarea:!!textarea,dir:'rtl',maxLength:textarea ? 1600 : 200}) + field(label + ' · English', name + 'En', group[name + 'En'], {textarea:!!textarea,dir:'ltr',maxLength:textarea ? 1600 : 200});
  }
  function safeImage(value) {
    const v = String(value || '').trim();
    if (!v) return true;
    if (/^data:image\/(?:png|jpeg|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(v)) return true;
    if (/^https?:\/\//i.test(v)) { try { return ['http:','https:'].includes(new URL(v).protocol); } catch (_) { return false; } }
    return /^(?:\.\/)?assets\/[\w./% -]+$/i.test(v) && !v.includes('..');
  }
  function imageField(label, name, value) {
    const image = safeImage(value) && value ? '<img src="' + esc(value) + '" alt="' + esc(label) + '" loading="lazy">' : '<span>' + icon('box') + '</span>';
    return '<div class="admin-media-field admin-field-wide"><div class="admin-media-preview" data-admin-media-preview>' + image + '</div><div class="admin-media-controls">' + field(label + ' · ' + t('رابط الصورة','Image URL'),name,value,{dir:'ltr',maxLength:2200000,note:t('رابط https أو مسار assets/. يمكنك رفع PNG أو JPG أو WebP أدناه.','Use an https URL or assets/ path. Alternatively upload PNG, JPG or WebP below.')}) + '<label class="admin-upload-label">' + t('رفع صورة · حتى 1.5 MB','Upload image · up to 1.5 MB') + '<input class="admin-file-input" type="file" accept="image/png,image/jpeg,image/webp" data-admin-image-upload="' + esc(name) + '"></label><button type="button" class="admin-text-button" data-admin-image-clear="' + esc(name) + '">' + t('مسح الاختيار','Clear selection') + '</button><p class="admin-upload-feedback" role="status"></p></div></div>';
  }
  function saveFooter() { return '<div class="admin-edit-actions"><p>' + t('الحفظ يحدّث المعاينة على هذا المتصفح فقط.','Saving updates the preview on this browser only.') + '</p><button type="submit" class="admin-btn admin-btn-primary">' + icon('check') + t('حفظ التعديلات','Save changes') + '</button></div><p class="admin-form-feedback" role="status"></p>'; }
  function editPanel(title, description, scope, body, expanded) {
    return '<details class="admin-edit-panel"' + (expanded ? ' open' : '') + '><summary><span><strong>' + esc(title) + '</strong><small>' + esc(description) + '</small></span><span class="admin-expand">+</span></summary><form data-admin-settings-form="' + esc(scope) + '"><div class="admin-edit-grid">' + body + '</div>' + saveFooter() + '</form></details>';
  }
  function editHeading(title, description) { return '<div class="admin-heading"><div><p class="admin-eyebrow">' + t('تخصيص المتجر','STORE CUSTOMIZATION') + '</p><h1>' + esc(title) + '</h1><p>' + esc(description) + '</p></div><a href="#/" class="admin-btn">' + icon('external') + t('عرض المتجر','View store') + '</a></div><p class="admin-custom-note">' + t('التعديلات محلية في هذه المعاينة. صدّر ملف التخصيص للاحتفاظ بنسخة ونقله إلى متصفح آخر.','Changes are local to this preview. Export a customization file to keep a copy or move it to another browser.') + '</p>'; }
  function contentView() {
    const s=settings(), h=s.hero||{}, home=s.home||{}, guide=s.guide||{}, pages=s.pageTitles||{}, visibility=s.sections||{}, nav=s.nav||{}, footer=s.footer||{};
    const hero = ['eyebrow','title','highlight','description','primary','secondary'].map((name,i) => bilingualFields(h,name,[t('السطر فوق العنوان','Eyebrow'),t('العنوان الرئيسي','Main title'),t('النص البارز','Highlighted text'),t('وصف المقدمة','Hero description'),t('الزر الرئيسي','Primary button'),t('الزر الثاني','Secondary button')][i],name==='description')).join('');
    const homeFields = ['featuredTitle','categoriesTitle','guideTitle','guideDescription','supportTitle','supportDescription'].map((name,i) => bilingualFields(home,name,[t('عنوان الأجهزة المختارة','Featured devices title'),t('عنوان الفئات','Categories title'),t('عنوان مساعدة الاختيار','Home guide title'),t('وصف مساعدة الاختيار','Home guide description'),t('عنوان الصيانة','Support title'),t('وصف الصيانة','Support description')][i],name.includes('Description'))).join('');
    const featured = '<fieldset class="admin-check-grid admin-field-wide"><legend>' + t('الأجهزة المختارة في الرئيسية','Featured devices on the home page') + '</legend>' + products().map(p => '<label class="admin-checkbox"><input type="checkbox" name="featuredIds" value="' + esc(p.id) + '"' + ((home.featuredIds||[]).includes(p.id) ? ' checked' : '') + '><span>' + esc(p.name) + (p.hidden ? '<small>' + t('مخفي في المتجر','Hidden in store') + '</small>' : '') + '</span></label>').join('') + '</fieldset>';
    const sectionNames = [['hero',t('المقدمة','Hero')],['categories',t('الفئات','Categories')],['featured',t('الأجهزة المختارة','Featured devices')],['guide',t('مساعدة الاختيار','Selection guide')],['support',t('الصيانة والتواصل','Support & contact')]];
    return editHeading(t('نصوص الموقع','Site content'),t('عدّل العناوين والأزرار والأقسام باللغتين.','Edit headings, buttons and sections in both languages.')) + editPanel(t('المقدمة الرئيسية','Home hero'),t('العنوان والوصف وأسماء الأزرار','Title, description and button labels'),'hero',hero,true) + editPanel(t('أقسام الرئيسية','Home sections'),t('عناوين الأقسام والأجهزة التي تظهر أولًا','Section headings and featured devices'),'home',homeFields+featured,false) + editPanel(t('إظهار الأقسام','Section visibility'),t('اختر ما يظهر في الصفحة الرئيسية','Choose what appears on the home page'),'sections',sectionNames.map(n => '<label class="admin-checkbox admin-switch"><input type="checkbox" name="' + n[0] + '"' + (visibility[n[0]]!==false ? ' checked' : '') + '><span>' + n[1] + '</span></label>').join(''),false) + editPanel(t('مساعدة اختيار الماك','Mac selection guide'),t('عنوان صفحة الدليل ووصفها','Guide page title and description'),'guide',bilingualFields(guide,'title',t('العنوان','Title'))+bilingualFields(guide,'description',t('الوصف','Description'),true),false) + editPanel(t('القوائم والشريط السفلي','Menus & bottom bar'),t('أسماء الروابط في قوائم التصفح','Navigation link labels'),'nav',['home','shop','guide','service','bag'].map((name,i) => bilingualFields(nav,name,[t('الرئيسية','Home'),t('الأجهزة','Shop'),t('الدليل','Guide'),t('الصيانة','Service'),t('السلة','Bag')][i])).join(''),false) + editPanel(t('نص أسفل الموقع','Footer content'),t('وصف المحل في تذييل الصفحات','Store description in the footer'),'footer',bilingualFields(footer,'description',t('الوصف','Description'),true),false) + editPanel(t('عناوين المتصفح','Browser tab titles'),t('العناوين التي تظهر في تبويب المتصفح','Titles displayed in the browser tab'),'pageTitles',['home','shop','guide'].map((name,i) => bilingualFields(pages,name,[t('الرئيسية','Home'),t('الأجهزة','Shop'),t('الدليل','Guide')][i])).join(''),false);
  }
  function appearanceView() {
    const s=settings(), theme=s.theme||{}, media=s.media||{};
    const colors = [['accent',t('اللون الأساسي','Accent')],['bg',t('خلفية الموقع','Page background')],['text',t('لون النص','Text')],['cardBg',t('خلفية البطاقات','Card background')]].map(pair => field(pair[1],pair[0],theme[pair[0]]||'#000000',{type:'color',dir:'ltr'})).join('');
    const themeFields = colors + field(t('استدارة الأزرار · px','Button radius · px'),'buttonRadius',theme.buttonRadius,{type:'number',min:0,max:36,step:1}) + field(t('حجم النص الأساسي · px','Base font size · px'),'fontSize',theme.fontSize,{type:'number',min:14,max:22,step:1});
    return editHeading(t('التصميم والصور','Appearance & images'),t('غيّر ألوان المتجر وصوره دون تعديل الكود.','Change store colours and images without editing code.')) + editPanel(t('الألوان والخط','Colours & type'),t('الهوية المرئية وحجم النصوص','Visual identity and text size'),'theme',themeFields,true) + editPanel(t('صورة المقدمة','Hero image'),t('صورة كبيرة وواضحة للواجهة الرئيسية','A clear, large image for the home page'),'hero',imageField(t('صورة المقدمة','Hero image'),'image',(s.hero||{}).image),false) + editPanel(t('شعار المحل','Store logo'),t('شعار خاص بالمحل ومرخّص لك استخدامه','Your own store logo, with permission to use it'),'brand',imageField(t('شعار المحل','Store logo'),'logoImage',(s.brand||{}).logoImage),false) + editPanel(t('صور الفئات','Category images'),t('الصور الافتراضية للأجهزة والفئات','Default device and category images'),'media',[['macbook',t('الماك','Mac')],['iphone',t('الهواتف','Phones')],['ipad',t('الأجهزة اللوحية','Tablets')],['airpods',t('السماعات','Audio')],['watch',t('الساعات','Watches')],['accessories',t('الإكسسوارات','Accessories')]].map(n => imageField(n[1],n[0],media[n[0]])).join(''),false) + '<p class="admin-custom-note">' + t('استخدم صورًا يملكها المحل أو عنده إذن باستخدامها. غياب الشعار عن الصورة لا يثبت حقوق استخدامها.','Use images the store owns or has permission to use. Removing a logo does not establish image usage rights.') + '</p>';
  }
  function backupPanel() { return '<section class="admin-panel admin-pad admin-backup"><h2>' + t('نسخة التخصيص','Customization backup') + '</h2><p>' + t('الملف يشمل النصوص والتصميم وتعديلات المنتجات، دون بيانات العملاء أو الطلبات.','The file includes content, design and product changes, without customer or order data.') + '</p><div class="admin-backup-actions"><button type="button" class="admin-btn" data-admin-export>' + t('تصدير JSON','Export JSON') + '</button><label class="admin-btn admin-import-label">' + t('استيراد JSON','Import JSON') + '<input type="file" class="admin-file-input" data-admin-import accept="application/json,.json"></label><button type="button" class="admin-btn admin-danger" data-admin-reset>' + t('إعادة الافتراضي','Restore defaults') + '</button></div><p class="admin-form-feedback" role="status"></p></section>'; }
  function settingsView() {
    const s=settings(), brand=s.brand||{}, delivery=s.checkout||{};
    const contact = field(t('اسم المحل','Store name'),'name',brand.name,{required:true,maxLength:100}) + field(t('الهاتف المحلي','Local phone'),'phone',brand.phone,{dir:'ltr',maxLength:30}) + field(t('الهاتف الدولي لواتساب','WhatsApp international phone'),'internationalPhone',brand.internationalPhone,{dir:'ltr',maxLength:30,note:t('مثال: +9627XXXXXXXX','Example: +9627XXXXXXXX')}) + field(t('رابط Instagram','Instagram URL'),'instagram',brand.instagram,{dir:'ltr',maxLength:500}) + field(t('رابط خرائط Google','Google Maps URL'),'maps',brand.maps,{dir:'ltr',maxLength:500}) + bilingualFields(brand,'address',t('عنوان المحل','Store address')) + bilingualFields(brand,'tagline',t('وصف هوية المحل','Store tagline'));
    return editHeading(t('التواصل والتوصيل','Contact & delivery'),t('عدّل بيانات المحل ورسوم التوصيل واحتفظ بنسخة من التخصيص.','Edit store details, delivery fees and back up your customization.')) + editPanel(t('هوية المحل والتواصل','Store identity & contact'),t('الاسم والعنوان وروابط التواصل','Name, address and contact links'),'brand',contact,true) + editPanel(t('رسوم التوصيل','Delivery fees'),t('تظهر في السلة وملخص الطلب','Shown in checkout and order summaries'),'checkout',field(t('عمّان · دينار','Amman · JOD'),'ammanFee',delivery.ammanFee,{type:'number',min:0,max:100,step:.01,required:true})+field(t('المحافظات الأخرى · دينار','Other cities · JOD'),'otherFee',delivery.otherFee,{type:'number',min:0,max:100,step:.01,required:true}),false) + backupPanel();
  }
  function productsView() {
    const availability = [['demo',t('بانتظار اعتماد المحل','Pending store confirmation')],['available',t('متوفر في المعاينة','Available in preview')],['on-order',t('حسب الطلب في المعاينة','On request in preview')],['unavailable',t('غير متوفر في المعاينة','Unavailable in preview')]];
    const categories = [['mac',t('الماك','Mac')],['iphone',t('الهواتف','Phones')],['ipad',t('الأجهزة اللوحية','Tablets')],['audio',t('السماعات','Audio')],['watch',t('الساعات','Watches')],['accessories',t('الإكسسوارات','Accessories')]];
    return editHeading(t('الأجهزة والمواصفات','Devices & specifications'),t('عدّل الاسم والمواصفات والصورة والسعر، أو أضف جهازًا جديدًا.','Edit device names, specifications, images and prices, or add a new device.')) + '<div class="admin-catalog-actions"><button class="admin-btn admin-btn-primary" type="button" data-admin-add>' + icon('box') + t('إضافة جهاز','Add device') + '</button><p>' + t('أخفِ الجهاز من المتجر دون حذف إعداداته.','Hide a device from the store while retaining its configuration.') + '</p></div><div class="admin-products">' + products().map(p => '<article class="admin-product" id="admin-product-' + esc(p.id) + '"><div class="admin-product-head"><div class="admin-product-art">' + productArt(p) + '</div><div><span class="admin-eyebrow">' + esc(p.category || 'DEVICE') + (p.hidden ? ' · ' + t('مخفي','HIDDEN') : '') + (Number.isFinite(p.offerPrice) && p.offerPrice < p.basePrice ? ' · ' + t('عرض','OFFER') : '') + '</span><h2>' + esc(p.name) + '</h2><p><bdi>' + esc([p.chip,p.ram,p.storage].filter(Boolean).join(' · ')) + '</bdi></p></div><button type="button" class="admin-duplicate" data-admin-duplicate="' + esc(p.id) + '">' + t('نسخ الجهاز','Duplicate') + '</button></div><form data-admin-product-form="' + esc(p.id) + '"><div class="admin-edit-grid">' + field(t('اسم الجهاز','Device name'),'name',p.name,{required:true,maxLength:120,wide:true}) + field(t('السعر التجريبي · دينار','Demo price · JOD'),'price',p.basePrice,{type:'number',min:.01,max:100000,step:.01,required:true}) + field(t('سعر العرض · دينار (اختياري)','Offer price · JOD (optional)'),'offerPrice',p.offerPrice==null?'':p.offerPrice,{type:'number',min:.01,max:100000,step:.01,note:t('اتركه فاضي إذا ما في عرض. لازم يكون أقل من السعر، وبيظهر السعر القديم مشطوب.','Leave empty for no offer. It must be below the price; the old price shows crossed out.')}) + '<label class="admin-label admin-edit-field">' + t('التوفر','Availability') + '<select class="admin-input" name="availability">' + availability.map(v => '<option value="' + v[0] + '"' + (availabilityValue(p)===v[0] ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select></label><label class="admin-label admin-edit-field">' + t('الفئة','Category') + '<select class="admin-input" name="category">' + categories.map(v => '<option value="' + v[0] + '"' + (p.category===v[0] ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select></label><label class="admin-checkbox admin-product-hidden"><input type="checkbox" name="hidden"' + (p.hidden ? ' checked' : '') + '><span>' + t('إخفاء من المتجر','Hide from store') + '</span></label></div><details class="admin-product-expand"><summary>' + t('الصورة والوصف والمواصفات','Image, descriptions & specifications') + '<span>+</span></summary><div class="admin-edit-grid">' + imageField(t('صورة الجهاز','Device image'),'image',p.image||'') + bilingualFields(p,'description',t('وصف الجهاز','Description'),true) + ['chip','cpu','network','ram','storage','screen'].map((name,i) => field([t('المعالج','Chip'),t('CPU / GPU','CPU / GPU'),t('الشبكة · Wi-Fi / Cellular','Network · Wi-Fi / Cellular'),t('الذاكرة','RAM'),t('التخزين','Storage'),t('الشاشة','Screen')][i],name,p[name]||'',{maxLength:120,dir:'ltr'})).join('') + field(t('خيارات الذاكرة · GB','RAM options · GB'),'ramOptions',(p.ramOptions||[]).join(', '),{dir:'ltr',maxLength:200,note:t('أرقام مفصولة بفاصلة، مثل: 16, 32. اتركه فارغًا لإخفاء الاختيار.','Comma-separated numbers, e.g. 16, 32. Leave empty to hide the selector.')}) + field(t('خيارات التخزين · GB','Storage options · GB'),'storageOptions',(p.storageOptions||[]).join(', '),{dir:'ltr',maxLength:200,note:t('مثل: 256, 512, 1024','Example: 256, 512, 1024')}) + field(t('الألوان · اسم | كود اللون','Colours · name | hex'),'colors',(p.colors||[]).map(c=>c.name+' | '+c.hex).join('\n'),{textarea:true,dir:'ltr',maxLength:1000,wide:true,note:t('كل لون بسطر، مثل: Silver | #bdc4cd','One colour per line, e.g. Silver | #bdc4cd')}) + '</div></details>' + saveFooter() + '</form></article>').join('') + '</div>';
  }
  function render(view) {
    const selected = currentView(view), section = selected.startsWith('order/') || selected.startsWith('order:') ? 'orders' : selected;
    const nav = [['overview','#/admin','grid',t('نظرة عامة','Overview')],['orders','#/admin/orders','bag',t('الطلبات','Orders')],['products','#/admin/products','box',t('الأجهزة والمواصفات','Devices & specifications')],['content','#/admin/content','menu',t('نصوص الموقع','Site content')],['appearance','#/admin/appearance','grid',t('التصميم والصور','Appearance & images')],['settings','#/admin/settings','check',t('التواصل والتوصيل','Contact & delivery')]];
    let orderId = selected.slice(6); try { orderId = decodeURIComponent(orderId); } catch (_) {}
    let content = section === 'content' ? contentView() : section === 'appearance' ? appearanceView() : section === 'settings' ? settingsView() : section === 'products' ? productsView() : selected === 'orders' ? ordersView() : /^order[/:]/.test(selected) ? orderDetail(orderId) : overview();
    return '<div class="admin-shell" dir="' + (english() ? 'ltr' : 'rtl') + '" data-admin-view="' + esc(selected) + '"><button class="admin-scrim" type="button" data-admin-close aria-label="' + t('إغلاق القائمة','Close navigation') + '" tabindex="-1"></button><aside class="admin-sidebar" id="admin-sidebar"><a class="admin-brand" href="#/admin"><span class="admin-brand-word">' + esc((settings().brand||{}).name||'One Style') + '</span><small>' + t('إدارة المتجر','STORE ADMINISTRATION') + '</small></a><span class="admin-nav-label">' + t('مساحة العمل','WORKSPACE') + '</span><nav aria-label="' + t('قائمة الإدارة','Administration navigation') + '">' + nav.map(n => '<a href="' + n[1] + '" class="admin-nav-link' + (section === n[0] ? ' is-active' : '') + '"' + (section === n[0] ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[3] + '</span>' + (n[0] === 'orders' ? '<b>' + orders().filter(o => normalizedStatus(o.status)==='new').length + '</b>' : '') + '</a>').join('') + '</nav><div class="admin-sidebar-bottom"><div class="admin-demo-dot"><i></i>' + t('وضع المعاينة','Preview mode') + '</div><a class="admin-nav-link" href="#/">' + icon('external') + t('عرض المتجر','View the store') + '</a></div></aside><div class="admin-workspace"><header class="admin-topbar"><div class="admin-top-left"><button class="admin-menu-button" type="button" data-admin-menu aria-label="' + t('فتح قائمة الإدارة','Open administration navigation') + '" aria-controls="admin-sidebar" aria-expanded="false">' + icon('menu') + '</button><span>' + t('لوحة الإدارة','Store administration') + '</span></div><div class="admin-top-left"><button class="admin-store-link" type="button" data-action="language" style="background:transparent;color:inherit;cursor:pointer" aria-label="' + t('التبديل إلى الإنجليزية','Switch to Arabic') + '">' + t('English','العربية') + '</button><a class="admin-store-link" href="#/">' + t('المتجر','Store') + icon('external') + '</a></div></header><div class="admin-demo-banner"><i></i><span>' + t('معاينة محلية — لا توجد طلبات حقيقية','Local preview — no real orders') + '</span></div><main class="admin-main">' + content + '</main></div></div>';
  }
  function feedback(form, message, error) {
    const target = form && form.querySelector('.admin-form-feedback');
    if (target) { target.textContent=message; target.dataset.error=String(!!error); }
  }
  function saveResult(form, saved, message) {
    if (saved===false || saved==null) { feedback(form,t('تعذر الحفظ. راجع البيانات؛ قد تكون مساحة المتصفح ممتلئة. جرّب صورة أصغر أو صدّر نسخة من التخصيص.','Unable to save. Check the values; browser storage may be full. Try a smaller image or export your customization.'),true); return false; }
    feedback(form,message,false); if(typeof api().toast==='function') api().toast(message); return true;
  }
  function refreshAdmin(root, view, id) {
    root.innerHTML=render(view || (root.querySelector('.admin-shell')||{}).dataset?.adminView || 'overview');
    if(id) { const element=document.getElementById('admin-product-'+id); if(element && root.contains(element)) { element.scrollIntoView({behavior:'smooth',block:'start'}); const input=element.querySelector('input[name="name"]'); if(input) input.focus({preventScroll:true}); } }
  }
  function updateImagePreview(fieldRoot, value) {
    const target=fieldRoot && fieldRoot.querySelector('[data-admin-media-preview]'); if(!target) return;
    target.replaceChildren();
    if(value && safeImage(value)) { const img=document.createElement('img'); img.src=value; img.alt=fieldRoot.querySelector('.admin-edit-field>span')?.textContent || t('معاينة الصورة','Image preview'); target.append(img); }
    else { const empty=document.createElement('span'); empty.innerHTML=icon('box'); target.append(empty); }
  }
  function customizationActions(event,root) {
    const exportButton=event.target.closest('[data-admin-export]'), reset=event.target.closest('[data-admin-reset]'), add=event.target.closest('[data-admin-add]'), duplicate=event.target.closest('[data-admin-duplicate]'), clear=event.target.closest('[data-admin-image-clear]');
    if(clear) { const fieldRoot=clear.closest('.admin-media-field'), name=clear.dataset.adminImageClear, input=Array.from(fieldRoot.querySelectorAll('input[name]')).find(i=>i.name===name); if(input) input.value=''; const upload=fieldRoot.querySelector('[data-admin-image-upload]'); if(upload) upload.value=''; updateImagePreview(fieldRoot,''); return true; }
    if(exportButton) {
      const panel=exportButton.closest('.admin-backup');
      try {
        const text=api().exportCustomization(); if(typeof text!=='string') throw new Error('Unavailable');
        let manual=panel.querySelector('.admin-export-text');if(manual)manual.remove();
        manual=document.createElement('details');manual.className='admin-export-text';const summary=document.createElement('summary');summary.textContent=t('عرض نسخة نصية إذا لم يبدأ التنزيل','View a text backup if the download does not start');const area=document.createElement('textarea');area.className='admin-input';area.rows=6;area.readOnly=true;area.dir='ltr';area.value=text;area.setAttribute('aria-label',t('نسخة التخصيص النصية','Customization text backup'));const select=document.createElement('button');select.type='button';select.className='admin-btn';select.textContent=t('تحديد النص للنسخ','Select text to copy');select.addEventListener('click',()=>{area.focus();area.select();});manual.append(summary,area,select);panel.append(manual);
        const blob=new Blob([text],{type:'application/json'}), url=URL.createObjectURL(blob), link=document.createElement('a'); link.href=url; link.download='OneStyle-customization-'+new Date().toISOString().slice(0,10)+'.json';link.hidden=true;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),60000); feedback(panel,t('تم تجهيز نسخة التخصيص وبدء التنزيل.','Customization backup prepared; download started.'),false);
      } catch(_) { feedback(panel,t('تعذر تصدير التخصيص. حاول مرة أخرى.','Unable to export customization. Please try again.'),true); }
      return true;
    }
    if(reset) {
      const panel=reset.closest('.admin-backup');
      if(!window.confirm(t('إعادة النصوص والتصميم والمنتجات إلى الافتراضي؟ ننصح بتصدير نسخة أولًا. تبقى الطلبات دون تغيير.','Restore default content, design and products? Export a backup first. Orders will remain unchanged.'))) return true;
      if(typeof api().resetCustomization!=='function' || api().resetCustomization()===false) { feedback(panel,t('تعذر إعادة الافتراضي.','Unable to restore defaults.'),true);return true; }
      refreshAdmin(root,'settings'); if(typeof api().toast==='function') api().toast(t('تمت إعادة التخصيص الافتراضي.','Default customization restored.')); return true;
    }
    if(add || duplicate) {
      let result=false;
      if(add && typeof api().addProduct==='function') result=api().addProduct({name:t('جهاز جديد','New device'),category:'mac',art:'macbook',chip:'',ram:'',storage:'',screen:'',basePrice:1,availability:'demo',hidden:true,descriptionAr:'',descriptionEn:'',image:'',ramOptions:[],storageOptions:[],colors:[{name:'Graphite',hex:'#535966'}]});
      else if(duplicate && typeof api().duplicateProduct==='function') result=api().duplicateProduct(duplicate.dataset.adminDuplicate);
      if(!result) { if(typeof api().toast==='function') api().toast(t('تعذر حفظ الجهاز. قد تكون مساحة المتصفح ممتلئة.','Unable to save the device. Browser storage may be full.')); return true; }
      refreshAdmin(root,'products',typeof result==='object' ? result.id : result);
      if(typeof api().toast==='function') api().toast(add ? t('أُضيف جهاز مخفي؛ أكمل بياناته ثم أظهره.','A hidden device was added. Complete its details, then show it.') : t('تم نسخ الجهاز.','Device duplicated.')); return true;
    }
    return false;
  }
  function readNumberOptions(value, max) {
    const text=String(value||'').trim(); if(!text) return [];
    const parts=text.split(/[,،]/).map(s=>s.trim());
    if(parts.length>12 || parts.some(s=>!/^\d+(?:\.\d+)?$/.test(s) || Number(s)<=0 || Number(s)>max)) return null;
    return Array.from(new Set(parts.map(Number)));
  }
  function readColors(value) {
    const text=String(value||'').trim(); if(!text) return [];
    const lines=text.split(/\r?\n/).filter(s=>s.trim()); if(lines.length>12) return null;
    const colors=lines.map(line=>{const split=line.split('|');return {name:(split[0]||'').trim(),hex:(split[1]||'').trim()};});
    return colors.some(c=>!c.name || c.name.length>50 || !/^#[0-9a-f]{6}$/i.test(c.hex)) ? null : colors;
  }
  function customizationSubmit(form) {
    const scope=form.dataset.adminSettingsForm, data=new FormData(form), patch={};
    if(scope==='sections') ['hero','categories','featured','guide','support'].forEach(name=>{patch[name]=data.has(name);});
    else {
      for(const [name,value] of data) { if(name==='featuredIds') continue; patch[name]=String(value).trim(); }
      if(scope==='home') patch.featuredIds=data.getAll('featuredIds').map(String);
      if(scope==='theme') { patch.fontSize=Number(patch.fontSize); patch.buttonRadius=Number(patch.buttonRadius); }
      if(scope==='checkout') { patch.ammanFee=Number(patch.ammanFee);patch.otherFee=Number(patch.otherFee); }
    }
    if(Object.entries(patch).some(([name,value])=>(name==='image'||name==='logoImage'||scope==='media') && !safeImage(value))) { feedback(form,t('رابط الصورة غير صالح. استخدم http/https أو assets/ أو ارفع صورة.','Invalid image URL. Use http/https, assets/ or upload an image.'),true); return; }
    if(scope==='brand' && ['instagram','maps'].some(name=>patch[name] && !/^https?:\/\//i.test(patch[name]))) { feedback(form,t('روابط التواصل يجب أن تبدأ بـ https:// أو http://.','Contact links must begin with https:// or http://.'),true);return; }
    if(typeof api().updateSettings!=='function') { feedback(form,t('خدمة التخصيص غير متاحة.','Customization is unavailable.'),true);return; }
    saveResult(form,api().updateSettings({[scope]:patch}),t('تم حفظ التخصيص على هذا المتصفح.','Customization saved on this browser.'));
  }
  function bind(root) {
    if (!root || boundRoots.has(root)) return;
    boundRoots.add(root);
    root.addEventListener('click', event => {
      if(customizationActions(event,root)) return;
      const menu = event.target.closest('[data-admin-menu]');
      const close = event.target.closest('[data-admin-close]');
      const shell = root.querySelector('.admin-shell');
      if (menu && shell) {
        const open = shell.classList.toggle('admin-menu-open');
        menu.setAttribute('aria-expanded', String(open));
        const scrim = shell.querySelector('.admin-scrim'); if (scrim) scrim.tabIndex = open ? 0 : -1;
      }
      if ((close || event.target.closest('.admin-nav-link')) && shell) {
        shell.classList.remove('admin-menu-open');
        const button = shell.querySelector('[data-admin-menu]'); if (button) button.setAttribute('aria-expanded','false');
      }
    });
    root.addEventListener('keydown', event => {
      const shell = root.querySelector('.admin-shell');
      if (event.key === 'Escape' && shell && shell.classList.contains('admin-menu-open')) {
        shell.classList.remove('admin-menu-open'); const button = shell.querySelector('[data-admin-menu]'); if (button) {button.setAttribute('aria-expanded','false');button.focus();}
      }
    });
    root.addEventListener('input',event=>{
      const input=event.target.closest('.admin-media-field input[name]'); if(input) updateImagePreview(input.closest('.admin-media-field'),input.value.trim());
    });
    root.addEventListener('change',event=>{
      const upload=event.target.closest('[data-admin-image-upload]'), imported=event.target.closest('[data-admin-import]');
      if(upload) {
        const file=upload.files && upload.files[0], fieldRoot=upload.closest('.admin-media-field'), status=fieldRoot.querySelector('.admin-upload-feedback'), form=upload.closest('form'); if(!file) return;
        if(!['image/png','image/jpeg','image/webp'].includes(file.type) || file.size>1.5*1024*1024) { status.textContent=t('اختر PNG أو JPG أو WebP بحجم أقل من 1.5 MB.','Choose PNG, JPG or WebP smaller than 1.5 MB.');upload.value='';return; }
        status.textContent=t('جارٍ تجهيز الصورة…','Preparing image…'); form.dataset.imageLoading=String((Number(form.dataset.imageLoading)||0)+1);
        const reader=new FileReader();
        reader.onload=()=>{ form.dataset.imageLoading=String(Math.max(0,(Number(form.dataset.imageLoading)||1)-1)); const value=String(reader.result||''); if(!safeImage(value)){status.textContent=t('ملف الصورة غير صالح.','Invalid image file.');return;} const input=Array.from(fieldRoot.querySelectorAll('input[name]')).find(i=>i.name===upload.dataset.adminImageUpload);if(input)input.value=value;updateImagePreview(fieldRoot,value);status.textContent=t('الصورة جاهزة. اضغط حفظ التعديلات لاعتمادها.','Image ready. Save changes to apply it.'); };
        reader.onerror=()=>{form.dataset.imageLoading=String(Math.max(0,(Number(form.dataset.imageLoading)||1)-1));status.textContent=t('تعذر قراءة الصورة.','Unable to read the image.');};reader.readAsDataURL(file);
      }
      if(imported) {
        const file=imported.files && imported.files[0], panel=imported.closest('.admin-backup'); if(!file)return;
        if(file.size>5*1024*1024){feedback(panel,t('الملف أكبر من 5 MB.','File exceeds 5 MB.'),true);imported.value='';return;}
        const reader=new FileReader();reader.onload=()=>{try{const data=JSON.parse(String(reader.result));if(typeof api().importCustomization!=='function'||api().importCustomization(data)===false)throw new Error('Invalid');refreshAdmin(root,'settings');if(typeof api().toast==='function')api().toast(t('تم استيراد التخصيص على هذا المتصفح.','Customization imported on this browser.'));}catch(_){feedback(panel,t('تعذر الاستيراد. تأكد أنه ملف تخصيص صحيح وأن مساحة المتصفح متاحة.','Unable to import. Check the customization file and available browser storage.'),true);}imported.value='';};reader.onerror=()=>feedback(panel,t('تعذر قراءة الملف.','Unable to read file.'),true);reader.readAsText(file);
      }
    });
    root.addEventListener('submit', event => {
      const form = event.target.closest('[data-admin-product-form], [data-admin-order-form], [data-admin-settings-form]');
      if (!form) return;
      event.preventDefault();
      const feedback = form.querySelector('.admin-form-feedback');
      if (!form.reportValidity()) return;
      if(Number(form.dataset.imageLoading)>0){if(feedback)feedback.textContent=t('انتظر حتى تجهز الصورة قبل الحفظ.','Wait for the image to finish loading.');return;}
      if(form.hasAttribute('data-admin-settings-form')) {customizationSubmit(form);return;}
      const data = new FormData(form);
      if (form.hasAttribute('data-admin-product-form')) {
        const price = Number(data.get('price')), availability = String(data.get('availability'));
        if (!Number.isFinite(price) || price <= 0 || price > 100000 || !['demo','available','unavailable','on-order'].includes(availability)) { if (feedback) feedback.textContent = t('أدخل سعرًا صالحًا من 0.01 إلى 100,000 دينار.','Enter a valid price from 0.01 to 100,000 JOD.'); return; }
        if (typeof api().updateProduct !== 'function') return;
        const colors=readColors(data.get('colors')), ramOptions=readNumberOptions(data.get('ramOptions'),8192),storageOptions=readNumberOptions(data.get('storageOptions'),65536), image=String(data.get('image')||'').trim();
        if(colors===null || ramOptions===null || storageOptions===null){if(feedback)feedback.textContent=t('راجع الألوان وخيارات الذاكرة والتخزين حسب الأمثلة المكتوبة.','Check colours, RAM and storage options against the examples.');return;}
        if(!safeImage(image)){if(feedback)feedback.textContent=t('رابط الصورة غير صالح.','Invalid image URL.');return;}
        const offerText=String(data.get('offerPrice')||'').trim(), offer=offerText===''?null:Number(offerText);
        if(offer!==null&&(!Number.isFinite(offer)||offer<=0||offer>=price)){if(feedback)feedback.textContent=t('سعر العرض لازم يكون أقل من السعر الأصلي، أو اتركه فاضي.','The offer price must be below the regular price, or left empty.');return;}
        const patch={basePrice:Math.round(price*100)/100,offerPrice:offer===null?null:Math.round(offer*100)/100,availability,colors,ramOptions,storageOptions,image,hidden:data.has('hidden')};
        ['name','descriptionAr','descriptionEn','category','chip','cpu','network','ram','storage','screen'].forEach(name=>{patch[name]=String(data.get(name)||'').trim();});
        const saved = api().updateProduct(form.getAttribute('data-admin-product-form'), patch);
        if (saved === false) { if (feedback) feedback.textContent = t('تعذر حفظ الجهاز. راجع البيانات، أو جرّب صورة أصغر إذا كانت مساحة المتصفح ممتلئة.','Unable to save the device. Check the values, or try a smaller image if browser storage is full.'); return; }
        const card=form.closest('.admin-product'), title=card&&card.querySelector('.admin-product-head h2'), specs=card&&(card.querySelector('.admin-product-head p bdi')||card.querySelector('.admin-product-head p'));
        if(title)title.textContent=patch.name; if(specs)specs.textContent=[patch.chip,patch.ram,patch.storage].filter(Boolean).join(' · ');
        const message = t('تم حفظ بيانات الجهاز في هذه المعاينة.','Device details saved in this preview.');
        if (feedback) feedback.textContent = message;
        if (typeof api().toast === 'function') api().toast(message);
      } else {
        const status = String(data.get('status'));
        if (!statuses.includes(status) || typeof api().updateOrder !== 'function') return;
        const id = form.getAttribute('data-admin-order-form');
        const saved = api().updateOrder(id,{status});
        if (saved === false) { if (feedback) feedback.textContent = t('تعذر تحديث حالة الطلب. حاول مرة أخرى.','Unable to update the order. Please try again.'); return; }
        const shell = root.querySelector('.admin-shell');
        if (shell) { const view = shell.getAttribute('data-admin-view'); root.innerHTML = render(view); }
        if (typeof api().toast === 'function') api().toast(t('تم تحديث حالة الطلب التجريبي.','Demo order status updated.'));
      }
    });
  }
  window.OneStyleAdmin = {render,bind};
})();
