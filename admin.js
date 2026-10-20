(function () {
  'use strict';

  const boundRoots = new WeakSet();
  let adminCategory = 'mac';
let adminFilter = {q:'',stock:'all'}; // 2026-10-15: the device category open in the admin, so devices are edited one category at a time.
  const icons = {
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
    bag: '<path d="M5 7h14l1 14H4L5 7Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/>',
    box: '<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="M3 8v9l9 5 9-5V8M12 13v9M7.5 5.5l9 5"/>',
    arrow: '<path d="m14 5-7 7 7 7M7 12h13"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    trend: '<path d="m3 17 6-6 4 4 8-10M15 5h6v6"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    alert: '<path d="M12 3 2 20h20L12 3Z"/><path d="M12 10v4M12 17v.01"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    external: '<path d="M15 3h6v6M21 3l-9 9M10 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5"/>'
  };
  function icon(name) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (icons[name] || icons.grid) + '</svg>'; }
  function api() { return window.StoreDemo || {}; }
  function english() { const v = api().lang; return (typeof v === 'function' ? v() : v) === 'en'; }
  // On the live site (live.js loaded) the preview's demo sentences are swapped for live ones.
  function t(ar, en) { const s = english() ? en : ar; return window.OneStyleLive ? window.OneStyleLive.text(s) : s; }
  function categoryList() { return typeof api().getCategories==='function' ? api().getCategories() : window.OneStyleConfig.categoryList(settings()); }
  function deviceCategories() { return categoryList().map(c => [c.id,t(c.labelAr,c.labelEn),c.art]); }
  function categoryName(id) { const category=categoryList().find(c=>c.id===id);return category?t(category.labelAr,category.labelEn):id; }
  function productCondition(product) { return product.condition==='used-like-new'?'used-like-new':'new'; }
  function conditionName(condition) { return window.OneStyleConfig.conditionLabel(condition,english()?'en':'ar'); }
  function conditionBadge(product) { const condition=productCondition(product); return '<span class="admin-condition admin-condition-'+condition+'">'+esc(conditionName(condition))+'</span>'; }
  function conditionField(product) { return '<label class="admin-label admin-edit-field"><span>'+t('حالة الجهاز','Device condition')+'</span><select class="admin-input" name="condition">'+window.OneStyleConfig.conditions.map(condition=>'<option value="'+condition.id+'"'+(productCondition(product)===condition.id?' selected':'')+'>'+esc(conditionName(condition.id))+'</option>').join('')+'</select></label>'; }
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
    return '<div class="admin-heading"><div><p class="admin-eyebrow">' + t('ONE STYLE · نظرة عامة','ONE STYLE · OVERVIEW') + '</p><h1>' + t('كل شيء تحت نظرك.','Everything, in view.') + '</h1><p>' + t('معاينة إدارة المتجر والطلبات من مكان واحد.','A preview of your store and orders, in one place.') + '</p></div><a class="admin-btn" href="#/admin/products">' + icon('box') + t('إدارة الأجهزة','Manage devices') + '</a></div>' + lowStockBanner(true) + '<div class="admin-stats">' + cards.map(c => '<article class="admin-stat"><span class="admin-stat-icon">' + icon(c[0]) + '</span><p>' + c[1] + '</p><strong>' + c[2] + '</strong><small>' + c[3] + '</small></article>').join('') + '</div><section class="admin-panel"><div class="admin-panel-heading"><div><h2>' + t('آخر الطلبات','Recent orders') + '</h2><p>' + t('طلبات توضيحية وتجاربك على هذه النسخة.','Sample orders and orders you place in this preview.') + '</p></div><a class="admin-row-link" href="#/admin/orders">' + t('كل الطلبات','All orders') + icon('arrow') + '</a></div>' + orderRows(newestOrders(all).slice(0,5)) + '</section><div class="admin-bottom-note">' + icon('check') + '<p>' + t('تعديلات الأسعار وحالات الطلبات تُحفظ محليًا. الربط بقاعدة البيانات والدفع الإلكتروني يُجهّز عند تشغيل المتجر الفعلي.','Price and order status changes are saved locally. Database and payment integration are prepared for the live store.') + '</p></div>';
  }
  function ordersView() { return '<div class="admin-heading"><div><p class="admin-eyebrow">' + t('إدارة المتجر','STORE MANAGEMENT') + '</p><h1>' + t('الطلبات','Orders') + '</h1><p>' + t('افتح أي طلب لمراجعة الأجهزة وبيانات التوصيل.','Open an order to review devices and delivery details.') + '</p></div><span class="admin-count">' + orders().length + ' ' + t('طلب تجريبي','demo orders') + '</span></div><section class="admin-panel">' + orderRows(newestOrders(orders())) + '</section>'; }
  function orderDetail(id) {
    const order = orders().find(o => String(o.id) === String(id));
    if (!order) return '<div class="admin-empty">' + icon('bag') + '<h1>' + t('الطلب غير موجود','Order not found') + '</h1><a class="admin-btn" href="#/admin/orders">' + t('العودة للطلبات','Back to orders') + '</a></div>';
    const customer = order.customer || {}, items = Array.isArray(order.items) ? order.items : [];
    const subtotal = items.reduce((n,item) => n + (Number(item.quantity)||0) * (Number(item.unitPrice)||0),0);
    return '<a class="admin-back" href="#/admin/orders">' + icon('arrow') + t('العودة للطلبات','Back to orders') + '</a><div class="admin-heading"><div><p class="admin-eyebrow">' + t('طلب تجريبي · ','DEMO ORDER · ') + dateLabel(order.date) + '</p><h1 class="admin-order-title">' + esc(order.id) + '</h1></div>' + statusBadge(order.status) + '</div><div class="admin-detail-grid"><section class="admin-panel"><div class="admin-panel-heading"><h2>' + t('الأجهزة المطلوبة','Ordered devices') + '</h2></div><div class="admin-order-items">' + items.map(item => '<article class="admin-order-item"><span class="admin-item-icon">' + icon('box') + '</span><div><h3>' + esc(item.name) + '</h3><p>' + esc(typeof item.variant === 'object' && item.variant ? Object.values(item.variant).filter(Boolean).join(' · ') : item.variant || t('المواصفات المختارة','Selected configuration')) + '</p><small>' + t('الكمية: ','Quantity: ') + esc(item.quantity) + ' · ' + money(item.unitPrice) + '</small></div><strong>' + money((Number(item.quantity)||0) * (Number(item.unitPrice)||0)) + '</strong></article>').join('') + '</div><dl class="admin-totals"><div><dt>' + t('قيمة الأجهزة','Devices subtotal') + '</dt><dd>' + money(subtotal) + '</dd></div><div><dt>' + t('التوصيل','Delivery') + '</dt><dd>' + money(Math.max(0,(Number(order.total)||0)-subtotal)) + '</dd></div><div class="admin-total"><dt>' + t('الإجمالي','Total') + '</dt><dd>' + money(order.total) + '</dd></div></dl></section><div class="admin-detail-side"><section class="admin-panel admin-pad"><h2>' + t('بيانات التوصيل','Delivery details') + '</h2><dl class="admin-customer"><div><dt>' + t('الاسم','Name') + '</dt><dd>' + esc(customer.name || '—') + '</dd></div><div><dt>' + t('الهاتف','Phone') + '</dt><dd dir="ltr">' + esc(customer.phone || '—') + '</dd></div><div><dt>' + t('المدينة','City') + '</dt><dd>' + esc(customer.city || '—') + '</dd></div><div><dt>' + t('العنوان','Address') + '</dt><dd>' + esc(customer.address || '—') + '</dd></div>' + (customer.notes ? '<div><dt>' + t('ملاحظات','Notes') + '</dt><dd>' + esc(customer.notes) + '</dd></div>' : '') + (order.account ? '<div><dt>' + t('الحساب','Account') + '</dt><dd>' + (order.account === 'account' ? t('عميل مسجّل','Signed-in customer') : t('ضيف','Guest')) + '</dd></div>' : '') + '</dl></section><section class="admin-panel admin-pad"><h2>' + t('حالة الطلب','Order status') + '</h2><form data-admin-order-form="' + esc(order.id) + '"><label class="admin-label" for="admin-status-select">' + t('تحديث الحالة التجريبية','Update demo status') + '</label><select class="admin-input" id="admin-status-select" name="status">' + statuses.map(s => '<option value="' + s + '"' + (normalizedStatus(order.status) === s ? ' selected' : '') + '>' + statusText(s) + '</option>').join('') + '</select><button type="submit" class="admin-btn admin-btn-primary admin-full">' + icon('check') + t('حفظ الحالة','Save status') + '</button><p class="admin-field-note">' + t('هذا التغيير محلي، ولا يرسل إشعارًا إلى عميل.','This is a local change. No customer notification is sent.') + '</p><p class="admin-form-feedback" role="status"></p></form></section></div></div>';
  }
  function productArt(product) {
    if (product.image) return '<img src="' + esc(product.image) + '" alt="" loading="lazy">';
    const fallback=typeof api().getProductImage==='function'?api().getProductImage(product):'';if(fallback)return '<img src="'+esc(fallback)+'" alt="" loading="lazy">';

    return icon('box');
  }
  // Stock: the status shows on the website; the optional count stays in the admin.
  function stockState(p) { const v = availabilityValue(p); return v; }
  function stockPillAdmin(p) {
    const v = stockState(p), labels = {available:t('متوفر','In stock'),unavailable:t('غير متوفر','Out of stock'),'on-order':t('حسب الطلب','On request'),demo:t('بانتظار الاعتماد','Pending confirmation')};
    const count = Number.isInteger(p.stockCount) ? ' · ' + t('الكمية: ','Qty: ') + p.stockCount : '', low = isLowStock(p) && v!=='unavailable';
    return '<div class="admin-stock" data-admin-stock="' + esc(p.id) + '"><span class="admin-stock-pill is-' + (low ? 'low' : v) + '">' + (low ? t('كمية قليلة','Low stock') : labels[v]) + count + '</span><button type="button" class="admin-stock-toggle" data-admin-stock-toggle="' + esc(p.id) + '">' + (v==='available' ? t('خلّيه غير متوفر','Mark out of stock') : t('خلّيه متوفر','Mark in stock')) + '</button></div>';
  }
  function availabilityValue(p) { return ['demo','available','unavailable','on-order'].includes(p.availability) ? p.availability : 'demo'; }
  function settings() { return typeof api().getSettings === 'function' ? api().getSettings() : {}; }
  function field(label, name, value, options) {
    const o = options || {}, attrs = ' name="' + esc(name) + '"' + (o.dir ? ' dir="' + esc(o.dir) + '"' : ' dir="auto"') + (o.required ? ' required' : '') + (o.maxLength ? ' maxlength="' + o.maxLength + '"' : '') + (o.min != null ? ' min="' + o.min + '"' : '') + (o.max != null ? ' max="' + o.max + '"' : '') + (o.step ? ' step="' + o.step + '"' : '') + (o.autocomplete ? ' autocomplete="' + esc(o.autocomplete) + '" spellcheck="false"' : '');
    return '<label class="admin-label admin-edit-field' + (o.wide ? ' admin-field-wide' : '') + '"><span>' + esc(label) + '</span>' + (o.textarea ? '<textarea class="admin-input admin-textarea" rows="3"' + attrs + '>' + esc(value) + '</textarea>' : '<input class="admin-input" type="' + (o.type || 'text') + '"' + attrs + ' value="' + esc(value) + '">') + (o.note ? '<small class="admin-field-note">' + esc(o.note) + '</small>' : '') + '</label>';
  }
  function batteryFields(product) {
    const uses = [['mixed',t('استخدام مختلط','Mixed use')],['web',t('تصفح الإنترنت','Web browsing')],['video',t('تشغيل الفيديو','Video playback')],['listening',t('الاستماع','Listening')],['none',t('لا توجد بطارية','No battery')]], use = uses.some(option => option[0] === product.batteryUse) ? product.batteryUse : 'mixed';
    return field(t('مدة تشغيل البطارية · ساعات','Battery runtime · hours'),'batteryHours',product.batteryHours==null?'':product.batteryHours,{type:'number',min:0,max:1000,step:'any',dir:'ltr',note:t('أقصى عدد ساعات تشغيل لكل شحنة. اتركه فارغًا إذا كان غير معروف.','Up to hours per charge; leave empty if unknown.')}) + '<label class="admin-label admin-edit-field"><span>' + t('نوع استخدام البطارية','Battery usage') + '</span><select class="admin-input" name="batteryUse">' + uses.map(option => '<option value="' + option[0] + '"' + (use===option[0] ? ' selected' : '') + '>' + option[1] + '</option>').join('') + '</select></label>';
  }
  function usedBatteryFields(product) {
    const enabled=productCondition(product)==='used-like-new'&&product.batteryUse!=='none';
    return '<fieldset class="admin-used-battery admin-field-wide" data-admin-used-battery'+(enabled?'':' hidden disabled')+'><legend>'+t('بطارية الجهاز المستعمل','Used device battery')+'</legend><div class="admin-edit-grid">'+field(t('صحة البطارية · %','Battery health · %'),'batteryHealth',product.batteryHealth==null?'':product.batteryHealth,{type:'number',min:0,max:100,step:1,dir:'ltr'})+field(t('عدد دورات الشحن','Battery cycles'),'batteryCycles',product.batteryCycles==null?'':product.batteryCycles,{type:'number',min:0,max:100000,step:1,dir:'ltr'})+'</div><p class="admin-field-note">'+t('أدخل القيم المقاسة لهذا الجهاز المستعمل. اترك الحقل فارغًا إذا كانت القيمة غير معروفة.','Enter measured values for this used device. Leave a field empty if its value is unknown.')+'</p></fieldset>';
  }
  function updateUsedBatteryFields(form) {
    const group=form&&form.querySelector('[data-admin-used-battery]');if(!group)return;
    const enabled=form.querySelector('[name="condition"]').value==='used-like-new'&&form.querySelector('[name="batteryUse"]').value!=='none';
    group.hidden=!enabled;group.disabled=!enabled;
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
  function categoryFields(category) {
    return field(t('اسم الفئة بالعربية','Category name · Arabic'),'labelAr',category.labelAr||'',{required:true,maxLength:80,dir:'rtl'}) + field(t('اسم الفئة بالإنجليزية','Category name · English'),'labelEn',category.labelEn||'',{required:true,maxLength:80,dir:'ltr'}) + imageField(t('صورة الفئة','Category image'),'image',category.image||'');
  }
  function categoryImagesPanel() {
    const s=settings(), media=s.media||{}, builtins=new Set(window.OneStyleConfig.categories.map(c=>c.id));
    const add='<section class="admin-category-add"><h3>'+t('إضافة فئة جديدة','Add a new category')+'</h3><p>'+t('أضف الاسم باللغتين والصورة. ستظهر الفئة في استكشف والمجموعة والأجهزة والمواصفات، ثم يمكنك إضافة أجهزتها.','Add both names and an image. The category will appear in Explore, the collection, and Devices & specifications; you can then add its devices.')+'</p><form data-admin-category-form="new"><div class="admin-edit-grid">'+categoryFields({})+'</div><div class="admin-edit-actions"><p>'+t('الحفظ يحدّث الموقع على هذا المتصفح فقط.','Saving updates the website on this browser only.')+'</p><button type="submit" class="admin-btn admin-btn-primary">'+icon('box')+t('إضافة الفئة','Add category')+'</button></div><p class="admin-form-feedback" role="status"></p></form></section>';
    const rows=categoryList().map(category=>{
      const builtin=builtins.has(category.id), name=t(category.labelAr,category.labelEn);
      const attrs=builtin?'data-admin-settings-form="media"':'data-admin-category-form="'+esc(category.id)+'"';
      const body=builtin?imageField(name,category.art,media[category.art]||''):categoryFields(category);
      return '<details class="admin-category-editor" data-admin-category-entry="'+esc(category.id)+'"><summary><strong>'+esc(name)+'</strong><span>+</span></summary><form '+attrs+'><div class="admin-edit-grid">'+body+'</div>'+saveFooter()+'</form></details>';
    }).join('');
    return '<details class="admin-edit-panel" data-admin-category-panel><summary><span><strong>'+t('صور الفئات','Category images')+'</strong><small>'+t('أضف فئات جديدة أو عدّل صور الفئات الحالية','Add categories or edit existing category images')+'</small></span><span class="admin-expand">+</span></summary><div class="admin-category-manager">'+add+rows+'</div></details>';
  }
  function categorySubmit(form,root) {
    const id=form.dataset.adminCategoryForm, data=new FormData(form), patch={labelAr:String(data.get('labelAr')||'').trim(),labelEn:String(data.get('labelEn')||'').trim(),image:String(data.get('image')||'').trim()};
    if(!patch.labelAr||!patch.labelEn||!window.OneStyleConfig.imageSource(patch.image)){feedback(form,t('أدخل اسم الفئة باللغتين وصورة صالحة.','Enter both category names and a valid image.'),true);return;}
    const taken=[...categoryList().filter(c=>c.id!==id).flatMap(c=>[c.labelAr,c.labelEn]),'All devices','كل الأجهزة',...window.OneStyleConfig.conditions.filter(c=>c.id==='used-like-new').flatMap(c=>[c.labelAr,c.labelEn])];
    const duplicate=taken.some(label=>[patch.labelAr,patch.labelEn].some(value=>label.trim().toLowerCase()===value.toLowerCase()));
    if(duplicate){feedback(form,t('توجد فئة بهذا الاسم. اختر اسمًا مختلفًا.','A category with this name already exists. Choose a different name.'),true);return;}
    const result=id==='new'&&typeof api().addCategory==='function'?api().addCategory(patch):typeof api().updateCategory==='function'?api().updateCategory(id,patch):false;
    if(!result){feedback(form,t('تعذر حفظ الفئة. راجع البيانات وعدد الفئات، أو جرّب صورة أصغر.','Unable to save the category. Check the names and category limit, or try a smaller image.'),true);return;}
    if(id==='new')adminCategory=result.id;
    refreshAdmin(root,'appearance');
    const panel=root.querySelector('[data-admin-category-panel]');if(panel)panel.open=true;
    const entry=Array.from(root.querySelectorAll('[data-admin-category-entry]')).find(el=>el.dataset.adminCategoryEntry===result.id);
    const message=id==='new'?t('أُضيفت الفئة. تظهر الآن في الموقع والأجهزة والمواصفات.','Category added. It now appears in the storefront and Devices & specifications.'):t('تم حفظ اسم الفئة وصورتها.','Category name and image saved.');
    if(entry){entry.open=true;feedback(entry.querySelector('form'),message,false);entry.scrollIntoView({block:'nearest'});}
    if(typeof api().toast==='function')api().toast(message);
  }
  function heroImagesPanel() {
    const hero=settings().hero||{}, devices=[['image','MacBook'],['iphoneImage','iPhone'],['ipadImage','iPad'],['airpodsImage','AirPods']];
    const note=t('اختر الجهاز أدناه لرفع صورة مقدمته وحفظها بشكل مستقل. الصورة المخصصة تظهر ثابتة. اترك الحقل فارغًا لاستخدام صورة الفئة؛ تعمل حركات الجهاز مع الصور الافتراضية. هذه الإعدادات تخص مقدمة الرئيسية فقط.','Choose a device below to upload and save its Home hero image separately. Custom images display as still images. Leave a field empty to use its category image; device animations use the default images. These settings apply only to the Home hero.');
    const rows=devices.map(([name,label])=>'<details class="admin-category-editor" data-admin-hero-image="'+name+'"><summary><strong>'+label+'</strong><span>+</span></summary><form data-admin-settings-form="hero"><div class="admin-edit-grid">'+imageField(t('صورة المقدمة · ','Hero image · ')+label,name,hero[name]||'')+'</div>'+saveFooter()+'</form></details>').join('');
    return '<details class="admin-edit-panel" data-admin-hero-panel><summary><span><strong>'+t('صور مقدمة الرئيسية','Home hero images')+'</strong><small>MacBook · iPhone · iPad · AirPods</small></span><span class="admin-expand">+</span></summary><div class="admin-category-manager"><p class="admin-help-note">'+note+'</p>'+rows+'</div></details>';
  }
  function appearanceView() {
    const s=settings(), theme=s.theme||{};
    const colors = [['accent',t('اللون الأساسي','Accent')],['bg',t('خلفية الموقع','Page background')],['text',t('لون النص','Text')],['cardBg',t('خلفية البطاقات','Card background')]].map(pair => field(pair[1],pair[0],theme[pair[0]]||'#000000',{type:'color',dir:'ltr'})).join('');
    const themeFields = colors + field(t('استدارة الأزرار · px','Button radius · px'),'buttonRadius',theme.buttonRadius,{type:'number',min:0,max:36,step:1}) + field(t('حجم النص الأساسي · px','Base font size · px'),'fontSize',theme.fontSize,{type:'number',min:14,max:22,step:1});
    return editHeading(t('التصميم والصور','Appearance & images'),t('غيّر ألوان المتجر وصوره دون تعديل الكود.','Change store colours and images without editing code.')) + editPanel(t('الألوان والخط','Colours & type'),t('الهوية المرئية وحجم النصوص','Visual identity and text size'),'theme',themeFields,true) + heroImagesPanel() + editPanel(t('شعار المحل','Store logo'),t('شعار خاص بالمحل ومرخّص لك استخدامه','Your own store logo, with permission to use it'),'brand',imageField(t('شعار المحل','Store logo'),'logoImage',(s.brand||{}).logoImage),false) + categoryImagesPanel() + '<p class="admin-custom-note">' + t('استخدم صورًا يملكها المحل أو عنده إذن باستخدامها. غياب الشعار عن الصورة لا يثبت حقوق استخدامها.','Use images the store owns or has permission to use. Removing a logo does not establish image usage rights.') + '</p>';
  }
  function backupPanel() { return '<section class="admin-panel admin-pad admin-backup"><h2>' + t('نسخة التخصيص','Customization backup') + '</h2><p>' + t('الملف يشمل النصوص والفئات والصور وتعديلات المنتجات، دون بيانات العملاء أو الطلبات.','The file includes content, categories, images and product changes, without customer or order data.') + '</p><div class="admin-backup-actions"><button type="button" class="admin-btn" data-admin-export>' + t('تصدير JSON','Export JSON') + '</button><label class="admin-btn admin-import-label">' + t('استيراد JSON','Import JSON') + '<input type="file" class="admin-file-input" data-admin-import accept="application/json,.json"></label><button type="button" class="admin-btn admin-danger" data-admin-reset>' + t('إعادة الافتراضي','Restore defaults') + '</button></div><p class="admin-form-feedback" role="status"></p></section>'; }
  function settingsView() {
    const s=settings(), brand=s.brand||{}, delivery=s.checkout||{};
    const contact = field(t('اسم المحل','Store name'),'name',brand.name,{required:true,maxLength:100}) + field(t('الهاتف المحلي','Local phone'),'phone',brand.phone,{dir:'ltr',maxLength:30}) + field(t('الهاتف الدولي لواتساب','WhatsApp international phone'),'internationalPhone',brand.internationalPhone,{dir:'ltr',maxLength:30,note:t('مثال: +9627XXXXXXXX','Example: +9627XXXXXXXX')}) + field(t('رابط Instagram','Instagram URL'),'instagram',brand.instagram,{dir:'ltr',maxLength:500}) + field(t('رابط خرائط Google','Google Maps URL'),'maps',brand.maps,{dir:'ltr',maxLength:500}) + bilingualFields(brand,'address',t('عنوان المحل','Store address')) + bilingualFields(brand,'tagline',t('وصف هوية المحل','Store tagline'));
    return editHeading(t('التواصل والتوصيل','Contact & delivery'),t('عدّل بيانات المحل ورسوم التوصيل واحتفظ بنسخة من التخصيص.','Edit store details, delivery fees and back up your customization.')) + editPanel(t('هوية المحل والتواصل','Store identity & contact'),t('الاسم والعنوان وروابط التواصل','Name, address and contact links'),'brand',contact,true) + editPanel(t('رسوم التوصيل','Delivery fees'),t('تظهر في السلة وملخص الطلب','Shown in checkout and order summaries'),'checkout',field(t('عمّان · دينار','Amman · JOD'),'ammanFee',delivery.ammanFee,{type:'number',min:0,max:100,step:.01,required:true})+field(t('المحافظات الأخرى · دينار','Other cities · JOD'),'otherFee',delivery.otherFee,{type:'number',min:0,max:100,step:.01,required:true})+(window.OneStyleLive?'<label class="admin-checkbox admin-switch"><input type="checkbox" name="ordersOn"'+(delivery.ordersOn===true?' checked':'')+'> '+t('استقبال الطلبات من الموقع','Take orders on the site')+'</label><p class="admin-field-note">'+t('راجع الأسعار قبل التفعيل. لما يكون مفعّل، الموقع بيستقبل الطلبات وبيظهر لجوجل.','Check the prices before turning this on. While on, the site takes orders and shows up on Google.')+'</p>':''),false) + alertsPanel() + backupPanel();
  }
  function productsView() {
    const availability = [['available',t('متوفر','In stock')],['unavailable',t('غير متوفر','Out of stock')],['on-order',t('حسب الطلب','On request')],['demo',t('بانتظار اعتماد المحل','Pending store confirmation')]];
    const categories = deviceCategories();
    const known = new Set(categories.map(c => c[0])), all = products(), groups = categories.map(c => [c[0], c[1], all.filter(p => p.category === c[0])]);
    groups.push(['used-like-new',conditionName('used-like-new'),all.filter(p=>productCondition(p)==='used-like-new')]);
    const others = all.filter(p => !known.has(p.category)); if (others.length) groups.push(['other', t('أخرى','Other'), others]);
    if (!groups.some(g => g[0] === adminCategory)) adminCategory = (groups.find(g => g[2].length) || groups[0])[0];
    const current = groups.find(g => g[0] === adminCategory), list = current[2];
    const visibleNow = all.filter(p => filterActive() ? matchesFilter(p) : inTab(p));
    const tabs = '<div class="admin-cat-tabs' + (filterActive() ? ' is-filtered' : '') + '" role="tablist" aria-label="' + t('فئات الأجهزة','Device categories') + '">' + groups.map(g => '<button type="button" role="tab" class="admin-cat-tab' + (g[0] === adminCategory && !filterActive() ? ' active' : '') + '" aria-selected="' + (g[0] === adminCategory && !filterActive()) + '" data-admin-category="' + esc(g[0]) + '">' + esc(g[1]) + '<span>' + g[2].length + '</span></button>').join('') + '</div>';
    const empty = list.length ? '' : '<p class="admin-cat-empty">' + (adminCategory==='used-like-new'?t('ما في أجهزة مستعملة كالجديدة بعد. غيّر حالة جهاز أو أضف جهازًا لهذه المجموعة.','No Used — Like New devices yet. Change a device condition or add a device to this collection.'):t('ما في أجهزة بهالفئة. اضغط «إضافة جهاز» وبينضاف هون.','No devices in this category yet. Press “Add device” to add one here.')) + '</p>';
    return editHeading(t('الأجهزة والمواصفات','Devices & specifications'),t('عدّل الاسم والمواصفات والصورة والسعر، أو أضف جهازًا جديدًا.','Edit device names, specifications, images and prices, or add a new device.')) + '<div class="admin-catalog-actions"><button class="admin-btn admin-btn-primary" type="button" data-admin-add>' + icon('box') + t('إضافة جهاز','Add device') + '</button><p>' + t('أخفِ الجهاز من المتجر دون حذف إعداداته.','Hide a device from the store while retaining its configuration.') + '</p></div>' + lowStockBanner(false) + filtersBar() + tabs + '<p class="admin-cat-empty"' + (visibleNow.length ? ' hidden' : '') + '>' + emptyText() + '</p><div class="admin-products">' + all.map(p => '<article class="admin-product" id="admin-product-' + esc(p.id) + '"' + (visibleNow.includes(p) ? '' : ' hidden') + '><div class="admin-product-head"><div class="admin-product-art">' + productArt(p) + '</div><div><span class="admin-eyebrow">' + esc(categoryName(p.category) || 'DEVICE') + (p.hidden ? ' · ' + t('مخفي','HIDDEN') : '') + (Number.isFinite(p.offerPrice) && p.offerPrice < p.basePrice ? ' · ' + t('عرض','OFFER') : '') + '</span><h2>' + esc(p.name) + '</h2>' + conditionBadge(p) + stockPillAdmin(p) + '<p><bdi>' + esc([p.chip,p.ram,p.storage].filter(Boolean).join(' · ')) + '</bdi></p></div><button type="button" class="admin-duplicate" data-admin-duplicate="' + esc(p.id) + '">' + t('نسخ الجهاز','Duplicate') + '</button></div><form data-admin-product-form="' + esc(p.id) + '"><div class="admin-edit-grid">' + field(t('اسم الجهاز','Device name'),'name',p.name,{required:true,maxLength:120,wide:true}) + field(t('السعر التجريبي · دينار','Demo price · JOD'),'price',p.basePrice,{type:'number',min:.01,max:100000,step:.01,required:true}) + field(t('سعر العرض · دينار (اختياري)','Offer price · JOD (optional)'),'offerPrice',p.offerPrice==null?'':p.offerPrice,{type:'number',min:.01,max:100000,step:.01,note:t('اتركه فاضي إذا ما في عرض. لازم يكون أقل من السعر، وبيظهر السعر القديم مشطوب.','Leave empty for no offer. It must be below the price; the old price shows crossed out.')}) + '<label class="admin-label admin-edit-field">' + t('حالة المخزون','Stock status') + '<select class="admin-input" name="availability">' + availability.map(v => '<option value="' + v[0] + '"' + (availabilityValue(p)===v[0] ? ' selected' : '') + '>' + v[1] + '</option>').join('') + '</select></label>' + field(t('الكمية المتوفرة (اختياري)','Quantity in stock (optional)'),'stockCount',Number.isInteger(p.stockCount) ? p.stockCount : '',{type:'number',min:0,max:100000,step:1,dir:'ltr',note:t('بتظهر بالأدمن بس، والزبون ما بيشوفها. لما تكون 0 الجهاز بيصير «غير متوفر».','Shown in the admin only; shoppers never see it. At 0 the device shows as Out of stock.')}) + '<label class="admin-label admin-edit-field">' + t('الفئة','Category') + '<select class="admin-input" name="category">' + categories.map(v => '<option value="' + v[0] + '"' + (p.category===v[0] ? ' selected' : '') + '>' + esc(v[1]) + '</option>').join('') + '</select></label>' + conditionField(p) + usedBatteryFields(p) + '<label class="admin-checkbox admin-product-hidden"><input type="checkbox" name="hidden"' + (p.hidden ? ' checked' : '') + '><span>' + t('إخفاء من المتجر','Hide from store') + '</span></label></div><details class="admin-product-expand"><summary>' + t('الصورة والوصف والمواصفات','Image, descriptions & specifications') + '<span>+</span></summary><div class="admin-edit-grid">' + imageField(t('صورة الجهاز','Device image'),'image',p.image||'') + bilingualFields(p,'description',t('وصف الجهاز','Description'),true) + ['chip','cpu','network','ram','storage','screen'].map((name,i) => field([t('المعالج','Chip'),t('CPU / GPU','CPU / GPU'),t('الشبكة · Wi-Fi / Cellular','Network · Wi-Fi / Cellular'),t('الذاكرة','RAM'),t('التخزين','Storage'),t('الشاشة','Screen')][i],name,p[name]||'',{maxLength:120,dir:'ltr'})).join('') + batteryFields(p) + field(t('خيارات الذاكرة · GB','RAM options · GB'),'ramOptions',(p.ramOptions||[]).join(', '),{dir:'ltr',maxLength:200,note:t('أرقام مفصولة بفاصلة، مثل: 16, 32. اتركه فارغًا لإخفاء الاختيار.','Comma-separated numbers, e.g. 16, 32. Leave empty to hide the selector.')}) + field(t('خيارات التخزين · GB','Storage options · GB'),'storageOptions',(p.storageOptions||[]).join(', '),{dir:'ltr',maxLength:200,note:t('مثل: 256, 512, 1024','Example: 256, 512, 1024')}) + field(t('الألوان · اسم | كود اللون','Colours · name | hex'),'colors',(p.colors||[]).map(c=>c.name+' | '+c.hex).join('\n'),{textarea:true,dir:'ltr',maxLength:1000,wide:true,note:t('كل لون بسطر، مثل: Silver | #bdc4cd','One colour per line, e.g. Silver | #bdc4cd')}) + '</div></details>' + saveFooter() + '</form></article>').join('') + '</div>';
  }
  function render(view) {
    const selected = currentView(view), section = selected.startsWith('order/') || selected.startsWith('order:') ? 'orders' : selected;
    const nav = [['overview','#/admin','grid',t('نظرة عامة','Overview')],['orders','#/admin/orders','bag',t('الطلبات','Orders')],['products','#/admin/products','box',t('الأجهزة والمواصفات','Devices & specifications')],['content','#/admin/content','menu',t('نصوص الموقع','Site content')],['appearance','#/admin/appearance','grid',t('التصميم والصور','Appearance & images')],['settings','#/admin/settings','check',t('التواصل والتوصيل','Contact & delivery')]];
    let orderId = selected.slice(6); try { orderId = decodeURIComponent(orderId); } catch (_) {}
    let content = section === 'content' ? contentView() : section === 'appearance' ? appearanceView() : section === 'settings' ? settingsView() : section === 'products' ? productsView() : selected === 'orders' ? ordersView() : /^order[/:]/.test(selected) ? orderDetail(orderId) : overview();
    return '<div class="admin-shell" dir="' + (english() ? 'ltr' : 'rtl') + '" data-admin-view="' + esc(selected) + '"><button class="admin-scrim" type="button" data-admin-close aria-label="' + t('إغلاق القائمة','Close navigation') + '" tabindex="-1"></button><aside class="admin-sidebar" id="admin-sidebar"><a class="admin-brand" href="#/admin"><span class="admin-brand-word">' + esc((settings().brand||{}).name||'One Style') + '</span><small>' + t('إدارة المتجر','STORE ADMINISTRATION') + '</small></a><span class="admin-nav-label">' + t('مساحة العمل','WORKSPACE') + '</span><nav aria-label="' + t('قائمة الإدارة','Administration navigation') + '">' + nav.map(n => '<a href="' + n[1] + '" class="admin-nav-link' + (section === n[0] ? ' is-active' : '') + '"' + (section === n[0] ? ' aria-current="page"' : '') + '>' + icon(n[2]) + '<span>' + n[3] + '</span>' + (n[0] === 'orders' ? '<b>' + orders().filter(o => normalizedStatus(o.status)==='new').length + '</b>' : '') + (n[0] === 'products' && products().some(isLowStock) ? '<b class="admin-nav-warn">' + products().filter(isLowStock).length + '</b>' : '') + '</a>').join('') + '</nav><div class="admin-sidebar-bottom"><div class="admin-demo-dot"><i></i>' + t('وضع المعاينة','Preview mode') + '</div><a class="admin-nav-link" href="#/">' + icon('external') + t('عرض المتجر','View the store') + '</a></div></aside><div class="admin-workspace"><header class="admin-topbar"><div class="admin-top-left"><button class="admin-menu-button" type="button" data-admin-menu aria-label="' + t('فتح قائمة الإدارة','Open administration navigation') + '" aria-controls="admin-sidebar" aria-expanded="false">' + icon('menu') + '</button><span>' + t('لوحة الإدارة','Store administration') + '</span></div><div class="admin-top-left"><button class="admin-store-link" type="button" data-action="language" style="background:transparent;color:inherit;cursor:pointer" aria-label="' + t('التبديل إلى الإنجليزية','Switch to Arabic') + '">' + t('English','العربية') + '</button><a class="admin-store-link" href="#/">' + t('المتجر','Store') + icon('external') + '</a></div></header><div class="admin-demo-banner"><i></i><span>' + t('معاينة محلية — لا توجد طلبات حقيقية','Local preview — no real orders') + '</span></div><main class="admin-main">' + content + '</main></div></div>';
  }
  function alertsPanel() {
    const alerts = api().orderAlerts; if (window.OneStyleLive || !alerts) return '';
    const saved = alerts.get(), channel = saved ? saved.channel : 'telegram';
    const status = !saved ? t('غير مفعّلة على هذا المتصفح','Off on this browser') : icon('check') + (saved.channel==='telegram' ? t('مفعّلة على تلغرام · Chat ID ','On · Telegram · chat ID ') + '<bdi dir="ltr">' + esc(saved.chatId) + '</bdi>' : t('مفعّلة على واتساب · ','On · WhatsApp · ') + '<bdi dir="ltr">' + esc(saved.phone) + '</bdi>');
    const choice = (id,label) => '<label class="admin-alert-choice"><input type="radio" name="channel" value="' + id + '"' + (channel===id ? ' checked' : '') + '><span>' + label + '</span></label>';
    const group = (id,body) => '<div class="admin-edit-grid" data-alert-fields="' + id + '"' + (channel===id ? '' : ' hidden') + '>' + body + '</div>';
    const telegram = field(t('توكن البوت','Bot token'),'tgToken','',{dir:'ltr',maxLength:80,autocomplete:'off',note:t('بتلغرام: ‎@BotFather‎ ← ‎/newbot‎ وبيعطيك التوكن. بعدها افتح البوت تبعك واضغط Start.','In Telegram: @BotFather → /newbot gives you the token. Then open your bot and press Start.')}) + field('Chat ID','tgChat',saved && saved.channel==='telegram' ? saved.chatId : '',{dir:'ltr',maxLength:24,autocomplete:'off',note:t('اضغط «جيب الـ Chat ID» بعد ما تضغط Start على البوت.','Press “Find my chat ID” after pressing Start in your bot.')});
    const whatsapp = field(t('رقم الواتس','WhatsApp number'),'waPhone',saved && saved.channel==='whatsapp' ? saved.phone : '',{dir:'ltr',maxLength:20,autocomplete:'off',note:t('مثال: ‎+9627XXXXXXXX‎ أو 07XXXXXXXX','Example: +9627XXXXXXXX or 07XXXXXXXX')}) + field(t('مفتاح CallMeBot (apikey)','CallMeBot key (apikey)'),'waKey','',{dir:'ltr',maxLength:64,autocomplete:'off',note:t('من واتسابك ابعت ‎I allow callmebot to send me messages‎ لرقم CallMeBot، وبيرد عليك بالمفتاح.','From your WhatsApp, send “I allow callmebot to send me messages” to the CallMeBot number; it replies with your key.')});
    return '<section class="admin-panel admin-pad admin-backup admin-alerts" data-admin-alerts><h2>' + t('تنبيهات الطلبات','Order alerts') + '</h2><p>' + t('كل طلب جديد بيوصلك رسالة على تلغرام أو واتساب. التوكن والمفاتيح بينحفظوا على هذا المتصفح بس، وما بيدخلوا بملف التخصيص.','Each new order sends you a message on Telegram or WhatsApp. Tokens and keys are saved on this browser only and stay out of the customization file.') + '</p><p class="admin-alert-status" data-on="' + (saved ? 'true' : 'false') + '">' + status + '</p><form data-admin-alerts-form novalidate><div class="admin-alert-choices">' + choice('telegram',t('تلغرام','Telegram')) + choice('whatsapp',t('واتساب · CallMeBot','WhatsApp · CallMeBot')) + '</div>' + group('telegram',telegram) + group('whatsapp',whatsapp) + '<div class="admin-backup-actions"><button type="submit" class="admin-btn admin-btn-primary">' + icon('check') + t('حفظ','Save') + '</button><button type="button" class="admin-btn" data-admin-alert-find' + (channel==='telegram' ? '' : ' hidden') + '>' + t('جيب الـ Chat ID','Find my chat ID') + '</button>' + (saved ? '<button type="button" class="admin-btn" data-admin-alert-test>' + t('ابعت رسالة تجربة','Send a test message') + '</button><button type="button" class="admin-btn admin-danger" data-admin-alert-clear>' + t('إيقاف التنبيهات','Turn alerts off') + '</button>' : '') + '</div><p class="admin-form-feedback" role="status"></p></form></section>';
  }
  // Devices filter (search + stock) and the low-stock alert. Filtering hides cards instead of redrawing them, so unsaved edits survive.
  function lowStockBelow() { const n = Number((settings().inventory || {}).lowStockBelow); return Number.isInteger(n) && n > 0 ? n : 0; }
  function isLowStock(p) { const n = lowStockBelow(); return n > 0 && Number.isInteger(p.stockCount) && p.stockCount < n; }
  function filterActive() { return adminFilter.q.trim() !== '' || adminFilter.stock !== 'all'; }
  function stockMatch(p, v) { return v==='all' ? true : v==='low' ? isLowStock(p) : v==='hidden' ? !!p.hidden : availabilityValue(p)===v; }
  function matchesFilter(p) { const q = adminFilter.q.trim().toLowerCase(); if (q && ![p.name,p.chip,p.cpu,p.ram,p.storage,p.screen,categoryName(p.category)].filter(Boolean).join(' ').toLowerCase().includes(q)) return false; return stockMatch(p, adminFilter.stock); }
  function inTab(p) { if (adminCategory==='used-like-new') return productCondition(p)==='used-like-new'; if (adminCategory==='other') return !deviceCategories().some(c => c[0]===p.category); return p.category===adminCategory; }
  function emptyText() { return filterActive() ? t('ما في أجهزة بتطابق الفلتر.','No devices match this filter.') : adminCategory==='used-like-new' ? t('ما في أجهزة مستعملة كالجديدة بعد. غيّر حالة جهاز أو أضف جهازًا لهذه المجموعة.','No Used — Like New devices yet. Change a device condition or add a device to this collection.') : t('ما في أجهزة بهالفئة. اضغط «إضافة جهاز» وبينضاف هون.','No devices in this category yet. Press “Add device” to add one here.'); }
  function lowStockBanner(fromOverview) {
    const n = lowStockBelow(), list = n ? products().filter(isLowStock) : [];
    const names = list.slice(0,4).map(p => '<bdi>' + esc(p.name) + '</bdi> · ' + p.stockCount).join(english() ? ', ' : '، ') + (list.length > 4 ? ' …' : '');
    const action = fromOverview ? '<a class="admin-btn" href="#/admin/products" data-admin-show-low>' + t('اعرضهم','Show them') + '</a>' : '<button type="button" class="admin-btn" data-admin-stock-filter="low">' + t('اعرضهم','Show them') + '</button>';
    return '<div class="admin-lowstock" data-admin-lowstock-alert role="status"' + (list.length ? '' : ' hidden') + '>' + icon('alert') + '<p><strong>' + t('كمية قليلة: ','Low stock: ') + list.length + t(' أجهزة كميتها أقل من ',' devices below ') + n + '</strong><span>' + names + '</span></p>' + action + '</div>';
  }
  function filtersBar() {
    const chips = [['all',t('الكل','All')],['available',t('متوفر','In stock')],['low',t('كمية قليلة','Low stock')],['unavailable',t('غير متوفر','Out of stock')],['on-order',t('حسب الطلب','On request')],['demo',t('بانتظار الاعتماد','Pending')],['hidden',t('مخفي','Hidden')]], all = products();
    return '<div class="admin-filters"><label class="admin-search">' + icon('search') + '<input type="search" data-admin-filter-q value="' + esc(adminFilter.q) + '" placeholder="' + t('ابحث باسم الجهاز أو المعالج…','Search by device name or chip…') + '" aria-label="' + t('بحث بالأجهزة','Search devices') + '" autocomplete="off"></label><label class="admin-lowstock-setting">' + t('نبّهني لما الكمية تصير أقل من','Alert me when quantity is below') + '<input type="number" min="0" max="100" step="1" inputmode="numeric" dir="ltr" data-admin-lowstock-input value="' + lowStockBelow() + '"><small>' + t('0 = بدون تنبيه','0 = off') + '</small></label><div class="admin-stock-filters" role="group" aria-label="' + t('فلتر المخزون','Stock filter') + '">' + chips.map(c => '<button type="button" class="admin-stock-chip' + (c[0]==='low' ? ' is-low' : '') + (adminFilter.stock===c[0] ? ' active' : '') + '" aria-pressed="' + (adminFilter.stock===c[0]) + '" data-admin-stock-filter="' + c[0] + '">' + c[1] + '<span>' + (c[0]==='all' ? all.length : all.filter(p => stockMatch(p,c[0])).length) + '</span></button>').join('') + '</div></div><div class="admin-filter-result" data-admin-filter-result' + (filterActive() ? '' : ' hidden') + '><span></span><button type="button" class="admin-text-button" data-admin-filter-clear>' + t('مسح الفلتر','Clear filter') + '</button></div>';
  }
  function updateLowStock(root) {
    const banner = root.querySelector('[data-admin-lowstock-alert]'); if (banner) banner.outerHTML = lowStockBanner(!!banner.querySelector('[data-admin-show-low]'));
    const count = products().filter(isLowStock).length, link = root.querySelector('.admin-nav-link[href="#/admin/products"]');
    if (link) { let badge = link.querySelector('.admin-nav-warn'); if (count && !badge) { badge = document.createElement('b'); badge.className = 'admin-nav-warn'; link.append(badge); } if (badge) { if (count) badge.textContent = String(count); else badge.remove(); } }
  }
  function applyAdminFilter(root, keepId) {
    const all = products(), byId = new Map(all.map(p => [p.id,p])), active = filterActive(); let shown = 0;
    root.querySelectorAll('.admin-product').forEach(card => { const id = card.id.replace(/^admin-product-/,''), p = byId.get(id), show = !!p && (id===keepId || (active ? matchesFilter(p) : inTab(p))); card.hidden = !show; if (show) shown++; });
    root.querySelectorAll('.admin-cat-tab').forEach(tab => { const on = !active && tab.dataset.adminCategory===adminCategory; tab.classList.toggle('active',on); tab.setAttribute('aria-selected',String(on)); });
    const tabs = root.querySelector('.admin-cat-tabs'); if (tabs) tabs.classList.toggle('is-filtered',active);
    const empty = root.querySelector('.admin-cat-empty'); if (empty) { empty.hidden = shown > 0; empty.textContent = emptyText(); }
    const result = root.querySelector('[data-admin-filter-result]'); if (result) { result.hidden = !active; result.querySelector('span').textContent = active ? t('النتائج: ','Results: ') + shown + t(' · من كل الفئات',' · across all categories') : ''; }
    root.querySelectorAll('[data-admin-stock-filter]').forEach(chip => { if (!chip.classList.contains('admin-stock-chip')) return; const v = chip.dataset.adminStockFilter, on = adminFilter.stock===v; chip.classList.toggle('active',on); chip.setAttribute('aria-pressed',String(on)); const c = chip.querySelector('span'); if (c) c.textContent = String(v==='all' ? all.length : all.filter(p => stockMatch(p,v)).length); });
    updateLowStock(root);
  }
  function filterActions(event, root) {
    const chip = event.target.closest('[data-admin-stock-filter]'), clear = event.target.closest('[data-admin-filter-clear]'), showLow = event.target.closest('[data-admin-show-low]');
    if (showLow) { adminFilter = {q:'',stock:'low'}; return false; } // the link then opens the devices page
    if (!chip && !clear) return false;
    if (clear) { adminFilter = {q:'',stock:'all'}; const q = root.querySelector('[data-admin-filter-q]'); if (q) q.value = ''; }
    else { const v = chip.dataset.adminStockFilter; adminFilter.stock = adminFilter.stock===v && v!=='all' ? 'all' : v; }
    applyAdminFilter(root);
    if (chip && !chip.classList.contains('admin-stock-chip')) root.querySelector('.admin-filters')?.scrollIntoView({behavior:'smooth',block:'start'});
    return true;
  }
  function stockToggle(event, root) {
    const button = event.target.closest('[data-admin-stock-toggle]'); if (!button || typeof api().updateProduct!=='function') return false;
    const id = button.dataset.adminStockToggle, p = products().find(x => x.id===id); if (!p) return true;
    const next = availabilityValue(p)==='available' ? 'unavailable' : 'available', patch = {availability:next};
    if (next==='available' && p.stockCount===0) patch.stockCount = null; // a count of 0 would force it back to out of stock
    if (api().updateProduct(id,patch)===false) return true;
    const saved = products().find(x => x.id===id), card = button.closest('.admin-product'), form = card && card.querySelector('form[data-admin-product-form]');
    button.closest('[data-admin-stock]').outerHTML = stockPillAdmin(saved);
    if (form) { const select = form.querySelector('select[name=availability]'), count = form.querySelector('input[name=stockCount]'); if (select) select.value = availabilityValue(saved); if (count) count.value = Number.isInteger(saved.stockCount) ? saved.stockCount : ''; }
    if (typeof api().toast==='function') api().toast(next==='available' ? t('صار «متوفر» على الموقع.','Now shows In stock on the website.') : t('صار «غير متوفر» على الموقع.','Now shows Out of stock on the website.'));
    applyAdminFilter(root, id);
    return true;
  }
  function alertChannel(form) { const checked = form.querySelector('input[name=channel]:checked'); return checked ? checked.value : 'telegram'; }
  function showAlertChannel(form) {
    const channel = alertChannel(form);
    form.querySelectorAll('[data-alert-fields]').forEach(group => { group.hidden = group.dataset.alertFields !== channel; });
    const find = form.querySelector('[data-admin-alert-find]'); if (find) find.hidden = channel !== 'telegram';
    feedback(form,'',false);
  }
  // Turns Telegram's answer into what to do next.
  function alertProblem(r) {
    const reason = String(r && r.reason || '');
    if (reason==='network') return r.channel==='whatsapp' ? t('ما قدرنا نوصل لـ CallMeBot. تأكد من الإنترنت وجرّب كمان مرة.','Couldn’t reach CallMeBot. Check the connection and try again.') : t('ما قدرنا نوصل لتلغرام. تأكد من الإنترنت، وإذا عندك مانع إعلانات أو VPN وقّفه وجرّب كمان مرة.','Couldn’t reach Telegram. Check the connection; pause any ad blocker or VPN and try again.');
    if (r.code===401 || r.code===404) return t('التوكن مش صحيح أو انعمله revoke. الصق التوكن الجديد من BotFather، اضغط «جيب الـ Chat ID»، وبعدين حفظ.','The token is wrong or was revoked. Paste the new token from BotFather, press “Find my chat ID”, then Save.');
    if (/chat not found/i.test(reason)) return t('الـ Chat ID مش صحيح. اضغط «جيب الـ Chat ID» من جديد، وبعدين حفظ.','Wrong chat ID. Press “Find my chat ID” again, then Save.');
    if (r.code===403) return t('البوت ما بقدر يبعتلك. افتح البوت بتلغرام واضغط Start (أو Restart إذا كنت موقفه).','The bot can’t message you. Open it in Telegram and press Start (or Restart if you blocked it).');
    return t('تلغرام رفض الرسالة: ','Telegram refused the message: ') + (reason || r.code || '?');
  }
  function alertActions(event, root) {
    const find = event.target.closest('[data-admin-alert-find]'), test = event.target.closest('[data-admin-alert-test]'), clear = event.target.closest('[data-admin-alert-clear]'), alerts = api().orderAlerts;
    if (!alerts || (!find && !test && !clear)) return false;
    if (clear) { alerts.clear(); refreshAdmin(root,'settings'); if (typeof api().toast==='function') api().toast(t('توقفت تنبيهات الطلبات على هذا المتصفح.','Order alerts are off on this browser.')); return true; }
    const form = (find || test).closest('form'), button = find || test; button.disabled = true;
    if (find) {
      feedback(form,t('بدوّر…','Looking…'),false);
      alerts.findChat(form.elements.namedItem('tgToken').value).then(r => {
        button.disabled = false;
        if (r.chatId) { form.elements.namedItem('tgChat').value = r.chatId; feedback(form,t('لقيناه: ','Found: ') + (r.name ? r.name + ' · ' : '') + r.chatId + t('. اضغط حفظ.','. Now press Save.'),false); return; }
        feedback(form,r.error==='token' ? t('التوكن مش صحيح. انسخه كامل من رسالة BotFather.','That token isn’t valid. Copy the whole token from BotFather’s message.') : r.error==='nostart' ? t('افتح البوت تبعك بتلغرام واضغط Start أو ابعتله أي رسالة، وبعدين جرّب كمان مرة.','Open your bot in Telegram and press Start (or send it any message), then try again.') : t('ما قدرنا نوصل لتلغرام. تأكد من الإنترنت وجرّب كمان مرة.','Couldn’t reach Telegram. Check the connection and try again.'),true);
      });
      return true;
    }
    feedback(form,t('جاري الإرسال…','Sending…'),false);
    alerts.test().then(r => {
      button.disabled = false;
      feedback(form,r.status==='delivered' ? t('وصلت ✓ ','Delivered ✓ ') + (r.bot ? t('من البوت @','from @') + r.bot + '. ' : '') + t('شيّك تلغرام.','Check Telegram.') : r.status==='sent' ? t('انبعتت لـ CallMeBot. لازم توصلك على الواتس خلال دقيقة، وإذا ما وصلت راجع الرقم والمفتاح.','Sent to CallMeBot. It should reach your WhatsApp within a minute; if not, check the number and key.') : alertProblem(r),r.status!=='delivered' && r.status!=='sent');
    });
    return true;
  }
  function alertsSubmit(form, root) {
    const data = new FormData(form), channel = alertChannel(form), alerts = api().orderAlerts; if (!alerts) return;
    if (channel==='telegram' && !String(data.get('tgChat')||'').trim() && String(data.get('tgToken')||'').trim()) { feedback(form,t('اضغط «جيب الـ Chat ID» أول، وبعدين حفظ.','Press “Find my chat ID” first, then Save.'),true); return; }
    const ok = alerts.save(channel==='telegram' ? {channel,token:data.get('tgToken'),chatId:data.get('tgChat')} : {channel,phone:data.get('waPhone'),apikey:data.get('waKey')});
    if (!ok) { feedback(form,channel==='telegram' ? t('راجع التوكن والـ Chat ID: التوكن من BotFather، والـ Chat ID أرقام.','Check the token and chat ID: the token from BotFather, the chat ID in digits.') : t('راجع الرقم والمفتاح: الرقم مثل ‎+9627XXXXXXXX‎، والمفتاح من رسالة CallMeBot.','Check the number and key: the number like +9627XXXXXXXX, the key from the CallMeBot message.'),true); return; }
    refreshAdmin(root,'settings');
    feedback(root.querySelector('[data-admin-alerts] form'),t('انحفظت. اضغط «ابعت رسالة تجربة».','Saved. Now press “Send a test message”.'),false);
    if (typeof api().toast==='function') api().toast(t('انحفظت تنبيهات الطلبات.','Order alerts saved.'));
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
    if(id) { adminFilter={q:'',stock:'all'}; const target=products().find(p => p.id===id); if(target && target.category && !(adminCategory==='used-like-new' && productCondition(target)==='used-like-new')) adminCategory=target.category; }
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
    const categoryTab=event.target.closest('[data-admin-category]');
    if(categoryTab) { adminCategory=categoryTab.dataset.adminCategory; adminFilter={q:'',stock:'all'}; const q=root.querySelector('[data-admin-filter-q]'); if(q) q.value=''; applyAdminFilter(root); categoryTab.focus({preventScroll:true}); return true; }
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
      if(add && typeof api().addProduct==='function') result=api().addProduct({name:t('جهاز جديد','New device'),category:deviceCategories().some(category=>category[0]===adminCategory)?adminCategory:'mac',condition:adminCategory==='used-like-new'?'used-like-new':'new',chip:'',ram:'',storage:'',screen:'',basePrice:1,availability:'demo',hidden:true,descriptionAr:'',descriptionEn:'',image:'',ramOptions:[],storageOptions:[],colors:[{name:'Graphite',hex:'#535966'}]});
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
      if(scope==='checkout') { patch.ammanFee=Number(patch.ammanFee);patch.otherFee=Number(patch.otherFee); if(form.querySelector('[name=ordersOn]')) patch.ordersOn=data.has('ordersOn'); else delete patch.ordersOn; }
    }
    if(Object.entries(patch).some(([name,value])=>(name==='image'||name.endsWith('Image')||scope==='media') && !safeImage(value))) { feedback(form,t('رابط الصورة غير صالح. استخدم http/https أو assets/ أو ارفع صورة.','Invalid image URL. Use http/https, assets/ or upload an image.'),true); return; }
    if(scope==='brand' && ['instagram','maps'].some(name=>patch[name] && !/^https?:\/\//i.test(patch[name]))) { feedback(form,t('روابط التواصل يجب أن تبدأ بـ https:// أو http://.','Contact links must begin with https:// or http://.'),true);return; }
    if(typeof api().updateSettings!=='function') { feedback(form,t('خدمة التخصيص غير متاحة.','Customization is unavailable.'),true);return; }
    saveResult(form,api().updateSettings({[scope]:patch}),t('تم حفظ التخصيص على هذا المتصفح.','Customization saved on this browser.'));
  }
  function bind(root) {
    if (!root || boundRoots.has(root)) return;
    boundRoots.add(root);
    root.addEventListener('click', event => {
      if(alertActions(event,root)) return;
      if(filterActions(event,root)) return;
      if(stockToggle(event,root)) return;
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
      const search=event.target.closest('[data-admin-filter-q]'); if(search){adminFilter.q=search.value;applyAdminFilter(root);return;}
      const input=event.target.closest('.admin-media-field input[name]'); if(input) updateImagePreview(input.closest('.admin-media-field'),input.value.trim());
    });
    root.addEventListener('change',event=>{
      if(event.target.matches('[data-admin-product-form] [name="condition"], [data-admin-product-form] [name="batteryUse"]'))updateUsedBatteryFields(event.target.closest('form'));
      const alertChoice=event.target.closest('[data-admin-alerts-form] input[name=channel]'); if(alertChoice){showAlertChannel(alertChoice.form);return;}
      const lowInput=event.target.closest('[data-admin-lowstock-input]'); if(lowInput){const n=Number(lowInput.value);if(!Number.isInteger(n)||n<0||n>100||typeof api().updateSettings!=='function'||api().updateSettings({inventory:{lowStockBelow:n}})===false){lowInput.value=lowStockBelow();if(typeof api().toast==='function')api().toast(t('اكتب رقم صحيح من 0 لـ 100.','Enter a whole number from 0 to 100.'));return;}const byId=new Map(products().map(p=>[p.id,p]));root.querySelectorAll('[data-admin-stock]').forEach(el=>{const p=byId.get(el.dataset.adminStock);if(p)el.outerHTML=stockPillAdmin(p);});applyAdminFilter(root);if(typeof api().toast==='function')api().toast(n?t('رح ننبّهك لما كمية أي جهاز تصير أقل من ','You’ll be alerted when any device drops below ')+n+'.':t('وقّفنا تنبيه الكمية القليلة.','Low-stock alert turned off.'));return;}
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
      const alertsForm = event.target.closest('[data-admin-alerts-form]');
      if (alertsForm) { event.preventDefault(); alertsSubmit(alertsForm,root); return; }
      const form = event.target.closest('[data-admin-product-form], [data-admin-order-form], [data-admin-settings-form], [data-admin-category-form]');
      if (!form) return;
      event.preventDefault();
      const feedback = form.querySelector('.admin-form-feedback');
      if (!form.reportValidity()) return;
      if(Number(form.dataset.imageLoading)>0){if(feedback)feedback.textContent=t('انتظر حتى تجهز الصورة قبل الحفظ.','Wait for the image to finish loading.');return;}
      if(form.hasAttribute('data-admin-category-form')) {categorySubmit(form,root);return;}
      if(form.hasAttribute('data-admin-settings-form')) {customizationSubmit(form);return;}
      const data = new FormData(form);
      if (form.hasAttribute('data-admin-product-form')) {
        const price = Number(data.get('price')), availability = String(data.get('availability')), condition = String(data.get('condition')||'new');
        if(!window.OneStyleConfig.conditions.some(option=>option.id===condition)){if(feedback)feedback.textContent=t('اختر حالة جهاز صحيحة.','Choose a valid device condition.');return;}
        if (!Number.isFinite(price) || price <= 0 || price > 100000 || !['demo','available','unavailable','on-order'].includes(availability)) { if (feedback) feedback.textContent = t('أدخل سعرًا صالحًا من 0.01 إلى 100,000 دينار.','Enter a valid price from 0.01 to 100,000 JOD.'); return; }
        if (typeof api().updateProduct !== 'function') return;
        const colors=readColors(data.get('colors')), ramOptions=readNumberOptions(data.get('ramOptions'),8192),storageOptions=readNumberOptions(data.get('storageOptions'),65536), image=String(data.get('image')||'').trim();
        if(colors===null || ramOptions===null || storageOptions===null){if(feedback)feedback.textContent=t('راجع الألوان وخيارات الذاكرة والتخزين حسب الأمثلة المكتوبة.','Check colours, RAM and storage options against the examples.');return;}
        if(!safeImage(image)){if(feedback)feedback.textContent=t('رابط الصورة غير صالح.','Invalid image URL.');return;}
        const offerText=String(data.get('offerPrice')||'').trim(), offer=offerText===''?null:Number(offerText);
        if(offer!==null&&(!Number.isFinite(offer)||offer<=0||offer>=price)){if(feedback)feedback.textContent=t('سعر العرض لازم يكون أقل من السعر الأصلي، أو اتركه فاضي.','The offer price must be below the regular price, or left empty.');return;}
        const batteryUse=String(data.get('batteryUse')||'mixed'), batteryText=String(data.get('batteryHours')||'').trim(), batteryHours=batteryUse==='none'||batteryText===''?null:Number(batteryText);
        if(!['web','video','listening','mixed','none'].includes(batteryUse)||(batteryHours!==null&&(!Number.isFinite(batteryHours)||batteryHours<=0||batteryHours>1000))){if(feedback)feedback.textContent=t('أدخل مدة بطارية صالحة حتى 1,000 ساعة، أو اتركها فارغة إذا كانت غير معروفة.','Enter a valid battery runtime up to 1,000 hours, or leave empty if unknown.');return;}
        const usedBattery=condition==='used-like-new'&&batteryUse!=='none', healthText=String(data.get('batteryHealth')||'').trim(), cyclesText=String(data.get('batteryCycles')||'').trim();
        const batteryHealth=!usedBattery||healthText===''?null:Number(healthText), batteryCycles=!usedBattery||cyclesText===''?null:Number(cyclesText);
        if((batteryHealth!==null&&(!Number.isInteger(batteryHealth)||batteryHealth<0||batteryHealth>100))||(batteryCycles!==null&&(!Number.isInteger(batteryCycles)||batteryCycles<0||batteryCycles>100000))){if(feedback)feedback.textContent=t('أدخل صحة البطارية من 0 إلى 100% وعدد دورات شحن صحيحًا من 0 إلى 100,000، أو اترك القيمة فارغة إذا كانت غير معروفة.','Enter battery health from 0 to 100% and a whole cycle count from 0 to 100,000, or leave unknown values empty.');return;}
        const countText=String(data.get('stockCount')||'').trim(), stockCount=countText===''?null:Number(countText);
        if(stockCount!==null&&(!Number.isInteger(stockCount)||stockCount<0||stockCount>100000)){if(feedback)feedback.textContent=t('الكمية لازم تكون رقم صحيح من 0 لـ 100,000، أو اتركها فاضية.','The quantity must be a whole number from 0 to 100,000, or left empty.');return;}
        const patch={stockCount,basePrice:Math.round(price*100)/100,offerPrice:offer===null?null:Math.round(offer*100)/100,availability,condition,colors,ramOptions,storageOptions,image,batteryHours,batteryUse,batteryHealth,batteryCycles,hidden:data.has('hidden')};
        ['name','descriptionAr','descriptionEn','category','chip','cpu','network','ram','storage','screen'].forEach(name=>{patch[name]=String(data.get(name)||'').trim();});
        const id=form.getAttribute('data-admin-product-form'), previous=products().find(product=>product.id===id);
        const saved = api().updateProduct(id, patch);
        if (saved === false) { if (feedback) feedback.textContent = t('تعذر حفظ الجهاز. راجع البيانات، أو جرّب صورة أصغر إذا كانت مساحة المتصفح ممتلئة.','Unable to save the device. Check the values, or try a smaller image if browser storage is full.'); return; }
        const card=form.closest('.admin-product'), title=card&&card.querySelector('.admin-product-head h2'), specs=card&&(card.querySelector('.admin-product-head p bdi')||card.querySelector('.admin-product-head p'));
        if(title)title.textContent=patch.name; if(specs)specs.textContent=[patch.chip,patch.ram,patch.storage].filter(Boolean).join(' · ');
        const savedProduct=products().find(product=>product.id===id), stockRow=card&&card.querySelector('[data-admin-stock]'); if(savedProduct&&stockRow){stockRow.outerHTML=stockPillAdmin(savedProduct);const select=form.querySelector('select[name=availability]');if(select)select.value=availabilityValue(savedProduct);applyAdminFilter(root,id);}
        const message = t('تم حفظ بيانات الجهاز في هذه المعاينة.','Device details saved in this preview.');
        if (feedback) feedback.textContent = message;
        if (typeof api().toast === 'function') api().toast(message);
        if(previous && (previous.category!==patch.category || productCondition(previous)!==condition || previous.batteryUse!==batteryUse)){
          refreshAdmin(root,'products',id);
          const savedForm=Array.from(root.querySelectorAll('[data-admin-product-form]')).find(item=>item.dataset.adminProductForm===id), savedFeedback=savedForm&&savedForm.querySelector('.admin-form-feedback');
          if(savedFeedback)savedFeedback.textContent=message;
        }
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
