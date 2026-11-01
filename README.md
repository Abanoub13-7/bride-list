# Bride List — قائمة جهاز العروسة

موقع عربي (RTL) ثابت بلا إطار عمل: واجهة الأداة في `index.html`، وصفحات الأدلة والمعلومات صفحات ثابتة مستقلة قابلة للفهرسة، ودالة خادم واحدة لنموذج التواصل.

## الهيكل
- `index.html` + `assets/js/{catalog,purchases,calc,storage,tips,icons,app}.js` (الترتيب مهم: calc قبل storage) — الأداة (بياناتها في `localStorage` بالمفتاح `brideListApp.v1`؛ لا يُغيَّر).
- `assets/js/catalog.js` — الكتالوج الافتراضي (مطابق لملف Excel المرجعي). لكل بند معرّف ثابت؛ لا تغيّريه.
- `assets/js/consent.js` + `site-config.js` — إدارة الموافقة والإعلانات والإعدادات العامة.
- `api/contact.js` — دالة Vercel لنموذج التواصل (تحتاج متغيرات بيئة).
- `sw.js` + `manifest.webmanifest` + `assets/js/pwa.js` — PWA (الشبكة أولًا؛ يعمل دون اتصال).
- `tools/build_site.py` — يعيد توليد صفحات `guides/ about/ contact/ privacy/ terms/` و`sitemap.xml` و`robots.txt` (شغّليه بـ `python3 tools/build_site.py` بعد أي تعديل على المحتوى).

## المتغيرات المطلوبة في Vercel (للنموذج)
`RESEND_API_KEY`, `CONTACT_TO_EMAIL`, `CONTACT_FROM_EMAIL` — واختياريًا `TURNSTILE_SECRET_KEY` و`TURNSTILE_SITE_KEY`.

## عند كل نشر
غيّري `CACHE_VERSION` في `sw.js` ليتحدث الكاش عند الزوار.

## سجل المشتريات (schema 7)
- لكل بند `purchases[]` (عمليات مستقلة: qty, totalPrice|null, date, store, notes, type, details{}, custom[]) و`legacy` = «بيانات شراء سابقة غير مفصلة» رُحّلت من النسخة القديمة (كمية + سعر وحدة مجمَّد فقط).
- الكمية المشتراة والمصروف يُشتقان دائمًا من السجل عبر `calc.js` (مصدر وحيد). `item.purchased` نسخة مشتقة للتوافق فقط.
- `totalPrice: null` = سعر غير مسجل، و`0` = سعر صفر. الصور في مفاتيح مستقلة `brideListApp.v1.pimg.<id>` (≤ ~260KB بعد الضغط).
- ترحيل v9 (`seeds.purchaseRecords`): نسخة احتياطية `.pre-v9-backup` ← نسخة معزولة ← تحقق من تطابق الكميات والمصروف ← حفظ مع قراءة تأكيدية.
- أنواع التفاصيل في `purchases.js` (`TYPES`)؛ لإضافة نوع جديد لا يلزم ترحيل.

## الاختبارات
`npm test` (calc + purchases/migration + contact API). واجهة: شغّلي `python3 -m http.server 8765` ثم `python3 tests/ui-purchases.test.py` و`python3 tests/ui.test.py`.
`tests/migration.test.js` (ترحيل v8) يحتاج نسخة الكود الأصلية السابقة في مجلد `ORIG_DIR` وهي غير موجودة في هذا الأرشيف.


## النشر على Netlify وVercel
- اجعلي `bride-list-main` هو مجلد المشروع/Root Directory (المجلد الذي يحتوي على `package.json`).
- Netlify: ملف `netlify.toml` يحدد `npm run build` ومجلد النشر `.`، ويستخدم `netlify/functions/contact.js` كواجهة متوافقة مع دالة التواصل المشتركة في `api/contact.js`. لا تضعي `dist` كمجلد نشر؛ البناء لا ينشئه.
- متغيرات البيئة الخاصة بنموذج التواصل في Netlify هي نفسها المذكورة أعلاه في Vercel.
- Vercel: احتفظي بـ Framework Preset = Other، وأمر البناء `npm run build`، ومجلد الإخراج `.` إذا طُلب تحديده في إعدادات المشروع. اتركي `vercel.json` كما هو.
- لا ترفعي المجلد الخارجي الذي يحتوي `bride-list-main` كجذر للموقع؛ ارفعي محتويات `bride-list-main` أو حددي هذا المجلد كـ Root Directory.

