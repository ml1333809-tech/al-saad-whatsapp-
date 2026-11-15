// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي الموحد - قيادة المجلس الاستشاري (11 عقلاً ومنظومة تفاوض حي 24/7)
 * السعد لحلول الأعمال - تحت إشراف وتوجيه المهندس راكان
 * 
 * المزايا المدمجة:
 * 1. تفاوض سعري تدريجي ذكي (1500 -> 1200 -> 1000 -> 800 كفزعة أخيرة).
 * 2. لوحة تحكم CRM متكاملة على الرابط /crm بفلاتر وتتبع لحظي للحوارات.
 * 3. حماية تامة من الحظر وقاعدة الـ 14 يوماً الصارمة لاستبعاد الصامتين نهائياً.
 * 4. استبعاد الفود ترك والتركيز على القطاعات المربحة (عقارات، مقاولات، عيادات، عناية سيارات، مطاعم كبرى).
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// المفتاح المشترك النشط المعتمد للمهندس راكان
const ACTIVE_PAID_KEY = Buffer.from("QVEuQWI4Uk42SXpMeUlIU3laa2VBUmFxUlk4YU91TlA0ZFZORnd0QVJubl9yTmM0ZmVGQlE=", "base64").toString("utf-8");
const GEMINI_KEY = ACTIVE_PAID_KEY;
const OFFICIAL_PHONE = "966596906620";
const RENDER_PUBLIC_URL = "https://al-saad-whatsapp.onrender.com";

// معالجة التخزين الدائم للجلسة (Permanent Session Storage)
const authFolder = path.join(__dirname, 'auth_info');
if (!fs.existsSync(authFolder)) {
  fs.mkdirSync(authFolder, { recursive: true });
}

// إذا كان كود الجلسة الدائمة موجوداً في متغيرات البيئة، نستعيده فوراً
if (process.env.SESSION_DATA) {
  try {
    const credsJson = Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8');
    fs.writeFileSync(path.join(authFolder, 'creds.json'), credsJson);
    console.log('✅ تم استرجاع جلسة الواتساب الدائمة من SESSION_DATA بنجاح!');
  } catch (err) {
    console.error('فشل استعادة الجلسة من SESSION_DATA:', err.message);
  }
}

// ========================================================
// قاعدة بيانات CRM المدمجة وحماية الحظر وقاعدة الـ 14 يوماً
// ========================================================
const crmFile = path.join(authFolder, 'crm_leads.json');

const INITIAL_REAL_LEADS = [
  { id: 1, name: "مؤسسة م. راكان للتجارة والديكور", city: "الرياض", category: "مقاولات وديكور", phone: "+966548757876", status: "AGREED", attempts: 1, last_msg: "تم الاتفاق والتجربة الحية المعتمدة", updated: "اليوم", negotiated_price: "1,200 ريال" },
  { id: 2, name: "مكتب ماجد الصقعبي للعقارات", city: "الرياض", category: "عقارات ووساطة", phone: "+966550001141", status: "SENT", attempts: 1, last_msg: "أرسل سعود رسالة العرض المخصصة للعقارات", updated: "أمس", negotiated_price: "-", last_sent_date: new Date().toISOString() },
  { id: 3, name: "مكتب الآلية للعقارات وإدارة الأملاك", city: "الرياض", category: "عقارات وإدارة أملاك", phone: "+966554873777", status: "SENT", attempts: 1, last_msg: "أرسل سعود رسالة العرض المخصصة للعقارات", updated: "أمس", negotiated_price: "-", last_sent_date: new Date().toISOString() },
  { id: 4, name: "مكتب الخيار الصحيح للخدمات العقارية", city: "الرياض", category: "عقارات وخدمات", phone: "+966546444785", status: "READY", attempts: 0, last_msg: "جاهز للإرسال الآمن", updated: "جديد", negotiated_price: "-" },
  { id: 5, name: "مكتب منزلك للتسويق العقاري", city: "الرياض", category: "عقارات وتسويق", phone: "+966508303507", status: "READY", attempts: 0, last_msg: "جاهز للإرسال الآمن", updated: "جديد", negotiated_price: "-" },
  { id: 6, name: "مكتب مشاورات للعقارات", city: "الرياض", category: "عقارات النرجس", phone: "+966554595550", status: "READY", attempts: 0, last_msg: "جاهز للإرسال الآمن", updated: "جديد", negotiated_price: "-" },
  { id: 7, name: "مؤسسة إعمار نجد للمقاولات العامة", city: "الرياض", category: "مقاولات وتشطيب", phone: "+966505441233", status: "READY", attempts: 0, last_msg: "جاهز للإرسال الآمن", updated: "جديد", negotiated_price: "-" },
  { id: 8, name: "مركز درة الابتسامة لطب الأسنان", city: "الرياض", category: "عيادات ومراكز طبية", phone: "+966532219988", status: "READY", attempts: 0, last_msg: "جاهز للإرسال الآمن", updated: "جديد", negotiated_price: "-" },
  { id: 9, name: "مركز بريق النخبة لتلميع وعناية السيارات", city: "الرياض", category: "عناية وتلميع سيارات", phone: "+966567781122", status: "READY", attempts: 0, last_msg: "جاهز للإرسال الآمن", updated: "جديد", negotiated_price: "-" },
  { id: 10, name: "مطاعم ومطابخ القرية التراثية", city: "الرياض", category: "مطاعم كبرى وتوصيل", phone: "+966551122334", status: "READY", attempts: 0, last_msg: "جاهز للإرسال الآمن", updated: "جديد", negotiated_price: "-" }
];

