// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي الموحد - قيادة المجلس الاستشاري الستة
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

// قراءة المفتاح من متغيرات البيئة مع التضمين الآمن المشفر كاحتياط
const DEFAULT_KEY_B64 = "QVEuQWI4Uk42SXpMeUlIU3laa2VBUmFxUlk4YU91TlA0ZFZORnd0QVJubl9yTmM0ZmVGQlE=";
const GEMINI_KEY = process.env.GEMINI_API_KEY || Buffer.from(DEFAULT_KEY_B64, "base64").toString("utf-8");
const OFFICIAL_PHONE = "966596906620";

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;
let lastLog = { time: "-", sender: "-", input: "-", reply: "-", model: "-" };

// ذاكرة الحوار لكل عميل
const clientContext = {};

// دستور العقول الستة الموجه لكيبل الذكاء الاصطناعي
const COUNCIL_BRAIN_DIRECTIVE = `
أنت 'سعود' - مستشار أعمال ميداني وتنفيذي لشركة 'السعد لحلول الأعمال' في السعودية.
تتحدث بلهجة سعودية بيضاء محترفة وودودة ولبقة جداً وواقعية.
خلفك غرفة عمليات استشارية من 6 عقول متخصصة تحلل كل رسالة بدقة:
1. طارق المعماري: يحلل تفاصيل عمل العميل ويقدم له الحل الفني (مطعم/كافيه: منيو بالصور والأسعار، استقبال طلبات التوصيل باللوكيشن، حجز طاولات؛ عقار: عروض الشقق وفلترة الزبون الجاد ومواعيد المعاينة؛ متاجر: كتالوج المنتجات وتأكيد الدفع والاستلام).
2. د. إبراهيم الاستراتيجي: يقود التفاوض المالي بمرونة ودهاء؛ يوضح أن السعر ميسر لمرة واحدة فقط وبدون أي اشتراك شهري يثقل كاهل المحل، ويسأل العميل عن متطلباته لترتيب أفضل باقة تناسب ميزانيته.
3. كلود كبير المهندسين: يفهم المشاكل العملية للعملاء (الزبائن اللي يضيعون بالليل، تأخر الرد اليدوي وضغط العمل، زحمة الطلبات).
4. المحقق راشد: يضمن المصداقية والأمان ويحيل لرابط المعاينة الرسمي لطمأنة العميل: https://al-saad-whatsapp.onrender.com/demo
5. فهد الجودة: يراقب سياق الكلام، يمنع التكرار نهائياً، يمنع إعادة السلام والترحيب في كل رسالة بالمحادثة المستمرة، ويدخل في صلب الجواب فوراً.
6. سارة الصياغة: تصيغ الجواب النهائي بلهجة سعودية بيضاء بشرية أصيلة، دافئة وذكية ومختصرة (سطرين إلى 4 أسطر فقط)، وتختم دائماً بسؤال ذكي يحفز العميل على استمرار النقاش أو تجربة النظام.

شروط صارمة:
- رد مباشرة على سؤال العميل وتفاصيل نشاطه بذكاء وحيوية بشرية تامة.
- إذا كانت المحادثة مستمرة أو كان العميل يتابع سؤاله، لا تبدأ بـ "يا هلا ومسهلا بك في السعد... معك أخوك سعود"، بل ادخل في صلب الرد كإنسان ذكي.
- ممنوع منعاً باتاً ذكر أي كلمات تقنية مصطنعة مثل: "ذكاء اصطناعي، بوت، روبوت، خوارزمية، مجلس، برومبت". أنت إنسان مستشار سعودي حقيقي اسمك سعود.
`;

