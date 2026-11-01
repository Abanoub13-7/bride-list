"""اختبارات نظام التثبيت المركزي (assets/js/pwa.js) + التنقل + مسح البيانات.
تشغيل: python3 -m http.server 8765  ثم  python3 tests/pwa-install.test.py
ملاحظة: beforeinstallprompt هنا حدث مُصطنع داخل Chromium؛ هذا يختبر منطق الكود فقط، لا تثبيتًا حقيقيًا على Android."""
import json, urllib.request
from playwright.sync_api import sync_playwright
BASE="http://localhost:8765/"
res=[]
def ok(n,c,d=""): res.append(bool(c)); print("PASS" if c else "FAIL",n,d)
FAKE="""(outcome)=>{const e=new Event('beforeinstallprompt',{cancelable:true});window.__calls=0;
 e.prompt=()=>{window.__calls++;return Promise.resolve()}; e.userChoice=new Promise(r=>{window.__resolve=()=>r({outcome,platform:'web'})});
 window.dispatchEvent(e);return e.defaultPrevented}"""
ANDROID="Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36"
IOS="Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1"
with sync_playwright() as p:
    b=p.chromium.launch(); errs=[]
    def page(ua=None,init=None,w=390):
        ctx=b.new_context(viewport={'width':w,'height':800},is_mobile=True,has_touch=True,user_agent=ua,locale='ar-EG')
        ctx.add_init_script("localStorage.setItem('brideListApp.v1.onboarding','{\"completed\":true}')")
        if init: ctx.add_init_script(init)
        pg=ctx.new_page(); pg.on('pageerror',lambda e: errs.append(str(e))); return pg
    st=lambda pg: pg.evaluate("BrideInstall.getState().status")
    hosts=lambda pg: pg.evaluate("[...document.querySelectorAll('[data-install-host]')].map(h=>h.dataset.state)")

    # 1) Android + beforeinstallprompt → قبول
    pg=page(ANDROID); pg.goto(BASE); pg.wait_for_timeout(500)
    ok("بدون الحدث: حالة manual وخطوات يدوية فقط",st(pg)=="manual")
    prevented=pg.evaluate(FAKE,"accepted"); pg.wait_for_timeout(100)
    ok("الحدث محفوظ ومُنع ظهوره التلقائي",prevented and st(pg)=="ready")
    ok("الزران بنفس الحالة (ready)",hosts(pg)==["ready","ready"],str(hosts(pg)))
    pg.click('[data-install-host="banner"] [data-install-btn]'); pg.wait_for_timeout(100)
    ok("prompt() استُدعي مرة واحدة من الضغط",pg.evaluate("window.__calls")==1)
    ok("لا نافذة تعليمات عند توفر التثبيت الأصلي",not pg.evaluate("document.getElementById('installGuideDialog').open"))
    ok("حالة installing ولا رسالة نجاح قبل الاختيار",st(pg)=="installing" and "تم قبول" not in pg.inner_text('#toast'))
    pg.evaluate("window.__resolve()"); pg.wait_for_timeout(200)
    ok("بعد القبول: installed + إشعار نجاح",st(pg)=="installed" and "تم قبول التثبيت" in pg.inner_text('#toast'))
    ok("القبول لا يكتب علامة تثبيت دائمة في localStorage",pg.evaluate("localStorage.getItem('brideList.pwa.installed')")is None)
    ok("الزران تحدّثا معًا (installed) وبلا زر نشط",hosts(pg)==["installed","installed"] and pg.evaluate("[...document.querySelectorAll('[data-install-btn]')].every(b=>b.hidden)"))
    pg.reload(); pg.wait_for_timeout(500)
    ok("إعادة فتح الموقع بلا دليل حيّ: لا يظهر «مثبّت بالفعل» (قد يكون حُذف التطبيق)",st(pg)=="manual" and "مثبّت بالفعل" not in pg.inner_text('[data-install-host="banner"]'),st(pg))
    pg.evaluate(FAKE,"dismissed"); pg.wait_for_timeout(100)
    ok("وصول beforeinstallprompt يعني غير مثبّت → ready",st(pg)=="ready")

    # 2) رفض
    pg=page(ANDROID); pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate(FAKE,"dismissed")
    pg.evaluate("location.hash='#/settings'"); pg.wait_for_timeout(300)
    pg.click('[data-install-host="settings"] [data-install-btn]'); pg.evaluate("window.__resolve()"); pg.wait_for_timeout(200)
    t=pg.inner_text('#toast')
    ok("من الإعدادات: الرفض بلا رسالة نجاح",st(pg)!="installed" and "تم قبول" not in t and "لم يتم التثبيت" in t,t)
    ok("بعد الرفض يرجع الزر لوضع طريقة التثبيت",st(pg)=="manual")

    # 3) appinstalled
    pg=page(ANDROID); pg.goto(BASE); pg.wait_for_timeout(400); pg.evaluate(FAKE,"accepted")
    pg.evaluate("window.dispatchEvent(new Event('appinstalled'))"); pg.wait_for_timeout(100)
    ok("appinstalled يحدّث الحالة والزرين",st(pg)=="installed" and hosts(pg)==["installed","installed"])

    # 4) خطوات خاصة بكل منصة
    pg=page(ANDROID); pg.goto(BASE); pg.wait_for_timeout(400); pg.click('[data-install-host="banner"] [data-install-btn]'); pg.wait_for_timeout(200)
    txt=pg.inner_text('#installGuideDialog')
    ok("Android: خطوات Android فقط",("⋮" in txt) and "Safari" not in txt and "المشاركة" not in txt,txt[:80])
    pg=page(IOS); pg.goto(BASE); pg.wait_for_timeout(400); pg.click('[data-install-host="banner"] [data-install-btn]'); pg.wait_for_timeout(200)
    txt=pg.inner_text('#installGuideDialog')
    ok("iPhone: خطوات Safari فقط بلا ذكر Android",("إضافة إلى الشاشة الرئيسية" in txt) and "⋮" not in txt and "Android" not in txt)
    ok("iPhone: لا يُدّعى وجود نافذة تثبيت أصلية",st(pg)=="manual")

    # 5) داخل التطبيق المثبّت
    pg=page(ANDROID,"Object.defineProperty(navigator,'standalone',{get:()=>true})"); pg.goto(BASE); pg.wait_for_timeout(400)
    ok("standalone: البانر مخفي، والإعدادات تعرض الحالة",st(pg)=="standalone" and pg.evaluate("document.querySelector('[data-install-host=banner]').hidden"))

    # 6) الإخفاء المؤقت للبانر
    pg=page(ANDROID); pg.goto(BASE); pg.wait_for_timeout(400); pg.click('[data-install-dismiss]'); pg.wait_for_timeout(100)
    ok("إغلاق البانر لا يمس زر الإعدادات",pg.evaluate("document.querySelector('[data-install-host=banner]').hidden && !document.querySelector('[data-install-host=settings]').hidden"))

    # 7) Manifest + أيقونات + SW
    pg=page(ANDROID); pg.goto(BASE); pg.wait_for_timeout(1500)
    m=json.load(urllib.request.urlopen(BASE+"manifest.webmanifest"))
    ok("manifest: standalone/start_url/scope/id",m['display']=='standalone' and m['start_url']=='/' and m['scope']=='/' and m['id']=='/')
    good=True
    for i in m['icons']+[x for s in m['shortcuts'] for x in s['icons']]:
        r=urllib.request.urlopen(BASE+i['src'].lstrip('/')); good&=(r.status==200 and r.headers.get('Content-Type','').startswith('image/'))
    ok("كل الأيقونات موجودة وصالحة",good)
    ok("أيقونة maskable موجودة",any(i['purpose']=='maskable' and i['sizes']=='512x512' for i in m['icons']))
    ok("Service Worker يسجَّل ويتحكم",pg.evaluate("navigator.serviceWorker.getRegistration().then(r=>!!r&&!!r.active)"))

    # 8) التنقل و«المزيد» والإعدادات
    pg=page(ANDROID,w=320); pg.goto(BASE); pg.wait_for_timeout(500)
    ok("شريط التنقل: 5 عناصر",pg.locator('.bottom-nav > *').count()==5)
    pg.click('#moreButton'); pg.wait_for_timeout(300); ok("«المزيد» يفتح ويحوي 3 وجهات",pg.locator('#moreSheet a').count()==3 and pg.evaluate("document.getElementById('moreSheet').open"))
    pg.click('#moreSheet a[href="#/settings"]'); pg.wait_for_timeout(400)
    ok("الانتقال للإعدادات يغلق الورقة ويفعّل «المزيد»",not pg.evaluate("document.getElementById('moreSheet').open") and 'active' in pg.get_attribute('#moreButton','class'))
    ok("الإعدادات: 6 أقسام",pg.locator('.settings-group').count()==6)

    # 9) مسح البيانات يتطلب تأكيدًا صريحًا ولا يمس البيانات قبله
    pg.evaluate("window.BrideStore.addItem({categoryId:window.BrideStore.getState().categories[0].id,name:'بند اختبار مسح',unit:'قطعة',required:1})")
    n0=pg.evaluate("BrideStore.getState().items.length")
    pg.click('#resetButton'); pg.wait_for_timeout(200)
    ok("زر المسح النهائي معطّل قبل التأكيد",pg.evaluate("document.getElementById('confirmReset').disabled"))
    pg.click('#cancelReset'); ok("الإلغاء لا يمسح شيئًا",pg.evaluate("BrideStore.getState().items.length")==n0)
    pg.click('#resetButton'); pg.check('#resetAck'); pg.click('#confirmReset'); pg.wait_for_timeout(300)
    ok("بعد التأكيد يُمسح فعلًا",pg.evaluate("!BrideStore.getState().items.some(i=>i.name==='بند اختبار مسح')"))

    # 10) اكتشاف حالة التثبيت: لا علامة دائمة، standalone مرجع، getInstalledRelatedApps (فارغة = غير مثبّت)
    APP="{platform:'webapp',url:'/manifest.webmanifest'}"
    def apis(expr): return "Object.defineProperty(navigator,'getInstalledRelatedApps',{value:()=>%s,configurable:true})"%expr
    NOAPI="Object.defineProperty(navigator,'getInstalledRelatedApps',{value:undefined,configurable:true})"
    LEGACY="localStorage.setItem('brideList.pwa.installed','1')"
    STAND="Object.defineProperty(navigator,'standalone',{get:()=>true})"
    banner_txt=lambda pg: pg.inner_text('[data-install-host="banner"]')
    def fresh(init,ua=ANDROID):
        pg=page(ua,init); pg.goto(BASE); pg.wait_for_timeout(500); return pg

    # 10-أ) علامة قديمة '1' + متصفح بلا دعم للتحقق → لا «مثبّت بالفعل»، وتُحذف العلامة
    pg=fresh(NOAPI+";"+LEGACY)
    ok("بلا دعم للتحقق + علامة قديمة: الحالة manual وليست installed",st(pg)=="manual" and hosts(pg)==["manual","manual"],st(pg))
    ok("العلامة القديمة brideList.pwa.installed تُحذف",pg.evaluate("localStorage.getItem('brideList.pwa.installed')")is None)
    ok("لا نص «مثبّت بالفعل» في البانر ولا في الإعدادات",all("مثبّت بالفعل" not in t for t in pg.evaluate("[...document.querySelectorAll('[data-install-host]')].map(h=>h.textContent)")))

    # 10-ب) علامة قديمة + getInstalledRelatedApps() ترجع [] → غير مثبّت
    pg=fresh(apis("Promise.resolve([])")+";"+LEGACY)
    ok("نتيجة فارغة + علامة قديمة: غير مثبّت (manual)",st(pg)=="manual" and hosts(pg)==["manual","manual"],st(pg))

    # 10-ج) نتيجة غير فارغة → installed في الزرين
    pg=fresh(apis("Promise.resolve([%s])"%APP))
    ok("نتيجة غير فارغة: installed في البانر والإعدادات وبلا زر نشط",st(pg)=="installed" and hosts(pg)==["installed","installed"] and pg.evaluate("[...document.querySelectorAll('[data-install-btn]')].every(b=>b.hidden)"),st(pg))
    ok("نص «التطبيق مثبّت بالفعل» يظهر فقط مع دليل فعلي","مثبّت بالفعل" in banner_txt(pg))

    # 10-د) حذف التطبيق لاحقًا: النتيجة تتحول إلى [] ثم يعود الفحص عند العودة للصفحة
    pg=fresh("window.__apps=[%s];"%APP+apis("Promise.resolve(window.__apps)"))
    ok("قبل الحذف: installed",st(pg)=="installed")
    pg.evaluate("window.__apps=[]; document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(200)
    ok("بعد حذف التطبيق والعودة للصفحة: manual ويعود زر التثبيت",st(pg)=="manual" and hosts(pg)==["manual","manual"] and pg.evaluate("[...document.querySelectorAll('[data-install-btn]')].every(b=>!b.hidden)"),st(pg))
    r=pg.evaluate("window.__apps=[%s]; BrideInstall.recheck()"%APP)
    ok("إعادة التثبيت ثم الفحص: installed",r=="installed" and st(pg)=="installed",str(r))
    r=pg.evaluate("window.__apps=[]; BrideInstall.recheck()")
    ok("recheck() ترجع not-installed وتُسقط الحالة",r=="not-installed" and st(pg)=="manual",str(r))

    # 10-هـ) دليل الجلسة (appinstalled) يسقط إذا أثبت التحقق أنه غير مثبّت؛ وبلا دعم للتحقق يبقى طوال الجلسة فقط
    pg=fresh(apis("Promise.resolve([])")); pg.evaluate(FAKE,"accepted"); pg.evaluate("window.dispatchEvent(new Event('appinstalled'))"); pg.wait_for_timeout(100)
    ok("appinstalled: installed داخل الجلسة",st(pg)=="installed")
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(200)
    ok("تحقق فارغ بعد appinstalled (حُذف التطبيق): يسقط إلى manual",st(pg)=="manual",st(pg))
    pg=fresh(NOAPI); pg.evaluate(FAKE,"accepted"); pg.evaluate("window.dispatchEvent(new Event('appinstalled'))"); pg.wait_for_timeout(100)
    pg.evaluate("document.dispatchEvent(new Event('visibilitychange'))"); pg.wait_for_timeout(150)
    ok("بلا دعم للتحقق: دليل appinstalled الحيّ يبقى داخل الجلسة",st(pg)=="installed")
    pg.reload(); pg.wait_for_timeout(500)
    ok("بلا دعم للتحقق: بعد إعادة الفتح لا يظهر «مثبّت بالفعل»",st(pg)=="manual",st(pg))

    # 10-و) standalone هو المرجع مهما كانت نتيجة التحقق أو العلامة
    pg=fresh(STAND+";"+apis("Promise.resolve([])")+";"+LEGACY)
    ok("standalone + نتيجة فارغة + علامة قديمة: standalone",st(pg)=="standalone" and pg.evaluate("document.querySelector('[data-install-host=banner]').hidden"),st(pg))
    pg=fresh(STAND+";"+apis("Promise.resolve([%s])"%APP))
    ok("standalone + نتيجة غير فارغة: تبقى standalone وليست installed",st(pg)=="standalone",st(pg))
    pg=fresh(STAND+";"+NOAPI)
    ok("standalone بلا دعم للتحقق: standalone",st(pg)=="standalone")
    pg=fresh("window.matchMedia=(q)=>({matches:/display-mode:\\s*standalone/.test(q),media:q,addEventListener(){},removeEventListener(){},addListener(){},removeListener(){}});"+apis("Promise.resolve([])"))
    ok("display-mode: standalone عبر matchMedia يُعتمد كمرجع",st(pg)=="standalone",st(pg))

    # 10-ز) فشل التحقق أو نتيجة غير مفهومة = غير مؤكد ← لا «مثبّت»
    pg=fresh(apis("Promise.reject(new Error('blocked'))")+";"+LEGACY)
    ok("رفض الوعد: لا «مثبّت»",st(pg)=="manual",st(pg))
    pg=fresh(apis("Promise.resolve(undefined)"))
    ok("نتيجة غير مفهومة: لا «مثبّت»",st(pg)=="manual",st(pg))
    pg=fresh(apis("(()=>{throw new Error('sync')})()"))
    ok("استثناء متزامن من الواجهة: لا «مثبّت» ولا خطأ",st(pg)=="manual",st(pg))

    # 10-ح) beforeinstallprompt يغلب أي نتيجة، حتى لو وصلت نتيجة التحقق متأخرة
    pg=fresh(apis("new Promise(r=>setTimeout(()=>r([%s]),1500))"%APP))
    ok("قبل وصول نتيجة التحقق المتأخرة: ليست installed",st(pg)!="installed",st(pg))
    pg.evaluate(FAKE,"accepted"); pg.wait_for_timeout(1700)
    ok("beforeinstallprompt ثم نتيجة متأخرة غير فارغة: تبقى ready",st(pg)=="ready" and hosts(pg)==["ready","ready"],st(pg))
    pg=fresh(apis("Promise.resolve([%s])"%APP)); pg.evaluate(FAKE,"accepted"); pg.wait_for_timeout(100)
    ok("beforeinstallprompt بعد installed: يرجع ready",st(pg)=="ready",st(pg))

    # 10-ط) المفاتيح: لا علامة تثبيت، وزر إغلاق البانر ما زال يعمل بمفتاحه الوحيد
    pg=fresh(NOAPI); pg.evaluate(FAKE,"accepted"); pg.click('[data-install-host="banner"] [data-install-btn]'); pg.evaluate("window.__resolve()"); pg.wait_for_timeout(200)
    pg.evaluate("localStorage.removeItem('brideList.pwa.bannerDismissed')"); pg.click('[data-install-dismiss]'); pg.wait_for_timeout(100)
    keys=pg.evaluate("Object.keys(localStorage).filter(k=>k.indexOf('brideList.pwa.')===0)")
    ok("مفاتيح PWA في localStorage: bannerDismissed فقط",keys==["brideList.pwa.bannerDismissed"],str(keys))
    b.close()
    ok("لا أخطاء JavaScript",not errs,str(errs[:3]))
print(f"\n{sum(res)} passed, {len(res)-sum(res)} failed")
raise SystemExit(0 if all(res) else 1)
