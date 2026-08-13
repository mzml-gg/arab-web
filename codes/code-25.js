import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let handler = async (m, { conn, text }) => {
    try {
        // 1. تفاعل بـ ⏳ فور استلام الأمر للتأكد أنه يعمل
        await conn.sendMessage(m.chat, { react: { text: '⏳', key: m.key } });

        // 2. التحقق مما إذا كانت الرسالة رداً على رسالة أخرى
        if (!m.quoted) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply('❌ يرجى الرد على ملف (فيديو، صورة، مستند، إلخ) لاستخدامه.');
        }

        // 3. التحقق من أن الرسالة المُرد عليها تحتوي على وسائط/ملف
        let quoted = m.quoted;
        let mime = (quoted.msg || quoted).mimetype || '';
        
        if (!quoted.hasMedia && !mime) {
            await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
            return m.reply('❌ الرسالة التي رددت عليها لا تحتوي على ملف صالح.');
        }

        // 4. تحليل النص (مثال: تصدير my_folder|my_file)
        let parts = text ? text.split('|').map(v => v.trim()) : [];
        let folderName = parts[0] || 'downloads'; // إذا لم تكتسب اسم مجلد، سيحفظ في مجلد downloads افتراضياً
        let customFileName = parts[1] || '';

        // تحديد مسار المجلد في سيرفر البوت
        let targetDir = path.join(__dirname, '../', folderName);

        // إنشاء المجلد تلقائياً إذا لم يكن موجوداً
        if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
        }

        // 5. تحميل الملف واستخراج امتداده الحقيقي
        let media = await quoted.download();
        
        // محاولة استخراج الامتداد من الـ mimetype (مثال: application/pdf -> pdf)
        let ext = 'bin';
        if (mime) {
            let matches = mime.match(/\/([a-zA-Z0-9-+]+)/);
            if (matches) ext = matches[1].replace('x-', '');
        }
        // إذا كان هناك اسم ملف أصلي يمكننا أخذ امتداده أيضاً
        if (quoted.fileName) {
            let fileExt = path.extname(quoted.fileName).replace('.', '');
            if (fileExt) ext = fileExt;
        }

        let fileName = customFileName ? `${customFileName}.${ext}` : (quoted.fileName || `file_${Date.now()}.${ext}`);
        let filePath = path.join(targetDir, fileName);

        fs.writeFileSync(filePath, media);

        // 6. تفاعل بـ ✅ عند النجاح وإرسال رسالة تأكيد
        await conn.sendMessage(m.chat, { react: { text: '✅', key: m.key } });
        await m.reply(`✅ **تم حفظ الملف بنجاح!**\n📁 المجلد: \`${folderName}\`\n📄 اسم الملف: \`${fileName}\``);

    } catch (error) {
        console.error('خطأ في حفظ الملف:', error);
        await conn.sendMessage(m.chat, { react: { text: '❌', key: m.key } });
        await m.reply('❌ حدث خطأ أثناء تحميل أو حفظ الملف.');
    }
};

// الأوامر التي تفعل الكود
handler.command = /^(تصدير|vedio)$/i;
handler.group = true; 

export default handler;
