# Bride List — قائمة جهاز العروسة

موقع عربي (RTL) ثابت بلا إطار عمل: واجهة الأداة في `index.html`، وصفحات الأدلة والمعلومات صفحات ثابتة مستقلة قابلة للفهرسة، ودالة خادم واحدة لنموذج التواصل.

## الهيكل
- `index.html` + `assets/js/{catalog,storage,calc,tips,icons,app}.js` — الأداة (بياناتها في `localStorage` بالمفتاح `brideListApp.v1`؛ لا يُغيَّر).
- `assets/js/catalog.js` — الكتالوج الافتراضي (مطابق لملف Excel المرجعي). لكل بند معرّف ثابت؛ لا تغيّريه.
- `assets/js/consent.js` + `site-config.js` — إدارة الموافقة والإعلانات والإعدادات العامة.
- `api/contact.js` — دالة Vercel لنموذج التواصل (تحتاج متغيرات بيئة).
- `sw.js` + `manifest.webmanifest` + `assets/js/pwa.js` — PWA (الشبكة أولًا؛ يعمل دون اتصال).
- `tools/build_site.py` — يعيد توليد صفحات `guides/ about/ contact/ privacy/ terms/` و`sitemap.xml` و`robots.txt` (شغّليه بـ `python3 tools/build_site.py` بعد أي تعديل على المحتوى).

## المتغيرات المطلوبة في Vercel (للنموذج)
`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` — واختياريًا `TURNSTILE_SECRET_KEY` و`TURNSTILE_SITE_KEY`.

## عند كل نشر
غيّري `CACHE_VERSION` في `sw.js` ليتحدث الكاش عند الزوار.
