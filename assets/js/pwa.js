/* PWA — Bride List
   ─────────────────────────────────────────────────────────────────────────────
   نظام تثبيت مركزي واحد (window.BrideInstall) تتغذى منه كل أزرار التثبيت في الواجهة:
   أي عنصر يحمل [data-install-host] يُرسم تلقائيًا من الحالة نفسها، ويتحدّث عند أي تغيّر
   (beforeinstallprompt / appinstalled / تغيّر display-mode / قبول أو رفض نافذة التثبيت).

   الحالات (status):
     standalone  التطبيق يعمل الآن كتطبيق مثبّت (display-mode: standalone/…)
     installed   مثبّت على الجهاز لكن الصفحة مفتوحة في تبويب متصفح
     ready       حدث beforeinstallprompt متاح ← نافذة التثبيت الأصلية
     installing  نافذة التثبيت الأصلية مفتوحة وننتظر userChoice
     manual      لا توجد نافذة أصلية، والتثبيت اليدوي ممكن (خطوات خاصة بالمنصة فقط)
     inapp       متصفح داخل تطبيق آخر (فيسبوك/إنستجرام…) — يلزم الفتح في المتصفح
     unsupported المتصفح/السياق لا يدعم التثبيت (لا يُعرض زر)

   مصدر حالة «مثبّت» (بترتيب الأولوية — لا شيء منها يُخزَّن بشكل دائم):
     1) display-mode / navigator.standalone  ← المرجع الأول: إن كان الموقع يعمل كتطبيق فالحالة standalone دائمًا.
     2) beforeinstallprompt                   ← وصوله يعني أن التطبيق غير مثبّت الآن (ready).
     3) navigator.getInstalledRelatedApps()   ← حيث يُدعم: مصفوفة غير فارغة = مثبّت، مصفوفة فارغة = غير مثبّت
                                                (وتُسقط أي حالة تثبيت سابقة؛ يُعاد الفحص عند العودة للصفحة).
     4) appinstalled / قبول نافذة التثبيت    ← دليل حيّ داخل هذه الجلسة فقط، في الذاكرة، ولا يُحفظ.
   في المتصفحات التي لا تدعم getInstalledRelatedApps لا نستطيع معرفة هل حُذف التطبيق، لذلك لا نعرض «مثبّت بالفعل»
   بناءً على معلومة قديمة، ونعرض بدلًا منها طريقة التثبيت.

   لا تُخزَّن هنا أي بيانات مستخدم؛ المفتاح الوحيد المضاف في localStorage هو brideList.pwa.bannerDismissed
   (لا علاقة له بـ brideListApp.v1). المفتاح القديم brideList.pwa.installed لم يعد يُستخدم ويُحذف تلقائيًا. */
