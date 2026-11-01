/* اختبارات الترحيل v8 — تُشغَّل بـ: node tests/migration.test.js
   تولّد حالات المستخدمين القديمة من كود النسخة الأصلية (orig) ثم تشغّل الكود الجديد عليها. لا تلمس أي بيانات حقيقية. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), ORIG = process.env.ORIG_DIR || path.resolve(ROOT, "../orig-backup");
const KEY = "brideListApp.v1";
const results = [];
function makeLS(init = {}, opts = {}) {
  const m = new Map(Object.entries(init));
  return {
    _m: m, getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (opts.failKey && k === opts.failKey) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } m.set(k, String(v)); },
    removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; }
  };
}
function boot(dir, ls) {
  const sb = { console: { log() {}, error() {}, warn() {} }, localStorage: ls, Date, JSON, Math, Number, String, Object, Array, Set, Map, Error, Promise };
  sb.window = sb; vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(dir, "assets/js/catalog.js"), "utf8"), sb);
  for (const f of ["purchases", "calc"]) { const fp = path.join(dir, `assets/js/${f}.js`); if (fs.existsSync(fp)) vm.runInContext(fs.readFileSync(fp, "utf8"), sb); }   /* النسخة الجديدة تحتاجهما؛ النسخة الأصلية لا تحتويهما */
  vm.runInContext(fs.readFileSync(path.join(dir, "assets/js/storage.js"), "utf8"), sb);
  return sb.BrideStore;
}
const clone = o => JSON.parse(JSON.stringify(o));
/* حالة مستخدمة قديمة (v7) بكود النسخة الأصلية تمامًا */
function oldState(mutator) {
  const ls = makeLS(); const st = boot(ORIG, ls); const s = clone(st.getState()); if (mutator) mutator(s); return s;
}
const RAF = "cat-rafayea", KT = "cat-v5-kitchen-tools";
const byId = (s, id) => s.items.find(i => i.id === id);
function runNew(stateObj, lsOpts) {
  const ls = makeLS(stateObj ? { [KEY]: JSON.stringify(stateObj) } : {}, lsOpts); const st = boot(ROOT, ls); return { st, ls, s: st.getState() };
}
function check(name, fn) {
  try { const detail = fn(); results.push({ name, ok: true, detail: detail || "" }); console.log("PASS", name, detail || ""); }
  catch (e) { results.push({ name, ok: false, detail: e.message }); console.log("FAIL", name, "-", e.message); }
}
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || "غير متساوٍ"}: ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };
const setBudgets = (s, a, b) => { s.categories.find(c => c.id === RAF).budget = a; s.categories.find(c => c.id === KT).budget = b; };
const countKitchen = s => s.items.filter(i => i.categoryId === KT).length;
const OLD_BASE = oldState();
const oldCounts = { total: OLD_BASE.items.length, raf: OLD_BASE.items.filter(i => i.categoryId === RAF).length, kt: countKitchen(OLD_BASE) };

check("0) أساس: النسخة الأصلية = 419 بندًا (51 رفايع + 28 مطبخ)", () => { eq([oldCounts.total, oldCounts.raf, oldCounts.kt], [419, 51, 28]); });

check("1) مستخدمة جديدة: فئة موحدة واحدة، 418 بندًا، بلا فئة مكررة", () => {
  const { s } = runNew(null);
  const names = s.categories.map(c => c.name);
  eq(names.filter(n => n === "الرفايع").length, 1); ok(!s.categories.some(c => c.id === KT || /أدوات المطبخ والرفايع/.test(c.name)), "ظهرت الفئة القديمة");
  eq(s.items.length, 418); eq(s.items.filter(i => i.categoryId === RAF).length, 79); ok(s.seeds.catalogV8 === true); ok(!s.items.some(i => i.id === "item-v7-niche-3"));
  return `${s.categories.length} فئات، ${s.items.length} بندًا`;
});

