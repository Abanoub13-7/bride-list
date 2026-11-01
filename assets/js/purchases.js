/* سجل المشتريات: أنواع التفاصيل (حقول ذكية حسب نوع البند) + التحقق من صحة عملية الشراء.
   وحدة نقية: لا تلمس التخزين ولا الواجهة. الحسابات في calc.js، والحفظ في storage.js.
   لإضافة نوع جديد مستقبلًا: أضيفي مفتاحًا في TYPES (وكلمات تعريفه في HINTS إن لزم) — لا حاجة لأي ترحيل، لأن التفاصيل تُحفظ
   كأزواج «مفتاح: قيمة» داخل كل عملية ولا تتأثر بإضافة الأنواع. */
(() => {
  /* أنواع الحقول: text | number | date | select(options) */
  const f = (key, label, kind = "text", extra = {}) => ({ key, label, kind, ...extra });
  const TYPES = {
    general:   { label: "عام", fields: [f("kind", "النوع"), f("color", "اللون"), f("brand", "الماركة"), f("size", "الحجم أو المقاس")] },
    bedding:   { label: "مفروشات وأطقم سرير", fields: [f("color", "اللون"), f("material", "الخامة"), f("size", "المقاس"), f("pattern", "النقشة أو التصميم"), f("pieces", "عدد القطع", "number"), f("brand", "الماركة")] },
    towels:    { label: "فوط وبشاكير", fields: [f("color", "اللون"), f("material", "الخامة"), f("size", "المقاس"), f("kind", "النوع"), f("pieces", "عدد القطع", "number")] },
    appliance: { label: "أجهزة كهربائية", fields: [f("brand", "الماركة"), f("model", "الموديل"), f("color", "اللون"), f("specs", "القدرة أو المواصفات"), f("warranty", "الضمان", "select", { options: ["يوجد ضمان", "لا يوجد ضمان"] }), f("warrantyMonths", "مدة الضمان (بالشهور)", "number"), f("warrantyStart", "بداية الضمان", "date")] },
    cookware:  { label: "أدوات مطبخ وحلل وأواني", fields: [f("material", "الخامة"), f("size", "الحجم أو المقاس"), f("color", "اللون"), f("kind", "النوع"), f("pieces", "عدد القطع", "number"), f("brand", "الماركة")] },
    clothing:  { label: "ملابس", fields: [f("color", "اللون"), f("size", "المقاس"), f("material", "الخامة"), f("kind", "النوع"), f("brand", "الماركة")] },
    beauty:    { label: "تجميل وعناية شخصية", fields: [f("brand", "الماركة"), f("kind", "النوع"), f("size", "الحجم"), f("color", "اللون"), f("expiry", "تاريخ الصلاحية", "date")] }
  };
  const TYPE_KEYS = Object.keys(TYPES);

  /* ١) تعريف النوع من «فئة الكتالوج + مجموعته» أولًا (الأقوى، لأنها معرّفات ثابتة وليست تخمينًا من الاسم). */
  const CATEGORY_TYPE = { furnishings: "bedding", appliances: "appliance", rafayea: "cookware", niche: "cookware", clothes: "clothing", personal: "beauty", pantry: "general", cleaning: "general", "home-setup": "general" };
  const GROUP_TYPE = { "الفوط ومفروشات الحمام": "towels" };
  const catKeyOf = id => (id === "cat-rafayea" ? "rafayea" : String(id || "").startsWith("cat-v5-") ? String(id).slice(7) : "");

  /* ٢) فئات المستخدمة وبنودها المضافة: لا نخمّن من الاسم وحده. نستخدم كلمات صريحة، وإن تطابق أكثر من نوع أو لم يتطابق شيء → «عام». */
  const HINTS = {
    towels: /فوط|فوطة|بشكير|بشاكير|برنس/,
    bedding: /ملاي|مفرش|مفارش|لحاف|لحف|مخدة|مخدات|سرير|مرتبة|بطانية|ستائر|ستارة|سجاد/,
    appliance: /ثلاجة|غسالة|بوتاجاز|ديب فريزر|مكنسة|مكواة|ميكروويف|خلاط|كبة|سشوار|تكييف|شاشة|تلفزيون|غلاية|توستر|قلاية|مروحة|سخان/,
    cookware: /حلة|حلل|طقم صواني|طواجن|قدر|مقلاة|طنجرة|صواني|أطباق|اطباق|كاسات|شوك|معالق|سكاكين/,
    clothing: /بلوزة|بلوزات|فستان|بنطلون|جاكيت|جواكت|قميص|عباية|حذاء|أحذية|شنطة ملابس|بيجامة|بيجامات|تيشرت|جيبة/,
    beauty: /شامبو|بلسم|سيرم|كريم|مكياج|برفيوم|عطر|غسول|مرطب|روج|ماسكارا/
  };
  const weakType = text => {
    const hits = TYPE_KEYS.filter(k => HINTS[k] && HINTS[k].test(String(text || "")));
    return hits.length === 1 ? hits[0] : "general";
  };
  function resolveType(item, category) {
    const ck = catKeyOf(category && category.id);
    if (ck && CATEGORY_TYPE[ck]) return (item && GROUP_TYPE[item.group]) || CATEGORY_TYPE[ck];
    return weakType(`${category ? category.name : ""} ${item ? item.name : ""}`);
  }
  const fieldsFor = type => (TYPES[type] || TYPES.general).fields;
  const typeLabel = type => (TYPES[type] || TYPES.general).label;

  /* تسميات المفاتيح المعروفة لعرض تفاصيل عملية قديمة بأي نوع (حتى لو تغيّر تعريف النوع لاحقًا) */
  const LABELS = {}; TYPE_KEYS.forEach(k => TYPES[k].fields.forEach(fd => { LABELS[fd.key] = LABELS[fd.key] || fd.label; }));

  const LIMITS = { qtyMax: 100000, priceMax: 1e9, text: 120, store: 80, notes: 500, customLabel: 60, customValue: 200, customMax: 100, detailKeys: 40 };
  const isValidDate = v => {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ""); if (!m) return false;
    const d = new Date(+m[1], +m[2] - 1, +m[3]);
    return d.getFullYear() === +m[1] && d.getMonth() === +m[2] - 1 && d.getDate() === +m[3];
  };
  const str = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);

  /* التحقق من عملية شراء. strict=true (إدخال المستخدمة والاستيراد): يرمي رسالة عربية واضحة عند أي قيمة غير صالحة.
     strict=false (قراءة من المتصفح): يصلح بدل أن يفقد (لا تسقط بقية العمليات). */
  function cleanPurchase(raw, strict = true) {
    if (!raw || typeof raw !== "object") throw new Error("عملية الشراء غير صالحة.");
    const err = m => { throw new Error(m); };
    let qty = Number(raw.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > LIMITS.qtyMax) { if (strict) err("الكمية لازم تكون رقمًا صحيحًا أكبر من صفر."); qty = Number.isFinite(qty) ? Math.min(LIMITS.qtyMax, Math.max(1, Math.round(qty))) : 1; }
    let totalPrice = null;
    if (!(raw.totalPrice === null || raw.totalPrice === undefined || raw.totalPrice === "")) {
      const p = Number(raw.totalPrice);
      if (!Number.isFinite(p) || p < 0 || p > LIMITS.priceMax) { if (strict) err("إجمالي السعر لازم يكون صفرًا أو أكبر (أو اتركيه فارغًا لو لا تريدين تسجيل السعر)."); }
      else totalPrice = Math.round(p * 100) / 100;
    }
    let date = str(raw.date, 10);
    if (date && !isValidDate(date)) { if (strict) err("راجعي تاريخ الشراء."); date = ""; }
    const details = {};
    if (raw.details && typeof raw.details === "object" && !Array.isArray(raw.details)) {
      Object.keys(raw.details).slice(0, LIMITS.detailKeys).forEach(k => {
        if (!/^[a-zA-Z][a-zA-Z0-9]{0,30}$/.test(k)) return;
        const v = str(raw.details[k], LIMITS.text); if (v) details[k] = v;
      });
    }
    const custom = [];
    if (Array.isArray(raw.custom)) {
      raw.custom.forEach((c, i) => {
        if (!c || typeof c !== "object") return;
        const label = str(c.label, LIMITS.customLabel), value = str(c.value, LIMITS.customValue);
        if (!label && !value) return;                                  /* سطر فارغ تمامًا يُتجاهل */
        if (!label) { if (strict) err("اكتبي اسم التفصيلة المخصصة."); return; }
        if (custom.length >= LIMITS.customMax) { if (strict) err(`الحد الأقصى ${LIMITS.customMax} تفصيلة مخصصة للعملية.`); return; }
        custom.push({ id: str(c.id, 40) || `cf-${i + 1}`, label, value });
      });
    }
    const type = TYPES[raw.type] ? raw.type : (/^[a-z][a-zA-Z0-9-]{0,30}$/.test(String(raw.type || "")) ? String(raw.type) : "general");
    return {
      id: str(raw.id, 80), qty, totalPrice, date, store: str(raw.store, LIMITS.store), notes: str(raw.notes, LIMITS.notes),
      type, details, custom, hasImage: raw.hasImage === true,
      createdAt: str(raw.createdAt, 40), updatedAt: str(raw.updatedAt, 40)
    };
  }
  /* سعر الوحدة للعرض = الإجمالي ÷ الكمية (null لو السعر غير مسجل أو الكمية غير صالحة) */
  const unitPriceOf = r => (r && r.totalPrice !== null && r.totalPrice !== undefined && Number.isFinite(Number(r.totalPrice)) && Number(r.qty) > 0 ? Math.round((Number(r.totalPrice) / Number(r.qty)) * 100) / 100 : null);

  window.BridePurchases = { TYPES, TYPE_KEYS, LIMITS, LABELS, resolveType, fieldsFor, typeLabel, cleanPurchase, unitPriceOf, isValidDate };
})();
