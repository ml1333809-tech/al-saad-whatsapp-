// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي المدمج بعقول المجلس الاستشاري الستة (The 6 AI Council Core Engine)
 * السعد لحلول الأعمال - تحت إشراف المهندس راكان
 * 
 * العقول الستة تدير كل كلمة وكل رد خلف الستار باسم "سعود":
 * 1. طارق المعماري (الربط الفني وهندسة الأنظمة والحلول)
 * 2. د. إبراهيم (الاستراتيجية والتفاوض الذكي على الأسعار بدون حرق)
 * 3. كلود كبير المهندسين (تحليل الاحتياج التقني للعميل بدقة هندسية)
 * 4. المحقق راشد (كشف نوايا العميل وجديته وإدارة المخاطر)
 * 5. فهد الجودة (ضبط جودة الحوار ومنع التكرار والرتابة)
 * 6. سارة (الصياغة الإنسانية الراقية باللهجة السعودية البيضاء)
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
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;

// ذاكرة المحادثة لكل عميل (تحفظ تسلسل الحوار كاملاً لتفادي التكرار)
const chatContextMemory = {};

// التوجيه الهيكلي لعقول المجلس الاستشاري الستة
const COUNCIL_CONSENSUS_DIRECTIVE = `
أنت غرفة عمليات متكاملة تمثل 'المجلس الاستشاري للذكاء الاصطناعي' المكون من 6 خبراء، تتحدثون جميعاً بصوت رجل مبيعات واستشارات سعودي محترف اسمه 'سعود' من 'السعد لحلول الأعمال':

أعضاء المجلس المشتركون في صياغة كل رد:
1. طارق المعماري: يحدد الحل الهندسي المناسب لنشاط العميل (مطعم، مقاولات، عقار، تجارة، عيادة).
2. د. إبراهيم الاستراتيجي: يقود التفاوض المالي بمرونة وبدون حرق السعر (لا تعطي رقماً ثابتاً في أول الحوار، بل باقات ميسرة بدون اشتراك شهري وتعتمد على حجم متطلباته).
3. كلود كبير المهندسين: يحلل تفاصيل مشكلة العميل (الزبائن اللي يضيعون بالليل، تنظيم الطلبات، المواعيد).
4. المحقق راشد خبير المخاطر: يضمن سلامة العرض، الأمان، وإزالة أي تخوفات من الاختراق برابط المعاينة الرسمي.
5. فهد الجودة: يراقب سياق الكلام ويمنع تماماً أي تكرار غبي للسلام أو العبارات المحفوظة. إذا العميل قال 'وعليكم السلام'، فهد يوجه بالدخول فوراً في الموضوع.
6. سارة خبيرة الصياغة: تصيغ نتاج العقول الخمسة بلهجة سعودية بيضاء بشرية أصيلة، دافئة وذكية ومختصرة (سطرين إلى 3 أسطر فقط).

تعليمات الحوار الصارمة:
- اقرأ تاريخ المحادثة بالكامل وتفاعل معه كإنسان جالس على الجوال ويفكر بعمق.
- لا تذكر إطلاقاً كلمات: 'المجلس، الذكاء الاصطناعي، الخبراء، الروبوت، السيستم'. أنت في الواجهة 'سعود'.
- رابط صفحة المعاينة الرسمية إذا سأل كيف يعمل النظام أو طلب رؤية تجربة: https://al-saad-whatsapp.onrender.com/demo
`;

// توليد رد المجلس الاستشاري التوليدي الحي
async function getCouncilDeliberationReply(senderId, incomingText) {
  if (!chatContextMemory[senderId]) {
    chatContextMemory[senderId] = [
      { role: 'system', content: COUNCIL_CONSENSUS_DIRECTIVE }
    ];
  }

  // إضافة رسالة العميل للذاكرة
  chatContextMemory[senderId].push({
    role: 'user',
    content: incomingText
  });

  // تقليص الذاكرة لآخر 12 رسالة لحفظ السرعة والتركيز
  if (chatContextMemory[senderId].length > 13) {
    chatContextMemory[senderId] = [
      chatContextMemory[senderId][0],
      ...chatContextMemory[senderId].slice(-12)
    ];
  }

  // نماذج الذكاء الاستشارية الفائقة
  const models = [
    'deepseek/deepseek-chat',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free'
  ];

  for (const model of models) {
    try {
      const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
        model: model,
        messages: chatContextMemory[senderId],
        max_tokens: 250,
        temperature: 0.65
      }, {
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'https://al-saad-whatsapp.onrender.com',
          'X-Title': 'Al-Saad AI Council'
        },
        timeout: 8000
      });

      const reply = res.data?.choices?.[0]?.message?.content?.trim();
      if (reply) {
        chatContextMemory[senderId].push({
          role: 'assistant',
          content: reply
        });
        return reply;
      }
    } catch (e) {
      console.log(`Council model ${model} busy, switching...`);
    }
  }

  // استجابة المجلس التلقائية الطارئة عند انقطاع الشبكة
  return "يا هلا ومسهلا بك يا غالي 🌿 معك سعود، أبشر بسعدك شغال أرتب لك أفضل حل لواتسابك يخدم مجالك ويوفر وقتك. تفضل بسؤالك ونخدمك بأحسن ترتيب 🤝";
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
      connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : '966596096620';
      console.log('✅ متصل ومستقر على واتساب:', connectedPhone);
    }
  });

  // الاستماع الشامل لمحادثات العملاء
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || !m.messages.length) return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;

        const sender = msg.key.remoteJid;
        if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

        const text = (
          msg.message?.conversation || 
          msg.message?.extendedTextMessage?.text || 
          msg.message?.imageMessage?.caption || 
          ''
        ).trim();

        if (!text) continue;

        console.log(`[وارد من العميل ${sender}]: ${text}`);

        // محاكاة الكتابة البشرية لطمأنة العميل
        try {
          await sock.sendPresenceUpdate('composing', sender);
        } catch (e) {}

        // تشغيل عقول المجلس الستة لتحليل الرسالة وتوليد الرد البشري
        const reply = await getCouncilDeliberationReply(sender, text);

        try {
          await sock.sendPresenceUpdate('paused', sender);
        } catch (e) {}

        if (sock && isConnected) {
          await sock.sendMessage(sender, { text: reply });
          console.log(`[رد المجلس باسم سعود]: ${reply}`);
        }
      }
    } catch (err) {
      console.error('Upsert Error:', err.message);
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
      <title>غرفة تحكم السعد | محرك المجلس الاستشاري</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:35px 20px; }
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
          <h3 style="color:#34d399;">عقول المجلس الستة تعمل وتدير المحادثات 24/7!</h3>
          <p style="color:#9ca3af;">الرقم النشط: +${connectedPhone}</p>
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

        <a href="https://wa.me/966596096620?text=أهلاً،%20اطلعت%20على%20صفحة%20المعاينة%20وأرغب%20في%20معرفة%20تفاصيل%20التركيب%20لواتسابي" class="btn-wa">
          💬 اضغط هنا لمراسلتنا وتحديد الباقة المناسبة لك
        </a>
      </div>
    </body>
    </html>
  `);
});

// إرسال تجريبي لجوال راكان
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
