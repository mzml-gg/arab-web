// م࣬ــࢪحہּٰـبٚأ بٚـڪٰٖ فَــي أوٰأم࣬ـࢪ ۿأݪــڪٰٖي ؍ 🌸♡゙ ُ𓂁
// أوٰأم࣬ــࢪ م࣬ٺم࣬يــژۿ . ⊹
// حہּٰقَــــوٰقَ 𝒎𝒐𝒏𝒕𝒆 𝒅𝒆𝒗 🐦☕
// أݪــسٰࢪقَــۿ ݪأ ٺــفَـيډڪٰٖ يم࣬غٰــفَݪ
// أسٰـم࣬ أݪأم࣬ــࢪ جيمي2.js
// ٺـأࢪيخَ صَـنٰأـ؏ٚـۿ أݪــبٚوٰٺ ؍ 🌸♡゙ ُ𓂁 2024_9_22
// ࢪأبٚــطَ قَنٰــأۿ أݪم࣬ــطَــوٰࢪ ..)✘🖤🧸.
// https://whatsapp.com/channel/0029Vb7AkG84inotOc8BXE1K

import fetch from 'node-fetch';

const gemini = {

    getNewCookie: async function () {

        const r = await fetch("https://gemini.google.com/_/BardChatUi/data/batchexecute?rpcids=maGuAc&source-path=%2F&bl=boq_assistant-bard-web-server_20250814.06_p1&hl=en-US&_reqid=173780&rt=c", {
            headers: {
                "content-type": "application/x-www-form-urlencoded;charset=UTF-8"
            },
            body: "f.req=%5B%5B%5B%22maGuAc%22%2C%22%5B0%5D%22%2Cnull%2C%22generic%22%5D%5D%5D&",
            method: "POST"
        });

        const cookieHeader = r.headers.get('set-cookie');

        if (!cookieHeader)
            throw new Error('❌ لم يتم العثور على set-cookie');

        return cookieHeader.split(';')[0];

    },

    ask: async function (prompt, previousId = null) {

        if (!prompt || typeof prompt !== "string")
            throw new Error("❌ النص غير صالح");

        let resumeArray = null
        let cookie = null

        if (previousId) {

            try {

                const s = atob(previousId)
                const j = JSON.parse(s)

                resumeArray = j.newResumeArray
                cookie = j.cookie

            } catch (e) {

                previousId = null

            }

        }

        const headers = {

            "content-type": "application/x-www-form-urlencoded;charset=UTF-8",

            "x-goog-ext-525001261-jspb":
                "[1,null,null,null,\"9ec249fc9ad08861\",null,null,null,[4]]",

            "cookie": cookie || await this.getNewCookie()

        }

        const b = [[prompt], ["en-US"], resumeArray]

        const a = [null, JSON.stringify(b)]

        const body = new URLSearchParams({
            "f.req": JSON.stringify(a)
        })

        const response = await fetch(
            "https://gemini.google.com/_/BardChatUi/data/assistant.lamda.BardFrontendService/StreamGenerate?hl=en-US&rt=c",
            {
                method: "POST",
                headers,
                body
            }
        )

        if (!response.ok)
            throw new Error(`${response.status} ${response.statusText}`)

        const raw = await response.text()

        // إزالة حماية جوجل
        const cleaned = raw.replace(")]}'", "")

        const lines = cleaned.split("\n")

        let text = null
        let newResumeArray = null
        let found = false

        for (const line of lines) {

            if (!line.includes("wrb.fr")) continue

            try {

                const outer = JSON.parse(line)

                const inner = JSON.parse(outer[0][2])

                if (inner?.[4]?.[0]?.[1]?.[0]) {

                    text = inner[4][0][1][0]
                        .replace(/\*\*(.+?)\*\*/g, "*$1*")

                    newResumeArray = inner[1]
                        ? [...inner[1], inner[4][0][0]]
                        : null

                    found = true
                    break

                }

            } catch (e) { }

        }

        if (!found)
            throw new Error("❌ فشل تحليل رد Gemini")

        const id = btoa(JSON.stringify({
            newResumeArray,
            cookie: headers.cookie
        }))

        return { text, id }

    }

}

const geminiSessions = {}

let handler = async (m, { conn, text }) => {

    if (!text)
        return conn.reply(m.chat, "اكتب سؤالك بعد الأمر", m)

    const wait = await conn.reply(m.chat, "⏳ جاري التفكير...", m)

    try {

        if (text.toLowerCase() === "جلسه") {

            delete geminiSessions[m.sender]

            await conn.sendMessage(m.chat, { delete: wait.key })

            return conn.reply(m.chat, "✅ تم تصفير الجلسة", m)

        }

        const previousId = geminiSessions[m.sender]

        const result = await gemini.ask(text, previousId)

        geminiSessions[m.sender] = result.id

        await conn.sendMessage(m.chat, { delete: wait.key })

        await conn.reply(m.chat, result.text, m)

    } catch (err) {

        console.error(err)

        try {
            await conn.sendMessage(m.chat, { delete: wait.key })
        } catch { }

        conn.reply(m.chat, "❌ حدث خطأ أثناء معالجة الطلب", m)

    }

}

handler.help = ['جيميني']
handler.tags = ['ai']
handler.command = /^(جيميني|جيمي2|gemi)$/i

export default handler