check("2) بيانات في الرفايع فقط (المستخدمة حذفت فئة المطبخ بنفسها)", () => {
  const o = oldState(s => { byId(s, "item-rafayea-3").purchased = 1; byId(s, "item-rafayea-3").unitPrice = 450; byId(s, "item-rafayea-3").notes = "من المعرض"; s.items = s.items.filter(i => i.categoryId !== KT); s.categories = s.categories.filter(c => c.id !== KT); s.categories.find(c => c.id === RAF).budget = 12000; });
  const { s } = runNew(o); const it = byId(s, "item-rafayea-3");
  eq([it.purchased, it.unitPrice, it.notes], [1, 450, "من المعرض"]); eq(s.categories.find(c => c.id === RAF).budget, 12000);
  eq(s.items.filter(i => i.categoryId === RAF).length, 51, "لا بنود مطبخ تُضاف لمن حذفتها"); eq(s.items.length, o.items.length - 1 + 0 + (o.items.some(i => i.id === "item-v7-niche-3") ? 0 : 1) - 0, "عدد البنود (ناقص بند التكرار فقط)".replace("(", ""));
  return "البنود 51 كما هي والميزانية 12000";
});

check("3) بيانات في الفئتين: كل البنود تنتقل للفئة الموحدة دون فقد", () => {
  const o = oldState(s => { byId(s, "item-rafayea-1").purchased = 1; byId(s, "item-v5-kitchen-tools-4").purchased = 1; });
  const { s } = runNew(o); eq(s.items.filter(i => i.categoryId === RAF).length, 79); eq(countKitchen(s), 0); ok(!s.categories.some(c => c.id === KT));
  eq(s.items.length, o.items.length - 1, "الفرق بند التكرار فقط");
  ["item-rafayea-1", "item-v5-kitchen-tools-4"].forEach(id => eq(byId(s, id).purchased, 1, id));
  const ids = new Set(s.items.map(i => i.id)); o.items.filter(i => i.id !== "item-v7-niche-3").forEach(i => ok(ids.has(i.id), "فُقد " + i.id));
  eq(byId(s, "item-v5-kitchen-tools-4").group, "اطقم حلل", "المجموعة محفوظة"); return "79 بندًا، لا فقد";
});

const budgetCases = [[15000, 10000, 25000, "ميزانيتان"], [15000, null, 15000, "الرفايع فقط"], [null, 10000, 10000, "المطبخ فقط"], [null, null, null, "فارغتان"], [0, 0, 0, "صفران"], [0, 10000, 10000, "صفر + قيمة"], [0, null, 0, "صفر + فارغة"], [null, 0, 0, "فارغة + صفر"], [100.25, 50.5, 150.75, "كسور"]];
budgetCases.forEach(([a, b, exp, label], i) => check(`4/5) ميزانية ${label}: ${a} + ${b} = ${exp}`, () => {
  const o = oldState(s => setBudgets(s, a, b)); const { s } = runNew(o);
  eq(s.categories.find(c => c.id === RAF).budget, exp); ok(s.categories.filter(c => c.id === RAF).length === 1);
}));

check("6) شراء من الفئتين: الأسعار والكميات والمشتريات محفوظة", () => {
  const o = oldState(s => { Object.assign(byId(s, "item-rafayea-6"), { purchased: 1, unitPrice: 800, status: "complete" }); Object.assign(byId(s, "item-v5-kitchen-tools-12"), { required: 6, purchased: 4, unitPrice: 95.5, status: "preparing" }); });
  const { s } = runNew(o); const a = byId(s, "item-rafayea-6"), b = byId(s, "item-v5-kitchen-tools-12");
  eq([a.purchased, a.required, a.unitPrice, a.status], [1, 1, 800, "complete"]); eq([b.purchased, b.required, b.unitPrice, b.status], [4, 6, 95.5, "preparing"]); eq(b.categoryId, RAF);
});

