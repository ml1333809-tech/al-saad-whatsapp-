// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي الخارق ضد الانهيار (Crash-Proof Baileys Engine)
 * السعد لحلول الأعمال - إشراف المهندس راكان
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

const CONFIG_FILE = path.join(__dirname, 'live_config.json');

// رسالة استقطاب ذكية لا تذكر السعر نهائياً لفتح باب التفاوض الحر حسب حجم العميل
const DEFAULT_CONFIG = {
  pitch_message: `السلام عليكم ورحمة الله وبركاته، مساك الله بالخير يا غالي 🌿\n\nكم زبون يراسلك بالواتساب وأنت مشغول أو بعد الدوام ويروح لغيرك؟\n\nحنا في "السعد" نركب لك في واتساب محلك أو مكتبك نظام يرد على الزباين فوراً بأول ثانية:\nيشرح خدماتك، يرسل الصور والموقع، ويسجل الطلبات حتى وأنت نايم.\n\nتسهيلات ودعم مرن يناسب نشاطك بدون أي التزامات معقدة!\n\nتقدر تشوف طريقة عمل النظام بالفيديو والشرح من رابطنا الرسمي:\n🌐 https://al-saad-whatsapp.onrender.com/demo\n\nإذا ناسبك وتبيه لمشروعك، رد علي بكلمة (أبشر) ونخدمك فوراً 🤝\n\nأخوك سعود | السعد لحلول الأعمال`
};

function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
    }
  } catch (e) {}
  return DEFAULT_CONFIG;
}

function saveConfig(cfg) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(cfg, null, 2), 'utf-8');
  } catch (e) {}
}

let liveConfig = loadConfig();

// توليد رد محمي ضد أي توقف أو خطأ شبكي
async function getAIReply(userMessage) {
  const lower = userMessage.toLowerCase();

  // 1. تفاوض الأسعار الذكي: بدون حرق السعر مباشرة (حسب توجيه م. راكان)
  if (lower.includes('سعر') || lower.includes('كم') || lower.includes('تكلف') || lower.includes('بكم') || lower.includes('اسعار')) {
    return "يا هلا ومسهلا بك يا غالي 🌿\nأسعارنا ميسرة جداً وتعتمد على حجم متطلبات نشاطك، تركيب لمرة واحدة بدون اشتراكات شهرية تثقل عليك!\n\nوش مجال نشاطك بالضبط عشان أعطيك الترتيب المناسب لميزانيتك ونخدمك بأفضل سعر؟";
  }

  if (lower.includes('أبشر') || lower.includes('تم') || lower.includes('تفاصيل') || lower.includes('كيف')) {
    return "تبشر بالجنة يا غالي 🤝 تقدر تشوف فيديو الشرح وطريقة العمل كاملة من الرابط الرسمي:\nhttps://al-saad-whatsapp.onrender.com/demo\nوعطني اسم محلك أو مكتبك ونرتب لك البدء فوراً.";
  }

  // 2. استدعاء الذكاء الاصطناعي مع حماية Try/Catch صارمة لعدم انهيار السيرفر
  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'liquid/lfm-2.5-2.6b:free',
      messages: [
        {
          role: 'system',
          content: "أنت 'سعود' من السعد لحلول الأعمال. تتكلم بلهجة سعودية دارجة، بسيطة جداً ومحترمة. نركب نظام ردود واتساب 24/7 للمحلات والمكاتب عشان ما يضيع أي زبون. الأسعار بالتفاوض المرن حسب احتياج العميل وبدون اشتراكات شهرية معقدة. ردك مختصر جداً في سطرين فقط."
        },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 150,
      temperature: 0.6
    }, {
      headers: { 'Authorization': `Bearer ${OPENROUTER_API_KEY}`, 'Content-Type': 'application/json' },
      timeout: 8000
    });

    if (res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content.trim();
    }
  } catch (err) {
    console.error('AI API timeout, using fallback.');
  }

  return "يا هلا ومسهلا بك في السعد لحلول الأعمال 🌿 نركب لك نظام بالواتساب يرد على زباينك 24 ساعة وما يضيع عليك أي زبون. تفضل بمجال نشاطك وأبشر بعزك.";
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
      if (shouldReconnect) {
        setTimeout(startWhatsApp, 3000);
      }
    } else if (connection === 'open') {
      isConnected = true;
      currentQR = null;
      connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : '966596096620';
      console.log('✅ متصل ومستقر على واتساب:', connectedPhone);
    }
  });

  // معالجة الرسائل مع عزل تام لأي خطأ برمجي يمنع سقوط السيرفر
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || !m.messages.length) return;

      for (const msg of m.messages) {
        if (msg.key.fromMe) continue;
        const sender = msg.key.remoteJid;
        if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

        const text = (msg.message?.conversation || msg.message?.extendedTextMessage?.text || '').trim();
        if (!text) continue;

        console.log(`[رسالة جديدة]: ${text}`);
        const reply = await getAIReply(text);

        if (sock && isConnected) {
          await sock.sendMessage(sender, { text: reply });
          console.log(`[تم الرد]: ${reply}`);
        }
      }
    } catch (msgErr) {
      console.error('Error in message handling (prevented crash):', msgErr.message);
    }
  });
}