// توليد رد المجلس عبر الكيبل السريع المباشر
async function getCouncilResponseViaCable(senderId, userText) {
  if (!clientContext[senderId]) {
    clientContext[senderId] = [];
  }

  clientContext[senderId].push({
    role: "user",
    parts: [{ text: userText }]
  });

  // الاحتفاظ بآخر حوار لمنع التكرار
  if (clientContext[senderId].length > 10) {
    clientContext[senderId] = clientContext[senderId].slice(-8);
  }

  const payload = {
    system_instruction: {
      parts: [{ text: COUNCIL_BRAIN_DIRECTIVE }]
    },
    contents: clientContext[senderId],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300
    }
  };

  // الموديلات الحديثة المعتمدة بالترتيب
  const models = ['gemini-3.5-flash-lite', 'gemini-3.1-flash-lite'];

  for (const model of models) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_KEY}`;
    try {
      const res = await axios.post(endpoint, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 8000
      });

      const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (reply) {
        clientContext[senderId].push({
          role: "model",
          parts: [{ text: reply }]
        });
        lastLog = { 
          time: new Date().toLocaleTimeString('ar-SA'), 
          sender: senderId, 
          input: userText, 
          reply: reply, 
          model: model 
        };
        console.log(`[نجح التوليد عبر ${model}]:`, reply);
        return reply;
      }
    } catch (err) {
      console.error(`[فشل التوليد عبر ${model}]:`, err.response?.data?.error?.message || err.message);
    }
  }

  return "يا هلا بك يا غالي 🌿 استفسارك وصلنا ونسعد بخدمتك، ودنا نعرف وش مجالك بالضبط عشان نجهز لك أفضل حل يناسب نشاطك وتشوفه عملياً قدامك 🤝";
}

async function startWhatsApp() {
  const authFolder = path.join(__dirname, 'auth_info');
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

// لوحة القيادة المباشرة مع فحص الذكاء الفوري
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>غرفة قيادة السعد | المجلس الاستشاري</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:25px 15px; margin:0; }
        .box { background:#0f172a; border:1px solid #1e293b; max-width:540px; margin:auto; padding:25px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
        .btn { display:inline-block; padding:12px 24px; border-radius:12px; font-weight:900; font-size:15px; text-decoration:none; margin:8px; cursor:pointer; border:none; }
        .btn-green { background:#10b981; color:#fff; }
        .btn-blue { background:#2563eb; color:#fff; }
        .qr-card { background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:15px 0; }
        .status-pill { display:inline-block; padding:4px 14px; border-radius:30px; font-size:13px; font-weight:bold; margin-bottom:12px; }
        .pill-green { background:rgba(16,185,129,0.2); color:#34d399; border:1px solid #10b981; }
        .pill-yellow { background:rgba(245,158,11,0.2); color:#fbbf24; border:1px solid #f59e0b; }
        .log-box { background:#1e293b; border-radius:12px; padding:15px; text-align:right; font-size:13.5px; margin-top:15px; border-right:3px solid #10b981; }
        input[type="text"] { width:80%; padding:10px 14px; border-radius:8px; border:1px solid #334155; background:#0b1120; color:#fff; font-family:inherit; font-size:14px; margin-bottom:10px; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2 style="color:#10b981; margin:0 0 8px;">🌿 السعد لحلول الأعمال</h2>
        <div style="color:#94a3b8; font-size:14px; margin-bottom:15px;">نظام المبيعات والدعم الفوري تحت قيادة المجلس الاستشاري</div>

        ${isConnected ? `
          <div class="status-pill pill-green">🟢 واتساب متصل ومستقر على +${OFFICIAL_PHONE}</div>
          <br>
          <a href="/send_test" class="btn btn-green">🎯 إرسال رسالة العرض لجوال راكان الآن</a>
        ` : `
          <div class="status-pill pill-yellow">🟡 بانتظار مسح الرمز من الواتساب</div>
          <p style="color:#9ca3af; font-size:13px;">افتح WhatsApp Business: الإعدادات ➔ الأجهزة المرتبطة ➔ ربط جهاز</p>
          ${currentQR ? `<div class="qr-card"><img src="${currentQR}" width="200" height="200"></div>` : '<p style="color:#9ca3af;">⏳ جاري تجهيز الرمز...</p>'}
        `}

        <div style="margin-top:20px; border-top:1px solid #1e293b; padding-top:18px;">
          <h4 style="margin:0 0 10px; color:#38bdf8;">⚡ فحص ذكاء سعود المباشر (الموديل: gemini-3.5-flash-lite)</h4>
          <form action="/test_ai" method="get">
            <input type="text" name="q" value="طيب عندي محل كوفي وتوصيل مجاني كيف ممكن تساعدوني؟" placeholder="اكتب أي سؤال لتجربة رد سعود">
            <br>
            <button type="submit" class="btn btn-blue">اختبر رد سعود الآن 🚀</button>
          </form>
        </div>

        ${lastLog.reply !== '-' ? `
          <div class="log-box">
            <div style="color:#38bdf8; font-weight:bold; margin-bottom:4px;">آخر رد تولد (${lastLog.time}) عبر ${lastLog.model}:</div>
            <div style="color:#94a3b8; font-size:12px;">السؤال: ${lastLog.input}</div>
            <div style="color:#f1f5f9; margin-top:6px; font-weight:bold;">الرد: ${lastLog.reply}</div>
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
  const query = req.query.q || "عندي محل كوفي وتوصيل مجاني كيف ممكن تساعدوني؟";
  const reply = await getCouncilResponseViaCable('browser_test', query);
  res.send(`
    <html lang="ar" dir="rtl">
    <head><meta charset="UTF-8"><title>نتيجة الفحص</title><link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700&display=swap" rel="stylesheet"><style>body{background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:40px;}.card{background:#0f172a; max-width:550px; margin:auto; padding:25px; border-radius:18px; border:1px solid #1e293b;}</style></head>
    <body>
      <div class="card">
        <h3 style="color:#10b981;">نتيجة رد سعود الفوري:</h3>
        <p style="color:#94a3b8;"><b>السؤال:</b> ${query}</p>
        <div style="background:#1e293b; padding:15px; border-radius:12px; color:#34d399; font-size:16px; line-height:1.6; text-align:right;">${reply}</div>
        <br>
        <a href="/" style="color:#38bdf8; text-decoration:none;">الرجوع للوحة القيادة</a>
      </div>
    </body>
    </html>
  `);
});

// صفحة المعاينة الرسمية للعملاء بالرقم المعتمد
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
