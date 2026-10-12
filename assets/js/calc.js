/* وحدة الحسابات الوحيدة: تُستخدم في الرئيسية والفئات وصفحة الفئة والميزانية. لا تلمس التخزين. */
(() => {
  const num = v => (Number.isFinite(Number(v)) ? Number(v) : 0);

  /* حالة البند تُشتق دائمًا من الكميات (مع استثناء «قيد التجهيز» اليدوي عندما المشترى = 0). */
  function itemStatus(it) {
    const required = Math.max(0, num(it.required));
    const purchased = Math.min(Math.max(0, num(it.purchased)), required);
    if (required > 0 && purchased >= required) return "complete";
    if (purchased > 0) return "preparing";
    return it.status === "preparing" ? "preparing" : "missing";
  }
  const remaining = it => Math.max(0, num(it.required) - num(it.purchased));

  /* نسبة الإنجاز = مجموع المشترى ÷ مجموع المطلوب × 100 (0% لو المطلوب صفر). */
  function percentOf(purchased, required) {
    if (required <= 0) return 0;
    if (purchased >= required) return 100;
    return Math.min(99, Math.round((purchased / required) * 100));
  }

  function summarize(items) {
    const out = { total: items.length, complete: 0, preparing: 0, missing: 0, requiredQty: 0, purchasedQty: 0, remainingQty: 0, percent: 0 };
    for (const it of items) {
      out[itemStatus(it)]++;
      out.requiredQty += num(it.required);
      out.purchasedQty += Math.min(num(it.purchased), num(it.required));
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

  function cost(items, qtyOf) {
    const priced = items.filter(it => it.unitPrice !== null && it.unitPrice !== undefined);
    return { total: priced.reduce((s, it) => s + qtyOf(it) * it.unitPrice, 0), incomplete: priced.length !== items.length, pricedCount: priced.length };
  }
  function costs(items) {
    return {
      requiredCost: cost(items, it => num(it.required)),
      purchasedCost: cost(items, it => num(it.purchased)),
      remainingCost: cost(items, remaining)
    };
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
  function categoryBudget(cat, items) {
    const c = costs(items), has = isSet(cat.budget), budget = has ? Number(cat.budget) : null;
    const spent = c.purchasedCost.total;
    return {
      budget, isSet: has,
      requiredCost: c.requiredCost, purchasedCost: c.purchasedCost, remainingCost: c.remainingCost,
      left: has ? money2(budget - spent) : null,                                // المتبقي من ميزانية الفئة بعد المشتريات
      usedPercent: has && budget > 0 ? Math.round((spent / budget) * 100) : null,
      requiredOver: has && c.requiredCost.total > budget ? money2(c.requiredCost.total - budget) : 0
    };
  }

  window.BrideCalc = { budgetPlan, categoryBudget, isBudgetSet: isSet, itemStatus, remaining, percentOf, summarize, categoryState, costs, daysUntil };
})();
