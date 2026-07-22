# ARAB code

منصة عربية لمشاركة الأكواد البرمجية — تصميم HTML/JS خالص، تخزين عبر GitHub، نشر على Vercel.

## المميزات
- إرسال أكواد من قبل المستخدمين للمراجعة
- لوحة إدارة لموافقة/رفض الطلبات
- كل كود موافق عليه يحصل على رابطه الخاص: `/codes/اسم_الملف`
- بحث في العناوين والأوصاف وداخل محتوى الأكواد (GitHub Code Search)
- حسابات مستخدمين محلية لتتبع الطلبات

## متغيرات البيئة (Vercel)
```
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=mzml-gg
GITHUB_REPO=arab-web
GITHUB_BRANCH=main
ADMIN_EMAIL=3rab_top_devs@top.com
ADMIN_PASSWORD=xxxxx
```

## البنية
- `index.html` — الرئيسية
- `submit.html` — إرسال كود
- `search.html` — البحث
- `account.html` — حساب المستخدم
- `admin.html` — لوحة الإدارة
- `api/*.js` — Serverless functions (GitHub-backed storage)
- `public/codes/` — الأكواد المنشورة (تحصل على URL مباشر)
- `public/manifest.json` — فهرس الأكواد
- `pending/` — الطلبات المعلّقة
