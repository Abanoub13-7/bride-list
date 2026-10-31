/* أدوات الأدلة الصغيرة: قوائم مراجعة محفوظة محليًا، تقسيم ميزانية، جدول زمني قابل للتعديل، وفحص التكرار في الكتالوج. لا ترسل أي بيانات. */
(function () {
  "use strict";
  var KEY = "brideListGuides.v1", store = {};
  try { store = JSON.parse(localStorage.getItem(KEY) || "{}") || {}; } catch (e) { store = {}; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  var $ = function (s, r) { return (r || document).querySelector(s); };
  function el(tag, attrs, html) { var n = document.createElement(tag); for (var k in (attrs || {})) n.setAttribute(k, attrs[k]); if (html != null) n.innerHTML = html; return n; }
  function num(v) { var x = Number(String(v).replace(/[٠-٩]/g, function (d) { return "٠١٢٣٤٥٦٧٨٩".indexOf(d); }).replace(/[,،\s]/g, "")); return isFinite(x) && x >= 0 ? x : 0; }
  var nf = new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 });
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }

  /* قوائم المراجعة */
  document.querySelectorAll("input[data-ck]").forEach(function (cb) {
    var id = location.pathname + "|" + cb.getAttribute("data-ck");
    cb.checked = !!(store.ck && store.ck[id]);
    cb.addEventListener("change", function () { store.ck = store.ck || {}; if (cb.checked) store.ck[id] = 1; else delete store.ck[id]; save(); });
  });

  /* تقسيم الميزانية */
  var budget = $('[data-tool="budget-split"]');
  if (budget) {
    var rows = [["النيش والضيافة", 8], ["الأجهزة الكهربائية", 30], ["المفروشات", 12], ["الخزين", 8], ["أدوات النظافة والعناية", 7], ["الملابس", 10], ["الرفايع والمطبخ", 8], ["احتياطي للطوارئ", 10], ["أخرى", 7]];
    budget.innerHTML = '<label class="tl">إجمالي الميزانية (ج.م)<input type="text" inputmode="decimal" id="bs-total" placeholder="مثال: 100000"></label><div class="tbl-wrap"><table><thead><tr><th>الفئة</th><th>النسبة ٪</th><th>المبلغ</th></tr></thead><tbody></tbody><tfoot><tr><th>المجموع</th><th id="bs-sum"></th><th id="bs-amt"></th></tr></tfoot></table></div><p id="bs-msg" class="tool-msg" role="status"></p>';
    var tb = $("tbody", budget);
    rows.forEach(function (r, i) { tb.appendChild(el("tr", {}, '<td>' + esc(r[0]) + '</td><td><input type="text" inputmode="decimal" data-p="' + i + '" value="' + r[1] + '" aria-label="نسبة ' + esc(r[0]) + '"></td><td data-a="' + i + '">—</td>')); });
    var calc = function () {
      var total = num($("#bs-total", budget).value), sum = 0, amt = 0;
      rows.forEach(function (r, i) { var p = num($('[data-p="' + i + '"]', budget).value); sum += p; var a = total * p / 100; amt += a; $('[data-a="' + i + '"]', budget).textContent = total ? nf.format(Math.round(a)) : "—"; });
      $("#bs-sum", budget).textContent = nf.format(sum) + "٪"; $("#bs-amt", budget).textContent = total ? nf.format(Math.round(amt)) : "—";
      var m = $("#bs-msg", budget); m.className = "tool-msg";
      if (!total) m.textContent = "اكتبي الإجمالي لتظهر المبالغ.";
      else if (Math.abs(sum - 100) > 0.01) { m.textContent = sum > 100 ? "المجموع أكبر من ١٠٠٪، قلّلي بعض النسب." : "المجموع أقل من ١٠٠٪، يتبقى جزء غير موزّع."; m.className += " warn"; }
      else m.textContent = "التقسيم مكتمل.";
    };
    budget.addEventListener("input", calc); calc();
  }

  /* الجدول الزمني */
  var tl = $('[data-tool="timeline"]');
  if (tl) {
    var steps = [["بدء التخطيط وتحديد الميزانية", 180], ["اعتماد القوائم والمقارنة", 120], ["المشتريات الكبيرة", 90], ["المشتريات المتوسطة", 60], ["المستلزمات الأخيرة", 30], ["مراجعة الحجوزات والأوراق", 14], ["التجهيز الشخصي والتأكيدات", 7], ["يوم الفرح", 0]];
    var saved = (store.timeline && store.timeline.offsets) || [];
    tl.innerHTML = '<label class="tl">موعد الفرح<input type="date" id="tl-date"></label><div class="tbl-wrap"><table><thead><tr><th>المرحلة</th><th>قبل الفرح بـ (يوم)</th><th>التاريخ</th></tr></thead><tbody></tbody></table></div><p id="tl-msg" class="tool-msg" role="status"></p><button type="button" class="btn ghost" id="tl-reset">استعادة القيم الأصلية</button>';
    var tbd = $("tbody", tl), dEl = $("#tl-date", tl);
    if (store.timeline && store.timeline.date) dEl.value = store.timeline.date;
    steps.forEach(function (s, i) { var v = saved[i] != null ? saved[i] : s[1]; tbd.appendChild(el("tr", {}, "<td>" + esc(s[0]) + '</td><td><input type="text" inputmode="numeric" data-o="' + i + '" value="' + v + '" aria-label="عدد الأيام قبل الفرح"></td><td data-d="' + i + '">—</td>')); });
    var render = function () {
      var base = dEl.value ? new Date(dEl.value + "T12:00:00") : null, offs = [];
      steps.forEach(function (s, i) { var o = Math.round(num($('[data-o="' + i + '"]', tl).value)); offs.push(o); var c = $('[data-d="' + i + '"]', tl); if (!base || isNaN(base)) c.textContent = "—"; else { var d = new Date(base.getTime() - o * 864e5); c.textContent = d.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" }); } });
      var late = base && base < new Date() ; $("#tl-msg", tl).textContent = !base ? "اختاري موعد الفرح لتظهر التواريخ." : (late ? "الموعد في الماضي؛ اختاري تاريخًا قادمًا." : "");
      store.timeline = { date: dEl.value, offsets: offs }; save();
    };
    tl.addEventListener("input", render);
    $("#tl-reset", tl).addEventListener("click", function () { steps.forEach(function (s, i) { $('[data-o="' + i + '"]', tl).value = s[1]; }); render(); });
    render();
  }

  /* فحص التكرار في الكتالوج الافتراضي */
  var dup = $('[data-tool="dup-check"]');
  if (dup) {
    dup.innerHTML = '<label class="tl">اسم الغرض<input type="search" id="dc-q" placeholder="مثال: طقم فوط" autocomplete="off"></label><ul id="dc-out" class="dc-out" aria-live="polite"></ul>';
    var data = null, loading = false;
    var norm = function (v) { return String(v || "").replace(/[\u064B-\u0652\u0640]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").toLowerCase(); };
    var run = function () {
      var q = norm($("#dc-q", dup).value).trim(), out = $("#dc-out", dup);
      if (q.length < 2) { out.innerHTML = ""; return; }
      if (!data) { if (!loading) { loading = true; out.innerHTML = "<li>جارٍ التحميل…</li>"; fetch("/assets/data/catalog-index.json").then(function (r) { return r.json(); }).then(function (j) { data = j; run(); }).catch(function () { out.innerHTML = "<li>تعذّر تحميل الكتالوج الآن.</li>"; loading = false; }); } return; }
      var hits = data.filter(function (r) { return norm(r[0]).indexOf(q) !== -1; }).slice(0, 12);
      out.innerHTML = hits.length ? hits.map(function (r) { return "<li><strong>" + esc(r[0]) + "</strong> — " + esc(r[1]) + " (الكمية الافتراضية: " + nf.format(r[3]) + ")</li>"; }).join("") : "<li>لا يوجد بند بهذا الاسم في القائمة الافتراضية، فهو إضافة جديدة منك إن احتجتِه.</li>";
    };
    dup.addEventListener("input", run);
  }
})();
