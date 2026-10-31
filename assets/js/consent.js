/* إدارة الموافقة على الإعلانات وملفات تعريف الارتباط.
   - لا يُحمَّل نص AdSense إطلاقًا قبل أن يُبلغ الـ CMP (Google Privacy & messaging / Funding Choices) بأن بيانات الموافقة جاهزة.
   - إن لم يُحمَّل الـ CMP (محظور أو غير مفعّل في حساب AdSense) فلا تُحمَّل الإعلانات: الافتراضي هو عدم الإرسال.
   - Consent Mode v2: القيم الافتراضية «مرفوض» لزوار الاتحاد الأوروبي والمملكة المتحدة وسويسرا حتى يختار الزائر.
   - الموقع نفسه لا يحفظ أي ملف تعريف ارتباط؛ حفظ اختيار الزائر يتولاه الـ CMP. */
(function () {
  "use strict";
  var w = window, d = document;
  var cfg = w.BRIDE_SITE_CONFIG || {};
  var pub = String(cfg.adsensePublisherId || "").trim();
  var REGIONS = ["AT","BE","BG","HR","CY","CZ","DK","EE","FI","FR","DE","GR","HU","IE","IT","LV","LT","LU","MT","NL","PL","PT","RO","SK","SI","ES","SE","IS","LI","NO","GB","CH"];
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  if (!w.gtag) w.gtag = gtag;
  gtag("consent", "default", { ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied", analytics_storage: "denied", wait_for_update: 500, region: REGIONS });
  gtag("set", "ads_data_redaction", true);

  var adsLoaded = false;
  function loadAds() {
    if (adsLoaded || !/^ca-pub-\d+$/.test(pub)) return;
    adsLoaded = true;
    var s = d.createElement("script");
    s.async = true; s.crossOrigin = "anonymous";
    s.src = "https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=" + pub;
    d.head.appendChild(s);
  }

  function startCmp() {
    if (cfg.consentManagement !== "funding-choices" || !/^ca-pub-\d+$/.test(pub)) return;
    w.googlefc = w.googlefc || {};
    w.googlefc.callbackQueue = w.googlefc.callbackQueue || [];
    w.googlefc.callbackQueue.push({ CONSENT_DATA_READY: loadAds });
    var s = d.createElement("script");
    s.async = true;
    s.src = "https://fundingchoicesmessages.google.com/i/" + pub.replace(/^ca-/, "") + "?ers=1";
    d.head.appendChild(s);
    (function signal() {          /* يخبر Google بوجود الـ CMP على الصفحة (مطلوب لعمل رسالة الموافقة) */
      if (w.frames.googlefcPresent) return;
      if (d.body) { var f = d.createElement("iframe"); f.style.cssText = "width:0;height:0;border:none;display:none"; f.name = "googlefcPresent"; f.setAttribute("aria-hidden", "true"); f.tabIndex = -1; d.body.appendChild(f); }
      else setTimeout(signal, 0);
    })();
  }

  /* فتح إعدادات الخصوصية لاحقًا (تعديل/سحب الموافقة). إن لم يكن الـ CMP متاحًا نُحيل الزائر لشرح الخيارات في صفحة الخصوصية. */
  function openSettings() {
    var g = w.googlefc;
    if (g && g.callbackQueue && typeof g.showRevocationMessage === "function") { g.callbackQueue.push(g.showRevocationMessage); return true; }
    location.href = "/privacy/#consent";
    return false;
  }
  w.BrideConsent = { openSettings: openSettings };
  d.addEventListener("click", function (e) {
    var t = e.target.closest && e.target.closest("[data-consent-settings]");
    if (t) { e.preventDefault(); openSettings(); }
  });
  startCmp();
})();
