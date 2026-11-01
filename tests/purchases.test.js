/* اختبارات سجل المشتريات + ترحيل v9 — تُشغَّل بـ: node tests/purchases.test.js
   لا تحتاج نسخة أصلية: الحالات القديمة تُبنى من الحالة الحالية بحذف حقول السجل (schema 6) أو من tests/fixtures/old-user-v7.json. */
const fs = require("fs"), vm = require("vm"), path = require("path");
const ROOT = path.resolve(__dirname, ".."), KEY = "brideListApp.v1";
let failed = 0, passed = 0;
function makeLS(init = {}, opts = {}) {
  const m = new Map(Object.entries(init));
  return { _m: m, getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { if (opts.fail && opts.fail(k, v, m)) { const e = new Error("quota"); e.name = "QuotaExceededError"; throw e; } m.set(k, String(v)); },
    removeItem: k => m.delete(k), key: i => [...m.keys()][i], get length() { return m.size; } };
}
function boot(ls) {
  const sb = { console: { log() {}, error() {}, warn() {} }, localStorage: ls, Date, JSON, Math, Number, String, Object, Array, Set, Map, Error, Promise };
  sb.window = sb; vm.createContext(sb);
  for (const f of ["catalog", "purchases", "calc", "storage"]) vm.runInContext(fs.readFileSync(path.join(ROOT, `assets/js/${f}.js`), "utf8"), sb);
  return { st: sb.BrideStore, calc: sb.BrideCalc, P: sb.BridePurchases };
}
const clone = o => JSON.parse(JSON.stringify(o));
const check = (name, fn) => { try { fn(); passed++; console.log("PASS", name); } catch (e) { failed++; console.log("FAIL", name, "-", e.message); } };
const eq = (a, b, m) => { if (JSON.stringify(a) !== JSON.stringify(b)) throw new Error(`${m || ""} ${JSON.stringify(a)} != ${JSON.stringify(b)}`); };
const ok = (c, m) => { if (!c) throw new Error(m || "assert"); };
const throws = (fn, re, m) => { try { fn(); } catch (e) { if (!re || re.test(e.message)) return; throw new Error(`${m || ""} رسالة غير متوقعة: ${e.message}`); } throw new Error(`${m || ""} لم يُرمَ خطأ`); };
const fresh = () => { const b = boot(makeLS()); return b; };
/* مستخدمة قديمة (schema 6): نزيل حقول السجل ونرجّع العلامة */
function oldStateFrom(state, mut) {
  const s = clone(state); s.schema = 6; delete s.seeds.purchaseRecords; delete s.migrationLog;
  s.items.forEach(it => { delete it.purchases; delete it.legacy; });
  if (mut) mut(s); return s;
}
const baseOld = oldStateFrom(fresh().st.getState());
const run = (stateObj, lsOpts) => { const ls = makeLS(stateObj ? { [KEY]: JSON.stringify(stateObj) } : {}, lsOpts); const b = boot(ls); return { ...b, ls, s: b.st.getState() }; };
const item = (s, id) => s.items.find(i => i.id === id);
const ID = "item-v5-furnishings-1";

/* ===== عمليات الشراء ===== */
const setup = () => { const b = fresh(); const s = b.st.getState(); const it = s.items.find(i => i.categoryId === "cat-v5-furnishings"); b.st.updateItem(it.id, { ...it, required: 6 }); return { ...b, id: it.id }; };
const add = (b, qty, total, extra = {}) => b.st.addPurchase(b.id, { qty, totalPrice: total, ...extra });
const cur = b => b.st.getState().items.find(i => i.id === b.id);

