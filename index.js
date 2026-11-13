// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي السريع والموثوق (Baileys Cloud Engine)
 * السعد لحلول الأعمال
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;

// الرسالة المعتمدة من المجلس (بسيطة ومباشرة بدون اسم راكان)
const SIMPLE_PITCH = `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿

كم زبون يراسلك بالواتساب وأنت مشغول أو نايم ويروح لغيرك؟

حنا في "السعد" نركب لك في واتساب محلك أو مكتبك نظام يرد على الزباين فوراً بأول ثانية:
يعطيهم الأسعار، يرسل لهم الصور والموقع، ويسجل طلباتهم حتى وأنت نايم.

والسعر بسيط جداً لمرة واحدة بدون أي اشتراك شهري معقد!

إذا ودك نسوي لك تجربة سريعة على رقمك تشوفها بعينك، رد علي بكلمة (تم) وأبشر بعزك 🤝

أخوك سعود | السعد لحلول الأعمال`;

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
      console.log('QR Generated');
    }

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startWhatsApp();
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : '966596096620';
      console.log('Connected to WhatsApp:', connectedPhone);
    }
  });

  // الرد الآلي الذكي الفوري من سعود
  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || !m.messages.length) return;

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;
      const sender = msg.key.remoteJid;
      if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      if (!text) continue;

      let reply = "يا هلا ومسهلا بك يا غالي 🌿 نركب لك نظام ردود بالواتساب يرد على زباينك 24 ساعة وما يضيع عليك أي زبون. تفضل بسؤالك وأبشر بعزك.";
      const lower = text.toLowerCase();

      if (lower.includes('سعر') || lower.includes('كم') || lower.includes('تكلف') || lower.includes('اسعار') || lower.includes('بكم')) {
        reply = "يا هلا ومسهلا بك يا غالي 🌿\nالتركيب وتجهيز الردود بالكامل بـ 290 ريال لمرة واحدة فقط، وما فيه أي اشتراك شهري يثقل عليك!\n\nتحب نسوي لك تجربة تشوفها بنفسك على رقمك أول؟";
      } else if (lower.includes('تم') || lower.includes('نعم') || lower.includes('أكيد') || lower.includes('جرب')) {
        reply = "أبشر بعزك يا غالي! عطني اسم نشاطك أو مجالك ونجهز لك التجربة على رقمك فوراً تشوف كيف يرد على زباينك 🤝";
      }

      await sock.sendMessage(sender, { text: reply });
    }
  });
}

// واجهة الويب الشفافة الصريحة
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>محرك السعد السحابي</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:30px 15px; margin:0; }
        .box { background:#0f172a; border:1px solid #1e293b; max-width:440px; margin:auto; padding:25px; border-radius:20px; box-shadow:0 10px 30px rgba(0,0,0,0.5); }
        .btn { display:block; width:100%; box-sizing:border-box; padding:15px; border-radius:12px; font-weight:900; font-size:16px; text-decoration:none; margin-top:15px; cursor:pointer; border:none; }
        .btn-send { background:#10b981; color:#fff; }
        .qr-card { background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:15px 0; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2 style="color:#10b981; margin:0 0 10px;">🌿 السعد لحلول الأعمال</h2>
        
        ${isConnected ? `
          <div style="font-size:45px; margin:10px 0;">🟢</div>
          <h3 style="color:#34d399; margin:5px 0;">متصل ويعمل 24/7 بنجاح!</h3>
          <p style="color:#9ca3af; font-size:14px; margin-bottom:15px;">الرقم النشط: +${connectedPhone}</p>
          <a href="/send" class="btn btn-send">🚀 إرسال الرسالة البسيطة لجوال راكان الآن</a>
        ` : `
          <h3 style="color:#f59e0b; margin:10px 0;">🟡 بانتظار ربط الواتساب</h3>
          <p style="color:#9ca3af; font-size:13.5px; line-height:1.6;">
            افتح الآيفون: <b>WhatsApp Business</b><br>
            الإعدادات ➔ الأجهزة المرتبطة ➔ ربط جهاز ➔ امسح الرمز:
          </p>
          ${currentQR ? `
            <div class="qr-card"><img src="${currentQR}" width="210" height="210" alt="QR Code"></div>
          ` : `
            <div style="padding:30px; color:#9ca3af;">⏳ جاري تجهيز كود الـ QR... (ثواني فقط)</div>
          `}
        `}
      </div>
      <script>
        ${!isConnected ? 'setTimeout(() => window.location.reload(), 4000);' : ''}
      </script>
    </body>
    </html>
  `);
});

// إرسال مباشر وفوري
app.get('/send', async (req, res) => {
  if (!isConnected || !sock) {
    return res.send('<h2 style="font-family:sans-serif; text-align:center; color:#ef4444; margin-top:60px;">⚠️ الواتساب غير متصل حالياً، ارجع للموقع وامسح الرمز أولاً.</h2><p style="text-align:center;"><a href="/">الرجوع</a></p>');
  }

  const jid = '966548757876@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text: SIMPLE_PITCH });
    res.send(`
      <div style="text-align:center; font-family:'Tajawal',sans-serif; margin-top:80px; direction:rtl;">
        <h1 style="color:#10b981;">✅ تم إرسال الرسالة البسيطة لجوالك 0548757876 بنجاح!</h1>
        <p style="font-size:17px; color:#374151;">شيك على الواتساب الحين، ورد بـ (كم السعر) وشوف الرد الفوري 🚀</p>
        <a href="/" style="display:inline-block; margin-top:15px; padding:10px 20px; background:#10b981; color:#fff; text-decoration:none; border-radius:8px;">الرجوع</a>
      </div>
    `);
  } catch (err) {
    res.send('خطأ في الإرسال: ' + err.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server on ${PORT}`);
  startWhatsApp();
});