check("7) كميات معدلة يدويًا لا تُستبدل بكميات الكتالوج", () => {
  const o = oldState(s => { byId(s, "item-rafayea-1").required = 7; byId(s, "item-v5-kitchen-tools-16").required = 3; byId(s, "item-v5-niche-6").required = 5; });
  const { s } = runNew(o); eq([byId(s, "item-rafayea-1").required, byId(s, "item-v5-kitchen-tools-16").required, byId(s, "item-v5-niche-6").required], [7, 3, 5]);
});

check("8) بنود مضافة يدويًا تبقى (في الفئتين) وتنتقل مع فئة المطبخ", () => {
  const o = oldState(s => { s.items.push({ id: "item-mine-1", categoryId: KT, name: "صينية خاصة", unit: "قطعة", required: 2, purchased: 1, unitPrice: 60, status: "preparing", notes: "هدية", group: "", sortOrder: 9999, createdAt: "x", updatedAt: "x" }, { id: "item-mine-2", categoryId: RAF, name: "ملعقة خاصة", unit: "قطعة", required: 1, purchased: 0, unitPrice: null, status: "missing", notes: "", group: "", sortOrder: 10000, createdAt: "x", updatedAt: "x" }); });
  const { s } = runNew(o); const a = byId(s, "item-mine-1"), b = byId(s, "item-mine-2");
  eq([a.categoryId, a.name, a.required, a.purchased, a.unitPrice, a.notes], [RAF, "صينية خاصة", 2, 1, 60, "هدية"]); eq(b.categoryId, RAF);
});

check("9) بنود حذفتها المستخدمة يدويًا لا تعود (بعد الترحيل ولا بعد إعادة الفتح)", () => {
  const gone = ["item-rafayea-5", "item-v5-kitchen-tools-10", "item-v5-niche-2", "item-v5-pantry-1"];
  const o = oldState(s => { s.items = s.items.filter(i => !gone.includes(i.id)); });
  const r1 = runNew(o); gone.forEach(id => ok(!byId(r1.s, id), "عاد " + id));
  const r2 = runNew(JSON.parse(r1.ls.getItem(KEY))); gone.forEach(id => ok(!byId(r2.s, id), "عاد بعد إعادة الفتح " + id));
});

check("10) ملاحظات وأسعار: لا تضيع أي معلومة (مقارنة حقل بحقل)", () => {
  const o = oldState(s => { s.items.forEach((it, i) => { if (i % 7 === 0) { it.notes = "ملاحظة " + i; it.unitPrice = 10 + i; } }); });
  const { s } = runNew(o); const before = new Map(o.items.map(i => [i.id, i]));
  s.items.forEach(it => { const b = before.get(it.id); if (!b) return; ["name", "unit", "required", "purchased", "unitPrice", "status", "notes", "group", "sortOrder", "createdAt"].forEach(f => eq(it[f], b[f], `${it.id}.${f}`)); });
  eq(s.items.length, o.items.length - 1);
});

