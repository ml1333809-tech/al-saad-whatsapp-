// -*- coding: utf-8 -*-
/**
 * محرك واتساب الإنتاجي الاحترافي (Production Baileys Engine)
 * السعد لحلول الأعمال - إشراف المهندس راكان
 * 
 * الميزات الإنتاجية المدمجة:
 * 1. استمرارية الجلسة (Session Persistence): تخزين المفاتيح لعدم طلب مسح الرمز عند إعادة التشغيل.
 * 2. لوحة تحكم حية لتعديل الرسائل والأسعار فوراً دون لمس الكود ودون إعادة بناء السيرفر.
 * 3. حماية العملاء من الانقطاع والرد الفوري الذكي عبر عقل سعود.
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;

// ملف الإعدادات الحية القابل للتعديل من لوحة التحكم مباشرة دون إعادة تشغيل
const CONFIG_FILE = path.join(__dirname, 'live_config.json');

const DEFAULT_CONFIG = {
  price: "290",
  pitch_message: `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿\n\nكم زبون يراسلك بالواتساب وأنت مشغول أو نايم ويروح لغيرك؟\n\nحنا في "السعد" نركب لك في واتساب محلك أو مكتبك نظام يرد على الزباين فوراً بأول ثانية:\nيعطيهم الأسعار، يرسل لهم الصور والموقع، ويسجل طلباتهم حتى وأنت نايم.\n\nوالسعر بسيط جداً لمرة واحدة بدون أي اشتراك شهري معقد!\n\nإذا ودك نسوي لك تجربة سريعة على رقمك تشوفها بعينك، رد علي بكلمة (تم) وأبشر بعزك 🤝\n\nأخوك سعود | السعد لحلول الأعمال`,
  auto_reply_enabled: true
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('Error loading config:', e);
  }
  return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {
    console.error('Error saving config:', e);
  }
}

let liveConfig = loadConfig();

// توليد رد الذكاء الاصطناعي الذكي الفوري من سعود
async function getAIReply(userMessage) {
  const currentPrice = liveConfig.price || "290";
  const systemPrompt = `
أنت 'سعود' من 'السعد لحلول الأعمال'.
تتكلم بلهجة سعودية دارجة، بسيطة جداً، مفهومة لأي شخص عادي وبدون أي مصطلحات تقنية معقدة.
خدمتنا: تركيب نظام ردود تلقائية ذكية على واتساب المحلات والمكاتب 24 ساعة عشان ما يضيع عليهم أي زبون.
السعر المعتمد: تركيب وتجهيز كامل لمرة واحدة بـ ${currentPrice} ريال فقط بدون أي اشتراك شهري!
شروط الرد:
1. رد في سطرين أو 3 فقط وبكلام عامي مريح ومباشر ومرحب (يا هلا ومسهلا، أبشر بعزك).
2. لا تذكر كلمة ذكاء اصطناعي أو روبوت.
3. إذا سأل عن السعر أو التفاصيل، وضح له السعر (${currentPrice} ريال) واعرض عليه تجربة مجانية.
`;

  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'liquid/lfm-2.5-2.6b:free',
      messages: [
        { role: 'system', content: systemPrompt },
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
    console.error('AI Error:', err.message);
  }

  // رد احتياطي فوري من النظام
  const lower = userMessage.toLowerCase();
  if (lower.includes('سعر') || lower.includes('كم') || lower.includes('تكلف') || lower.includes('بكم')) {
    return `يا هلا ومسهلا بك يا غالي 🌿\nالتركيب وتجهيز الردود بالكامل بـ ${currentPrice} ريال لمرة واحدة فقط، وما فيه أي اشتراك شهري يثقل عليك!\n\nتحب نسوي لك تجربة تشوفها بنفسك على رقمك أول؟`;
  }
  return "يا هلا ومسهلا بك في السعد لحلول الأعمال 🌿 نركب لك نظام بالواتساب يرد على زباينك 24 ساعة وما يضيع عليك أي زبون. تفضل بسؤالك وأبشر بعزك.";
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
      if (shouldReconnect) startWhatsApp();
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : '966596096620';
      console.log('✅ متصل ومستقر على واتساب:', connectedPhone);
    }
  });

  // استقبال الرسائل والرد الفوري الحي
  sock.ev.on('messages.upsert', async (m) => {
    if (!m.messages || !m.messages.length) return;

    for (const msg of m.messages) {
      if (msg.key.fromMe) continue;
      const sender = msg.key.remoteJid;
      if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

      const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
      if (!text) continue;

      console.log(`[وارد من ${sender}]: ${text}`);
      const reply = await getAIReply(text);
      console.log(`[صادر إلى ${sender}]: ${reply}`);
      await sock.sendMessage(sender, { text: reply });
    }
  });
}

// لوحة التحكم الحية الكاملة
app.get('/', (req, res) => {
  liveConfig = loadConfig();
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>غرفة قيادة السعد | نظام الواتساب الإنتاجي</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@500;700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#070a12; color:#f3f4f6; font-family:'Tajawal',sans-serif; margin:0; padding:25px; display:flex; justify-content:center; }
        .wrap { max-width:650px; width:100%; }
        .card { background:#0f172a; border:1px solid #1e293b; border-radius:18px; padding:22px; margin-bottom:18px; box-shadow:0 10px 25px rgba(0,0,0,0.4); }
        h1 { font-size:22px; color:#10b981; margin:0 0 8px; text-align:center; }
        .status-badge { display:inline-block; padding:6px 14px; border-radius:30px; font-weight:bold; font-size:14px; margin-bottom:12px; }
        .online { background:rgba(16,185,129,0.15); color:#34d399; border:1px solid #10b981; }
        .offline { background:rgba(245,158,11,0.15); color:#fbbf24; border:1px solid #f59e0b; }
        .btn { display:inline-block; width:100%; box-sizing:border-box; padding:12px; border-radius:10px; font-weight:bold; font-size:15px; border:none; cursor:pointer; text-align:center; text-decoration:none; }
        .btn-green { background:#10b981; color:#fff; }
        .btn-blue { background:#2563eb; color:#fff; }
        textarea, input[type="text"] { width:100%; box-sizing:border-box; padding:12px; border-radius:10px; background:#1e293b; border:1px solid #334155; color:#fff; font-family:'Tajawal',sans-serif; font-size:14px; margin-top:6px; margin-bottom:14px; }
        label { font-size:13.5px; font-weight:bold; color:#9ca3af; }
        .qr-card { background:#fff; padding:12px; border-radius:12px; display:inline-block; margin:15px 0; }
      </style>
    </head>
    <body>
      <div class="wrap">
        <div class="card" style="text-align:center;">
          <h1>🌿 السعد لحلول الأعمال • غرفة التحكم الحية</h1>
          <div class="status-badge ${isConnected ? 'online' : 'offline'}">
            ${isConnected ? `🟢 متصل ومستقر 24/7 (+${connectedPhone})` : '🟡 بانتظار مسح الرمز'}
          </div>

          ${!isConnected ? `
            <div>
              <p style="color:#9ca3af; font-size:13.5px;">امسح الرمز لمرة واحدة من WhatsApp Business في الآيفون:</p>
              ${currentQR ? `<div class="qr-card"><img src="${currentQR}" width="210" height="210"></div>` : '<p style="color:#fbbf24;">⏳ جاري تجهيز الرمز...</p>'}
            </div>
          ` : `
            <div style="margin-top:10px;">
              <a href="/send_test" class="btn btn-green">🎯 إرسال رسالة العرض المباشرة لجوال راكان الآن</a>
            </div>
          `}
        </div>

        <div class="card">
          <h2 style="font-size:17px; margin-top:0; color:#38bdf8;">⚙️ تخصيص الرسائل والأسعار فوراً (بدون تعديل كود):</h2>
          <form action="/update_config" method="POST">
            <label>سعر الباقة لمرة واحدة (ريال سعودي):</label>
            <input type="text" name="price" value="${liveConfig.price}">

            <label>نص رسالة العرض (الاستقطاب):</label>
            <textarea name="pitch_message" rows="7">${liveConfig.pitch_message}</textarea>

            <button type="submit" class="btn btn-blue">💾 حفظ التعديلات فوراً (تطبق في ثانية واحدة)</button>
          </form>
        </div>
      </div>
      <script>
        ${!isConnected ? 'setTimeout(() => window.location.reload(), 4000);' : ''}
      </script>
    </body>
    </html>
  `);
});

// تحديث الإعدادات الحية بدون إعادة تشغيل السيرفر
app.post('/update_config', (req, res) => {
  const { price, pitch_message } = req.body;
  liveConfig.price = price ? price.trim() : "290";
  liveConfig.pitch_message = pitch_message ? pitch_message.trim() : liveConfig.pitch_message;
  saveConfig(liveConfig);
  res.redirect('/');
});

// إرسال تجريبي لجوال راكان
app.get('/send_test', async (req, res) => {
  if (!isConnected || !sock) return res.send('❌ الواتساب غير متصل بعد');
  liveConfig = loadConfig();
  const jid = '966548757876@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text: liveConfig.pitch_message });
    res.send(`
      <div style="text-align:center; font-family:'Tajawal',sans-serif; margin-top:80px; direction:rtl;">
        <h1 style="color:#10b981;">✅ تم إرسال الرسالة إلى جوالك 0548757876 بنجاح!</h1>
        <p>افتح الواتساب بجوالك، ورد بـ (كم السعر) وشوف الرد بالثانية 🚀</p>
        <a href="/" style="display:inline-block; padding:10px 20px; background:#10b981; color:#fff; text-decoration:none; border-radius:8px;">الرجوع للوحة التحكم</a>
      </div>
    `);
  } catch (e) {
    res.send('خطأ: ' + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
