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
  const MORE_VIEWS = ["tips", "about", "settings"];   /* تظهر تحت زر «المزيد» في شريط التنقل */
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
  const pctW = v => Math.max(0, Math.min(100, Number(v) || 0));
  /* «N بنود بلا سعر» بصيغة عربية سليمة */
  const unpricedLabel = c => (c === 1 ? "بند واحد بلا سعر" : c === 2 ? "بندان بلا سعر" : c <= 10 ? `${n(c)} بنود بلا سعر` : `${n(c)} بندًا بلا سعر`);
  /* ترتيب مجموعات الفئة كما في الكتالوج؛ بنود المستخدمة (بلا مجموعة) في الآخر */
  function groupRanks(cat) {
    const m = new Map(), defs = window.BrideCatalog && window.BrideCatalog.categories;
    const def = defs && defs.find(d => (d.key === "rafayea" ? "cat-rafayea" : `cat-v5-${d.key}`) === cat.id);
    if (def) def.groups.forEach((g, i) => m.set(g.title, i));
    return m;
  }
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
    id = store.resolveCategoryId(id);   /* رابط قديم لفئة مدموجة يفتح الفئة الموحدة */
    if (view === "category" && !catById(state(), id)) view = "categories";
    currentView = view; currentCatId = view === "category" ? id : "";
    document.querySelectorAll(".view").forEach(el => el.classList.toggle("active", el.id === `view-${view}`));
    const navKey = view === "category" ? "categories" : view;
    document.querySelectorAll("[data-nav]").forEach(el => {
      const on = el.dataset.nav === navKey || (el.dataset.nav === "more" && MORE_VIEWS.includes(view)); el.classList.toggle("active", on);
      if (on) el.setAttribute("aria-current", "page"); else el.removeAttribute("aria-current");
    });
    const moreSheet = $("moreSheet"); if (moreSheet && moreSheet.open) moreSheet.close();
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
  /* صف مضغوط للفئة في الرئيسية (نفس الأرقام، وبدون تكرار بطاقة الفئة الكاملة) */
  function categoryRow(s, cat, sum) {
    const st = calc.categoryState(sum), icon = Icons.iconFor(cat);
    return `<a class="cat-row tone-${toneOf(s, cat)}" href="#/category/${encodeURIComponent(cat.id)}" aria-label="${esc(cat.name)}: ${n(sum.percent)}% إنجاز، ${n(sum.complete)} من ${n(sum.total)} بند مكتمل">
      <span class="cat-row-ic">${ico(icon)}</span>
      <span class="cat-row-main"><strong>${esc(cat.name)}</strong><span class="cat-row-meta">${n(sum.complete)} من ${n(sum.total)} بند · ${catStateLabels[st]}</span><span class="progress-track" aria-hidden="true"><span style="width:${sum.percent}%"></span></span></span>
      <span class="cat-row-pct">${n(sum.percent)}%</span>
    </a>`;
  }
  function itemCard(s, it, showCategory) {
    const st = calc.itemStatus(it), sm = calc.purchaseSummary(it), pct = calc.percentOf(Math.min(sm.purchasedQty, sm.required), sm.required);
    const nm = esc(it.name), unit = esc(it.unit), id = esc(it.id);
    const spentTxt = sm.hasSpent ? `<span>المصروف <b>${money(sm.spent)}${sm.unpricedQty ? "*" : ""}</b></span>` : sm.recordCount || sm.hasLegacy ? `<span class="muted">المصروف <b>غير مسجل</b></span>` : "";
    return `<article class="item-card st-${st}">
      <span class="item-state-icon">${ico(statusIcon[st])}</span>
      <div class="item-info">
        <div class="item-title"><h3>${nm}</h3></div>
        <div class="item-badges"><span class="pill st-${st}">${ico(statusIcon[st])}${statusLabels[st]}</span>${sm.excessQty ? `<span class="pill pill-excess" title="الكمية المشتراة أكبر من المطلوبة">زيادة ${n(sm.excessQty)}</span>` : ""}${showCategory ? `<span class="chip">${esc(catName(s, it.categoryId))}</span>` : ""}</div>
        <dl class="qty-grid"><div><dt>مطلوب</dt><dd>${n(sm.required)} <small>${unit}</small></dd></div><div><dt>مشترى</dt><dd>${n(sm.purchasedQty)}</dd></div><div class="rem"><dt>متبقي</dt><dd>${n(sm.remainingQty)}</dd></div></dl>
        <p class="item-sub item-sub2"><span>عمليات الشراء <b>${n(sm.recordCount)}</b>${sm.hasLegacy ? ` <small class="muted">+ بيانات سابقة</small>` : ""}</span>${spentTxt}</p>
        ${it.notes ? `<p class="item-notes">${esc(it.notes)}</p>` : ""}
        <div class="mini-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}" aria-label="نسبة شراء ${nm}"><span style="width:${pct}%"></span></div>
      </div>
      <div class="item-controls">
        <div class="buy-row">
          <button type="button" class="primary-button buy-btn" data-buy="${id}" ${sm.remainingQty <= 0 ? "disabled title=\"اكتملت الكمية المطلوبة\"" : ""} aria-label="تسجيل شراء لـ ${nm}">${ico("plus")} تسجيل شراء</button>
          <button type="button" class="outline-button log-btn" data-log="${id}" aria-label="فتح سجل مشتريات ${nm}">${ico("receipt")} السجل</button>
        </div>
        <div class="item-actions">
          <button type="button" class="mini-button" data-edit="${id}" title="تعديل" aria-label="تعديل ${nm}">${ico("edit")}</button>
          <button type="button" class="mini-button delete" data-delete="${id}" title="حذف" aria-label="حذف ${nm}">${ico("trash")}</button>
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
    const s = state(), sum = calc.summarize(s.items), ov = calc.overview(s.totalBudget, s.categories, s.items);
    $("welcomeName").textContent = brideName(s);
    $("totalItems").textContent = n(sum.total);
    $("completedItems").textContent = n(sum.complete);
    $("remainingItems").textContent = n(sum.incomplete);
    $("progressBig").textContent = n(sum.percent) + "%";
    $("progressBar").style.width = sum.percent + "%";
    $("progressTrack").setAttribute("aria-valuenow", sum.percent);
    $("budgetLimit").textContent = s.totalBudget === null ? "لم تُحدد بعد" : money(s.totalBudget);
    const plan = ov.plan;
    $("dashAllocated").textContent = plan.setCount ? money(plan.allocated) : "لم تُحدد بعد";
    $("dashDiffLabel").textContent = plan.status === "over" ? "مقدار التجاوز" : "المبلغ غير الموزع";
    $("dashDiff").textContent = plan.status === "over" ? money(plan.overage) : plan.total === null || plan.status === "zero-total" ? "—" : money(plan.unallocated);
    $("dashLeftLabel").textContent = ov.over ? "مقدار التجاوز" : "المتاح بعد القائمة المسعّرة";
    $("dashLeft").textContent = !ov.hasGauge ? "—" : money(ov.over ? ov.overBy : ov.left);   /* نفس حساب صفحة الميزانية */
    $("requiredCost").textContent = costText(ov.requiredCost);
    $("purchasedCost").textContent = costText(ov.purchasedCost);
    $("remainingCost").textContent = costText(ov.remainingCost);
    const dashNote = $("dashUnpriced");
    dashNote.classList.toggle("hidden", !ov.partial);
    dashNote.textContent = ov.partial ? `* ${unpricedLabel(ov.unpricedCount)}، فالأرقام جزئية وتشمل البنود المسعّرة فقط.` : "";
    $("encouragementText").textContent = sum.total === 0 ? "ابدئي بإضافة أول بند في قائمتك، والباقي هيبقى أسهل."
      : sum.percent === 100 ? "برافو عليكي! كل الكميات المطلوبة اتسجلت كمشتراة."
      : `خلصتي ${n(sum.percent)}% من الكميات. خطوة صغيرة كل يوم هتفرق.`;
    renderHero(s);
    const tp = tipsTotals();
    $("tipsPromoText").textContent = tp.done ? `أنجزتي ${n(tp.done)} من ${n(tp.total)} مهمة في جداول التجهيز وقوائم المراجعة.` : "نصائح عملية وجداول تجهيز وقوائم مراجعة لحد يوم الفرح.";
    $("tipsPromoBar").style.width = tp.pct + "%";
    $("dashCategories").innerHTML = sortedCats(s).map(c => categoryRow(s, c, calc.summarize(itemsOf(s, c.id)))).join("") || `<div class="empty-inline">لسه مفيش فئات.</div>`;
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
    const leftTxt = cb.left === null ? "—" : money(cb.over ? cb.overBy : cb.left);
    const cbW = cb.usedPercent === null ? (cb.over ? 100 : 0) : pctW(cb.usedPercent), cbBoughtW = cb.boughtPercent === null ? 0 : Math.min(pctW(cb.boughtPercent), cbW || 100);
    $("detailBudget").innerHTML = `
      <div class="bp-top"><div><h3>ميزانية ${esc(cat.name)}</h3><p class="muted">الميزانية المخصصة مش مبلغ اتدفع، والتكاليف تقديرية حسب الأسعار اللي سجلتيها.</p></div><button type="button" class="outline-button" data-edit-budget="${esc(cat.id)}">${ico("wallet")} ${cb.isSet ? "تعديل الميزانية" : "تحديد ميزانية"}</button></div>
      <div class="cb-grid">
        ${tile("t-budget", "wallet", "الميزانية المخصصة", budgetText(cb.budget))}
        ${tile("t-total", "list", "تكلفة القائمة المسعّرة", costText(cb.requiredCost))}
        ${tile("st-complete", "check", "تكلفة ما تم شراؤه", costText(cb.purchasedCost))}
        ${tile("st-preparing", "clock", "تكلفة الكميات المتبقية", costText(cb.remainingCost))}
        ${tile(cb.over ? "st-missing" : "t-rem", "box", cb.over ? "مقدار التجاوز" : "المتبقي من ميزانية الفئة", leftTxt)}
        ${tile("t-pct", "sparkles", "نسبة استهلاك الميزانية", cb.usedPercent === null ? "—" : n(cb.usedPercent) + "%")}
      </div>
      ${cb.isSet ? `<div class="bd-gauge small ${cb.over ? "is-over" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${cbW}" aria-label="استهلاك ميزانية الفئة"><span class="bd-seg planned" style="width:${cbW}%"></span><span class="bd-seg bought" style="width:${cbBoughtW}%"></span></div>` : ""}
      ${cb.over ? `<div class="budget-status over cb-warn"><span class="status-badge">تجاوزت الميزانية</span><p>تكلفة القائمة المسعّرة أعلى من ميزانية الفئة بحوالي ${money(cb.overBy)}. تقدري تكملي عادي، لكن راجعي الأسعار أو الميزانية.</p></div>` : ""}
      ${cb.partial ? `<p class="bd-partial">* ${unpricedLabel(cb.unpricedCount)} — الأرقام جزئية وتشمل البنود المسعّرة فقط.</p>` : ""}
      ${!cb.isSet ? `<p class="muted">لسه ما حددتيش ميزانية للفئة دي.</p>` : ""}`;
    requestAnimationFrame(() => requestAnimationFrame(() => { const b = $("bigBar"); if (b) b.style.width = sum.percent + "%"; }));

    $("detailSearch").value = f.q; $("detailStatus").value = f.status;
    const q = f.q.trim().toLocaleLowerCase();
    const list = all.filter(it => matches(s, it, q) && (!f.status || calc.itemStatus(it) === f.status));
    const ranks = groupRanks(cat), rk = it => (it.group ? (ranks.has(it.group) ? ranks.get(it.group) : 500) : 1000);
    list.sort((a, b) => rk(a) - rk(b) || a.sortOrder - b.sortOrder);   /* مجموعات الكتالوج بترتيبها، وبنودك في الآخر (عرض فقط، لا يغيّر البيانات) */
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
  function categoryBudgetCard(s, cat, items) {
    const b = calc.categoryBudget(cat, items), tone = toneOf(s, cat);
    const badge = b.status === "unset" ? ["unset", "لم تُحدد ميزانية"] : b.over ? ["over", "تجاوزت الميزانية"] : b.partial ? ["within", "ضمن الميزانية حتى الآن"] : ["within", "ضمن الميزانية"];
    const plannedW = !b.isSet ? 0 : b.usedPercent === null ? (b.over ? 100 : 0) : pctW(b.usedPercent), boughtW = b.boughtPercent === null ? 0 : pctW(b.boughtPercent);
    const stat = (label, value, cls = "") => `<div class="${cls}"><dt>${label}</dt><dd>${value}</dd></div>`;
    return `<article class="bd-cat tone-${tone} is-${b.status}">
      <header class="bd-cat-head"><a class="cb-link" href="#/category/${encodeURIComponent(cat.id)}"><span class="mini-ic tone-${tone}">${ico(Icons.iconFor(cat))}</span><div><strong>${esc(cat.name)}</strong><small>${n(items.length)} بند</small></div></a><span class="bd-badge ${badge[0]}">${badge[1]}</span></header>
      <div class="bd-cat-budget"><div><span>الميزانية المخصصة</span><strong class="${b.isSet ? "" : "unset"}">${budgetText(b.budget)}</strong></div><button type="button" class="outline-button mini-text-button" data-edit-budget="${esc(cat.id)}">${b.isSet ? "تعديل الميزانية" : "تحديد ميزانية"}</button></div>
      ${b.isSet ? `<div class="bd-gauge small ${b.over ? "is-over" : ""}" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${plannedW}" aria-label="استهلاك ميزانية ${esc(cat.name)}"><span class="bd-seg planned" style="width:${plannedW}%"></span><span class="bd-seg bought" style="width:${Math.min(boughtW, plannedW || boughtW)}%"></span></div>
      <p class="bd-used">${b.usedPercent === null ? (b.over ? "ميزانية صفر وفيه تكلفة مسجلة" : "—") : `استهلاك ${n(b.usedPercent)}% من الميزانية`}</p>` : ""}
      <dl class="bd-grid">${stat("القائمة المسعّرة", costText(b.requiredCost))}${stat("تم شراؤه", costText(b.purchasedCost))}${stat("الكميات المتبقية", costText(b.remainingCost))}${b.isSet ? stat(b.over ? "مقدار التجاوز" : "المتبقي من الميزانية", money(b.over ? b.overBy : b.left), b.over ? "is-over" : "is-ok") : ""}</dl>
      ${b.partial ? `<p class="bd-partial">* ${unpricedLabel(b.unpricedCount)} — الأرقام جزئية${b.over ? "، والتجاوز الفعلي قد يكون أكبر" : ""}.</p>` : ""}
    </article>`;
  }
  function renderBudget() {
    const s = state(), ov = calc.overview(s.totalBudget, s.categories, s.items), plan = ov.plan;
    $("budgetInput").value = s.totalBudget === null ? "" : s.totalBudget;
    /* بطاقة تكلفة القائمة المسعّرة + توضيح أنها جزئية لو فيه بنود بلا سعر */
    $("budgetRequired").textContent = costText(ov.requiredCost);
    $("budgetRequiredNote").textContent = ov.partial ? `جزئية: ${unpricedLabel(ov.unpricedCount)}` : ov.pricedCount ? "كل البنود المطلوبة مسعّرة" : "لا توجد أسعار مسجلة بعد";
    $("listCostCard").classList.toggle("is-partial", ov.partial);
    $("budgetPurchased").textContent = costText(ov.purchasedCost);
    $("budgetRemaining").textContent = costText(ov.remainingCost);
    /* مؤشر استهلاك الميزانية الإجمالية */
    const gauge = $("bdGauge"), box = $("budgetStatus");
    gauge.classList.toggle("is-over", ov.over);
    const plannedW = ov.hasGauge ? pctW(ov.usedPercent) : 0, boughtW = ov.hasGauge ? Math.min(pctW(ov.boughtPercent), plannedW || 100) : 0;
    $("bdSegPlanned").style.width = plannedW + "%"; $("bdSegBought").style.width = boughtW + "%";
    gauge.setAttribute("aria-valuenow", plannedW);
    $("bdGaugePercent").textContent = ov.hasGauge ? n(ov.usedPercent) + "%" : "—";
    $("bdLeftLabel").textContent = ov.over ? "مقدار التجاوز" : "المتاح بعد القائمة المسعّرة";
    $("bdLeft").textContent = !ov.hasGauge ? "—" : money(ov.over ? ov.overBy : ov.left);
    if (plan.total === null) {
      box.className = "budget-status"; box.innerHTML = `<span class="status-badge">لم تُحدد ميزانية بعد</span><p>حددي الميزانية الإجمالية علشان يظهر استهلاك الميزانية.</p>`;
    } else if (plan.total === 0) {
      box.className = "budget-status"; box.innerHTML = `<span class="status-badge">الميزانية الإجمالية صفر</span><p>حددي مبلغًا أكبر من صفر علشان نحسب نسبة الاستهلاك.</p>`;
    } else if (ov.over) {
      box.className = "budget-status over"; box.innerHTML = `<span class="status-badge">تجاوزت الميزانية</span><p>تكلفة القائمة المسعّرة أعلى من ميزانيتك الإجمالية بحوالي ${money(ov.overBy)}.${ov.partial ? ` وده الحد الأدنى للتجاوز، لأن ${unpricedLabel(ov.unpricedCount)} لسه.` : " راجعي الأولويات والأسعار."}</p>`;
    } else if (ov.partial) {
      box.className = "budget-status"; box.innerHTML = `<span class="status-badge">ضمن الميزانية حتى الآن</span><p>البنود المسعّرة تكلّف ${money(ov.requiredCost.total)} (${n(ov.usedPercent)}% من ميزانيتك). لسه ${unpricedLabel(ov.unpricedCount)}، فالتكلفة النهائية هتبقى أعلى من الرقم ده. سجلي أسعارها علشان الصورة تكتمل.</p>`;
    } else if (!ov.pricedCount) {
      box.className = "budget-status"; box.innerHTML = `<span class="status-badge">لا توجد أسعار بعد</span><p>سجلي سعر الوحدة للبنود علشان تظهر تكلفة القائمة.</p>`;
    } else {
      box.className = "budget-status good"; box.innerHTML = `<span class="status-badge">ضمن الميزانية</span><p>كل البنود المطلوبة مسعّرة، ومتبقي ${money(ov.left)} من ميزانيتك بعد تكلفة القائمة.</p>`;
    }
    /* توزيع الميزانية على الفئات */
    const msg = planMessage(plan);
    const alertBox = $("budgetAlert");
    alertBox.className = `budget-status plan-alert ${msg.cls}`;
    alertBox.innerHTML = `<strong>${msg.title}</strong>${msg.text ? `<p>${msg.text}</p>` : ""}`;
    $("planTotal").textContent = budgetText(plan.total);
    $("planAllocated").textContent = plan.setCount ? money(plan.allocated) : "لم تُحدد بعد";
    $("planCounts").textContent = `${n(plan.setCount)} فئة محددة · ${n(plan.unsetCount)} لم تُحدد`;
    const card = $("planDiffCard");
    card.classList.remove("is-good", "is-over", "is-warn");
    if (plan.status === "over") {
      $("planDiffLabel").textContent = "مقدار التجاوز"; $("planDiff").textContent = money(plan.overage); $("planDiffNote").textContent = "ميزانيات الفئات أكبر من الإجمالية"; card.classList.add("is-over");
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
    /* بطاقات الفئات */
    const cats = sortedCats(s);
    $("categoryCostList").innerHTML = cats.length ? cats.map(cat => categoryBudgetCard(s, cat, itemsOf(s, cat.id))).join("") : `<div class="empty-inline">أضيفي فئات علشان تحددي لها ميزانيات.</div>`;
  }
  function renderSettings() {
    const s = state();
    $("nameInput").value = (s.profile.name || "").trim();            /* الفارغ = الاسم الافتراضي (يتغير من storage.js) */
    $("nameInput").placeholder = store.DEFAULT_BRIDE_NAME;
    $("weddingDateInput").value = s.profile.weddingDate;
    $("preV5Row").classList.toggle("hidden", !store.getPreV5Backup());
    $("preV8Row").classList.toggle("hidden", !store.getPreV8Backup());
    $("preV9Row").classList.toggle("hidden", !store.getPreV9Backup());
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
  function openItemDialog(id = "", presetCat = "") {
    const s = state();
    if (!s.categories.length) { openCategoryDialog(); toast("ضيفي فئة الأول علشان تضيفي بند."); return; }
    $("itemForm").reset(); $("itemId").value = id || "";
    $("itemRequired").value = "1"; $("itemUnit").value = "قطعة"; $("itemPrice").value = ""; $("itemStatus").value = "missing"; $("itemStatus").disabled = false;
    $("itemStatus").querySelector('option[value="complete"]').hidden = true;
    fillCategorySelects();
    if (id) {
      const item = s.items.find(it => it.id === id); if (!item) return;
      $("dialogTitle").textContent = "تعديل البند";
      $("itemName").value = item.name; $("itemCategory").value = item.categoryId; $("itemUnit").value = item.unit;
      $("itemRequired").value = item.required;
      $("itemPrice").value = item.unitPrice === null ? "" : item.unitPrice; $("itemNotes").value = item.notes;
      const bought = calc.purchasedQty(item);
      if (bought > 0) { /* الحالة مشتقة من سجل المشتريات: نعرضها فقط */
        $("itemStatus").querySelector('option[value="complete"]').hidden = false;
        $("itemStatus").value = calc.itemStatus(item); $("itemStatus").disabled = true;
      } else $("itemStatus").value = item.status === "preparing" ? "preparing" : "missing";
    } else {
      $("dialogTitle").textContent = "إضافة بند جديد";
      const preset = presetCat || (currentView === "category" ? currentCatId : "");
      if (preset && s.categories.some(c => c.id === preset)) $("itemCategory").value = preset;
    }
    $("itemDialog").showModal();
  }
  const closeItemDialog = () => $("itemDialog").close();
  function handleItemSubmit(event) {
    event.preventDefault();
    const data = { name: $("itemName").value, categoryId: $("itemCategory").value, unit: $("itemUnit").value, required: $("itemRequired").value, unitPrice: $("itemPrice").value, status: $("itemStatus").value, notes: $("itemNotes").value };
    try {
      const id = $("itemId").value;
      const prevBought = id ? calc.purchasedQty(state().items.find(it => it.id === id) || {}) : 0;
      if (id) store.updateItem(id, data); else store.addItem(data);
      closeItemDialog(); render();
      toast(id && prevBought > Number(data.required) ? "تم تحديث البند. الكمية المشتراة أكبر من المطلوبة فبتظهر كزيادة، ومفيش عمليات اتحذفت." : id ? "تم تحديث البند بنجاح." : "اتضاف البند لقائمتك.");
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
    const edit = e.target.closest("[data-edit]"), del = e.target.closest("[data-delete]"), buy = e.target.closest("[data-buy]"), log = e.target.closest("[data-log]");
    const s = state();
    if (edit) openItemDialog(edit.dataset.edit);
    else if (buy && !buy.disabled) openPurchaseDialog(buy.dataset.buy);
    else if (log) openPurchaseLog(log.dataset.log);
    else if (del) {
      const item = s.items.find(it => it.id === del.dataset.delete); if (!item) return;
      const cnt = Array.isArray(item.purchases) ? item.purchases.length : 0;
      if (confirm(cnt ? `متأكدة إنك عايزة تحذفي "${item.name}"؟ هيتحذف معاه سجل مشتريات فيه ${n(cnt)} عملية.` : `متأكدة إنك عايزة تحذفي "${item.name}"؟`)) {
        try { store.deleteItem(item.id); render(); toast("تم حذف البند."); } catch (error) { toast(error.message || "تعذر حذف البند.", 4200); }
      }
    }
  }

  /* ---------- سجل المشتريات ---------- */
  const PU = window.BridePurchases;
  const todayStr = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const dateText = ds => (ds && PU.isValidDate(ds) ? new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(+ds.slice(0, 4), +ds.slice(5, 7) - 1, +ds.slice(8, 10))) : "");
  const itemById = id => state().items.find(it => it.id === id);
  let logItemId = "";
  const dlgOpen = id => $(id).open;

  function plMessage(text, kind) { const el = $("plMsg"); el.textContent = text || ""; el.hidden = !text; el.className = `pl-msg ${kind || ""}`; }
  function purchaseCard(it, r, num) {
    const unitP = PU.unitPriceOf(r), type = r.type || "general";
    const labelOf = k => { const f = PU.fieldsFor(type).find(x => x.key === k); return f ? f.label : (PU.LABELS[k] || k); };
    const fmt = (k, v) => { const f = PU.fieldsFor(type).find(x => x.key === k); return f && f.kind === "date" ? (dateText(v) || v) : v; };
    const chips = Object.keys(r.details || {}).map(k => `<span class="pc-chip"><small>${esc(labelOf(k))}</small>${esc(fmt(k, r.details[k]))}</span>`).join("") + (r.custom || []).map(c => `<span class="pc-chip custom"><small>${esc(c.label)}</small>${esc(c.value)}</span>`).join("");
    const price = r.totalPrice === null || r.totalPrice === undefined ? `<span class="pc-price none">السعر غير مسجل</span>` : `<span class="pc-price"><b>${money(r.totalPrice)}</b>${unitP === null ? "" : ` <small>(${money(unitP)} للوحدة)</small>`}</span>`;
    return `<article class="pc-card" data-pid="${esc(r.id)}">
      <header class="pc-head"><strong>عملية شراء ${n(num)}</strong><span class="pc-qty">${n(r.qty)} ${esc(it.unit)}</span>${price}</header>
      <p class="pc-meta">${r.date ? `<span>${esc(dateText(r.date))}</span>` : `<span class="muted">بدون تاريخ</span>`}${r.store ? `<span>${esc(r.store)}</span>` : ""}</p>
      ${chips ? `<div class="pc-chips">${chips}</div>` : ""}
      ${r.notes ? `<p class="pc-notes">${esc(r.notes)}</p>` : ""}
      <div class="pc-actions"><button type="button" class="outline-button" data-pedit="${esc(r.id)}">${ico("edit")} تعديل</button><button type="button" class="outline-button danger" data-pdel="${esc(r.id)}">${ico("trash")} حذف</button></div>
    </article>`;
  }
  function renderPurchaseLog() {
    const it = itemById(logItemId); if (!it) { if (dlgOpen("purchaseLogDialog")) $("purchaseLogDialog").close(); return; }
    const sm = calc.purchaseSummary(it), recs = (it.purchases || []);
    $("plTitle").textContent = it.name;
    const tile = (label, value, cls = "") => `<div class="pl-tile ${cls}"><span>${label}</span><strong>${value}</strong></div>`;
    $("plSummary").innerHTML = `<div class="pl-tiles">${tile("المطلوب", `${n(sm.required)} ${esc(it.unit)}`)}${tile("المشترى", n(sm.purchasedQty))}${tile("المتبقي", n(sm.remainingQty))}${tile("عمليات الشراء", n(sm.recordCount))}${tile("إجمالي المصروف", sm.hasSpent ? money(sm.spent) + (sm.unpricedQty ? "*" : "") : "غير مسجل")}${tile("متوسط سعر الوحدة", sm.avgUnit === null ? "غير متاح" : money(sm.avgUnit))}</div>
      ${sm.excessQty ? `<p class="pl-note warn">الكمية المشتراة (${n(sm.purchasedQty)}) أكبر من المطلوبة (${n(sm.required)}) بمقدار ${n(sm.excessQty)}. سجل المشتريات زي ما هو ولم يُعدَّل أي شيء.</p>` : ""}
      ${sm.unpricedQty ? `<p class="pl-note">* ${n(sm.unpricedQty)} من الكمية بلا سعر مسجل، ولا تدخل في المصروف ولا في المتوسط (ولا تُعتبر مجانية).</p>` : ""}
      <div class="pl-add"><button type="button" class="primary-button" id="plAdd" ${sm.remainingQty <= 0 ? "disabled" : ""}>${ico("plus")} ${recs.length || sm.hasLegacy ? "تسجيل شراء" : "تسجيل أول عملية شراء"}</button>${sm.remainingQty <= 0 ? `<small class="muted">اكتملت الكمية المطلوبة. لو اشتريتِ أكثر، عدّلي «الكمية المطلوبة» من تعديل البند.</small>` : ""}</div>`;
    const legacy = sm.hasLegacy ? `<article class="pc-card legacy"><header class="pc-head"><strong>بيانات شراء سابقة غير مفصلة</strong><span class="pc-qty">${n(sm.legacyQty)} ${esc(it.unit)}</span>${it.legacy.unitPrice === null || it.legacy.unitPrice === undefined ? `<span class="pc-price none">السعر غير مسجل</span>` : `<span class="pc-price"><b>${money(sm.legacyQty * it.legacy.unitPrice)}</b> <small>(${money(it.legacy.unitPrice)} للوحدة)</small></span>`}</header><p class="pc-notes muted">دي الكمية والسعر المسجلين قبل إضافة سجل المشتريات. مش بنعرف تاريخها ولا تفاصيلها، ومحسوبة في الكميات والمصروف مرة واحدة فقط.</p></article>` : "";
    const ordered = recs.map((r, i) => ({ r, num: i + 1 })).sort((a, b) => (b.r.date || "").localeCompare(a.r.date || "") || b.num - a.num);
    $("plBody").innerHTML = (recs.length ? ordered.map(o => purchaseCard(it, o.r, o.num)).join("") : `<div class="empty-inline pl-empty"><p>لم يتم تسجيل أي عملية شراء بعد.</p></div>`) + legacy;
    Icons.hydrate($("purchaseLogDialog"));
  }
  function openPurchaseLog(itemId) { logItemId = itemId; plMessage(""); renderPurchaseLog(); if (!dlgOpen("purchaseLogDialog")) $("purchaseLogDialog").showModal(); }
  function closePurchaseLog() { $("purchaseLogDialog").close(); logItemId = ""; render(); }

  /* ---------- نافذة تسجيل/تعديل عملية شراء ---------- */
  const pd = { itemId: "", id: "", details: {}, custom: [], customSeq: 0, typeKey: "general" };
  function pdFieldHtml(f, value) {
    const id = `pdf-${f.key}`, v = esc(value || "");
    const input = f.kind === "select" ? `<select id="${id}" data-dkey="${f.key}"><option value="">—</option>${f.options.map(o => `<option ${o === value ? "selected" : ""}>${esc(o)}</option>`).join("")}</select>`
      : f.kind === "number" ? `<input id="${id}" data-dkey="${f.key}" type="number" min="0" step="1" inputmode="numeric" value="${v}">`
      : f.kind === "date" ? `<input id="${id}" data-dkey="${f.key}" type="date" value="${v}">`
      : `<input id="${id}" data-dkey="${f.key}" type="text" maxlength="120" value="${v}">`;
    return `<label>${esc(f.label)}${input}</label>`;
  }
  function pdCaptureDetails() {
    document.querySelectorAll("#pdFields [data-dkey]").forEach(el => { const v = el.value.trim(); if (v) pd.details[el.dataset.dkey] = v; else delete pd.details[el.dataset.dkey]; });
  }
  function pdRenderFields() {
    const fields = PU.fieldsFor(pd.typeKey);
    $("pdFields").innerHTML = `<div class="form-grid">${fields.map(f => pdFieldHtml(f, pd.details[f.key])).join("")}</div>`;
    $("pdTypeNote").textContent = PU.typeLabel(pd.typeKey);
  }
  function pdCaptureCustom() {
    document.querySelectorAll("#pdCustomList .pd-crow").forEach(row => { const c = pd.custom.find(x => x.id === row.dataset.cid); if (c) { c.label = row.querySelector("[data-clabel]").value; c.value = row.querySelector("[data-cvalue]").value; } });
  }
  function pdRenderCustom() {
    $("pdCustomList").innerHTML = pd.custom.map(c => `<div class="pd-crow" data-cid="${esc(c.id)}"><label>اسم التفصيلة<input data-clabel maxlength="60" value="${esc(c.label)}" placeholder="مثال: نوع التطريز"></label><label>القيمة<input data-cvalue maxlength="200" value="${esc(c.value)}" placeholder="مثال: تطريز يدوي"></label><button type="button" class="mini-button delete" data-cdel="${esc(c.id)}" aria-label="حذف التفصيلة">${ico("trash")}</button></div>`).join("");
    $("pdCustomCount").textContent = pd.custom.length ? `(${n(pd.custom.length)})` : "";
  }
  function pdUpdateUnit() {
    const q = Number($("pdQty").value), t = $("pdTotal").value.trim(), box = $("pdUnit");
    if (t === "") box.textContent = "السعر غير مسجل: العملية دي مش هتدخل في المصروف، ومش بتتحسب مجانية.";
    else if (!Number.isFinite(Number(t)) || Number(t) < 0) box.textContent = "";
    else if (!Number.isInteger(q) || q < 1) box.textContent = "اكتبي كمية صحيحة علشان نحسب سعر الوحدة.";
    else box.textContent = Number(t) === 0 ? "السعر مسجل صفرًا (سعر الوحدة 0)." : `سعر الوحدة = ${money(Math.round((Number(t) / q) * 100) / 100)} (محسوب تلقائيًا)`;
  }
  function pdError(msg) { const el = $("pdError"); el.textContent = msg || ""; el.hidden = !msg; if (msg) el.scrollIntoView({ block: "nearest" }); }
  function openPurchaseDialog(itemId, purchaseId = "") {
    const it = itemById(itemId); if (!it) return;
    const cat = catById(state(), it.categoryId), sm = calc.purchaseSummary(it);
    const rec = purchaseId ? (it.purchases || []).find(r => r.id === purchaseId) : null;
    if (purchaseId && !rec) return;
    if (!rec && sm.remainingQty <= 0) { const msg = "الكمية المطلوبة من هذا البند اتسجلت كلها. لو اشتريتِ أكثر، عدّلي «الكمية المطلوبة» الأول."; if (dlgOpen("purchaseLogDialog")) plMessage(msg, "err"); else toast(msg, 4200); return; }
    $("purchaseForm").reset(); pdError("");
    Object.assign(pd, { itemId, id: purchaseId, details: rec ? { ...(rec.details || {}) } : {}, custom: rec ? (rec.custom || []).map(c => ({ ...c })) : [], customSeq: 0, typeKey: rec ? (rec.type || "general") : PU.resolveType(it, cat) });
    $("pdItemId").value = itemId; $("pdId").value = purchaseId; $("pdItemName").textContent = it.name;
    $("pdTitle").textContent = rec ? "تعديل عملية شراء" : "تسجيل شراء";
    $("savePurchase").textContent = rec ? "حفظ التعديل" : "حفظ العملية";
    const maxQty = rec ? (sm.excessQty > 0 ? rec.qty : sm.remainingQty + rec.qty) : sm.remainingQty;
    $("pdLeft").textContent = rec ? `أقصى كمية لهذه العملية ${n(maxQty)} ${it.unit} (المطلوب ${n(sm.required)} والمشترى ${n(sm.purchasedQty)}).` : `المتبقي من هذا البند ${n(sm.remainingQty)} ${it.unit} من ${n(sm.required)} مطلوب.`;
    $("pdQty").max = String(maxQty); $("pdQty").value = rec ? rec.qty : "1";
    $("pdTotal").value = rec && rec.totalPrice !== null && rec.totalPrice !== undefined ? rec.totalPrice : "";
    $("pdDate").value = rec ? (rec.date || "") : todayStr();
    $("pdStore").value = rec ? rec.store || "" : ""; $("pdNotes").value = rec ? rec.notes || "" : "";
    $("pdType").innerHTML = PU.TYPE_KEYS.map(k => `<option value="${k}">${esc(PU.typeLabel(k))}</option>`).join("");
    if (!PU.TYPES[pd.typeKey]) $("pdType").insertAdjacentHTML("beforeend", `<option value="${esc(pd.typeKey)}">${esc(pd.typeKey)}</option>`);
    $("pdType").value = pd.typeKey;
    pdRenderFields(); pdRenderCustom();
    $("pdCustomBox").open = pd.custom.length > 0; $("pdMoreBox").open = !!(rec && rec.notes);
    $("pdDetailsBox").open = true;
    pdUpdateUnit();
    $("purchaseDialog").showModal(); $("pdQty").focus();
  }
  function closePurchaseDialog() { $("purchaseDialog").close(); }
  function handlePurchaseSubmit(event) {
    event.preventDefault(); pdError("");
    pdCaptureDetails(); pdCaptureCustom();
    const qtyRaw = $("pdQty").value.trim(), totalRaw = $("pdTotal").value.trim();
    const data = { qty: qtyRaw === "" ? NaN : Number(qtyRaw), totalPrice: totalRaw === "" ? null : Number(totalRaw), date: $("pdDate").value, store: $("pdStore").value, notes: $("pdNotes").value, type: pd.typeKey, details: { ...pd.details }, custom: pd.custom.map(c => ({ id: c.id, label: c.label, value: c.value })) };
    let saved;
    try { saved = pd.id ? store.updatePurchase(pd.itemId, pd.id, data) : store.addPurchase(pd.itemId, data); }
    catch (error) { pdError(error.message || "حصلت مشكلة أثناء الحفظ."); return; }
    closePurchaseDialog(); render();
    const msg = pd.id ? "تم تعديل عملية الشراء." : "تم تسجيل عملية الشراء.";
    if (dlgOpen("purchaseLogDialog")) { renderPurchaseLog(); plMessage(msg, "ok"); } else toast(msg, 2800);
  }
  function bindPurchases() {
    $("closePurchaseLog").addEventListener("click", closePurchaseLog);
    $("purchaseLogDialog").addEventListener("click", e => { if (e.target === $("purchaseLogDialog")) closePurchaseLog(); });
    $("purchaseLogDialog").addEventListener("cancel", () => { logItemId = ""; setTimeout(render, 0); });
    $("purchaseLogDialog").addEventListener("click", e => {
      if (e.target.closest("#plAdd")) { openPurchaseDialog(logItemId); return; }
      const ed = e.target.closest("[data-pedit]"), del = e.target.closest("[data-pdel]");
      if (ed) openPurchaseDialog(logItemId, ed.dataset.pedit);
      else if (del) {
        const it = itemById(logItemId), r = it && (it.purchases || []).find(x => x.id === del.dataset.pdel); if (!r) return;
        if (!confirm(`حذف عملية الشراء هذه (${n(r.qty)} ${it.unit}${r.totalPrice === null ? "" : "، " + money(r.totalPrice)})؟ هيتحدّث المشترى والمصروف، ومش هتتأثر باقي العمليات.`)) return;
        try { store.deletePurchase(logItemId, r.id); renderPurchaseLog(); render(); plMessage("تم حذف العملية وتحديث الكميات والمصروف.", "ok"); }
        catch (error) { plMessage(error.message || "تعذر حذف العملية.", "err"); }
      }
    });
    $("closePurchase").addEventListener("click", closePurchaseDialog); $("cancelPurchase").addEventListener("click", closePurchaseDialog);
    $("purchaseDialog").addEventListener("click", e => { if (e.target === $("purchaseDialog")) closePurchaseDialog(); });
    $("purchaseForm").addEventListener("submit", handlePurchaseSubmit);
    ["pdQty", "pdTotal"].forEach(id => $(id).addEventListener("input", pdUpdateUnit));
    $("pdType").addEventListener("change", () => { pdCaptureDetails(); pd.typeKey = $("pdType").value; pdRenderFields(); });
    $("pdAddCustom").addEventListener("click", () => { pdCaptureCustom(); pd.custom.push({ id: `cf-${Date.now().toString(36)}-${++pd.customSeq}`, label: "", value: "" }); pdRenderCustom(); $("pdCustomBox").open = true; const last = $("pdCustomList").querySelector(".pd-crow:last-child [data-clabel]"); if (last) last.focus(); });
    $("pdCustomList").addEventListener("click", e => { const d = e.target.closest("[data-cdel]"); if (!d) return; pdCaptureCustom(); pd.custom = pd.custom.filter(c => c.id !== d.dataset.cdel); pdRenderCustom(); });
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
  async function compressImage(file, outMax = IMG_OUT_MAX, steps = [[1080, .82], [1080, .7], [900, .7], [720, .65], [600, .6]]) {
    const img = await loadImageFile(file), w0 = img.naturalWidth, h0 = img.naturalHeight;
    if (!w0 || !h0) throw new Error("تعذر قراءة أبعاد الصورة.");
    for (const [dim, q] of steps) {
      const k = Math.min(1, dim / Math.max(w0, h0)), c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(w0 * k)); c.height = Math.max(1, Math.round(h0 * k));
      const ctx = c.getContext("2d"); ctx.fillStyle = "#f6ece3"; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
      const url = c.toDataURL("image/jpeg", q);
      if (url.length <= outMax) return url;
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
    const hasBudget = !!arch && arch.budget !== null && arch.budget !== undefined;   /* الصفر ميزانية محددة؛ null = لا ميزانية قديمة */
    if (!arch || (!arch.items.length && !hasBudget)) return "";
    const rows = arch.items.map(it => {
      const bits = [`${n(it.purchased)} من ${n(it.required)} ${esc(it.unit)}`];
      if (it.unitPrice !== null) bits.push(`السعر ${money(it.unitPrice)}`);
      if (it.notes) bits.push(esc(it.notes));
      return `<li><strong>${esc(it.name)}</strong><span class="muted"> — ${bits.join(" • ")}</span></li>`;
    }).join("");
    const when = arch.archivedAt && !Number.isNaN(Date.parse(arch.archivedAt)) ? new Intl.DateTimeFormat("ar-EG", { day: "numeric", month: "long", year: "numeric" }).format(new Date(arch.archivedAt)) : "";
    const budgetBlock = hasBudget ? `<div class="legacy-budget"><span>الميزانية القديمة لشنطة شهر العسل</span><strong>${money(arch.budget)}</strong><small>ميزانية قديمة محفوظة من قائمة سابقة${when ? ` (${when})` : ""}، وليست ميزانية مشتريات نشطة. لا تدخل في ميزانيتك الحالية ولا في تكلفة القائمة.</small></div>` : "";
    return `<section class="tips-group tone-beige" id="tg-hm-archive">
      <header class="tg-head"><span class="tg-ic">${ico("box")}</span><div class="tg-title"><h2>ما حفظتيه من شنطة شهر العسل القديمة</h2><p class="muted">للاطلاع فقط — غير محسوب في المشتريات أو الميزانية</p></div></header>
      <div class="tg-list">${budgetBlock}${rows ? `<ul class="legacy-list">${rows}</ul>
      <p class="form-hint">دي بنود كنتِ عدّلتيها قبل تحويل الشنطة إلى نصائح. لو مش محتاجاها، تقدري تحذفيها من هنا.</p>` : `<p class="form-hint">مفيش بنود محفوظة معاها. لو مش محتاجاها، تقدري تحذفي الأرشيف من هنا.</p>`}
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
        if (!confirm("حذف أرشيف شنطة شهر العسل القديمة (البنود والميزانية القديمة المحفوظة) نهائيًا؟ ده مش بيأثر على بنود الجهاز ولا ميزانيتك الحالية.")) return;
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
  function downloadPreV8Backup() {
    const raw = store.getPreV8Backup(); if (!raw) { toast("لا توجد نسخة محفوظة."); return; }
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = "قائمة-العروسة-نسخة-ما-قبل-دمج-الرفايع.json";
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("جهزنا ملف النسخة القديمة.");
  }
  function downloadPreV9Backup() {
    const raw = store.getPreV9Backup(); if (!raw) { toast("لا توجد نسخة محفوظة."); return; }
    const url = URL.createObjectURL(new Blob([raw], { type: "application/json;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = "قائمة-العروسة-نسخة-ما-قبل-سجل-المشتريات.json";
    document.body.appendChild(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast("جهزنا ملف النسخة القديمة.");
  }
  async function importData(file) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!confirm("استعادة النسخة هتستبدل البيانات الحالية. متأكدة إنك عايزة تكملي؟")) return;
      store.importData(parsed); resolveHero(); render();
      const info = store.getLastImportInfo();
      toast(info.imagesMissing ? `تمت استعادة النسخة الاحتياطية، لكن ${n(info.imagesMissing)} صورة مشتريات لم تُستعد (غير موجودة في الملف أو المساحة ممتلئة). باقي البيانات سليمة.` : "تمت استعادة النسخة الاحتياطية.", info.imagesMissing ? 7000 : 2800);
    } catch (error) { toast(error instanceof SyntaxError ? "الملف غير صالح أو تعذر استيراده." : (error.message || "تعذر استيراد الملف."), 4200); }
    finally { $("importInput").value = ""; }
  }
  function resetData() {
    const dlg = $("resetDialog"); $("resetAck").checked = false; $("confirmReset").disabled = true;
    dlg.showModal();
  }
  function confirmResetData(event) {
    event.preventDefault();
    if (!$("resetAck").checked) return;
    try {
      store.reset(); resolveHero(); Object.keys(detailFilters).forEach(k => delete detailFilters[k]);
      $("resetDialog").close(); toast("تمت إعادة ضبط القائمة."); navigate("#/dashboard"); render();
    } catch (error) { toast(error.message || "تعذر مسح البيانات.", 4200); }
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
    $("preV8Button").addEventListener("click", downloadPreV8Backup);
    $("preV9Button").addEventListener("click", downloadPreV9Backup);
    bindTips(); bindPurchases();
    $("importInput").addEventListener("change", e => importData(e.target.files?.[0]));
    $("resetButton").addEventListener("click", resetData);
    $("resetAck").addEventListener("change", e => { $("confirmReset").disabled = !e.target.checked; });
    $("resetForm").addEventListener("submit", confirmResetData);
    $("cancelReset").addEventListener("click", () => $("resetDialog").close()); $("closeReset").addEventListener("click", () => $("resetDialog").close());
    $("resetExportFirst").addEventListener("click", exportData);
    $("resetDialog").addEventListener("click", e => { if (e.target === $("resetDialog")) $("resetDialog").close(); });
    /* «المزيد» في شريط التنقل */
    $("moreButton").addEventListener("click", () => $("moreSheet").showModal());
    $("closeMore").addEventListener("click", () => $("moreSheet").close());
    $("moreSheet").addEventListener("click", e => { if (e.target === $("moreSheet") || e.target.closest("a")) $("moreSheet").close(); });
    /* التنقل بين أقسام الإعدادات دون المساس بمسار الصفحة (#/settings) */
    document.querySelector(".settings-jump").addEventListener("click", e => {
      const a = e.target.closest("[data-jump]"); if (!a) return;
      e.preventDefault(); const t = $(a.dataset.jump); if (t) t.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    });
    /* رسائل تحقق عربية موحّدة + منع الضغط المتكرر أثناء الحفظ */
    ["itemForm", "categoryForm", "purchaseForm"].forEach(id => {
      const f = $(id); if (!f) return;
      f.addEventListener("invalid", e => {
        const el = e.target, v = el.validity;
        el.setCustomValidity(v.valueMissing ? (el.dataset.msg || "الحقل ده مطلوب.") : v.rangeUnderflow ? "القيمة لازم تكون " + el.min + " أو أكبر." : v.badInput ? "اكتبي رقمًا صحيحًا." : "");
      }, true);
      f.addEventListener("input", e => e.target.setCustomValidity && e.target.setCustomValidity(""));
      f.addEventListener("submit", e => {
        const btn = e.submitter || f.querySelector('[type="submit"]'); if (!btn) return;
        if (btn.dataset.busy === "1") { e.stopImmediatePropagation(); e.preventDefault(); return; }
        btn.dataset.busy = "1"; btn.setAttribute("aria-busy", "true");
        setTimeout(() => { delete btn.dataset.busy; btn.removeAttribute("aria-busy"); }, 600);
      }, true);
    });
    setInterval(() => { if (currentView === "dashboard") renderHero(state()); }, 60000); // تحديث العد بعد منتصف الليل
  }

  Icons.hydrate();
  bind();
  resolveHero();
  applyRoute();
  const migration = store.consumeMigrationNotice();
  if (migration) {
    if (migration.failed && migration.v9Failed) toast("تعذر إضافة سجل المشتريات دلوقتي، وبياناتك زي ما هي ومحفوظة. هنحاول تاني عند فتح الصفحة.", 8000);
    else if (migration.saveFailed) toast("تعذر حفظ التحديث الجديد في المتصفح (المساحة ممتلئة غالبًا). بياناتك القديمة سليمة ومحفوظة، وهنحاول تاني عند فتح الصفحة.", 9000);
    else if (migration.v9 && migration.v9.itemsWithLegacy) toast("اتضاف «سجل المشتريات» لكل بند. الكميات اللي كنتِ مسجلاها قبل كده اتحفظت كـ «بيانات شراء سابقة»، ونسخة القديم محفوظة في الإعدادات.", 10000);
    else if (migration.v9 && !migration.v8 && !migration.v7 && !migration.removedCategories) toast("اتضاف «سجل المشتريات» لكل بند، وبياناتك زي ما هي.", 6000);
    else if (migration.failed) toast(migration.v8Failed ? "تعذر دمج فئتي الرفايع دلوقتي، وبياناتك زي ما هي. هنحاول تاني عند فتح الصفحة." : "مساحة تخزين المتصفح ممتلئة، فأجّلنا تحديث الفئات علشان بياناتك تفضل زي ما هي. فضّي مساحة وافتحي الصفحة تاني.", 8000);
    else if (migration.v8 && (migration.v8.merged || migration.v8.duplicates.some(d => d.action.startsWith("merged")))) toast("اتدمجت فئتا «الرفايع» و«أدوات المطبخ والرفايع» في فئة واحدة باسم «الرفايع»، وميزانيتهم اتجمعت. بياناتك كلها زي ما هي، ونسخة القديم محفوظة في الإعدادات.", 10000);
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
