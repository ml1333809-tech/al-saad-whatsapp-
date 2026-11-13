// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي المفتوح المصدر (Baileys Cloud Engine)
 * السعد لحلول الأعمال - إشراف: المهندس راكان
 * مدعوم بعقل المجلس الاستشاري للذكاء الاصطناعي (AI Council Core)
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

// عقل المجلس الاستشاري الاستراتيجي (سعود - ممثل السعد لحلول الأعمال)
const COUNCIL_BRAIN_PROMPT = `
أنت 'سعود' - المستشار البيعي وممثل خدمة العملاء لـ 'السعد لحلول الأعمال'.
مرجعيتك هي: استراتيجيات التسعير المرن، الإقناع الذكي، واللهجة السعودية البيضاء المحترمة والمرحبة جداً (مثل: يا هلا ومسهلا، حياك الله يا غالي، أبشر بعزك، ما تشيل هم).

خدماتنا الحصرية:
1. تركيب وبرمجة موظف واتساب ذكي بالذكاء الاصطناعي على مدار الساعة (يرد بالثواني، يقفل الصفقات، يحجز المواعيد).
2. برمجة وتطوير أي تطبيق أو نظام تقني مخصص للعميل لتسهيل إدارة عمله.

سياسة الأسعار والتفاوض (مرونة تامة تناسب الجميع):
- الباقة الأساسية للمحلات والمكاتب: رسوم إعداد وتركيب لمرة واحدة ميسرة جداً (تبدأ من 250 إلى 500 ريال فقط) بدون أي اشتراكات شهرية معقدة تثقل عليهم.
- دعم فني وتحديثات عند الطلب برسم رمزي جداً (50 ريال).
- إمكانية تجربة مجانية أو فحص نظامهم مجاناً لإثبات الكفاءة.

تعليمات الرد الصارمة:
1. الرد مباشر، ذكي، مختصر، وجذاب جداً (لا تتجاوز 3 أو 4 أسطر).
2. لا تذكر كلمة 'ذكاء اصطناعي' أو 'مجلس' أو 'روبوت' إطلاقاً، أنت سعود ممثل السعد.
3. قدّم السعر بمرونة وأنهِ ردك بسؤال يقود للاتفاق أو تحديد موعد.
`;

// توليد رد الذكاء الاصطناعي المباشر
async function getCouncilAIReply(userMessage) {
  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'liquid/lfm-2.5-2.6b:free',
      messages: [
        { role: 'system', content: COUNCIL_BRAIN_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 250,
      temperature: 0.7
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

  // رد استراتيجي ذكي احتياطي من صلب قرارات المجلس في حال تعثر الشبكة
  const msg = userMessage.toLowerCase();
  if (msg.includes('سعر') || msg.includes('كم') || msg.includes('تكلف') || msg.includes('اسعار')) {
    return "يا هلا ومسهلا بك يا غالي 🌿\n\nباقاتنا ميسرة جداً ومرنة؛ الإعداد والتركيب لمرة واحدة يبدأ من 290 إلى 450 ريال فقط بدون أي اشتراكات شهرية إلزامية!\n\nيناسبكم نجهز لكم نسخة تجريبية تشوف أداءها بنفسك قبل أي التزام؟";
  }
  return "أهلاً ومرحباً بك في السعد لحلول الأعمال 🌿 أبشر بعزك، معك أخوك سعود. تفضل باستفسارك ونرتب لك أفضل نظام واتساب يخدم نشاطك بأفضل سعر وتسهيلات تناسبك.";
}

// تشغيل محرك واتساب
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

  // الاستماع الشامل لكافة أنواع الرسائل الواردة
  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || !m.messages.length) return;

    for (const msg of m.messages) {
      // تجاهل الرسائل الصادرة من نفس الرقم
      if (msg.key.fromMe) continue;

      const sender = msg.key.remoteJid;
      if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

      // قراءة نص الرسالة مهما كان نوعها
      const text = msg.message?.conversation || 
                   msg.message?.extendedTextMessage?.text || 
                   msg.message?.imageMessage?.caption || '';

      if (text.trim()) {
        console.log(`[رسالة جديدة من ${sender}]: ${text}`);

        // توليد الرد من عقل المجلس
        const reply = await getCouncilAIReply(text);
        console.log(`[رد سعود إلى ${sender}]: ${reply}`);

        // إرسال الرد فوراً
        await sock.sendMessage(sender, { text: reply }, { quoted: msg });
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
      <title>محرك السعد السحابي | الذكاء الاصطناعي</title>
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
        <h3 style="color:#34d399;">عقل سعود ومحرك الردود التلقائية يعمل الآن!</h3>
        <p style="color:#9ca3af;">متصل برقمك: +${connectedPhone || '966596096620'}</p>
        <a href="/send_test_rakan" class="btn btn-blue">🎯 إرسال رسالة العرض لجوال راكان</a>
      </div>
    </body>
    </html>
  `);
});

// إرسال تجريبي لجوال راكان
app.get('/send_test_rakan', async (req, res) => {
  if (!sock) return res.send('❌ المحرك غير متصل');
  const jid = '966548757876@s.whatsapp.net';
  const text = `السلام عليكم ورحمة الله وبركاته، مساكم الله بالخير يا غالي في مؤسسة م. راكان للتجارة والديكور 🌿\n\nنحن في السعد لحلول الأعمال نركب لكم موظفاً ذكياً على رقم واتسابكم:\n⚡ يرد بالثانية الواحدة 24 ساعة دون توقف.\n📸 يقفل مبيعاتكم ويرسل تفاصيل الخدمات والأسعار لعملائكم.\n📅 يحجز وينظم المواعيد والطلبات ويوفر وقت الإدارة.\n\n💡 وأي فكرة تقنية حاب نحولها لتطبيق يسهّل إدارة أعمالك، جاهزين نبرمجها لك بأفضل سعر وتسهيلات مرنة تناسبكم.\n\nأخوكم سعود | السعد لحلول الأعمال 🌿`;
  try {
    await sock.sendMessage(jid, { text });
    res.send('<h1 style="color:#10b981; text-align:center; font-family:sans-serif; margin-top:80px;">✅ تم إرسال رسالة العرض بنجاح!</h1><p style="text-align:center;"><a href="/">الرجوع</a></p>');
  } catch (e) {
    res.send('خطأ: ' + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