// 1. غرفة الإدارة
app.get('/', (req, res) => {
  liveConfig = loadConfig();
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>غرفة تحكم السعد | إدارة النظام</title>
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
        textarea { width:100%; box-sizing:border-box; padding:12px; border-radius:10px; background:#1e293b; border:1px solid #334155; color:#fff; font-family:'Tajawal',sans-serif; font-size:14px; margin-top:6px; margin-bottom:14px; }
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
              <a href="/send_test" class="btn btn-green">🎯 إرسال رسالة العرض بالتفاوض الحر لجوال راكان</a>
            </div>
          `}
        </div>

        <div class="card">
          <h2 style="font-size:17px; margin-top:0; color:#38bdf8;">⚙️ تعديل نص رسالة العرض (بدون كود):</h2>
          <form action="/update_config" method="POST">
            <label>نص رسالة العرض (الاستقطاب):</label>
            <textarea name="pitch_message" rows="8">${liveConfig.pitch_message}</textarea>
            <button type="submit" class="btn btn-blue">💾 حفظ التعديل فوراً</button>
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

// 2. صفحة العرض الرسمية للعملاء (بدون ذكر أي سعر لحماية المفاوضات)
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

app.post('/update_config', (req, res) => {
  const { pitch_message } = req.body;
  liveConfig.pitch_message = pitch_message ? pitch_message.trim() : liveConfig.pitch_message;
  saveConfig(liveConfig);
  res.redirect('/');
});

app.get('/send_test', async (req, res) => {
  if (!isConnected || !sock) return res.send('❌ الواتساب غير متصل بعد');
  liveConfig = loadConfig();
  const jid = '966548757876@s.whatsapp.net';
  try {
    await sock.sendMessage(jid, { text: liveConfig.pitch_message });
    res.send(`
      <div style="text-align:center; font-family:'Tajawal',sans-serif; margin-top:80px; direction:rtl;">
        <h1 style="color:#10b981;">✅ تم إرسال الرسالة إلى جوالك 0548757876 بنجاح!</h1>
        <p>جرب رد على سعود في الواتساب وشوف كيف يرد عليك بدون ما يعلق السيرفر نهائياً 🚀</p>
        <a href="/" style="display:inline-block; padding:10px 20px; background:#10b981; color:#fff; text-decoration:none; border-radius:8px;">الرجوع للوحة التحكم</a>
      </div>
    `);
  } catch (e) {
    res.send('خطأ: ' + e.message);
  }
});

// معالجة الأخطاء غير المتوقعة لمنع انهيار السيرفر إطلاقاً
process.on('uncaughtException', (err) => {
  console.error('[Anti-Crash Handler] Caught exception:', err.message);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Anti-Crash Handler] Unhandled rejection:', reason);
});

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
