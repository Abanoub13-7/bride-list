(() => {
  "use strict";
  const $ = id => document.getElementById(id);
  const store = window.BrideStore, calc = window.BrideCalc, Icons = window.BrideIcons;
  const ico = (name, cls) => Icons.svg(name, cls);
  const n = v => new Intl.NumberFormat("ar-EG").format(v);
  const money = v => new Intl.NumberFormat("ar-EG", { maximumFractionDigits: 2 }).format(v) + " ج.م";
  const statusLabels = { missing: "لم يبدأ", preparing: "قيد التجهيز", complete: "مكتمل" };
  const statusIcon = { missing: "notstarted", preparing: "clock", complete: "check" };
  const catStateLabels = { empty: "فارغة", missing: "لم تبدأ", preparing: "قيد التجهيز", complete: "مكتملة" };
  const catStateIcon = { empty: "plus", missing: "notstarted", preparing: "clock", complete: "check" };
  const TONES = ["rose", "beige", "mauve", "sage", "peach", "plum"];
  const VIEWS = ["dashboard", "categories", "category", "items", "budget", "tips", "settings", "about"];
  const TITLES = { dashboard: "الرئيسية", categories: "الفئات", category: "تفاصيل الفئة", items: "كل البنود", budget: "الميزانية", tips: "النصائح الذهبية", settings: "الإعدادات", about: "عن الموقع" };

  let currentView = "dashboard", currentCatId = "";
  let toastTimer;
  const itemFilters = { q: "", cat: "", status: "" };
  let categoryQuery = "";
  const detailFilters = {};        // حالة البحث والتصفية لكل فئة (تتحفظ عند الرجوع)
  const lastPercent = {};          // لتحريك شريط التقدم عند التحديث

  const state = () => store.getState();
  const brideName = s => (s.profile.name || "").trim() || store.DEFAULT_BRIDE_NAME;
  const esc = v => String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const sortedCats = s => s.categories.slice().sort((a, b) => a.sortOrder - b.sortOrder);
  const catById = (s, id) => s.categories.find(c => c.id === id);
  const catName = (s, id) => catById(s, id)?.name || "فئة محذوفة";
  const toneOf = (s, cat) => TONES[Math.max(0, sortedCats(s).findIndex(c => c.id === cat.id)) % TONES.length];
  const itemsOf = (s, id) => s.items.filter(it => it.categoryId === id).sort((a, b) => a.sortOrder - b.sortOrder);
  const displayCost = o => (o.incomplete ? `${money(o.total)}*` : money(o.total));
  const costText = o => (o.pricedCount === 0 && o.incomplete ? "غير مكتملة" : displayCost(o));
  const budgetText = v => (v === null || v === undefined ? "لم تُحدد بعد" : money(v));
  /* رسالة موقف توزيع الميزانية (كل القيم محسوبة من البيانات الفعلية) */
  function planMessage(p) {
    const unsetNote = p.unsetCount ? ` المبلغ محسوب وفق الميزانيات المحددة فقط، ولسه ${n(p.unsetCount)} ${p.unsetCount === 1 ? "فئة" : "فئات"} ما اتحددتش ميزانيتها.` : "";
    switch (p.status) {
      case "no-total": return { cls: "", title: "حددي ميزانيتك الإجمالية الأول علشان نساعدك توزعيها على الفئات", text: p.setCount ? `ميزانيات الفئات اللي حددتيها لحد دلوقتي ${money(p.allocated)}.` : "تقدري برضه تحددي ميزانية لأي فئة من غير ما تحددي الإجمالي." };
      case "zero-total": return { cls: "warn", title: "الميزانية الإجمالية صفر", text: "حددي مبلغًا أكبر من صفر علشان نحسب نسبة التوزيع والمبلغ غير الموزع." };
      case "under": case "none-set": return { cls: "", title: "لسه معاكي مبلغ حلو! 💗", text: p.setCount ? `لسه ${money(p.unallocated)} مش موزعين على الفئات.${unsetNote}` : `ميزانيتك ${money(p.total)} ولسه ما وزعتيهاش على الفئات. ابدئي بتحديد ميزانية أول فئة.` };
      case "over": return { cls: "over", title: "خدي بالك يا عروسة 💛", text: `إجمالي الميزانيات اللي وزعتيها أكبر من ميزانيتك الإجمالية بمبلغ ${money(p.overage)}. تقدري تكملي عادي، لكن راجعي التوزيع لو حابة تلتزمي بالميزانية المحددة.${p.unsetCount ? ` (ولسه ${n(p.unsetCount)} ${p.unsetCount === 1 ? "فئة" : "فئات"} ما اتحددتش ميزانيتها.)` : ""}` };
      default: return { cls: "good", title: "عاش! وزعتي ميزانيتك بالكامل، ومفيش مبلغ غير موزع", text: p.unsetCount ? `المحسوب هنا للفئات المحددة فقط، ولسه ${n(p.unsetCount)} ${p.unsetCount === 1 ? "فئة" : "فئات"} ما اتحددتش ميزانيتها.` : "" };
    }
  }
  const matches = (s, it, q) => !q || `${it.name} ${it.notes} ${it.unit} ${it.group || ""} ${catName(s, it.categoryId)}`.toLocaleLowerCase().includes(q);

  function toast(message, ms = 2800) {
    const el = $("toast"); el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove("show"), ms);
  }


  /* ---------- رحلة الترحيب: بياناتها منفصلة عن القائمة حتى لا تمس بيانات المستخدم ---------- */
  const WELCOME_KEY = "brideListApp.v1.onboarding";
  const welcomeState = { step: "intro", tourIndex: 0, selectedImage: null };
  const WELCOME_TOUR = [
    { icon: "list", title: "تعرّفي على Bride List", text: "Bride List يساعدكِ على جمع متطلبات تجهيز بيتك في قائمة منظمة، مع متابعة كل بند، الكمية، والسعر بسهولة." },
    { icon: "grid", title: "الفئات والمشتريات", text: "استعرضي الفئات، افتحي كل قسم، وراجعي المنتجات أو المتطلبات الموجودة فيه، ثم أضيفي أو عدّلي البنود بحسب احتياجك." },
    { icon: "check", title: "متابعة التجهيزات", text: "تابعي العناصر التي تم شراؤها والعناصر المتبقية، وتتبعّي تقدم كل فئة عبر لوحة المشروع بكل وضوح." },
    { icon: "wallet", title: "الميزانية", text: "دوّني ميزانيتك الإجمالية ووزعيها على الفئات، وتابعي المبلغ المتبقي والإنفاق التقديري من داخل Bride List." },
    { icon: "bulb", title: "النصائح الذهبية", text: "استفيدي من نصائح تجهيز العروسة وجداولها وقوائم مراجعتها للمرحلة المناسبة في رحلتك." },
    { icon: "sparkles", title: "تخصيص تجربتك", text: "عدّلي اسمكِ، وقومي بتعيين صورة يومك الجميل، وغيرّي الإعدادات وفق تفضيلاتك الشخصية داخل التطبيق." }
  ];
  function readWelcomeMeta() {
    try { const value = JSON.parse(localStorage.getItem(WELCOME_KEY) || "{}"); return value && typeof value === "object" ? value : {}; }
    catch (_) { return {}; }
  }
  function writeWelcomeMeta(patch) {
    try { localStorage.setItem(WELCOME_KEY, JSON.stringify({ ...readWelcomeMeta(), ...patch, updatedAt: new Date().toISOString() })); return true; }
    catch (_) { toast("تعذر حفظ تفضيل الجولة في المتصفح. بيانات القائمة لم تتأثر.", 4200); return false; }
  }
  function welcomeIcon(name) { return `<span class="welcome-illustration"><i data-icon="${name}"></i></span>`; }
  function welcomeRender() {
    const content = $("welcomeContent"), actions = $("welcomeActions"), progress = $("welcomeProgress");
    const profile = state().profile || {};
    let html = "", buttons = "", pct = 25;
    if (welcomeState.step === "intro") {
      pct = 18; html = `${welcomeIcon("heart")}<p class="eyebrow">كل بداية جميلة بتبدأ بخطوة</p><h2 id="welcomeTitle">أهلًا بكِ في Bride List 💍</h2><p>رحلتك لتجهيز بيتك تبدأ هنا! نظّمي احتياجاتك، وتابعي مشترياتك، ووزّعي ميزانيتك بسهولة، واحتفظي بقائمتك في مكان واحد.</p>`;
      buttons = `<button class="welcome-primary" data-welcome="profile">ابدئي رحلتك <span aria-hidden="true">←</span></button>`;
    } else if (welcomeState.step === "profile") {
      pct = 38; html = `${welcomeIcon("heart")}<p class="eyebrow">الخطوة الأولى من 3</p><h2 id="welcomeTitle">تحبي نناديكي بإيه؟</h2><p>اكتبي اسمكِ ليظهر في ترحيب الصفحة الرئيسية. تقدري تسيبي الخانة فاضية وتضيفيه أو تغيريه في أي وقت من الإعدادات.</p><form class="welcome-form" id="welcomeNameForm"><label for="welcomeNameInput">اسم العروسة <span class="optional">(اختياري)</span><input id="welcomeNameInput" type="text" maxlength="60" autocomplete="given-name" placeholder="مثال: نور"></label></form>`;
      buttons = `<button class="welcome-secondary" data-welcome="intro">رجوع</button><button class="welcome-primary" data-welcome="save-profile">التالي</button>`;
    } else if (welcomeState.step === "photo") {
      pct = 58; html = `${welcomeIcon("star")}<p class="eyebrow">الخطوة الثانية من 3</p><h2 id="welcomeTitle">تحبي تضيفي صورة؟</h2><p>اختياري: اختاري صورة تظهر في مساحة «يومك بيقرب» على الرئيسية. الصورة تفضل على جهازك، وتقدري تكملي بالصورة الافتراضية.</p><div class="welcome-photo-row"><img class="welcome-photo-preview" id="welcomePhotoPreview" src="${store.getHeroImage()?.dataUrl || "assets/img/default-bride.png"}" alt="معاينة الصورة"><div class="welcome-photo-copy"><strong>صورة يومك الجميل</strong><small>JPG أو PNG أو WebP، بحد أقصى 8 ميجا.</small><label class="welcome-photo-pick">اختيار صورة<input type="file" id="welcomePhotoInput" accept="image/jpeg,image/png,image/webp"></label></div></div><p class="form-hint" id="welcomePhotoStatus" role="status"></p>`;
      buttons = `<button class="welcome-secondary" data-welcome="profile">رجوع</button><button class="welcome-primary" data-welcome="photo-next">التالي</button>`;
    } else if (welcomeState.step === "date") {
      pct = 78; html = `${welcomeIcon("calendar")}<p class="eyebrow">الخطوة الثالثة من 3</p><h2 id="welcomeTitle">تحبي تحددي موعد الفرح؟</h2><p>لو أضفتِ الموعد، يظهر لكِ عدّ تنازلي في الرئيسية. تقدري تسيبيه فاضي أو تعدليه لاحقًا من الإعدادات.</p><form class="welcome-form" id="welcomeDateForm"><label for="welcomeDateInput">موعد الفرح <span class="optional">(اختياري)</span><input id="welcomeDateInput" type="date" min="${new Date().toISOString().slice(0,10)}"></label></form>`;
      buttons = `<button class="welcome-secondary" data-welcome="photo">رجوع</button><button class="welcome-secondary" data-welcome="skip-date">تخطي الموعد</button><button class="welcome-primary" data-welcome="save-date">حفظ ومتابعة</button>`;
    } else if (welcomeState.step === "tour-prompt") {
      pct = 100; html = `${welcomeIcon("sparkles")}<p class="eyebrow">كده بقيتي جاهزة 💗</p><h2 id="welcomeTitle">رحلتك بدأت يا ${esc((profile.name || "عروسة").trim() || "عروسة")}</h2><p>تحبي نعمل جولة سريعة نتعرف فيها على أهم أقسام Bride List؟ الجولة اختيارية وتقدري تتخطّيها في أي وقت.</p>`;
      buttons = `<button class="welcome-secondary" data-welcome="finish">اكتشفي الموقع لاحقًا</button><button class="welcome-primary" data-welcome="tour-start">ورّيني مميزات الموقع</button>`;
    } else if (welcomeState.step === "tour") {
      const item = WELCOME_TOUR[welcomeState.tourIndex]; pct = 100;
      html = `${welcomeIcon(item.icon)}<p class="eyebrow">جولة تعريفية · ${welcomeState.tourIndex + 1} من ${WELCOME_TOUR.length}</p><h2 id="welcomeTitle">${item.title}</h2><p>${item.text}</p><div class="welcome-tour-list"><div class="welcome-tour-item"><span><i data-icon="${item.icon}"></i></span><div><strong>${item.title}</strong><small>${item.text}</small></div></div></div>`;
      buttons = `${welcomeState.tourIndex > 0 ? `<button class="welcome-secondary" data-welcome="tour-back">السابق</button>` : `<button class="welcome-secondary" data-welcome="tour-exit">تخطي الجولة</button>`}<button class="welcome-primary" data-welcome="tour-next">${welcomeState.tourIndex === WELCOME_TOUR.length - 1 ? "إنهاء والبدء" : "التالي"}</button>`;
    }
    content.innerHTML = html; actions.innerHTML = buttons; progress.style.width = `${pct}%`; Icons.hydrate();
    if (welcomeState.step === "profile") $("welcomeNameInput").value = (profile.name || "").trim();
    if (welcomeState.step === "date") $("welcomeDateInput").value = profile.weddingDate || "";
  }
  function welcomeOpen(force = false) {
    const meta = readWelcomeMeta();
    if (!force && (meta.completed || (meta.dismissed && !meta.legacyUser))) return;
    welcomeState.step = "intro"; welcomeState.tourIndex = 0; welcomeState.selectedImage = null;
    welcomeRender();
    const dlg = $("welcomeDialog"); if (!dlg.open) dlg.showModal();
  }
  function welcomeClose(completed) {
    writeWelcomeMeta(completed
      ? { completed: true, dismissed: false, legacyUser: false, completedAt: new Date().toISOString() }
      : { dismissed: true, legacyUser: false, dismissedAt: new Date().toISOString() });
    if ($("welcomeDialog").open) $("welcomeDialog").close();
    render();
  }
  function welcomeSaveProfile() {
    const name = $("welcomeNameInput").value.trim();
    try { store.updateProfile({ name }); welcomeState.step = "photo"; welcomeRender(); }
    catch (error) { toast(error.message || "تعذر حفظ الاسم.", 4200); }
  }
  async function welcomeSavePhoto(file) {
    if (!file) return;
    const status = $("welcomePhotoStatus");
    if (!IMG_TYPES.includes(file.type)) { status.textContent = "اختاري صورة JPG أو PNG أو WebP. الصورة الحالية لم تتغير."; return; }
    if (file.size > IMG_MAX_BYTES) { status.textContent = "حجم الصورة أكبر من 8 ميجا. اختاري صورة أصغر؛ الصورة الحالية لم تتغير."; return; }
    status.textContent = "بنجهز الصورة...";
    try {
      const dataUrl = await compressImage(file); store.setHeroImage(dataUrl); welcomeState.selectedImage = dataUrl;
      $("welcomePhotoPreview").src = dataUrl; status.textContent = "اتحفظت صورتك على جهازك بنجاح 💗"; resolveHero();
    } catch (error) { status.textContent = (error.message || "تعذر حفظ الصورة.") + " الصورة السابقة لم تتغير."; }
  }
  function welcomeHandle(action) {
    if (action === "intro") welcomeState.step = "intro";
    else if (action === "profile") welcomeState.step = "profile";
    else if (action === "save-profile") { welcomeSaveProfile(); return; }
    else if (action === "photo") welcomeState.step = "photo";
    else if (action === "photo-next") welcomeState.step = "date";
    else if (action === "save-date") {
      const date = $("welcomeDateInput").value;
      if (date && calc.daysUntil(date) === null) { toast("راجعي تاريخ الفرح."); return; }
      try { store.updateProfile({ weddingDate: date }); welcomeState.step = "tour-prompt"; }
      catch (error) { toast(error.message || "تعذر حفظ الموعد.", 4200); return; }
    } else if (action === "skip-date") {
      welcomeState.step = "tour-prompt";
    } else if (action === "tour-start") { welcomeState.step = "tour"; welcomeState.tourIndex = 0; }
    else if (action === "tour-back") welcomeState.tourIndex = Math.max(0, welcomeState.tourIndex - 1);
    else if (action === "tour-next") {
      if (welcomeState.tourIndex >= WELCOME_TOUR.length - 1) { welcomeClose(true); return; }
      welcomeState.tourIndex++;
    } else if (action === "tour-exit" || action === "finish") { welcomeClose(true); return; }
    welcomeRender();
  }

  /* ---------- التوجيه (Hash) : الرجوع في المتصفح/الموبايل يشتغل طبيعي ---------- */
  function navigate(hash) { if (location.hash === hash) applyRoute(); else location.hash = hash; }
  function applyRoute() {
    const parts = location.hash.replace(/^#\/?/, "").split("/");
    let view = VIEWS.includes(parts[0]) ? parts[0] : "dashboard";
    let id = parts[1] ? decodeURIComponent(parts[1]) : "";
    if (view === "category" && !catById(state(), id)) view = "categories";
    currentView = view; currentCatId = view === "category" ? id : "";
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
    const navKey = view === "category" ? "categories" : view;
    document.querySelectorAll("[data-nav]").forEach(el => {
      const on = el.dataset.nav === navKey; el.classList.toggle("active", on);
      if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
    const pageTitle = $("pageTitle");
    if (pageTitle) pageTitle.textContent = TITLES[view];
    render();
    window.scrollTo(0, 0);
  }

  /* ---------- مكوّنات العرض ---------- */
  function categoryCard(s, cat, sum) {
    const st = calc.categoryState(sum), icon = Icons.iconFor(cat);
    return `<a class="cat-card tone-${toneOf(s, cat)}" href="#/category/${encodeURIComponent(cat.id)}" aria-label="${esc(cat.name)}: ${n(sum.percent)}% إنجاز">
      <div class="cat-top"><span class="cat-icon">${ico(icon)}</span><span class="cat-badge cs-${st}">${ico(catStateIcon[st])}${catStateLabels[st]}</span></div>
      <h3 class="cat-name">${esc(cat.name)}</h3>
      <div class="cat-percent"><strong>${n(sum.percent)}%</strong><span>إنجاز</span></div>
      <p class="cat-budget">الميزانية: <b>${budgetText(cat.budget)}</b></p>
      <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${sum.percent}"><span style="width:${sum.percent}%"></span></div>
      <dl class="cat-counts"><div><dt>البنود</dt><dd>${n(sum.total)}</dd></div><div><dt>مكتمل</dt><dd>${n(sum.complete)}</dd></div><div><dt>لم يكتمل</dt><dd>${n(sum.incomplete)}</dd></div></dl>
    </a>`;
  }
  function itemCard(s, it, showCategory) {
    const st = calc.itemStatus(it), rem = calc.remaining(it), pct = calc.percentOf(it.purchased, it.required);
    const nm = esc(it.name), unit = esc(it.unit);
    return `<article class="item-card st-${st}">
      <span class="item-state-icon">${ico(statusIcon[st])}</span>
      <div class="item-info">
        <div class="item-title"><h3>${nm}</h3><span class="pill st-${st}">${ico(statusIcon[st])}${statusLabels[st]}</span></div>
        <p class="item-sub">${showCategory ? `<span class="chip">${esc(catName(s, it.categoryId))}</span>` : ""}<span>تم شراء ${n(it.purchased)} من ${n(it.required)} ${unit}</span><span>المتبقي <b>${n(rem)}</b> ${unit}</span>${it.unitPrice === null ? "" : `<span>${money(it.unitPrice)} للوحدة</span>`}</p>
        ${it.notes ? `<p class="item-notes">${esc(it.notes)}</p>` : ""}
        <div class="mini-track"><span style="width:${pct}%"></span></div>
      </div>
      <div class="item-controls">
        <div class="stepper" role="group" aria-label="الكمية المشتراة من ${nm}">
          <button type="button" data-step="dec" data-id="${esc(it.id)}" aria-label="تقليل الكمية المشتراة من ${nm}" ${it.purchased <= 0 ? "disabled" : ""}>${ico("minus")}</button>
          <output>${n(it.purchased)}</output>
          <button type="button" data-step="inc" data-id="${esc(it.id)}" aria-label="زيادة الكمية المشتراة من ${nm}" ${it.purchased >= it.required ? "disabled" : ""}>${ico("plus")}</button>
        </div>
        <div class="item-actions">
          <button type="button" class="mini-button" data-edit="${esc(it.id)}" title="تعديل" aria-label="تعديل ${nm}">${ico("edit")}</button>
          <button type="button" class="mini-button delete" data-delete="${esc(it.id)}" title="حذف" aria-label="حذف ${nm}">${ico("trash")}</button>
        </div>
      </div>
    </article>`;
  }
  function fillCategorySelects() {
    const s = state();
    const options = sortedCats(s).map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join("");
    const keep = $("itemCategory").value;
    $("itemCategory").innerHTML = options;
    if (s.categories.some(c => c.id === keep)) $("itemCategory").value = keep;
    $("categoryFilter").innerHTML = `<option value="">كل الفئات</option>${options}`;
    $("categoryFilter").value = s.categories.some(c => c.id === itemFilters.cat) ? itemFilters.cat : "";
  }

  /* ---------- الرئيسية ---------- */
  function renderHero(s) {
    const days = calc.daysUntil(s.profile.weddingDate);
    const count = $("heroCount"), days$ = $("heroDays"), unit = $("heroUnit"), msg = $("heroMessage");
    $("heroButtonText").textContent = days === null ? "تحديد موعد الفرح" : "تعديل موعد الفرح";
    count.classList.remove("hidden");
    if (days === null) {
      count.classList.add("hidden");
      msg.textContent = "حددي موعد الفرح من الإعدادات علشان نبدأ العد التنازلي لأجمل يوم.";
    } else if (days > 0) {
      const [y, m, d] = s.profile.weddingDate.split("-").map(Number);
      days$.textContent = n(days);
      unit.textContent = days === 1 ? "يوم واحد باقي" : days === 2 ? "يومين باقيين" : days <= 10 ? "أيام باقية" : "يوم باقي";
      msg.textContent = `موعد الفرح ${new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(y, m - 1, d))}. كل يوم بيقربك من حلمك.`;
    } else if (days === 0) {
      days$.textContent = "النهارده يومك!"; unit.textContent = "";
      msg.textContent = "نتمنالك يوم مليان فرحة وذكريات حلوة.";
    } else {
      count.classList.add("hidden");
      msg.textContent = "ألف مبروك على يومك الجميل! لو حبيتي تبدأي عدّ جديد، حدّثي الموعد من الإعدادات.";
    }
  }
  function renderDashboard() {
    const s = state(), sum = calc.summarize(s.items), cost = calc.costs(s.items);
    $("welcomeName").textContent = brideName(s);
    $("totalItems").textContent = n(sum.total);
    $("completedItems").textContent = n(sum.complete);
    $("remainingItems").textContent = n(sum.incomplete);
    $("progressPercent").textContent = n(sum.percent) + "%";
    $("progressBig").textContent = n(sum.percent) + "%";
    $("progressBar").style.width = sum.percent + "%";
    $("budgetLimit").textContent = s.totalBudget === null ? "لم تُحدد بعد" : money(s.totalBudget);
    const plan = calc.budgetPlan(s.totalBudget, s.categories);
    $("dashAllocated").textContent = plan.setCount ? money(plan.allocated) : "لم تُحدد بعد";
    $("dashDiffLabel").textContent = plan.status === "over" ? "مقدار التجاوز" : "المبلغ غير الموزع";
    $("dashDiff").textContent = plan.status === "over" ? money(plan.overage) : plan.total === null || plan.status === "zero-total" ? "—" : money(plan.unallocated);
    $("requiredCost").textContent = displayCost(cost.requiredCost);
    $("purchasedCost").textContent = displayCost(cost.purchasedCost);
    $("remainingCost").textContent = displayCost(cost.remainingCost);
    $("encouragementText").textContent = sum.total === 0 ? "ابدئي بإضافة أول بند في قائمتك، والباقي هيبقى أسهل."
      : sum.percent === 100 ? "برافو عليكي! كل الكميات المطلوبة اتسجلت كمشتراة."
      : `خلصتي ${n(sum.percent)}% من الكميات. خطوة صغيرة كل يوم هتفرق.`;
    renderHero(s);
    const tp = tipsTotals();
    $("tipsPromoText").textContent = tp.done ? `أنجزتي ${n(tp.done)} من ${n(tp.total)} مهمة في جداول التجهيز وقوائم المراجعة.` : "نصائح عملية وجداول تجهيز وقوائم مراجعة لحد يوم الفرح.";
    $("tipsPromoBar").style.width = tp.pct + "%";
    $("dashCategories").innerHTML = sortedCats(s).map(c => categoryCard(s, c, calc.summarize(itemsOf(s, c.id)))).join("") || `<div class="empty-inline">لسه مفيش فئات.</div>`;
    const attention = s.items.filter(it => calc.itemStatus(it) !== "complete").slice(0, 4);
    $("attentionList").innerHTML = attention.length ? attention.map(it => {
      const st = calc.itemStatus(it), cat = catById(s, it.categoryId);
      return `<a class="attention-row" href="#/category/${encodeURIComponent(it.categoryId)}"><span class="mini-ic tone-${cat ? toneOf(s, cat) : "beige"}">${ico(Icons.iconFor(cat))}</span><div class="attention-main"><strong>${esc(it.name)}</strong><small>${esc(catName(s, it.categoryId))} · متبقي ${n(calc.remaining(it))} ${esc(it.unit)}</small></div><span class="pill st-${st}">${ico(statusIcon[st])}${statusLabels[st]}</span></a>`;
    }).join("") : `<div class="empty-inline">${s.items.length ? "كل البنود مكتملة حسب الكميات المسجلة، عاش!" : "لسه مفيش بنود. أضيفي أول بند وابدئي رحلتك."}</div>`;
  }

  /* ---------- الفئات ---------- */
  function renderCategories() {
    const s = state(), q = categoryQuery;
    const cats = sortedCats(s).filter(c => !q || `${c.name} ${c.description || ""}`.toLocaleLowerCase().includes(q));
    $("categoriesGrid").innerHTML = cats.map(c => categoryCard(s, c, calc.summarize(itemsOf(s, c.id)))).join("");
    $("emptyCategories").classList.toggle("hidden", cats.length !== 0);
    $("categoriesGrid").classList.toggle("hidden", cats.length === 0);
  }

  /* ---------- تفاصيل الفئة ---------- */
  function renderCategoryDetail() {
    const s = state(), cat = catById(s, currentCatId); if (!cat) return;
    const all = itemsOf(s, cat.id), sum = calc.summarize(all), tone = toneOf(s, cat);
    const f = detailFilters[cat.id] || (detailFilters[cat.id] = { q: "", status: "" });
    const pageTitle = $("pageTitle");
    if (pageTitle) pageTitle.textContent = cat.name;
    $("detailHead").innerHTML = `
      <a class="back-link" href="#/categories">${ico("back")} رجوع إلى الفئات</a>
      <div class="detail-main tone-${tone}">
        <span class="cat-icon big">${ico(Icons.iconFor(cat))}</span>
        <div class="detail-title"><h1>${esc(cat.name)}</h1><p class="muted">${esc(cat.description || "كل بنود الفئة ومتابعة إنجازها في مكان واحد.")}</p></div>
        <div class="detail-actions">
          <button type="button" class="primary-button" data-add-here>${ico("plus")} إضافة بند</button>
          <button type="button" class="icon-btn" data-edit-cat title="تعديل الفئة" aria-label="تعديل الفئة">${ico("edit")}</button>
          <button type="button" class="icon-btn danger" data-del-cat title="حذف الفئة" aria-label="حذف الفئة">${ico("trash")}</button>
        </div>
      </div>`;
    const tile = (cls, icon, label, value, note) => `<div class="tile ${cls}"><span class="tile-ic">${ico(icon)}</span><strong>${value}</strong><span class="tile-label">${label}</span>${note ? `<small>${note}</small>` : ""}</div>`;
    $("detailStats").innerHTML =
      tile("t-pct", "sparkles", "نسبة الإنجاز", n(sum.percent) + "%") +
      tile("st-complete", "check", "البنود المكتملة", n(sum.complete)) +
      tile("st-preparing", "clock", "قيد التجهيز", n(sum.preparing)) +
      tile("st-missing", "notstarted", "لم يبدأ", n(sum.missing)) +
      tile("t-total", "list", "إجمالي البنود", n(sum.total)) +
      tile("t-rem", "box", "الكميات المتبقية", n(sum.remainingQty));
    const prev = lastPercent[cat.id] ?? 0;
    $("detailProgress").innerHTML = `
      <div class="bp-top"><div><h3>إنجاز ${esc(cat.name)}</h3><p class="muted">تم شراء ${n(sum.purchasedQty)} من ${n(sum.requiredQty)} من الكميات المطلوبة</p></div><strong class="bp-num">${n(sum.percent)}%</strong></div>
      <div class="progress-track big" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${sum.percent}" aria-label="نسبة إنجاز الفئة"><span id="bigBar" style="width:${prev}%"></span></div>`;
    lastPercent[cat.id] = sum.percent;
    const cb = calc.categoryBudget(cat, all);
    const leftTxt = cb.left === null ? "—" : cb.left >= 0 ? money(cb.left) : `تجاوز ${money(-cb.left)}`;
    $("detailBudget").innerHTML = `
      <div class="bp-top"><div><h3>ميزانية ${esc(cat.name)}</h3><p class="muted">الميزانية المخصصة مش مبلغ اتدفع، والمشتريات تقديرية حسب الأسعار الحالية.</p></div><button type="button" class="outline-button" data-edit-budget="${esc(cat.id)}">${ico("wallet")} ${cb.isSet ? "تعديل الميزانية" : "تحديد ميزانية"}</button></div>
      <div class="cb-grid">
        ${tile("t-budget", "wallet", "الميزانية المخصصة", budgetText(cb.budget))}
        ${tile("t-total", "list", "تكلفة القائمة المطلوبة", costText(cb.requiredCost))}
        ${tile("st-complete", "check", "تكلفة المشتريات", costText(cb.purchasedCost))}
        ${tile("st-preparing", "clock", "تكلفة المتبقي", costText(cb.remainingCost))}
        ${tile(cb.left !== null && cb.left < 0 ? "st-missing" : "t-rem", "box", "المتبقي من ميزانية الفئة", leftTxt)}
        ${tile("t-pct", "sparkles", "نسبة استهلاك الميزانية", cb.usedPercent === null ? "—" : n(cb.usedPercent) + "%")}
      </div>
      ${cb.usedPercent !== null ? `<div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.min(100, cb.usedPercent)}" aria-label="استهلاك ميزانية الفئة"><span style="width:${Math.min(100, cb.usedPercent)}%"></span></div>` : ""}
      ${cb.requiredOver > 0 ? `<div class="budget-status over cb-warn"><span class="status-badge">تنبيه</span><p>تكلفة القائمة المطلوبة أعلى من ميزانية الفئة بحوالي ${money(cb.requiredOver)}. تقدري تكملي عادي، لكن راجعي الأسعار أو الميزانية.</p></div>` : ""}
      ${!cb.isSet ? `<p class="muted">لسه ما حددتيش ميزانية للفئة دي.</p>` : ""}`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const b = $("bigBar"); if (b) b.style.width = sum.percent + "%"; }));

    $("detailSearch").value = f.q; $("detailStatus").value = f.status;
    const q = f.q.trim().toLocaleLowerCase();
    const list = all.filter(it => matches(s, it, q) && (!f.status || calc.itemStatus(it) === f.status));
    $("detailSummary").textContent = `عرض ${n(list.length)} من ${n(all.length)} بند`;
    /* تقسيم الفئة لمجموعات فرعية (من الملف المصدر) — البنود التي أضافتها المستخدمة تظهر في آخر القائمة */
    const hasGroups = all.some(it => it.group), groupCount = {};
    if (hasGroups) list.forEach(it => { const g = it.group || "بنود أضفتِها"; groupCount[g] = (groupCount[g] || 0) + 1; });
    let prevGroup = null;
    $("detailList").innerHTML = list.map(it => {
      let head = "";
      if (hasGroups) { const g = it.group || "بنود أضفتِها"; if (g !== prevGroup) { head = `<h3 class="group-title"><span>${esc(g)}</span><small>${n(groupCount[g])}</small></h3>`; prevGroup = g; } }
      return head + itemCard(s, it, false);
    }).join("");
    $("detailList").classList.toggle("hidden", list.length === 0);
    const empty = $("detailEmpty");
    empty.classList.toggle("hidden", list.length !== 0);
    if (!all.length) empty.innerHTML = `<div class="empty-illustration">${ico(Icons.iconFor(cat))}</div><h3>الفئة دي لسه فاضية</h3><p>ابدئي بإضافة أول بند في ${esc(cat.name)}.</p><button type="button" class="primary-button" data-add-here>${ico("plus")} إضافة بند</button>`;
    else if (!list.length) empty.innerHTML = `<div class="empty-illustration">${ico("search")}</div><h3>مفيش نتائج</h3><p>غيّري كلمة البحث أو الحالة.</p>`;
  }

  /* ---------- كل البنود ---------- */
  function renderItems() {
    const s = state(), q = itemFilters.q;
    $("searchInput").value = itemFilters.q; $("statusFilter").value = itemFilters.status;
    const list = s.items.filter(it => matches(s, it, q) && (!itemFilters.cat || it.categoryId === itemFilters.cat) && (!itemFilters.status || calc.itemStatus(it) === itemFilters.status)).sort((a, b) => a.sortOrder - b.sortOrder);
    $("itemsSummary").textContent = `عرض ${n(list.length)} من ${n(s.items.length)} بند`;
    $("itemsList").innerHTML = list.map(it => itemCard(s, it, true)).join("");
    $("emptyItems").classList.toggle("hidden", list.length !== 0);
    $("itemsList").classList.toggle("hidden", list.length === 0);
  }

  /* ---------- الميزانية والإعدادات ---------- */
  function renderBudget() {
    const s = state(), cost = calc.costs(s.items);
    $("budgetInput").value = s.totalBudget === null ? "" : s.totalBudget;
    $("budgetRequired").textContent = costText(cost.requiredCost);
    $("budgetPurchased").textContent = costText(cost.purchasedCost);
    $("budgetRemaining").textContent = costText(cost.remainingCost);
    const box = $("budgetStatus");
    if (s.totalBudget === null) {
      box.className = "budget-status"; box.innerHTML = `<span class="status-badge">لم تُحدد ميزانية بعد</span><p>حددي الميزانية الإجمالية علشان يظهر تقدير الموقف.</p>`;
    } else if (cost.requiredCost.incomplete) {
      box.className = "budget-status"; box.innerHTML = `<span class="status-badge">التكلفة غير مكتملة</span><p>في بنود من غير سعر وحدة. سجلي أسعارها علشان تقارني تكلفة القائمة بميزانيتك. المجموع الحالي يشمل البنود المسعّرة فقط.</p>`;
    } else {
      const diff = s.totalBudget - cost.requiredCost.total;
      box.className = `budget-status ${diff >= 0 ? "good" : "over"}`;
      box.innerHTML = `<span class="status-badge">${diff >= 0 ? "داخل الميزانية" : "أعلى من الميزانية"}</span><p>${diff >= 0 ? `متبقي ${money(diff)} من ميزانيتك بعد تقدير كل البنود.` : `القائمة أعلى من الميزانية بحوالي ${money(Math.abs(diff))}. راجعي الأولويات والأسعار.`}</p>`;
    }
    /* توزيع الميزانية على الفئات */
    const plan = calc.budgetPlan(s.totalBudget, s.categories), msg = planMessage(plan);
    const alertBox = $("budgetAlert");
    alertBox.className = `budget-status plan-alert ${msg.cls}`;
    alertBox.innerHTML = `<strong>${msg.title}</strong>${msg.text ? `<p>${msg.text}</p>` : ""}`;
    $("planTotal").textContent = budgetText(plan.total);
    $("planAllocated").textContent = plan.setCount ? money(plan.allocated) : "لم تُحدد بعد";
    $("planCounts").textContent = `${n(plan.setCount)} فئة محددة · ${n(plan.unsetCount)} لم تُحدد`;
    const card = $("planDiffCard");
    card.classList.remove("is-good", "is-over", "is-warn");
    if (plan.status === "over") {
      $("planDiffLabel").textContent = "مقدار التجاوز"; $("planDiff").textContent = money(plan.overage); $("planDiffNote").textContent = "أكبر من الميزانية الإجمالية"; card.classList.add("is-over");
    } else {
      $("planDiffLabel").textContent = "المبلغ غير الموزع";
      if (plan.total === null || plan.status === "zero-total") { $("planDiff").textContent = "—"; $("planDiffNote").textContent = "حددي ميزانية إجمالية أكبر من صفر"; }
      else { $("planDiff").textContent = money(plan.unallocated); $("planDiffNote").textContent = plan.status === "equal" ? "اتوزعت بالكامل" : plan.unsetCount ? "حسب الميزانيات المحددة فقط" : "لسه متاح للتوزيع"; if (plan.status === "equal") card.classList.add("is-good"); }
    }
    const pct = plan.percent;
    $("planPercent").textContent = pct === null ? "—" : n(pct) + "%";
    $("planBar").style.width = pct === null ? "0%" : Math.min(100, pct) + "%";
    $("planBar").parentElement.setAttribute("aria-valuenow", pct === null ? 0 : Math.min(100, pct));
    $("planBar").parentElement.className = `progress-track big plan-track ${plan.status === "over" ? "over" : plan.status === "equal" ? "good" : ""}`;
    $("planNote").textContent = pct === null ? "نسبة التوزيع هتظهر بعد تحديد ميزانية إجمالية أكبر من صفر." : `وزعتي ${n(pct)}% من ميزانيتك الإجمالية على الفئات المحددة.`;

    const rows = sortedCats(s).map(cat => ({ cat, items: itemsOf(s, cat.id), b: calc.categoryBudget(cat, itemsOf(s, cat.id)) }));
    $("categoryCostList").innerHTML = rows.length ? rows.map(({ cat, items, b }) => `<div class="cost-row cat-budget-row">
      <a class="cb-link" href="#/category/${encodeURIComponent(cat.id)}"><span class="mini-ic tone-${toneOf(s, cat)}">${ico(Icons.iconFor(cat))}</span><div><strong>${esc(cat.name)}</strong><small>القائمة ${costText(b.requiredCost)} · المشتريات ${costText(b.purchasedCost)} · المتبقي ${costText(b.remainingCost)}</small></div></a>
      <div class="cb-side"><strong class="cost-value ${b.isSet ? "" : "unset"}">${budgetText(b.budget)}</strong>
        <small>${!b.isSet ? "ميزانية الفئة" : b.left >= 0 ? `متبقي ${money(b.left)}${b.usedPercent !== null ? ` · ${n(b.usedPercent)}%` : ""}` : `تجاوز ${money(-b.left)}`}</small>
        ${b.requiredOver > 0 ? `<small class="cb-over">القائمة أعلى من الميزانية بـ ${money(b.requiredOver)}</small>` : ""}
        <button type="button" class="outline-button mini-text-button" data-edit-budget="${esc(cat.id)}">${b.isSet ? "تعديل الميزانية" : "تحديد ميزانية"}</button></div>
    </div>`).join("") : `<div class="empty-inline">أضيفي فئات علشان تحددي لها ميزانيات.</div>`;
  }
  function renderSettings() {
    const s = state();
    $("nameInput").value = (s.profile.name || "").trim();            /* الفارغ = الاسم الافتراضي (يتغير من storage.js) */
    $("nameInput").placeholder = store.DEFAULT_BRIDE_NAME;
    $("weddingDateInput").value = s.profile.weddingDate;
    $("preV5Row").classList.toggle("hidden", !store.getPreV5Backup());
    renderImagePanel();
  }

  function render() {
    const s = state();
    const avatar = $("avatarBtn");
    if (avatar) avatar.textContent = brideName(s).charAt(0) || store.DEFAULT_BRIDE_NAME.charAt(0);
    fillCategorySelects();
    ({ dashboard: renderDashboard, categories: renderCategories, category: renderCategoryDetail, items: renderItems, budget: renderBudget, tips: renderTips, settings: renderSettings, about: renderAbout })[currentView]();
  }
  function renderAbout() { Icons.hydrate(); }

  /* ---------- نافذة البند ---------- */
  function syncItemForm() {
    const r = parseInt($("itemRequired").value, 10), p = parseInt($("itemPurchased").value, 10), sel = $("itemStatus");
    $("itemPurchased").max = Number.isFinite(r) ? String(r) : "";
    if (!Number.isFinite(r) || !Number.isFinite(p)) return;
    if (r > 0 && p >= r) sel.value = "complete";
    else if (p > 0) sel.value = "preparing";
    else if (sel.value === "complete") sel.value = "missing";
  }
  function openItemDialog(id = "", presetCat = "") {
    const s = state();
    if (!s.categories.length) { openCategoryDialog(); toast("ضيفي فئة الأول علشان تضيفي بند."); return; }
    $("itemForm").reset(); $("itemId").value = id || "";
    $("itemRequired").value = "1"; $("itemPurchased").value = "0"; $("itemUnit").value = "قطعة"; $("itemPrice").value = ""; $("itemStatus").value = "missing";
    fillCategorySelects();
    if (id) {
      const item = s.items.find(it => it.id === id); if (!item) return;
      $("dialogTitle").textContent = "تعديل البند";
      $("itemName").value = item.name; $("itemCategory").value = item.categoryId; $("itemUnit").value = item.unit;
      $("itemRequired").value = item.required; $("itemPurchased").value = item.purchased;
      $("itemPrice").value = item.unitPrice === null ? "" : item.unitPrice; $("itemStatus").value = calc.itemStatus(item); $("itemNotes").value = item.notes;
    } else {
      $("dialogTitle").textContent = "إضافة بند جديد";
      const preset = presetCat || (currentView === "category" ? currentCatId : "");
      if (preset && s.categories.some(c => c.id === preset)) $("itemCategory").value = preset;
    }
    $("itemPurchased").max = $("itemRequired").value;
    $("itemDialog").showModal();
  }
  const closeItemDialog = () => $("itemDialog").close();
  function handleItemSubmit(event) {
    event.preventDefault();
    const data = { name: $("itemName").value, categoryId: $("itemCategory").value, unit: $("itemUnit").value, required: $("itemRequired").value, purchased: $("itemPurchased").value, unitPrice: $("itemPrice").value, status: $("itemStatus").value, notes: $("itemNotes").value };
    try {
      const id = $("itemId").value;
      if (id) store.updateItem(id, data); else store.addItem(data);
      closeItemDialog(); render(); toast(id ? "تم تحديث البند بنجاح." : "اتضاف البند لقائمتك.");
    } catch (error) { toast(error.message || "حصلت مشكلة أثناء الحفظ.", 4200); }
  }

  /* ---------- نافذة الفئة ---------- */
  function openCategoryDialog(id = "") {
    const s = state(), cat = id ? catById(s, id) : null;
    $("categoryForm").reset(); $("categoryId").value = cat ? cat.id : "";
    $("categoryDialogTitle").textContent = cat ? "تعديل الفئة" : "إضافة فئة جديدة";
    $("categoryName").value = cat ? cat.name : ""; $("categoryDesc").value = cat ? cat.description || "" : "";
    const chosen = cat && cat.icon ? cat.icon : "auto";
    $("iconPicker").innerHTML = store.ICON_KEYS.map(k => `<label class="icon-opt"><input type="radio" name="catIcon" value="${k}" ${k === chosen ? "checked" : ""}><span title="${k === "auto" ? "تلقائي حسب الاسم" : ""}">${k === "auto" ? `<em>تلقائي</em>` : ico(k)}</span></label>`).join("");
    $("categoryDialog").showModal();
  }
  const closeCategoryDialog = () => $("categoryDialog").close();
  function handleCategorySubmit(event) {
    event.preventDefault();
    const opts = { description: $("categoryDesc").value, icon: document.querySelector("input[name=catIcon]:checked")?.value || "auto" };
    try {
      const id = $("categoryId").value;
      const cat = id ? store.updateCategory(id, { name: $("categoryName").value, ...opts }) : store.addCategory($("categoryName").value, opts);
      closeCategoryDialog(); render();
      if (!id && $("itemDialog").open) $("itemCategory").value = cat.id;
      toast(id ? "تم تحديث الفئة." : "تمت إضافة الفئة.");
    } catch (error) { toast(error.message || "تعذر حفظ الفئة.", 4200); }
  }
  function deleteCurrentCategory() {
    const s = state(), cat = catById(s, currentCatId); if (!cat) return;
    if (itemsOf(s, cat.id).length) { toast("انقلي أو احذفي البنود الموجودة داخل الفئة الأول.", 4200); return; }
    if (!confirm(`متأكدة إنك عايزة تحذفي فئة "${cat.name}"؟`)) return;
    try { store.deleteCategory(cat.id); delete detailFilters[cat.id]; toast("تم حذف الفئة."); navigate("#/categories"); }
    catch (error) { toast(error.message || "تعذر حذف الفئة.", 4200); }
  }

  /* ---------- إجراءات البنود (تفويض الأحداث) ---------- */
  function handleItemAction(e) {
    const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-delete]"), step = e.target.closest("[data-step]");
    const s = state();
    if (edit) openItemDialog(edit.dataset.edit);
    else if (del) {
      const item = s.items.find(it => it.id === del.dataset.delete); if (!item) return;
      if (confirm(`متأكدة إنك عايزة تحذفي "${item.name}"؟`)) {
        try { store.deleteItem(item.id); render(); toast("تم حذف البند."); } catch (error) { toast(error.message || "تعذر حذف البند.", 4200); }
      }
    } else if (step && !step.disabled) {
      const item = s.items.find(it => it.id === step.dataset.id); if (!item) return;
      const next = Math.min(item.required, Math.max(0, item.purchased + (step.dataset.step === "inc" ? 1 : -1)));
      try {
        store.updateItem(item.id, { ...item, purchased: next, status: next === 0 ? "missing" : item.status });
        render();
        const again = document.querySelector(`[data-step="${step.dataset.step}"][data-id="${CSS.escape(item.id)}"]:not([disabled])`); if (again) again.focus({ preventScroll: true });
      } catch (error) { toast(error.message || "تعذر تحديث الكمية.", 4200); }
    }
  }

  /* ---------- صورة يومك الجميل ---------- */
  const IMG_TYPES = ["image/jpeg", "image/png", "image/webp"], IMG_MAX_BYTES = 8 * 1024 * 1024, IMG_OUT_MAX = 600 * 1024;
  let heroInfo = { custom: false, broken: false }, heroToken = 0;
  function renderImagePanel() {
    const { custom, broken } = heroInfo;
    $("imageStatus").textContent = custom ? "دي صورة اخترتيها إنتِ، وبتظهر دلوقتي خلف «يومك بيقرب»."
      : broken ? "الصورة المحفوظة تعذر تحميلها فرجعنا للصورة الافتراضية. اختاري صورة تانية."
      : "دي الصورة الافتراضية للموقع. تقدري تختاري صورتك الخاصة في أي وقت.";
    $("pickImageText").textContent = custom ? "تغيير الصورة" : "اختيار صورة";
    $("removeImageButton").classList.toggle("hidden", !(custom || broken));
  }
  /* الأولوية: صورة مخصصة صالحة ← وإلا الافتراضية (حتى لو المحفوظة تالفة) دون المساس ببقية البيانات */
  function resolveHero() {
    const token = ++heroToken, saved = store.getHeroImage();
    const apply = (custom, broken) => {
      if (token !== heroToken) return;
      heroInfo = { custom, broken };
      [$("hero"), $("imagePreview")].forEach(el => {
        if (custom) el.style.setProperty("--hero-img", `url("${saved.dataUrl}")`); else el.style.removeProperty("--hero-img");
      });
      renderImagePanel();
    };
    if (!saved) { apply(false, false); return; }
    const probe = new Image();
    probe.onload = () => apply(true, false);
    probe.onerror = () => apply(false, true);
    probe.src = saved.dataUrl;
  }
  function imgMsg(text, kind) { const el = $("imageMsg"); el.textContent = text; el.className = `inline-msg ${kind || ""}`; }
  function loadImageFile(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file), img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذر قراءة الصورة. ممكن الملف يكون تالف.")); };
      img.src = url;
    });
  }
  /* تصغير الصورة بـ Canvas (الأطول ≤ 1080) وحفظها JPEG مضغوط؛ الشفافية تُملأ بلون كريمي */
  async function compressImage(file) {
    const img = await loadImageFile(file), w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error("تعذر قراءة أبعاد الصورة.");
    for (const [dim, q] of [[1080, .82], [1080, .7], [900, .7], [720, .65], [600, .6]]) {
      const k = Math.min(1, dim / Math.max(w0, h0)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
      const ctx = c.getContext("2d"); ctx.fillStyle = "#f6ece3"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", q);
      if (url.length <= IMG_OUT_MAX) return url;
    }
    throw new Error("الصورة لسه كبيرة بعد التصغير. اختاري صورة أبسط أو أصغر.");
  }
  async function handleHeroFile(file) {
    if (!file) return;
    imgMsg("");
    if (!IMG_TYPES.includes(file.type)) { imgMsg("نوع الملف غير مدعوم. اختاري صورة JPG أو PNG أو WebP. صورتك الحالية ما اتغيرتش.", "err"); $("heroImageInput").value = ""; return; }
    if (file.size > IMG_MAX_BYTES) { imgMsg("حجم الصورة كبير جدًا (الحد الأقصى ٨ ميجا). اختاري صورة أصغر. صورتك الحالية ما اتغيرتش.", "err"); $("heroImageInput").value = ""; return; }
    try {
      store.setHeroImage(await compressImage(file));
      resolveHero(); imgMsg("تم حفظ الصورة وهتظهر في الرئيسية. 💗", "ok"); toast("تم حفظ صورتك.");
    } catch (error) { imgMsg((error.message || "تعذر حفظ الصورة.") + " صورتك الحالية ما اتغيرتش.", "err"); }
    finally { $("heroImageInput").value = ""; }
  }
  function removeHeroImage() { store.clearHeroImage(); resolveHero(); imgMsg("رجعنا للصورة الافتراضية.", "ok"); }

  /* ---------- نافذة ميزانية الفئة ---------- */
  function openBudgetDialog(id) {
    const cat = catById(state(), id); if (!cat) return;
    $("budgetCatId").value = cat.id; $("budgetDialogTitle").textContent = `ميزانية ${cat.name}`;
    $("catBudgetInput").value = cat.budget === null || cat.budget === undefined ? "" : cat.budget;
    $("clearCatBudget").classList.toggle("hidden", cat.budget === null || cat.budget === undefined);
    $("budgetDialog").showModal(); $("catBudgetInput").focus();
  }
  const closeBudgetDialog = () => $("budgetDialog").close();
  function saveCatBudget(value) {
    try {
      store.setCategoryBudget($("budgetCatId").value, value);
      closeBudgetDialog(); render(); toast(value === null ? "تم مسح ميزانية الفئة (غير محددة)." : "تم حفظ ميزانية الفئة.");
    } catch (error) { toast(error.message || "تعذر حفظ ميزانية الفئة.", 4200); }
  }

  /* ---------- النصائح الذهبية ---------- */
  const Tips = window.BrideTips;
  let tipsTab = Tips.tabs[0].id;
  const checklistIds = g => (g.kind === "checklist" ? g.tasks.map(t => t[0]) : []);
  const richText = text => esc(text).replace(/\*\*(.+?)\*\*/g, "<mark>$1</mark>");   /* ** ** = إبراز */
  function tipsTotals() {
    const done = store.getTipsDone(), ids = Tips.tabs.flatMap(t => t.groups.flatMap(checklistIds));
    const c = ids.filter(id => done[id]).length;
    return { done: c, total: ids.length, pct: ids.length ? Math.round((c / ids.length) * 100) : 0 };
  }
  /* ما كان المستخدم قد عدّله في فئة «شنطة شهر العسل» القديمة: للقراءة فقط، خارج المشتريات والميزانية */
  function legacyHoneymoonHtml() {
    const arch = store.getLegacyHoneymoon();
    if (!arch || !arch.items.length) return "";
    const rows = arch.items.map(it => {
      const bits = [`${n(it.purchased)} من ${n(it.required)} ${esc(it.unit)}`];
      if (it.unitPrice !== null) bits.push(`السعر ${money(it.unitPrice)}`);
      if (it.notes) bits.push(esc(it.notes));
      return `<li><strong>${esc(it.name)}</strong><span class="muted"> — ${bits.join(" • ")}</span></li>`;
    }).join("");
    return `<section class="tips-group tone-beige" id="tg-hm-archive">
      <header class="tg-head"><span class="tg-ic">${ico("box")}</span><div class="tg-title"><h2>ما حفظتيه من شنطة شهر العسل القديمة</h2><p class="muted">للاطلاع فقط — غير محسوب في المشتريات أو الميزانية</p></div></header>
      <div class="tg-list"><ul class="legacy-list">${rows}</ul>
      <p class="form-hint">دي بنود كنتِ عدّلتيها قبل تحويل الشنطة إلى نصائح. لو مش محتاجاها، تقدري تحذفيها من هنا.</p>
      <button type="button" class="text-button" data-clear-hm-archive>حذف هذه القائمة</button></div>
    </section>`;
  }
  function tipsGroupHtml(g) {
    return `<section class="tips-group tone-${g.tone}" id="tg-${g.id}">
      <header class="tg-head"><span class="tg-ic">${ico(g.icon)}</span><div class="tg-title"><h2>${esc(g.title)}</h2><p class="muted">${esc(g.sub)}</p></div></header>
      <div class="tg-list">
        ${g.tips.map(t => `<details class="tip-card"><summary><span class="tip-head"><span class="tip-title">${esc(t.title)}</span><span class="tip-preview">${esc(t.body.replace(/\*\*/g, ""))}</span></span><span class="tip-chev">${ico("chevron")}</span></summary><div class="tip-body"><p>${richText(t.body)}</p></div></details>`).join("")}
        ${g.callout ? `<div class="tip-callout ${g.callout.type}" role="note"><span class="tip-callout-ic">${ico("alert")}</span><div><strong>${esc(g.callout.title)}</strong><p>${richText(g.callout.body)}</p></div></div>` : ""}
      </div>
    </section>`;
  }
  function checklistGroupHtml(g, done, open) {
    return `<details class="tips-group check-group tone-${g.tone}" id="tg-${g.id}" ${open ? "open" : ""}>
      <summary class="tg-head"><span class="tg-ic">${ico(g.icon)}</span><div class="tg-title"><h2>${esc(g.title)}</h2><p class="muted">${esc(g.sub)}</p></div><span class="tg-count" id="tgc-${g.id}"></span><span class="tip-chev">${ico("chevron")}</span></summary>
      <div class="progress-track tg-track" id="tgp-${g.id}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" aria-label="تقدم ${esc(g.title)}"><span></span></div>
      <ul class="task-list">${g.tasks.map(([id, text]) => `<li><label class="task ${done[id] ? "is-done" : ""}"><input type="checkbox" data-task="${id}" ${done[id] ? "checked" : ""}><span class="task-box">${ico("check")}</span><span class="task-text">${esc(text)}</span></label></li>`).join("")}</ul>
      <div class="tg-foot"><button type="button" class="text-button" data-reset-group="${g.id}">تفريغ علامات المرحلة</button></div>
    </details>`;
  }
  function updateTipsProgress() {
    const done = store.getTipsDone();
    Tips.tabs.forEach(t => t.groups.forEach(g => {
      const ids = checklistIds(g), cnt = $(`tgc-${g.id}`), bar = $(`tgp-${g.id}`);
      if (!ids.length || !cnt || !bar) return;
      const c = ids.filter(id => done[id]).length, pct = Math.round((c / ids.length) * 100);
      cnt.textContent = `${n(c)} من ${n(ids.length)}`; cnt.classList.toggle("is-complete", c === ids.length);
      bar.firstElementChild.style.width = pct + "%"; bar.setAttribute("aria-valuenow", pct);
    }));
    const tp = tipsTotals();
    $("tipsOverall").innerHTML = `<span class="to-label">إنجازك في القوائم</span><strong>${n(tp.done)}<small> / ${n(tp.total)}</small></strong><div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${tp.pct}" aria-label="إنجاز قوائم النصائح"><span style="width:${tp.pct}%"></span></div>`;
  }
  function renderTips() {
    const done = store.getTipsDone(), tab = Tips.tabs.find(t => t.id === tipsTab) || Tips.tabs[0];
    tipsTab = tab.id;
    $("tipsTabs").innerHTML = Tips.tabs.map(t => `<button type="button" role="tab" class="tips-tab ${t.id === tab.id ? "active" : ""}" id="tab-${t.id}" aria-selected="${t.id === tab.id}" aria-controls="tipsBody" tabindex="${t.id === tab.id ? 0 : -1}" data-tab="${t.id}">${ico(t.icon)}<span>${esc(t.label)}</span></button>`).join("");
    $("tipsBody").setAttribute("aria-labelledby", `tab-${tab.id}`);
    $("tipsBody").innerHTML = tab.groups.map((g, i) => (g.kind === "checklist" ? checklistGroupHtml(g, done, i === 0) : tipsGroupHtml(g))).join("") + (tab.id === "honeymoon" ? legacyHoneymoonHtml() : "");
    updateTipsProgress();
  }
  function bindTips() {
    const root = $("view-tips");
    root.addEventListener("click", e => {
      if (e.target.closest("[data-clear-hm-archive]")) {
        if (!confirm("حذف قائمة شنطة شهر العسل القديمة نهائيًا؟ ده مش بيأثر على بنود الجهاز.")) return;
        try { store.clearLegacyHoneymoon(); renderTips(); toast("تم حذف القائمة القديمة."); } catch (error) { toast(error.message || "تعذر الحفظ.", 4200); }
        return;
      }
      const tabBtn = e.target.closest("[data-tab]"), reset = e.target.closest("[data-reset-group]");
      if (tabBtn) { tipsTab = tabBtn.dataset.tab; renderTips(); $(`tab-${tipsTab}`)?.focus({ preventScroll: true }); return; }
      if (reset) {
        const g = Tips.tabs.flatMap(t => t.groups).find(x => x.id === reset.dataset.resetGroup); if (!g) return;
        if (!confirm(`تفريغ علامات «${g.title}»؟ ده مش بيأثر على بنود القائمة.`)) return;
        try {
          store.setTipsDone(checklistIds(g), false);
          $(`tg-${g.id}`).querySelectorAll("input[data-task]").forEach(box => { box.checked = false; box.closest(".task").classList.remove("is-done"); });
          updateTipsProgress(); toast("تم تفريغ علامات المرحلة.");
        } catch (error) { toast(error.message || "تعذر الحفظ.", 4200); }
      }
    });
    root.addEventListener("change", e => {
      const box = e.target.closest("input[data-task]"); if (!box) return;
      try { store.setTipsDone([box.dataset.task], box.checked); box.closest(".task").classList.toggle("is-done", box.checked); updateTipsProgress(); }
      catch (error) { box.checked = !box.checked; toast(error.message || "تعذر الحفظ.", 4200); }
    });
    $("tipsTabs").addEventListener("keydown", e => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      const tabs = [...$("tipsTabs").querySelectorAll("[data-tab]")], i = tabs.findIndex(b => b.dataset.tab === tipsTab);
      const next = tabs[(i + (e.key === "ArrowLeft" ? 1 : -1) + tabs.length) % tabs.length];   /* RTL: اليسار = التالي */
      tipsTab = next.dataset.tab; renderTips(); $(`tab-${tipsTab}`)?.focus({ preventScroll: true }); e.preventDefault();
    });
  }

  /* ---------- النسخ الاحتياطي ---------- */
  function exportData() {
    const blob = new Blob([store.exportData()], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob), link = document.createElement("a");
    link.href = url; link.download = `قائمة-العروسة-نسخة-احتياطية-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("جهزنا ملف النسخة الاحتياطية.");
  }
  function downloadPreV5Backup() {
    const raw = store.getPreV5Backup(); if (!raw) { toast("لا توجد نسخة محفوظة."); return; }
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = "قائمة-العروسة-نسخة-ما-قبل-تحديث-الفئات.json";
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("جهزنا ملف النسخة القديمة.");
  }
  async function importData(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!confirm("استعادة النسخة هتستبدل البيانات الحالية. متأكدة إنك عايزة تكملي؟")) return;
      store.importData(parsed); resolveHero(); render(); toast("تمت استعادة النسخة الاحتياطية.");
    } catch (error) { toast(error instanceof SyntaxError ? "الملف غير صالح أو تعذر استيراده." : (error.message || "تعذر استيراد الملف."), 4200); }
    finally { $("importInput").value = ""; }
  }
  function resetData() {
    if (!confirm("ده هيمسح كل البنود والفئات والإعدادات المحفوظة في المتصفح ويرجع القائمة الافتراضية. هل أنتِ متأكدة؟")) return;
    if (!confirm("تأكيد أخير: صدّري نسخة احتياطية لو محتاجة تحتفظي ببياناتك. نكمل المسح؟")) return;
    try { store.reset(); resolveHero(); Object.keys(detailFilters).forEach(k => delete detailFilters[k]); toast("تمت إعادة ضبط القائمة."); navigate("#/dashboard"); }
    catch (error) { toast(error.message || "تعذر مسح البيانات.", 4200); }
  }

  /* ---------- الربط ---------- */
  function bind() {
    $("welcomeActions").addEventListener("click", e => { const button = e.target.closest("[data-welcome]"); if (button) welcomeHandle(button.dataset.welcome); });
    $("welcomeSkip").addEventListener("click", () => welcomeClose(false));
    $("welcomeDialog").addEventListener("click", e => { if (e.target === $("welcomeDialog")) welcomeClose(false); });
    $("welcomeDialog").addEventListener("cancel", e => { e.preventDefault(); welcomeClose(false); });
    $("welcomeDialog").addEventListener("change", e => { if (e.target.id === "welcomePhotoInput") welcomeSavePhoto(e.target.files?.[0]); });
    $("replayWelcomeButton").addEventListener("click", () => welcomeOpen(true));
    $("aboutReplayButton").addEventListener("click", () => welcomeOpen(true));
    window.addEventListener("hashchange", applyRoute);
    $("addFirstItem").addEventListener("click", () => openItemDialog());
    $("addItemButton").addEventListener("click", () => openItemDialog());
    $("emptyAddButton").addEventListener("click", () => openItemDialog());
    $("addCategoryButton").addEventListener("click", () => openCategoryDialog());
    $("addCategoryInline").addEventListener("click", () => openCategoryDialog());
    $("closeDialog").addEventListener("click", closeItemDialog); $("cancelDialog").addEventListener("click", closeItemDialog);
    $("closeCategoryDialog").addEventListener("click", closeCategoryDialog); $("cancelCategory").addEventListener("click", closeCategoryDialog);
    $("itemForm").addEventListener("submit", handleItemSubmit);
    $("categoryForm").addEventListener("submit", handleCategorySubmit);
    ["itemRequired", "itemPurchased", "itemStatus"].forEach(id => $(id).addEventListener("input", syncItemForm));
    $("itemStatus").addEventListener("change", syncItemForm);
    $("itemDialog").addEventListener("click", e => { if (e.target === $("itemDialog")) closeItemDialog(); });
    $("categoryDialog").addEventListener("click", e => { if (e.target === $("categoryDialog")) closeCategoryDialog(); });

    $("categorySearch").addEventListener("input", e => { categoryQuery = e.target.value.trim().toLocaleLowerCase(); renderCategories(); });
    $("searchInput").addEventListener("input", e => { itemFilters.q = e.target.value.trim().toLocaleLowerCase(); renderItems(); });
    $("categoryFilter").addEventListener("change", e => { itemFilters.cat = e.target.value; renderItems(); });
    $("statusFilter").addEventListener("change", e => { itemFilters.status = e.target.value; renderItems(); });
    $("detailSearch").addEventListener("input", e => { (detailFilters[currentCatId] ||= { q: "", status: "" }).q = e.target.value; renderCategoryDetail(); });
    $("detailStatus").addEventListener("change", e => { (detailFilters[currentCatId] ||= { q: "", status: "" }).status = e.target.value; renderCategoryDetail(); });

    $("itemsList").addEventListener("click", handleItemAction);
    $("detailList").addEventListener("click", handleItemAction);
    $("view-category").addEventListener("click", e => {
      if (e.target.closest("[data-add-here]")) openItemDialog("", currentCatId);
      else if (e.target.closest("[data-edit-cat]")) openCategoryDialog(currentCatId);
      else if (e.target.closest("[data-del-cat]")) deleteCurrentCategory();
    });

    $("profileForm").addEventListener("submit", e => {
      e.preventDefault();
      const date = $("weddingDateInput").value;
      if (date && calc.daysUntil(date) === null) { toast("راجعي تاريخ الفرح."); return; }
      try { store.updateProfile({ name: $("nameInput").value.trim(), weddingDate: date }); render(); toast("تم حفظ بياناتك."); }
      catch (error) { toast(error.message || "تعذر حفظ البيانات.", 4200); }
    });
    $("saveBudgetButton").addEventListener("click", () => {
      const val = $("budgetInput").value;
      try {
        if (val.trim() === "") { store.setBudget(null); renderBudget(); toast("تم مسح الميزانية المحددة."); return; }
        const num = Number(val); if (!Number.isFinite(num) || num < 0) { toast("اكتبي ميزانية صحيحة أكبر من أو تساوي صفر."); return; }
        store.setBudget(num); renderBudget(); toast("تم حفظ الميزانية.");
      } catch (error) { toast(error.message || "تعذر حفظ الميزانية.", 4200); }
    });
    document.addEventListener("click", e => { const b = e.target.closest("[data-edit-budget]"); if (b) { e.preventDefault(); openBudgetDialog(b.dataset.editBudget); } });
    $("budgetForm").addEventListener("submit", e => {
      e.preventDefault();
      const v = $("catBudgetInput").value.trim();
      if (v === "") { saveCatBudget(null); return; }
      const num = Number(v); if (!Number.isFinite(num) || num < 0) { toast("اكتبي ميزانية صحيحة أكبر من أو تساوي صفر."); return; }
      saveCatBudget(num);
    });
    $("clearCatBudget").addEventListener("click", () => saveCatBudget(null));
    $("cancelBudget").addEventListener("click", closeBudgetDialog); $("closeBudgetDialog").addEventListener("click", closeBudgetDialog);
    $("budgetDialog").addEventListener("click", e => { if (e.target === $("budgetDialog")) closeBudgetDialog(); });
    $("heroImageInput").addEventListener("change", e => handleHeroFile(e.target.files?.[0]));
    $("removeImageButton").addEventListener("click", removeHeroImage);
    $("exportButton").addEventListener("click", exportData);
    $("preV5Button").addEventListener("click", downloadPreV5Backup);
    bindTips();
    $("importInput").addEventListener("change", e => importData(e.target.files?.[0]));
    $("resetButton").addEventListener("click", resetData);
    setInterval(() => { if (currentView === "dashboard") renderHero(state()); }, 60000); // تحديث العد بعد منتصف الليل
  }

  Icons.hydrate();
  bind();
  resolveHero();
  applyRoute();
  const migration = store.consumeMigrationNotice();
  if (migration) {
    if (migration.failed) toast("مساحة تخزين المتصفح ممتلئة، فأجّلنا تحديث الفئات علشان بياناتك تفضل زي ما هي. فضّي مساحة وافتحي الصفحة تاني.", 8000);
    else if (migration.v7) {
      const m = migration.v7;
      toast(m.archivedItems
        ? "اتحدّثت الكميات حسب ملف التجهيزات، وشنطة شهر العسل بقت نصائح فقط. اللي كنتِ عدّلتيه فيها اتحفظ في قسم النصائح، وبياناتك كلها زي ما هي."
        : "اتحدّثت الكميات حسب ملف التجهيزات، وشنطة شهر العسل بقت نصائح فقط. بياناتك زي ما هي.", 9000);
    }
    else if (migration.removedCategories) toast("اتحدّثت الفئات والبنود. فئة «الرفايع» وبياناتك زي ما هي، ونسخة القديم محفوظة في الإعدادات.", 8000);
  }
  if (!store.isPersistent()) toast("تنبيه: المتصفح لا يسمح بحفظ البيانات حاليًا، فلن تبقى بعد إغلاق الصفحة.", 6000);
  /* تظهر الجولة لكل مستخدمة لم تكملها أو تؤجلها، دون التأثر بوجود بيانات محفوظة مسبقًا. */
  const welcomeMeta = readWelcomeMeta();
  if (!welcomeMeta.completed && (!welcomeMeta.dismissed || welcomeMeta.legacyUser)) setTimeout(() => welcomeOpen(false), 250);
})();
