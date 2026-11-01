/* Netlify adapter for the shared contact API handler. */
"use strict";
const contactHandler = require("../../api/contact.js");

exports.handler = async function (event) {
  const headers = {};
  let statusCode = 200;
  let responseBody = "";
  const req = {
    method: event.httpMethod || "GET",
    headers: Object.fromEntries(Object.entries(event.headers || {}).map(([k, v]) => [k.toLowerCase(), v])),
    body: event.body ? (function () { try { return JSON.parse(event.body); } catch (_) { return event.body; } })() : {},
    socket: { remoteAddress: (event.headers && (event.headers["x-nf-client-connection-ip"] || event.headers["client-ip"])) || "unknown" }
  };
  const res = {
    statusCode: 200,
    setHeader: function (key, value) { headers[key] = value; },
    end: function (body) { responseBody = body || ""; }
  };
  await contactHandler(req, res);
  statusCode = res.statusCode;
  return {
    statusCode,
    headers: Object.assign({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }, headers),
    body: responseBody
  };
};
