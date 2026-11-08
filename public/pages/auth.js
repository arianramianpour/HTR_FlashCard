'use strict';

function authPage() {
  app.innerHTML = `<div class="auth-wrap">
      <section class="auth-art">
      <div class="brand">
      <span class="brand-icon">✦</span> Little Cards</div>
      <div>
      <h1>${t('authHero')}</h1>
      <p>${t('authHeroText')}</p>
      <div class="art-card">
      <span class="eyebrow">${t('yourProgress')}</span>
      <strong>✦ &nbsp; hello</strong>
      <p>سلام · 안녕하세요</p>
      </div>
      </div>
      <span class="muted">A little better, every day.</span>
      </section>
      <section class="auth-side">
      <div class="auth-box">
      <div style="text-align:end">${languageSelect()}</div>
      <h2>${t(authMode === 'login' ? 'loginTitle' : 'signupTitle')}</h2>
      <p>${t(authMode === 'login' ? 'loginText' : 'signupText')}</p>
      <form id="auth-form" class="stack">${
        authMode === 'signup'
          ? `<label>${t('name')}<input name="name" required maxlength="100" autocomplete="name">
      </label>`
          : ''
      }<label>${t('email')}<input name="email" type="email" required autocomplete="email">
      </label>
      <label>${t('password')}<input name="password" type="password" required minlength="8" maxlength="72" autocomplete="${authMode === 'login' ? 'current-password' : 'new-password'}" placeholder="${t('passwordHint')}">
      </label>
      <button class="btn full">${t(authMode)}</button>
      </form>
      <p class="switch">${t(authMode === 'login' ? 'noAccount' : 'hasAccount')} <button class="link" id="switch-auth">${t(authMode === 'login' ? 'signup' : 'login')}</button>
      </p>
      </div>
      </section>
      </div>`;
  document.querySelector('#switch-auth').onclick = () => {
    authMode = authMode === 'login' ? 'signup' : 'login';
    render();
  };
  document.querySelector('#auth-form').onsubmit = (e) => {
    e.preventDefault();
    run(async () => {
      user = await api('/' + (authMode === 'login' ? 'login' : 'register'), {
        method: 'POST',
        body: Object.fromEntries(new FormData(e.target)),
      });
      lang = user.language;
      localStorage.setItem('language', lang);
      await load('folders');
    });
  };
  bindLanguage();
}
