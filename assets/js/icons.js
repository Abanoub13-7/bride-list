/* أيقونات SVG محلية موحّدة (خط رفيع) — بدون أي اعتماد على الإنترنت */
(() => {
  const P = {
    bed: '<path d="M2 4v16M2 8h18a2 2 0 0 1 2 2v10M2 17h20M6 8v9"/>',
    kitchen: '<path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7"/>',
    appliance: '<path d="M5 6a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6ZM5 10h14M15 7v6"/>',
    drop: '<path d="M12 22a7 7 0 0 0 7-7c0-2-1-3.9-3-5.5s-3.5-4-4-6.5c-.5 2.5-2 4.9-4 6.5C6 11.1 5 13 5 15a7 7 0 0 0 7 7z"/>',
    curtain: '<path d="M3 4h18M6 4c0 6-1 11-3 16h8c-3-5-5-10-5-16ZM18 4c0 6 1 11 3 16h-8c3-5 5-10 5-16Z"/>',
    hanger: '<path d="M12 8V7a2 2 0 1 1 2 2c-1 .7-2 1.2-2 2M12 11 3 17.5a1 1 0 0 0 .6 1.8h16.8a1 1 0 0 0 .6-1.8L12 11z"/>',
    flower: '<circle cx="12" cy="12" r="3"/><path d="M12 7.5a4.5 4.5 0 1 1 4.5 4.5M12 7.5A4.5 4.5 0 1 0 7.5 12M12 7.5V9m-4.5 3a4.5 4.5 0 1 0 4.5 4.5M7.5 12H9m7.5 0a4.5 4.5 0 1 1-4.5 4.5m4.5-4.5H15m-3 4.5V15"/>',
    box: '<path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16ZM3.3 7 12 12l8.7-5M12 22V12"/>',
    heart: '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>',
    gift: '<path d="M20 12v10H4V12M2 7h20v5H2zM12 22V7M12 7H7.5a2.5 2.5 0 0 1 0-5C11 2 12 7 12 7zM12 7h4.5a2.5 2.5 0 0 0 0-5C13 2 12 7 12 7z"/>',
    bag: '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0"/>',
    home: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10"/>',
    star: '<path d="m12 2 3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>',
    sparkles: '<path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16v4M17 18h4M5 17v3M3.5 18.5h3"/>',
    pot: '<path d="M4 11h16v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-5zM2 12.5h2M20 12.5h2M6.5 11a5.5 5.5 0 0 1 11 0M12 5.5V4M10.5 4h3"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    notstarted: '<circle cx="12" cy="12" r="9" stroke-dasharray="3 3.2"/><path d="M9 12h6"/>',
    plus: '<path d="M5 12h14M12 5v14"/>',
    minus: '<path d="M5 12h14"/>',
    edit: '<path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
    trash: '<path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
    back: '<path d="M5 12h14m-7-7 7 7-7 7"/>',
    forward: '<path d="M19 12H5m7-7-7 7 7 7"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
    dashboard: '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2zM9 22V12h6v10"/>',
    grid: '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
    list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
    wallet: '<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
    settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
    bulb: '<path d="M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.3 1 2.3h6c0-1 .4-1.8 1-2.3A7 7 0 0 0 12 2z"/>',
    cup: '<path d="M17 8h1a4 4 0 0 1 0 8h-1M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4zM6 2v3M10 2v3M14 2v3"/>',
    basket: '<path d="m15 11-1 9M19 11l-4-7M2 11h20M3.5 11l1.6 7.4a2 2 0 0 0 2 1.6h9.8a2 2 0 0 0 2-1.6l1.7-7.4M4.5 15.5h15M5 11l4-7M9 11l1 9"/>',
    plane: '<path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4M12 17h.01"/>',
    chevron: '<path d="m6 9 6 6 6-6"/>',
    x: '<path d="M18 6 6 18M6 6l12 12"/>'
  };
  const svg = (name, cls = "") =>
    `<svg class="ico ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || P.box}</svg>`;

  /* اختيار أيقونة افتراضية من اسم الفئة لو المستخدم ما اختارش */
  const rules = [
    [/رفايع|رفيع|أدوات المطبخ|ادوات المطبخ/, "pot"], [/نيش|أواني/, "cup"], [/خزين|بقالة/, "basket"], [/شهر العسل|هاني مون|رحلة/, "plane"],
    [/نوم|سرير|مرتب/, "bed"], [/مطبخ|أطباق|حلل|سفرة/, "kitchen"], [/جهاز|أجهزة|كهرب/, "appliance"],
    [/حمام|مناشف|استحمام/, "drop"], [/مفروش|ستائر|ستاير|سجاد|فرش|مفارش/, "curtain"],
    [/ملابس|لبس|أحذية|فساتين|شنط يد/, "hanger"], [/عناية|تجميل|عطور|مكياج|شعر/, "flower"],
    [/هدايا|هدية|شبكة|ذهب|مجوهرات/, "gift"], [/شنط|حقائب|سفر/, "bag"], [/متفرق|أخرى|اخرى|عام/, "box"],
    [/بيت|منزل|ديكور|أثاث|اثاث/, "home"]
  ];
  function iconFor(cat) {
    if (cat && cat.icon && cat.icon !== "auto" && P[cat.icon]) return cat.icon;
    const name = (cat && cat.name) || "";
    for (const [re, key] of rules) if (re.test(name)) return key;
    return "sparkles";
  }
  function hydrate(root = document) {
    root.querySelectorAll("i[data-icon]").forEach(el => {
      const wrap = document.createElement("span");
      wrap.className = "ico-wrap " + (el.className || "");
      wrap.innerHTML = svg(el.dataset.icon);
      el.replaceWith(wrap);
    });
  }
  window.BrideIcons = { svg, iconFor, hydrate, names: Object.keys(P) };
})();
