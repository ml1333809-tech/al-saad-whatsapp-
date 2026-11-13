// -*- coding: utf-8 -*-
/**
 * محرك واتساب السحابي المفتوح المصدر (Baileys Cloud Engine)
 * السعد لحلول الأعمال - إشراف: المهندس راكان
 * غير محدود المحادثات، مجاني 100% للأبد، ويعمل في السحاب 24/7 دون الحاجة لتشغيل الكمبيوتر.
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

// لوحة تحكم السيرفر السحابي
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
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0;
          padding: 20px;
        }
        .card {
          background: rgba(15, 22, 36, 0.9);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 24px;
          padding: 32px;
          max-width: 480px;
          width: 100%;
          text-align: center;
          box-shadow: 0 20px 50px rgba(0,0,0,0.5);
        }
        .badge {
          display: inline-block;
          background: rgba(16, 185, 129, 0.15);
          border: 1px solid #10b981;
          color: #34d399;
          padding: 6px 16px;
          border-radius: 50px;
          font-size: 13px;
          font-weight: 700;
          margin-bottom: 16px;
        }
        h1 { font-size: 22px; font-weight: 900; margin-bottom: 8px; }
        p { font-size: 14px; color: #9ca3af; line-height: 1.6; margin-bottom: 24px; }
        .qr-box {
          background: #fff;
          padding: 16px;
          border-radius: 16px;
          display: inline-block;
          margin-bottom: 20px;
        }
        .qr-box img { display: block; max-width: 250px; height: auto; }
        .status-box {
          background: rgba(255,255,255,0.04);
          padding: 12px;
          border-radius: 12px;
          font-size: 13.5px;
          font-weight: 700;
          color: #fbbf24;
        }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="badge">🌿 السعد لحلول الأعمال • محرك سحابي 24/7</div>
        <h1>ربط الواتساب السحابي المفتوح المصدر</h1>
        <p>امسح الرمز لمرة واحدة من تطبيق WhatsApp Business في الآيفون، وسيتولى السيرفر السحابي العمل والرد تلقائياً حتى لو كان لابتوبك مطفأً!</p>
        
        ${currentQR ? `
          <div class="qr-box">
            <img src="${currentQR}" alt="WhatsApp QR Code">
          </div>
          <div class="status-box">📱 افتح الآيفون: الإعدادات ➔ الأجهزة المرتبطة ➔ امسح الرمز أعلاه</div>
        ` : `
          <div style="font-size: 60px; margin: 20px 0;">✅</div>
          <div class="status-box" style="color: #34d399;">
            ${connectionState}
            ${connectedPhone ? `<br><small style="color:#9ca3af;">الرقم المتصل: +${connectedPhone}</small>` : ''}
          </div>
        `}
      </div>
      <script>
        // تحديث تلقائي للصفحة عند تغير الحالة
        setTimeout(() => window.location.reload(), 15000);
      </script>
    </body>
    </html>
  `);
});

// تشغيل الخادم
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 محرك Baileys السحابي يعمل الآن على المنفذ ${PORT}`);
  console.log(`👉 افتح الرابط في المتصفح لمسح كود الـ QR:`);
  console.log(`   http://localhost:${PORT}`);
  console.log(`=======================================================`);
  startWhatsApp();
});