function loadCrmLeads() {
  try {
    if (fs.existsSync(crmFile)) {
      return JSON.parse(fs.readFileSync(crmFile, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading CRM leads:', e.message);
  }
  return INITIAL_REAL_LEADS;
}

function saveCrmLeads(leads) {
  try {
    fs.writeFileSync(crmFile, JSON.stringify(leads, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving CRM leads:', e.message);
  }
}

// تحديث حالة العميل لحظياً عند وصول أي رسالة واتساب
function updateCrmLeadOnMessage(senderJid, userText, botReply) {
  try {
    const rawNumber = senderJid.replace('@s.whatsapp.net', '');
    const leads = loadCrmLeads();
    let lead = leads.find(l => {
      const p = l.phone.replace(/[^\d]/g, '');
      return p === rawNumber || rawNumber.endsWith(p.slice(-9));
    });

    const nowStr = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });

    if (!lead) {
      lead = {
        id: leads.length + 1,
        name: `عميل واتساب جديد (${rawNumber.slice(-4)})`,
        city: "السعودية",
        category: "نشاط تجاري",
        phone: "+" + rawNumber,
        status: "REPLIED",
        attempts: 1,
        last_msg: userText,
        updated: nowStr,
        negotiated_price: "-"
      };
      leads.push(lead);
    } else {
      lead.last_msg = userText;
      lead.updated = nowStr;

      const agreeWords = ['تم', 'اتفقنا', 'موافق', 'اعتمد', 'ابشر', 'أبشر', 'خلاص نبيها', 'تعال ركب', 'ارسل الحساب'];
      const isAgreed = agreeWords.some(w => userText.includes(w));

      const negWords = ['1500', '1200', '1000', '800', 'سعر', 'السعر', 'غالي', 'خصم', 'كاش', 'ريال', 'بكم'];
      const isNeg = negWords.some(w => userText.includes(w) || botReply.includes(w));

      if (isAgreed) {
        lead.status = "AGREED";
      } else if (isNeg) {
        lead.status = "NEGOTIATING";
        if (userText.includes('800') || botReply.includes('800')) lead.negotiated_price = '800 ريال';
        else if (userText.includes('1000') || botReply.includes('1000')) lead.negotiated_price = '1,000 ريال';
        else if (userText.includes('1200') || botReply.includes('1200')) lead.negotiated_price = '1,200 ريال';
        else if (userText.includes('1500') || botReply.includes('1500')) lead.negotiated_price = '1,500 ريال';
      } else if (lead.status === 'SENT' || lead.status === 'READY') {
        lead.status = "REPLIED";
      }
    }
    saveCrmLeads(leads);
  } catch (err) {
    console.error('CRM Update Error:', err.message);
  }
}

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;
let lastLog = { time: "-", sender: "-", input: "-", reply: "-", model: "-", status: "-" };
let isAutoDispatcherActive = false; // التحكم في محرك الإرسال الآلي

const clientHistory = {};

// دستور غرفة عمليات المجلس الاستشاري الـ 11 (منظومة التفاوض الديناميكي الحي المتدرج)
const COUNCIL_BRAIN_DIRECTIVE = `
أنت 'سعود' - مستشار أعمال ميداني وتنفيذي ومفاوض تجاري محنك لشركة 'السعد لحلول الأعمال' في السعودية.
تتحدث بلهجة سعودية بيضاء محترفة، رزينة، ودودة، وثابتة، وتفهم تماماً سيكولوجية التاجر وصاحب المحل السعودي في السوق.
أنت لست آلة ولا قالباً جامداً؛ أنت تفهم وتحلل وتفاوض كإنسان خبير مدعوم بغرفة عمليات من 11 عقلاً استراتيجياً:
1. جناح المعمارية والسياق (طارق + كيمي): يحلل نشاط العميل ويحدد أوجاعه التشغيلية بدقة.
2. جناح البرمجة والتنفيذ (كلود + كوين): يضع الحلول التقنية المباشرة (منيو تفاعلي، سحب اللوكيشن تلقائياً، ربط طابعات الفواتير، فواتير إلكترونية).
3. جناح الاستدلال وهندسة الربحية (د. إبراهيم + ديب سيك R1): يحسب التوفير بالأرقام (توفير 20% عمولات تطبيقات التوصيل، زيادة كفاءة الكاشير وقت الذروة، دفع مقطوع لمرة واحدة وبدون أي اشتراكات شهرية).
4. جناح الأمان والجودة (المحقق راشد + فهد الجودة + كودسترال + لاما 3.3): يفرض أعلى معايير المصداقية والثقة والوقار التجاري، ويمنع الاندفاع أو النزول السريع في السعر.
5. التوليف والصياغة التنفيذية (سارة): تصيغ الرد بأسلوب سعودي راقٍ ومركز في 3 إلى 5 أسطر.

سلم المفاوضات السعري الصارم وتكتيك الإغلاق الذكي (مهم جداً جداً):
- السعر المرجعي الأساسي المعلن للنظام الكامل هو: 1,500 ريال مقطوعة لمرة واحدة شامل الربط مع الطابعة والمنيو واللوكيشن والدعم، وبدون اشتراك شهري نهائياً.
- إذا كاسر العميل وقال "غالي" أو رمى سعراً منخفضاً (مثل 800 أو 700 ريال):
  * الجولة الأولى: ممنوع منعاً باتاً النزول لـ 800 ريال فوراً! دافع عن قيمة النظام وأنه يوفر له آلاف الريالات، واعرض تخفيضاً أولياً تقديراً له: "والله يا طويل العمر 800 ما توفي حق التعب وربط السيستم، لكن عشان نفتح معك باب خير، أبخصم لك 300 ريال وأعطيك إياه بـ 1,200 ريال كاش شامل كل شي".
  * الجولة الثانية (إذا أصر العميل ورفض الـ 1200): لا تستسلم أيضاً، بل اعرض الالتقاء في المنتصف: "شوف وأنا أخوك، حنا ما ودنا نردك وودنا نقف معك، وش رايك نلتقي بالنص على 1,000 ريال كاش؟ وهذا سعر استثنائي وميسر وخاص لك".
  * الجولة الثالثة أو الرابعة (فقط إذا أصر العميل بشدة وهدد بعدم الشراء وقال ما أقدر على أكثر من 800): هنا فقط، وبعد 3 إلى 4 محاولات تفاوض، يمكنك النزول معه، وإشعاره بأنها فزعة واستثناء قوي: "والله إنها ما توفي التعب والبرمجة يا غالي، لكن تم وعشان خاطرك وما نردك خايب، بنضبطها لك بـ 800 ريال كاش الحين ونبدأ معك فوراً".

قواعد قانونية وأخلاقية صارمة لمنع التحرش والجرائم المعلوماتية والابتذال:
- ممنوع منعاً باتاً ومطلقاً وقاطعاً استخدام أي كلمات عاطفية، غزلية، أو مفرطة في الحميمية مثل: ('يا بعد عمري'، 'يا قلبي'، 'يا روحي'، 'يا عيوني'، 'يا بعد راسي'، 'حبيبي'، 'يا حبيبنا'، 'يا عسل'، 'يا قمر'، 'غناتي')! هذه الألفاظ مجرمة قانونياً في الأنظمة السعودية (نظام مكافحة التحرش والجرائم المعلوماتية) وتثير الشبهة وتدمر سمعة المؤسسة.
- الالتزام الحصري الصارم بألفاظ الوقار والاحترام ورجال الأعمال في السوق السعودي فقط:
  ('يا غالي'، 'يا طويل العمر'، 'أخوي الكريم'، 'على راسي'، 'وأنا أخوك'، 'أبشر بالسعد'، 'ما يصير خاطرك إلا طيب'، 'تسلم والله'، 'حياك الله').
- ممنوع منعاً باتاً مناداة العميل بـ 'يا أبو فلان' كقالب جامد، ولا تناديه باسمه إلا إذا عرّف هو عن اسمه الصريح بنفسه.
- تأكد التام من سلامة الإملاء العربي 100% وخلو الردود من أي حروف أو رموز مشوهة أو أجنبية.
- ممنوع منعاً باتاً طلب رقم هاتف العميل؛ أنت تراسله على رقمه أصلاً.
- ممنوع التسرع في إغلاق الصفقة بعبارات مثل "عطني الضوء الأخضر نربطه لك" قبل بناء الثقة وشرح الفائدة.
- ممنوع ذكر مصطلحات: 'ذكاء اصطناعي، بوت، روبوت، خوارزمية، مجلس، برومبت'. أنت سعود.
`;

// فلتر التطهير القانوني الصارم لمنع أي شبهة تحرش أو جرائم معلوماتية أو ألفاظ غير لائقة تجارياً
function sanitizeSaudiBusinessText(text) {
  if (!text) return '';
  let cleaned = text;
  const bannedRules = [
    { regex: /يا\s*بعد\s*عمري/gi, repl: 'يا غالي' },
    { regex: /يا\s*قلبي/gi, repl: 'يا غالي' },
    { regex: /يا\s*روحي/gi, repl: 'يا طويل العمر' },
    { regex: /يا\s*عيوني/gi, repl: 'يا غالي' },
    { regex: /يا\s*بعد\s*راسي/gi, repl: 'يا غالي' },
    { regex: /حبيبي/gi, repl: 'يا غالي' },
    { regex: /يا\s*حبيبنا/gi, repl: 'يا طويل العمر' },
    { regex: /يا\s*عسل/gi, repl: 'يا غالي' },
    { regex: /يا\s*قمر/gi, repl: 'يا طيب' },
    { regex: /غناتي/gi, repl: 'يا طيب' },
    { regex: /حياتي/gi, repl: 'يا غالي' },
    { regex: /يا\s*أبو\s*فلان|أبو\s*فلان/gi, repl: 'يا غالي' },
    { regex: /وعل\s*العين/gi, repl: 'وعلى العين' },
    { regex: /على\s*حرس\s*الميزانية/gi, repl: 'على قد الميزانية' },
  ];
  for (const rule of bannedRules) {
    cleaned = cleaned.replace(rule.regex, rule.repl);
  }
  return cleaned.trim();
}

// توليد رد المجلس الحي المباشر
async function getCouncilResponseViaCable(senderId, userText) {
  if (!clientHistory[senderId]) {
    clientHistory[senderId] = [];
  }

  clientHistory[senderId].push(`العميل: ${userText}`);
  if (clientHistory[senderId].length > 16) {
    clientHistory[senderId] = clientHistory[senderId].slice(-16);
  }

  const conversationHistoryText = clientHistory[senderId].join("\n");

  const fullPrompt = `${COUNCIL_BRAIN_DIRECTIVE}

سياق المحادثة الجارية مع العميل:
${conversationHistoryText}

المطلوب:
أجب العميل الآن بلسان 'سعود' بأسلوب مستشار مبيعات سعودي ذكي ومقنع، يعالج صلب كلامه الأخير ويبني الثقة ويقدم أفكاراً عملية لنشاطه:`;

  const payload = {
    contents: [
      {
        role: "user",
        parts: [{ text: fullPrompt }]
      }
    ],
    generationConfig: {
      temperature: 0.6,
      maxOutputTokens: 380
    }
  };

  const models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    try {
      const res = await axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 9000
      });

      const candidate = res.data?.candidates?.[0];
      const parts = candidate?.content?.parts || [];
      let reply = parts.map(p => p.text || '').join('').trim();

      if (reply) {
        // تطهير النص برمجياً عبر فلتر الحماية القانونية الصارم
        reply = sanitizeSaudiBusinessText(reply);
        clientHistory[senderId].push(`سعود: ${reply}`);
        lastLog = { 
          time: new Date().toLocaleTimeString('ar-SA'), 
          sender: senderId, 
          input: userText, 
          reply: reply, 
          model: model,
          status: 'SUCCESS 200'
        };
        console.log(`[رد حي عبر ${model}]:`, reply);
        return reply;
      }
    } catch (err) {
      console.error(`[خطأ API في ${model}]:`, err.response?.data?.error?.message || err.message);
      lastLog = {
        time: new Date().toLocaleTimeString('ar-SA'),
        sender: senderId,
        input: userText,
        reply: 'FAILED_API',
        model: model,
        status: err.response?.data?.error?.message || err.message
      };
    }
  }

  return getSmartContextualFallback(userText);
}

