// م࣬ــࢪحہּٰـبٚأ بٚـڪٰٖ فَــي أوٰأم࣬ـࢪ GₐₜₐBₒₜ-MD-ₘₐₛₜₑᵣ ⫍ ⃢ ؍ 🌸♡゙ ُ𓂁
// أوٰأم࣬ــࢪ م࣬ٺم࣬يــژۿ. ⊹
// حہּٰقَــــوٰقَ GₐₜₐBₒₜ-MD-ₘₐₛₜₑᵣ ⫍ ⃢ 𝒅𝒆𝒗 🐦☕
// أݪــسٰࢪقَــۿ ݪأ ٺــفَـيډڪٰٖ يم࣬غٰــفَݪ
// أسٰـم࣬ أݪأم࣬ــࢪ اختراق.js
// ٺـأࢪيخَ صَـنٰأـ؏ٚـۿ أݪــبٚوٰٺ ؍ 🌸♡゙ ُ𓂁 18/8/2026

let handler = async (m, { conn }) => {
let target = m.quoted?.sender || m.mentionedJid?.[0]
if (!target) return m.reply(`*🕊️ رد على رسالة العضو أو منشن العضو*\nمثال:.اختراق @user`)

let name = await conn.getName(target)
let chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*"
let عشوائي = (len) => [...Array(len)].map(() => chars[Math.floor(Math.random()*chars.length)]).join("")

let { key } = await conn.sendMessage(m.chat, {text: `*🔴 جاري الاتصال بالجهاز...*\n*الهدف: ${name}*\n*برجاء الانتظار*`}, {quoted: m})

// المرحلة 1: اكواد بتظهر وتختفي
for(let i=0; i<6; i++){
await new Promise(r => setTimeout(r, 400))
await conn.sendMessage(m.chat, {text: `\`\`[جاري الدخول] ${عشوائي(20)}\n[فحص النظام] ${عشوائي(25)}\n[الايبي: 192.168.${Math.floor(Math.random()*255)}.${Math.floor(Math.random()*255)}]\`\`\``, edit: key}, {quoted: m})
}

// المرحلة 2: 3 اشرطة تحميل
let اشرطة = [
{اسم: "سحب الصور من المعرض", max: 100},
{اسم: "فك تشفير قاعدة بيانات الواتساب", max: 100},
{اسم: "رفع الملفات للسيرفر", max: 100}
]

for(let شريط of اشرطة){
for(let i=0; i<=شريط.max; i+=10){
let البار = "█".repeat(i/10) + "▒".repeat(10 - i/10)
await new Promise(r => setTimeout(r, 350))
await conn.sendMessage(m.chat, {text: `*${شريط.اسم}*\n${البار} ${i}%\n*الحالة: ${عشوائي(8)}*`, edit: key}, {quoted: m})
}
}

// المرحلة 3: النتيجة
let عدد_الصور = Math.floor(Math.random()*300 + 50)
await new Promise(r => setTimeout(r, 800))
await conn.sendMessage(m.chat, {text: `*✅ اكتملت العملية بنجاح*\n*تم سحب ${عدد_الصور} صورة*\n*كلمة السر: ${عشوائي(12)}*\n\n*━━━━━━━━━━━━━━*\n*    هل تريد اختراق جهاز اخر*\n*     تم اختراق جهاز الضحية بنجاح*\n*تمت العملية بنجاح 😈*`, edit: key}, {quoted: m})
}

handler.command = ["اختراق", "hack"]
handler.help = ["اختراق @tag"]
handler.tags = ["fun"]
export default handler