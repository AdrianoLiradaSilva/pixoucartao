/* Consentimento de cookies (LGPD) + Google Analytics 4.
   Modo básico: o GA4 só é carregado depois que a pessoa aceita.
   Sem ID configurado, nada é carregado e o banner não aparece. */
(function () {
  "use strict";

  // ID do fluxo de dados do GA4 (Administrador > Fluxos de dados). Ex.: "G-AB12CD34EF"
  var GA_ID = "";

  var CHAVE = "pc-consentimento";
  var VERSAO = 1; // aumente se as finalidades mudarem, para pedir o consentimento de novo

  if (!/^G-[A-Z0-9]+$/.test(GA_ID)) return;

  function ler() {
    try {
      var v = JSON.parse(localStorage.getItem(CHAVE) || "null");
      return v && v.v === VERSAO ? v : null;
    } catch (e) { return null; }
  }
  function gravar(analytics) {
    try {
      localStorage.setItem(CHAVE, JSON.stringify({ v: VERSAO, analytics: analytics, em: new Date().toISOString() }));
    } catch (e) {}
  }

  // gtag com tudo negado por padrão (Consent Mode v2)
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  gtag("consent", "default", {
    ad_storage: "denied", ad_user_data: "denied", ad_personalization: "denied",
    analytics_storage: "denied", functionality_storage: "granted", security_storage: "granted"
  });

  var carregado = false;
  function carregarGA() {
    if (carregado) return;
    carregado = true;
    gtag("consent", "update", { analytics_storage: "granted" });
    gtag("js", new Date());
    gtag("config", GA_ID, { cookie_expires: 34128000 }); // cookies valem ~13 meses
    var s = document.createElement("script");
    s.async = true;
    s.src = "https://www.googletagmanager.com/gtag/js?id=" + GA_ID;
    document.head.appendChild(s);
  }

  function apagarCookiesGA() {
    var dom = location.hostname.replace(/^www\./, "");
    document.cookie.split(";").forEach(function (c) {
      var nome = c.split("=")[0].trim();
      if (/^_ga/.test(nome)) {
        ["", "; domain=" + dom, "; domain=." + dom].forEach(function (d) {
          document.cookie = nome + "=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/" + d;
        });
      }
    });
  }

  var css =
    ".pc-ck{position:fixed;left:16px;right:16px;bottom:16px;z-index:1000;max-width:560px;margin:0 auto;" +
    "background:var(--surface,#fff);color:var(--fg,#14211e);border:1px solid var(--line,#dbe3e1);border-radius:14px;" +
    "padding:16px;box-shadow:0 10px 30px rgba(0,0,0,.18);font:14px/1.5 'Instrument Sans',ui-sans-serif,system-ui,sans-serif}" +
    ".pc-ck p{margin:0 0 12px}.pc-ck a{color:var(--pix,#0f8f7e)}" +
    ".pc-ck .pc-bt{display:flex;gap:8px;flex-wrap:wrap}" +
    ".pc-ck button{flex:1 1 140px;font-weight:600;font-size:14px;font-family:inherit;border-radius:10px;padding:10px 14px;cursor:pointer;" +
    "border:1px solid var(--fg,#14211e);background:var(--fg,#14211e);color:var(--bg,#f3f6f5)}" +
    ".pc-ck button.pc-n{background:transparent;color:var(--fg,#14211e)}" +
    ".pc-ck button:focus-visible{outline:2px solid var(--pix,#0f8f7e);outline-offset:2px}" +
    ".pc-pref{background:none;border:0;padding:0;font:inherit;color:inherit;text-decoration:underline;cursor:pointer}" +
    "@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .pc-ck{background:var(--surface,#16201e);color:var(--fg,#e6eeec);border-color:var(--line,#27332f)}}";

  var banner = null;
  function mostrarBanner() {
    if (banner) { banner.hidden = false; banner.querySelector("button").focus(); return; }
    var st = document.createElement("style");
    st.textContent = css;
    document.head.appendChild(st);
    banner = document.createElement("div");
    banner.className = "pc-ck";
    banner.setAttribute("role", "dialog");
    banner.setAttribute("aria-label", "Cookies");
    banner.innerHTML =
      "<p>Usamos cookies do Google Analytics para contar visitas e entender quais páginas ajudam mais. " +
      "Os valores que você digita na calculadora nunca são enviados. " +
      "<a href=\"/privacidade/#cookies\">Saiba mais</a>.</p>" +
      "<div class=\"pc-bt\"><button type=\"button\" class=\"pc-s\">Aceitar</button>" +
      "<button type=\"button\" class=\"pc-n\">Recusar</button></div>";
    banner.querySelector(".pc-s").onclick = function () { gravar(true); banner.hidden = true; carregarGA(); };
    banner.querySelector(".pc-n").onclick = function () {
      var antes = carregado;
      gravar(false); banner.hidden = true; apagarCookiesGA();
      if (antes) location.reload(); // descarrega o GA que já estava ativo
    };
    document.body.appendChild(banner);
  }

  function linkPreferencias() {
    var nav = document.querySelector("footer nav");
    if (!nav || nav.querySelector(".pc-pref")) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "pc-pref";
    b.textContent = "Cookies";
    b.onclick = mostrarBanner;
    nav.appendChild(b);
  }

  var escolha = ler();
  if (escolha && escolha.analytics) carregarGA();

  function iniciar() {
    linkPreferencias();
    if (!escolha) mostrarBanner();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