check("11أ) تكرار: بند الكتالوج المكرر وحده يُدمج (كلاهما لم يُلمس) + مسار التتبع", () => {
  const o = oldState(); ok(byId(o, "item-v7-niche-3")); const { s } = runNew(o);
  ok(!byId(s, "item-v7-niche-3")); ok(byId(s, "item-v5-niche-7")); eq(s.mergedItems["item-v7-niche-3"], "item-v5-niche-7"); eq(s.migrationLog.v8.duplicates[0].action, "merged-both-untouched");
});
check("11ب) تكرار: بيانات على البند المكرر فقط → تُنسخ للأساسي (لا جمع)", () => {
  const o = oldState(s => Object.assign(byId(s, "item-v7-niche-3"), { purchased: 1, unitPrice: 300, status: "complete", notes: "اشتريته" }));
  const { s } = runNew(o); const k = byId(s, "item-v5-niche-7"); eq([k.purchased, k.required, k.unitPrice, k.status, k.notes], [1, 1, 300, "complete", "اشتريته"]); ok(!byId(s, "item-v7-niche-3"));
});
check("11ج) تكرار: بيانات على الأساسي فقط → تبقى كما هي", () => {
  const o = oldState(s => Object.assign(byId(s, "item-v5-niche-7"), { purchased: 1, unitPrice: 120, status: "complete" }));
  const { s } = runNew(o); const k = byId(s, "item-v5-niche-7"); eq([k.purchased, k.unitPrice], [1, 120]); ok(!byId(s, "item-v7-niche-3"));
});
check("11د) تكرار متعارض (بيانات على الاثنين): يبقى البندان ويُسجَّل التعارض", () => {
  const o = oldState(s => { Object.assign(byId(s, "item-v5-niche-7"), { purchased: 1, unitPrice: 120, status: "complete" }); Object.assign(byId(s, "item-v7-niche-3"), { purchased: 1, unitPrice: 200, status: "complete", notes: "تانية" }); });
  const { s } = runNew(o); ok(byId(s, "item-v5-niche-7") && byId(s, "item-v7-niche-3")); eq(byId(s, "item-v7-niche-3").unitPrice, 200); eq(byId(s, "item-v5-niche-7").unitPrice, 120);
  eq(s.migrationLog.v8.duplicates[0].action, "conflict-kept-both"); ok(s.migrationLog.v8.duplicates[0].values);
});
check("11هـ) تكرار: بند معدّل الاسم/منقول لفئة أخرى لا يُدمج", () => {
  const o = oldState(s => { byId(s, "item-v7-niche-3").name = "شربات الفرح"; });
  const { s } = runNew(o); ok(byId(s, "item-v7-niche-3")); eq(s.migrationLog.v8.duplicates[0].action, "kept-both-edited-or-moved");
  const o2 = oldState(s => { byId(s, "item-v7-niche-3").categoryId = "cat-v5-pantry"; }); const r2 = runNew(o2); ok(byId(r2.s, "item-v7-niche-3"));
});
check("11و) تكرار: المستخدمة حذفت الأساسي → لا نلمس بند الآخر؛ حذفت المكرر → لا شيء", () => {
  const o = oldState(s => { s.items = s.items.filter(i => i.id !== "item-v5-niche-7"); }); const r = runNew(o); ok(byId(r.s, "item-v7-niche-3")); ok(!byId(r.s, "item-v5-niche-7"), "لا يعود الأساسي المحذوف");
  const o2 = oldState(s => { s.items = s.items.filter(i => i.id !== "item-v7-niche-3"); }); const r2 = runNew(o2); ok(byId(r2.s, "item-v5-niche-7")); ok(!byId(r2.s, "item-v7-niche-3"));
});
check("11ز) الحالات غير المؤكدة (مفارش/مفرش نيش، فوط/فوطة مايكروفايبر) تبقى منفصلة", () => {
  const { s } = runNew(oldState()); ["item-v5-niche-10", "item-v5-furnishings-24", "item-v5-cleaning-24", "item-v5-personal-23", "item-v5-niche-7"].forEach(id => ok(byId(s, id), "فُقد " + id));
});

check("12) فتح الموقع 4 مرات: لا يتكرر الترحيل ولا تتضاعف الميزانية", () => {
  const o = oldState(s => setBudgets(s, 15000, 10000)); let ls = makeLS({ [KEY]: JSON.stringify(o) }), st = boot(ROOT, ls); const first = ls.getItem(KEY);
  eq(st.getState().categories.find(c => c.id === RAF).budget, 25000);
  for (let i = 0; i < 3; i++) { st = boot(ROOT, ls); eq(st.getState().categories.find(c => c.id === RAF).budget, 25000, "فتحة " + (i + 2)); }
  eq(ls.getItem(KEY), first, "البيانات المخزنة لم تتغير بعد أول ترحيل"); ok(ls.getItem(KEY + ".pre-v8-backup") !== null);
});

