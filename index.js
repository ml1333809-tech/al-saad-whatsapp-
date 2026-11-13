// -*- coding: utf-8 -*-
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
let sock = null;
let currentQR = null;
let isConnected = false;

// نص الرسالة البسيطة والواضحة جداً (بدون اسم راكان وبدون تعقيد)
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
    printQRInTerminal: true,
    browser: ['السعد لحلول الأعمال', 'Chrome', '1.0.0']
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;
    if (qr) currentQR = await QRCode.toDataURL(qr);

    if (connection === 'close') {
      isConnected = false;
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) startWhatsApp();
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      console.log('✅ متصل بنجاح 24/7');
    }
  });

  // الرد الآلي المباشر والفوري على أي رسالة
  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || !m.messages.length) return;
    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;
      const sender = msg.key.remoteJid;
      if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      if (!text) continue;

      console.log(`رسالة واردة: ${text}`);
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

// الواجهة
app.get('/', (req, res) => {
  res.send(`
    <div style="font-family:sans-serif; text-align:center; padding:50px; background:#0f172a; color:#fff; min-height:100vh;">
      <h1 style="color:#10b981;">🌿 السعد لحلول الأعمال</h1>
      <p style="font-size:18px;">${isConnected ? '🟢 المحرك متصل ويعمل 24/7' : '🟡 جاري الاتصال...'}</p>
      <br>
      <a href="/send_test" style="display:inline-block; padding:15px 30px; background:#2563eb; color:#fff; font-size:18px; font-weight:bold; border-radius:10px; text-decoration:none;">🎯 إرسال الرسالة البسيطة الجديدة لجوالك فوراً</a>
    </div>
  `);
});

// إرسال الرسالة الجديدة
app.get('/send_test', async (req, res) => {
  if (!sock) return res.send('❌ انتظر ثواني حتى يكتمل الاتصال');
  const jid = '966548757876@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text: SIMPLE_PITCH });
    res.send('<h1 style="color:#10b981; text-align:center; margin-top:80px; font-family:sans-serif;">✅ تم إرسال الرسالة الجديدة البسيطة بنجاح! شيك على الواتساب الآن 🚀</h1><p style="text-align:center;"><a href="/" style="font-size:20px;">الرجوع</a></p>');
  } catch (e) {
    res.send('خطأ: ' + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  startWhatsApp();
});
