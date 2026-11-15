// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي الموحد - قيادة المجلس الاستشاري (11 عقلاً ومنظومة تفاوض حي 24/7)
 * السعد لحلول الأعمال - تحت إشراف المهندس راكان
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

// إذا كان كود الجلسة الدائمة موجوداً في متغيرات البيئة، نستعيده فوراً قبل تشغيل السوكت
if (process.env.SESSION_DATA) {
  try {
    const credsJson = Buffer.from(process.env.SESSION_DATA, 'base64').toString('utf-8');
    fs.writeFileSync(path.join(authFolder, 'creds.json'), credsJson);
    console.log('✅ تم استرجاع جلسة الواتساب الدائمة من SESSION_DATA بنجاح!');
  } catch (err) {
    console.error('فشل استعادة الجلسة من SESSION_DATA:', err.message);
  }
}

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;
let lastLog = { time: "-", sender: "-", input: "-", reply: "-", model: "-", status: "-" };

// ذاكرة الحوار لكل عميل
const clientHistory = {};

// دستور غرفة عمليات المجلس الاستشاري الـ 11 (منظومة التفاوض الديناميكي الحي)
const COUNCIL_BRAIN_DIRECTIVE = `
أنت 'سعود' - مستشار أعمال ميداني وتنفيذي لشركة 'السعد لحلول الأعمال' في السعودية.
تتحدث بلهجة سعودية بيضاء محترفة وودودة ولبقة جداً وواقعية وعملية، وتفهم عقلية التاجر وصاحب المحل السعودي في السوق.
أنت لست آلة ولا قالباً جامداً؛ أنت تفهم وتحلل وتفاوض كإنسان خبير مدعوم بغرفة عمليات من 11 عقلاً استراتيجياً:
1. جناح المعمارية والسياق (طارق + كيمي): يحلل نموذج عمل العميل (مطعم، كافيه، متجر، مغسلة...) ويحدد نقاط الألم التشغيلية بدقة.
2. جناح البرمجة والتنفيذ (كلود + كوين): يضع الحلول التقنية المباشرة (منيو تفاعلي بالصور، لوكيشن GPS آلي، تنظيم أرقام الطلبات، فواتير فورية).
3. جناح الاستدلال وهندسة الربحية (د. إبراهيم + ديب سيك R1): يحسب للعميل بالأرقام كم سيوفر (توفير 20% عمولات تطبيقات التوصيل، زيادة متوسط الفاتورة، سعر تركيب مقطوع ميسر بدون اشتراك شهري).
4. جناح الأمان والجودة (المحقق راشد + فهد الجودة + كودسترال + لاما 3.3): يفرض أعلى معايير المصداقية والثقة، ويمنع أي تصرف يوحي بالريبة.
5. التوليف والصياغة التنفيذية (سارة): تصيغ الرد بأسلوب سعودي راقٍ ومركز في 3 إلى 5 أسطر.

قواعد أمنية وسلوكية قطعية لا تقبل أي استثناء:
- ممنوع منعاً باتاً طلب رقم هاتف العميل! أنت تتحدث معه على رقمه في الواتساب أصلاً، وطلب الرقم يثير الشك والريبة وكأنه محاولة اختراق!
- ممنوع التسرع في إغلاق الصفقة أو القول "عطني الضوء الأخضر نربطه لك" قبل أن تشرح للعميل بدقة كيف يفيده النظام في مشروعه وتجيبه على كل استفساراته.
- إذا كان العميل صاحب مطعم أو كوفي وعنده توصيل: ركز على أوجاعه الحقيقية (عمولات التطبيقات العالية 18-25%، ضياع وقت الكاشير وقت الذروة، السواق اللي يتصل يسأل عن الوصف، لخبطة الطلبات).
- أجب بشكل ديناميكي وحي بناءً على ما يذكره العميل تحديداً، واختم دائماً بسؤال ذكي يحفزه على متابعة النقاش براحة تامة.
- ممنوع ذكر مصطلحات: 'ذكاء اصطناعي، بوت، روبوت، خوارزمية، مجلس، برومبت'. أنت سعود.
`;