check("12ب) النسخة الاحتياطية قبل v8 = البيانات الأصلية حرفيًا", () => {
  const o = oldState(s => setBudgets(s, 15000, 10000)); const raw = JSON.stringify(o); const ls = makeLS({ [KEY]: raw }); boot(ROOT, ls); eq(ls.getItem(KEY + ".pre-v8-backup"), raw);
});

check("13) استيراد نسخة احتياطية قديمة: دمج مرة واحدة دون فقد، ولا تعود المشكلة", () => {
  const o = oldState(s => { setBudgets(s, 15000, 10000); byId(s, "item-v5-kitchen-tools-4").purchased = 1; s.items = s.items.filter(i => i.id !== "item-rafayea-5"); });
  const oldExport = JSON.stringify({ ...o, exportedAt: "2026-10-01", app: "Bride List" });
  const { st, ls } = runNew(null); st.importData(JSON.parse(oldExport)); let s = st.getState();
  eq(s.categories.find(c => c.id === RAF).budget, 25000); ok(!s.categories.some(c => c.id === KT)); eq(byId(s, "item-v5-kitchen-tools-4").purchased, 1); ok(!byId(s, "item-rafayea-5"), "المحذوف يدويًا لا يعود");
  const exp1 = st.exportData(); st.importData(JSON.parse(exp1)); eq(st.getState().categories.find(c => c.id === RAF).budget, 25000, "استيراد ملف جديد لا يعيد الجمع");
  const st2 = boot(ROOT, ls); eq(st2.getState().categories.find(c => c.id === RAF).budget, 25000, "إعادة الفتح بعد الاستيراد");
  const stB = runNew(null).st; stB.importData(JSON.parse(oldExport)); stB.importData(JSON.parse(oldExport)); eq(stB.getState().categories.find(c => c.id === RAF).budget, 25000, "استيراد نفس القديم مرتين = لا تضاعف");
});

