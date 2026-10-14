/* Editable public storefront content. Settings are validated as data, never HTML. */
(() => {
  'use strict';
  const data=window.ONE_STYLE_DATA;
  const clone=value=>JSON.parse(JSON.stringify(value));
  const defaults={
    brand:{...data.brand,taglineAr:'بيع وصيانة أجهزة Apple',taglineEn:'Apple device sales & service',logoImage:''},
    theme:{accent:'#2469e8',bg:'#f4f4f1',text:'#16181d',cardBg:'#ffffff',buttonRadius:9,fontSize:15},
    hero:{eyebrowAr:'متخصصون بأجهزة Apple · عمّان',eyebrowEn:'Apple specialists · Amman',titleAr:'جهازك الجاي.',titleEn:'Your next device.',highlightAr:'اختيارك الصح.',highlightEn:'Your kind of choice.',descriptionAr:'من أول فكرة لآخر مشروع. اكتشف أجهزة الماك، الآيفون والإكسسوارات، واختَر اللي يناسب يومك.',descriptionEn:'From the first idea to the final project. Discover Macs, iPhones and essentials that fit the way you work and live.',primaryAr:'استكشف الأجهزة',primaryEn:'Explore devices',secondaryAr:'ساعدني أختار',secondaryEn:'Help me choose',image:''},
    sections:{hero:true,categories:true,featured:true,guide:true,support:true},
    home:{featuredIds:['macbook-air-13-m2','macbook-pro-14-m1','iphone-15'],featuredTitleAr:'ابدأ من هون.',featuredTitleEn:'A good place to start.',categoriesTitleAr:'كل عالمك، بمكان واحد.',categoriesTitleEn:'Your world. In one place.',guideTitleAr:'مش كل شغل بدّه نفس الجهاز.',guideTitleEn:'Different days. Different devices.',guideDescriptionAr:'دراسة، برمجة ولا تصميم؟ جاوب سؤالين وشوف أقرب الخيارات لاستخدامك وميزانيتك.',guideDescriptionEn:'Study, coding or creative work? Answer two questions to explore options for your workflow and budget.',supportTitleAr:'معك بعد الاختيار.',supportTitleEn:'Beyond the purchase.',supportDescriptionAr:'المحل مختص ببيع وصيانة أجهزة Apple. شوف معلومات التواصل، واسأل عن الخدمة المناسبة لجهازك.',supportDescriptionEn:'One Style specialises in Apple-device sales and service. Explore contact details and ask about the service your device needs.'},
    guide:{titleAr:'خلّينا نختارها سوا.',titleEn:'Let’s find your fit.',descriptionAr:'سؤالين. خيارات أوضح.',descriptionEn:'Two questions. A clearer choice.'},
    nav:{homeAr:'الرئيسية',homeEn:'Home',shopAr:'تسوّق الأجهزة',shopEn:'Shop devices',guideAr:'اختَر جهازك',guideEn:'Find your Mac',serviceAr:'الصيانة والدعم',serviceEn:'Service & support',bagAr:'السلة',bagEn:'Bag'},
    footer:{descriptionAr:'أجهزتك، إكسسواراتك، وخطوتك الجاية.',descriptionEn:'Your devices, your essentials, your next move.'},
    checkout:{ammanFee:0,otherFee:5},
    media:{macbook:'assets/photos/macbook-studio.webp',iphone:'assets/photos/iphone-studio.webp',ipad:'assets/photos/ipad-studio.webp',airpods:'assets/photos/airpods-studio.webp',watch:'assets/photos/watch-studio.webp',accessories:'assets/photos/accessories-studio.webp'},
    pageTitles:{homeAr:'أجهزة Apple على ذوقك',homeEn:'Your next device',shopAr:'الأجهزة',shopEn:'Shop devices',guideAr:'اختَر جهازك',guideEn:'Find your Mac'}
  };
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  function imageSource(value){
    if(typeof value!=='string'||value.length>2100000)return false;
    if(value==='')return true;
    if(/^assets\/[a-zA-Z0-9_./%()\-]+$/.test(value)&&!value.split('/').includes('..'))return true;
    if(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))return true;
    try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}
  }
  function businessURL(value,key){if(value==='')return true;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return false;return key==='instagram'?['instagram.com','www.instagram.com'].includes(url.hostname):true;}catch{return false;}}
  const imageKeys=new Set(['logoImage','image','macbook','iphone','ipad','airpods','watch','accessories']);
  function normalizeSettings(patch,current=defaults){
    if(!plain(patch))throw Error('Invalid settings');
    const next=clone(current);
    for(const [group,values] of Object.entries(patch)){
      if(['__proto__','constructor','prototype'].includes(group)||!Object.hasOwn(defaults,group)||!plain(values))throw Error('Unknown settings group');
      for(const [key,value] of Object.entries(values)){
        if(['__proto__','constructor','prototype'].includes(key)||!Object.hasOwn(defaults[group],key))throw Error('Unknown settings field');
        const standard=defaults[group][key];
        if(typeof standard==='boolean'){if(typeof value!=='boolean')throw Error('Expected boolean');}
        else if(typeof standard==='number'){
          const limits=group==='theme'&&key==='buttonRadius'?[0,36]:group==='theme'&&key==='fontSize'?[14,22]:[0,100];
          if(!Number.isFinite(value)||value<limits[0]||value>limits[1])throw Error('Invalid number');
        }
        else if(Array.isArray(standard)){if(!Array.isArray(value)||value.length>12||value.some(id=>typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(id)))throw Error('Invalid selection');}
        else if(group==='theme'){if(!color(value))throw Error('Invalid color');}
        else if(imageKeys.has(key)){if(!imageSource(value))throw Error('Invalid image');}
        else {if(typeof value!=='string'||value.length>3000||/[\u0000-\u0008\u000b\u000c]/.test(value))throw Error('Invalid text');
          if(['name','titleAr','titleEn','primaryAr','primaryEn','phone','internationalPhone'].includes(key)&&!value.trim())throw Error('Required text');
          if(['instagram','maps'].includes(key)&&!businessURL(value,key))throw Error('Invalid business link');
          if(['phone','internationalPhone'].includes(key)&&!/^\+?[0-9 ()-]{7,24}$/.test(value))throw Error('Invalid phone');
        }
        next[group][key]=typeof value==='string'?value.trim():clone(value);
      }
    }
    return next;
  }
  function normalizeProduct(patch,existing){
    if(!plain(patch)||!existing)throw Error('Invalid product');
    const next=clone(existing);
    const keys=['name','descriptionAr','descriptionEn','category','chip','cpu','ram','storage','screen','network','basePrice','price','offerPrice','availability','hidden','image','colors','ramOptions','storageOptions'];
    for(const [key,value] of Object.entries(patch)){
      if(!keys.includes(key))throw Error('Unknown product field');
      if(key==='basePrice'||key==='price'){if(!Number.isFinite(value)||value<=0||value>100000)throw Error('Invalid price');next.basePrice=Math.round(value*100)/100;continue;}
      if(key==='offerPrice'){if(value===null||value===''){delete next.offerPrice;continue;}if(!Number.isFinite(value)||value<=0||value>100000)throw Error('Invalid offer');const offer=Math.round(value*100)/100;if(offer<.01)throw Error('Invalid offer');next.offerPrice=offer;continue;}
      if(key==='hidden'){if(typeof value!=='boolean')throw Error('Invalid visibility');}
      else if(key==='availability'){if(!['demo','available','on-order','unavailable'].includes(value))throw Error('Invalid stock');}
      else if(key==='category'){if(!['mac','iphone','ipad','audio','watch','accessories'].includes(value))throw Error('Invalid category');}
      else if(key==='image'){if(!imageSource(value))throw Error('Invalid image');}
      else if(key==='colors'){if(!Array.isArray(value)||value.length<1||value.length>12||value.some(c=>!plain(c)||typeof c.name!=='string'||!c.name.trim()||c.name.length>70||!color(c.hex)))throw Error('Invalid finishes');}
      else if(key==='ramOptions'||key==='storageOptions'){if(!Array.isArray(value)||value.length>12||value.some(n=>!Number.isInteger(n)||n<=0||n>8192)||new Set(value).size!==value.length)throw Error('Invalid configurations');}
      else if(typeof value!=='string'||value.length>3000||(key==='name'&&!value.trim()))throw Error('Invalid product text');
      next[key]=typeof value==='string'?value.trim():clone(value);
    }
    if(Object.hasOwn(next,'offerPrice')&&!(next.offerPrice<next.basePrice))throw Error('Offer must be below the price');
    const categoryArt={mac:'macbook',iphone:'iphone',ipad:'ipad',audio:'airpods',watch:'watch',accessories:'accessories'};
    next.art=categoryArt[next.category];next.demo=true;
    if(Array.isArray(next.ramOptions)&&next.ramOptions.length)next.ram=`${next.ramOptions[0]} GB`;
    if(Array.isArray(next.storageOptions)&&next.storageOptions.length)next.storage=next.storageOptions[0]===1024?'1 TB':`${next.storageOptions[0]} GB`;
    if(Array.isArray(next.ramOptions)&&!next.ramOptions.length)delete next.ramOptions;
    if(Array.isArray(next.storageOptions)&&!next.storageOptions.length)delete next.storageOptions;
    return next;
  }
  window.OneStyleConfig={defaults,normalizeSettings,normalizeProduct,imageSource,clone};
})();
