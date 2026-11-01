"""اختبارات واجهة سجل المشتريات (Playwright). تشغيل: python3 -m http.server 8765 ثم python3 tests/ui-purchases.test.py"""
import json, sys
from playwright.sync_api import sync_playwright
BASE="http://localhost:8765/"; KEY="brideListApp.v1"
res=[]; errs=[]
def ok(n,c,d=""): res.append((n,bool(c))); print("PASS" if c else "FAIL",n,d)
IGNORE=("ERR_NAME_NOT_RESOLVED","ERR_INTERNET_DISCONNECTED","Failed to load resource")
with sync_playwright() as p:
    b=p.chromium.launch()
    def page(w,h=800,seed=None):
        ctx=b.new_context(viewport={'width':w,'height':h},locale='ar-EG')
        ctx.add_init_script("localStorage.setItem('brideListApp.v1.onboarding','{\"completed\":true}')")
        if seed: ctx.add_init_script("if(!localStorage.getItem('%s'))localStorage.setItem('%s',%s)"%(KEY,KEY,json.dumps(seed)))
        pg=ctx.new_page()
        pg.on('console',lambda m: errs.append(m.text) if m.type=='error' and not any(x in m.text for x in IGNORE) else None)
        pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog',lambda d: d.accept()); return pg
    def overflow(pg): return pg.evaluate("document.documentElement.scrollWidth>window.innerWidth+1")
    def offscreen(pg,sel):
        return pg.evaluate("""s=>[...document.querySelectorAll(s+' input,'+s+' button,'+s+' select,'+s+' textarea')].filter(e=>e.offsetParent&&(e.getBoundingClientRect().left<-1||e.getBoundingClientRect().right>window.innerWidth+1)).length""",sel)
    def flow(w):
        pg=page(w); pg.goto(BASE+"index.html#/category/cat-v5-furnishings"); pg.wait_for_timeout(600)
        card=pg.locator('.item-card').first
        pg.locator('[data-edit]').first.click(); pg.fill('#itemRequired','6'); pg.click('#itemForm button[type=submit]'); pg.wait_for_timeout(300)
        ok(f"{w}: لا زر زيادة/تقليل كمية قديم",pg.locator('[data-step]').count()==0)
        pg.locator('[data-log]').first.click(); pg.wait_for_timeout(300)
        ok(f"{w}: رسالة عدم وجود عمليات + زر أول عملية","لم يتم تسجيل أي عملية شراء بعد" in pg.inner_text('#plBody') and "تسجيل أول عملية شراء" in pg.inner_text('#plAdd'))
        data=[(2,'1800','أوف وايت'),(1,'950','بيج'),(1,'1100','رمادي'),(2,'2200','كشمير')]
        for q,t,c in data:
            pg.click('#plAdd'); pg.wait_for_timeout(150)
            if q==2 and t=='1800': ok(f"{w}: النموذج بلا overflow/حقول خارج الشاشة",not overflow(pg) and offscreen(pg,'#purchaseDialog')==0)
            pg.fill('#pdQty',str(q)); pg.fill('#pdTotal',t); pg.fill('#pdf-color',c); pg.click('#savePurchase'); pg.wait_for_timeout(200)
        sm=pg.inner_text('#plSummary')
        ar=lambda x:str(x).translate(str.maketrans('0123456789','٠١٢٣٤٥٦٧٨٩'))
        ok(f"{w}: الملخص ٦/٦/٠/٤ عمليات/٦٬٠٥٠ ج.م/١٬٠٠٨٫٣٣","٦٬٠٥٠" in sm and "١٬٠٠٨٫٣٣" in sm and pg.locator('.pc-card').count()==4,sm.replace('\n',' | ')[:140])
        ok(f"{w}: زر التسجيل معطّل بعد اكتمال الكمية",pg.locator('#plAdd').is_disabled())
        # تعديل عملية واحدة
        before=pg.evaluate("JSON.parse(localStorage.getItem('%s'))"%KEY); b_it=[i for i in before['items'] if i['categoryId']=='cat-v5-furnishings'][0]['purchases']
        pg.locator('[data-pedit]').nth(1).click(); pg.wait_for_timeout(150); pg.locator('#pdMoreBox summary').click(); pg.fill('#pdNotes','معدلة'); pg.fill('#pdTotal','1000'); pg.click('#savePurchase'); pg.wait_for_timeout(200)
        st=pg.evaluate("JSON.parse(localStorage.getItem('%s'))"%KEY); it=[i for i in st['items'] if i['categoryId']=='cat-v5-furnishings'][0]
        changed=[(x['id']) for x,y in zip(it['purchases'],b_it) if x!=y]
        ok(f"{w}: تعديل عملية واحدة فقط دون المساس بالباقي",len(changed)==1 and sum(1 for r in it['purchases'] if r['notes']=='معدلة')==1,str(changed))
        n0=len(it['purchases']); pg.locator('[data-pdel]').first.click(); pg.wait_for_timeout(200)
        st=pg.evaluate("JSON.parse(localStorage.getItem('%s'))"%KEY); it=[i for i in st['items'] if i['categoryId']=='cat-v5-furnishings'][0]
        ok(f"{w}: حذف عملية واحدة وتحديث الكميات",len(it['purchases'])==n0-1 and it['purchased']==sum(r['qty'] for r in it['purchases']))
        ok(f"{w}: لا overflow في السجل",not overflow(pg) and offscreen(pg,'#purchaseLogDialog')==0)
        pg.screenshot(path=f'screenshots/purchase-log-{w}.png')
        pg.click('#closePurchaseLog'); pg.wait_for_timeout(200)
        ok(f"{w}: لا overflow في صفحة الفئة",not overflow(pg))
        pg.reload(); pg.wait_for_timeout(500)
        st2=pg.evaluate("JSON.parse(localStorage.getItem('%s'))"%KEY); ok(f"{w}: البيانات تستمر بعد إعادة التحميل",st2['items']==st['items'])
        pg.close()
    for w in (375,390,768,1366): flow(w)
    # تفاصيل مخصصة + سعر فارغ/صفر + منع التجاوز
    pg=page(375); pg.goto(BASE+"index.html#/category/cat-v5-appliances"); pg.wait_for_timeout(500)
    pg.locator('[data-buy]').first.click(); pg.wait_for_timeout(200)
    ok("جهاز: حقول الضمان والموديل","pdf-warrantyMonths" in pg.content() and pg.locator('#pdf-model').count()==1)
    pg.fill('#pdQty','1'); pg.fill('#pdTotal','0'); ok("سعر صفر يُعرض كمسجل صفرًا","صفرًا" in pg.inner_text('#pdUnit'))
    pg.fill('#pdTotal',''); ok("سعر فارغ = غير مسجل","غير مسجل" in pg.inner_text('#pdUnit'))
    pg.locator('#pdCustomBox summary').click(); pg.click('#pdAddCustom'); pg.fill('#pdCustomList [data-clabel]','رقم الموديل'); pg.fill('#pdCustomList [data-cvalue]','2026-X15')
    pg.click('#pdAddCustom'); pg.locator('#pdCustomList .pd-crow').nth(1).locator('[data-clabel]').fill('حقل ٢'); pg.locator('#pdCustomList .pd-crow').nth(1).locator('[data-cvalue]').fill('ق')
    pg.fill('#pdQty','99'); pg.click('#savePurchase'); pg.wait_for_timeout(100)
    ok('منع تجاوز المطلوب برسالة داخل النافذة',pg.locator('#pdError').is_visible() and 'المتبقي' in pg.inner_text('#pdError'),pg.inner_text('#pdError'))
    pg.fill('#pdQty','1')
    pg.click('#savePurchase'); pg.wait_for_timeout(200)
    st=pg.evaluate("JSON.parse(localStorage.getItem('%s'))"%KEY); r=[i for i in st['items'] if i['purchases']][0]['purchases'][0]
    ok("تفاصيل مخصصة متعددة محفوظة والسعر غير مسجل",len(r['custom'])==2 and r['totalPrice'] is None and r['custom'][0]['value']=='2026-X15',str(r['custom']))
    # صورة: ملف غير صالح
    pg.locator('[data-buy]:not([disabled])').first.click(); pg.wait_for_timeout(200)
    pg.locator('#pdMoreBox summary').click(); open('/tmp/x.txt','w').write('hi'); pg.set_input_files('#pdImgInput',{'name':'a.exe','mimeType':'application/x-msdownload','buffer':b'MZ'})
    pg.wait_for_timeout(150); ok("رفض الملف التنفيذي","غير مدعوم" in pg.inner_text('#pdImgHint'))
    # صورة صالحة تُضغط وتُحفظ
    import base64
    png=base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==")
    pg.set_input_files('#pdImgInput',{'name':'a.png','mimeType':'image/png','buffer':png}); pg.wait_for_timeout(500)
    ok("معاينة الصورة بعد الضغط",pg.locator('#pdImgPreview').is_visible())
    pg.click('#cancelPurchase'); pg.close()
    ok("لا أخطاء JavaScript في Console",not errs,str(errs)[:300])
    b.close()
bad=[n for n,c in res if not c]; print(f"\n{len(res)-len(bad)}/{len(res)} passed"); sys.exit(1 if bad else 0)
