'use strict';

// Translation files load before this shared application state.
const dict = { en: english, fa: persian, ko: korean };

let lang = localStorage.getItem('language') || 'en',
  user = null,
  view = 'folders',
  folder = null,
  cards = [],
  folders = [],
  templates = [],
  people = [],
  study = null,
  authMode = 'login';
if (!dict[lang]) lang = 'en';
const t = (k) => dict[lang][k] || dict.en[k] || k;
const esc = (v) =>
  String(v ?? '').replace(
    /[&<>"']/g,
    (c) =>
      ({
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#39;',
      })[c],
  );
const app = document.querySelector('#app');
async function api(path, options = {}) {
  const r = await fetch('/api' + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const data = await r.json();
  if (!r.ok) throw Error(data.error || 'Request failed');
  return data;
}

function toast(message) {
  const e = document.querySelector('#toast');
  e.textContent = message;
  e.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => e.classList.remove('show'), 3500);
}

function run(fn) {
  return Promise.resolve()
    .then(fn)
    .catch((e) => toast(e.message));
}

function languageSelect() {
  return `<select id="language" aria-label="${t('language')}"><option value="en" ${lang === 'en' ? 'selected' : ''}>English</option><option value="fa" ${lang === 'fa' ? 'selected' : ''}>فارسی</option><option value="ko" ${lang === 'ko' ? 'selected' : ''}>한국어</option></select>`;
}

function applyLanguage() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'fa' ? 'rtl' : 'ltr';
  document.title = 'Little Cards';
}

function shell(content) {
  const nav = `<button data-view="folders" class="${view === 'folders' || view === 'folder' ? 'active' : ''}">▦ &nbsp; ${t('dashboard')}</button>
      <button data-view="templates" class="${view === 'templates' ? 'active' : ''}">◇ &nbsp; ${t('templates')}</button>${user.role === 'admin' ? `<button data-view="users" class="${view === 'users' ? 'active' : ''}">♧ &nbsp; ${t('users')}</button>` : ''}`;
  app.innerHTML = `<div class="shell">
      <aside class="sidebar">
      <div class="brand">
      <span class="brand-icon">✦</span> Little Cards</div>
      <nav class="nav">${nav}</nav>
      <div class="side-bottom">
      <div class="profile">
      <div class="avatar">${esc(user.name.slice(0, 1).toUpperCase())}</div>
      <div>
      <strong>${esc(user.name)}</strong>
      <div class="muted">${esc(user.role)}</div>
      </div>
      </div>
      <button id="logout" class="btn secondary">${t('logout')}</button>
      </div>
      <nav class="mobile-nav">${nav}<button id="logout-mobile">↪</button>
      </nav>
      </aside>
      <main class="content">
      <div class="topbar">
      <span class="eyebrow">${t('yourProgress')}</span>
      <div class="toolbar">
      <span class="points">✦ ${user.points} ${t('points')}</span>${languageSelect()}</div>
      </div>${content}</main>
      </div>`;
  document
    .querySelectorAll('[data-view]')
    .forEach((b) => (b.onclick = () => run(() => load(b.dataset.view))));
  document.querySelectorAll('#logout,#logout-mobile').forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          await api('/logout', {
            method: 'POST',
          });
          user = null;
          view = 'folders';
          render();
        })),
  );
  bindLanguage();
}

function bindLanguage() {
  document.querySelector('#language').onchange = (e) =>
    run(async () => {
      lang = e.target.value;
      localStorage.setItem('language', lang);
      if (user)
        await api('/me', {
          method: 'PATCH',
          body: {
            language: lang,
          },
        });
      render();
    });
}

function modal(title, body, onsubmit) {
  const el = document.createElement('div');
  el.className = 'modal-backdrop';
  el.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}"><div class="modal-head"><h2>${esc(title)}</h2><button type="button" aria-label="${t('close')}">×</button></div><form class="stack">${body}</form></div>`;
  document.body.append(el);
  el.querySelector('.modal-head button').onclick = () => el.remove();
  el.onclick = (e) => {
    if (e.target === el) el.remove();
  };
  el.querySelector('form').onsubmit = (e) => {
    e.preventDefault();
    run(() => onsubmit(e, el));
  };
  el.querySelector('input,textarea,select')?.focus();
  return el;
}
