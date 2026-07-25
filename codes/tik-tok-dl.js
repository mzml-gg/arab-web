import axios from 'axios';
import { generateWAMessageFromContent } from '@whiskeysockets/baileys';

// الحقوق والزخارف الخاصة بك
const myCredit = `.𓏲⋆˙𝑵𝜩𝒁𝑼𝑲̤͝𝜣͓ۧٛ͢ ͝ 𝑩𝜣𝑻🎀`;
const emojis = `ⲂＹ 𝒛𝒊𝒂𝒅 Ｘ 𝒎𝒐𝒏𝒕𝒆 3ℝΑＢ 𝒅𝒆𝒗𝒔 🥝👑`;

function contactQuote(m) {
  return {
    key: { participants: '0@s.whatsapp.net', remoteJid: 'status@broadcast', fromMe: false, id: 'NEZUKO' },
    message: {
      contactMessage: {
        displayName: m.pushName || 'User',
        vcard: `BEGIN:VCARD\nVERSION:3.0\nN:${m.pushName || 'User'};;;;\nFN:${m.pushName || 'User'}\nitem1.TEL;waid=${m.sender.split('@')[0]}:${m.sender.split('@')[0]}\nitem1.X-ABLabel:📞 WhatsApp\nORG:NEZUKO BOT ✓\nTITLE:Verified\nEND:VCARD`
      }
    },
    participant: '0@s.whatsapp.net'
  };
}

let handler = async (m, { conn, text, usedPrefix, command }) => {
  const fkontak = contactQuote(m);

  if (command === 'تيك' || command === 'tiktok') {
    if (!text) return conn.reply(m.chat, `*_هـلا_* 🫠\n\n📌 يـرجـى إرسـال الـرابط مـع الأمـر.`, fkontak);
    
    const url = text.trim();
    if (!url.includes('tiktok.com')) return conn.reply(m.chat, `*_هـلا_* ❌\n\nرابـط تـيـك تـوك غـيـر صـحـيـح.`, fkontak);

    await conn.reply(m.chat, `*_هـلا_* ⏳\n\nجـاري جـلـب الـجـودات مـن تـيـك تـوك...`, fkontak);

    try {
      let res = await axios.get(`https://www.tikwm.com/api/?url=${url}`);
      let data = res.data.data;

      if (!data) throw new Error('لم يتم العثور على الفيديو');

      let hdUrl = data.hdplay || data.play; 
      let sdUrl = data.play; 

      let encodedHd = Buffer.from(hdUrl).toString('base64');
      let encodedSd = Buffer.from(sdUrl).toString('base64');

      const buttons = [
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: `📥 جـودة عـالـيـة (HD 1080p)`,
            id: `${usedPrefix}جودة_تيك HD|${encodedHd}`
          })
        },
        {
          name: 'quick_reply',
          buttonParamsJson: JSON.stringify({
            display_text: `📥 جـودة عـاديـة (SD)`,
            id: `${usedPrefix}جودة_تيك SD|${encodedSd}`
          })
        }
      ];

      const interactiveMessage = {
        body: { text: `*_هـلا_*\n\n🎬 *تـحـمـيـل تـيـك تـوك*\n\nأخـتـار الـجـودة الـلـي تـبـيـهـا 👇` },
        footer: { text: 'تـم بـواسـطـة ' + myCredit },
        nativeFlowMessage: { buttons }
      };

      const msg = generateWAMessageFromContent(m.chat, {
        viewOnceMessage: { message: { interactiveMessage } }
      }, { userJid: conn.user.jid, quoted: fkontak });

      return await conn.relayMessage(m.chat, msg.message, { messageId: msg.key.id });

    } catch (e) {
      return conn.reply(m.chat, `*_هـلا_* ❌\n\nفـشـل فـي جـلـب الـفـيـديـو.`, fkontak);
    }
  }

  if (command === 'جودة_تيك') {
    if (!text) return;
    const [quality, encodedUrl] = text.split('|');
    const videoUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');

    await conn.reply(m.chat, `*_هـلا_* ⏳\n\nجـاري الـتـحـمـيـل بـدقـة ${quality} جـاري الـتـحـويـل لـوضـع HD...`, fkontak);

    try {
      const captionText = `*_هـلا_*\n\n✅ تـم الـتـحـمـيـل بـنـجـاح\n🎬 الـجـودة: ${quality === 'HD' ? '1080p (High Quality)' : 'Standard'}\n\n${emojis}\n\nتـم بـواسـطـة\n${myCredit}`;

      // إرسال الفيديو مع تفعيل وضع الدقة العالية
      await conn.sendMessage(m.chat, {
        video: { url: videoUrl },
        mimetype: 'video/mp4',
        caption: captionText,
        fileName: `Nezuko_HD.mp4`,
        // هذه الإعدادات تجبر واتساب على محاولة عرضها كـ HD
        height: 1920,
        width: 1080,
        headerType: 4
      }, { quoted: fkontak });

    } catch (err) {
      await conn.reply(m.chat, `*_هـلا_* ❌\n\nفـشـل الـتـحـمـيـل: ${err.message}`, fkontak);
    }
  }
};

handler.command = /^(تيك|tiktok|جودة_تيك)$/i;
handler.tags = ['downloader'];
export default handler;