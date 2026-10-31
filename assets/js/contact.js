/* نموذج التواصل: يتحقق من المدخلات ثم يرسلها إلى /api/contact (دالة Vercel). لا يُظهر نجاحًا إلا بعد ردّ الخادم بنجاح فعلي. */
(function () {
  "use strict";
  var form = document.getElementById("contact-form");
  if (!form) return;
  var status = document.getElementById("contact-status"), btn = document.getElementById("contact-submit");
  var startedAt = Date.now(), tsToken = "", busy = false;
  var EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
  var F = { name: form.elements.name, email: form.elements.email, subject: form.elements.subject, message: form.elements.message };
  function say(msg, kind) { status.textContent = msg; status.className = "form-status " + (kind || ""); status.hidden = !msg; }
  function fieldError(el, msg) {
    var box = document.getElementById(el.name + "-err");
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    if (box) box.textContent = msg || "";
  }
  function validate() {
    var v = { name: F.name.value.trim(), email: F.email.value.trim(), subject: F.subject.value.trim(), message: F.message.value.trim() }, ok = true, first = null;
    var rules = {
      name: v.name.length < 2 ? "اكتبي اسمك." : "",
      email: !EMAIL_RE.test(v.email) ? "اكتبي بريدًا إلكترونيًا صحيحًا." : "",
      subject: v.subject.length < 3 ? "اكتبي موضوع الرسالة." : "",
      message: v.message.length < 10 ? "الرسالة قصيرة جدًا (10 أحرف على الأقل)." : (v.message.length > 2000 ? "الرسالة طويلة (الحد 2000 حرف)." : "")
    };
    Object.keys(rules).forEach(function (k) { fieldError(F[k], rules[k]); if (rules[k]) { ok = false; first = first || F[k]; } });
    if (first) first.focus();
    return ok ? v : null;
  }
  function disable(reason) {
    Array.prototype.forEach.call(form.elements, function (el) { el.disabled = true; });
    form.classList.add("is-disabled");
    say(reason, "warn");
  }
  /* هل الخادم مهيّأ فعلًا للإرسال؟ إن لم يكن، نعطّل النموذج بدل أن نوحي بإرسال غير حقيقي. */
  fetch("/api/contact", { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" })
    .then(function (r) { if (!r.ok) throw new Error("status " + r.status); return r.json(); })
    .then(function (j) {
      if (!j || !j.configured) return disable("نموذج التواصل غير مفعّل حاليًا ولا يمكن إرسال رسائل منه. يرجى المحاولة لاحقًا.");
      if (j.turnstileSiteKey) mountTurnstile(j.turnstileSiteKey);
    })
    .catch(function () { disable("تعذّر الاتصال بخدمة الرسائل الآن، ولذلك لا يمكن إرسال رسالة من هذه الصفحة حاليًا."); });

  function mountTurnstile(siteKey) {
    var holder = document.getElementById("turnstile-holder"); if (!holder) return;
    var s = document.createElement("script"); s.async = true; s.defer = true;
    s.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
    s.onload = function () { if (window.turnstile) window.turnstile.render(holder, { sitekey: siteKey, callback: function (t) { tsToken = t; } }); };
    document.head.appendChild(s);
  }

  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (busy) return;
    say("");
    var v = validate(); if (!v) return;
    busy = true; btn.disabled = true; btn.textContent = "جارٍ الإرسال…";
    fetch("/api/contact", {
      method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ name: v.name, email: v.email, subject: v.subject, message: v.message, website: form.elements.website.value, elapsed: Date.now() - startedAt, turnstileToken: tsToken })
    }).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { status: r.status, body: j }; }); })
      .then(function (res) {
        if (res.body && res.body.ok) { form.reset(); startedAt = Date.now(); say("تم إرسال رسالتك بنجاح. شكرًا لتواصلك.", "ok"); return; }
        var err = (res.body && res.body.error) || "";
        if (res.status === 422 && res.body.fields) { Object.keys(res.body.fields).forEach(function (k) { if (F[k]) fieldError(F[k], res.body.fields[k]); }); say("راجعي الحقول المظللة ثم أعيدي المحاولة.", "err"); }
        else if (res.status === 429) say("أرسلتِ عددًا كبيرًا من الرسائل. حاولي مرة أخرى بعد قليل.", "err");
        else if (res.status === 503) disable("نموذج التواصل غير مفعّل حاليًا ولا يمكن إرسال رسائل منه.");
        else if (err === "too_fast") say("حاولي الإرسال مرة أخرى بعد لحظات.", "err");
        else if (err === "captcha") say("لم يتم التحقق من أنك لست روبوتًا. أعيدي المحاولة.", "err");
        else say("تعذّر إرسال الرسالة. لم تُرسل، فحاولي مرة أخرى لاحقًا.", "err");
      })
      .catch(function () { say("تعذّر الاتصال بالإنترنت أو بالخادم. لم تُرسل الرسالة.", "err"); })
      .then(function () { busy = false; if (!form.classList.contains("is-disabled")) { btn.disabled = false; } btn.textContent = "إرسال الرسالة"; });
  });
  ["name", "email", "subject", "message"].forEach(function (k) { F[k].addEventListener("input", function () { fieldError(F[k], ""); }); });
})();