function getSmartContextualFallback(text) {
  const t = text.toLowerCase();
  if (t.includes('مطعم') || t.includes('توصيل') || t.includes('وجبات') || t.includes('منيو') || t.includes('أكل')) {
    return "يا هلا ومسهلا بأهل المطاعم! 🌿 لمطعمكم وتوصيلكم بنركز على نقطتين ترفع أرباحك:\n1. توديع عمولات التطبيقات (18% إلى 25%): زباينك الدائمين يطلبون منك دايركت بالواتساب، يستلمون المنيو بالصور والأسعار، ويحددون اللوكيشن، والطلب يوصل للمطبخ جاهز بدون ما تضيع ريال.\n2. صفر لخبطة وقت الذروة: اللوكيشن يوصل للسواق بدقة GPS، وأرقام فواتير آلية بدون ما ينشغل الكاشير.\nوالتركيب لمرة واحدة وبدون أي اشتراك شهري يشاركك برزقك! كم فرع عندكم ووين موقعكم؟ 🤝";
  }
  if (t.includes('عقار') || t.includes('أرض') || t.includes('شقة') || t.includes('إيجار') || t.includes('فيلا')) {
    return "يا هلا ومسهلا بأهل العقار! 🏢 نظام السعد يخدم مكتبكم العقاري بالرد على الزباين بأول ثانية: يرسل العروض والصور والمواقع ويسجل بيانات رغبة العميل (شراء/إيجار/مساحة) تلقائياً، بدون ما يضيع وقت موظفيكم بالردود المكررة. والتركيب مرة واحدة بدون أي اشتراك شهري. ودك نجربه على عروض مكتبكم؟ 🤝";
  }
  if (t.includes('مقاولات') || t.includes('تشطيب') || t.includes('ترميم') || t.includes('ديكور')) {
    return "يا هلا بشركاء الإعمار! 🏗️ نظامنا يوفر عليكم فرز طلبات المعاينات وعروض الأسعار؛ يستقبل استفسارات العملاء ويوثق المساحات ونوع التشطيب المطلوب وصور المخططات فوراً ويرسلها لمهندسكم جاهزة. تركيب مقطوع بدون اشتراكات شهرية. تحب نضبطه لمؤسستكم؟ 🤝";
  }
  return "يا هلا بك يا غالي في السعد لحلول الأعمال 🌿 نظامنا يخدم زباين نشاطك بأول ثانية، يرسل الكتالوج والخدمات بالصور والأسعار ويسجل الطلبات والمواقع بدقة وبدون أي اشتراكات شهرية. علمنا وش طبيعة نشاطك بالتحديد عشان أفيدك باللي يضبط شغلك 🤝";
}

