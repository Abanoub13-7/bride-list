/* تسجيل Service Worker + زر «تثبيت التطبيق». الموقع يعمل طبيعيًا في المتصفح حتى لو لم يُسجَّل أو لم يُثبَّت. */
(function () {
  "use strict";
  var secure = location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1";
  if ("serviceWorker" in navigator && secure) {
    var hadController = !!navigator.serviceWorker.controller;
    window.addEventListener("load", function () { navigator.serviceWorker.register("/sw.js", { scope: "/", updateViaCache: "none" }).catch(function () {}); });
    navigator.serviceWorker.addEventListener("controllerchange", function () {
      if (!hadController) { hadController = true; return; }   /* أول تفعيل: لا داعي للتنبيه */
      var bar = document.createElement("div"); bar.className = "update-bar"; bar.setAttribute("role", "status");
      bar.innerHTML = '<span>تم تحديث الموقع.</span><button type="button">تحديث الصفحة</button>';
      bar.querySelector("button").addEventListener("click", function () { location.reload(); });
      document.body.appendChild(bar);
    });
  }
  var standalone = window.matchMedia && matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  var deferred = null;
  function panel() { return document.getElementById("installPanel"); }
  function show(html, withButton) {
    var p = panel(); if (!p || standalone) return;
    p.hidden = false; p.querySelector("[data-install-text]").textContent = html;
    var b = p.querySelector("[data-install-btn]"); b.hidden = !withButton;
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; show("ثبّتي Bride List على شاشة هاتفك لفتحه بسرعة كأنه تطبيق.", true); });
  window.addEventListener("appinstalled", function () { deferred = null; var p = panel(); if (p) p.hidden = true; });
  document.addEventListener("click", function (e) {
    if (!e.target.closest || !e.target.closest("[data-install-btn]") || !deferred) return;
    deferred.prompt(); deferred.userChoice.finally(function () { deferred = null; var p = panel(); if (p) p.hidden = true; });
  });
  document.addEventListener("DOMContentLoaded", function () {
    var ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    if (ios && !standalone) show("على الآيفون: اضغطي زر المشاركة في Safari ثم «إضافة إلى الشاشة الرئيسية».", false);
  });
})();