check("14أ) بيانات تالفة: عناصر null وميزانيات غير صالحة لا تُسقط التطبيق ولا تُخمَّن", () => {
  const o = oldState(s => { s.categories.push(null, 7); s.items.push(null, "x"); s.categories.find(c => c.id === RAF).budget = "abc"; s.categories.find(c => c.id === KT).budget = 8000; byId(s, "item-rafayea-2").purchased = 1; });
  const { s } = runNew(o); eq(s.categories.find(c => c.id === RAF).budget, 8000, "القيمة الصالحة تبقى والتالفة لا تُخمَّن");
  eq(s.migrationLog.v8.invalidBudgets.length, 1); eq(byId(s, "item-rafayea-2").purchased, 1); ok(s.items.length >= 417);
});
check("14ب) ميزانية سالبة/نصية/غير رقمية في الفئتين → غير محددة + تسجيل", () => {
  const o = oldState(s => setBudgets(s, -5, "xyz")); const { s } = runNew(o); eq(s.categories.find(c => c.id === RAF).budget, null); eq(s.migrationLog.v8.invalidBudgets.length, 2);
});
check("14ج) JSON تالف كليًا: لا انهيار، والنص الأصلي يُحفظ في نسخة .corrupt", () => {
  const ls = makeLS({ [KEY]: "{not json" }); const st = boot(ROOT, ls); ok(st.getState().items.length === 418); ok([...ls._m.keys()].some(k => k.includes(".corrupt-")));
});
check("14د) الفئة الأساسية محذوفة لدى المستخدمة: تُنشأ الفئة الموحدة وتنتقل البنود والميزانية", () => {
  const o = oldState(s => { s.items = s.items.filter(i => i.categoryId !== RAF); s.categories = s.categories.filter(c => c.id !== RAF); s.categories.find(c => c.id === KT).budget = 9000; });
  const { s } = runNew(o); const c = s.categories.find(x => x.id === RAF); ok(c && c.name === "الرفايع"); eq(c.budget, 9000); eq(s.items.filter(i => i.categoryId === RAF).length, 28);
});
check("14هـ) فشل حفظ النسخة الاحتياطية (امتلاء المساحة): تُؤجَّل الترحيلة وتبقى البيانات سليمة", () => {
  const o = oldState(s => setBudgets(s, 15000, 10000)); const raw = JSON.stringify(o); const { ls, s, st } = runNew(o, { failKey: KEY + ".pre-v8-backup" });
  eq(ls.getItem(KEY), raw, "المخزَّن لم يُمس"); ok(s.categories.some(c => c.id === KT), "لم تُدمج"); ok(st.consumeMigrationNotice().failed === true);
});
check("14و) فشل كتابة الحالة الجديدة: المخزَّن الأصلي سليم (لا حالة نصف محدّثة) وتُعاد المحاولة", () => {
  const o = oldState(s => setBudgets(s, 15000, 10000)); const raw = JSON.stringify(o); const ls = makeLS({ [KEY]: raw }, { failKey: KEY });
  boot(ROOT, ls); eq(ls.getItem(KEY), raw); const st2 = boot(ROOT, makeLS({ [KEY]: ls.getItem(KEY) })); eq(st2.getState().categories.find(c => c.id === RAF).budget, 25000);
});
check("14ز) رابط/معرّف الفئة القديمة يُحوَّل للموحدة", () => { const { st } = runNew(null); eq(st.resolveCategoryId(KT), RAF); eq(st.resolveCategoryId("x"), "x"); });
check("15) أرشيف شهر العسل (بنود + ميزانية) محفوظ عبر الترحيل", () => {
  const o = oldState(s => { s.legacyHoneymoon = { archivedAt: "2026-10-30", categoryName: "شنطة شهر العسل", budget: 6000, items: [{ id: "item-v5-honeymoon-13", name: "مايوه", unit: "قطعة", required: 2, purchased: 1, unitPrice: 300, status: "preparing", notes: "", group: "" }] }; });
  const { s } = runNew(o); eq(s.legacyHoneymoon.budget, 6000); eq(s.legacyHoneymoon.items.length, 1); eq(s.legacyHoneymoon.items[0].unitPrice, 300);
  const o2 = oldState(s => { s.legacyHoneymoon = { archivedAt: "x", categoryName: "شنطة شهر العسل", budget: 0, items: [] }; }); eq(runNew(o2).s.legacyHoneymoon.budget, 0, "الصفر يبقى صفرًا");
});
check("16) مستخدمة قبل v5 (ملف قديم جدًا): تحصل على فئة موحدة واحدة ولا تُنشأ فئة المطبخ", () => {
  const ls = makeLS({ [KEY]: JSON.stringify({ version: 1, schema: 3, profile: { name: "", weddingDate: "" }, totalBudget: 5000, categories: [{ id: "cat-rafayea", name: "الرفايع", sortOrder: 1, icon: "pot", description: "", budget: 4000 }, { id: "cat-kitchen", name: "المطبخ", sortOrder: 2, icon: "kitchen", description: "", budget: null }], items: [], nextId: 1, seeds: { rafayea: true } }) });
  const s = boot(ROOT, ls).getState(); ok(!s.categories.some(c => c.id === KT)); eq(s.categories.filter(c => c.name === "الرفايع").length, 1); eq(s.categories.find(c => c.id === RAF).budget, 4000); eq(s.items.filter(i => i.categoryId === RAF).length, 28, "بنود المطبخ القديمة أُضيفت للموحدة");
});

const failed = results.filter(r => !r.ok); console.log(`\n${results.length - failed.length}/${results.length} passed`);
fs.writeFileSync(path.join(__dirname, "migration-results.json"), JSON.stringify(results, null, 2));
process.exit(failed.length ? 1 : 0);