// دالة صياغة رسالة العرض الافتتاحية المخصصة حسب القطاع
function generateOutreachPitch(lead) {
  const cat = lead.category || "";
  if (cat.includes("عقار")) {
    return `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿\n\nكم زبون واستفسار يضيع بين رسايل الواتساب وقت انشغالكم بالمعاينات والمفاوضات العقارية؟\n\nحنا في "السعد" نركب لمكتبكم نظام يرد على زباين العقار بأول ثانية: يرسل العروض والصور والمواقع ويسجل طلبات الزباين بدقة وبدون أي اشتراك شهري!\n\nرابط الشرح والمعاينة بالفيديو:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا حاب تجربه لمكتبكم، رد علي بكلمة (أبشر) ونخدمك فوراً 🤝\n\nأخوك سعود | السعد لحلول الأعمال`;
  } else if (cat.includes("مقاولات") || cat.includes("ديكور")) {
    return `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🏗️\n\nنوفر عليك وعلى مهندسينك وقت المعاينات وتنسيق المخططات؛ نظامنا الذكي يرد على عملاء المقاولات والديكور في الواتساب أول ما يراسلون، ويفرز طلبات التشطيب والمساحات والمواقع بدقة.\n\nبمبلغ مقطوع لمرة واحدة وبدون أي اشتراكات شهرية!\n\nرابط المعاينة:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا ودك تشوف كيف يضبط شغلك، رد علي بـ (أبشر) ويسعدنا خدمتك 🤝\n\nأخوك سعود | السعد لحلول الأعمال`;
  } else if (cat.includes("عياد") || cat.includes("أسنان") || cat.includes("طبي")) {
    return `السلام عليكم ورحمة الله وبركاته، مساكم الله بالخير 🌿\n\nلعيادتكم ومراجعينكم؛ نظام السعد على الواتساب يؤكد المواعيد آلياً، ويرسل لوكيشن العيادة وقائمة الأطباء والأسعار فوراً ويخفف الضغط عن موظفي الاستقبال بنسبة 70%.\n\nبدون اشتراكات شهرية!\n\nرابط المعاينة:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا حابين نربطه للعيادة، ردوا علينا بكلمة (أبشر) ونسعد بخدمتكم 🤝\n\nأخوكم سعود | السعد لحلول الأعمال`;
  } else if (cat.includes("سيارات") || cat.includes("تلميع")) {
    return `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🚗\n\nلمركزكم وعناية السيارات؛ نظام السعد الذكي يرسل للزبون باقات التلميع والتظليل والحماية بالأسعار والصور أول ما يراسل، ويثبت له موعد الحجز تلقائياً بدون تضييع وقت الفنيين.\n\nبدون أي اشتراك شهري!\n\nرابط المعاينة:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا ودك تجربه لمركزكم، رد بـ (أبشر) ونضبطه لك فوراً 🤝\n\nأخوك سعود | السعد لحلول الأعمال`;
  } else {
    return `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿\n\nكم زبون يراسلك بالواتساب وأنت مشغول أو بعد الدوام ويروح لغيرك؟\n\nحنا في "السعد" نركب لك في واتساب نشاطك نظام يرد على الزباين فوراً بأول ثانية: يشرح خدماتك، يرسل الصور والموقع، ويسجل الطلبات حتى وأنت نايم.\n\nتسهيلات ودعم مرن يناسب نشاطك بدون أي اشتراكات شهرية!\n\nرابط المعاينة بالفيديو:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا ناسبك وتبيه لمشروعك، رد علي بكلمة (أبشر) ونخدمك فوراً 🤝\n\nأخوك سعود | السعد لحلول الأعمال`;
  }
}

// محرك الإرسال الآلي المستمر وتطبيق قاعدة الأسبوعين الصارمة
setInterval(async () => {
  if (!isAutoDispatcherActive || !isConnected || !sock) return;

  try {
    const leads = loadCrmLeads();
    const now = Date.now();

    for (const lead of leads) {
      // 1. إرسال المحاولة الأولى للجاهزين
      if (lead.status === "READY" && lead.attempts === 0) {
        const cleanPhone = lead.phone.replace(/[^\d]/g, '');
        const jid = `${cleanPhone}@s.whatsapp.net`;
        const text = generateOutreachPitch(lead);

        try {
          await sock.sendMessage(jid, { text });
          lead.status = "SENT";
          lead.attempts = 1;
          lead.last_sent_date = new Date().toISOString();
          lead.last_msg = "تم إرسال العرض المخصص آلياً";
          lead.updated = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
          saveCrmLeads(leads);
          console.log(`[Auto Dispatcher]: Sent initial pitch to ${lead.name} (${lead.phone})`);
          break; // إرسال رسالة واحدة ثم انتظار الفاصل الزمني لحماية الرقم
        } catch (e) {
          console.error(`Failed to send to ${lead.phone}:`, e.message);
        }
      }

      // 2. تطبيق قاعدة الأسبوعين: متابعة ثانية وأخيرة بعد 14 يوماً فقط لمن لم يرد
      if (lead.status === "SENT" && lead.attempts === 1 && lead.last_sent_date) {
        const sentTime = new Date(lead.last_sent_date).getTime();
        const diffDays = (now - sentTime) / (1000 * 60 * 60 * 24);

        if (diffDays >= 14) {
          const cleanPhone = lead.phone.replace(/[^\d]/g, '');
          const jid = `${cleanPhone}@s.whatsapp.net`;
          const followUpText = `السلام عليكم ورحمة الله يا غالي 🌿 مساك الله بالخير.. حبيت أطمئن عليك وعلى شغلكم، هل ما زلتم مهتمين بنظام الواتساب الذكي للرد على زباينكم وتسهيل الطلبات أو نلغي المراسلة عشان ما نزعجك؟ تحياتي لك 🤝`;

          try {
            await sock.sendMessage(jid, { text: followUpText });
            lead.status = "FOLLOWUP_SENT";
            lead.attempts = 2;
            lead.last_sent_date = new Date().toISOString();
            lead.last_msg = "المتابعة الثانية بعد أسبوعين (المحاولة الأخيرة)";
            lead.updated = new Date().toLocaleTimeString('ar-SA', { hour: '2-digit', minute: '2-digit' });
            saveCrmLeads(leads);
            console.log(`[Auto Dispatcher]: Sent 14-day follow-up to ${lead.name}`);
            break;
          } catch (e) {
            console.error(`Follow-up error for ${lead.phone}:`, e.message);
          }
        }
      }

      // 3. قفل الباب نهائياً (Dormant) إذا مر أسبوعان على المتابعة الثانية دون أي رد
      if (lead.status === "FOLLOWUP_SENT" && lead.attempts >= 2 && lead.last_sent_date) {
        const sentTime = new Date(lead.last_sent_date).getTime();
        const diffDays = (now - sentTime) / (1000 * 60 * 60 * 24);
        if (diffDays >= 14) {
          lead.status = "DORMANT";
          lead.last_msg = "تم إيقاف المراسلة نهائياً لحماية الرقم من الحظر (قاعدة الأسبوعين)";
          saveCrmLeads(leads);
          console.log(`[Auto Dispatcher]: Marked ${lead.name} as DORMANT forever.`);
        }
      }
    }
  } catch (err) {
    console.error('Dispatcher loop error:', err.message);
  }
}, 4 * 60 * 1000); // فاصل زمني آمن 4 دقائق بين كل إرسال لمحاكاة السلوك البشري

async function startWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
    browser: ['السعد لحلول الأعمال', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      currentQR = await QRCode.toDataURL(qr);
      isConnected = false;
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) setTimeout(startWhatsApp, 3000);
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : OFFICIAL_PHONE;
      console.log('✅ متصل ومستقر على واتساب:', connectedPhone);
    }
  });

  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || !m.messages.length) return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;

        const sender = msg.key.remoteJid;
        if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

        const rawText = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || 
                         '';

        const text = rawText.trim();
        if (!text) continue;

        console.log(`[وارد من ${sender}]: ${text}`);

        try {
          await sock.sendPresenceUpdate('composing', sender);
        } catch (e) {}

        const reply = await getCouncilResponseViaCable(sender, text);

        try {
          await sock.sendPresenceUpdate('paused', sender);
        } catch (e) {}

        if (sock && isConnected) {
          await sock.sendMessage(sender, { text: reply });
          console.log(`[رد سعود المعتمد إلى ${sender}]: ${reply}`);
          
          // تحديث بيانات وسجل العميل في CRM لحظياً
          updateCrmLeadOnMessage(sender, text, reply);
        }
      }
    } catch (err) {
      console.error('Critical Message Processing Error:', err.message);
    }
  });
}

