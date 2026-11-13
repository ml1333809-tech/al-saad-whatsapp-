// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي المفتوح المصدر (Baileys Cloud Engine)
 * السعد لحلول الأعمال - إشراف: المهندس راكان
 * غير محدود المحادثات، مجاني 100% للأبد، ويعمل في السحاب 24/7.
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

const PORT = process.env.PORT || 3000;
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";

let sock = null;
let currentQR = null;
let connectionState = 'جاري التهيئة...';
let connectedPhone = null;

// حالة حملة الإرسال الجماعي الآمن
let campaignStatus = {
  running: false,
  currentIndex: 0,
  total: 0,
  sentCount: 0,
  logs: []
};

// قائمة الشركات المستهدفة (من ضمنهم م. راكان للتأكيد الحي)
const TARGET_LEADS = [
  { id: 1, name: "مؤسسة م. راكان للتجارة والديكور", phone: "966548757876", category: "مقاولات وديكور" },
  { id: 2, name: "مكتب ماجد الصقعبي للعقارات", phone: "966550001141", category: "عقارات ووساطة" },
  { id: 3, name: "مكتب الآلية للعقارات وإدارة الأملاك", phone: "966554873777", category: "عقارات وإدارة أملاك" },
  { id: 4, name: "مكتب الخيار الصحيح للخدمات العقارية", phone: "966546444785", category: "عقارات وخدمات" },
  { id: 5, name: "مؤسسة الأفق لتأجير المعدات", phone: "966504221199", category: "معدات ومقاولات" },
  { id: 6, name: "شركة ركائز البناء للمقاولات", phone: "966532299881", category: "مقاولات وبناء" },
  { id: 7, name: "مكتب المزن للاستقدام", phone: "966555123987", category: "خدمات واستقدام" },
  { id: 8, name: "مركز لمسات الفخامة لصيانة السيارات", phone: "966509876543", category: "سيارات وصيانة" },
  { id: 9, name: "مؤسسة الدقة العالية لتقنية المعلومات", phone: "966567891234", category: "تقنية واتصالات" },
  { id: 10, name: "مطعم ومقهى نكهة الأصالة", phone: "966541122334", category: "مطاعم وضيافة" }
];

const SAUDI_SYSTEM_PROMPT = `
أنت 'سعود' - ممثل خدمة العملاء والمبيعات لـ 'السعد لحلول الأعمال'.
تتحدث باللهجة السعودية البيضاء الراقية، الودودة والمحترمة جداً.

خدماتنا:
1. أتمتة الردود ومبيعات الواتساب بالذكاء الاصطناعي لكافة الأنشطة والشركات في السعودية.
2. خدمة عملاء 24/7 (رد على الاستفسارات، تقديم الأسعار، إرسال الكتالوجات).
3. برمجة وتطوير تطبيقات وبرامج مخصصة لأي فكرة تقنية تخدم إدارة وأعمال العميل.
4. تفاوض مرن وباقات ميسرة تناسب ميزانية كل نشاط تجاري دون اشتراكات شهرية معقدة.

أهدافك:
- الترحيب بالعميل بحفاوة سعودية أصيلة.
- الرد باختصار ولطافة وذكاء بيعي يقود العميل للاتفاق.
`;

// استدعاء عقل الذكاء الاصطناعي لتوليد الرد
async function getAIReply(userMessage, senderPhone) {
  try {
    const res = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: 'liquid/lfm-2.5-2.6b:free',
      messages: [
        { role: 'system', content: SAUDI_SYSTEM_PROMPT },
        { role: 'user', content: userMessage }
      ],
      max_tokens: 350,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      timeout: 15000
    });

    if (res.data?.choices?.[0]?.message?.content) {
      return res.data.choices[0].message.content.trim();
    }
  } catch (err) {
    console.error('[AI Engine Error]:', err.message);
  }
  return "يا هلا ومسهلا بك في السعد لحلول الأعمال! 🌿 تفضل بكتابة استفسارك أو طلبك وسنخدمك فوراً بأفضل ترتيب.";
}

// دالة لتوليد رسالة العرض المخصصة لكل نشاط تجاري
function generatePitch(lead) {
  return `السلام عليكم ورحمة الله وبركاته، مساكم الله بالخير يا غالي في ${lead.name} 🌿

نحن في السعد لحلول الأعمال نركب لكم موظفاً ذكياً على رقم واتسابكم:
⚡ يرد بالثانية الواحدة 24 ساعة دون توقف.
📸 يقفل مبيعاتكم ويرسل تفاصيل الخدمات والأسعار لعملائكم.
📅 يحجز وينظم المواعيد والطلبات ويوفر وقت الإدارة.

💡 وأي فكرة تقنية أو أداة خاصة حاب نحولها لتطبيق أو برنامج يسهّل إدارة أعمالك، جاهزين نبرمجها لك بأفضل سعر وتسهيلات مرنة تناسبكم.

أخوكم سعود | السعد لحلول الأعمال 🌿`;
}

