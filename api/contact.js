/* دالة Vercel لنموذج التواصل — تعمل في الخادم فقط، فلا تظهر المفاتيح للزوار.
   المتغيرات المطلوبة في Vercel (Project Settings → Environment Variables):
     RESEND_API_KEY        مفتاح خدمة Resend (https://resend.com)
     CONTACT_TO_EMAIL      البريد الذي ستصلك عليه الرسائل
     CONTACT_FROM_EMAIL    عنوان مُرسِل موثَّق في Resend (مثل: Bride List <contact@yourdomain.com>)
   اختياري (حماية إضافية من الرسائل المزعجة عبر Cloudflare Turnstile):
     TURNSTILE_SECRET_KEY  و  TURNSTILE_SITE_KEY
   إن لم تُضبط المتغيرات المطلوبة تردّ الدالة configured:false ويعطّل الموقع النموذج بدل أن يوهم الزائر بأن رسالته أُرسلت. */
"use strict";
const MAX = { name: 80, email: 120, subject: 120, message: 2000 };
const EMAIL_RE = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;
const hits = new Map();   /* حد معدل بسيط داخل ذاكرة النسخة (أفضل جهد؛ يُستبدل بخدمة مركزية لو زادت الحاجة) */
const WINDOW_MS = 60 * 60 * 1000, LIMIT = 5;

const env = () => ({
  key: process.env.RESEND_API_KEY, to: process.env.CONTACT_TO_EMAIL, from: process.env.CONTACT_FROM_EMAIL,
  tsSecret: process.env.TURNSTILE_SECRET_KEY, tsSite: process.env.TURNSTILE_SITE_KEY
});
const isConfigured = e => !!(e.key && e.to && e.from);
const clean = (v, max) => String(v == null ? "" : v).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, max);
const oneLine = v => v.replace(/[\r\n]+/g, " ");
const esc = s => s.replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const send = (res, code, body) => { res.statusCode = code; res.setHeader("Content-Type", "application/json; charset=utf-8"); res.setHeader("Cache-Control", "no-store"); res.end(JSON.stringify(body)); };
const readBody = req => new Promise((resolve, reject) => {
  if (req.body && typeof req.body === "object") return resolve(req.body);
  let raw = ""; req.on("data", c => { raw += c; if (raw.length > 20000) { reject(new Error("big")); req.destroy(); } });
  req.on("end", () => { try { resolve(JSON.parse(raw || "{}")); } catch (e) { reject(e); } });
  req.on("error", reject);
});
function sameOrigin(req) {
  const origin = req.headers.origin; if (!origin) return true;
  try { return new URL(origin).host === req.headers.host; } catch (e) { return false; }
}

module.exports = async function handler(req, res) {
  const e = env();
  if (req.method === "GET") return send(res, 200, { configured: isConfigured(e), turnstileSiteKey: e.tsSecret && e.tsSite ? e.tsSite : null });
  if (req.method !== "POST") { res.setHeader("Allow", "GET, POST"); return send(res, 405, { ok: false, error: "method" }); }
  if (!isConfigured(e)) return send(res, 503, { ok: false, configured: false, error: "not_configured" });
  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: "origin" });
  const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket?.remoteAddress || "unknown").trim();
  const now = Date.now(), list = (hits.get(ip) || []).filter(t => now - t < WINDOW_MS);
  if (list.length >= LIMIT) return send(res, 429, { ok: false, error: "rate" });
  let data; try { data = await readBody(req); } catch (err) { return send(res, 400, { ok: false, error: "bad_body" }); }
  if (data.website) return send(res, 200, { ok: true });                              /* حقل مصيدة للروبوتات: نتظاهر بالنجاح دون إرسال */
  if (Number(data.elapsed) < 2500) return send(res, 400, { ok: false, error: "too_fast" });  /* إرسال خلال أقل من ثانيتين ونصف = غالبًا روبوت */
  const name = oneLine(clean(data.name, MAX.name)), email = oneLine(clean(data.email, MAX.email)), subject = oneLine(clean(data.subject, MAX.subject)), message = clean(data.message, MAX.message);
  const errors = {};
  if (name.length < 2) errors.name = "اكتبي اسمك.";
  if (!EMAIL_RE.test(email)) errors.email = "اكتبي بريدًا إلكترونيًا صحيحًا.";
  if (subject.length < 3) errors.subject = "اكتبي موضوع الرسالة.";
  if (message.length < 10) errors.message = "الرسالة قصيرة جدًا (10 أحرف على الأقل).";
  if (Object.keys(errors).length) return send(res, 422, { ok: false, error: "validation", fields: errors });
  if (e.tsSecret && e.tsSite) {
    try {
      const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ secret: e.tsSecret, response: String(data.turnstileToken || ""), remoteip: ip }) });
      const j = await r.json(); if (!j.success) return send(res, 400, { ok: false, error: "captcha" });
    } catch (err) { return send(res, 502, { ok: false, error: "captcha_unreachable" }); }
  }
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: "Bearer " + e.key, "Content-Type": "application/json" },
      body: JSON.stringify({ from: e.from, to: [e.to], reply_to: email, subject: "[Bride List] " + subject,
        text: `الاسم: ${name}\nالبريد: ${email}\n\n${message}`,
        html: `<p><strong>الاسم:</strong> ${esc(name)}<br><strong>البريد:</strong> ${esc(email)}</p><p style="white-space:pre-wrap">${esc(message)}</p>` })
    });
    if (!r.ok) { console.error("resend", r.status); return send(res, 502, { ok: false, error: "send_failed" }); }
  } catch (err) { console.error("resend", err && err.message); return send(res, 502, { ok: false, error: "send_failed" }); }
  list.push(now); hits.set(ip, list);
  return send(res, 200, { ok: true });
};
module.exports._hits = hits;
