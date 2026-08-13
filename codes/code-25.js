import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let handler = async (m, { conn, text }) => {
    try {
        // التحقق الصارم من وجود النص وعلامة |
        if (!text || !text.includes('|')) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply(
                `❌ **خطأ: لم تقم بالتحديد بالشكل المطلوب!**\n\n` +
                `لا يمكن الحفظ بدون إدخال اسم المجلد والملف.\n\n` +
                `📌 **الطريقة الصحيحة:**\n` +
                `قم بالرد على الملف واكتب:\n` +
                `\`تصدير اسم_المجلد | اسم_الملف\`\n\n` +
                `مثال:\n` +
                `\`تصدير vedio | vedio1\``
            );
        }

        // إذا كتب بالطريقة الصحيحة، نبدأ العمل ونضع علامة الانتظار
        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        if (!m.quoted) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply('❌ يرجى الرد على الملف المراد حفظه.');
        }

        let quoted = m.quoted;
        let mime = (quoted.msg || quoted).mimetype || '';
        
        if (!quoted.hasMedia && !mime) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply('❌ الرسالة التي رددت عليها لا تحتوي على ملف صالح.');
        }

        let parts = text.split('|').map(v => v.trim());
        let folderName = parts[0]; 
        let customFileName = parts[1];

        if (!folderName || !customFileName) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply('❌ يجب كتابة اسم المجلد واسم الملف بشكل صحيح.\nمثال: `تصدير vedio | vedio1`');
        }

        // مسار المجلد المحدّد من قبل المستخدم فقط
        let targetDir = path.join(__dirname, '../', folderName);

        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        let media = await quoted.download();
        
        let ext = 'bin';
        if (mime) {
            let matches = mime.match(/\/([a-zA-Z0-9-+]+)/);
            if (matches) ext = matches[1].replace('x-', '');
        }
        if (quoted.fileName) {
            let fileExt = path.extname(quoted.fileName).replace('.', '');
            if (fileExt) ext = fileExt;
        }

        let fileName = `${customFileName}.${ext}`;
        let filePath = path.join(targetDir, fileName);

        fs.writeFileSync(filePath, media);

        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        await m.reply(`✅ **تم حفظ الملف بنجاح!**\n📁 المجلد: \`${folderName}\`\n📄 اسم الملف: \`${fileName}\``);

    } catch (error) {
        console.error('خطأ في حفظ الملف:', error);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        await m.reply('❌ حدث خطأ أثناء تنفيذ الطلب.');
    }
};

handler.command = /^(تصدير|vedio)$/i;
handler.group = true; 

export default handler;