// مسار فحص الحياة البسيط (Ping)
app.get('/ping', (req, res) => res.send('PONG_OK_24_7'));

// نبض السيرفر المستمر كل 8 دقائق لمنع الخمول
setInterval(async () => {
  try {
    await axios.get(`${RENDER_PUBLIC_URL}/ping`, { timeout: 5000 });
  } catch (err) {}
}, 8 * 60 * 1000);

// مسار استخراج كود الجلسة الدائمة
app.get('/session', (req, res) => {
  const credsPath = path.join(authFolder, 'creds.json');
  if (fs.existsSync(credsPath)) {
    const b64 = fs.readFileSync(credsPath).toString('base64');
    res.send(`
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>كود الجلسة الدائمة | السعد</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap" rel="stylesheet">
        <style>
          body { background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:35px 15px; }
          .card { background:#0f172a; border:1px solid #1e293b; max-width:540px; margin:auto; padding:25px; border-radius:18px; }
          textarea { width:95%; height:130px; background:#1e293b; color:#34d399; font-family:monospace; font-size:12px; padding:10px; border:1px solid #334155; border-radius:8px; margin-top:10px; }
          .btn { background:#10b981; color:#fff; padding:10px 20px; border-radius:8px; border:none; font-weight:bold; cursor:pointer; margin-top:10px; }
        </style>
      </head>
      <body>
        <div class="card">
          <h2 style="color:#10b981;">🔑 كود الجلسة الدائمة (SESSION_DATA)</h2>
          <p style="color:#94a3b8; font-size:14px;">انسخ هذا الكود لمرة واحدة وضعه في متغيرات بيئة Render باسم <b>SESSION_DATA</b>، ولن يطلب منك مسح الرمز نهائياً بعد اليوم حتى لو أعدت بناء السيرفر!</p>
          <textarea id="sessionText" readonly>${b64}</textarea>
          <br>
          <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('sessionText').value); alert('تم نسخ كود الجلسة بنجاح!');">📋 اضغط لنسخ الكود</button>
          <br><br>
          <a href="/" style="color:#38bdf8; text-decoration:none;">الرجوع للوحة القيادة</a>
        </div>
      </body>
      </html>
    `);
  } else {
    res.send('<h3>الجلسة غير مسجلة حالياً. يرجى مسح رمز QR أولاً من الصفحة الرئيسية.</h3><a href="/">الرجوع</a>');
  }
});

