// -*- coding: utf-8 -*-
/**
 * محرك واتساب الذكي فائق السرعة (Ultra-Fast Council AI Engine)
 * السعد لحلول الأعمال - تحت إشراف المهندس راكان
 * المجلس الاستشاري: طارق المعماري، د. إبراهيم، كلود، المحقق راشد، فهد، سارة
 */

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, delay } = require('@whiskeysockets/baileys');
const express = require('express');
const QRCode = require('qrcode');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;

// توجيهات المجلس الاستشاري المركزة (عقل سعود)
const COUNCIL_SYSTEM_PROMPT = `
أنت 'سعود' - مستشار المبيعات وخدمة العملاء في 'السعد لحلول الأعمال'.
مرجعيتك قرارات المجلس الاستشاري:
1. الشخصية: سعودي، راقي، ودود، يتحدث باللهجة السعودية البيضاء الهادئة، ذكي في البيع والتفاوض.
2. خدمتنا الأساسية: نركب للمحلات والشركات والمكاتب نظام ردود ذكية بالواتساب يرد على زباينهم في أول ثانية 24/7، يرسل الصور والكتالوج والموقع ويحجز الطلبات حتى وصاحب العمل نايم أو بعد نهاية الدوام.
3. استراتيجية السعر (د. إبراهيم): لا تذكر سعراً ثابتاً في أول رسالة! بيّن أن السعر ميسر جداً ومرن لمرة واحدة وبدون أي اشتراك شهري معقد، واسأل العميل بلطافة عن حجم نشاطه لنعطيه أفضل عرض يناسب ميزانيته.
4. أسلوب الصياغة (سارة): جمل قصيرة جداً (سطرين أو 3)، واضحة ومباشرة وتفتح شهية العميل للتواصل. ممنوع منعاً باتاً ذكر كلمات تقنية مثل: "ذكاء اصطناعي، خوارزمية، روبوت، مجلس".
`;

// محرك المعالجة الذكي فائق السرعة
async function generateCouncilReply(userMessage) {
  const text = userMessage.trim();

  // فحص ذكي وسريع للحالات المباشرة (< 50ms) لضمان عدم الانتظار
  const lower = text.toLowerCase();
  
  // التحية والترحيب
  if (/^(سلام|السلام عليكم|مرحبا|هلا|مساء الخير|صباح الخير)/.test(lower)) {
    return "وعليكم السلام ورحمة الله وبركاته! يا هلا ومسهلا بك يا غالي 🌿 معك أخوك سعود من السعد لحلول الأعمال. نركب لك نظام بالواتساب يرد على زباينك 24 ساعة وما يضيع عليك أي زبون. تفضل بسؤالك ومجال نشاطك وأبشر بسعدك.";
  }

  // الاستفسار عن الأسعار
  if (lower.includes('سعر') || lower.includes('كم') || lower.includes('تكلف') || lower.includes('بكم') || lower.includes('اسعار')) {
    return "يا هلا ومسهلا بك يا غالي 🌿 أسعارنا ميسرة جداً وتعتمد على حجم متطلبات نشاطك، تركيب لمرة واحدة بدون أي اشتراك شهري يثقل عليك!\n\nوش مجال نشاطك بالضبط عشان أرتب لك الترتيب المناسب لميزانيتك ونخدمك بأفضل سعر؟";
  }

  // الموافقة وطلب التفاصيل أو المعاينة
  if (lower.includes('أبشر') || lower.includes('تم') || lower.includes('تفاصيل') || lower.includes('كيف') || lower.includes('شرح')) {
    return "تبشر بالجنة والرضا يا غالي 🤝 تقدر تشوف فيديو الشرح وتجربة النظام الحية من رابطنا الرسمي:\nhttps://al-saad-whatsapp.onrender.com/demo\n\nوعطني اسم محلك أو مكتبك ونجهز لك الترتيب فوراً.";
  }

  // استدعاء الذكاء الاصطناعي مع Timeout سريع جداً (3 ثوانٍ فقط)
  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [
        { role: 'system', content: COUNCIL_SYSTEM_PROMPT },
        { role: 'user', content: text }
      ],
      max_tokens: 150,
      temperature: 0.6
    }, {
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      timeout: 3500
    });

    if (res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content.trim();
    }
  } catch (err) {
    console.log('[Fast Fallback Activated]:', err.message);
  }

  // رد سياقي ذكي في حال تأخر الإنترنت الخارجي
  return "يا هلا بك في السعد لحلول الأعمال 🌿 أبشر بعزك، نركب لك نظام ردود بالواتساب يمسك زباينك بالثانية الواحدة ويوفر وقتك. تفضل بطلبك أو استفسارك وسنخدمك بأحسن ترتيب.";
}

// تشغيل محرك الواتساب
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

  // معالجة الرسائل الواردة بشكل فوري ودقيق
  sock.ev.on('messages.upsert', async (m) => {
    try {
      if (!m.messages || !m.messages.length) return;

      for (const msg of m.messages) {
        // تجاهل الرسائل الصادرة من نفس الحساب
        if (msg.key.fromMe) continue;

        const sender = msg.key.remoteJid;
        if (!sender || sender.includes('@g.us') || sender.includes('broadcast')) continue;

        // استخراج النص من كافة أنواع الرسائل
        const rawText = msg.message?.conversation || 
                         msg.message?.extendedTextMessage?.text || 
                         msg.message?.imageMessage?.caption || 
                         '';

        const text = rawText.trim();
        if (!text) continue;

        console.log(`[وارد من ${sender}]: ${text}`);

        // محاكاة بشرية سريعة: وضع حالة "يكتب الآن..." لطمأنة العميل
        try {
          await sock.sendPresenceUpdate('composing', sender);
        } catch (e) {}

        // توليد الرد من عقل المجلس
        const reply = await generateCouncilReply(text);

        // إرسال الرد
        if (sock && isConnected) {
          await sock.sendMessage(sender, { text: reply }, { quoted: msg });
          console.log(`[تم الرد بنجاح]: ${reply}`);
        }
      }
    } catch (err) {
      console.error('Error handling message:', err.message);
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
      <title>غرفة قيادة السعد | المحرك الذكي</title>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@700;900&display=swap" rel="stylesheet">
      <style>
        body { background:#070a12; color:#fff; font-family:'Tajawal',sans-serif; text-align:center; padding:30px 15px; margin:0; }
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
          <h3 style="color:#34d399;">المحرك الاستشاري يعمل ويرد في أقل من ثانية!</h3>
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

// صفحة المعاينة الرسمية للعملاء (بدون ذكر السعر لحماية التفاوض)
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

process.on('uncaughtException', (err) => console.error('Caught exception:', err.message));
process.on('unhandledRejection', (reason) => console.error('Unhandled rejection:', reason));

app.listen(PORT, () => {
  console.log(`Server on port ${PORT}`);
  startWhatsApp();
});