(function () {
  "use strict";

  var APP_VERSION = "11.0.0";
  var APP_VERSION_DATE = "2026-11-01";
  window.BRIDE_APP_VERSION = APP_VERSION;
  window.BRIDE_APP_VERSION_DATE = APP_VERSION_DATE;

  var LEGACY_INSTALLED_KEY = "brideList.pwa.installed";   /* قديم: لم يعد دليلًا على التثبيت — يُحذف فقط */
  var DISMISS_KEY = "brideList.pwa.bannerDismissed";
  var DISMISS_DAYS = 14;

  /* ───────── بيئة الجهاز والمتصفح ───────── */
  var ua = navigator.userAgent || "";
  var env = (function () {
    var ios = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    var android = /android/i.test(ua);
    var inApp = /FBAN|FBAV|FB_IAB|Instagram|Line\/|MicroMessenger|TikTok|Snapchat|Twitter|; wv\)/i.test(ua);
    var firefox = /firefox|fxios/i.test(ua);
    var samsung = /samsungbrowser/i.test(ua);
    var iosSafari = ios && /safari/i.test(ua) && !/crios|fxios|edgios|opios|gsa\//i.test(ua);
    var chromium = /chrome|crios|chromium|edg\/|edga|opr\//i.test(ua) && !firefox;
    return { ios: ios, android: android, inApp: inApp, firefox: firefox, samsung: samsung, iosSafari: iosSafari, chromium: chromium };
  })();
  var secure = window.isSecureContext === true || location.protocol === "https:" ||
    location.hostname === "localhost" || location.hostname === "127.0.0.1";

  /* المنصة التي ستُعرض لها الخطوات اليدوية — خطوات منصة واحدة فقط */
  function platform() {
    if (env.inApp) return "inapp";
    if (env.ios) return env.iosSafari ? "ios-safari" : "ios-other";
    if (env.android) return "android";
    if (env.chromium) return "desktop-chromium";
    return "desktop-other";
  }

  function isStandalone() {
    try {
      if (window.matchMedia) {
        var modes = ["standalone", "fullscreen", "minimal-ui", "window-controls-overlay"];
        for (var i = 0; i < modes.length; i++) if (window.matchMedia("(display-mode: " + modes[i] + ")").matches) return true;
      }
    } catch (e) { /* تجاهل */ }
    if (navigator.standalone === true) return true;                       /* iOS */
    if (document.referrer && document.referrer.indexOf("android-app://") === 0) return true;
    return false;
  }

  /* ───────── تخزين خفيف (آمن عند الحظر) ───────── */
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); } catch (e) { /* تجاهل */ } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) { /* تجاهل */ } }

  /* ───────── الحالة ───────── */
  var deferred = window.__bip || null;   /* حدث beforeinstallprompt المحفوظ (قد يكون التُقط مبكرًا في <head>) */
  var installingNow = false;
  var installedThisSession = false;   /* دليل حيّ في هذه الجلسة فقط (appinstalled / قبول النافذة) — في الذاكرة ولا يُخزَّن */
  var relatedAppInstalled = false;    /* آخر نتيجة لـ getInstalledRelatedApps(): true فقط إن رجعت بتطبيق */
  var relatedAppsSupported = typeof navigator.getInstalledRelatedApps === "function";
  var detectSeq = 0;                  /* يُبطل نتائج فحص بدأت قبل دليل أحدث */
  lsDel(LEGACY_INSTALLED_KEY);        /* لا نثق بعلامة دائمة: قد يحذف المستخدم التطبيق بعدها */
  var listeners = [];
  var status = "manual";

  function computeStatus() {
    if (isStandalone()) return "standalone";
    if (installingNow) return "installing";
    if (!secure) return "unsupported";
    if (deferred) return "ready";
    if (installedThisSession || relatedAppInstalled) return "installed";
    var p = platform();
    if (p === "inapp") return "inapp";
    if (p === "desktop-other") return "unsupported";
    return "manual";
  }

  function snapshot() {
    return {
      status: status,
      platform: platform(),
      canPrompt: status === "ready",
      secure: secure,
      standalone: status === "standalone"
    };
  }

  function setStatus(next, reason) {
    var changed = next !== status;
    status = next;
    render();
    if (changed || reason) for (var i = 0; i < listeners.length; i++) { try { listeners[i](snapshot(), reason || "status"); } catch (e) { /* تجاهل */ } }
  }
  function refresh(reason) { setStatus(computeStatus(), reason); }

  function subscribe(fn) {
    listeners.push(fn);
    return function () { var i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1); };
  }

  /* ───────── نصوص الحالات ───────── */
  function platformHint() {
    switch (platform()) {
      case "ios-safari": return "على iPhone يتم التثبيت من زر المشاركة في Safari. خطوتان فقط.";
      case "ios-other": return "على iPhone يتم التثبيت من متصفح Safari. افتحي الموقع هناك ثم اتبعي الخطوات.";
      case "android": return "لم يعرض المتصفح نافذة التثبيت التلقائية بعد، وتقدرين تضيفينه يدويًا من قائمة المتصفح.";
      case "desktop-chromium": return "تقدرين تثبّتيه من أيقونة التثبيت في شريط العنوان أو من قائمة المتصفح.";
      default: return "تقدرين تضيفينه إلى شاشتك الرئيسية من قائمة المتصفح.";
    }
  }
  function copy() {
    switch (status) {
      case "ready":
        return { title: "ثبّتي Bride List كتطبيق على هاتفك", text: "يفتح بشاشة كاملة وأيقونة على شاشتك الرئيسية، وبياناتك تفضل محفوظة زي ما هي.", btn: "تثبيت التطبيق", button: true };
      case "installing":
        return { title: "جارٍ فتح نافذة التثبيت…", text: "أكّدي التثبيت من النافذة التي ظهرت على شاشتك.", btn: "بانتظار تأكيدك…", button: true, busy: true };
      case "manual":
        return { title: "أضيفي Bride List إلى شاشتك الرئيسية", text: platformHint(), btn: "طريقة التثبيت", button: true };
      case "inapp":
        return { title: "افتحي الموقع في المتصفح أولًا", text: "أنتِ داخل متصفح تطبيق آخر، والتثبيت لا يعمل من هنا. افتحي الرابط في Chrome ثم ثبّتيه.", btn: "كيف أفتحه في Chrome؟", button: true };
      case "installed":
        return { title: "التطبيق مثبّت بالفعل", text: "افتحي Bride List من أيقونته على شاشة هاتفك لتستخدميه بشاشة كاملة.", button: false };
      case "standalone":
        return { title: "تستخدمين التطبيق المثبّت الآن", text: "Bride List يعمل كتطبيق مستقل على جهازك.", button: false };
      default:
        return { title: "التثبيت غير متاح هنا", text: secure ? "هذا المتصفح لا يدعم تثبيت التطبيقات. جرّبي فتح الموقع في Chrome أو Edge." : "التثبيت يحتاج اتصالًا آمنًا (HTTPS).", button: false };
    }
  }

  /* ───────── الرسم: كل [data-install-host] من الحالة نفسها ───────── */
  function dismissedRecently() {
    var t = parseInt(lsGet(DISMISS_KEY) || "0", 10);
    return !!t && Date.now() - t < DISMISS_DAYS * 86400000;
  }
  function render() {
    var hosts = document.querySelectorAll("[data-install-host]");
    if (document.documentElement) document.documentElement.setAttribute("data-install-state", status);
    var c = copy();
    for (var i = 0; i < hosts.length; i++) {
      var host = hosts[i], kind = host.getAttribute("data-install-host");
      var title = host.querySelector("[data-install-title]"), text = host.querySelector("[data-install-text]"), btn = host.querySelector("[data-install-btn]");
      if (title) title.textContent = c.title;
      if (text) text.textContent = c.text;
      host.setAttribute("data-state", status);
      if (btn) {
        var labelEl = btn.querySelector("[data-install-btn-label]");
        if (labelEl) labelEl.textContent = c.btn || ""; else btn.textContent = c.btn || "";
        btn.hidden = !c.button;
        btn.disabled = !!c.busy;
        btn.setAttribute("aria-busy", c.busy ? "true" : "false");
        btn.setAttribute("data-install-mode", status === "ready" || status === "installing" ? "native" : "guide");
      }
      /* البانر في الرئيسية: لا يظهر داخل التطبيق المثبّت ولا حيث لا يوجد تثبيت، ويُخفى بعد إغلاقه */
      var hide = false;
      if (kind === "banner") hide = status === "standalone" || status === "unsupported" || (dismissedRecently() && status !== "installing");
      host.hidden = hide;
    }
  }

  /* ───────── إشعار خفيف (يستخدم عنصر #toast الموجود في الصفحة) ───────── */
  var toastTimer = null;
  function toast(message, ms) {
    var el = document.getElementById("toast");
    if (!el) return;
    el.textContent = message; el.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove("show"); }, ms || 5200);
  }

  /* ───────── نافذة الخطوات اليدوية (لمنصة واحدة فقط) ───────── */
  function stepsFor(p) {
    switch (p) {
      case "ios-safari":
        return { title: "تثبيت Bride List على iPhone", intro: "التثبيت على iPhone يتم من Safari:", steps: [
          "اضغطي زر المشاركة <b>⬆︎</b> أسفل الشاشة (أو أعلاها على iPad).",
          "مرّري للأسفل واختاري <b>«إضافة إلى الشاشة الرئيسية»</b>.",
          "اضغطي <b>«إضافة»</b> أعلى الشاشة، وستجدين الأيقونة على شاشتك الرئيسية."
        ] };
      case "ios-other":
        return { title: "تثبيت Bride List على iPhone", intro: "التثبيت على iPhone يتم من Safari فقط:", steps: [
          "انسخي رابط هذه الصفحة وافتحيه في <b>Safari</b>.",
          "اضغطي زر المشاركة <b>⬆︎</b> ثم <b>«إضافة إلى الشاشة الرئيسية»</b>.",
          "اضغطي <b>«إضافة»</b>."
        ] };
      case "android": {
        var menu = env.samsung ? "اضغطي زر القائمة <b>☰</b> أسفل الشاشة." : "اضغطي قائمة المتصفح <b>⋮</b> أعلى الشاشة.";
        var item = env.samsung ? "اختاري <b>«إضافة الصفحة إلى»</b> ثم <b>«الشاشة الرئيسية»</b>."
          : env.firefox ? "اختاري <b>«تثبيت»</b>."
          : "اختاري <b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.";
        return { title: "تثبيت Bride List على Android", intro: "لم يعرض المتصفح نافذة التثبيت التلقائية، فاتبعي هذه الخطوات:", steps: [
          menu, item, "أكّدي بالضغط على <b>«تثبيت»</b> أو <b>«إضافة»</b>."
        ], note: "لو لم يظهر الخيار: افتحي الموقع من Chrome مباشرة (وليس من داخل تطبيق آخر) ثم حدّثي الصفحة." };
      }
      case "desktop-chromium":
        return { title: "تثبيت Bride List على الكمبيوتر", intro: "من متصفح Chrome أو Edge:", steps: [
          "اضغطي أيقونة التثبيت <b>⊕</b> في شريط العنوان.",
          "أو من القائمة <b>⋮</b> اختاري <b>«حفظ ومشاركة»</b> ثم <b>«تثبيت الصفحة كتطبيق»</b>.",
          "أكّدي بالضغط على <b>«تثبيت»</b>."
        ] };
      case "inapp":
        return { title: "افتحي الموقع في المتصفح", intro: "التثبيت لا يعمل من داخل متصفح التطبيقات الأخرى:", steps: [
          "اضغطي قائمة هذا المتصفح <b>⋮</b> أو <b>«…»</b>.",
          "اختاري <b>«فتح في المتصفح»</b> أو <b>«Open in Chrome»</b>.",
          "بعد فتحها في Chrome اضغطي <b>«تثبيت التطبيق»</b>."
        ] };
      default:
        return { title: "تثبيت Bride List", intro: "افتحي قائمة المتصفح وابحثي عن:", steps: ["<b>«تثبيت التطبيق»</b> أو <b>«إضافة إلى الشاشة الرئيسية»</b>.", "أكّدي الإضافة."] };
    }
  }
  function openGuide() {
    var dlg = document.getElementById("installGuideDialog");
    if (!dlg) return false;
    var data = stepsFor(platform());
    var t = dlg.querySelector("[data-guide-title]"), intro = dlg.querySelector("[data-guide-intro]"),
      list = dlg.querySelector("[data-guide-steps]"), note = dlg.querySelector("[data-guide-note]");
    if (t) t.textContent = data.title;
    if (intro) intro.textContent = data.intro;
    if (list) list.innerHTML = data.steps.map(function (s) { return "<li>" + s + "</li>"; }).join("");
    if (note) { note.textContent = data.note || ""; note.hidden = !data.note; }
    dlg.setAttribute("data-platform", platform());
    if (typeof dlg.showModal === "function") { if (!dlg.open) dlg.showModal(); } else dlg.setAttribute("open", "");
    return true;
  }
  function closeGuide() {
    var dlg = document.getElementById("installGuideDialog");
    if (dlg && dlg.open) { if (typeof dlg.close === "function") dlg.close(); else dlg.removeAttribute("open"); }
  }

  /* ───────── التثبيت ───────── */
  function markInstalled() {
    installedThisSession = true; installingNow = false; deferred = null; window.__bip = null;
    detectSeq++;                       /* أي فحص قيد التنفيذ بدأ قبل التثبيت لا يُلغي هذا الدليل الأحدث */
  }

  /* يُستدعى من حدث ضغط المستخدم مباشرة: prompt() قبل أي await */
  function install() {
    if (status === "installing") return Promise.resolve({ outcome: "pending" });
    if (status === "ready" && deferred) {
      var ev = deferred;
      deferred = null; window.__bip = null;   /* الحدث يُستخدم مرة واحدة فقط */
      installingNow = true;
      var choicePromise;
      try {
        ev.prompt();                   /* استدعاء مباشر من حدث الضغط */
        choicePromise = Promise.resolve(ev.userChoice);
      } catch (err) {
        installingNow = false;
        refresh("prompt-error");
        openGuide();
        return Promise.resolve({ outcome: "error" });
      }
      refresh("prompting");
      return choicePromise.then(function (choice) {
        var accepted = !!choice && choice.outcome === "accepted";
        if (accepted) {
          markInstalled();
          refresh("accepted");
          toast("تم قبول التثبيت 💗 هتلاقي Bride List على شاشتك الرئيسية، وبياناتك زي ما هي.");
          return { outcome: "accepted" };
        }
        installingNow = false;
        refresh("dismissed");          /* لا رسالة نجاح عند الرفض */
        toast("لم يتم التثبيت. تقدرين تثبّتيه في أي وقت من الإعدادات.", 4200);
        return { outcome: "dismissed" };
      }).catch(function () {
        installingNow = false;
        refresh("prompt-error");
        return { outcome: "error" };
      });
    }
    if (status === "manual" || status === "inapp") { openGuide(); return Promise.resolve({ outcome: "guide" }); }
    return Promise.resolve({ outcome: "none" });
  }

  function dismissBanner() { lsSet(DISMISS_KEY, String(Date.now())); render(); }

  /* ───────── الأحداث ───────── */
  window.addEventListener("beforeinstallprompt", function (event) {
    /* نمنع النافذة التلقائية فقط في الصفحات التي فيها أزرار التثبيت الخاصة بنا */
    if (document.querySelector("[data-install-host]")) event.preventDefault();
    deferred = event; window.__bip = event;
    installedThisSession = false; relatedAppInstalled = false;   /* وصول الحدث يعني أن التطبيق غير مثبّت حاليًا */
    detectSeq++;
    refresh("beforeinstallprompt");
  });
  window.addEventListener("appinstalled", function () {
    var wasPrompting = installingNow;
    markInstalled();
    refresh("appinstalled");
    if (!wasPrompting) toast("تم تثبيت Bride List على جهازك 💗", 4800);
  });
  try {
    ["standalone", "fullscreen", "minimal-ui"].forEach(function (m) {
      var mq = window.matchMedia("(display-mode: " + m + ")");
      var handler = function () { refresh("display-mode"); };
      if (mq.addEventListener) mq.addEventListener("change", handler); else if (mq.addListener) mq.addListener(handler);
    });
  } catch (e) { /* تجاهل */ }

  /* التحقق من التثبيت الفعلي حيث يُدعم. النتيجة الفارغة = غير مثبّت (تُسقط أي حالة تثبيت قديمة)؛
     الفشل أو نتيجة غير مفهومة = غير مؤكد فلا نغيّر الحالة ولا نعرض «مثبّت». */
  function detectRelatedApps() {
    if (!relatedAppsSupported) return Promise.resolve("unsupported");
    var seq = ++detectSeq, request;
    try { request = Promise.resolve(navigator.getInstalledRelatedApps()); } catch (e) { return Promise.resolve("error"); }
    return request.then(function (apps) {
      if (seq !== detectSeq) return "stale";                         /* وصل دليل أحدث (beforeinstallprompt/appinstalled/فحص أحدث) */
      if (!apps || typeof apps.length !== "number") return "unknown";
      if (apps.length > 0) {
        if (!deferred && !relatedAppInstalled) { relatedAppInstalled = true; refresh("related-apps"); }
        return "installed";
      }
      if (relatedAppInstalled || installedThisSession) {              /* حُذف التطبيق بعد تثبيته */
        relatedAppInstalled = false; installedThisSession = false; refresh("related-apps");
      }
      return "not-installed";
    }).catch(function () { return "error"; });
  }

  /* ───────── ربط الواجهة ───────── */
  function bindUI() {
    document.addEventListener("click", function (e) {
      var t = e.target;
      if (!t || !t.closest) return;
      var btn = t.closest("[data-install-btn]");
      if (btn) { e.preventDefault(); install(); return; }
      var dismiss = t.closest("[data-install-dismiss]");
      if (dismiss) { e.preventDefault(); dismissBanner(); return; }
      var close = t.closest("[data-install-guide-close]");
      if (close) { e.preventDefault(); closeGuide(); return; }
      var dlg = document.getElementById("installGuideDialog");
      if (dlg && t === dlg) closeGuide();                  /* الضغط على الخلفية */
    });
    var version = document.querySelectorAll("[data-app-version]");
    for (var i = 0; i < version.length; i++) version[i].textContent = "الإصدار " + APP_VERSION + " · " + APP_VERSION_DATE;
    refresh();
    detectRelatedApps();
    /* العودة للصفحة (بعد أن يكون المستخدم حذف التطبيق أو ثبّته) تعيد التحقق حيث يُدعم */
    document.addEventListener("visibilitychange", function () { if (document.visibilityState === "visible") detectRelatedApps(); });
    window.addEventListener("pageshow", function (e) { if (e.persisted) { refresh("pageshow"); detectRelatedApps(); } });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bindUI); else bindUI();

  /* ───────── Service Worker وتحديثه (لا يمس بيانات المستخدم) ───────── */
  function registerWorker() {
    if (!("serviceWorker" in navigator) || !secure) return;
    var hadController = !!navigator.serviceWorker.controller;
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).then(function (reg) {
        /* التطبيق المثبّت يبقى مفتوحًا لأيام: نفحص التحديث عند العودة إليه (بحد أدنى ساعة) */
        var last = Date.now();
        document.addEventListener("visibilitychange", function () {
          if (document.visibilityState === "visible" && Date.now() - last > 3600000) { last = Date.now(); reg.update().catch(function () {}); }
        });
      }).catch(function () {});
    });
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController) { hadController = true; return; }
      if (!document.body || document.querySelector(".update-bar")) return;
      var bar = document.createElement("div");
      bar.className = "update-bar";
      bar.setAttribute("role", "status");
      bar.innerHTML = '<span>تم تحديث Bride List.</span><button type="button">تحديث الصفحة</button>';
      bar.querySelector("button").addEventListener("click", function () { location.reload(); });
      document.body.appendChild(bar);
    });
  }
  registerWorker();

  /* واجهة عامة (تستخدمها الاختبارات وأي زر مستقبلي) */
  window.BrideInstall = {
    getState: snapshot,
    subscribe: subscribe,
    install: install,
    openGuide: openGuide,
    closeGuide: closeGuide,
    refresh: refresh,
    recheck: detectRelatedApps,
    stepsFor: stepsFor,
    platform: platform
  };
})();
