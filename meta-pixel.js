/* ============================================================
   Meta Pixel — события + баннер согласия (единый для всех страниц)
   Pixel ID: 1660400951700797
   В <head> каждой страницы лежит ТОЛЬКО stub (очередь fbq) + init +
   consent revoke. Сам fbevents.js (105 КБ) грузится отсюда и только
   после согласия. Этот файл:
     1) управляет согласием (revoke -> grant),
     2) подгружает fbevents.js и шлёт единственный PageView после согласия,
     3) ловит ViewContent при открытии видео в портфолио,
     4) ловит Contact по клику на WhatsApp / Telegram / Bot / Facebook.
   Дизайн сайта не меняется — баннер это отдельный оверлей.
   ============================================================ */
(function () {
  "use strict";

  var CONSENT_KEY = "et_meta_consent"; // "granted" | "denied"
  var PIXEL_SRC = "https://connect.facebook.net/en_US/fbevents.js";
  var fb = function () {
    // безопасный вызов fbq: не роняем сайт, если пиксель не загрузился
    if (window.fbq) {
      try { window.fbq.apply(window, arguments); } catch (e) {}
    }
  };

  function loadPixelScript() {
    // грузим fbevents.js один раз; очередь fbq из <head> обработается сама
    if (document.querySelector('script[src="' + PIXEL_SRC + '"]')) return;
    var s = document.createElement("script");
    s.async = true;
    s.src = PIXEL_SRC;
    document.head.appendChild(s);
  }

  /* ---------- 1. Согласие ---------- */
  function stored() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (e) { return null; }
  }
  function remember(v) {
    try { localStorage.setItem(CONSENT_KEY, v); } catch (e) {}
  }

  function grant() {
    // только после согласия: грузим скрипт, снимаем revoke, шлём один PageView
    loadPixelScript();
    fb("consent", "grant");
    fb("track", "PageView");
  }

  /* ---------- 2. Баннер согласия ---------- */
  function buildBanner() {
    if (document.getElementById("et-consent")) return;

    var wrap = document.createElement("div");
    wrap.id = "et-consent";
    wrap.setAttribute("role", "dialog");
    wrap.setAttribute("aria-label", "Setări cookie");
    wrap.setAttribute("aria-live", "polite");
    wrap.style.cssText = [
      "position:fixed", "left:16px", "right:16px", "bottom:16px",
      "z-index:2147483000", "max-width:560px", "margin:0 auto",
      "background:rgba(12,12,12,0.96)",
      "border:1px solid rgba(255,196,0,0.35)",
      "border-radius:14px",
      "box-shadow:0 20px 60px rgba(0,0,0,0.55)",
      "backdrop-filter:blur(8px)", "-webkit-backdrop-filter:blur(8px)",
      "padding:16px 18px",
      "font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif",
      "color:#f4f1ea",
      "display:flex", "flex-wrap:wrap", "align-items:center", "gap:12px"
    ].join(";");

    var txt = document.createElement("div");
    txt.style.cssText = "flex:1 1 260px;font-size:13px;line-height:1.5;color:rgba(244,241,234,0.86);";
    txt.innerHTML =
      "Folosim cookie-uri și Meta Pixel pentru statistici și pentru a îmbunătăți site-ul. " +
      "Poți accepta sau refuza.";

    var btns = document.createElement("div");
    btns.style.cssText = "display:flex;gap:8px;flex:0 0 auto;";

    var decline = document.createElement("button");
    decline.type = "button";
    decline.textContent = "Refuz";
    decline.style.cssText = [
      "cursor:pointer", "font:inherit", "font-size:13px", "font-weight:600",
      "padding:10px 16px", "border-radius:9px",
      "border:1px solid rgba(234,236,239,0.28)",
      "background:transparent", "color:#f4f1ea"
    ].join(";");

    var accept = document.createElement("button");
    accept.type = "button";
    accept.textContent = "Accept";
    accept.style.cssText = [
      "cursor:pointer", "font:inherit", "font-size:13px", "font-weight:700",
      "padding:10px 18px", "border-radius:9px", "border:none",
      "background:#ffc400", "color:#0a0908"
    ].join(";");

    function close() { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }

    accept.addEventListener("click", function () {
      remember("granted");
      grant();
      close();
    });
    decline.addEventListener("click", function () {
      remember("denied"); // пиксель остаётся в состоянии revoke — ничего не шлётся
      close();
    });

    btns.appendChild(decline);
    btns.appendChild(accept);
    wrap.appendChild(txt);
    wrap.appendChild(btns);

    (document.body || document.documentElement).appendChild(wrap);
  }

  function initConsent() {
    var s = stored();
    if (s === "granted") {
      grant();            // согласие уже дано ранее — сразу выпускаем PageView
    } else if (s === "denied") {
      /* остаёмся в revoke, баннер не показываем */
    } else {
      buildBanner();      // первый визит — спрашиваем
    }
  }

  /* ---------- 3. ViewContent: открытие видео в портфолио ---------- */
  // Сопоставляем src видео -> название проекта из portfolio.json.
  var titleBySrc = {};
  function normSrc(u) {
    try { return new URL(u, location.href).href; } catch (e) { return u || ""; }
  }
  function loadPortfolioTitles() {
    fetch("./portfolio.json", { cache: "no-cache" })
      .then(function (r) { return r.ok ? r.json() : []; })
      .then(function (data) {
        var items = Array.isArray(data) ? data : (data && data.items) || [];
        items.forEach(function (it) {
          if (it && it.video) titleBySrc[normSrc(it.video)] = it.title || "";
        });
      })
      .catch(function () {});
  }

  // Событие 'play' не всплывает -> слушаем в фазе capture на document.
  document.addEventListener(
    "play",
    function (e) {
      var v = e.target;
      if (!v || v.tagName !== "VIDEO") return;
      var src = normSrc(v.currentSrc || v.src);
      fb("track", "ViewContent", {
        content_name: titleBySrc[src] || "portfolio_video",
        content_type: "portfolio_video"
      });
    },
    true
  );

  /* ---------- 4. Contact: клики по контактам ---------- */
  function contactMethod(href) {
    if (!href) return null;
    var h = href.toLowerCase();
    if (h.indexOf("wa.me") > -1 || h.indexOf("whatsapp") > -1) return "whatsapp";
    if (h.indexOf("t.me/editorul_tau_bot") > -1) return "telegram_bot";
    if (h.indexOf("t.me/") > -1 || h.indexOf("telegram") > -1) return "telegram";
    if (h.indexOf("facebook.com") > -1 || h.indexOf("fb.com") > -1) return "facebook";
    return null;
  }

  document.addEventListener(
    "click",
    function (e) {
      var a = e.target && e.target.closest ? e.target.closest("a[href]") : null;
      if (!a) return;
      var method = contactMethod(a.getAttribute("href"));
      if (!method) return;
      fb("track", "Contact", { contact_method: method });
    },
    true
  );

  /* ---------- boot ---------- */
  function boot() {
    loadPortfolioTitles();
    initConsent();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
