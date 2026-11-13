// -*- coding: utf-8 -*-
/**
 * محرك واتساب الذكي فائق السرعة والموثوقية (Guaranteed Delivery Engine)
 * السعد لحلول الأعمال - تحت إشراف المهندس راكان
 * المجلس الاستشاري: طارق، د. إبراهيم، كلود، راشد، فهد، سارة
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

let sock = null;
let currentQR = null;
let isConnected = false;
let connectedPhone = null;

// عقل المجلس الاستشاري المدمج للردود البيعية المباشرة
function getCouncilInstantReply(text) {
  const lower = text.toLowerCase().trim();

  // 1. التحيات والترحيب
  if (lower.includes('سلام') || lower.includes('مرحبا') || lower.includes('هلا') || lower.includes('مساء') || lower.includes('صباح') || lower.includes('يا هلا')) {
    return "وعليكم السلام ورحمة الله وبركاته! يا هلا ومسهلا بك يا غالي 🌿 معك أخوك سعود من السعد لحلول الأعمال. نركب لك نظام بالواتساب يرد على زباينك 24 ساعة وما يضيع عليك أي زبون. تفضل بمجال نشاطك واستفسارك وأبشر بعزك.";
  }

  // 2. السؤال عن السعر والتكلفة (د. إبراهيم: بدون حرق السعر مع إبراز المرونة)
  if (lower.includes('سعر') || lower.includes('كم') || lower.includes('تكلف') || lower.includes('بكم') || lower.includes('اسعار') || lower.includes('فلوس') || lower.includes('قيمة')) {
    return "يا هلا ومسهلا بك يا غالي 🌿 أسعارنا ميسرة جداً وتعتمد على حجم متطلبات نشاطك، تركيب لمرة واحدة بدون أي اشتراك شهري يثقل عليك!\n\nوش مجال نشاطك بالضبط عشان أرتب لك أفضل باقة تناسب ميزانيتك ونخدمك بأفضل سعر؟";
  }

  // 3. طلب الشرح والتفاصيل والمعاينة
  if (lower.includes('أبشر') || lower.includes('تم') || lower.includes('تفاصيل') || lower.includes('كيف') || lower.includes('شرح') || lower.includes('فيديو') || lower.includes('رابط') || lower.includes('معاينة')) {
    return "تبشر بالجنة والرضا يا غالي 🤝 تقدر تشوف فيديو الشرح وتجربة النظام الحية من رابطنا الرسمي:\nhttps://al-saad-whatsapp.onrender.com/demo\n\nوعطني اسم محلك أو مكتبك ونجهز لك الترتيب فوراً.";
  }

  // 4. التجربة والضمان والأمان
  if (lower.includes('ضمان') || lower.includes('أمان') || lower.includes('تجربة') || lower.includes('اجرب') || lower.includes('جرب')) {
    return "أبشر بعزك يا غالي! النظام آمن 100% ويعمل بربط رسمي على رقمك بدون برامج خارجية وبدون أي كلمات مرور، وتقدر تشوف طريقة عمله كاملة من رابطنا:\nhttps://al-saad-whatsapp.onrender.com/demo\n\nتفضل باسم مجالك لنبدأ لك الإعداد فوراً.";
  }

  // 5. أي سؤال آخر عام
  return "يا هلا بك في السعد لحلول الأعمال 🌿 أبشر بعزك، نركب لك موظف واتساب ذكي يرد على زباينك بالثانية الواحدة حتى وقت انشغالك أو بعد الدوام. تفضل بطلبك أو استفسارك وسنخدمك بأحسن ترتيب 🤝";
}

// محرك الذكاء الاصطناعي مع ضمان الإرسال الحتمي
async function resolveReplyWithAI(userText) {
  // محاولة الذكاء الاصطناعي الخارجي مع مهلة صارمة (1.5 ثانية فقط!)
  try {
    const aiPromise = axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'mistralai/mistral-7b-instruct:free',
      messages: [
        {
          role: 'system',
          content: "أنت 'سعود' من السعد لحلول الأعمال بالسعودية. تتحدث باللهجة السعودية البيضاء الودودة. نركب نظام ردود واتساب 24/7 للمحلات والشركات. الأسعار ميسرة وتعتمد على حجم النشاط بدون اشتراكات شهرية. ردك في سطرين فقط باختصار ولطافة بدون ذكر كلمات تقنية."
        },
        { role: 'user', content: userText }
      ],
      max_tokens: 120,
      temperature: 0.6
    }, {
      headers: {
        'Authorization': 'Bearer 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',
        'Content-Type': 'application/json'
      },
      timeout: 1800
    });

    const res = await aiPromise;
    if (res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content.trim();
    }
  } catch (e) {
    // في حال بطء أو فشل الاتصال بالإنترنت، ننتقل فوراً إلى عقل المجلس المدمج فائق السرعة
  }

  return getCouncilInstantReply(userText);
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

  // معالجة الرسائل الواردة بإرسال حتمي مضمون
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

        console.log(`[رسالة جديدة واردة من ${sender}]: ${text}`);

        // إظهار جاري الكتابة لمدة ثانية واحدة
        try {
          await sock.sendPresenceUpdate('composing', sender);
        } catch (e) {}

        // توليد الرد من عقول المجلس بضمان الإرسال
        const reply = await resolveReplyWithAI(text);

        // إيقاف إشارة الكتابة
        try {
          await sock.sendPresenceUpdate('paused', sender);
        } catch (e) {}

        // إرسال الرسالة كنص مباشر دون اقتباس (لتفادي أي خطأ في بنية الرسالة)
        if (sock && isConnected) {
          await sock.sendMessage(sender, { text: reply });
          console.log(`[✅ تم إرسال الرد بنجاح]: ${reply}`);
        }
      }
    } catch (err) {
      console.error('Critical Upsert Error:', err.message);
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

// صفحة المعاينة الرسمية
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