check("1-2) عمليات متعددة لنفس البند + الأمثلة من المهمة (٦ أطقم، ٦٠٥٠ ج.م، متوسط ١٠٠٨٫٣٣)", () => {
  const b = setup();
  add(b, 2, 1800, { details: { color: "أوف وايت" } }); add(b, 1, 950, { details: { color: "بيج" } }); add(b, 1, 1100, { details: { color: "رمادي" } }); add(b, 2, 2200, { details: { color: "كشمير" } });
  const sm = b.calc.purchaseSummary(cur(b));
  eq([sm.required, sm.purchasedQty, sm.remainingQty, sm.recordCount, sm.spent, sm.avgUnit], [6, 6, 0, 4, 6050, 1008.33]);
  eq(b.calc.itemStatus(cur(b)), "complete");
});
check("3-5) اختلاف الكمية والسعر واللون محفوظ لكل عملية", () => {
  const b = setup(); add(b, 2, 1800, { details: { color: "أ" } }); add(b, 1, 950, { details: { color: "ب" } });
  const r = cur(b).purchases; eq(r.map(x => [x.qty, x.totalPrice, x.details.color]), [[2, 1800, "أ"], [1, 950, "ب"]]);
  ok(r[0].id !== r[1].id, "معرّف فريد");
});
check("6) تفاصيل مخصصة بلا حد ضيق (٥٠ تفصيلة) وتُحفظ وتُعرض", () => {
  const b = setup(); const custom = Array.from({ length: 50 }, (_, i) => ({ label: "حقل" + i, value: "قيمة" + i }));
  add(b, 1, 100, { custom }); eq(cur(b).purchases[0].custom.length, 50); eq(cur(b).purchases[0].custom[49].value, "قيمة49");
  throws(() => add(b, 1, 100, { custom: [{ label: "", value: "x" }] }), /اسم التفصيلة/);
});
check("7-9) تعديل عملية وحذف عملية: الباقي لا يتغير", () => {
  const b = setup(); const a = add(b, 2, 1800), c = add(b, 1, 950), d = add(b, 1, 1100);
  const beforeC = clone(cur(b).purchases[1]);
  b.st.updatePurchase(b.id, a.id, { qty: 3, totalPrice: 2700, notes: "معدلة" });
  eq(clone(cur(b).purchases[1]), beforeC, "العملية الثانية لم تتغير");
  b.st.deletePurchase(b.id, d.id);
  eq(cur(b).purchases.map(x => x.id), [a.id, c.id]); eq(cur(b).purchased, 4);
  eq(b.calc.purchaseSummary(cur(b)).spent, 3650);
});
check("10-13) إجمالي الكمية والمتبقي والمصروف والمتوسط", () => {
  const b = setup(); add(b, 2, 1800); add(b, 3, 900);
  const sm = b.calc.purchaseSummary(cur(b)); eq([sm.purchasedQty, sm.remainingQty, sm.spent, sm.avgUnit], [5, 1, 2700, 540]);
});
check("14-15) بلا سعر ≠ سعر صفر؛ المتوسط «غير متاح» لو لا بيانات", () => {
  const b = setup(); add(b, 2, null);
  let sm = b.calc.purchaseSummary(cur(b)); eq([sm.hasSpent, sm.unpricedQty, sm.avgUnit], [false, 2, null]);
  add(b, 1, 0); sm = b.calc.purchaseSummary(cur(b)); eq([sm.hasSpent, sm.spent, sm.unpricedQty, sm.avgUnit], [true, 0, 2, 0]);
  eq(cur(b).purchases[0].totalPrice, null); eq(cur(b).purchases[1].totalPrice, 0);
  const c = b.calc.costs([cur(b)]).purchasedCost; eq([c.total, c.incomplete], [0, true], "الكمية بلا سعر تجعل الناتج غير مكتمل");
});
check("16-17) منع السالب والكميات غير الصحيحة", () => {
  const b = setup();
  [-1, 0, 1.5, "abc", NaN].forEach(q => throws(() => add(b, q, 10), /الكمية/, "qty " + q));
  throws(() => add(b, 1, -5), /السعر/); throws(() => add(b, 1, "x"), /السعر/);
  throws(() => add(b, 1, 5, { date: "2026-13-45" }), /تاريخ/); eq(cur(b).purchases.length, 0);
});
check("18) منع تجاوز المطلوب مع شرح السبب، ولا يحفظ شيئًا", () => {
  const b = setup(); add(b, 5, 500);
  throws(() => add(b, 2, 100), /المتبقي من هذا البند 1/); eq(cur(b).purchased, 5); eq(cur(b).purchases.length, 1);
  add(b, 1, 100); throws(() => add(b, 1, 100), /اتسجلت كلها/);
});
check("19) خفض المطلوب عن المشترى: لا حذف ولا تقليل، وتظهر زيادة؛ التعديل بلا رفع الكمية مسموح", () => {
  const b = setup(); const r = add(b, 4, 400); add(b, 2, 300);
  const it = cur(b); b.st.updateItem(b.id, { ...it, required: 3 });
  eq(cur(b).purchases.map(x => x.qty), [4, 2]); const sm = b.calc.purchaseSummary(cur(b)); eq([sm.excessQty, sm.remainingQty, sm.purchasedQty], [3, 0, 6]);
  eq(b.calc.itemStatus(cur(b)), "complete"); eq(b.calc.summarize([cur(b)]).percent, 100);
  b.st.updatePurchase(b.id, r.id, { notes: "ملاحظة فقط" }); throws(() => b.st.updatePurchase(b.id, r.id, { qty: 5 }), /يتجاوز المطلوب/);
  b.st.updatePurchase(b.id, r.id, { qty: 2 }); eq(cur(b).purchased, 4);
});
check("20) إعادة فتح الموقع: البيانات مستمرة ولا تتكرر (٤ مرات)", () => {
  const ls = makeLS(); let b = boot(ls); const s0 = b.st.getState(); const it = s0.items[3]; b.st.updateItem(it.id, { ...it, required: 4 });
  b.st.addPurchase(it.id, { qty: 2, totalPrice: 300, details: { color: "x" }, custom: [{ label: "ط", value: "ي" }] });
  const snap = ls.getItem(KEY);
  for (let i = 0; i < 4; i++) { b = boot(ls); const x = b.st.getState().items.find(q => q.id === it.id); eq([x.purchased, x.purchases.length, x.purchases[0].details.color], [2, 1, "x"]); }
  eq(ls.getItem(KEY), snap, "التخزين لم يتغير بإعادة الفتح");
});
check("الحسابات: لا ازدواج — تكلفة القائمة = المصروف + تقدير الباقي", () => {
  const b = setup(); const it0 = cur(b); b.st.updateItem(b.id, { ...it0, unitPrice: 1000 }); add(b, 2, 1800);
  const c = b.calc.costs([cur(b)]); eq([c.purchasedCost.total, c.remainingCost.total, c.requiredCost.total], [1800, 4000, 5800]);
  const ov = b.calc.overview(10000, [], [cur(b)]); eq([ov.spent, ov.left], [1800, 4200]);
});
check("تقدير الباقي بمتوسط ما دُفع فعلًا لو لا سعر تقديري", () => {
  const b = setup(); add(b, 2, 1800); const c = b.calc.costs([cur(b)]); eq([c.remainingCost.total, c.requiredCost.total], [3600, 5400]);
});
check("أنواع التفاصيل: تعريف النوع من الفئة/المجموعة وغموض الاسم → عام", () => {
  const { P } = fresh(); const cat = id => ({ id, name: "x" });
  eq(P.resolveType({ group: "الفوط ومفروشات الحمام" }, cat("cat-v5-furnishings")), "towels");
  eq(P.resolveType({ group: "مفروشات السرير" }, cat("cat-v5-furnishings")), "bedding");
  eq(P.resolveType({}, cat("cat-v5-appliances")), "appliance"); eq(P.resolveType({}, cat("cat-rafayea")), "cookware");
  eq(P.resolveType({}, cat("cat-v5-clothes")), "clothing"); eq(P.resolveType({}, cat("cat-v5-personal")), "beauty"); eq(P.resolveType({}, cat("cat-v5-pantry")), "general");
  eq(P.resolveType({ name: "شيء غريب" }, { id: "cat-mine", name: "فئتي" }), "general");
  eq(P.resolveType({ name: "ثلاجة صغيرة" }, { id: "cat-mine", name: "فئتي" }), "appliance");
  eq(P.resolveType({ name: "غسالة أطباق وحلل" }, { id: "cat-mine", name: "فئتي" }), "general", "تطابق نوعين = غموض");
  ok(P.fieldsFor("appliance").some(f => f.key === "warrantyMonths") && P.fieldsFor("beauty").some(f => f.key === "expiry"));
});
check("الصور: فشل حفظ الصورة لا يفقد العملية؛ تصدير/استيراد يحمل الصورة", () => {
  const png = "data:image/png;base64," + "A".repeat(200);
  const ls = makeLS({}, { fail: k => k.includes(".pimg.") && ls.__full }); const b = boot(ls); const it = b.st.getState().items[0];
  const r = b.st.addPurchase(it.id, { qty: 1, totalPrice: 10 });
  ls.__full = true; throws(() => b.st.setPurchaseImage(it.id, r.id, png), /ممتلئة/); eq(b.st.getState().items[0].purchases.length, 1); eq(b.st.getState().items[0].purchases[0].hasImage, false);
  ls.__full = false; b.st.setPurchaseImage(it.id, r.id, png); eq(b.st.getPurchaseImage(r.id), png);
  throws(() => b.st.setPurchaseImage(it.id, r.id, "data:text/html;base64,AAAA"), /غير صالحة/);
  const exp = JSON.parse(b.st.exportData()); eq(exp.purchaseImages[r.id], png);
  const b2 = boot(makeLS()); b2.st.importData(exp); eq(b2.st.getPurchaseImage(r.id), png); eq(b2.st.getState().items[0].purchases[0].hasImage, true);
  b2.st.clearPurchaseImage(it.id, r.id); eq(b2.st.getPurchaseImage(r.id), null);
  b.st.deletePurchase(it.id, r.id); eq(b.st.getPurchaseImage(r.id), null, "الصورة تُحذف مع العملية");
});
check("تصدير/استيراد ملف جديد: عمليات وبيانات سابقة وزيادة عن المطلوب كما هي", () => {
  const b = setup(); add(b, 4, 400); add(b, 2, 300); const it = cur(b); b.st.updateItem(b.id, { ...it, required: 3 });
  const exp = JSON.parse(b.st.exportData()); const b2 = boot(makeLS()); b2.st.importData(exp);
  eq(clone(b2.st.getState().items.find(i => i.id === b.id).purchases), clone(cur(b).purchases));
  eq(b2.st.getState().items.find(i => i.id === b.id).purchased, 6);
});

