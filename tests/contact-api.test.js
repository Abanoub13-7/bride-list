/* اختبار api/contact.js بدون شبكة: fetch مُحاكى. يثبت أن النجاح لا يُعلن إلا بعد نجاح Resend، وأن الرسالة تُوجَّه إلى CONTACT_TO_EMAIL.
   لا يثبت أن الإرسال الفعلي يعمل على Vercel/Resend (يحتاج مفاتيح وتوثيق نطاق حقيقي). */
const path = require("path"); const handler = require(path.resolve(__dirname, "../api/contact.js"));
let pass = 0, fail = 0; const eq = (a, b, m) => { if (JSON.stringify(a) === JSON.stringify(b)) { pass++; console.log("PASS", m); } else { fail++; console.log("FAIL", m, JSON.stringify(a), "!=", JSON.stringify(b)); } };
const call = (method, body, headers = {}) => new Promise(resolve => { const res = { statusCode: 0, headers: {}, setHeader(k, v) { this.headers[k] = v; }, end(t) { resolve({ code: this.statusCode, body: JSON.parse(t) }); } }; handler({ method, body, headers: { host: "x.test", "x-forwarded-for": "9.9." + Math.floor(Math.random() * 250) + ".1", ...headers }, socket: {} }, res); });
const good = { name: "نور", email: "a@b.co", subject: "موضوع", message: "رسالة طويلة كفاية", elapsed: 5000 };
(async () => {
  for (const k of ["RESEND_API_KEY", "CONTACT_TO_EMAIL", "CONTACT_FROM_EMAIL"]) delete process.env[k];
  eq((await call("GET")).body.configured, false, "GET غير مهيّأ → configured:false");
  eq((await call("POST", good)).code, 503, "POST غير مهيّأ → 503 (لا نجاح وهمي)");
  process.env.RESEND_API_KEY = "test"; process.env.CONTACT_TO_EMAIL = "abncodee13@gmail.com"; process.env.CONTACT_FROM_EMAIL = "Bride List <contact@example.test>";
  eq((await call("GET")).body.configured, true, "GET مهيّأ");
  let sent = null; global.fetch = async (url, o) => { sent = { url, o: JSON.parse(o.body), auth: o.headers.Authorization }; return { ok: true, status: 200 }; };
  let r = await call("POST", good); eq([r.code, r.body.ok], [200, true], "نجاح بعد ردّ Resend ناجح");
  eq([sent.url, sent.o.to, sent.o.from, sent.o.reply_to], ["https://api.resend.com/emails", ["abncodee13@gmail.com"], "Bride List <contact@example.test>", "a@b.co"], "التوجيه إلى abncodee13@gmail.com والرد على المرسِلة");
  global.fetch = async () => ({ ok: false, status: 403 }); r = await call("POST", good); eq([r.code, r.body.ok], [502, false], "فشل Resend → 502 بلا رسالة نجاح");
  global.fetch = async () => { throw new Error("net"); }; r = await call("POST", good); eq([r.code, r.body.ok], [502, false], "انقطاع الشبكة → 502");
  global.fetch = async () => ({ ok: true }); sent = null;
  eq((await call("POST", { ...good, email: "bad" })).code, 422, "بريد غير صالح → 422");
  eq((await call("POST", { ...good, message: "قصيرة" })).code, 422, "رسالة قصيرة → 422");
  eq((await call("POST", { ...good, elapsed: 100 })).body.error, "too_fast", "إرسال سريع جدًا مرفوض");
  eq((await call("POST", { ...good, website: "spam" })).body.ok, true, "حقل المصيدة: يُتجاهل بصمت");
  eq((await call("POST", good, { origin: "https://evil.test" })).code, 403, "أصل مختلف مرفوض");
  let c = 0; const ip = { "x-forwarded-for": "1.2.3.4" }; for (let i = 0; i < 6; i++) c = (await call("POST", good, ip)).code; eq(c, 429, "حد المعدل بعد ٥ رسائل");
  console.log(`\n${pass} passed, ${fail} failed`); process.exit(fail ? 1 : 0);
})();
