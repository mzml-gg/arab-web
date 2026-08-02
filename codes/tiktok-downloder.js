
import axios from "axios";

let handler = async (m, { conn, text }) => {
  if (!text) return m.reply("🏦 ⇦ ≺ارسل رابط التيك توك بعد الأمر≻\nمثال:\n.تيك https://www.tiktok.com/...");
  
  try {
    m.reply("جـاري الـتـحـمـيل مـن مـنـصه تـكـتـوك …..🌸🌺");

    const apiUrl = `https://www.tikwm.com/api/?url=${encodeURIComponent(text)}`;
    const response = await axios.get(apiUrl);
    const data = response.data?.data;

    if (!data || !data.play) return m.reply("🏦 ⇦ ≺لم أستطع استخراج الفيديو، تأكد من صحة الرابط≻");

    const videoUrl = data.play; 
    const desc = data.title || "🎬 فيديو من تيك توك";

    const caption = `
『لـقـد تـم تـحـميل الـڨـيـديـو』
〘 الـمـنـصه 〙 TIK TOK


❄️ ⇦ ≺${desc}≻
`.trim();

    await conn.sendMessage(m.chat, {
      video: { url: videoUrl },
      caption: caption,
    }, { quoted: m });

  } catch (e) {
    console.error(e);
    m.reply("🏦 ⇦ ≺حدث خطأ أثناء تحميل الفيديو، حاول لاحقاً≻");
  }
};

handler.help = ['تيك <الرابط>'];
handler.tags = ['download'];
handler.command = /^تيك$/i;

export default handler;
