// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي الموحد - قيادة المجلس الاستشاري الستة (آمن 100%)
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

// قراءة المفتاح بشكل سري ومشفر من إعدادات السيرفر
const GEMINI_KEY = process.env.GEMINI_API_KEY || "";
const OFFICIAL_PHONE = "966596906620";

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;

const clientContext = {};

const COUNCIL_BRAIN_DIRECTIVE = `
أنت غرفة عمليات متكاملة تمثل 'المجلس الاستشاري للذكاء الاصطناعي' الستة لشركة 'السعد لحلول الأعمال'.
تتحدثون جميعاً بصوت مستشار مبيعات سعودي ذكي وبشري محترف اسمه 'سعود':
1. طارق المعماري: يحلل تفاصيل عمل العميل ويقدم له الحل الفني (مطعم: منيو بالصور، حجز طاولات، طلبات لوكيشن؛ عقار: عروض شقق وفلترة ومواعيد؛ مقاولات: بروفايل أعمال ورفع مقاسات).
2. د. إبراهيم: يقود التفاوض المالي بمرونة ودهاء؛ يوضح أن السعر ميسر لمرة واحدة بدون اشتراك شهري، ويسأل العميل عن متطلباته لترتيب الباقة المناسبة لميزانيته دون حرق السعر.
3. كلود: يفهم المشاكل العملية للعملاء (الزبائن اللي يضيعون بالليل، تنظيم الحجوزات).
4. المحقق راشد: يضمن المصداقية والأمان ويحيل لرابط المعاينة الرسمي لطمأنة العميل.
5. فهد الجودة: يراقب سياق الكلام ويمنع التكرار الغبي للسلام أو العبارات المحفوظة، ويدخل في صلب الجواب فوراً.
6. سارة: تصيغ نتاج العقول الخمسة بلهجة سعودية بيضاء بشرية أصيلة، دافئة وذكية ومختصرة (سطرين إلى 4 أسطر فقط).

شروط صارمة:
- رد مباشرة على سؤال العميل بذكاء وحيوية بشرية تامة.
- إذا سأل العميل عن طريقة العمل أو طلب فيديو: رابط المعاينة الرسمي: https://al-saad-whatsapp.onrender.com/demo
- ممنوع ذكر أي كلمات تقنية مثل: "ذكاء اصطناعي، روبوت، خوارزمية، مجلس، برومبت". أنت سعود.
`;

async function getCouncilResponseViaCable(senderId, userText) {
  if (!GEMINI_KEY) {
    return getCouncilInstantFallback(userText);
  }

  if (!clientContext[senderId]) {
    clientContext[senderId] = [];
  }

  clientContext[senderId].push({
    role: "user",
    parts: [{ text: userText }]
  });

  if (clientContext[senderId].length > 10) {
    clientContext[senderId] = clientContext[senderId].slice(-8);
  }

  const payload = {
    system_instruction: {
      parts: [{ text: COUNCIL_BRAIN_DIRECTIVE }]
    },
    contents: clientContext[senderId],
    generationConfig: {
      temperature: 0.65,
      maxOutputTokens: 250
    }
  };

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

  try {
    const res = await axios.post(endpoint, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 6000
    });

    const reply = res.data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (reply) {
      clientContext[senderId].push({
        role: "model",
        parts: [{ text: reply }]
      });
      return reply;
    }
  } catch (err) {
    console.error('[Gemini API Call Failed]: Falling back to local brain...');
  }

  return getCouncilInstantFallback(userText);
}

