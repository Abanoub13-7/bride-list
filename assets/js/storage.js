/* Local data layer: no server, account, or network requests. */
(() => {
  const STORAGE_KEY = "brideListApp.v1";
  /* معرّفات الفئات الافتراضية القديمة (قبل تحديث الفئات). تُحذف مرة واحدة فقط عند الترحيل، بعد أخذ نسخة احتياطية.
     فئة «الرفايع» والفئات التي أنشأها المستخدم بنفسه لا تُحذف أبدًا. */
  const LEGACY_DEFAULT_CAT_IDS = ["cat-bedroom", "cat-kitchen", "cat-appliances", "cat-bathroom", "cat-linen", "cat-clothes", "cat-personal", "cat-other"];
  const clone = value => JSON.parse(JSON.stringify(value));
  const SCHEMA = 7;
  const IMAGE_KEY = STORAGE_KEY + ".heroImage";          /* الصورة المخصصة منفصلة عن بيانات القائمة */
  const TIPS_KEY = STORAGE_KEY + ".tips";             /* حالة قوائم النصائح الذهبية: مفتاح مستقل لا يؤثر على بنود القائمة */
  const BACKUP_V5_KEY = STORAGE_KEY + ".pre-v5-backup";  /* نسخة البيانات قبل تحديث الفئات */
  const BACKUP_V7_KEY = STORAGE_KEY + ".pre-v7-backup";  /* نسخة البيانات قبل تحديث الفئات */
  const BACKUP_V8_KEY = STORAGE_KEY + ".pre-v8-backup";  /* نسخة البيانات قبل دمج «الرفايع» وفئة «أدوات المطبخ والرفايع» ومعالجة التكرار المؤكد */
  const BACKUP_V9_KEY = STORAGE_KEY + ".pre-v9-backup";  /* نسخة البيانات قبل إضافة سجل المشتريات */
  const PIMG_PREFIX = STORAGE_KEY + ".pimg.";            /* صور الفواتير/المنتجات: مفتاح مستقل لكل عملية، فلا يفشل حفظ العملية بسبب صورة */
  const PIMG_MAX = 260 * 1024;                           /* أقصى حجم للصورة المضغوطة المخزّنة (نص data URL) */
  const PIMG_EXPORT_EACH = 220 * 1024, PIMG_EXPORT_TOTAL = 1800 * 1024;   /* حدود إدراج الصور في ملف التصدير */
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
  const KITCHEN_OLD_CAT_ID = "cat-v5-kitchen-tools";   /* فئة «أدوات المطبخ والرفايع» القديمة: تُدمج في «الرفايع» (cat-rafayea) */
  const CATEGORY_ALIASES = { [KITCHEN_OLD_CAT_ID]: RAFAYEA.id };   /* رابط قديم/إشارة محفوظة لفئة مدموجة يُحوَّل للفئة الموحدة */
  const RAFAYEA_OLD_DESC = "أدوات المطبخ الصغيرة ومستلزمات الطهي والتقديم";   /* الوصف الافتراضي القديم لـ «الرفايع»: يُحدَّث فقط إن لم تغيّره المستخدمة */
  /* التكرارات المؤكدة فقط (تحقق: نفس الفئة والمجموعة والوحدة والكمية ولا ملاحظات، والفرق صيغة الجمع فقط).
     drop = البند الذي يُدمج ويُحذف من الكتالوج، keep = البند الأساسي (معرّفه أقدم وموجود لدى كل المستخدمات). */
  const CONFIRMED_DUPLICATES = [
    { drop: "item-v7-niche-3", keep: "item-v5-niche-7", dropName: "طقم شربات", keepName: "أطقم شربات", unit: "طقم", qty: 1 }
  ];
  const DUPLICATE_DROP_IDS = new Set(CONFIRMED_DUPLICATES.map(d => d.drop));
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
  function addDefItems(st, def, cat, ctx, onlyNew, idFilter) {
    const have = new Set(st.items.filter(it => it.categoryId === cat.id).map(it => nameKey(it.name)));
    let added = 0;
    def.groups.forEach(group => group.items.forEach(row => {
      const [name, unit, qty, note, id] = row, key = nameKey(name);
      if ((onlyNew && !String(id).startsWith("item-v7-")) || have.has(key) || ctx.usedIds.has(id)) return;
      if (DUPLICATE_DROP_IDS.has(id) || (idFilter && !idFilter(id))) return;   /* لا يعود بند مكرر دُمج، ولا ما يخرج عن المرشّح */
      have.add(key); ctx.usedIds.add(id);
      st.items.push({
        id, categoryId: cat.id, name, unit, required: qty, purchased: 0, unitPrice: null,
        status: "missing", notes: note || "", group: group.title, sortOrder: ++ctx.order, createdAt: ctx.now, updatedAt: ctx.now,
        purchases: [], legacy: null
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
      if (def.key === "rafayea" && st.seeds.rafayea) {   /* بنود الرفايع الأصلية أضيفت سابقًا؛ لا نعيد ما حذفه المستخدم. بنود «أدوات المطبخ والرفايع» (كانت فئة مستقلة) تُضاف للفئة الموحدة */
        stats.addedItems += addDefItems(st, def, cat, ctx, false, id => String(id).startsWith("item-v5-kitchen-tools-"));
        return;
      }
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

  /* ---------- الترحيل v8 ----------
     مرة واحدة فقط (العلامة state.seeds.catalogV8)، على نسخة معزولة من البيانات (إن فشل شيء تبقى البيانات كما كانت):
       1) دمج فئة «أدوات المطبخ والرفايع» (cat-v5-kitchen-tools) في «الرفايع» (cat-rafayea): تُنقل بنودها كما هي (المعرّف والاسم والكمية والسعر والمشترى والملاحظة والمجموعة) ثم تُحذف الفئة الفارغة فقط.
       2) جمع الميزانيتين: الاثنتان محددتان → المجموع؛ واحدة فقط → تبقى كما هي؛ لا واحدة → غير محددة. الصفر قيمة محددة وليس «مفقودًا».
          القيمة غير الصالحة لا تُخمَّن (تُعامل كغير محددة وتُسجَّل في السجل والنسخة الاحتياطية).
       3) التكرار المؤكد فقط (CONFIRMED_DUPLICATES): يُدمج لو لم يُلمس أحد البندين، أو لو لُمس بند واحد فقط (تنتقل بياناته للبند الأساسي بنسخها لا بجمعها).
          لو لُمس البندان أو عُدّل الاسم أو نُقل البند من فئته: يبقى البندان كما هما ويُسجَّل التعارض. */
  const budgetState = v => {
    if (v === null || v === undefined || v === "") return { kind: "missing" };
    if (typeof v !== "number" && typeof v !== "string") return { kind: "invalid", raw: String(v).slice(0, 40) };
    const x = Number(v);
    return Number.isFinite(x) && x >= 0 ? { kind: "valid", value: Math.round(x * 100) / 100 } : { kind: "invalid", raw: String(v).slice(0, 40) };
  };
  const rawBudgetMap = raw => new Map((Array.isArray(raw && raw.categories) ? raw.categories : []).filter(c => c && typeof c === "object").map(c => [String(c.id), c.budget]));
  const isPristineItem = (it, name, unit, qty) => it.name === name && it.unit === unit && it.required === qty && it.purchased === 0 &&
    (it.unitPrice === null || it.unitPrice === undefined) && it.status === "missing" && String(it.notes || "") === "";

  function applyCatalogV8(st, rawBudgets) {
    st.seeds = st.seeds && typeof st.seeds === "object" ? st.seeds : {};
    if (st.seeds.catalogV8) return null;
    const defs = catalogDefs(); const def = defs && defs.find(d => d.key === "rafayea");
    if (!def) return null;   /* بدون الكتالوج لا نغيّر شيئًا */
    const now = new Date().toISOString();
    const log = { at: now, merged: false, movedItems: 0, budget: null, invalidBudgets: [], sameNameAfterMove: [], duplicates: [] };

    const old = st.categories.find(c => c.id === KITCHEN_OLD_CAT_ID);
    if (old) {
      let target = st.categories.find(c => c.id === RAFAYEA.id);
      const a = budgetState(rawBudgets && rawBudgets.has(RAFAYEA.id) ? rawBudgets.get(RAFAYEA.id) : (target ? target.budget : null));
      const b = budgetState(rawBudgets && rawBudgets.has(old.id) ? rawBudgets.get(old.id) : old.budget);
      if (a.kind === "invalid") log.invalidBudgets.push({ category: RAFAYEA.id, raw: a.raw });
      if (b.kind === "invalid") log.invalidBudgets.push({ category: old.id, raw: b.raw });
      const merged = a.kind === "valid" && b.kind === "valid" ? Math.round((a.value + b.value) * 100) / 100 : a.kind === "valid" ? a.value : b.kind === "valid" ? b.value : null;
      log.budget = { rafayea: a.kind === "valid" ? a.value : null, kitchenTools: b.kind === "valid" ? b.value : null, result: merged };
      if (!target) {
        target = { id: RAFAYEA.id, name: def.name, icon: def.icon, description: def.description, budget: null, sortOrder: maxOrder(st.categories) + 1 };
        st.categories.push(target);
      }
      target.budget = merged;
      if (String(target.description || "") === RAFAYEA_OLD_DESC) target.description = def.description;
      log.oldCategory = { name: old.name, icon: old.icon, description: old.description };
      const existing = new Set(st.items.filter(it => it.categoryId === target.id).map(it => nameKey(it.name)));
      st.items.forEach(it => {
        if (it.categoryId !== old.id) return;
        if (existing.has(nameKey(it.name))) log.sameNameAfterMove.push({ id: it.id, name: it.name });
        it.categoryId = target.id;   /* باقي بيانات البند (المعرّف، الاسم، الكميات، السعر، الملاحظات، المجموعة، الترتيب) كما هي */
        log.movedItems++;
      });
      st.categories = st.categories.filter(c => c.id !== old.id);
      log.merged = true;
    }

    st.mergedItems = st.mergedItems && typeof st.mergedItems === "object" ? st.mergedItems : {};
    CONFIRMED_DUPLICATES.forEach(d => {
      const drop = st.items.find(it => it.id === d.drop), keep = st.items.find(it => it.id === d.keep);
      const entry = { drop: d.drop, keep: d.keep, action: "" };
      if (!drop) { entry.action = "absent"; log.duplicates.push(entry); return; }             /* غير موجود (لم يُضف أو حذفته المستخدمة): لا شيء يُفعل */
      if (!keep) { entry.action = "kept-canonical-missing"; log.duplicates.push(entry); return; }   /* حذفت المستخدمة البند الأساسي: لا نمس بند الأخرى */
      if (drop.name !== d.dropName || keep.name !== d.keepName || drop.categoryId !== keep.categoryId) { entry.action = "kept-both-edited-or-moved"; log.duplicates.push(entry); return; }
      const dropTouched = !isPristineItem(drop, d.dropName, d.unit, d.qty), keepTouched = !isPristineItem(keep, d.keepName, d.unit, d.qty);
      if (dropTouched && keepTouched) {
        entry.action = "conflict-kept-both";
        entry.values = { drop: { required: drop.required, purchased: drop.purchased, unitPrice: drop.unitPrice, status: drop.status, notes: drop.notes }, keep: { required: keep.required, purchased: keep.purchased, unitPrice: keep.unitPrice, status: keep.status, notes: keep.notes } };
        log.duplicates.push(entry); return;
      }
      if (dropTouched) {   /* بيانات المستخدمة على البند المكرر فقط: تنتقل للأساسي بالنسخ (لا جمع) */
        keep.required = drop.required; keep.purchased = drop.purchased; keep.unitPrice = drop.unitPrice; keep.status = drop.status; keep.notes = drop.notes; keep.updatedAt = now;
        entry.action = "merged-data-copied-to-keep";
      } else entry.action = keepTouched ? "merged-keep-data-intact" : "merged-both-untouched";
      st.items = st.items.filter(it => it !== drop);
      st.mergedItems[d.drop] = d.keep;
      log.duplicates.push(entry);
    });

    sortCats(st);
    st.migrationLog = { ...(st.migrationLog && typeof st.migrationLog === "object" ? st.migrationLog : {}), v8: log };
    st.seeds.catalogV8 = true;
    return log;
  }

  /* ---------- سجل المشتريات: الكمية والإنفاق مشتقان من العمليات ---------- */
  const P = () => window.BridePurchases;
  const priceOk = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
  const recQty = r => { const q = Math.floor(Number(r && r.qty)); return Number.isFinite(q) && q > 0 ? q : 0; };
  const boughtQty = it => (it.legacy ? recQty(it.legacy) : 0) + (Array.isArray(it.purchases) ? it.purchases.reduce((a, r) => a + recQty(r), 0) : 0);
  /* مجموع الإنفاق المعروف + كمية بلا سعر: يُستخدم للتحقق من الترحيل ومقارنته بالحساب القديم */
  const spendOf = it => {
    let total = 0, unknown = 0;
    const part = (q, t) => { if (t === null) unknown += q; else total += t; };
    if (it.legacy && recQty(it.legacy)) part(recQty(it.legacy), priceOk(it.legacy.unitPrice) ? recQty(it.legacy) * Number(it.legacy.unitPrice) : null);
    (it.purchases || []).forEach(r => { if (recQty(r)) part(recQty(r), priceOk(r.totalPrice) ? Number(r.totalPrice) : null); });
    return { total: Math.round(total * 100) / 100, unknown };
  };
  /* يعيد حساب الكمية والحالة المشتقة داخل البند (نسخة مخزنة للتوافق مع التصدير والكود القديم؛ المصدر الحقيقي هو العمليات) */
  function syncDerived(it) {
    if (!Array.isArray(it.purchases)) return it;
    it.purchased = boughtQty(it);
    const req = Number(it.required) || 0;
    it.status = req > 0 && it.purchased >= req ? "complete" : it.purchased > 0 ? "preparing" : (it.status === "preparing" ? "preparing" : "missing");
    return it;
  }
  function ensureItemShape(it) {
    if (!Array.isArray(it.purchases)) it.purchases = [];
    if (it.legacy === undefined) it.legacy = null;
    return it;
  }

  /* ---------- الترحيل v9: إضافة سجل المشتريات (مرة واحدة: seeds.purchaseRecords) ----------
     لا نخترع عمليات شراء: الكمية المشتراة القديمة تُحفظ كما هي في item.legacy = {qty, unitPrice} («بيانات شراء سابقة غير مفصلة»)
     بلا تاريخ ولا لون ولا محل. سعر الوحدة القديم يُجمَّد داخل legacy (للمصروف) ويبقى أيضًا في item.unitPrice كسعر تقديري للباقي.
     التحقق: مجموع الكميات ومجموع المصروف قبل وبعد متطابقان تمامًا، وإلا يُرمى خطأ ولا يُطبَّق شيء. */
  function applyPurchaseRecordsV1(st) {
    st.seeds = st.seeds && typeof st.seeds === "object" ? st.seeds : {};
    if (st.seeds.purchaseRecords) return null;
    const before = { qty: 0, total: 0, unknown: 0 };
    st.items.forEach(it => {
      const q = Math.max(0, Math.round(Number(it.purchased) || 0));
      before.qty += q;
      if (q > 0) { if (priceOk(it.unitPrice)) before.total += q * Number(it.unitPrice); else before.unknown += q; }
    });
    const log = { at: new Date().toISOString(), itemsWithLegacy: 0, legacyQty: 0 };
    st.items.forEach(it => {
      if (Array.isArray(it.purchases)) { ensureItemShape(it); return; }   /* بند يحمل سجلًا بالفعل: لا نلمسه */
      const q = Math.max(0, Math.round(Number(it.purchased) || 0));
      it.purchases = [];
      it.legacy = q > 0 ? { qty: q, unitPrice: priceOk(it.unitPrice) ? Number(it.unitPrice) : null } : null;
      if (q > 0) { log.itemsWithLegacy++; log.legacyQty += q; }
      syncDerived(it);
    });
    const after = { qty: 0, total: 0, unknown: 0 };
    st.items.forEach(it => { after.qty += boughtQty(it); const sp = spendOf(it); after.total += sp.total; after.unknown += sp.unknown; });
    const rd = v => Math.round(v * 100) / 100;
    if (after.qty !== before.qty || rd(after.total) !== rd(before.total) || after.unknown !== before.unknown) throw new Error(`فشل التحقق من ترحيل سجل المشتريات (${before.qty}/${after.qty}).`);
    log.verified = { qty: after.qty, spent: rd(after.total), unpricedQty: after.unknown };
    st.migrationLog = { ...(st.migrationLog && typeof st.migrationLog === "object" ? st.migrationLog : {}), v9: log };
    st.seeds.purchaseRecords = true;
    return log;
  }

  function makeInitialState() {
    const fresh = {
      version: 1, schema: SCHEMA,
      profile: { name: "", weddingDate: "" },      /* الاسم الفارغ = يظهر الاسم الافتراضي DEFAULT_BRIDE_NAME */
      totalBudget: null, categories: [], items: [], nextId: 1, seeds: {}
    };
    applyCatalogV5(fresh);
    fresh.items.forEach(ensureItemShape);
    fresh.seeds.rafayea = true; fresh.seeds.catalogV7 = true; fresh.seeds.catalogV8 = true; fresh.seeds.purchaseRecords = true;   /* مستخدم جديد: الكتالوج الحالي كامل، لا ترحيل لاحق */
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

  const cleanJson = v => { try { const t = JSON.stringify(v); return v && typeof v === "object" && t.length < 30000 ? JSON.parse(t) : undefined; } catch (e) { return undefined; } };
  const cleanMap = v => { const out = {}; if (v && typeof v === "object") Object.keys(v).slice(0, 200).forEach(k => { if (typeof v[k] === "string") out[String(k).slice(0, 80)] = v[k].slice(0, 80); }); return out; };

  /* strict=true  : استيراد ملف — يرفض البيانات غير الصحيحة.
     strict=false : تحميل من المتصفح — يصلح بدل ما يفقد (Migration آمنة). */
  function normalizeState(raw, strict = true) {
    if (!raw || typeof raw !== "object" || !Array.isArray(raw.categories) || !Array.isArray(raw.items)) {
      throw new Error("ملف البيانات غير صالح.");
    }
    const rawCats = raw.categories.filter(c => c && typeof c === "object"), rawItems = raw.items.filter(it => it && typeof it === "object");   /* عنصر تالف لا يُسقط باقي البيانات السليمة */
    const categories = rawCats.map((c, i) => ({
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
    const modelOn = !!(raw.seeds && raw.seeds.purchaseRecords === true);   /* ملف/حالة بعد سجل المشتريات: الكمية مشتقة من العمليات */
    const usedPurchaseIds = new Set();
    const items = rawItems.map((it, i) => {
      let required = Number(it.required), purchased = Number(it.purchased);
      let purchases = null, legacy = null;
      if (modelOn || Array.isArray(it.purchases) || (it.legacy && typeof it.legacy === "object")) {
        const itemLabel = it.name || i + 1;
        purchases = (Array.isArray(it.purchases) ? it.purchases : []).filter(r => r && typeof r === "object").map((r, j) => {
          let rec;
          try { rec = P().cleanPurchase(r, strict); } catch (e) { throw new Error(`عملية شراء في البند "${itemLabel}": ${e.message}`); }
          let id = rec.id || `pur-import-${i}-${j}`;
          while (usedPurchaseIds.has(id)) id += "-d";               /* معرّف مكرر لا يُسقط عملية */
          usedPurchaseIds.add(id); rec.id = id; return rec;
        });
        const lg = it.legacy && typeof it.legacy === "object" ? it.legacy : null;
        const lq = lg ? Math.floor(Number(lg.qty)) : 0;
        if (lg && Number.isFinite(lq) && lq > 0) legacy = { qty: lq, unitPrice: priceOk(lg.unitPrice) ? Math.round(Number(lg.unitPrice) * 100) / 100 : null };
        else if (lg && strict && Number(lg.qty) && !(Number.isFinite(lq) && lq >= 0)) throw new Error(`بيانات الشراء السابقة للبند "${itemLabel}" غير صحيحة.`);
        if (!Array.isArray(it.purchases) && !legacy && Number.isFinite(purchased) && purchased > 0) {   /* بند بلا سجل لكن بكمية (ملف قديم داخل حالة جديدة): لا نفقد الكمية */
          legacy = { qty: Math.round(purchased), unitPrice: priceOk(it.unitPrice) ? Number(it.unitPrice) : null };
        }
        purchased = (legacy ? legacy.qty : 0) + purchases.reduce((a, r) => a + r.qty, 0);
      }
      const price = it.unitPrice === null || it.unitPrice === "" || it.unitPrice === undefined ? null : Number(it.unitPrice);
      const label = it.name || i + 1;
      let categoryId = String(it.categoryId);
      if (!catIds.has(categoryId)) {
        if (strict) throw new Error(`البند "${label}" مرتبط بفئة غير موجودة.`);
        if (!catIds.has(FALLBACK_CAT.id)) { categories.push({ ...FALLBACK_CAT, sortOrder: categories.length + 1, icon: "box", description: "", budget: null }); catIds.add(FALLBACK_CAT.id); }
        categoryId = FALLBACK_CAT.id;
      }
      const excessOk = purchases !== null;   /* بعد سجل المشتريات: الزيادة عن المطلوب مسموحة (تُعرض كزيادة) ولا تُحذف عمليات */
      if (!Number.isInteger(required) || required < 0 || !Number.isInteger(purchased) || purchased < 0 || (!excessOk && purchased > required)) {
        if (strict) throw new Error(`كميات البند "${label}" غير صحيحة.`);
        required = Number.isFinite(required) && required > 0 ? Math.round(required) : 0;
        purchased = Number.isFinite(purchased) && purchased > 0 ? Math.round(purchased) : 0;
        if (!excessOk) purchased = Math.min(purchased, required);
      }
      let unitPrice = price;
      if (price !== null && (!Number.isFinite(price) || price < 0)) {
        if (strict) throw new Error(`سعر البند "${label}" غير صحيح.`);
        unitPrice = null;
      }
      let status = ["missing", "preparing", "complete"].includes(it.status) ? it.status : "missing";
      if (purchased >= required && required > 0) status = "complete";
      else if (purchased > 0 || status === "preparing") status = "preparing";
      else status = "missing";
      return {
        id: String(it.id || `item-import-${i}`), categoryId,
        name: String(it.name || "بند بدون اسم").slice(0, 100), unit: String(it.unit || "قطعة").slice(0, 25),
        required, purchased, unitPrice, status, notes: String(it.notes || "").slice(0, 500),
        ...(purchases !== null ? { purchases, legacy } : {}),
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
      seeds: raw.seeds && typeof raw.seeds === "object" ? { rafayea: raw.seeds.rafayea === true, catalogV5: raw.seeds.catalogV5 === true, catalogV7: raw.seeds.catalogV7 === true, catalogV8: raw.seeds.catalogV8 === true, purchaseRecords: raw.seeds.purchaseRecords === true } : {},
      legacyHoneymoon: cleanArchive(raw.legacyHoneymoon),
      mergedItems: cleanMap(raw.mergedItems), migrationLog: cleanJson(raw.migrationLog)
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
      let migratedV8 = null;
      if (!deferred && !next.seeds.catalogV8) {
        /* v8: نسخة احتياطية أولًا (لا تُستبدل لو كانت موجودة)، ثم التنفيذ على نسخة معزولة؛ أي خطأ = تبقى البيانات كما كانت وتتكرر المحاولة لاحقًا */
        if (writeBackup(BACKUP_V8_KEY, raw, false)) {
          try { const work = clone(next); migratedV8 = applyCatalogV8(work, rawBudgetMap(parsed)); if (migratedV8) Object.assign(next, work); }
          catch (e) { console.error("تعذر ترحيل v8، بقيت البيانات كما هي:", e); migratedV8 = null; migrationNotice = { failed: true, v8Failed: true, reason: String(e && e.message || e).slice(0, 120) }; }
        } else { deferred = true; migrationNotice = { failed: true }; }
      }
      let migratedV9 = null;
      if (!deferred && !next.seeds.purchaseRecords) {
        /* v9: نسخة احتياطية من الحالة الأصلية أولًا (لا تُستبدل لو كانت موجودة) → التنفيذ على نسخة معزولة → التحقق → ثم الحفظ.
           أي خطأ = تبقى البيانات كما كانت في المتصفح وتتكرر المحاولة عند فتح الصفحة لاحقًا. */
        if (writeBackup(BACKUP_V9_KEY, raw, false)) {
          try { const work = clone(next); migratedV9 = applyPurchaseRecordsV1(work); if (migratedV9) Object.assign(next, work); }
          catch (e) { console.error("تعذر ترحيل سجل المشتريات، بقيت البيانات كما هي:", e); migratedV9 = null; migrationNotice = { failed: true, v9Failed: true, reason: String(e && e.message || e).slice(0, 120) }; deferred = true; }
        } else { deferred = true; migrationNotice = { failed: true }; }
      }
      if (migrated || migratedV7 || migratedV8 || migratedV9) migrationNotice = { ...(migrated || {}), ...(migratedV7 ? { v7: migratedV7 } : {}), ...(migratedV8 ? { v8: migratedV8 } : {}), ...(migratedV9 ? { v9: migratedV9 } : {}) };
      next.items.forEach(it => { if (Array.isArray(it.purchases)) syncDerived(it); });
      const needsSave = oldSchema < SCHEMA || seeded || !!migrated || !!migratedV7 || !!migratedV8 || !!migratedV9;
      if (needsSave && !deferred) {
        const json = JSON.stringify(next);
        try {
          if (oldSchema < 4) writeBackup(STORAGE_KEY + ".pre-v4-backup", raw);
          if (oldSchema < 3) writeBackup(STORAGE_KEY + ".pre-v3-backup", raw);
          if (oldSchema < 2) writeBackup(STORAGE_KEY + ".pre-v2-backup", raw);
          localStorage.setItem(STORAGE_KEY, json);
          if (localStorage.getItem(STORAGE_KEY) !== json) throw new Error("verify");   /* قراءة تأكيدية: لو لم يُحفظ كما هو نعيد الأصل */
        } catch (e) {
          console.error(e);
          try { if (localStorage.getItem(STORAGE_KEY) !== raw) localStorage.setItem(STORAGE_KEY, raw); } catch (e2) { /* الأصل لم يُمسّ أو تعذر الاسترجاع: النسخة الاحتياطية موجودة */ }
          migrationNotice = { ...(migrationNotice || {}), failed: true, saveFailed: true };
        }
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
  /* بيانات لم تُرحَّل بعد (ترحيل مؤجَّل بسبب امتلاء المساحة مثلًا): نرحّلها هنا قبل أي كتابة تخص المشتريات حتى لا تضيع الكمية القديمة. */
  function ensureModel() {
    if (state.seeds && state.seeds.purchaseRecords) return;
    writeBackup(BACKUP_V9_KEY, JSON.stringify(state), false);
    applyPurchaseRecordsV1(state);
  }
  function readPurchaseImage(id) {
    try { const o = JSON.parse(localStorage.getItem(PIMG_PREFIX + id) || "null"); return o && typeof o.dataUrl === "string" && IMG_RE.test(o.dataUrl) ? o.dataUrl : null; } catch (e) { return null; }
  }
  function removePurchaseImage(id) { try { localStorage.removeItem(PIMG_PREFIX + id); } catch (e) { /* ignore */ } }
  function allImageKeys() { const out = []; try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(PIMG_PREFIX)) out.push(k); } } catch (e) { /* ignore */ } return out; }
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
    resolveCategoryId: id => CATEGORY_ALIASES[id] || id,
    getMigrationLog() { return state.migrationLog ? clone(state.migrationLog) : null; },
    getLegacyHoneymoon() { return state.legacyHoneymoon ? clone(state.legacyHoneymoon) : null; },
    clearLegacyHoneymoon() { commit(() => { state.legacyHoneymoon = null; }, "تعذر حفظ التغيير."); },
    getPreV5Backup() { try { return localStorage.getItem(BACKUP_V5_KEY); } catch (e) { return null; } },
    getPreV9Backup() { try { return localStorage.getItem(BACKUP_V9_KEY); } catch (e) { return null; } },
    getPreV8Backup() { try { return localStorage.getItem(BACKUP_V8_KEY); } catch (e) { return null; } },
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
    /* الكمية المشتراة لم تعد حقلًا يُدخل يدويًا: تُشتق من سجل المشتريات (انظري addPurchase). */
    addItem(data) {
      const item = this.validateItem(data);
      return commit(() => {
        ensureModel();
        item.id = createId("item");
        item.createdAt = item.updatedAt = new Date().toISOString();
        item.sortOrder = state.items.reduce((m, it) => Math.max(m, Number(it.sortOrder) || 0), 0) + 1;
        item.purchased = 0; item.purchases = []; item.legacy = null;
        state.items.push(item);
        return clone(item);
      });
    },
    updateItem(id, data) {
      const index = state.items.findIndex(it => it.id === id);
      if (index < 0) throw new Error("البند غير موجود.");
      const item = this.validateItem(data);
      return commit(() => {
        ensureModel();
        const prev = state.items[index];
        const next = { ...prev, ...item, id, updatedAt: new Date().toISOString() };   /* purchases/legacy/purchased تبقى من البند السابق */
        if (prev.categoryId !== item.categoryId) next.group = "";   /* التقسيم الفرعي يخص الفئة الأصلية فقط */
        /* خفض المطلوب عن المشترى لا يحذف عمليات ولا يقلل كمياتها: تظهر «زيادة عن المطلوب» */
        next.status = item.status === "preparing" && boughtQty(next) === 0 ? "preparing" : "missing";
        state.items[index] = syncDerived(next);
        return clone(state.items[index]);
      });
    },
    validateItem(data) {
      const name = String(data.name || "").trim();
      if (!name) throw new Error("اكتبي اسم البند.");
      if (!state.categories.some(c => c.id === data.categoryId)) throw new Error("اختاري فئة صحيحة.");
      const required = Number(data.required);
      if (!Number.isInteger(required) || required < 0) throw new Error("الكمية المطلوبة لازم تكون رقمًا صحيحًا يساوي صفر أو أكبر.");
      const unitPrice = data.unitPrice === "" || data.unitPrice === null || data.unitPrice === undefined ? null : Number(data.unitPrice);
      if (unitPrice !== null && (!Number.isFinite(unitPrice) || unitPrice < 0)) throw new Error("سعر الوحدة لازم يكون صفر أو أكبر.");
      return {
        name: name.slice(0, 100), categoryId: data.categoryId,
        unit: String(data.unit || "قطعة").trim().slice(0, 25) || "قطعة",
        required, unitPrice, status: data.status === "preparing" ? "preparing" : "missing", notes: String(data.notes || "").trim().slice(0, 500)
      };
    },
    deleteItem(id) {
      const doomed = state.items.find(it => it.id === id);
      const imgIds = doomed && Array.isArray(doomed.purchases) ? doomed.purchases.filter(r => r.hasImage).map(r => r.id) : [];
      commit(() => { state.items = state.items.filter(it => it.id !== id); }, "تعذر حفظ التغيير.");
      imgIds.forEach(removePurchaseImage);
    },

    /* ---------- سجل المشتريات ---------- */
    getPurchases(itemId) { const it = state.items.find(x => x.id === itemId); return it && Array.isArray(it.purchases) ? clone(it.purchases) : []; },
    /* عملية جديدة: تُرفض لو تجاوزت الكمية المتبقية (السبب يُشرح لها). السعر الفارغ = غير مسجل، والصفر = مسجل صفرًا. */
    addPurchase(itemId, data) {
      return commit(() => {
        ensureModel();
        const item = state.items.find(it => it.id === itemId); if (!item) throw new Error("البند غير موجود.");
        const rec = P().cleanPurchase({ ...data, id: "", hasImage: false }, true);
        const left = Math.max(0, item.required - boughtQty(item));
        if (rec.qty > left) throw new Error(left === 0 ? "الكمية المطلوبة من هذا البند اتسجلت كلها. لو اشتريتِ أكثر، ارفعي «الكمية المطلوبة» الأول." : `المتبقي من هذا البند ${left} فقط، فلا يمكن تسجيل كمية أكبر منه. لو اشتريتِ أكثر، ارفعي «الكمية المطلوبة» الأول.`);
        rec.id = createId("pur"); rec.createdAt = rec.updatedAt = new Date().toISOString();
        item.purchases.push(rec); item.updatedAt = rec.updatedAt; syncDerived(item);
        return clone(rec);
      });
    },
    /* تعديل عملية واحدة فقط؛ بقية العمليات لا تُلمس. زيادة الكمية لا تتجاوز المطلوب؛ تقليلها أو تعديل غيرها مسموح دائمًا (حتى مع وجود زيادة). */
    updatePurchase(itemId, purchaseId, data) {
      return commit(() => {
        ensureModel();
        const item = state.items.find(it => it.id === itemId); if (!item) throw new Error("البند غير موجود.");
        const idx = item.purchases.findIndex(r => r.id === purchaseId); if (idx < 0) throw new Error("عملية الشراء غير موجودة.");
        const old = item.purchases[idx];
        const rec = P().cleanPurchase({ ...old, ...data, id: old.id, hasImage: old.hasImage }, true);
        const newTotal = boughtQty(item) - old.qty + rec.qty;
        if (rec.qty > old.qty && newTotal > item.required) throw new Error(`لا يمكن رفع الكمية لأن إجمالي المشترى سيتجاوز المطلوب (${item.required}). ارفعي «الكمية المطلوبة» الأول.`);
        rec.createdAt = old.createdAt; rec.updatedAt = new Date().toISOString();
        item.purchases[idx] = rec; item.updatedAt = rec.updatedAt; syncDerived(item);
        return clone(rec);
      });
    },
    deletePurchase(itemId, purchaseId) {
      let had = false;
      commit(() => {
        ensureModel();
        const item = state.items.find(it => it.id === itemId); if (!item) throw new Error("البند غير موجود.");
        const rec = item.purchases.find(r => r.id === purchaseId); if (!rec) throw new Error("عملية الشراء غير موجودة.");
        had = rec.hasImage;
        item.purchases = item.purchases.filter(r => r.id !== purchaseId); item.updatedAt = new Date().toISOString(); syncDerived(item);
      }, "تعذر حفظ التغيير.");
      if (had) removePurchaseImage(purchaseId);
    },
    /* الصورة اختيارية ومنفصلة: تُحفظ أولًا في مفتاحها، ثم يُعلَّم السجل. لو فشلت بقيت العملية محفوظة كما هي. */
    getPurchaseImage(purchaseId) { return readPurchaseImage(purchaseId); },
    setPurchaseImage(itemId, purchaseId, dataUrl) {
      if (!IMG_RE.test(dataUrl || "")) throw new Error("الصورة غير صالحة.");
      if (dataUrl.length > PIMG_MAX) throw new Error("الصورة لسه كبيرة بعد التصغير. اختاري صورة أبسط أو أصغر.");
      const item = state.items.find(it => it.id === itemId), rec = item && item.purchases.find(r => r.id === purchaseId);
      if (!rec) throw new Error("عملية الشراء غير موجودة.");
      const prevImg = readPurchaseImage(purchaseId);
      try { localStorage.setItem(PIMG_PREFIX + purchaseId, JSON.stringify({ dataUrl, savedAt: new Date().toISOString() })); }
      catch (error) { throw new Error(error && (error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014) ? "مساحة تخزين المتصفح ممتلئة، فلم نقدر نحفظ الصورة. العملية نفسها اتحفظت وبياناتك زي ما هي." : "تعذر حفظ الصورة في المتصفح. العملية نفسها اتحفظت."); }
      try { commit(() => { const it2 = state.items.find(it => it.id === itemId); it2.purchases.find(r => r.id === purchaseId).hasImage = true; }, "تعذر حفظ التغيير."); }
      catch (e) { if (prevImg) { try { localStorage.setItem(PIMG_PREFIX + purchaseId, JSON.stringify(prevImg)); } catch (e2) { /* ignore */ } } else removePurchaseImage(purchaseId); throw e; }
    },
    clearPurchaseImage(itemId, purchaseId) {
      commit(() => { const it = state.items.find(x => x.id === itemId), rec = it && it.purchases.find(r => r.id === purchaseId); if (rec) rec.hasImage = false; }, "تعذر حفظ التغيير.");
      removePurchaseImage(purchaseId);
    },
    deleteCategory(id) {
      if (state.items.some(it => it.categoryId === id)) throw new Error("انقلي أو احذفي البنود الموجودة داخل الفئة الأول.");
      commit(() => { state.categories = state.categories.filter(c => c.id !== id); }, "تعذر حفظ التغيير.");
    },
    exportData() {
      const out = { ...clone(state), exportedAt: new Date().toISOString(), app: "Bride List" };
      const img = this.getHeroImage();                    /* لا يفشل التصدير بسبب صورة كبيرة: نتجاوزها إن زادت عن الحد */
      if (img && img.dataUrl.length <= IMAGE_EXPORT_MAX) out.heroImage = img.dataUrl;
      out.tipsDone = Object.keys(this.getTipsDone());
      /* صور المشتريات: تُضمَّن ضمن حدود الحجم؛ ما زاد عنها يُستبعد (وتُحصى) ولا يفشل التصدير بسببها */
      const images = {}; let total = 0, omitted = 0;
      state.items.forEach(it => (it.purchases || []).forEach(r => {
        if (!r.hasImage) return;
        const d = readPurchaseImage(r.id);
        if (d && d.length <= PIMG_EXPORT_EACH && total + d.length <= PIMG_EXPORT_TOTAL) { images[r.id] = d; total += d.length; } else omitted++;
      }));
      if (Object.keys(images).length) out.purchaseImages = images;
      if (omitted) out.purchaseImagesOmitted = omitted;
      return JSON.stringify(out, null, 2);
    },
    importData(raw) {
      const next = normalizeState(raw, true);
      applySeeds(next);
      applyCatalogV5(next);   /* ملف قديم يُحدَّث لنفس الفئات الجديدة؛ والملف الجديد (العلامة موجودة) لا يتغير */
      applyCatalogV7(next);   /* ملف قديم فيه «شنطة شهر العسل»: يُرحَّل بنفس القواعد الآمنة */
      applyCatalogV8(next, rawBudgetMap(raw));   /* ملف قديم فيه الفئتان: تُدمجان مرة واحدة فقط؛ الملف الجديد (العلامة موجودة) لا يتغير */
      applyPurchaseRecordsV1(next);   /* ملف قديم قبل سجل المشتريات: الكميات تُحفظ كبيانات سابقة غير مفصلة، والملف الجديد (العلامة موجودة) لا يتغير */
      next.items.forEach(it => { if (Array.isArray(it.purchases)) syncDerived(it); });
      writeBackup(STORAGE_KEY + ".pre-import-backup", JSON.stringify(state), true);   /* أمان إضافي قبل الاستبدال */
      commit(() => { state = next; }, "تعذر حفظ النسخة المستوردة في المتصفح.");
      /* صور المشتريات: نستعيد المطابق لمعرّفات العمليات فقط، ثم ننظف صور العمليات القديمة التي لم تعد موجودة */
      const keep = new Set(); let restored = 0, failed = 0;
      state.items.forEach(it => (it.purchases || []).forEach(r => {
        if (!r.hasImage) return;
        const d = raw.purchaseImages && typeof raw.purchaseImages === "object" ? raw.purchaseImages[r.id] : null;
        if (typeof d === "string" && d.length <= PIMG_MAX && IMG_RE.test(d)) {
          try { localStorage.setItem(PIMG_PREFIX + r.id, JSON.stringify({ dataUrl: d, savedAt: new Date().toISOString() })); keep.add(r.id); restored++; } catch (e) { failed++; }
        } else if (readPurchaseImage(r.id)) keep.add(r.id); else failed++;
      }));
      allImageKeys().forEach(k => { if (!keep.has(k.slice(PIMG_PREFIX.length))) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } } });
      if (failed) { try { commit(() => { state.items.forEach(it => (it.purchases || []).forEach(r => { if (r.hasImage && !keep.has(r.id)) r.hasImage = false; })); }, "x"); } catch (e) { /* ignore */ } }
      this._lastImport = { imagesRestored: restored, imagesMissing: failed };
      if (Array.isArray(raw.tipsDone)) {
        const ids = raw.tipsDone.filter(id => typeof id === "string" && /^[a-z0-9-]{1,40}$/.test(id));
        try { localStorage.removeItem(TIPS_KEY); this.setTipsDone(ids, true); } catch (e) { /* اختياري */ }
      }
      if (typeof raw.heroImage === "string" && raw.heroImage.length <= IMAGE_EXPORT_MAX && IMG_RE.test(raw.heroImage)) {
        try { this.setHeroImage(raw.heroImage); } catch (e) { /* الصورة اختيارية: تبقى البيانات سليمة */ }
      }
    },
    getLastImportInfo() { return this._lastImport ? { ...this._lastImport } : { imagesRestored: 0, imagesMissing: 0 }; },
    reset() { commit(() => { state = makeInitialState(); }, "تعذر إعادة ضبط البيانات."); allImageKeys().forEach(k => { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }); this.clearHeroImage(); try { localStorage.removeItem(TIPS_KEY); } catch (e) { /* ignore */ } }
  };
})();
