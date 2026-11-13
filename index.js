// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي المفتوح المصدر (Baileys Cloud Engine)
 * السعد لحلول الأعمال - عقل المجلس الاستشاري
 * يعمل في السحاب 24/7 دون الحاجة لتشغيل الكمبيوتر نهائياً.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;

// توجيهات المجلس الاستشاري للردود التلقائية (سعود)
const COUNCIL_BRAIN_PROMPT = `
أنت 'سعود' من 'السعد لحلول الأعمال'.
تتكلم بلهجة سعودية دارجة، بسيطة جداً، مفهومة لأي شخص عادي وبدون أي مصطلحات تقنية أو تفلسف.

الخدمة اللي نقدمها باختصار وبساطة:
"نركب لك رد تلقائي على رقم الواتساب حق محلك أو مكتبك، عشان إذا جاك زبون في نص الليل أو وقت انشغالك، الواتساب يرد عليه فوراً، يعطيه الأسعار وموقع المحل وتفاصيل الشغل، وما يضيع عليك ولا زبون!"

الأسعار (سهلة وواضحة بدون اشتراك شهري):
- تركيب وتشغيل كامل لمرة واحدة فقط بـ 290 إلى 390 ريال.
- بدون أي اشتراك شهري.
- تجربة مجانية أولاً يشوفها بنفسه إذا حب.

شروط الرد:
1. رد في سطرين أو 3 فقط وبكلام عامي مريح ومباشر.
2. لا تذكر كلمة 'ذكاء اصطناعي' أو 'مجلس' أو 'خوارزميات'، كلام بيع بسيط من أهل البلد.
3. إذا سأل عن السعر، جاوبه فوراً بالسعر البسيط.
`;

// توليد رد المحادثة
async function getCouncilAIReply(userMessage) {
  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'liquid/lfm-2.5-2.6b:free',
      messages: [
        { role: 'system', content: COUNCIL_BRAIN_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 200,
      temperature: 0.6
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 10000
    });

    if (res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content.trim();
    }
  } catch (err) {
    console.error('[Council AI Error]:', err.message);
  }

  // رد مباشر احتياطي في حال بطء الشبكة
  const msg = userMessage.toLowerCase();
  if (msg.includes('سعر') || msg.includes('كم') || msg.includes('تكلف') || msg.includes('اسعار') || msg.includes('بكم')) {
    return "يا هلا ومسهلا بك يا غالي 🌿\nالتركيب وتجهيز الردود بالكامل بـ 290 ريال لمرة واحدة فقط، وما فيه أي اشتراك شهري يثقل عليك!\n\nتحب نسوي لك تجربة تشوفها بنفسك على رقمك أول؟";
  }
  return "يا هلا بك في السعد لحلول الأعمال 🌿 نركب لك نظام ردود بالواتساب يرد على زباينك 24 ساعة وما يضيع عليك أي زبون. تفضل بسؤالك وأبشر بعزك.";
}

// نص رسالة الاستقطاب البسيطة والواضحة جداً (صياغة سارة ود. إبراهيم)
const SIMPLE_PITCH = `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿

كم زبون يراسلك بالواتساب وأنت مشغول أو نايم ويروح لغيرك؟

حنا في السعد نركب لك في واتساب محلك أو مكتبك نظام يرد على الزباين فوراً بأول ثانية:
يعطيهم الأسعار، يرسل لهم الصور والموقع، ويسجل طلباتهم حتى وأنت نايم.

والسعر بسيط جداً لمرة واحدة بدون أي اشتراك شهري معقد!

إذا ودك نسوي لك تجربة سريعة على رقمك تشوفها بعينك، رد علي بكلمة (تم) وأبشر بعزك 🤝

أخوك سعود | السعد لحلول الأعمال`;

async function startWhatsApp() {
  const authFolder = path.join(__dirname, 'auth_info');
  const { state, saveCreds } = await useMultiFileAuthState(authFolder);

  sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
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
      if (shouldReconnect) startWhatsApp();
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : '966596096620';
      console.log(`[Baileys]: متصل بنجاح برقم: +${connectedPhone}`);
    }
  });

  // الاستماع الشامل لكافة الرسائل والرد عليها فوراً
  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || !m.messages.length) return;

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;

      const sender = msg.key.remoteJid;
      if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || '';

      if (text.trim()) {
        console.log(`[رسالة جديدة من ${sender}]: ${text}`);
        const reply = await getCouncilAIReply(text);
        console.log(`[رد سعود إلى ${sender}]: ${reply}`);
        await sock.sendMessage(sender, { text: reply });
      }
    }
  });
}

// الواجهة الرئيسية
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>محرك السعد السحابي</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#0a0e17; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:40px 20px; }
        .box { background:#111827; border:1px solid #374151; max-width:480px; margin:auto; padding:30px; border-radius:20px; }
        .btn { display:inline-block; padding:12px 24px; border-radius:10px; font-weight:bold; text-decoration:none; margin:10px; font-size:16px; }
        .btn-blue { background:#2563eb; color:#fff; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2 style="color:#10b981; margin-top:0;">🌿 السعد لحلول الأعمال</h2>
        <div style="font-size:50px;">🚀</div>
        <h3 style="color:#34d399;">المحرك السحابي متصل بنجاح ويعمل 24/7</h3>
        <p style="color:#9ca3af;">الرقم النشط: +${connectedPhone || '966596096620'}</p>
        <a href="/send_test_rakan" class="btn btn-blue">🎯 إرسال الرسالة البسيطة لجوالك للتجربة</a>
      </div>
    </body>
    </html>
  `);
});

// إرسال تجريبي فوري لجوال راكان
app.get('/send_test_rakan', async (req, res) => {
  if (!sock) return res.send('❌ المحرك غير متصل');
  const jid = '966548757876@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text: SIMPLE_PITCH });
    res.send('<h1 style="color:#10b981; text-align:center; font-family:sans-serif; margin-top:80px;">✅ تم إرسال الرسالة الجديدة البسيطة إلى جوالك بنجاح! شيك على الواتساب 🚀</h1><p style="text-align:center;"><a href="/">الرجوع</a></p>');
  } catch (e) {
    res.send('خطأ: ' + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