function getCouncilInstantFallback(text) {
  const lower = text.toLowerCase();
  if (lower.includes('مطعم') || lower.includes('أكل') || lower.includes('منيو') || lower.includes('كافيه')) {
    return "يا هلا ومسهلا بأهل المطاعم! 🌿\nلمطعمكم بنركب بالواتساب:\n1. إرسال المنيو بالصور والأسعار في أول ثانية للزبون.\n2. استقبال طلبات التوصيل والاستلام مع تحديد موقع العميل آلياً.\n3. تنظيم حجوزات الطاولات وقت الذروة والزحمة وأنت مرتاح.\nتخيل ما يضيع عليك ولا طلب حتى وقت ضغط الشغل أو بعد الإغلاق! تحب نجهز لك تجربة خاصة بمنيو مطعمك؟";
  }
  if (lower.includes('عقار') || lower.includes('شقق') || lower.includes('أراضي') || lower.includes('إيجار')) {
    return "يا هلا بأهل العقار 🌿 لمكتبكم بنركب نظام يعرض العروض المتاحة مع الصور والموقع فوراً، ويفلتر الزبون الجاد، ويحجز مواعيد المعاينة ويوفر وقتك. تحب نرتب لك نموذج مخصص لعقاراتكم؟";
  }
  if (lower.includes('سعر') || lower.includes('كم') || lower.includes('تكلف') || lower.includes('بكم')) {
    return "يا هلا ومسهلا بك يا غالي 🌿 أسعارنا ميسرة جداً وتعتمد على حجم متطلبات نشاطك، تركيب لمرة واحدة بدون أي اشتراك شهري يثقل عليك!\n\nوش مجال نشاطك بالضبط عشان أرتب لك أفضل باقة تناسب ميزانيتك ونخدمك بأفضل سعر؟";
  }
  return "يا هلا ومسهلا بك في السعد لحلول الأعمال 🌿 معك أخوك سعود. نركب لك نظام بالواتساب يرد على زباينك في أول ثانية، يرسل الصور والأسعار والموقع ويسجل الطلبات حتى بعد نهاية الدوام. تفضل بمجال نشاطك وطلبك وسنخدمك بأحسن ترتيب 🤝";
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
          console.log(`[رد سعود المعتمد]: ${reply}`);
        }
      }
    } catch (err) {
      console.error('Critical Message Processing Error:', err.message);
    }
  });
}

// لوحة القيادة
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>غرفة قيادة السعد | المجلس الاستشاري</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:35px 20px; margin:0; }
        .box { background:#0f172a; border:1px solid #1e293b; max-width:480px; margin:auto; padding:25px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
        .btn { display:inline-block; padding:14px 28px; border-radius:12px; font-weight:900; font-size:16px; text-decoration:none; margin-top:15px; }
        .btn-green { background:#10b981; color:#fff; }
        .qr-card { background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:15px 0; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2 style="color:#10b981; margin:0 0 10px;">🌿 السعد لحلول الأعمال</h2>
        ${isConnected ? `
          <div style="font-size:45px;">🟢</div>
          <h3 style="color:#34d399;">المجلس الاستشاري يقود واتساب السعد بنجاح 24/7!</h3>
          <p style="color:#9ca3af;">الرقم الرسمي المعتمد: +${OFFICIAL_PHONE}</p>
          <a href="/send_test" class="btn btn-green">🎯 إرسال رسالة العرض لجوال راكان الآن</a>
        ` : `
          <h3 style="color:#f59e0b;">🟡 بانتظار مسح الرمز</h3>
          <p style="color:#9ca3af; font-size:13.5px;">افتح WhatsApp Business في الآيفون: الإعدادات ➔ الأجهزة المرتبطة ➔ ربط جهاز</p>
          ${currentQR ? `<div class="qr-card"><img src="${currentQR}" width="210" height="210"></div>` : '<p style="color:#9ca3af;">⏳ جاري تجهيز الرمز...</p>'}
        `}
      </div>
      <script>
        ${!isConnected ? 'setTimeout(() => window.location.reload(), 3000);' : ''}
      </script>
    </body>
    </html>
  `);
});

// صفحة المعاينة
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

// إرسال رسالة العرض
app.get('/send_test', async (req, res) => {
  if (!isConnected || !sock) return res.send('❌ الواتساب غير متصل بعد');
  const jid = '966548757876@s.whatsapp.net';
  const pitch = `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿\n\nكم زبون يراسلك بالواتساب وأنت مشغول أو بعد الدوام ويروح لغيرك؟\n\nحنا في "السعد" نركب لك في واتساب محلك أو مكتبك نظام يرد على الزباين فوراً بأول ثانية:\nيشرح خدماتك، يرسل الصور والموقع، ويسجل الطلبات حتى وأنت نايم.\n\nتسهيلات ودعم مرن يناسب نشاطك بدون أي التزامات معقدة!\n\nتقدر تشوف طريقة عمل النظام بالفيديو والشرح من رابطنا الرسمي:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا ناسبك وتبيه لمشروعك، رد علي بكلمة (أبشر) ونخدمك فوراً 🤝\n\nأخوك سعود | السعد لحلول الأعمال`;
  
  try {
    await sock.sendMessage(jid, { text: pitch });
    res.send('<h1 style="color:#10b981; text-align:center; margin-top:80px; font-family:sans-serif;">✅ تم إرسال الرسالة إلى جوالك 0548757876 بنجاح! شيك على الواتساب 🚀</h1><p style="text-align:center;"><a href="/">الرجوع</a></p>');
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