// ========================================================
// واجهة لوحة تحكم CRM الفاخرة المباشرة (/crm)
// ========================================================
app.get('/crm', (req, res) => {
  const leads = loadCrmLeads();
  
  const totalCount = leads.length;
  const sentCount = leads.filter(l => l.status === 'SENT' || l.status === 'FOLLOWUP_SENT').length;
  const repliedCount = leads.filter(l => l.status === 'REPLIED' || l.status === 'NEGOTIATING' || l.status === 'AGREED' || l.status === 'IN_LIVE_NEGOTIATION').length;
  const negCount = leads.filter(l => l.status === 'NEGOTIATING' || l.status === 'IN_LIVE_NEGOTIATION').length;
  const agreedCount = leads.filter(l => l.status === 'AGREED').length;
  const dormantCount = leads.filter(l => l.status === 'DORMANT').length;

  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>السعد لحلول الأعمال | غرفة التحكم والمبيعات الآلية (CRM)</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
        :root {
          --bg: #070a12;
          --card: #0f172a;
          --card-border: #1e293b;
          --emerald: #10b981;
          --gold: #d4af37;
          --blue: #3b82f6;
          --purple: #8b5cf6;
          --rose: #f43f5e;
          --text: #f8fafc;
          --muted: #94a3b8;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Tajawal', sans-serif; }
        body {
          background-color: var(--bg);
          color: var(--text);
          padding: 20px;
          min-height: 100vh;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 15px;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 1px solid var(--card-border);
        }
        .header-title h1 { font-size: 24px; color: var(--emerald); display: flex; align-items: center; gap: 8px; }
        .header-title p { color: var(--muted); font-size: 14px; margin-top: 4px; }
        .nav-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .btn {
          padding: 8px 16px;
          border-radius: 10px;
          font-weight: 700;
          font-size: 13px;
          text-decoration: none;
          cursor: pointer;
          border: none;
          display: inline-flex;
          align-items: center;
          gap: 6px;
          transition: 0.2s ease;
        }
        .btn-emerald { background: var(--emerald); color: #fff; }
        .btn-blue { background: var(--blue); color: #fff; }
        .btn-outline { background: transparent; border: 1px solid var(--card-border); color: var(--text); }
        .btn-toggle-on { background: rgba(16, 185, 129, 0.2); color: var(--emerald); border: 1px solid var(--emerald); }
        .btn-toggle-off { background: rgba(244, 63, 94, 0.2); color: var(--rose); border: 1px solid var(--rose); }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 15px;
          margin-bottom: 25px;
        }
        .stat-card {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          padding: 16px;
          text-align: center;
        }
        .stat-value { font-size: 28px; font-weight: 900; margin: 6px 0; }
        .stat-label { font-size: 13px; color: var(--muted); }

        .controls-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 20px;
          background: var(--card);
          padding: 12px 18px;
          border-radius: 14px;
          border: 1px solid var(--card-border);
        }
        .filter-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
        .filter-btn {
          background: transparent;
          border: 1px solid var(--card-border);
          color: var(--muted);
          padding: 6px 14px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
        }
        .filter-btn.active {
          background: var(--emerald);
          color: #fff;
          border-color: var(--emerald);
        }
        .search-input {
          background: #0b1120;
          border: 1px solid var(--card-border);
          color: #fff;
          padding: 8px 14px;
          border-radius: 8px;
          font-size: 13px;
          outline: none;
          min-width: 220px;
        }

        .table-wrap {
          background: var(--card);
          border: 1px solid var(--card-border);
          border-radius: 16px;
          overflow-x: auto;
        }
        table { width: 100%; border-collapse: collapse; text-align: right; font-size: 14px; }
        th { background: rgba(255,255,255,0.02); color: var(--muted); padding: 14px 16px; font-weight: 700; border-bottom: 1px solid var(--card-border); white-space: nowrap; }
        td { padding: 14px 16px; border-bottom: 1px solid rgba(255,255,255,0.04); vertical-align: middle; }
        tr:hover { background: rgba(255,255,255,0.02); }

        .badge {
          display: inline-block;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 800;
          white-space: nowrap;
        }
        .badge-agreed { background: rgba(16, 185, 129, 0.15); color: #34d399; border: 1px solid var(--emerald); }
        .badge-neg { background: rgba(212, 175, 55, 0.15); color: #fbbf24; border: 1px solid #d4af37; }
        .badge-replied { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid var(--blue); }
        .badge-sent { background: rgba(148, 163, 184, 0.15); color: #cbd5e1; border: 1px solid #475569; }
        .badge-dormant { background: rgba(244, 63, 94, 0.15); color: #fb7185; border: 1px solid var(--rose); }

        .add-card {
          background: var(--card);
          border: 1px dashed var(--emerald);
          border-radius: 16px;
          padding: 18px;
          margin-bottom: 25px;
          display: none;
        }
        .form-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
          gap: 12px;
          margin-top: 12px;
        }
        .form-grid input, .form-grid select {
          background: #0b1120;
          border: 1px solid var(--card-border);
          color: #fff;
          padding: 10px;
          border-radius: 8px;
          font-size: 13px;
        }
      </style>
    </head>
    <body>
      <div class="container">
        
        <!-- الهيدر والتحكم -->
        <div class="header">
          <div class="header-title">
            <h1>🌿 السعد لحلول الأعمال • غرفة التحكم والمبيعات (CRM)</h1>
            <p>إدارة استقطاب الأنشطة الحقيقية والمفاوضات الحية 24/7 تحت إشراف م. راكان</p>
          </div>
          <div class="nav-actions">
            <button class="btn ${isAutoDispatcherActive ? 'btn-toggle-on' : 'btn-toggle-off'}" onclick="toggleDispatcher()">
              ⚡ الإرسال الآلي: ${isAutoDispatcherActive ? 'شغال ✅' : 'متوقف مؤقتاً ⏸️'}
            </button>
            <button class="btn btn-blue" onclick="toggleAddForm()">➕ إضافة رقم / نشاط جديد</button>
            <a href="/" class="btn btn-outline">🏠 الرئيسية والباركود</a>
          </div>
        </div>

        <!-- كارد إضافة نشاط جديد -->
        <div id="addFormCard" class="add-card">
          <h3 style="color:var(--emerald); font-size:16px;">إضافة نشاط تجاري جديد إلى قائمة الاستهداف:</h3>
          <form action="/api/crm/lead" method="POST" class="form-grid">
            <input type="text" name="name" placeholder="اسم المنشأة أو المحل" required>
            <input type="text" name="city" placeholder="المدينة (مثال: الرياض)" required>
            <select name="category" required>
              <option value="عقارات ووساطة">عقارات ووساطة</option>
              <option value="مقاولات وتشطيب">مقاولات وتشطيب</option>
              <option value="عيادات ومراكز طبية">عيادات ومراكز طبية</option>
              <option value="عناية وتلميع سيارات">عناية وتلميع سيارات</option>
              <option value="مطاعم كبرى وتوصيل">مطاعم كبرى وتوصيل</option>
              <option value="خدمات عامة ومحاماة">خدمات عامة ومحاماة</option>
            </select>
            <input type="text" name="phone" placeholder="رقم الجوال (05xxxxxxxx)" required>
            <button type="submit" class="btn btn-emerald" style="grid-column: 1 / -1; justify-content: center;">حفظ وإدراج في الاستهداف 🚀</button>
          </form>
        </div>

        <!-- بطاقات المؤشرات الإحصائية -->
        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-label">👥 إجمالي الأنشطة</div>
            <div class="stat-value" style="color:var(--text);">${totalCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">📤 تم الإرسال (Outreach)</div>
            <div class="stat-value" style="color:var(--blue);">${sentCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">💬 تفاعلوا وردوا</div>
            <div class="stat-value" style="color:#38bdf8;">${repliedCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">🤝 جاري المفاوضات</div>
            <div class="stat-value" style="color:#fbbf24;">${negCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">🎉 تم الاتفاق (صفقات)</div>
            <div class="stat-value" style="color:var(--emerald);">${agreedCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">⛔ صامتون (قفل الباب)</div>
            <div class="stat-value" style="color:var(--rose);">${dormantCount}</div>
          </div>
        </div>

        <!-- شريط الفلاتر والبحث -->
        <div class="controls-bar">
          <div class="filter-tabs">
            <button class="filter-btn active" onclick="filterBy('ALL', this)">الكل (${totalCount})</button>
            <button class="filter-btn" onclick="filterBy('AGREED', this)">تم الاتفاق (${agreedCount})</button>
            <button class="filter-btn" onclick="filterBy('NEGOTIATING', this)">يفاوضون (${negCount})</button>
            <button class="filter-btn" onclick="filterBy('REPLIED', this)">من رد (${repliedCount})</button>
            <button class="filter-btn" onclick="filterBy('SENT', this)">لم يرد (${sentCount})</button>
            <button class="filter-btn" onclick="filterBy('DORMANT', this)">صامتون (${dormantCount})</button>
          </div>
          <input type="text" id="searchInput" class="search-input" placeholder="🔍 ابحث بالاسم، الرقم، أو القطاع..." onkeyup="searchLeads()">
        </div>

        <!-- جدول العملاء والحالات -->
        <div class="table-wrap">
          <table id="leadsTable">
            <thead>
              <tr>
                <th>المنشأة والمدينة</th>
                <th>القطاع</th>
                <th>رقم الواتساب</th>
                <th>الحالة</th>
                <th>السعر المتفاوض</th>
                <th>آخر تحديث</th>
                <th>آخر رسالة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${leads.map(l => {
                let badgeClass = 'badge-sent';
                let badgeText = 'بانتظار الرد';
                if (l.status === 'AGREED') { badgeClass = 'badge-agreed'; badgeText = '🎉 تم الاتفاق'; }
                else if (l.status === 'NEGOTIATING' || l.status === 'IN_LIVE_NEGOTIATION') { badgeClass = 'badge-neg'; badgeText = '🤝 يفاوض السعر'; }
                else if (l.status === 'REPLIED') { badgeClass = 'badge-replied'; badgeText = '💬 رد وتفاعل'; }
                else if (l.status === 'DORMANT') { badgeClass = 'badge-dormant'; badgeText = '⛔ مقفل نهائياً'; }
                else if (l.status === 'READY') { badgeClass = 'badge-sent'; badgeText = '⏳ جاهز للإرسال'; }

                const cleanPhone = l.phone.replace(/[^\d]/g, '');

                return `
                  <tr data-status="${l.status}" data-name="${l.name}" data-phone="${l.phone}" data-category="${l.category}">
                    <td><b>${l.name}</b><div style="font-size:12px; color:var(--muted);">${l.city}</div></td>
                    <td>${l.category}</td>
                    <td dir="ltr" style="text-align:right; font-family:monospace;">${l.phone}</td>
                    <td><span class="badge ${badgeClass}">${badgeText}</span></td>
                    <td style="color:#34d399; font-weight:bold;">${l.negotiated_price || '-'}</td>
                    <td style="font-size:12px; color:var(--muted);">${l.updated || '-'}</td>
                    <td style="font-size:13px; max-width:250px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${l.last_msg || '-'}</td>
                    <td>
                      <a href="https://wa.me/${cleanPhone}" target="_blank" class="btn btn-outline" style="padding:4px 10px; font-size:12px;">💬 فتح</a>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>

      </div>

      <script>
        function toggleAddForm() {
          const f = document.getElementById('addFormCard');
          f.style.display = f.style.display === 'block' ? 'none' : 'block';
        }

        function filterBy(status, btn) {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          const rows = document.querySelectorAll('#leadsTable tbody tr');
          rows.forEach(r => {
            const rowStatus = r.getAttribute('data-status');
            if (status === 'ALL') {
              r.style.display = '';
            } else if (status === 'AGREED' && rowStatus === 'AGREED') {
              r.style.display = '';
            } else if (status === 'NEGOTIATING' && (rowStatus === 'NEGOTIATING' || rowStatus === 'IN_LIVE_NEGOTIATION')) {
              r.style.display = '';
            } else if (status === 'REPLIED' && (rowStatus === 'REPLIED' || rowStatus === 'NEGOTIATING' || rowStatus === 'AGREED' || rowStatus === 'IN_LIVE_NEGOTIATION')) {
              r.style.display = '';
            } else if (status === 'SENT' && (rowStatus === 'SENT' || rowStatus === 'READY' || rowStatus === 'FOLLOWUP_SENT')) {
              r.style.display = '';
            } else if (status === 'DORMANT' && rowStatus === 'DORMANT') {
              r.style.display = '';
            } else {
              r.style.display = 'none';
            }
          });
        }

        function searchLeads() {
          const q = document.getElementById('searchInput').value.toLowerCase();
          const rows = document.querySelectorAll('#leadsTable tbody tr');
          rows.forEach(r => {
            const text = (r.getAttribute('data-name') + ' ' + r.getAttribute('data-phone') + ' ' + r.getAttribute('data-category')).toLowerCase();
            r.style.display = text.includes(q) ? '' : 'none';
          });
        }

        async function toggleDispatcher() {
          try {
            const res = await fetch('/api/crm/toggle-dispatcher', { method: 'POST' });
            const data = await res.json();
            alert('حالة الإرسال الآلي الآن: ' + (data.active ? 'شغال ✅' : 'متوقف مؤقتاً ⏸️'));
            location.reload();
          } catch (e) {
            alert('حدث خطأ في التبديل: ' + e.message);
          }
        }
      </script>
    </body>
    </html>
  `);
});

// مسار إضافة عميل جديد
app.post('/api/crm/lead', (req, res) => {
  const { name, city, category, phone } = req.body;
  if (!phone || !name) return res.redirect('/crm');

  let cleanPhone = phone.replace(/[^\d+]/g, '');
  if (cleanPhone.startsWith('05')) cleanPhone = '+966' + cleanPhone.slice(1);
  else if (cleanPhone.startsWith('5')) cleanPhone = '+966' + cleanPhone;

  const leads = loadCrmLeads();
  leads.push({
    id: leads.length + 1,
    name: name.trim(),
    city: (city || 'الرياض').trim(),
    category: (category || 'نشاط عام').trim(),
    phone: cleanPhone,
    status: 'READY',
    attempts: 0,
    last_msg: 'جاهز للإرسال الآمن',
    updated: 'الآن',
    negotiated_price: '-'
  });

  saveCrmLeads(leads);
  res.redirect('/crm');
});

// مسار تفعيل / إيقاف محرك الإرسال الآلي
app.post('/api/crm/toggle-dispatcher', (req, res) => {
  isAutoDispatcherActive = !isAutoDispatcherActive;
  res.json({ active: isAutoDispatcherActive });
});

// لوحة القيادة المباشرة
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>غرفة قيادة السعد | المجلس الاستشاري 11</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:25px 15px; margin:0; }
        .box { background:#0f172a; border:1px solid #1e293b; max-width:560px; margin:auto; padding:25px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
        .btn { display:inline-block; padding:12px 24px; border-radius:12px; font-weight:900; font-size:15px; text-decoration:none; margin:8px; cursor:pointer; border:none; }
        .btn-green { background:#10b981; color:#fff; }
        .btn-blue { background:#2563eb; color:#fff; }
        .btn-purple { background:#8b5cf6; color:#fff; }
        .qr-card { background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:15px 0; }
        .status-pill { display:inline-block; padding:4px 14px; border-radius:30px; font-size:13px; font-weight:bold; margin-bottom:12px; }
        .pill-green { background:rgba(16,185,129,0.2); color:#34d399; border:1px solid #10b981; }
        .pill-yellow { background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid #f59e0b; }
        .log-box { background:#1e293b; border-radius:12px; padding:15px; text-align:right; font-size:13px; margin-top:15px; border-right:3px solid #10b981; }
        input[type="text"] { width:82%; padding:11px 14px; border-radius:8px; border:1px solid #334155; background:#0b1120; color:#fff; font-family:inherit; font-size:14px; margin-bottom:10px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2 style="color:#10b981; margin:0 0 8px;">🌿 السعد لحلول الأعمال</h2>
        <div style="color:#94a3b8; font-size:14px; margin-bottom:15px;">منظومة التفاوض الحي والـ CRM بقيادة المجلس الاستشاري (11 عقلاً) 24/7</div>

        ${isConnected ? `
          <div class="status-pill pill-green">🟢 متصل ومستقر على واتساب +${OFFICIAL_PHONE}</div>
          <br>
          <a href="/crm" class="btn btn-blue" style="font-size:16px;">📊 فتح لوحة المبيعات والـ CRM الحية</a>
          <br>
          <a href="/session" class="btn btn-purple">🔑 حفظ الجلسة الدائمة لمنع طلب الرمز نهائياً</a>
          <br>
          <a href="/send_test" class="btn btn-green">🎯 إرسال رسالة تجريبية لجوال راكان</a>
        ` : `
          <div class="status-pill pill-yellow">🟡 بانتظار مسح الرمز من الواتساب</div>
          <p style="color:#9ca3af; font-size:13px;">افتح WhatsApp Business: الإعدادات ➔ الأجهزة المرتبطة ➔ ربط جهاز</p>
          ${currentQR ? `<div class="qr-card"><img src="${currentQR}" width="200" height="200"></div>` : '<p style="color:#9ca3af;">⏳ جاري تجهيز الرمز...</p>'}
        `}

        <div style="margin-top:20px; border-top:1px solid #1e293b; padding-top:18px;">
          <h4 style="margin:0 0 10px; color:#38bdf8;">⚡ فحص ذكاء سعود الحي في المتصفح</h4>
          <form action="/test_ai" method="get">
            <input type="text" name="q" value="عندي مكتب عقارات وش عندكم افكار" placeholder="اكتب سؤال العميل هنا...">
            <br>
            <button type="submit" class="btn btn-blue">اختبر رد سعود الآن 🚀</button>
          </form>
          <div style="margin-top:10px;">
            <a href="/diag" target="_blank" style="color:#64748b; font-size:12px; text-decoration:none;">🔍 فحص السيرفر والكيبل مباشرة (JSON)</a>
          </div>
        </div>

        ${lastLog.reply !== '-' ? `
          <div class="log-box">
            <div style="color:#38bdf8; font-weight:bold; margin-bottom:4px;">آخر رد (${lastLog.time}) عبر ${lastLog.model} [${lastLog.status}]:</div>
            <div style="color:#94a3b8; font-size:12px;"><b>السؤال:</b> ${lastLog.input}</div>
            <div style="color:#f1f5f9; margin-top:6px; font-weight:bold;"><b>الرد:</b> ${lastLog.reply}</div>
          </div>
        ` : ''}
      </div>
      <script>
        ${!isConnected ? 'setTimeout(() => window.location.reload(), 3000);' : ''}
      </script>
    </body>
    </html>
  `);
});

// تجربة الذكاء مباشرة من المتصفح
app.get('/test_ai', async (req, res) => {
  const query = req.query.q || "عندي مكتب عقارات وش عندكم افكار";
  const reply = await getCouncilResponseViaCable('browser_test', query);
  res.send(`
    <html lang="ar" dir="rtl">
    <head><meta charset="UTF-8"><title>نتيجة الفحص</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap" rel="stylesheet"><style>body{background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:40px;}.card{background:#0f172a; max-width:550px; margin:auto; padding:25px; border-radius:18px; border:1px solid #1e293b;}</style></head>
    <body>
      <div class="card">
        <h3 style="color:#10b981;">نتيجة رد سعود الفوري:</h3>
        <p style="color:#94a3b8;"><b>سؤال العميل:</b> ${query}</p>
        <div style="background:#1e293b; padding:18px; border-radius:12px; color:#34d399; font-size:16px; line-height:1.7; text-align:right;">${reply}</div>
        <br>
        <a href="/" style="color:#38bdf8; text-decoration:none;">الرجوع للوحة القيادة</a>
      </div>
    </body>
    </html>
  `);
});

// صفحة المعاينة الرسمية للعملاء
app.get('/demo', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>السعد لحلول الأعمال | نظام الرد الذكي للواتساب</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#0a0e17; color:#f3f4f6; font-family:'Tajawal',sans-serif; margin:0; padding:20px; line-height:1.7; }
        .container { max-width:600px; margin:auto; background:#111827; border:1px solid #1f2937; border-radius:24px; padding:25px; box-shadow:0 15px 35px rgba(0,0,0,0.5); }
        .badge { background:rgba(16,185,129,0.15); color:#10b981; border:1px solid #10b981; padding:4px 14px; border-radius:50px; font-size:13px; font-weight:bold; display:inline-block; }
        h1 { font-size:24px; color:#fff; margin:12px 0 6px; }
        .feature-box { background:#1e293b; border-radius:14px; padding:16px; margin:15px 0; border-right:4px solid #10b981; }
        .feature-title { font-weight:bold; color:#38bdf8; font-size:16px; margin-bottom:4px; }
        .flex-box { background:rgba(255,255,255,0.03); border:1px dashed #10b981; border-radius:16px; padding:18px; text-align:center; margin:20px 0; }
        .btn-wa { display:block; background:#25d366; color:#fff; text-decoration:none; padding:14px; border-radius:12px; font-size:17px; font-weight:900; text-align:center; box-shadow:0 6px 20px rgba(37,211,102,0.3); }
      </style>
    </head>
    <body>
      <div class="container">
        <div style="text-align:center;">
          <div class="badge">🌿 السعد لحلول الأعمال • معتمد وموثوق</div>
          <h1>نظام الرد الذكي المباشر على واتساب نشاطك</h1>
          <p style="color:#9ca3af; font-size:15px; margin-top:0;">لا تضيع أي زبون يراسلك وقت انشغالك أو بعد نهاية الدوام!</p>
        </div>

        <div class="feature-box">
          <div class="feature-title">⚡ رد فوري في أول ثانية</div>
          <div>يرد على استفسارات الزباين في ثوانٍ معدودة 24 ساعة بدون انقطاع حتى وأنت نايم.</div>
        </div>

        <div class="feature-box">
          <div class="feature-title">📋 إرسال الكتالوج والصور والموقع</div>
          <div>يشرح للزبون خدماتك، ويرسل له الصور والموقع ويسجل بيانات طلبه مباشرة.</div>
        </div>

        <div class="feature-box">
          <div class="feature-title">🔒 أمان رسمي تام 100%</div>
          <div>يعمل على رقم واتسابك الرسمي بربط موثق ودون الحاجة لأي كلمات مرور أو برامج خارجية.</div>
        </div>

        <div class="flex-box">
          <div style="font-size:16px; font-weight:bold; color:#34d399;">باقات إعداد ميسرة وتسهيلات مرنة تناسب ميزانية كل نشاط</div>
          <div style="font-size:13px; color:#9ca3af; margin-top:5px;">✅ دفع لمرة واحدة وبدون أي اشتراكات شهرية إلزامية تثقل عليك!</div>
        </div>

        <a href="https://wa.me/${OFFICIAL_PHONE}?text=أهلاً،%20اطلعت%20على%20صفحة%20المعاينة%20وأرغب%20في%20معرفة%20تفاصيل%20التركيب%20لواتسابي" class="btn-wa">
          💬 اضغط هنا لمراسلتنا وتحديد الباقة المناسبة لك
        </a>
      </div>
    </body>
    </html>
  `);
});

// إرسال رسالة العرض لجوال راكان
app.get('/send_test', async (req, res) => {
  if (!isConnected || !sock) return res.send('❌ الواتساب غير متصل بعد، يرجى مسح الرمز أولاً');
  const jid = '966548757876@s.whatsapp.net';
  const pitch = `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿\n\nكم زبون يراسلك بالواتساب وأنت مشغول أو بعد الدوام ويروح لغيرك؟\n\nحنا في "السعد" نركب لك في واتساب محلك أو مكتبك نظام يرد على الزباين فوراً بأول ثانية:\nيشرح خدماتك، يرسل الصور والموقع، ويسجل الطلبات حتى وأنت نايم.\n\nتسهيلات ودعم مرن يناسب نشاطك بدون أي التزامات معقدة!\n\nتقدر تشوف طريقة عمل النظام بالفيديو والشرح من رابطنا الرسمي:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا ناسبك وتبيه لمشروعك، رد علي بكلمة (أبشر) ونخدمك فوراً 🤝\n\nأخوك سعود | السعد لحلول الأعمال`;
  
  try {
    await sock.sendMessage(jid, { text: pitch });
    res.send('<h1 style="color:#10b981; text-align:center; margin-top:80px; font-family:sans-serif;">✅ تم إرسال الرسالة إلى جوالك 0548757876 بنجاح! شيك على الواتساب 🚀</h1><p style="text-align:center;"><a href="/">الرجوع للوحة القيادة</a></p>');
  } catch (e) {
    res.send('خطأ: ' + e.message);
  }
});

// مسار فحص الاتصال الشامل
app.get('/diag', async (req, res) => {
  const testQuery = req.query.q || "عندي مكتب عقارات وش عندكم افكار";
  const results = {
    server_time: new Date().toISOString(),
    whatsapp_connected: isConnected,
    connected_phone: connectedPhone,
    has_session_data_env: Boolean(process.env.SESSION_DATA),
    auto_dispatcher_active: isAutoDispatcherActive,
    tests: {}
  };

  const models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];
  for (const m of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${GEMINI_KEY}`;
    const payload = {
      contents: [{ role: "user", parts: [{ text: testQuery }] }]
    };
    const t0 = Date.now();
    try {
      const response = await axios.post(url, payload, { timeout: 8000 });
      const parts = response.data?.candidates?.[0]?.content?.parts || [];
      const text = parts.map(p => p.text || '').join('').trim();
      results.tests[m] = {
        status: "SUCCESS",
        http_code: response.status,
        duration_ms: Date.now() - t0,
        response_preview: text
      };
    } catch (err) {
      results.tests[m] = {
        status: "FAILED",
        http_code: err.response?.status || "NO_RESPONSE",
        error_message: err.response?.data?.error?.message || err.message
      };
    }
  }

  res.json(results);
});

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
