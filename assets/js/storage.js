/* Local data layer: no server, account, or network requests. */
(() => {
  const STORAGE_KEY = "brideListApp.v1";
  /* معرّفات الفئات الافتراضية القديمة (قبل تحديث الفئات). تُحذف مرة واحدة فقط عند الترحيل، بعد أخذ نسخة احتياطية.
     فئة «الرفايع» والفئات التي أنشأها المستخدم بنفسه لا تُحذف أبدًا. */
  const LEGACY_DEFAULT_CAT_IDS = ["cat-bedroom", "cat-kitchen", "cat-appliances", "cat-bathroom", "cat-linen", "cat-clothes", "cat-personal", "cat-other"];
  const clone = value => JSON.parse(JSON.stringify(value));
  const SCHEMA = 6;
  const IMAGE_KEY = STORAGE_KEY + ".heroImage";          /* الصورة المخصصة منفصلة عن بيانات القائمة */
  const TIPS_KEY = STORAGE_KEY + ".tips";             /* حالة قوائم النصائح الذهبية: مفتاح مستقل لا يؤثر على بنود القائمة */
  const BACKUP_V5_KEY = STORAGE_KEY + ".pre-v5-backup";  /* نسخة البيانات قبل تحديث الفئات */
  const BACKUP_V7_KEY = STORAGE_KEY + ".pre-v7-backup";  /* نسخة البيانات قبل تحديث الفئات */
  const IMAGE_EXPORT_MAX = 700 * 1024;                   /* أقصى حجم للصورة داخل ملف التصدير */
  const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
  /* الميزانية: null = غير محددة (ليست صفرًا) */
  const cleanBudget = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0) ? null : Math.round(Number(v) * 100) / 100;
  const ICON_KEYS = ["auto","bed","kitchen","appliance","drop","curtain","hanger","flower","box","heart","gift","bag","home","star","sparkles","pot","cup","basket","plane"];
  const FALLBACK_CAT = { id: "cat-recovered", name: "بنود بدون فئة" };


  /* ---------- اسم العروسة + الكتالوج ----------
     الكتالوج (catalog.js) هو المصدر الوحيد للبنود الافتراضية، وكل بند فيه له معرّف ثابت.
     الترحيلات تُنفَّذ مرة واحدة فقط لكل مستخدم (علامات state.seeds) ولا تعيد بندًا حذفه المستخدم ولا تغيّر ما عدّله. */
  /* الاسم الظاهر الافتراضي (مؤقت): يُغيَّر من هنا فقط، أو من الإعدادات لكل مستخدمة. */
  const DEFAULT_BRIDE_NAME = "عروسة";
  const LEGACY_DEFAULT_NAME_RE = /^[چج]يسي$/;   /* الاسم الافتراضي القديم؛ يُستبدل مرة واحدة عند الترحيل */
  const RAFAYEA = { id: "cat-rafayea", name: "الرفايع" };
  const HONEYMOON_CAT_ID = "cat-v5-honeymoon";
  const HONEYMOON_NAME = "شنطة شهر العسل";
  /* ثوابت الترحيل v7 — تمثل القيم الافتراضية للكتالوج السابق (v6) لتمييز ما لم يلمسه المستخدم عمّا عدّله. */
  const LEGACY_QTY_EXC = {"item-v5-appliances-27": 2, "item-v5-furnishings-13": 2, "item-v5-furnishings-14": 2, "item-v5-personal-4": 2, "item-v5-honeymoon-13": 2};   /* الكميات الافتراضية القديمة المختلفة عن 1 */
  const LEGACY_RENAMES = {"item-v5-niche-9": ["حوامل أطباق النيش", "حامل أطباق النيش"], "item-v5-personal-6": ["سكراب للبشرة والجسم", "سكراب للبشرة"]};       /* id: [الاسم القديم، الاسم الجديد] */
  const LEGACY_HONEYMOON = {"item-v5-honeymoon-1": ["أطقم خروج حسب عدد الأيام", 1, ""], "item-v5-honeymoon-2": ["غيارات داخلية", 1, ""], "item-v5-honeymoon-3": ["Pads", 1, ""], "item-v5-honeymoon-4": ["أطقم نوم حسب عدد الأيام", 1, ""], "item-v5-honeymoon-5": ["بيجامة نصف كم", 1, ""], "item-v5-honeymoon-6": ["بيجامة كم", 1, ""], "item-v5-honeymoon-7": ["بيجامة كت وشورت", 1, ""], "item-v5-honeymoon-8": ["شرابات", 1, ""], "item-v5-honeymoon-9": ["جواكت", 1, ""], "item-v5-honeymoon-10": ["صنادل", 1, ""], "item-v5-honeymoon-11": ["سليبر بيت", 1, ""], "item-v5-honeymoon-12": ["سليبر خروج", 1, ""], "item-v5-honeymoon-13": ["مايوه", 2, ""], "item-v5-honeymoon-14": ["شنطة بحر", 1, ""], "item-v5-honeymoon-15": ["طاقية بحر", 1, ""], "item-v5-honeymoon-16": ["إكسسوارات ملونة للبحر", 1, ""], "item-v5-honeymoon-17": ["نظارة شمس", 1, ""], "item-v5-honeymoon-18": ["صن بلوك للوجه والجسم", 1, ""], "item-v5-honeymoon-19": ["حذاء بحر", 1, ""], "item-v5-honeymoon-20": ["كريم حروق", 1, ""], "item-v5-honeymoon-21": ["شامبو", 1, ""], "item-v5-honeymoon-22": ["بلسم", 1, ""], "item-v5-honeymoon-23": ["سيرم شعر", 1, ""], "item-v5-honeymoon-24": ["مكياج", 1, ""], "item-v5-honeymoon-25": ["سكين كير", 1, ""], "item-v5-honeymoon-26": ["فوط / بشكير", 1, ""], "item-v5-honeymoon-27": ["فرش أسنان ومعجون", 1, ""], "item-v5-honeymoon-28": ["غسول وشاور", 1, ""], "item-v5-honeymoon-29": ["مرطب", 1, ""], "item-v5-honeymoon-30": ["ديتول للتعقيم", 1, ""], "item-v5-honeymoon-31": ["لزق جروح", 1, ""], "item-v5-honeymoon-32": ["دبل فيس (لزق)", 1, ""], "item-v5-honeymoon-33": ["إبرة وخيط", 1, ""], "item-v5-honeymoon-34": ["أدوية شخصية وطوارئ", 1, ""], "item-v5-honeymoon-35": ["بطاقة شخصية", 1, ""], "item-v5-honeymoon-36": ["باسبور", 1, ""], "item-v5-honeymoon-37": ["وثيقة الزواج المؤقتة", 1, ""], "item-v5-honeymoon-38": ["فيزا", 1, ""], "item-v5-honeymoon-39": ["شواحن", 1, ""], "item-v5-honeymoon-40": ["باور بانك", 1, ""], "item-v5-honeymoon-41": ["إير بودز", 1, ""], "item-v5-honeymoon-42": ["Mobile cover للبحر", 1, ""], "item-v5-honeymoon-43": ["مكواة شعر", 1, ""], "item-v5-honeymoon-44": ["سشوار", 1, ""], "item-v5-honeymoon-45": ["مكواة هدوم صغيرة", 1, ""], "item-v5-honeymoon-46": ["ملايات إضافية", 1, ""], "item-v5-honeymoon-47": ["بطاقة بيانات على الحقيبة", 1, ""], "item-v5-honeymoon-48": ["نسخ إلكترونية من الحجوزات والتذاكر", 1, ""], "item-v5-honeymoon-49": ["حقيبة صغيرة للأدوية والمستلزمات", 1, ""]};   /* id: [الاسم، الكمية، الملاحظة] للبنود الافتراضية القديمة لفئة شنطة شهر العسل */
  const LEGACY_PLACEHOLDER_ID = "item-v5-appliances-28";   /* بند «الجهاز» الذي كان بلا معنى */

  /* تطبيع الاسم للمقارنة فقط (لا يغيّر الاسم المحفوظ) */
  const nameKey = v => String(v || "").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[()\[\]\-+،,/\s]+/g, " ").trim().toLocaleLowerCase();
  const catalogDefs = () => { const c = window.BrideCatalog; return c && Array.isArray(c.categories) ? c.categories : null; };
  const catIdOf = def => def.key === "rafayea" ? RAFAYEA.id : `cat-v5-${def.key}`;
  const maxOrder = list => list.reduce((m, x) => Math.max(m, Number(x.sortOrder) || 0), 0);

  /* يعثر على فئة الكتالوج أو ينشئها (بالمعرّف ثم بالاسم). */
  function ensureDefCat(st, def, budgets) {
    const id = catIdOf(def);
    let cat = st.categories.find(c => c.id === id) || st.categories.find(c => nameKey(c.name) === nameKey(def.name));
    if (cat) return { cat, created: false };
    const carried = budgets && budgets.has(nameKey(def.name)) ? budgets.get(nameKey(def.name)) : null;
    cat = { id, name: def.name, icon: def.icon, description: def.description, budget: carried, sortOrder: maxOrder(st.categories) + 1 };
    st.categories.push(cat);
    return { cat, created: true };
  }
  /* يضيف بنود الكتالوج الناقصة. onlyNew=true: البنود الجديدة فقط (معرّفها item-v7-…)، فلا يعود أي بند قديم حذفه المستخدم. */
  function addDefItems(st, def, cat, ctx, onlyNew) {
    const have = new Set(st.items.filter(it => it.categoryId === cat.id).map(it => nameKey(it.name)));
    let added = 0;
    def.groups.forEach(group => group.items.forEach(row => {
      const [name, unit, qty, note, id] = row, key = nameKey(name);
      if ((onlyNew && !String(id).startsWith("item-v7-")) || have.has(key) || ctx.usedIds.has(id)) return;
      have.add(key); ctx.usedIds.add(id);
      st.items.push({
        id, categoryId: cat.id, name, unit, required: qty, purchased: 0, unitPrice: null,
        status: "missing", notes: note || "", group: group.title, sortOrder: ++ctx.order, createdAt: ctx.now, updatedAt: ctx.now
      });
      added++;
    }));
    return added;
  }
  const newCtx = st => ({ now: new Date().toISOString(), usedIds: new Set(st.items.map(it => it.id)), order: maxOrder(st.items) });
  /* ترتيب الفئات: فئات الكتالوج بترتيبه، ثم فئات المستخدم بترتيبها السابق */
  function sortCats(st) {
    const defs = catalogDefs(); if (!defs) return;
    const rank = new Map(defs.map((d, i) => [catIdOf(d), i]));
    const r = c => rank.has(c.id) ? rank.get(c.id) : 1000 + (Number(c.sortOrder) || 0);
    st.categories.sort((a, b) => r(a) - r(b));
    st.categories.forEach((c, i) => { c.sortOrder = i + 1; });
  }

  /* للمستخدمين الأقدم من إضافة «الرفايع»: تُضاف الفئة وبنودها مرة واحدة فقط (العلامة state.seeds.rafayea). */
  function applySeeds(st) {
    st.seeds = st.seeds && typeof st.seeds === "object" ? st.seeds : {};
    if (st.seeds.rafayea) return false;
    const defs = catalogDefs(); const def = defs && defs.find(d => d.key === "rafayea");
    if (!def) return false;
    const { cat } = ensureDefCat(st, def);
    addDefItems(st, def, cat, newCtx(st), false);
    st.seeds.rafayea = true;
    return true;
  }

  /* ---------- الترحيل v5 (الفئات الجديدة) ----------
     مرة واحدة فقط (العلامة state.seeds.catalogV5): يحذف الفئات الافتراضية القديمة (بالمعرّف) وبنودها بعد أخذ نسخة احتياطية،
     ثم يضيف فئات الكتالوج وبنوده دون تكرار. فئات المستخدم و«الرفايع» لا تُحذف أبدًا. */
  function applyCatalogV5(st) {
    st.seeds = st.seeds && typeof st.seeds === "object" ? st.seeds : {};
    if (st.seeds.catalogV5) return null;
    const defs = catalogDefs();
    if (!defs) return null;   /* بدون الكتالوج لا نحذف شيئًا */
    const stats = { removedCategories: 0, removedItems: 0, addedCategories: 0, addedItems: 0 };
    const removeIds = new Set(st.categories.filter(c => LEGACY_DEFAULT_CAT_IDS.includes(c.id) && c.id !== RAFAYEA.id).map(c => c.id));
    const carriedBudgets = new Map();                   /* ميزانية فئة قديمة تنتقل للفئة الجديدة التي تحمل نفس الاسم */
    st.categories.forEach(c => { if (removeIds.has(c.id) && c.budget !== null && c.budget !== undefined) carriedBudgets.set(nameKey(c.name), c.budget); });
    stats.removedCategories = removeIds.size;
    stats.removedItems = st.items.filter(it => removeIds.has(it.categoryId)).length;
    st.categories = st.categories.filter(c => !removeIds.has(c.id));
    st.items = st.items.filter(it => !removeIds.has(it.categoryId));
    const ctx = newCtx(st);
    defs.forEach(def => {
      const { cat, created } = ensureDefCat(st, def, carriedBudgets);
      if (created) stats.addedCategories++;
      if (def.key === "rafayea" && st.seeds.rafayea) return;   /* بنود الرفايع أضيفت سابقًا؛ لا نعيد ما حذفه المستخدم */
      stats.addedItems += addDefItems(st, def, cat, ctx, false);
      if (def.key === "rafayea") st.seeds.rafayea = true;
    });
    sortCats(st);
    if (st.profile && LEGACY_DEFAULT_NAME_RE.test(String(st.profile.name || "").trim())) st.profile.name = "";
    st.seeds.catalogV5 = true;
    return stats;
  }

  /* ---------- الترحيل v7 ----------
     مرة واحدة فقط (العلامة state.seeds.catalogV7):
       1) فئة «شنطة شهر العسل» لم تعد فئة مشتريات: بنودها الافتراضية التي لم يلمسها المستخدم تُحذف (صارت نصائح)،
          وما عدّله المستخدم (شراء/سعر/ملاحظة/كمية/بند أضافه) يُحفظ في أرشيف state.legacyHoneymoon خارج المشتريات والميزانية، لا يضيع.
       2) الكميات تُطابق ملف Excel لكل بند لم يلمسه المستخدم فقط (لا مشترى، لا سعر، والكمية ما زالت الافتراضية القديمة).
       3) تُضاف البنود الجديدة فقط؛ ولا يعود أي بند قديم حذفه المستخدم. */
  function applyCatalogV7(st) {
    st.seeds = st.seeds && typeof st.seeds === "object" ? st.seeds : {};
    if (st.seeds.catalogV7) return null;
    const defs = catalogDefs();
    if (!defs) return null;
    const stats = { archivedItems: 0, removedHoneymoonItems: 0, qtyUpdated: 0, renamed: 0, addedItems: 0, addedCategories: 0, placeholderRemoved: 0 };
    const ctx = newCtx(st);
    const isUntouched = it => it.purchased === 0 && (it.unitPrice === null || it.unitPrice === undefined) && it.status === "missing";

    const hm = st.categories.find(c => c.id === HONEYMOON_CAT_ID) || st.categories.find(c => nameKey(c.name) === nameKey(HONEYMOON_NAME));
    if (hm) {
      const mine = st.items.filter(it => it.categoryId === hm.id);
      const kept = mine.filter(it => {
        const lg = LEGACY_HONEYMOON[it.id];
        const pristine = lg && it.name === lg[0] && it.required === lg[1] && String(it.notes || "") === lg[2] && isUntouched(it);
        if (pristine) stats.removedHoneymoonItems++;
        return !pristine;
      });
      const hasBudget = hm.budget !== null && hm.budget !== undefined;
      if (kept.length || hasBudget) {
        const prev = st.legacyHoneymoon && Array.isArray(st.legacyHoneymoon.items) ? st.legacyHoneymoon.items : [];
        st.legacyHoneymoon = { archivedAt: ctx.now, categoryName: hm.name, budget: hasBudget ? hm.budget : null, items: prev.concat(kept.map(it => ({ ...it }))) };
        stats.archivedItems = kept.length;
      }
      st.items = st.items.filter(it => it.categoryId !== hm.id);
      st.categories = st.categories.filter(c => c.id !== hm.id);
    }
    const ph = st.items.find(it => it.id === LEGACY_PLACEHOLDER_ID);
    if (ph && ph.name === "الجهاز" && isUntouched(ph)) { st.items = st.items.filter(it => it !== ph); stats.placeholderRemoved = 1; }

    const byId = new Map(st.items.map(it => [it.id, it]));
    defs.forEach(def => {
      const { cat, created } = ensureDefCat(st, def);
      if (created) stats.addedCategories++;
      def.groups.forEach(group => group.items.forEach(row => {
        const [, , qty, note, id] = row;
        const it = byId.get(id);
        if (!it) return;
        const rn = LEGACY_RENAMES[id];
        if (rn && it.name === rn[0]) { it.name = rn[1]; stats.renamed++; }
        const oldDefault = Object.prototype.hasOwnProperty.call(LEGACY_QTY_EXC, id) ? LEGACY_QTY_EXC[id] : 1;
        if (isUntouched(it) && it.required === oldDefault && it.required !== qty) { it.required = qty; it.updatedAt = ctx.now; stats.qtyUpdated++; }
        if (it.categoryId === cat.id && it.group !== group.title) it.group = group.title;
        if (!it.notes && note) it.notes = note;
      }));
      stats.addedItems += addDefItems(st, def, cat, ctx, true);
    });
    sortCats(st);
    st.seeds.catalogV7 = true;
    return stats;
  }

  function makeInitialState() {
    const fresh = {
      version: 1, schema: SCHEMA,
      profile: { name: "", weddingDate: "" },      /* الاسم الفارغ = يظهر الاسم الافتراضي DEFAULT_BRIDE_NAME */
      totalBudget: null, categories: [], items: [], nextId: 1, seeds: {}
    };
    applyCatalogV5(fresh);
    fresh.seeds.rafayea = true; fresh.seeds.catalogV7 = true;   /* مستخدم جديد: الكتالوج الحالي كامل، لا ترحيل لاحق */
    return fresh;
  }

  /* أرشيف شهر العسل: يُنظَّف عند القراءة (لا يُحسب في المشتريات ولا الميزانية) */
  function cleanArchive(a) {
    if (!a || typeof a !== "object" || !Array.isArray(a.items)) return null;
    const n = v => { const x = Math.round(Number(v)); return Number.isFinite(x) && x >= 0 ? x : 0; };
    const items = a.items.filter(it => it && typeof it === "object").slice(0, 200).map((it, i) => ({
      id: String(it.id || `legacy-hm-${i}`).slice(0, 80), name: String(it.name || "بند").slice(0, 100), unit: String(it.unit || "قطعة").slice(0, 25),
      required: n(it.required), purchased: n(it.purchased),
      unitPrice: it.unitPrice === null || it.unitPrice === undefined || it.unitPrice === "" || !Number.isFinite(Number(it.unitPrice)) || Number(it.unitPrice) < 0 ? null : Number(it.unitPrice),
      status: ["missing", "preparing", "complete"].includes(it.status) ? it.status : "missing", notes: String(it.notes || "").slice(0, 500), group: String(it.group || "").slice(0, 80)
    }));
    return { archivedAt: String(a.archivedAt || "").slice(0, 40), categoryName: String(a.categoryName || HONEYMOON_NAME).slice(0, 60), budget: cleanBudget(a.budget), items };
  }

  /* strict=true  : استيراد ملف — يرفض البيانات غير الصحيحة.
     strict=false : تحميل من المتصفح — يصلح بدل ما يفقد (Migration آمنة). */
  function normalizeState(raw, strict = true) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.categories) || !Array.isArray(raw.items)) {
      throw new Error("ملف البيانات غير صالح.");
    }
    const categories = raw.categories.map((c, i) => ({
      id: String(c.id || `cat-import-${i}`),
      name: String(c.name || "فئة بدون اسم").slice(0, 60),
      sortOrder: Number.isFinite(Number(c.sortOrder)) ? Number(c.sortOrder) : i + 1,
      icon: ICON_KEYS.includes(c.icon) ? c.icon : "auto",
      description: String(c.description || "").slice(0, 120),
      budget: strict && c.budget !== undefined && c.budget !== null && c.budget !== "" && cleanBudget(c.budget) === null
        ? (() => { throw new Error(`ميزانية الفئة "${c.name || i + 1}" غير صحيحة.`); })()
        : cleanBudget(c.budget)
    }));
    const catIds = new Set(categories.map(c => c.id));
    const items = raw.items.map((it, i) => {
      let required = Number(it.required), purchased = Number(it.purchased);
      const price = it.unitPrice === null || it.unitPrice === "" || it.unitPrice === undefined ? null : Number(it.unitPrice);
      const label = it.name || i + 1;
      let categoryId = String(it.categoryId);
      if (!catIds.has(categoryId)) {
        if (strict) throw new Error(`البند "${label}" مرتبط بفئة غير موجودة.`);
        if (!catIds.has(FALLBACK_CAT.id)) { categories.push({ ...FALLBACK_CAT, sortOrder: categories.length + 1, icon: "box", description: "", budget: null }); catIds.add(FALLBACK_CAT.id); }
        categoryId = FALLBACK_CAT.id;
      }
      if (!Number.isInteger(required) || required < 0 || !Number.isInteger(purchased) || purchased < 0 || purchased > required) {
        if (strict) throw new Error(`كميات البند "${label}" غير صحيحة.`);
        required = Number.isFinite(required) && required > 0 ? Math.round(required) : 0;
        purchased = Number.isFinite(purchased) && purchased > 0 ? Math.round(purchased) : 0;
        purchased = Math.min(purchased, required);
      }
      let unitPrice = price;
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        if (strict) throw new Error(`سعر البند "${label}" غير صحيح.`);
        unitPrice = null;
      }
      let status = ["missing", "preparing", "complete"].includes(it.status) ? it.status : "missing";
      if (purchased === required && required > 0) status = "complete";
      else if (purchased > 0 || status === "preparing") status = "preparing";
      else status = "missing";
      return {
        id: String(it.id || `item-import-${i}`), categoryId,
        name: String(it.name || "بند بدون اسم").slice(0, 100), unit: String(it.unit || "قطعة").slice(0, 25),
        required, purchased, unitPrice, status, notes: String(it.notes || "").slice(0, 500),
        group: String(it.group || "").slice(0, 80),
        sortOrder: Number.isFinite(Number(it.sortOrder)) ? Number(it.sortOrder) : i + 1,
        createdAt: it.createdAt || new Date().toISOString(), updatedAt: it.updatedAt || new Date().toISOString()
      };
    });
    const budget = raw.totalBudget === null || raw.totalBudget === "" || raw.totalBudget === undefined ? null : Number(raw.totalBudget);
    if (budget !== null && (!Number.isFinite(budget) || budget < 0)) {
      if (strict) throw new Error("الميزانية في الملف غير صحيحة.");
    }
    return {
      version: 1, schema: SCHEMA,
      profile: {
        name: String(raw.profile?.name || "").slice(0, 60),
        weddingDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.profile?.weddingDate || "") ? raw.profile.weddingDate : ""
      },
      totalBudget: budget !== null && Number.isFinite(budget) && budget >= 0 ? budget : null,
      categories, items,
      nextId: Math.max(1, Number(raw.nextId) || 1),
      seeds: raw.seeds && typeof raw.seeds === "object" ? { rafayea: raw.seeds.rafayea === true, catalogV5: raw.seeds.catalogV5 === true, catalogV7: raw.seeds.catalogV7 === true } : {},
      legacyHoneymoon: cleanArchive(raw.legacyHoneymoon)
    };
  }

  let storageOk = true;
  let migrationNotice = null;     /* تُعرض مرة واحدة في الواجهة بعد الترحيل */
  /* يكتب نسخة احتياطية ويتأكد من حفظها فعلًا (لا نحذف شيئًا قبل ذلك) */
  function writeBackup(key, raw, overwrite) {
    try {
      if (!overwrite && localStorage.getItem(key) !== null) return true;
      localStorage.setItem(key, raw);
      return localStorage.getItem(key) === raw;
    } catch (e) { console.error(e); return false; }
  }
  function load() {
    let raw = null;
    try { raw = localStorage.getItem(STORAGE_KEY); } catch (error) { storageOk = false; console.error(error); }
    if (!raw) {
      const fresh = makeInitialState();
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh)); } catch (error) { storageOk = false; }
      return fresh;
    }
    try {
      const parsed = JSON.parse(raw);
      const next = normalizeState(parsed, false);
      const oldSchema = parsed.schema || 1;
      const seeded = applySeeds(next);   // إضافة «الرفايع» مرة واحدة فقط للبيانات الأقدم، دون لمس بيانات المستخدم
      let migrated = null, migratedV7 = null, deferred = false;
      if (!next.seeds.catalogV5) {
        /* الترحيل: النسخة الاحتياطية أولًا. لو تعذر حفظها (مساحة ممتلئة) نترك البيانات كما هي ونعيد المحاولة لاحقًا. */
        if (writeBackup(BACKUP_V5_KEY, raw, true)) migrated = applyCatalogV5(next);
        else { deferred = true; migrationNotice = { failed: true }; }
      }
      if (!deferred && !next.seeds.catalogV7) {
        if (writeBackup(BACKUP_V7_KEY, raw, false)) migratedV7 = applyCatalogV7(next);
        else { deferred = true; migrationNotice = { failed: true }; }
      }
      if (migrated || migratedV7) migrationNotice = { ...(migrated || {}), ...(migratedV7 ? { v7: migratedV7 } : {}) };
      const needsSave = oldSchema < SCHEMA || seeded || !!migrated || !!migratedV7;
      if (needsSave && !deferred) {
        try {
          if (oldSchema < 4) writeBackup(STORAGE_KEY + ".pre-v4-backup", raw);
          if (oldSchema < 3) writeBackup(STORAGE_KEY + ".pre-v3-backup", raw);
          if (oldSchema < 2) writeBackup(STORAGE_KEY + ".pre-v2-backup", raw);
          localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
        } catch (e) { console.error(e); }
      }
      return next;
    } catch (error) {
      console.error("تعذر تحميل بيانات Bride List:", error);
      try { localStorage.setItem(`${STORAGE_KEY}.corrupt-${Date.now()}`, raw); } catch (e) { /* ignore */ }
      return makeInitialState();
    }
  }

  let state = load();
  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); return true; }
    catch (error) { console.error(error); return false; }
  }
  /* أي تعديل يُعتبر ناجحًا فقط لو اتحفظ فعلًا؛ وإلا نرجع للحالة السابقة. */
  function commit(mutator, failMessage = "المتصفح لم يستطع حفظ البيانات. تأكدي من المساحة المتاحة وأن التخزين غير معطّل.") {
    const snapshot = clone(state);
    try {
      const result = mutator();
      if (!save()) throw new Error(failMessage);
      return result;
    } catch (error) { state = snapshot; throw error; }
  }
  function createId(prefix) { return `${prefix}-${Date.now().toString(36)}-${state.nextId++}`; }
  function cleanIcon(icon) { return ICON_KEYS.includes(icon) ? icon : "auto"; }
  function checkCategoryName(name, exceptId) {
    const clean = String(name || "").trim();
    if (!clean) throw new Error("اكتبي اسم الفئة.");
    if (state.categories.some(c => c.id !== exceptId && c.name.toLocaleLowerCase() === clean.toLocaleLowerCase())) throw new Error("الفئة دي موجودة بالفعل.");
    return clean.slice(0, 60);
  }

  window.BrideStore = {
    ICON_KEYS, DEFAULT_BRIDE_NAME,
    isPersistent: () => storageOk,
    consumeMigrationNotice() { const n = migrationNotice; migrationNotice = null; return n; },
    getLegacyHoneymoon() { return state.legacyHoneymoon ? clone(state.legacyHoneymoon) : null; },
    clearLegacyHoneymoon() { commit(() => { state.legacyHoneymoon = null; }, "تعذر حفظ التغيير."); },
    getPreV5Backup() { try { return localStorage.getItem(BACKUP_V5_KEY); } catch (e) { return null; } },
    /* قوائم النصائح الذهبية: معرّفات المهام المنجزة فقط، في مفتاح مستقل */
    getTipsDone() {
      try { const o = JSON.parse(localStorage.getItem(TIPS_KEY) || "null"); return o && o.done && typeof o.done === "object" ? { ...o.done } : {}; }
      catch (e) { return {}; }
    },
    setTipsDone(ids, on) {
      const done = this.getTipsDone();
      ids.forEach(id => { if (on) done[id] = true; else delete done[id]; });
      try { localStorage.setItem(TIPS_KEY, JSON.stringify({ version: 1, done })); }
      catch (e) { throw new Error("المتصفح لم يستطع حفظ علامات النصائح. تأكدي من المساحة المتاحة."); }
    },
    getState: () => clone(state),
    save,
    updateProfile(profile) { return commit(() => { state.profile = { ...state.profile, ...profile }; }); },
    setBudget(value) { return commit(() => { state.totalBudget = value; }); },
    /* ميزانية الفئة: تعديل فئة واحدة فقط ولا تلمس غيرها. القيمة الفارغة = غير محددة. */
    setCategoryBudget(id, value) {
      const cat = state.categories.find(c => c.id === id);
      if (!cat) throw new Error("الفئة غير موجودة.");
      if (value !== null && value !== "" && value !== undefined && cleanBudget(value) === null) throw new Error("اكتبي ميزانية صحيحة أكبر من أو تساوي صفر.");
      return commit(() => { cat.budget = cleanBudget(value); return cat.budget; });
    },
    /* الصورة المخصصة ليوم الفرح: مفتاح مستقل، وتفشل بوضوح عند امتلاء التخزين دون مسح أي بيانات. */
    getHeroImage() {
      try {
        const raw = localStorage.getItem(IMAGE_KEY); if (!raw) return null;
        const obj = JSON.parse(raw);
        return obj && typeof obj.dataUrl === "string" && IMG_RE.test(obj.dataUrl) ? obj : null;
      } catch (e) { return null; }
    },
    setHeroImage(dataUrl) {
      if (!IMG_RE.test(dataUrl || "")) throw new Error("الصورة غير صالحة.");
      try { localStorage.setItem(IMAGE_KEY, JSON.stringify({ dataUrl, savedAt: new Date().toISOString() })); }
      catch (error) {
        throw new Error(error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014)
          ? "مساحة تخزين المتصفح ممتلئة، فلم نقدر نحفظ الصورة. بياناتك زي ما هي ولم يتم مسح أي حاجة."
          : "تعذر حفظ الصورة في المتصفح.");
      }
    },
    clearHeroImage() { try { localStorage.removeItem(IMAGE_KEY); } catch (e) { /* ignore */ } },
    addCategory(name, opts = {}) {
      const clean = checkCategoryName(name);
      return commit(() => {
        const cat = { id: createId("cat"), name: clean, sortOrder: state.categories.length + 1, icon: cleanIcon(opts.icon), description: String(opts.description || "").trim().slice(0, 120), budget: null };
        state.categories.push(cat);
        return clone(cat);
      });
    },
    updateCategory(id, opts) {
      const cat = state.categories.find(c => c.id === id);
      if (!cat) throw new Error("الفئة غير موجودة.");
      const clean = checkCategoryName(opts.name, id);
      return commit(() => {
        cat.name = clean; cat.icon = cleanIcon(opts.icon);
        cat.description = String(opts.description || "").trim().slice(0, 120);
        return clone(cat);
      });
    },
    addItem(data) {
      const item = this.validateItem(data);
      return commit(() => {
        item.id = createId("item");
        item.createdAt = item.updatedAt = new Date().toISOString();
        item.sortOrder = state.items.reduce((m, it) => Math.max(m, Number(it.sortOrder) || 0), 0) + 1;
        state.items.push(item);
        return clone(item);
      });
    },
    updateItem(id, data) {
      const index = state.items.findIndex(it => it.id === id);
      if (index < 0) throw new Error("البند غير موجود.");
      const item = this.validateItem(data);
      return commit(() => {
        const prev = state.items[index];
        state.items[index] = { ...prev, ...item, id, updatedAt: new Date().toISOString() };
        if (prev.categoryId !== item.categoryId) state.items[index].group = "";   /* التقسيم الفرعي يخص الفئة الأصلية فقط */
        return clone(state.items[index]);
      });
    },
    validateItem(data) {
      const name = String(data.name || "").trim();
      if (!name) throw new Error("اكتبي اسم البند.");
      if (!state.categories.some(c => c.id === data.categoryId)) throw new Error("اختاري فئة صحيحة.");
      const required = Number(data.required), purchased = Number(data.purchased);
      if (!Number.isInteger(required) || required < 0) throw new Error("الكمية المطلوبة لازم تكون رقمًا صحيحًا يساوي صفر أو أكبر.");
      if (!Number.isInteger(purchased) || purchased < 0) throw new Error("الكمية المشتراة لازم تكون رقمًا صحيحًا يساوي صفر أو أكبر.");
      if (purchased > required) throw new Error("الكمية المشتراة لا يمكن أن تتجاوز الكمية المطلوبة.");
      const unitPrice = data.unitPrice === "" || data.unitPrice === null || data.unitPrice === undefined ? null : Number(data.unitPrice);
      if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) throw new Error("سعر الوحدة لازم يكون صفر أو أكبر.");
      let status = data.status;
      if (required > 0 && purchased === required) status = "complete";
      else if (purchased > 0) status = "preparing";
      else if (status === "complete") status = "missing";
      if (!["missing", "preparing", "complete"].includes(status)) status = "missing";
      return {
        name: name.slice(0, 100), categoryId: data.categoryId,
        unit: String(data.unit || "قطعة").trim().slice(0, 25) || "قطعة",
        required, purchased, unitPrice, status, notes: String(data.notes || "").trim().slice(0, 500)
      };
    },
    deleteItem(id) { commit(() => { state.items = state.items.filter(it => it.id !== id); }, "تعذر حفظ التغيير."); },
    deleteCategory(id) {
      if (state.items.some(it => it.categoryId === id)) throw new Error("انقلي أو احذفي البنود الموجودة داخل الفئة الأول.");
      commit(() => { state.categories = state.categories.filter(c => c.id !== id); }, "تعذر حفظ التغيير.");
    },
    exportData() {
      const out = { ...clone(state), exportedAt: new Date().toISOString(), app: "Bride List" };
      const img = this.getHeroImage();                    /* لا يفشل التصدير بسبب صورة كبيرة: نتجاوزها إن زادت عن الحد */
      if (img && img.dataUrl.length <= IMAGE_EXPORT_MAX) out.heroImage = img.dataUrl;
      out.tipsDone = Object.keys(this.getTipsDone());
      return JSON.stringify(out, null, 2);
    },
    importData(raw) {
      const next = normalizeState(raw, true);
      applySeeds(next);
      applyCatalogV5(next);   /* ملف قديم يُحدَّث لنفس الفئات الجديدة؛ والملف الجديد (العلامة موجودة) لا يتغير */
      applyCatalogV7(next);   /* ملف قديم فيه «شنطة شهر العسل»: يُرحَّل بنفس القواعد الآمنة */
      writeBackup(STORAGE_KEY + ".pre-import-backup", JSON.stringify(state), true);   /* أمان إضافي قبل الاستبدال */
      commit(() => { state = next; }, "تعذر حفظ النسخة المستوردة في المتصفح.");
      if (Array.isArray(raw.tipsDone)) {
        const ids = raw.tipsDone.filter(id => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id));
        try { localStorage.removeItem(TIPS_KEY); this.setTipsDone(ids, true); } catch (e) { /* اختياري */ }
      }
      if (typeof raw.heroImage === "string" && raw.heroImage.length <= IMAGE_EXPORT_MAX && IMG_RE.test(raw.heroImage)) {
        try { this.setHeroImage(raw.heroImage); } catch (e) { /* الصورة اختيارية: تبقى البيانات سليمة */ }
      }
    },
    reset() { commit(() => { state = makeInitialState(); }, "تعذر إعادة ضبط البيانات."); this.clearHeroImage(); try { localStorage.removeItem(TIPS_KEY); } catch (e) { /* ignore */ } }
  };
})();
