/* Consentimento de cookies + Google Analytics 4.
   O GA só é carregado depois que a pessoa aceita (modo básico do Consent Mode).
   A escolha fica no localStorage, na chave "consentimento-analytics" ("sim" ou "nao"). */
(function () {
  var GA_ID = 'G-KSWN0FDMR3';
  var CHAVE = 'consentimento-analytics';

  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () { dataLayer.push(arguments); };

  function ler() { try { return localStorage.getItem(CHAVE); } catch (e) { return null; } }
  function gravar(v) { try { localStorage.setItem(CHAVE, v); } catch (e) {} }

  var carregado = false;
  function carregarGA() {
    if (carregado) return;
    carregado = true;
    gtag('consent', 'default', {
      ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied',
      analytics_storage: 'granted'
    });
    gtag('js', new Date());
    gtag('config', GA_ID);
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + GA_ID;
    document.head.appendChild(s);
  }

  function apagarCookiesGA() {
    var host = location.hostname, partes = host.split('.');
    var dominios = ['', host];
    for (var i = 1; i < partes.length - 1; i++) dominios.push('.' + partes.slice(i).join('.'));
    document.cookie.split(';').forEach(function (c) {
      var nome = c.split('=')[0].trim();
      if (nome === '_ga' || nome.indexOf('_ga_') === 0) {
        dominios.forEach(function (d) {
          document.cookie = nome + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/' + (d ? '; domain=' + d : '');
        });
      }
    });
  }

  var css =
    '#consentimento{position:fixed;left:12px;right:12px;bottom:calc(12px + env(safe-area-inset-bottom));z-index:1000;' +
    'max-width:720px;margin:0 auto;background:var(--surface,#fff);color:var(--fg,#14211e);' +
    'border:1px solid var(--line,#dbe3e1);border-radius:14px;padding:14px 16px;' +
    'box-shadow:0 8px 28px rgba(0,0,0,.18);display:flex;flex-wrap:wrap;align-items:center;gap:10px 16px;' +
    'font:14px/1.45 var(--body,system-ui,sans-serif)}' +
    '#consentimento p{margin:0;flex:1 1 280px}' +
    '#consentimento a{color:var(--pix,#0f8f7e)}' +
    '#consentimento .acoes{display:flex;gap:8px;flex:0 0 auto}' +
    '#consentimento button{font:600 14px var(--body,system-ui,sans-serif);border-radius:10px;padding:9px 16px;cursor:pointer;' +
    'border:1px solid var(--pix,#0f8f7e)}' +
    '#consentimento .sim{background:var(--pix,#0f8f7e);color:var(--on-accent,#fff)}' +
    '#consentimento .nao{background:transparent;color:var(--fg,#14211e);border-color:var(--line,#dbe3e1)}' +
    '#consentimento button:focus-visible{outline:2px solid var(--pix,#0f8f7e);outline-offset:2px}';

  function mostrarAviso() {
    if (document.getElementById('consentimento')) return;
    if (!document.getElementById('consentimento-css')) {
      var st = document.createElement('style');
      st.id = 'consentimento-css';
      st.textContent = css;
      document.head.appendChild(st);
    }
    var box = document.createElement('div');
    box.id = 'consentimento';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Aviso de cookies');
    box.innerHTML =
      '<p>Usamos cookies do Google Analytics para contar visitas e melhorar o site. ' +
      'Os valores que você digita na calculadora nunca saem do seu navegador. ' +
      '<a href="/privacidade/#cookies">Saiba mais</a></p>' +
      '<div class="acoes"><button type="button" class="nao">Recusar</button>' +
      '<button type="button" class="sim">Aceitar</button></div>';
    box.querySelector('.sim').addEventListener('click', function () {
      gravar('sim'); box.remove(); carregarGA();
    });
    box.querySelector('.nao').addEventListener('click', function () {
      var antes = ler();
      gravar('nao'); box.remove();
      if (antes === 'sim' || carregado) { apagarCookiesGA(); location.reload(); }
    });
    document.body.appendChild(box);
  }

  window.abrirPreferenciasCookies = mostrarAviso;

  var escolha = ler();
  if (escolha === 'sim') carregarGA();

  function iniciar() {
    if (escolha !== 'sim' && escolha !== 'nao') mostrarAviso();
    var botoes = document.querySelectorAll('[data-preferencias-cookies]');
    for (var i = 0; i < botoes.length; i++) {
      botoes[i].addEventListener('click', function (e) { e.preventDefault(); mostrarAviso(); });
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