// توليد رد المجلس الحي المباشر
async function getCouncilResponseViaCable(senderId, userText) {
  if (!clientHistory[senderId]) {
    clientHistory[senderId] = [];
  }

  clientHistory[senderId].push(`العميل: ${userText}`);
  if (clientHistory[senderId].length > 6) {
    clientHistory[senderId] = clientHistory[senderId].slice(-6);
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
      temperature: 0.7,
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
      const reply = parts.map(p => p.text || '').join('').trim();

      if (reply) {
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

  // في حال غياب الاتصال: عقل محلي استراتيجي ذكي يفهم النشاط
  return getSmartContextualFallback(userText);
}

// عقل محلي استراتيجي ذكي
function getSmartContextualFallback(text) {
  const t = text.toLowerCase();
  
  if (t.includes('مطعم') || t.includes('توصيل') || t.includes('وجبات') || t.includes('منيو') || t.includes('أكل')) {
    return "يا هلا ومسهلا بأهل المطاعم! 🌿 لمطعمكم وتوصيلكم بنركز على نقطتين ترفع أرباحك:\n1. توديع عمولات التطبيقات (18% إلى 25%): زباينك الدائمين يطلبون منك دايركت بالواتساب، يستلمون المنيو بالصور والأسعار، ويحددون اللوكيشن، والطلب يوصل للمطبخ جاهز بدون ما تضيع ريال.\n2. صفر لخبطة وقت الذروة: اللوكيشن يوصل للسواق بدقة GPS، وأرقام فواتير آلية بدون ما ينشغل الكاشير.\nوالتركيب لمرة واحدة بدون أي نسبة أو اشتراك شهري يشاركك برزقك! كم فرع عندكم ووين موقعكم؟ 🤝";
  }

  if (t.includes('فود ترك') || t.includes('ترك') || t.includes('شباك') || t.includes('طابور')) {
    return "يا هلا بأهل الفود ترك! 🚚 هذا وجع نعاني منه بالفعاليات والزحمة؛ نظام السعد يرسل للزبون المنيو بالصور أول ما يراسل، ويصدر له رقم طلب آلي يستلم عليه بدون تجمهر عند الشباك، وتتفرغ أنت للطبخ والخدمة. والتركيب مرة واحدة بدون أي اشتراك شهري. ودك نجهز لك تجربة خاصة بمنيو الفود ترك؟";
  }

  if (t.includes('كوفي') || t.includes('قهوة') || t.includes('كافيه')) {
    return "يا هلا بأهل الكوفي ☕ التوصيل ميزة قوية بس مشكلتها تضييع وقت الكاشير بكتابة العناوين. نظامنا يرسل منيو المشروبات والحلا بالصور، ويستقبل اللوكيشن تلقائياً ويمرر الطلب للباريستا فوراً بدون تأخير. تركيب لمرة واحدة بدون أي اشتراك شهري. تحب نجربه على منيو كوفيكم؟";
  }

  return "يا هلا بك يا غالي في السعد لحلول الأعمال 🌿 نظامنا يخدم زباين نشاطك بأول ثانية، يرسل المنيو والخدمات بالصور والأسعار ويسجل الطلبات والمواقع بدقة وبدون أي اشتراكات شهرية. قلي وش طبيعة نشاطك بالضبط عشان أشرح لك كيف بنفيدك عملياً 🤝";
}

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
        }
      }
    } catch (err) {
      console.error('Critical Message Processing Error:', err.message);
    }
  });
}

// مسار فحص الحياة البسيط (Ping)
app.get('/ping', (req, res) => res.send('PONG_OK_24_7'));

// نظام نبض القلب التلقائي لمنع سيرفر Render من النوم نهائياً (Keep-Alive Self-Ping)
setInterval(async () => {
  try {
    await axios.get(`${RENDER_PUBLIC_URL}/ping`, { timeout: 5000 });
    console.log('[Heartbeat]: Keep-alive ping sent to prevent sleep.');
  } catch (err) {
    // تجاهل أخطاء النبض أثناء التشغيل
  }
}, 8 * 60 * 1000); // نبضة كل 8 دقائق تضمن عدم دخول Render في وضع الخمول 15 دقيقة أبداً

// مسار استخراج كود الجلسة الدائمة لمنع طلب QR نهائياً
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

// مسار فحص الاتصال الشامل
app.get('/diag', async (req, res) => {
  const testQuery = req.query.q || "عندي مطعم وفيه توصيل وش عندكم افكار للمطعم";
  const results = {
    server_time: new Date().toISOString(),
    whatsapp_connected: isConnected,
    connected_phone: connectedPhone,
    has_session_data_env: Boolean(process.env.SESSION_DATA),
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
        <div style="color:#94a3b8; font-size:14px; margin-bottom:15px;">منظومة التفاوض الحي بقيادة المجلس الاستشاري (11 عقلاً) 24/7</div>

        ${isConnected ? `
          <div class="status-pill pill-green">🟢 متصل ومستقر على واتساب +${OFFICIAL_PHONE}</div>
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
            <input type="text" name="q" value="عندي مطعم وفيه توصيل وش عندكم افكار للمطعم" placeholder="اكتب سؤال العميل هنا...">
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
  const query = req.query.q || "عندي مطعم وفيه توصيل وش عندكم افكار للمطعم";
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

process.on('uncaughtException', (err) => console.error('Uncaught Exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('Unhandled Rejection:', reason));

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