## تثبيت التطبيق على الهاتف (v11)
- نظام تثبيت **مركزي واحد** في `assets/js/pwa.js` (`window.BrideInstall`). كل عنصر `[data-install-host]` يُرسم من الحالة نفسها: بطاقة في الرئيسية (`banner`) وقسم «تثبيت التطبيق على الهاتف» في الإعدادات (`settings`)؛ ويتحدثان معًا عند أي تغيّر.
- الحالات: `ready` (حدث `beforeinstallprompt` محفوظ ← `prompt()` مباشرة من الضغط ثم انتظار `userChoice`)، `installing`، `installed`/`standalone`، `manual` (خطوات خاصة بمنصة واحدة فقط: Android/iPhone/كمبيوتر)، `inapp` (متصفح داخل تطبيق آخر)، `unsupported`.
- لا تُعرض رسالة نجاح إلا بعد قبول التثبيت؛ الرفض يعرض رسالة محايدة. لا تُعرض نافذة تعليمات عندما تكون النافذة الأصلية متاحة.
- حالة «مثبّت» لا تعتمد على علامة دائمة: المرجع الأول `display-mode: standalone` (وiOS `navigator.standalone`)، ثم `beforeinstallprompt` (وصوله = غير مثبّت)، ثم `navigator.getInstalledRelatedApps()` حيث يُدعم (مصفوفة فارغة = غير مثبّت، ويُعاد الفحص عند العودة للصفحة)، وأخيرًا `appinstalled`/قبول نافذة التثبيت كدليل في ذاكرة الجلسة فقط. في المتصفحات التي لا تدعم التحقق (مثل Safari/iOS وFirefox) لا يظهر «التطبيق مثبّت بالفعل» بعد إعادة فتح الموقع، وتظهر طريقة التثبيت.
- مفتاح localStorage الوحيد للتثبيت هو `brideList.pwa.bannerDismissed` (لا علاقة له بـ `brideListApp.v1`). المفتاح القديم `brideList.pwa.installed` لم يعد يُستخدم ويُحذف تلقائيًا عند فتح الموقع.
- Manifest: `display: standalone`، `id/start_url/scope = /`، أيقونات any + maskable (داخل المنطقة الآمنة)، و4 اختصارات (البنود، الميزانية، الفئات، النصائح). تغيّر `orientation` من `portrait` إلى `any`.
- لا يوجد APK ولا متجر: هو PWA يُثبَّت من المتصفح (يتطلب HTTPS).

## تغييرات الواجهة (v11)
شريط تنقل بـ4 وجهات + «المزيد» (النصائح، عن الموقع، الإعدادات) وظاهر على الكمبيوتر أيضًا؛ رئيسية مُعاد ترتيبها (تقدّم واحد، ميزانية مختصرة، بنود تحتاج استكمال، صفوف فئات مضغوطة)؛ بطاقة بند بثلاث خانات (مطلوب/مشترى/متبقي)؛ إعدادات في 6 أقسام؛ مسح البيانات عبر نافذة تأكيد بخانة إقرار؛ رسائل تحقق عربية ومنع الضغط المتكرر؛ حلقات تركيز واضحة واحترام `prefers-reduced-motion`. لم يُغيَّر أي منطق حسابات أو مفاتيح تخزين.

## الاختبارات
`npm test` (node) + `npm run test:ui` + `npm run test:pwa` (تتطلب `python3 -m http.server 8765`). اختبار التثبيت يستخدم حدثًا مصطنعًا؛ التثبيت الفعلي على Android يحتاج جهازًا حقيقيًا عبر HTTPS.
