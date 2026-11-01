/* وحدة الحسابات الوحيدة: تُستخدم في الرئيسية والفئات وصفحة الفئة والميزانية. لا تلمس التخزين. */
(() => {
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  /* ---------- سجل المشتريات: مصدر الحقيقة الوحيد للكمية المشتراة والمصروف ----------
     بند بالنظام الجديد: it.purchases = [{qty, totalPrice|null, ...}] + it.legacy = {qty, unitPrice|null} | null
       legacy = «بيانات شراء سابقة غير مفصلة» رُحّلت من النسخة القديمة (كمية وسعر وحدة فقط، بلا تواريخ ولا تفاصيل مخترعة).
     بند بلا it.purchases (بيانات خام قديمة/اختبارات): نعامل it.purchased × it.unitPrice كما كان سابقًا، فلا يتغير أي رقم قديم.
     totalPrice = null  → «سعر غير مسجل» (ليس صفرًا)؛ totalPrice = 0 → سعر مسجل يساوي صفرًا. */
  const hasPurchaseModel = it => Array.isArray(it.purchases);
  const priceKnown = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;
  const qtyOfRec = r => Math.max(0, Math.floor(num(r && r.qty)));
  function purchaseParts(it) {
    if (!hasPurchaseModel(it)) {
      const q = Math.max(0, num(it.purchased)), known = priceKnown(it.unitPrice);
      return q > 0 ? [{ qty: q, total: known ? q * Number(it.unitPrice) : null, legacy: true }] : [];
    }
    const parts = [];
    const lg = it.legacy;
    if (lg && qtyOfRec(lg) > 0) { const q = qtyOfRec(lg); parts.push({ qty: q, total: priceKnown(lg.unitPrice) ? q * Number(lg.unitPrice) : null, legacy: true }); }
    for (const r of it.purchases) { const q = qtyOfRec(r); if (q > 0) parts.push({ qty: q, total: priceKnown(r.totalPrice) ? Number(r.totalPrice) : null, legacy: false }); }
    return parts;
  }
  const purchasedQty = it => purchaseParts(it).reduce((s, p) => s + p.qty, 0);
  /* إنفاق البند: total = مجموع المبالغ المعروفة فقط، unknownQty = كمية بلا سعر مسجل (ليست مجانية) */
  function itemSpend(it) {
    let total = 0, pricedQty = 0, unknownQty = 0, pricedParts = 0;
    for (const p of purchaseParts(it)) { if (p.total === null) unknownQty += p.qty; else { total += p.total; pricedQty += p.qty; pricedParts++; } }
    return { total: Math.round(total * 100) / 100, pricedQty, unknownQty, pricedParts, qty: pricedQty + unknownQty };
  }
  /* ملخص البند الكامل لواجهة بطاقة البند وسجل المشتريات */
  function purchaseSummary(it) {
    const sp = itemSpend(it), required = Math.max(0, num(it.required)), qty = sp.qty;
    const recs = hasPurchaseModel(it) ? it.purchases.length : 0, legacyQty = hasPurchaseModel(it) && it.legacy ? qtyOfRec(it.legacy) : 0;
    return {
      required, purchasedQty: qty, remainingQty: Math.max(0, required - qty), excessQty: Math.max(0, qty - required),
      recordCount: recs, hasLegacy: legacyQty > 0, legacyQty,
      spent: sp.total, hasSpent: sp.pricedParts > 0, unpricedQty: sp.unknownQty,
      avgUnit: sp.pricedQty > 0 ? Math.round((sp.total / sp.pricedQty) * 100) / 100 : null    /* null = «غير متاح» لا صفر مضلل */
    };
  }
  const remaining = it => Math.max(0, num(it.required) - purchasedQty(it));
  const excessQty = it => Math.max(0, purchasedQty(it) - Math.max(0, num(it.required)));

  /* حالة البند تُشتق دائمًا من الكميات (مع استثناء «قيد التجهيز» اليدوي عندما المشترى = 0). */
  function itemStatus(it) {
    const required = Math.max(0, num(it.required)), purchased = Math.max(0, purchasedQty(it));
    if (required > 0 && purchased >= required) return "complete";
    if (purchased > 0) return "preparing";
    return it.status === "preparing" ? "preparing" : "missing";
  }

  /* نسبة الإنجاز = مجموع المشترى ÷ مجموع المطلوب × 100 (0% لو المطلوب صفر). */
  function percentOf(purchased, required) {
    if (required <= 0) return 0;
    if (purchased >= required) return 100;
    return Math.min(99, Math.round((purchased / required) * 100));
  }

  function summarize(items) {
    const out = { total: items.length, complete: 0, preparing: 0, missing: 0, requiredQty: 0, purchasedQty: 0, remainingQty: 0, excessQty: 0, percent: 0 };
    for (const it of items) {
      out[itemStatus(it)]++;
      const req = Math.max(0, num(it.required)), bought = purchasedQty(it);
      out.requiredQty += req;
      out.purchasedQty += Math.min(bought, req);          /* الزيادة عن المطلوب لا ترفع نسبة الإنجاز */
      out.excessQty += Math.max(0, bought - req);
    }
    out.remainingQty = out.requiredQty - out.purchasedQty;
    out.percent = percentOf(out.purchasedQty, out.requiredQty);
    out.incomplete = out.total - out.complete;
    return out;
  }

  /* حالة الفئة كمؤشر بصري */
  function categoryState(sum) {
    if (!sum.total) return "empty";
    if (sum.complete === sum.total) return "complete";
    if (sum.purchasedQty > 0 || sum.preparing > 0) return "preparing";
    return "missing";
  }

  /* التكاليف — كلها من مصدر واحد:
       المصروف (purchasedCost) = مجموع إنفاق سجل المشتريات المسعّر (والبيانات السابقة المرحّلة بسعرها المسجل).
       تقدير الباقي (remainingCost) = الكمية المتبقية × سعر تقديري: سعر وحدة البند التقديري لو محدد، وإلا متوسط سعر ما اشتُري فعلًا، وإلا «غير مسعّر».
       تكلفة القائمة (requiredCost) = المصروف + تقدير الباقي → لا يُحسب أي مبلغ مرتين.
     السعر الصفري سعر مسجَّل؛ الكمية بلا سعر لا تُحسب مجانية بل تجعل الناتج «غير مكتمل». */
  const hasPrice = it => priceKnown(it.unitPrice);
  function estimateUnit(it, sp) {
    if (hasPrice(it)) return Number(it.unitPrice);
    return sp.pricedQty > 0 ? sp.total / sp.pricedQty : null;
  }
  function costs(items) {
    const r = { total: 0, priced: 0, unpriced: 0 }, p = { total: 0, priced: 0, unpriced: 0 }, m = { total: 0, priced: 0, unpriced: 0 };
    for (const it of items) {
      const sp = itemSpend(it), remQty = remaining(it), est = estimateUnit(it, sp);
      p.total += sp.total; if (sp.pricedQty > 0) p.priced++; if (sp.unknownQty > 0) p.unpriced++;
      r.total += sp.total; if (sp.pricedQty > 0) r.priced++; if (sp.unknownQty > 0) r.unpriced++;
      if (remQty > 0) {
        if (est !== null) { m.total += remQty * est; m.priced++; r.total += remQty * est; r.priced = r.priced + (sp.pricedQty > 0 ? 0 : 1); }
        else { m.unpriced++; r.unpriced = r.unpriced + (sp.unknownQty > 0 ? 0 : 1); }
      }
    }
    const fin = o => ({ total: Math.round(o.total * 100) / 100, incomplete: o.unpriced > 0, pricedCount: o.priced, unpricedCount: o.unpriced });
    return { requiredCost: fin(r), purchasedCost: fin(p), remainingCost: fin(m) };
  }

  /* أيام متبقية بالتقويم المحلي (بدون UTC ولا مشاكل التوقيت الصيفي). null = غير محدد/غير صالح */
  function daysUntil(dateStr, now = new Date()) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr || "");
    if (!m) return null;
    const y = +m[1], mo = +m[2], d = +m[3];
    const check = new Date(y, mo - 1, d);
    if (check.getFullYear() !== y || check.getMonth() !== mo - 1 || check.getDate() !== d) return null;
    const target = Date.UTC(y, mo - 1, d);
    const today = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    return Math.round((target - today) / 86400000);
  }


  /* ---------- ميزانيات الفئات ----------
     الميزانية المخصصة ≠ مبلغ مدفوع. null = «لم تُحدد» (ليست صفرًا). */
  const money2 = v => Math.round(num(v) * 100) / 100;
  const isSet = v => v !== null && v !== undefined && v !== "" && Number.isFinite(Number(v)) && Number(v) >= 0;

  /* خطة توزيع الميزانية: تعتمد على الفئات المحددة الميزانية فقط. */
  function budgetPlan(totalBudget, categories) {
    const total = isSet(totalBudget) ? money2(totalBudget) : null;
    const withBudget = categories.filter(c => isSet(c.budget));
    const allocated = money2(withBudget.reduce((s, c) => s + Number(c.budget), 0));
    const plan = {
      total, allocated, setCount: withBudget.length, unsetCount: categories.length - withBudget.length,
      unallocated: 0, overage: 0, percent: null, status: "no-total"
    };
    if (total === null) { plan.status = "no-total"; return plan; }           // الإجمالي غير محدد
    if (total === 0) { plan.status = "zero-total"; plan.overage = allocated; return plan; } // حالة خاصة: لا قسمة على صفر
    plan.percent = Math.round((allocated / total) * 100);
    const diff = money2(total - allocated);
    if (diff > 0) {
      plan.status = plan.setCount === 0 ? "none-set" : "under"; plan.unallocated = diff;
      if (plan.percent >= 100) plan.percent = 99;                              // لا نعرض 100% وفيه مبلغ غير موزع
    } else if (diff < 0) { plan.status = "over"; plan.overage = money2(-diff); }
    else plan.status = "equal";
    return plan;
  }

  /* أرقام فئة واحدة: الميزانية مقابل تكلفة القائمة والمشتريات والمتبقي. */
  /* التعريفات (ثابتة في كل الواجهة):
       تكلفة القائمة المسعّرة = Σ (الكمية المطلوبة × سعر الوحدة) للبنود المسعّرة فقط — ليست التكلفة الكاملة لو بقيت بنود بلا سعر.
       تكلفة ما تم شراؤه   = Σ (الكمية المشتراة × سعر الوحدة) — تقدير بالأسعار الحالية وليست مبلغًا مدفوعًا مسجَّلًا.
       تكلفة الكميات المتبقية = Σ (المطلوب − المشترى) × سعر الوحدة.
       المتبقي من ميزانية الفئة = الميزانية − تكلفة القائمة المسعّرة (سالب = تجاوز). «بعد المشتريات» = الميزانية − تكلفة ما تم شراؤه. */
  function categoryBudget(cat, items) {
    const c = costs(items), has = isSet(cat.budget), budget = has ? Number(cat.budget) : null;
    const planned = c.requiredCost.total, bought = c.purchasedCost.total;
    const left = has ? money2(budget - planned) : null;
    const over = has && planned > budget;
    return {
      budget, isSet: has,
      requiredCost: c.requiredCost, purchasedCost: c.purchasedCost, remainingCost: c.remainingCost,
      unpricedCount: c.requiredCost.unpricedCount, partial: c.requiredCost.incomplete,
      left,                                                                       // المتبقي من الميزانية بعد تكلفة القائمة المسعّرة (سالب لو تجاوز)
      leftAfterPurchases: has ? money2(budget - bought) : null,                   // المتبقي بعد ما تم شراؤه فقط
      over, overBy: over ? money2(planned - budget) : 0,
      status: !has ? "unset" : over ? "over" : "within",
      usedPercent: has && budget > 0 ? Math.round((planned / budget) * 100) : null,
      boughtPercent: has && budget > 0 ? Math.round((bought / budget) * 100) : null,
      requiredOver: over ? money2(planned - budget) : 0                           // اسم قديم محفوظ للتوافق
    };
  }

  /* ملخص واحد تقرؤه الرئيسية وصفحة الميزانية معًا (فلا تختلف الأرقام بين الصفحتين). */
  function overview(totalBudget, categories, items) {
    const plan = budgetPlan(totalBudget, categories), c = costs(items);
    const planned = c.requiredCost.total, bought = c.purchasedCost.total, total = plan.total;
    const hasTotal = total !== null && total > 0;
    return {
      plan, requiredCost: c.requiredCost, purchasedCost: c.purchasedCost, remainingCost: c.remainingCost, spent: c.purchasedCost.total,
      unpricedCount: c.requiredCost.unpricedCount, pricedCount: c.requiredCost.pricedCount, partial: c.requiredCost.incomplete,
      hasGauge: hasTotal,
      over: hasTotal && planned > total, overBy: hasTotal && planned > total ? money2(planned - total) : 0,
      left: hasTotal ? money2(total - planned) : null,
      usedPercent: hasTotal ? Math.round((planned / total) * 100) : null,
      boughtPercent: hasTotal ? Math.round((bought / total) * 100) : null
    };
  }

  window.BrideCalc = { budgetPlan, categoryBudget, overview, hasPrice, isBudgetSet: isSet, itemStatus, remaining, excessQty, purchasedQty, itemSpend, purchaseSummary, percentOf, summarize, categoryState, costs, daysUntil };
})();
