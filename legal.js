/* Privacy Policy and Terms & Conditions, in Arabic and English.
   One source for the storefront (app.js) and the live Worker's search-engine pages (pages.js).
   {shop}, {phone} and {address} are filled in from the shop's settings. Edit the text here only. */
(function () {
  const UPDATED = '2026-10-26';

  const privacy = {
    title: ['سياسة الخصوصية', 'Privacy Policy'],
    intro: [
      'توضّح هذه السياسة كيف يجمع متجر {shop} بياناتك الشخصية ويستخدمها ويحميها عند استخدامك لهذا الموقع أو الطلب منه، وفقًا لقانون حماية البيانات الشخصية الأردني رقم 24 لسنة 2023.',
      'This policy explains how {shop} collects, uses and protects your personal data when you use this website or order from it, in line with Jordan\'s Personal Data Protection Law No. 24 of 2023.',
    ],
    sections: [
      { h: ['من نحن', 'Who we are'], body: [
        ['{shop} متجر لبيع وصيانة أجهزة Apple، عنوانه: {address}، الأردن. نحن الجهة المسؤولة عن بياناتك على هذا الموقع، ويمكنك التواصل معنا على الرقم {phone} أو بزيارة المحل.',
          '{shop} sells and repairs Apple devices at {address}, Jordan. We are responsible for your data on this website. You can reach us on {phone} or at the shop.'],
      ] },
      { h: ['البيانات التي نجمعها', 'What we collect'], body: [
        { list: [
          ['عند إنشاء حساب: الاسم، البريد الإلكتروني، رقم الموبايل (اختياري)، وكلمة السر التي نحفظها بصيغة مشفّرة باتجاه واحد فلا يمكن لأحد قراءتها، ولا حتى نحن.',
            'When you create an account: your name, email, mobile number (optional) and password. The password is stored only as a one-way hash, so nobody, including us, can read it.'],
          ['عند الطلب: الاسم، رقم الموبايل، طريقة الاستلام، المدينة والعنوان عند التوصيل، الملاحظات، الأجهزة المطلوبة وأسعارها، وحالة الطلب.',
            'When you order: your name, mobile number, delivery or collection choice, city and address for delivery, notes, the devices you ordered with their prices, and the order status.'],
          ['بيانات تقنية لحماية الموقع: نحفظ بصمة مشفّرة لعنوان اتصالك (IP) لمنع الإساءة والطلبات الوهمية، وتُحذف خلال يوم تقريبًا. قد يعالج مزوّد الاستضافة بيانات الطلبات التقنية المعتادة لأغراض الأمان.',
            'Technical data that protects the site: a hashed form of your connection (IP) address, used to stop abuse and fake orders, deleted within about a day. Our hosting provider may process standard request data for security.'],
          ['على جهازك: يحفظ المتصفح لغتك، سلة المشتريات، المقارنة، ومسودة بيانات الطلب، وملف تعريف ارتباط (cookie) لتسجيل الدخول فقط عندما تكون مسجّلًا. لا نستخدم أدوات إعلانات أو تتبّع أو تحليلات.',
            'On your device: your browser keeps your language, bag, comparison and a checkout draft, plus a sign-in cookie only while you are signed in. We use no advertising, tracking or analytics tools.'],
          ['إذا تواصلت معنا عبر واتساب أو الهاتف أو إنستغرام، فإن ما ترسله يخضع أيضًا لسياسات تلك الخدمات.',
            'If you contact us on WhatsApp, by phone or on Instagram, what you send is also covered by those services\' own policies.'],
        ] },
      ] },
      { h: ['لماذا نستخدم بياناتك', 'Why we use it'], body: [
        { list: [
          ['لتنفيذ طلبك وتوصيله، والاتصال بك لتأكيده.', 'To process and deliver your order and call you to confirm it.'],
          ['لإدارة حسابك وعرض طلباتك السابقة.', 'To run your account and show your past orders.'],
          ['لإرسال رسائل البريد الضرورية فقط، مثل رابط إعادة تعيين كلمة السر.', 'To send necessary emails only, such as password-reset links.'],
          ['لتقديم خدمة الصيانة والضمان المتعلقة بأجهزتك.', 'To provide repair and warranty service for your devices.'],
          ['لحماية الموقع من الإساءة، والالتزام بالقوانين والسجلات المحاسبية.', 'To protect the site from abuse and to meet legal and accounting duties.'],
        ] },
        ['لا نبيع بياناتك، ولا نرسل لك رسائل تسويقية إلا بموافقة منفصلة منك.', 'We never sell your data, and we do not send you marketing without your separate consent.'],
      ] },
      { h: ['موافقتك', 'Your consent'], body: [
        ['نعالج بياناتك بناءً على موافقتك عند إنشاء الحساب أو إرسال الطلب، وبالقدر اللازم لتنفيذ طلبك أو الالتزام بالقانون. يمكنك سحب موافقتك في أي وقت بالتواصل معنا، دون أن يؤثر ذلك على ما تمّ قبل السحب، وقد نحتفظ بسجلات الطلبات التي يلزمنا القانون بحفظها.',
          'We process your data on the basis of the consent you give when you create an account or place an order, and as needed to fulfil your order or comply with the law. You can withdraw consent at any time by contacting us. This does not affect what happened before, and we may keep order records that the law requires us to keep.'],
      ] },
      { h: ['من يطّلع على بياناتك', 'Who receives your data'], body: [
        { list: [
          ['فريق المحل المخوّل فقط، من خلال لوحة إدارة محمية بكلمة سر.', 'Authorised shop staff only, through a password-protected admin panel.'],
          ['مندوب التوصيل: الاسم ورقم الموبايل والعنوان فقط، لتسليم طلبك.', 'The delivery driver: only your name, mobile number and address, to hand over your order.'],
          ['Cloudflare: استضافة الموقع وقاعدة البيانات.', 'Cloudflare: hosts the website and its database.'],
          ['Resend: إرسال رسائل البريد مثل إعادة تعيين كلمة السر (يستلم بريدك الإلكتروني فقط).', 'Resend: sends emails such as password resets (receives your email address only).'],
          ['Telegram: تصل للمحل تنبيهات بالطلبات الجديدة تحتوي رقم الطلب والأجهزة والمجموع فقط، دون اسمك أو رقمك أو عنوانك.', 'Telegram: the shop receives new-order alerts with the order number, devices and total only, never your name, number or address.'],
          ['الجهات الرسمية، فقط عندما يفرض القانون ذلك.', 'Authorities, only when the law requires it.'],
        ] },
        ['قد يعالج بعض مزوّدي الخدمة البيانات على خوادم خارج الأردن، ونختار مزوّدين يطبّقون حماية أمنية قوية لبياناتك.',
          'Some providers may process data on servers outside Jordan. We choose providers that apply strong security protection to your data.'],
      ] },
      { h: ['مدة الاحتفاظ', 'How long we keep it'], body: [
        { list: [
          ['الحساب: حتى تطلب حذفه.', 'Your account: until you ask us to delete it.'],
          ['الطلبات: طالما احتجنا إليها لخدمتك وللضمان والسجلات التي يتطلبها القانون.', 'Orders: as long as needed to serve you, for warranty, and for records the law requires.'],
          ['رابط إعادة تعيين كلمة السر: ينتهي خلال 30 دقيقة ويعمل مرة واحدة.', 'Password-reset links: expire after 30 minutes and work once.'],
          ['جلسة الدخول: تنتهي عند تسجيل الخروج أو بعد انتهاء مدتها.', 'Sign-in sessions: end when you sign out or when they expire.'],
          ['سجلات الحماية من الإساءة: نحو يوم واحد.', 'Abuse-protection records: about one day.'],
        ] },
      ] },
      { h: ['حماية بياناتك', 'How we protect it'], body: [
        ['الموقع يعمل عبر اتصال مشفّر (HTTPS)، وكلمات السر ورموز الجلسات محفوظة بصيغة مشفّرة، والوصول إلى الطلبات مقصور على فريق المحل. لا يوجد نظام آمن بالكامل؛ وإذا حدث اختراق قد يسبب لك ضررًا جسيمًا سنبلغك ونبلغ الجهات المختصة كما يفرض القانون.',
          'The site runs over an encrypted connection (HTTPS), passwords and session tokens are stored hashed, and access to orders is limited to shop staff. No system is perfectly secure. If a breach could seriously harm you, we will tell you and the authorities as the law requires.'],
      ] },
      { h: ['حقوقك', 'Your rights'], body: [
        { list: [
          ['الاطلاع على بياناتك والحصول على نسخة منها.', 'See your data and get a copy of it.'],
          ['تصحيحها أو تحديثها (يمكنك تعديل اسمك ورقمك من صفحة «حسابي»).', 'Correct or update it (you can edit your name and mobile in My account).'],
          ['طلب حذفها، ضمن ما يسمح به القانون.', 'Ask us to delete it, within what the law allows.'],
          ['الاعتراض على معالجتها أو سحب موافقتك.', 'Object to its processing or withdraw your consent.'],
          ['إبلاغك بأي اختراق يمس بياناتك.', 'Be told of any breach affecting your data.'],
        ] },
        ['لممارسة أي من هذه الحقوق تواصل معنا على {phone} أو زرنا في المحل. قد نطلب التحقق من هويتك قبل تنفيذ الطلب. ويحق لك تقديم شكوى إلى وحدة حماية البيانات الشخصية في وزارة الاقتصاد الرقمي والريادة.',
          'To use any of these rights, contact us on {phone} or visit the shop. We may need to confirm your identity first. You may also complain to the Personal Data Protection Unit at the Ministry of Digital Economy and Entrepreneurship.'],
      ] },
      { h: ['من هم دون 18 سنة', 'Under 18s'], body: [
        ['الموقع غير موجّه لمن هم دون 18 سنة. إذا كنت دون هذا العمر فاطلب من أحد والديك أو وليّ أمرك إتمام الطلب.',
          'The site is not aimed at people under 18. If you are under 18, ask a parent or guardian to place the order.'],
      ] },
      { h: ['تعديل هذه السياسة', 'Changes to this policy'], body: [
        ['قد نحدّث هذه السياسة من وقت لآخر، وسيظهر تاريخ آخر تحديث أعلى الصفحة.', 'We may update this policy from time to time. The date of the latest update appears at the top of this page.'],
      ] },
    ],
  };

  const terms = {
    title: ['الشروط والأحكام', 'Terms & Conditions'],
    intro: [
      'تنظّم هذه الشروط استخدامك لموقع {shop} وطلب الأجهزة والخدمات منه. باستخدامك للموقع أو إرسالك طلبًا فإنك توافق عليها، فاقرأها بعناية.',
      'These terms govern your use of the {shop} website and ordering devices and services from it. By using the site or placing an order you agree to them, so please read them carefully.',
    ],
    sections: [
      { h: ['عن المتجر', 'About us'], body: [
        ['{shop} متجر مستقل لبيع وصيانة أجهزة Apple، عنوانه: {address}، الأردن، ورقمه {phone}. لسنا تابعين لشركة Apple؛ وApple وأسماء منتجاتها علامات تجارية لشركة Apple Inc.',
          '{shop} is an independent seller and repairer of Apple devices at {address}, Jordan, phone {phone}. We are not affiliated with Apple. Apple and its product names are trademarks of Apple Inc.'],
      ] },
      { h: ['الأجهزة والمعلومات', 'Devices and information'], body: [
        ['نبيع أجهزة جديدة وأجهزة مستعملة بحالة ممتازة «كالجديدة». نوضّح حالة الجهاز، وصحة البطارية وعدد دورات الشحن عند توفرها. الصور توضيحية وقد تختلف الألوان قليلًا حسب الشاشة. نحرص على دقة المعلومات، وإذا وجدنا خطأً فسنصحّحه ونخبرك قبل تأكيد طلبك.',
          'We sell new devices and used devices in "like new" condition. We show each device\'s condition, and its battery health and charge cycles where available. Photos are illustrative and colours may look slightly different on your screen. We work to keep information accurate, and if we find a mistake we will correct it and tell you before confirming your order.'],
      ] },
      { h: ['الأسعار', 'Prices'], body: [
        ['الأسعار بالدينار الأردني، ورسوم التوصيل تظهر بشكل منفصل عند إتمام الطلب. قد تتغير الأسعار والتوفّر قبل تأكيد الطلب، والسعر المعتمد هو السعر الذي نؤكده معك عند الاتصال.',
          'Prices are in Jordanian dinars, and the delivery fee is shown separately at checkout. Prices and availability may change before your order is confirmed. The price that applies is the one we confirm with you on the call.'],
      ] },
      { h: ['الطلب والتأكيد', 'Orders and confirmation'], body: [
        ['إرسال الطلب من الموقع هو طلب شراء وليس بيعًا نهائيًا. نتصل بك لتأكيد التوفّر والسعر وموعد التسليم، ويصبح الطلب مؤكدًا بعد هذا الاتصال. يحق لنا رفض الطلب أو إلغاؤه إذا نفد الجهاز، أو كان هناك خطأ واضح في السعر، أو تعذّر التواصل معك، أو اشتبهنا بطلب وهمي، ولن تدفع شيئًا في هذه الحالات.',
          'Sending an order on the site is a request to buy, not a final sale. We call you to confirm availability, price and delivery time, and the order is confirmed after that call. We may decline or cancel an order if the device is out of stock, the price is clearly wrong, we cannot reach you, or the order looks fake. You pay nothing in those cases.'],
      ] },
      { h: ['الدفع', 'Payment'], body: [
        ['الدفع نقدًا عند الاستلام، سواء بالتوصيل أو من المحل. لا يوجد دفع إلكتروني على الموقع، ولن نطلب منك أبدًا معلومات بطاقتك البنكية برسالة أو اتصال.',
          'Payment is cash on delivery or on collection at the shop. There is no online payment on the site, and we will never ask for your card details by message or phone.'],
      ] },
      { h: ['التوصيل والاستلام', 'Delivery and collection'], body: [
        ['نوصّل داخل عمّان وإلى المحافظات الأخرى، وتظهر الرسوم عند إتمام الطلب. مواعيد التوصيل تقديرية ونتفق عليها معك عند التأكيد. يمكنك أيضًا الاستلام من المحل. افحص الجهاز عند الاستلام وأخبرنا فورًا بأي ملاحظة.',
          'We deliver within Amman and to other governorates, and the fee is shown at checkout. Delivery times are estimates that we agree with you when confirming. You can also collect from the shop. Please check the device when you receive it and tell us straight away about anything wrong.'],
      ] },
      { h: ['إلغاء الطلب', 'Cancelling an order'], body: [
        ['يمكنك إلغاء طلبك مجانًا قبل خروجه للتوصيل بالاتصال بنا على {phone}.', 'You can cancel your order free of charge before it leaves for delivery by calling us on {phone}.'],
      ] },
      { h: ['الضمان والإرجاع والاستبدال', 'Warranty, returns and exchanges'], body: [
        ['يختلف الضمان ومدته حسب الجهاز (جديد أو مستعمل)، ونوضّحه لك عند تأكيد الطلب وعلى الفاتورة. أبلغنا بأي عطل أو اختلاف عن الوصف في أسرع وقت وضمن المدة المذكورة على فاتورتك. لا يشمل الضمان الأضرار الناتجة عن السقوط أو السوائل أو سوء الاستخدام أو الصيانة لدى جهة أخرى. الإرجاع والاستبدال وفق السياسة التي نؤكدها مع طلبك.',
          'Warranty cover and its length depend on the device (new or used). We explain it when confirming your order and on your invoice. Tell us about any fault, or anything that differs from the description, as soon as possible and within the period on your invoice. The warranty does not cover damage from drops, liquids, misuse or repairs elsewhere. Returns and exchanges follow the policy we confirm with your order.'],
        ['لا يحدّ أي شيء في هذه الشروط من حقوقك بموجب قوانين حماية المستهلك في الأردن.', 'Nothing in these terms limits your rights under Jordanian consumer protection law.'],
      ] },
      { h: ['الصيانة', 'Repairs'], body: [
        ['نفحص الجهاز ونخبرك بالتكلفة والمدة المتوقعة قبل البدء بأي إصلاح، ولا نبدأ إلا بموافقتك. نوضّح لك نوع القطع المستخدمة قبل التركيب. خذ نسخة احتياطية من بياناتك قبل تسليم الجهاز، فقد تتطلب بعض الإصلاحات مسح البيانات، ولسنا مسؤولين عن فقدانها.',
          'We check the device and tell you the expected cost and time before starting any repair, and we only start with your approval. We tell you what kind of parts we will use before fitting them. Back up your data before handing over a device: some repairs require erasing it, and we are not responsible for lost data.'],
      ] },
      { h: ['حسابك', 'Your account'], body: [
        ['أدخل معلومات صحيحة وحافظ على سرية كلمة السر، فأنت مسؤول عما يتم من خلال حسابك. يحق لنا إيقاف أي حساب يُستخدم لطلبات وهمية أو للإساءة.',
          'Give accurate information and keep your password secret: you are responsible for what happens through your account. We may suspend any account used for fake orders or abuse.'],
      ] },
      { h: ['الاستخدام المقبول', 'Acceptable use'], body: [
        ['يُمنع إرسال طلبات وهمية، أو محاولة اختراق الموقع أو تعطيله، أو نسخ محتواه آليًا، أو استخدامه لأي غرض مخالف للقانون.',
          'Do not place fake orders, try to break into or disrupt the site, copy its content automatically, or use it for anything unlawful.'],
      ] },
      { h: ['حدود المسؤولية', 'Liability'], body: [
        ['بالقدر الذي يسمح به القانون، لسنا مسؤولين عن الخسائر غير المباشرة، ولا تتجاوز مسؤوليتنا عن أي طلب قيمة ذلك الطلب. لا يستثني هذا أي مسؤولية لا يجيز القانون استثناءها.',
          'As far as the law allows, we are not liable for indirect losses, and our liability for any order is limited to the value of that order. This does not exclude any liability that the law does not allow us to exclude.'],
      ] },
      { h: ['الملكية الفكرية', 'Intellectual property'], body: [
        ['محتوى الموقع وتصميمه ملك لـ {shop}، ولا يجوز نسخه أو إعادة استخدامه دون إذن.', 'The site\'s content and design belong to {shop} and may not be copied or reused without permission.'],
      ] },
      { h: ['القانون المطبّق', 'Governing law'], body: [
        ['تخضع هذه الشروط للقوانين الأردنية، وتختص محاكم عمّان بأي نزاع ينشأ عنها.', 'These terms are governed by the laws of Jordan, and the courts of Amman have jurisdiction over any dispute.'],
      ] },
      { h: ['التعديلات والتواصل', 'Changes and contact'], body: [
        ['قد نعدّل هذه الشروط من وقت لآخر، ويسري التعديل على الطلبات الجديدة من تاريخ نشره. لأي سؤال تواصل معنا على {phone}. اقرأ أيضًا سياسة الخصوصية.',
          'We may change these terms from time to time. Changes apply to new orders from the date they are published. For any question, contact us on {phone}. Please also read our Privacy Policy.'],
      ] },
    ],
  };

  const DOCS = { privacy, terms };
  const escape = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // Escaped HTML for one document. brand: the shop's settings.brand. links(kind) gives the
  // address of the other document, so the page can point to it in the right language.
  function html(kind, lang, brand, links) {
    const doc = DOCS[kind];
    if (!doc) return '';
    const i = lang === 'ar' ? 0 : 1;
    const b = brand || {};
    const fill = (pair) => escape(pair[i])
      .replace(/\{shop\}/g, `<bdi>${escape(b.name || 'One Style')}</bdi>`)
      .replace(/\{phone\}/g, `<bdi dir="ltr">${escape(b.phone || '')}</bdi>`)
      .replace(/\{address\}/g, escape((lang === 'ar' ? b.addressAr : b.addressEn) || ''));
    const date = new Date(`${UPDATED}T12:00:00Z`).toLocaleDateString(lang === 'ar' ? 'ar-JO' : 'en-GB', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
    const other = kind === 'privacy' ? 'terms' : 'privacy';
    const body = doc.sections.map((s) => `<section><h2>${fill(s.h)}</h2>${s.body.map((part) => (part.list ? `<ul>${part.list.map((li) => `<li>${fill(li)}</li>`).join('')}</ul>` : `<p>${fill(part)}</p>`)).join('')}</section>`).join('');
    return `<h1>${fill(doc.title)}</h1><p class="legal-updated">${lang === 'ar' ? 'آخر تحديث' : 'Last updated'}: <time datetime="${UPDATED}">${escape(date)}</time></p><p class="legal-intro">${fill(doc.intro)}</p>${body}<p class="legal-other"><a href="${escape(links ? links(other) : `#/${other}`)}">${escape(DOCS[other].title[i])}</a></p>`;
  }

  window.OneStyleLegal = { updated: UPDATED, kinds: Object.keys(DOCS), title: (kind, lang) => (DOCS[kind] ? DOCS[kind].title[lang === 'ar' ? 0 : 1] : ''), intro: (kind, lang) => (DOCS[kind] ? DOCS[kind].intro[lang === 'ar' ? 0 : 1] : ''), html };
})();
