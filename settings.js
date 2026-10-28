/* Editable public storefront content. Settings are validated as data, never HTML. */
(() => {
  'use strict';
  const data=window.ONE_STYLE_DATA;
  const categories=[
    {id:'mac',labelAr:'MacBook',labelEn:'MacBook',art:'macbook'},
    {id:'iphone',labelAr:'iPhone',labelEn:'iPhone',art:'iphone'},
    {id:'ipad',labelAr:'iPad',labelEn:'iPad',art:'ipad'},
    {id:'audio',labelAr:'AirPods',labelEn:'AirPods',art:'airpods'},
    {id:'watch',labelAr:'Watch',labelEn:'Watch',art:'watch'},
    {id:'accessories',labelAr:'الإكسسوارات',labelEn:'Accessories',art:'accessories'}
  ];
  const conditions=[
    {id:'new',labelAr:'جديد',labelEn:'New'},
    {id:'used-like-new',labelAr:'مستعمل — كالجديد',labelEn:'Used — Like New'}
  ];
  const categoryList=(settings=defaults)=>[...categories,...Object.entries(settings.categories||{}).map(([id,category])=>({id,labelAr:category.labelAr,labelEn:category.labelEn,art:`category-${id}`,image:category.image}))];
  const categoryLabel=(id,lang='en',settings=defaults)=>{const category=categoryList(settings).find(c=>c.id===id);return category?category[lang==='ar'?'labelAr':'labelEn']:id;};
  const conditionLabel=(condition,lang='en')=>(conditions.find(c=>c.id===condition)||conditions[0])[lang==='ar'?'labelAr':'labelEn'];
  const clone=value=>JSON.parse(JSON.stringify(value));
  const defaults={
    brand:{...data.brand,taglineAr:'بيع وصيانة أجهزة Apple',taglineEn:'Apple device sales & service',logoImage:''},
    theme:{accent:'#2469e8',bg:'#f4f4f1',text:'#16181d',cardBg:'#ffffff',buttonRadius:9,fontSize:15},
    hero:{eyebrowAr:'متخصصون بأجهزة Apple · عمّان',eyebrowEn:'Apple specialists · Amman',titleAr:'جهازك الجاي.',titleEn:'Your next device.',highlightAr:'اختيارك الصح.',highlightEn:'Your kind of choice.',descriptionAr:'من أول فكرة لآخر مشروع. اكتشف أجهزة الماك، الآيفون والإكسسوارات، واختَر اللي يناسب يومك.',descriptionEn:'From the first idea to the final project. Discover Macs, iPhones and essentials that fit the way you work and live.',primaryAr:'استكشف الأجهزة',primaryEn:'Explore devices',secondaryAr:'ساعدني أختار',secondaryEn:'Help me choose',image:'',iphoneImage:'',ipadImage:'',airpodsImage:''},
    sections:{hero:true,categories:true,featured:true,guide:true,support:true},
    home:{featuredIds:['macbook-air-13-m2','macbook-pro-14-m1','iphone-15'],featuredTitleAr:'ابدأ من هون.',featuredTitleEn:'A good place to start.',categoriesTitleAr:'كل عالمك، بمكان واحد.',categoriesTitleEn:'Your world. In one place.',guideTitleAr:'مش كل شغل بدّه نفس الجهاز.',guideTitleEn:'Different days. Different devices.',guideDescriptionAr:'دراسة، برمجة ولا تصميم؟ جاوب سؤالين وشوف أقرب الخيارات لاستخدامك وميزانيتك.',guideDescriptionEn:'Study, coding or creative work? Answer two questions to explore options for your workflow and budget.',supportTitleAr:'معك بعد الاختيار.',supportTitleEn:'Beyond the purchase.',supportDescriptionAr:'المحل مختص ببيع وصيانة أجهزة Apple. شوف معلومات التواصل، واسأل عن الخدمة المناسبة لجهازك.',supportDescriptionEn:'One Style specialises in Apple-device sales and service. Explore contact details and ask about the service your device needs.'},
    guide:{titleAr:'خلّينا نختارها سوا.',titleEn:'Let’s find your fit.',descriptionAr:'سؤالين. خيارات أوضح.',descriptionEn:'Two questions. A clearer choice.'},
    nav:{homeAr:'الرئيسية',homeEn:'Home',shopAr:'تسوّق الأجهزة',shopEn:'Shop devices',guideAr:'اختَر جهازك',guideEn:'Find your Mac',serviceAr:'الصيانة والدعم',serviceEn:'Service & support',bagAr:'السلة',bagEn:'Bag'},
    footer:{descriptionAr:'أجهزتك، إكسسواراتك، وخطوتك الجاية.',descriptionEn:'Your devices, your essentials, your next move.'},
    checkout:{ammanFee:0,otherFee:5,ordersOn:false,searchOn:false},
    inventory:{lowStockBelow:3},
    media:{macbook:'assets/photos/macbook-studio.webp',iphone:'assets/photos/iphone-studio.webp',ipad:'assets/photos/ipad-studio.webp',airpods:'assets/photos/airpods-studio.webp',watch:'assets/photos/watch-studio.webp',accessories:'assets/photos/accessories-studio.webp'},
    pageTitles:{homeAr:'أجهزة Apple على ذوقك',homeEn:'Your next device',shopAr:'الأجهزة',shopEn:'Shop devices',guideAr:'اختَر جهازك',guideEn:'Find your Mac'},
    categories:{}
  };
  const plain=value=>value!==null&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype;
  const color=value=>typeof value==='string'&&/^#[0-9a-f]{6}$/i.test(value);
  function imageSource(value){
    if(typeof value!=='string'||value.length>2100000)return false;
    if(value==='')return true;
    if(/^assets\/[a-zA-Z0-9_./%()\-]+$/.test(value)&&!value.split('/').includes('..'))return true;
    if(/^data:image\/(png|jpeg|webp);base64,[a-zA-Z0-9+/=]+$/.test(value))return true;
    if(/^api\/photo\/[a-f0-9]{32}$/.test(value))return true;
    try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password;}catch{return false;}
  }
  function businessURL(value,key){if(value==='')return true;try{const url=new URL(value);if(url.protocol!=='https:'||url.username||url.password)return false;return key==='instagram'?['instagram.com','www.instagram.com'].includes(url.hostname):true;}catch{return false;}}
  const imageKeys=new Set(['logoImage','image','iphoneImage','ipadImage','airpodsImage','macbook','iphone','ipad','airpods','watch','accessories']);
  const reservedCategoryIds=new Set(['all','used-like-new','__proto__','constructor','prototype',...categories.map(category=>category.id)]);
  function normalizeCategories(values){
    if(!plain(values)||Object.keys(values).length>24)throw Error('Invalid categories');
    const next={};
    const usedLikeNew=conditions.find(condition=>condition.id==='used-like-new');
    const labels=new Set([...categories.flatMap(category=>[category.labelAr,category.labelEn]),'All devices','كل الأجهزة',usedLikeNew.labelAr,usedLikeNew.labelEn].map(label=>label.trim().toLowerCase()));
    for(const [id,category] of Object.entries(values)){
      if(id.length>60||!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)||reservedCategoryIds.has(id))throw Error('Invalid category ID');
      if(!plain(category)||Object.keys(category).length!==3||!['labelAr','labelEn','image'].every(key=>Object.hasOwn(category,key)))throw Error('Invalid category fields');
      const entry={};
      for(const key of ['labelAr','labelEn']){
        const value=category[key];
        if(typeof value!=='string'||!value.trim()||value.length>80||/[\u0000-\u001f\u007f-\u009f<>]/.test(value))throw Error('Invalid category name');
        entry[key]=value.trim();
        if(labels.has(entry[key].toLowerCase()))throw Error('Duplicate category name');
      }
      if(!imageSource(category.image))throw Error('Invalid image');
      entry.image=category.image.trim();
      next[id]=entry;
      labels.add(entry.labelAr.toLowerCase());labels.add(entry.labelEn.toLowerCase());
    }
    return next;
  }
  function normalizeSettings(patch,current=defaults){
    if(!plain(patch))throw Error('Invalid settings');
    const next=clone(current);
    if(!Object.hasOwn(next,'categories'))next.categories={};
    for(const [group,values] of Object.entries(patch)){
      if(['__proto__','constructor','prototype'].includes(group)||!Object.hasOwn(defaults,group)||!plain(values))throw Error('Unknown settings group');
      if(group==='categories'){next.categories=normalizeCategories(values);continue;}
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
  function normalizeProduct(patch,existing,settings=defaults){
    if(!plain(patch)||!existing)throw Error('Invalid product');
    const next=clone(existing);
    const availableCategories=categoryList(settings);
    if(!Object.hasOwn(next,'condition'))next.condition='new';
    for(const key of ['batteryHealth','batteryCycles'])if(!Object.hasOwn(next,key))next[key]=null;
    const keys=['name','descriptionAr','descriptionEn','category','condition','chip','cpu','ram','storage','screen','network','batteryHours','batteryUse','batteryHealth','batteryCycles','basePrice','price','offerPrice','availability','stockCount','hidden','image','colors','ramOptions','storageOptions'];
    for(const [key,value] of Object.entries(patch)){
      if(!keys.includes(key))throw Error('Unknown product field');
      if(key==='basePrice'||key==='price'){if(!Number.isFinite(value)||value<=0||value>100000)throw Error('Invalid price');next.basePrice=Math.round(value*100)/100;continue;}
      if(key==='offerPrice'){if(value===null||value===''){delete next.offerPrice;continue;}if(!Number.isFinite(value)||value<=0||value>100000)throw Error('Invalid offer');const offer=Math.round(value*100)/100;if(offer<.01)throw Error('Invalid offer');next.offerPrice=offer;continue;}
      // Optional count for the admin only; 0 means out of stock.
      if(key==='stockCount'){if(value===null||value===''){delete next.stockCount;continue;}if(!Number.isInteger(value)||value<0||value>100000)throw Error('Invalid stock count');next.stockCount=value;continue;}
      if(key==='batteryHours'){if(value!==null&&(!Number.isFinite(value)||value<=0||value>1000))throw Error('Invalid battery hours');next.batteryHours=value;continue;}
      if(key==='batteryHealth'||key==='batteryCycles'){if(value!==null&&(!Number.isInteger(value)||value<0||value>(key==='batteryHealth'?100:100000)))throw Error('Invalid battery condition');next[key]=value;continue;}
      if(key==='batteryUse'){if(!['web','video','listening','mixed','none'].includes(value))throw Error('Invalid battery usage');}
      else if(key==='hidden'){if(typeof value!=='boolean')throw Error('Invalid visibility');}
      else if(key==='availability'){if(!['demo','available','on-order','unavailable'].includes(value))throw Error('Invalid stock');}
      else if(key==='category'){if(!availableCategories.some(category=>category.id===value))throw Error('Invalid category');}
      else if(key==='condition'){if(!conditions.some(condition=>condition.id===value))throw Error('Invalid condition');}
      else if(key==='image'){if(!imageSource(value))throw Error('Invalid image');}
      else if(key==='colors'){if(!Array.isArray(value)||value.length<1||value.length>12||value.some(c=>!plain(c)||typeof c.name!=='string'||!c.name.trim()||c.name.length>70||!color(c.hex)))throw Error('Invalid finishes');}
      else if(key==='ramOptions'||key==='storageOptions'){if(!Array.isArray(value)||value.length>12||value.some(n=>!Number.isInteger(n)||n<=0||n>8192)||new Set(value).size!==value.length)throw Error('Invalid configurations');}
      else if(typeof value!=='string'||value.length>3000||(key==='name'&&!value.trim()))throw Error('Invalid product text');
      next[key]=key==='colors'?value.map(c=>({name:c.name.trim(),hex:c.hex})):typeof value==='string'?value.trim():clone(value);
    }
    if(Object.hasOwn(next,'offerPrice')&&!(next.offerPrice<next.basePrice))throw Error('Offer must be below the price');
    if(!conditions.some(condition=>condition.id===next.condition))throw Error('Invalid condition');
    for(const key of ['batteryHealth','batteryCycles'])if(next[key]!==null&&(!Number.isInteger(next[key])||next[key]<0||next[key]>(key==='batteryHealth'?100:100000)))throw Error('Invalid battery condition');
    if(next.batteryUse==='none')next.batteryHours=null;
    if(next.condition!=='used-like-new'||next.batteryUse==='none')next.batteryHealth=next.batteryCycles=null;
    if(next.stockCount===0)next.availability='unavailable';
    const category=availableCategories.find(category=>category.id===next.category);
    if(!category)throw Error('Invalid category');
    next.art=category.art;next.demo=true;
    if(Array.isArray(next.ramOptions)&&next.ramOptions.length)next.ram=`${next.ramOptions[0]} GB`;
    if(Array.isArray(next.storageOptions)&&next.storageOptions.length)next.storage=next.storageOptions[0]===1024?'1 TB':`${next.storageOptions[0]} GB`;
    if(Array.isArray(next.ramOptions)&&!next.ramOptions.length)delete next.ramOptions;
    if(Array.isArray(next.storageOptions)&&!next.storageOptions.length)delete next.storageOptions;
    return next;
  }
  // Shared by the storefront, the admin and the live server: one place for catalog checks and prices.
  const productFields=['name','descriptionAr','descriptionEn','category','condition','chip','cpu','ram','storage','screen','network','batteryHours','batteryUse','batteryHealth','batteryCycles','basePrice','offerPrice','availability','stockCount','hidden','image','colors','ramOptions','storageOptions'];
  function productPatch(p){const patch={};for(const key of productFields){if(Object.hasOwn(p,key))patch[key]=clone(p[key]);}patch.ramOptions=p.ramOptions||[];patch.storageOptions=p.storageOptions||[];return patch;}
  function productTemplate(id){return {id,name:'New device',category:'mac',condition:'new',art:'macbook',chip:'',ram:'',storage:'',screen:'',batteryHours:null,batteryUse:'mixed',batteryHealth:null,batteryCycles:null,basePrice:500,availability:'demo',demo:true,descriptionAr:'',descriptionEn:'',colors:[{name:'Graphite',hex:'#535966'}],use:[]};}
  function normalizeCatalog(records,categorySettings=defaults){
    if(!Array.isArray(records)||records.length<1||records.length>100)throw Error('Invalid catalog');
    const ids=new Set();
    return records.map(record=>{
      if(!record||typeof record.id!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(record.id)||['__proto__','constructor','prototype'].includes(record.id)||ids.has(record.id))throw Error('Invalid device ID');
      ids.add(record.id);const base=data.products.find(p=>p.id===record.id)||productTemplate(record.id);
      return normalizeProduct(productPatch(record),base,categorySettings);
    });
  }
  const hasOffer=p=>Number.isFinite(p.offerPrice)&&p.offerPrice>0&&p.offerPrice<p.basePrice;
  const startPrice=p=>hasOffer(p)?p.offerPrice:p.basePrice;
  // Upgrade prices: 9 JOD per extra GB of memory above the first option, 75 JOD per storage step.
  function variantExtra(p,choice={}){const ramIncrease=p.ramOptions?(Number(choice.ram)-p.ramOptions[0])*9:0;const storageIndex=p.storageOptions?.indexOf(Number(choice.storage))||0;return Math.max(0,ramIncrease)+Math.max(0,storageIndex)*75;}
  const unitPrice=(p,choice)=>startPrice(p)+variantExtra(p,choice);
  const regularPrice=(p,choice)=>p.basePrice+variantExtra(p,choice);
  const sizeLabel=n=>n>=1024&&n%1024===0?`${n/1024} TB`:`${n} GB`;
  const configurationText=(p,choice={})=>[p.chip,p.network,choice.ram?`${choice.ram} GB`:null,choice.storage?sizeLabel(choice.storage):p.storage,p.colors[choice.color]?.name].filter(Boolean).join(' · ');
  const deliveryFee=(settings,fulfilment,city)=>fulfilment==='pickup'?0:city==='Amman'?settings.checkout.ammanFee:settings.checkout.otherFee;
  window.OneStyleConfig={defaults,categories,conditions,categoryList,categoryLabel,conditionLabel,normalizeSettings,normalizeProduct,imageSource,clone,productFields,productPatch,productTemplate,normalizeCatalog,hasOffer,startPrice,variantExtra,unitPrice,regularPrice,sizeLabel,configurationText,deliveryFee};
})();
