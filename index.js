// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي المفتوح المصدر (Baileys Cloud Engine)
 * السعد لحلول الأعمال - إشراف: المهندس راكان
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

const TARGET_LEADS = [
  { id: 1, name: "مؤسسة م. راكان للتجارة والديكور", phone: "966548757876" },
  { id: 2, name: "مكتب ماجد الصقعبي للعقارات", phone: "966550001141" },
  { id: 3, name: "مكتب الآلية للعقارات وإدارة الأملاك", phone: "966554873777" },
  { id: 4, name: "مكتب الخيار الصحيح للخدمات العقارية", phone: "966546444785" },
  { id: 5, name: "مؤسسة الأفق لتأجير المعدات", phone: "966504221199" }
];

function generatePitch(lead) {
  return `السلام عليكم ورحمة الله وبركاته، مساكم الله بالخير يا غالي في ${lead.name} 🌿\n\nنحن في السعد لحلول الأعمال نركب لكم موظفاً ذكياً على رقم واتسابكم:\n⚡ يرد بالثانية الواحدة 24 ساعة دون توقف.\n📸 يقفل مبيعاتكم ويرسل تفاصيل الخدمات والأسعار لعملائكم.\n📅 يحجز وينظم المواعيد والطلبات ويوفر وقت الإدارة.\n\n💡 وأي فكرة تقنية أو أداة خاصة حاب نحولها لتطبيق أو برنامج يسهّل إدارة أعمالك، جاهزين نبرمجها لك بأفضل سعر وتسهيلات مرنة تناسبكم.\n\nأخوكم سعود | السعد لحلول الأعمال 🌿`;
}

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
      console.log('[Baileys]: كود QR جديد جاهز للعرض.');
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

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;
    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;
      const sender = msg.key.remoteJid;
      if (sender.includes('@g.us') || sender.includes('broadcast')) continue;

      const userText = msg.message.conversation || msg.message.extendedTextMessage?.text || '';
      if (userText.trim()) {
        const reply = "يا هلا ومسهلا بك في السعد لحلول الأعمال! 🌿 خدماتنا أتمتة الواتساب والردود الذكية وتطوير البرامج والتطبيقات المخصصة، كيف نقدر نخدمك اليوم؟";
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
      <title>ربط الواتساب السحابي | السعد لحلول الأعمال</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#0a0e17; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:40px 20px; }
        .box { background:#111827; border:1px solid #374151; max-width:480px; margin:auto; padding:30px; border-radius:20px; }
        .btn { display:inline-block; padding:12px 24px; border-radius:10px; font-weight:bold; text-decoration:none; margin:10px; font-size:16px; }
        .btn-blue { background:#2563eb; color:#fff; }
        .btn-green { background:#059669; color:#fff; }
        .qr-card { background:#fff; padding:15px; border-radius:15px; display:inline-block; margin:20px 0; }
      </style>
    </head>
    <body>
      <div class="box">
        <h2 style="color:#10b981; margin-top:0;">🌿 السعد لحلول الأعمال</h2>
        ${isConnected ? `
          <div style="font-size:50px;">✅</div>
          <h3 style="color:#34d399;">المحرك السحابي متصل بنجاح 24/7 🚀</h3>
          <p style="color:#9ca3af;">الرقم النشط: +${connectedPhone}</p>
          <a href="/send_test_rakan" class="btn btn-blue">🎯 إرسال تجريبي لجوال راكان (0548757876)</a>
        ` : `
          <h3>امسح الرمز لربط الواتساب</h3>
          <p style="color:#9ca3af; font-size:14px;">من تطبيق WhatsApp Business في الآيفون:<br>الإعدادات ➔ الأجهزة المرتبطة ➔ ربط جهاز</p>
          ${currentQR ? `
            <div class="qr-card"><img src="${currentQR}" width="220" height="220"></div>
          ` : `
            <div style="padding:40px; color:#fbbf24;">⏳ جاري توليد كود الـ QR الآن...</div>
          `}
        `}
      </div>
      <script>
        ${!isConnected ? 'setTimeout(() => window.location.reload(), 3000);' : ''}
      </script>
    </body>
    </html>
  `);
});

// إرسال تجريبي لجوال راكان
app.get('/send_test_rakan', async (req, res) => {
  if (!isConnected || !sock) return res.redirect('/');
  const jid = '966548757876@s.whatsapp.net';
  const text = generatePitch(TARGET_LEADS[0]);
  try {
    await sock.sendMessage(jid, { text });
    res.send('<h1 style="color:#10b981; text-align:center; font-family:sans-serif; margin-top:80px;">✅ تم إرسال رسالة العرض إلى جوالك 0548757876 بنجاح! شيك على الواتساب 🚀</h1><p style="text-align:center;"><a href="/">الرجوع</a></p>');
  } catch (e) {
    res.send('خطأ: ' + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