// تشغيل محرك الواتساب Baileys
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
      connectionState = 'في انتظار مسح الرمز (QR Code)';
      console.log('[Baileys]: كود الـ QR جاهز للمسح عبر الآيفون.');
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error)?.output?.statusCode !== DisconnectReason.loggedOut;
      connectionState = 'انقطع الاتصال - جاري إعادة الربط التلقائي...';
      console.log('[Baileys]: انقطع الاتصال، جاري إعادة المحاولة:', shouldReconnect);
      if (shouldReconnect) {
        startWhatsApp();
      } else {
        connectionState = 'تم تسجيل الخروج، يرجى مسح الرمز مجدداً';
        currentQR = null;
      }
    } else if (connection === 'open') {
      connectionState = 'متصل بنجاح ويعمل على مدار الساعة 24/7 🚀';
      currentQR = null;
      connectedPhone = sock.user?.id ? sock.user.id.split(':')[0] : 'غير معروف';
      console.log(`[Baileys]: تم الربط بنجاح! رقم الحساب: +${connectedPhone}`);
    }
  });

  // استقبال الرسائل والرد عليها آلياً
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return;

    for (const msg of messages) {
      if (!msg.message || msg.key.fromMe) continue;

      const sender = msg.key.remoteJid;
      // تجاهل محادثات المجموعات والحالات
      if (sender.includes('@g.us') || sender.includes('broadcast')) continue;

      const messageText = msg.message.conversation || 
                          msg.message.extendedTextMessage?.text || '';

      if (messageText.trim()) {
        console.log(`[رسالة واردة من ${sender}]: ${messageText}`);
        
        // توليد الرد من سعود
        const replyText = await getAIReply(messageText, sender);
        console.log(`[رد سعود إلى ${sender}]: ${replyText}`);

        // إرسال الرد
        await sock.sendMessage(sender, { text: replyText });
      }
    }
  });
}