/* ===== ترحيل v9 ===== */
const sum = s => s.items.reduce((a, i) => a + (i.purchased || 0), 0);
const spend = (b, s) => b.calc.costs(s.items).purchasedCost.total;
check("M1) مستخدم جديد: علامة الترحيل مفعّلة وكل بند بسجل فارغ", () => {
  const { s } = run(null); ok(s.seeds.purchaseRecords); ok(s.items.every(i => Array.isArray(i.purchases) && i.purchases.length === 0 && i.legacy === null)); eq(s.schema, 7);
});
check("M2) قديم لم يشترِ شيئًا: لا بيانات سابقة", () => { const { s } = run(baseOld); ok(s.items.every(i => i.legacy === null && i.purchased === 0)); ok(s.seeds.purchaseRecords); });
const withBuys = oldStateFrom(fresh().st.getState(), s => {
  const a = s.items[0], c = s.items[1], d = s.items[2];
  Object.assign(a, { required: 6, purchased: 3, unitPrice: 500, status: "preparing", notes: "ملاحظة قديمة" });
  Object.assign(c, { required: 2, purchased: 2, unitPrice: null, status: "complete" }); Object.assign(d, { required: 3, purchased: 1, unitPrice: 0, status: "preparing" });
  s.totalBudget = 90000; s.categories[0].budget = 12000; s.categories[1].budget = 0;
  s.items.push({ id: "item-mine-1", categoryId: s.categories[0].id, name: "بند خاص", unit: "قطعة", required: 4, purchased: 1, unitPrice: 70, status: "preparing", notes: "هدية", group: "", sortOrder: 9999, createdAt: "x", updatedAt: "x" });
});
check("M3-6) قديم بكميات وأسعار وملاحظات وميزانيات وبنود مخصصة: لا تكرار ولا مضاعفة ولا فقد", () => {
  const b = run(withBuys); const s = b.s, bef = withBuys;
  eq(sum(s), 7, "مجموع الكميات"); const before = boot(makeLS()); // حساب القديم: الكمية × سعر الوحدة
  eq(spend(b, s), 3 * 500 + 0 + 1 * 0 + 70, "المصروف = الحساب القديم تمامًا");
  const a = item(s, bef.items[0].id); eq([a.purchased, a.legacy, a.purchases.length, a.notes, a.unitPrice], [3, { qty: 3, unitPrice: 500 }, 0, "ملاحظة قديمة", 500]);
  eq(item(s, bef.items[1].id).legacy, { qty: 2, unitPrice: null }, "بلا سعر يبقى غير مسجل (لا يُخترع)");
  eq(item(s, bef.items[2].id).legacy, { qty: 1, unitPrice: 0 }, "الصفر يبقى صفرًا");
  eq([s.totalBudget, s.categories[0].budget, s.categories[1].budget], [90000, 12000, 0]); eq(item(s, "item-mine-1").name, "بند خاص");
  bef.items.forEach(o => { const n = item(s, o.id); ["name", "unit", "required", "purchased", "unitPrice", "notes", "group", "categoryId"].forEach(k => eq(n[k], o[k], o.id + "." + k)); });
  ok(item(s, bef.items[0].id).purchases.every(() => false), "لا عمليات مخترعة"); eq(s.migrationLog.v9.verified, { qty: 7, spent: 1570, unpricedQty: 2 });
  eq(b.calc.purchaseSummary(a).recordCount, 0); ok(b.calc.purchaseSummary(a).hasLegacy);
});
check("M7) إضافة عملية بعد الترحيل لا تضاعف الكمية القديمة", () => {
  const b = run(withBuys); const id = withBuys.items[0].id; b.st.addPurchase(id, { qty: 2, totalPrice: 1100 });
  const sm = b.calc.purchaseSummary(item(b.st.getState(), id)); eq([sm.purchasedQty, sm.spent, sm.recordCount, sm.legacyQty], [5, 2600, 1, 3]);
  throws(() => b.st.addPurchase(id, { qty: 2, totalPrice: 1 }), /المتبقي من هذا البند 1/);
});
check("M8) نسخة احتياطية قبل الترحيل = الأصل حرفيًا، ولا تتغير بعد إعادة الفتح", () => {
  const raw = JSON.stringify(withBuys); const ls = makeLS({ [KEY]: raw }); boot(ls); eq(ls.getItem(KEY + ".pre-v9-backup"), raw);
  const after = ls.getItem(KEY); boot(ls); boot(ls); boot(ls); eq(ls.getItem(KEY + ".pre-v9-backup"), raw); eq(ls.getItem(KEY), after, "لا ترحيل ثانٍ");
});
check("M9) بنود حذفها المستخدم لا تعود؛ وأسماء عدّلها وفئات أنشأها تبقى", () => {
  const gone = baseOld.items[5].id; const o = clone(withBuys); o.items = o.items.filter(i => i.id !== gone); o.items[1].name = "اسم معدل"; o.categories.push({ id: "cat-user", name: "فئتي", sortOrder: 99, icon: "box", description: "", budget: 5 });
  const { s } = run(o); ok(!item(s, gone)); eq(item(s, o.items[1].id).name, "اسم معدل"); ok(s.categories.some(c => c.id === "cat-user" && c.budget === 5));
});
check("M10) استيراد نسخة احتياطية قديمة بعد التحديث (مرة واحدة، دون مضاعفة)", () => {
  const b = fresh(); b.st.importData(clone(withBuys)); const s = b.st.getState(); eq(sum(s), 7); eq(spend(b, s), 1570); ok(s.seeds.purchaseRecords);
  const exp = JSON.parse(b.st.exportData()); b.st.importData(exp); eq(sum(b.st.getState()), 7, "استيراد ملف جديد لا يرحّل ثانية"); eq(spend(b, b.st.getState()), 1570);
  throws(() => fresh().st.importData(oldStateFrom(withBuys, s => { s.items[0].purchased = 99; })), /كميات البند/, "ملف قديم غير صحيح يُرفض");
});
check("M11) فشل حفظ النسخة الاحتياطية: يُؤجَّل الترحيل وتبقى البيانات كما هي", () => {
  const raw = JSON.stringify(withBuys); const ls = makeLS({ [KEY]: raw }, { fail: k => k.endsWith("pre-v9-backup") }); const b = boot(ls);
  eq(ls.getItem(KEY), raw); ok(b.st.consumeMigrationNotice().failed); ok(!b.st.getState().seeds.purchaseRecords);
});
check("M12) فشل كتابة الحالة الجديدة: المخزَّن الأصلي سليم وتُعاد المحاولة لاحقًا", () => {
  const raw = JSON.stringify(withBuys); let block = true; const ls = makeLS({ [KEY]: raw }, { fail: k => k === KEY && block }); let b = boot(ls);
  eq(ls.getItem(KEY), raw); ok(b.st.consumeMigrationNotice().saveFailed); block = false; b = boot(ls);
  ok(JSON.parse(ls.getItem(KEY)).seeds.purchaseRecords); eq(sum(b.st.getState()), 7); eq(ls.getItem(KEY + ".pre-v9-backup"), raw);
});
check("M13) بيانات تالفة (عناصر null/أسعار سالبة) لا تُسقط الترحيل", () => {
  const o = clone(withBuys); o.items.push(null); o.items.push({ id: "bad", categoryId: o.categories[0].id, name: "x", required: 2, purchased: 1, unitPrice: -5 });
  const { s } = run(o); eq(item(s, "bad").legacy, { qty: 1, unitPrice: null }); ok(s.seeds.purchaseRecords);
});
check("M14) ترحيل مؤجَّل ثم تسجيل عملية: لا تضيع الكمية القديمة", () => {
  const raw = JSON.stringify(withBuys); let block = true; const ls = makeLS({ [KEY]: raw }, { fail: k => k.endsWith("pre-v9-backup") && block }); const b = boot(ls);
  ok(!b.st.getState().seeds.purchaseRecords); block = false; const id = withBuys.items[0].id;
  b.st.addPurchase(id, { qty: 1, totalPrice: 400 }); const x = item(b.st.getState(), id); eq([x.purchased, x.legacy.qty, x.purchases.length], [4, 3, 1]);
  const b2 = boot(ls); eq(item(b2.st.getState(), id).purchased, 4, "بعد إعادة الفتح");
});
check("fixture الحقيقي old-user-v7.json: ترحيل بلا فقد", () => {
  const f = JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures/old-user-v7.json"), "utf8")); const b = run(f); const s = b.s;
  const oldQty = f.items.reduce((a, i) => a + (Number(i.purchased) || 0), 0);
  ok(s.seeds.purchaseRecords); ok(sum(s) >= oldQty - 0, "لم تنقص الكميات"); ok(s.items.every(i => Array.isArray(i.purchases)));
  const ids = new Set(s.items.map(i => i.id)); f.items.filter(i => i.purchased > 0 && i.id !== "item-v7-niche-3").forEach(i => ok(ids.has(i.id), "فُقد " + i.id));
  ok(s.legacyHoneymoon, "أرشيف شهر العسل باقٍ");
});
console.log(`\n${passed} passed, ${failed} failed`); process.exit(failed ? 1 : 0);
