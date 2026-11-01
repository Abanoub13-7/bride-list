import json, sys, re
from playwright.sync_api import sync_playwright
BASE="http://localhost:8765/"; KEY="brideListApp.v1"
fixture=open('tests/fixtures/old-user-v7.json',encoding='utf-8').read()
res=[]; errs=[]
def ok(n,c,d=""): res.append((n,bool(c),d)); print("PASS" if c else "FAIL",n,d)
with sync_playwright() as p:
    b=p.chromium.launch()
    def page_for(w,h=800,seed=None):
        ctx=b.new_context(viewport={'width':w,'height':h},locale='ar-EG')
        ctx.add_init_script("localStorage.setItem('brideListApp.v1.onboarding','{\"completed\":true}')")
        if seed: ctx.add_init_script("if(!localStorage.getItem('%s'))localStorage.setItem('%s',%s)"%(KEY,KEY,json.dumps(seed)))
        pg=ctx.new_page(); pg.on('console',lambda m: errs.append(m.text) if m.type=='error' else None); pg.on('pageerror',lambda e: errs.append(str(e))); return pg
    def go(pg,h): pg.goto(BASE+"index.html"+h); pg.wait_for_timeout(700)
    # ---- legacy user (both budgets, honeymoon archive with budget only)
    pg=page_for(375,seed=fixture); go(pg,"#/budget")
    st=pg.evaluate("JSON.parse(localStorage.getItem('%s'))"%KEY)
    raf=[c for c in st['categories'] if c['id']=='cat-rafayea'][0]
    ok("ميزانية موحدة 25000",raf['budget']==25000,str(raf['budget']))
    ok("لا فئة قديمة في البيانات",not any(c['id']=='cat-v5-kitchen-tools' for c in st['categories']))
    pg.evaluate("document.querySelectorAll('.toast,[role=status].toast,#toast').forEach(e=>e.remove())")
    txt=pg.inner_text('body')
    ok("لا ذكر لـ «أدوات المطبخ والرفايع» في صفحة الميزانية خارج إشعار الدمج","أدوات المطبخ والرفايع" not in txt)
    ok("الرفايع مرة واحدة في بطاقات الميزانية",pg.locator('.bd-cat:has-text("الرفايع")').count()==1)
    cards=pg.locator('.bd-cat').count(); ok("9 بطاقات فئات",cards==9,str(cards))
    ok("تظهر ملاحظة التكلفة الجزئية",pg.locator('.bd-partial').count()>0)
    ok("رقم الميزانية الإجمالية ظاهر",'60' in pg.inner_text('#planTotal').replace(',','').replace('٦','6').replace('٠','0'))
    pg.screenshot(path='screenshots/01-budget-375.png',full_page=True)
    # category rafayea
    go(pg,"#/category/cat-rafayea"); pg.screenshot(path='screenshots/03-rafayea-375.png',full_page=True)
    n=pg.locator('.item-card, .item-row, [data-item-id]').count(); ok("صفحة الرفايع تعرض بنودًا",n>0,str(n))
    heads=pg.evaluate("[...document.querySelectorAll('.group-title, .group-head, h4')].map(e=>e.textContent.trim())")
    ok("مجموعات الرفايع بلا تكرار عناوين",len(heads)==len(set(heads)),str(len(heads)))
    # old route alias
    go(pg,"#/category/cat-v5-kitchen-tools"); ok("الرابط القديم يفتح الرفايع","الرفايع" in pg.inner_text('body'))
    # categories list
    go(pg,"#/categories"); pg.screenshot(path='screenshots/02-categories-375.png',full_page=True)
    pg.evaluate("document.querySelectorAll('.toast,#toast').forEach(e=>e.remove())"); t=pg.inner_text('body'); ok("قائمة الفئات: الرفايع مرة واحدة ولا فئة قديمة",t.count("أدوات المطبخ والرفايع")==0)
    # tips honeymoon archive
    go(pg,"#/tips"); 
    pg.evaluate("[...document.querySelectorAll('[data-tab],button,a')].find(e=>/شنطة شهر العسل/.test(e.textContent))?.click()"); pg.wait_for_timeout(500)
    t=pg.inner_text('body'); ok("ميزانية شهر العسل القديمة تظهر في الأرشيف","ميزانية قديمة محفوظة" in t and "6" in t.replace('٦','6'))
    ok("ملاحظة أنها ليست ميزانية نشطة","ليست ميزانية مشتريات نشطة" in t)
    pg.screenshot(path='screenshots/04-honeymoon-tips-375.png',full_page=True)
    # not in budget total
    go(pg,"#/budget"); ok("ميزانية شهر العسل لا تظهر بصفحة الميزانية","شهر العسل" not in pg.inner_text('#categoryCostList'))
    # dashboard vs budget consistency
    go(pg,"#/dashboard"); d=pg.inner_text('#requiredCost'); go(pg,"#/budget"); bb=pg.inner_text('#budgetRequired').replace('*','')
    ok("الرئيسية والميزانية نفس تكلفة القائمة",d.replace('*','').strip()==bb.strip(),d+" | "+bb)
    # functional: edit price/qty/notes via updateItem; الكمية المشتراة صارت تُشتق من سجل المشتريات (addPurchase) بدل تعديلها يدويًا
    r=pg.evaluate("""()=>{const S=window.BrideStore;const id='item-rafayea-2';const before=S.getState().items.find(i=>i.id===id);
      S.updateItem(id,Object.assign({},before,{unitPrice:100,required:3,notes:'ملاحظة اختبار'}));S.addPurchase(id,{qty:2,totalPrice:200});S.setCategoryBudget('cat-rafayea',40000);
      const it=S.getState().items.find(i=>i.id===id);return [it.unitPrice,it.required,it.purchased,it.notes,S.getState().categories.find(c=>c.id==='cat-rafayea').budget]}""")
    ok("تعديل سعر/كمية/شراء/ملاحظة/ميزانية",r==[100,3,2,'ملاحظة اختبار',40000],str(r))
    pg.reload(); pg.wait_for_timeout(600)
    r2=pg.evaluate("JSON.parse(localStorage.getItem('%s')).categories.find(c=>c.id==='cat-rafayea').budget"%KEY); ok("تحديث الصفحة لا يعيد الجمع",r2==40000,str(r2))
    # add + delete item
    r=pg.evaluate("""()=>{const S=window.BrideStore;const n0=S.getState().items.length;const a=S.addItem({categoryId:'cat-rafayea',name:'بند اختبار',unit:'قطعة',required:2,purchased:0,unitPrice:null,notes:''});
      const id=(a&&a.id)||S.getState().items.at(-1).id;const n1=S.getState().items.length;S.deleteItem(id);return [n0,n1,S.getState().items.length]}""")
    ok("إضافة ثم حذف بند",r[1]==r[0]+1 and r[2]==r[0],str(r))
    # budget dialog via UI
    go(pg,"#/budget"); pg.locator('[data-edit-budget="cat-rafayea"]').first.click(); pg.wait_for_timeout(300)
    ok("نافذة تعديل الميزانية تفتح",pg.locator('dialog[open], .modal.open, #budgetDialog').first.is_visible())
    pg.close()
    # ---- fresh user
    pg=page_for(375); go(pg,"#/categories"); t=pg.inner_text('body')
    ok("مستخدمة جديدة: بلا فئة قديمة",'أدوات المطبخ والرفايع' not in t)
    ok("مستخدمة جديدة: 9 فئات",pg.evaluate("JSON.parse(localStorage.getItem('%s')).categories.length"%KEY)==9)
    go(pg,"#/tips"); pg.evaluate("[...document.querySelectorAll('button,a')].find(e=>/شنطة شهر العسل/.test(e.textContent))?.click()"); pg.wait_for_timeout(300)
    ok("لا أرشيف ولا صفر وهمي لدى الجديدة","ميزانية قديمة محفوظة" not in pg.inner_text('body'))
    pg.close()
    # ---- responsive overflow sweep (legacy user)
    for w in (375,390,430,768,1366,1920):
        pg=page_for(w,900,seed=fixture)
        for h in ("#/dashboard","#/categories","#/category/cat-rafayea","#/budget","#/tips","#/settings"):
            go(pg,h); o=pg.evaluate("document.documentElement.scrollWidth-document.documentElement.clientWidth")
            ok(f"بلا overflow أفقي {w}px {h}",o<=1,str(o))
        if w in (768,1366): go(pg,"#/budget"); pg.screenshot(path=f'screenshots/05-budget-{w}.png',full_page=True)
        pg.close()
    b.close()
real=[e for e in errs if 'favicon' not in e and 'ERR_NAME_NOT_RESOLVED' not in e]   # بيئة الاختبار بلا إنترنت: الخطوط/الإعلانات الخارجية لا تُحمَّل (ليست أخطاء كود)
ok("لا أخطاء Console/JS",not real,str(real[:3]))
json.dump([{"name":n,"ok":c,"detail":d} for n,c,d in res],open('tests/ui-results.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print(sum(1 for r in res if r[1]),"/",len(res)); sys.exit(0 if all(r[1] for r in res) else 1)
