/* Local data layer: no server, account, or network requests. */
(() => {
  const STORAGE_KEY = "brideListApp.v1";
  /* معرّفات الفئات الافتراضية القديمة (قبل تحديث الفئات). تُحذف مرة واحدة فقط عند الترحيل، بعد أخذ نسخة احتياطية.
     فئة «الرفايع» والفئات التي أنشأها المستخدم بنفسه لا تُحذف أبدًا. */
  const LEGACY_DEFAULT_CAT_IDS = ["cat-bedroom", "cat-kitchen", "cat-appliances", "cat-bathroom", "cat-linen", "cat-clothes", "cat-personal", "cat-other"];
  const clone = value => JSON.parse(JSON.stringify(value));
  const SCHEMA = 5;
  const IMAGE_KEY = STORAGE_KEY + ".heroImage";          /* الصورة المخصصة منفصلة عن بيانات القائمة */
  const TIPS_KEY = STORAGE_KEY + ".tips";             /* حالة قوائم النصائح الذهبية: مفتاح مستقل لا يؤثر على بنود القائمة */
  const BACKUP_V5_KEY = STORAGE_KEY + ".pre-v5-backup";  /* نسخة البيانات قبل تحديث الفئات */
  const IMAGE_EXPORT_MAX = 700 * 1024;                   /* أقصى حجم للصورة داخل ملف التصدير */
  const IMG_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+\/=]+$/;
  /* الميزانية: null = غير محددة (ليست صفرًا) */
  const cleanBudget = v => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) || Number(v) < 0) ? null : Math.round(Number(v) * 100) / 100;
  const ICON_KEYS = ["auto","bed","kitchen","appliance","drop","curtain","hanger","flower","box","heart","gift","bag","home","star","sparkles","pot","cup","basket","plane"];
  const FALLBACK_CAT = { id: "cat-recovered", name: "بنود بدون فئة" };


  /* ---------- اسم العروسة + فئة «الرفايع» ----------
     البذور (Seeds) تُطبَّق مرة واحدة فقط لكل مستخدم (العلامة state.seeds.rafayea)،
     فلا تتكرر الفئة أو البنود عند التحديث، ولا تعود بنود حذفها المستخدم. */
  /* الاسم الظاهر الافتراضي (مؤقت): يُغيَّر من هنا فقط، أو من الإعدادات لكل مستخدمة. */
  const DEFAULT_BRIDE_NAME = "عروسة";
  const LEGACY_DEFAULT_NAME_RE = /^[چج]يسي$/;   /* الاسم الافتراضي القديم؛ يُستبدل مرة واحدة عند الترحيل */
  const RAFAYEA = {
    id: "cat-rafayea", name: "الرفايع", icon: "pot",
    description: "أدوات المطبخ الصغيرة ومستلزمات الطهي والتقديم"
  };
  /* [الاسم، الوحدة، الكمية المطلوبة، الملاحظات] — الكمية 1 كبداية وتُعدَّل من داخل التطبيق */
  const RAFAYEA_ITEMS = [
    ["طقم صواني فرن", "طقم", 1, "مستطيل / مدور"],
    ["طقم طواجن فرن", "طقم", 1, "بايركس أو فخار"],
    ["طقم مقالي", "طقم", 1, "تيفال - جرانيت، أحجام مختلفة"],
    ["كنك قهوة", "قطعة", 1, "ألومنيوم - جرانيت، أحجام مختلفة"],
    ["علب ثلاجة", "طقم", 1, "أحجام مختلفة"],
    ["ميزان مطبخ رقمي", "قطعة", 1, "مهم للوصفات"],
    ["طقم توزيع", "طقم", 1, "سيليكون - خشب - ألومنيوم"],
    ["فرشة سيليكون", "قطعة", 1, "للزيت"],
    ["بخاخ زيت", "قطعة", 1, "للإير فراير"],
    ["قوالب سيليكون", "طقم", 1, "للإير فراير"],
    ["قوالب سيليكون (كب كيك)", "طقم", 1, ""],
    ["قوالب كيك - إنجلش كيك", "طقم", 1, ""],
    ["نشابة للعجين", "قطعة", 1, ""],
    ["طقم توابل", "طقم", 1, ""],
    ["صفاية أطباق", "قطعة", 1, "للحوض"],
    ["مريلة للمطبخ + جوانتي سيليكون للحرارة", "طقم", 1, ""],
    ["جوانتي غسيل أطباق", "قطعة", 1, ""],
    ["ليف - سلك مواعين ومنظم", "طقم", 1, ""],
    ["صابون سائل", "قطعة", 1, ""],
    ["منظم ثلاجة", "قطعة", 1, ""],
    ["طقم مصافي", "طقم", 1, "للمكرونة والخضار"],
    ["هراسة بطاطس", "قطعة", 1, ""],
    ["قشارة سمك - مقص سمك", "طقم", 1, ""],
    ["قوالب تلج", "قطعة", 1, ""],
    ["علب تخزين بقوليات", "طقم", 1, ""],
    ["طقم سكاكين", "طقم", 1, ""],
    ["مقص مطبخ", "قطعة", 1, ""],
    ["مبشرة", "قطعة", 1, ""],
    ["قشارة", "قطعة", 1, ""],
    ["فتاحة معلبات وزجاجات", "قطعة", 1, ""],
    ["طقم معالق وشوك (استخدام يومي)", "طقم", 1, ""],
    ["طقم معالق وشوك (للضيوف)", "طقم", 1, ""],
    ["مضرب بيض يدوي", "قطعة", 1, ""],
    ["لوح تقطيع", "قطعة", 1, "خشب - بلاستيك - ستانلس"],
    ["منظم درج المعالق", "قطعة", 1, ""],
    ["قمع", "طقم", 1, "أحجام مختلفة"],
    ["مصفاة شاي صغيرة", "قطعة", 1, ""],
    ["عصارة ليمون", "قطعة", 1, ""],
    ["ولاعة بوتاجاز", "قطعة", 1, ""],
    ["مقوار محشي", "قطعة", 1, ""],
    ["مخرطة", "قطعة", 1, ""],
    ["ملاحات", "قطعة", 1, ""],
    ["قطاعة بيتزا", "قطعة", 1, ""],
    ["مقص استانلس", "قطعة", 1, ""],
    ["منخل دقيق", "طقم", 1, "أحجام مختلفة"],
    ["شياطة الأرز", "قطعة", 1, ""],
    ["طبق غويط للعجين", "قطعة", 1, ""],
    ["مدق لحمة", "قطعة", 1, ""],
    ["صفاية معالق", "قطعة", 1, ""],
    ["عليقة للمطبخ", "قطعة", 1, ""],
    ["حامل مناديل المطبخ", "قطعة", 1, ""]
  ];
  /* تطبيع الاسم للمقارنة فقط (لا يغيّر الاسم المحفوظ) */
  const nameKey = v => String(v || "").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه")
    .replace(/[()\[\]\-+،,/\s]+/g, " ").trim().toLocaleLowerCase();

  /* يعدّل الحالة الممرَّرة مباشرة. يرجع true لو تغيّر شيء. */
  function applySeeds(st) {
    let changed = false;
    st.seeds = st.seeds && typeof st.seeds === "object" ? st.seeds : {};
    if (!st.seeds.rafayea) {
      const now = new Date().toISOString();
      let cat = st.categories.find(c => c.id === RAFAYEA.id) || st.categories.find(c => nameKey(c.name) === nameKey(RAFAYEA.name));
      if (!cat) {
        const maxOrder = st.categories.reduce((m, c) => Math.max(m, Number(c.sortOrder) || 0), 0);
        cat = { id: RAFAYEA.id, name: RAFAYEA.name, icon: RAFAYEA.icon, description: RAFAYEA.description, budget: null, sortOrder: maxOrder + 1 };
        st.categories.push(cat);
      }
      const have = new Set(st.items.filter(it => it.categoryId === cat.id).map(it => nameKey(it.name)));
      const usedIds = new Set(st.items.map(it => it.id));
      let order = st.items.reduce((m, it) => Math.max(m, Number(it.sortOrder) || 0), 0);
      RAFAYEA_ITEMS.forEach((row, i) => {
        const key = nameKey(row[0]);
        const id = `item-rafayea-${i + 1}`;
        if (have.has(key) || usedIds.has(id)) return;
        have.add(key); usedIds.add(id);
        st.items.push({
          id, categoryId: cat.id, name: row[0], unit: row[1], required: row[2], purchased: 0, unitPrice: null,
          status: "missing", notes: row[3], sortOrder: ++order, createdAt: now, updatedAt: now
        });
      });
      st.seeds.rafayea = true; changed = true;
    }
    return changed;
  }

  /* ---------- الفئات الجديدة (الترحيل v5) ----------
     يُنفَّذ مرة واحدة فقط لكل مستخدمة (العلامة state.seeds.catalogV5):
       1) يحذف الفئات الافتراضية القديمة (بالمعرّف) وبنودها — بعد أن تكون النسخة الاحتياطية قد حُفظت.
       2) يضيف الفئات الجديدة وبنودها من BrideCatalog دون تكرار.
       3) يُبقي «الرفايع» وكل فئة أنشأتها المستخدمة بنفسها كما هي، ويرتّب الفئات (الجديدة ثم الرفايع ثم الباقي).
       4) يستبدل الاسم الافتراضي القديم المحفوظ في الإعدادات (أي اسم آخر كتبته المستخدمة يبقى كما هو).
     يعدّل الحالة الممرَّرة مباشرة، ويرجع إحصاءات الترحيل أو null لو لم يُنفَّذ. */
  function applyCatalogV5(st) {
    st.seeds = st.seeds && typeof st.seeds === "object" ? st.seeds : {};
    if (st.seeds.catalogV5) return null;
    const catalog = window.BrideCatalog;
    if (!catalog || !Array.isArray(catalog.categories)) return null;   /* بدون الكتالوج لا نحذف شيئًا */
    const stats = { removedCategories: 0, removedItems: 0, addedCategories: 0, addedItems: 0 };
    const protectedIds = new Set([RAFAYEA.id]);
    const removeIds = new Set(st.categories.filter(c => LEGACY_DEFAULT_CAT_IDS.includes(c.id) && !protectedIds.has(c.id)).map(c => c.id));
    const carriedBudgets = new Map();                   /* ميزانية فئة قديمة تنتقل للفئة الجديدة التي تحمل نفس الاسم */
    st.categories.forEach(c => { if (removeIds.has(c.id) && c.budget !== null && c.budget !== undefined) carriedBudgets.set(nameKey(c.name), c.budget); });
    stats.removedCategories = removeIds.size;
    stats.removedItems = st.items.filter(it => removeIds.has(it.categoryId)).length;
    st.categories = st.categories.filter(c => !removeIds.has(c.id));
    st.items = st.items.filter(it => !removeIds.has(it.categoryId));

    const now = new Date().toISOString();
    const usedIds = new Set(st.items.map(it => it.id));
    let order = st.items.reduce((m, it) => Math.max(m, Number(it.sortOrder) || 0), 0);
    const fresh = [];
    catalog.categories.forEach(def => {
      const id = `cat-v5-${def.key}`;
      let cat = st.categories.find(c => c.id === id) || st.categories.find(c => c.id !== RAFAYEA.id && nameKey(c.name) === nameKey(def.name));
      if (!cat) {
        cat = { id, name: def.name, icon: def.icon, description: def.description, budget: carriedBudgets.has(nameKey(def.name)) ? carriedBudgets.get(nameKey(def.name)) : null, sortOrder: 0 };
        st.categories.push(cat); stats.addedCategories++;
      }
      fresh.push(cat);
      const have = new Set(st.items.filter(it => it.categoryId === cat.id).map(it => nameKey(it.name)));
      let n = 0;
      def.groups.forEach(group => group.items.forEach(row => {
        n++;
        const itemId = `item-v5-${def.key}-${n}`, key = nameKey(row[0]);
        if (have.has(key) || usedIds.has(itemId)) return;
        have.add(key); usedIds.add(itemId);
        st.items.push({
          id: itemId, categoryId: cat.id, name: row[0], unit: row[1], required: row[2], purchased: 0, unitPrice: null,
          status: "missing", notes: row[3] || "", group: group.title, sortOrder: ++order, createdAt: now, updatedAt: now
        });
        stats.addedItems++;
      }));
    });
    let so = 0;
    fresh.forEach(c => { c.sortOrder = ++so; });
    const rafayea = st.categories.find(c => c.id === RAFAYEA.id);
    if (rafayea && !fresh.includes(rafayea)) rafayea.sortOrder = ++so;
    st.categories.filter(c => !fresh.includes(c) && c !== rafayea).sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0)).forEach(c => { c.sortOrder = ++so; });

    if (st.profile && LEGACY_DEFAULT_NAME_RE.test(String(st.profile.name || "").trim())) st.profile.name = "";
    st.seeds.catalogV5 = true;
    return stats;
  }

  function makeInitialState() {
    const fresh = {
      version: 1, schema: SCHEMA,
      profile: { name: "", weddingDate: "" },      /* الاسم الفارغ = يظهر الاسم الافتراضي DEFAULT_BRIDE_NAME */
      totalBudget: null, categories: [], items: [], nextId: 1, seeds: {}
    };
    applySeeds(fresh);          /* الرفايع */
    applyCatalogV5(fresh);      /* الفئات الجديدة (ثم تُرتَّب الرفايع بعدها) */
    return fresh;
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
      seeds: raw.seeds && typeof raw.seeds === "object" ? { rafayea: raw.seeds.rafayea === true, catalogV5: raw.seeds.catalogV5 === true } : {}
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
      const seeded = applySeeds(next);   // إضافة «الرفايع» مرة واحدة فقط، دون لمس بيانات المستخدم
      let migrated = null, deferred = false;
      if (!next.seeds.catalogV5) {
        /* الترحيل: النسخة الاحتياطية أولًا. لو تعذر حفظها (مساحة ممتلئة) نترك البيانات كما هي ونعيد المحاولة لاحقًا. */
        if (writeBackup(BACKUP_V5_KEY, raw, true)) migrated = applyCatalogV5(next);
        else { deferred = true; migrationNotice = { failed: true }; }
      }
      if (migrated) migrationNotice = { ...migrated };
      const needsSave = oldSchema < SCHEMA || seeded || !!migrated;
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