// محرك الإرسال المتتابع مع فاصل زمني ضد الحظر
async function runCampaign() {
  if (campaignStatus.running) return;
  campaignStatus.running = true;
  campaignStatus.total = TARGET_LEADS.length;
  campaignStatus.sentCount = 0;
  campaignStatus.logs.push(`[${new Date().toLocaleTimeString('ar-SA')}] تم بدء حملة الإرسال الفعلي لـ ${TARGET_LEADS.length} شركة.`);

  for (let i = 0; i < TARGET_LEADS.length; i++) {
    const lead = TARGET_LEADS[i];
    campaignStatus.currentIndex = i + 1;
    const jid = `${lead.phone}@s.whatsapp.net`;
    const pitch = generatePitch(lead);

    try {
      if (sock) {
        await sock.sendMessage(jid, { text: pitch });
        campaignStatus.sentCount++;
        const logMsg = `✅ تم الإرسال بنجاح إلى: ${lead.name} (${lead.phone})`;
        console.log(logMsg);
        campaignStatus.logs.unshift(`[${new Date().toLocaleTimeString('ar-SA')}] ${logMsg}`);
      } else {
        campaignStatus.logs.unshift(`❌ السيرفر غير متصل بواتساب`);
        break;
      }
    } catch (err) {
      const errMsg = `❌ خطأ في الإرسال إلى ${lead.name}: ${err.message}`;
      console.error(errMsg);
      campaignStatus.logs.unshift(`[${new Date().toLocaleTimeString('ar-SA')}] ${errMsg}`);
    }

    // فاصل أمان بشري عشوائي بين 25 إلى 45 ثانية لتفادي الحظر
    if (i < TARGET_LEADS.length - 1) {
      const delay = Math.floor(Math.random() * 20000) + 25000;
      campaignStatus.logs.unshift(`⏳ انتظام الأمان ومكافحة الحظر: انتظار ${Math.round(delay/1000)} ثانية قبل الشركة التالية...`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  campaignStatus.running = false;
  campaignStatus.logs.unshift(`🎉 اكتملت حملة الإرسال بنجاح!`);
}

// لوحة التحكم المباشرة
app.get('/', (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <title>محرك واتساب السحابي | السعد لحلول الأعمال</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
      <style>
        body {
          background: #070a12;
          color: #f3f4f6;
          font-family: 'Tajawal', sans-serif;
          min-height: 100vh;
          margin: 0;
          padding: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
        }
        .container {
          max-width: 800px;
          width: 100%;
        }
        .card {
          background: rgba(15, 22, 36, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 20px;
          padding: 24px;
          margin-bottom: 20px;
          box-shadow: 0 10px 30px rgba(0,0,0,0.5);
        }
        .badge {
          display: inline-block;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid #10b981;
          color: #34d399;
          padding: 4px 14px;
          border-radius: 50px;
          font-size: 13px;
          font-weight: 700;
        }
        h1 { font-size: 22px; font-weight: 900; margin: 12px 0 6px; }
        p { font-size: 14px; color: #9ca3af; margin: 0 0 16px; }
        .btn-green {
          display: inline-block;
          background: linear-gradient(135deg, #10b981, #059669);
          color: #fff;
          padding: 14px 28px;
          border-radius: 12px;
          text-decoration: none;
          font-size: 16px;
          font-weight: 900;
          border: none;
          cursor: pointer;
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .btn-green:hover {
          transform: translateY(-2px);
          box-shadow: 0 6px 20px rgba(16, 185, 129, 0.4);
        }
        .btn-blue {
          display: inline-block;
          background: #3b82f6;
          color: #fff;
          padding: 10px 20px;
          border-radius: 10px;
          text-decoration: none;
          font-weight: 700;
          font-size: 14px;
          margin-left: 10px;
        }
        .log-box {
          background: rgba(0,0,0,0.4);
          border: 1px solid rgba(255,255,255,0.05);
          border-radius: 12px;
          padding: 14px;
          height: 220px;
          overflow-y: auto;
          font-size: 13px;
          color: #d1d5db;
          line-height: 1.8;
          font-family: monospace;
          text-align: left;
          direction: ltr;
        }
        .status-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 700;
          color: #10b981;
          margin-bottom: 12px;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 10px;
          font-size: 13.5px;
        }
        th, td {
          padding: 10px;
          text-align: right;
          border-bottom: 1px solid rgba(255,255,255,0.06);
        }
        th { color: #9ca3af; font-weight: 700; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="card" style="text-align: center;">
          <div class="badge">🌿 السعد لحلول الأعمال • محرك سحابي 24/7</div>
          <h1>غرفة التحكم بالإرسال الفعلي المباشر</h1>
          <p>المحرك السحابي متصل بجوالك WhatsApp Business ويعمل ذاتياً 🚀</p>
          
          <div class="status-pill">
            <span>🟢</span> <span>${connectionState} ${connectedPhone ? `(+${connectedPhone})` : ''}</span>
          </div>
          
          <div style="margin-top: 15px;">
            <a href="/send_test_rakan" class="btn-blue">🎯 إرسال فوري لجوال م. راكان للتجربة</a>
            <a href="/start_campaign" class="btn-green">🚀 إطلاق الإرسال الفعلي لـ 10 شركات مستهدفة</a>
          </div>
        </div>

        <div class="card">
          <h2 style="font-size: 17px; margin: 0 0 12px;">📊 سجل الإرسال الفعلي وحالة الأمان:</h2>
          <div class="log-box">
            ${campaignStatus.logs.length ? campaignStatus.logs.map(l => `<div>${l}</div>`).join('') : '<div>بانتظار بدء الإرسال...</div>'}
          </div>
        </div>

        <div class="card">
          <h2 style="font-size: 17px; margin: 0 0 12px;">📋 قائمة الشركات المستهدفة في هذه الدفعة:</h2>
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>الاسم التجاري</th>
                <th>النشاط</th>
                <th>رقم الواتساب</th>
              </tr>
            </thead>
            <tbody>
              ${TARGET_LEADS.map(l => `
                <tr>
                  <td>${l.id}</td>
                  <td>${l.name}</td>
                  <td>${l.category}</td>
                  <td style="direction:ltr; text-align:left;">+${l.phone}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </body>
    </html>
  `);
});

// إرسال تجريبي فوري لجوال م. راكان
app.get('/send_test_rakan', async (req, res) => {
  if (!sock) return res.status(500).send('❌ السيرفر غير متصل بالواتساب بعد');
  const targetJid = '966548757876@s.whatsapp.net';
  const pitchText = generatePitch(TARGET_LEADS[0]);

  try {
    await sock.sendMessage(targetJid, { text: pitchText });
    res.send(`
      <div style="text-align:center; font-family:'Tajawal',sans-serif; margin-top:80px; direction:rtl;">
        <h1 style="color:#10b981;">✅ تم إرسال الرسالة إلى جوالك 0548757876 بنجاح!</h1>
        <p>افتح الواتساب بجوالك الآن وشف الرسالة، ورد عليها عشان سعود يرد عليك آلياً 🌿</p>
        <a href="/" style="display:inline-block; padding:10px 20px; background:#10b981; color:#fff; text-decoration:none; border-radius:8px; font-weight:bold;">الرجوع للوحة التحكم</a>
      </div>
    `);
  } catch (err) {
    res.status(500).send('❌ حدث خطأ أثناء الإرسال: ' + err.message);
  }
});

// بدء حملة الإرسال الفعلي
app.get('/start_campaign', (req, res) => {
  if (!sock) return res.status(500).send('❌ السيرفر غير متصل بالواتساب بعد');
  runCampaign();
  res.redirect('/');
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`محرك Baileys السحابي يعمل على المنفذ ${PORT}`);
  startWhatsApp();
});
