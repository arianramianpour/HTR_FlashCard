'use strict';

function templatePage() {
  shell(
    `<div class="heading">
      <div>
      <span class="eyebrow">${t('templates')}</span>
      <h1>${t('library')}</h1>
      <p>${t('libraryText')}</p>
      </div>${user.role !== 'student' ? `<button class="btn" id="publish">＋ ${t('publish')}</button>` : ''}</div>${
        templates.length
          ? `<div class="grid">${templates
              .map(
                (x) => `<div class="template">
      <div class="folder-icon">◇</div>
      <h3>${esc(x.title)}</h3>
      <p>${esc(x.description)}</p>
      <span class="muted">${x.card_count} ${t('cards')} · ${esc(x.creator)}</span>
      <div class="toolbar">
      <button class="btn small" data-copy="${x.id}">${t('copy')}</button>${user.role === 'admin' || (user.role === 'teacher' && x.creator_id === user.id) ? `<button class="btn danger small" data-delete-template="${x.id}">${t('delete')}</button>` : ''}</div>
      </div>`,
              )
              .join('')}</div>`
          : `<div class="empty">
      <div class="big-icon">◇</div>
      <h3>${t('noTemplates')}</h3>
      <p>${t('emptyLibrary')}</p>
      </div>`
      }`,
  );
  document.querySelector('#publish')?.addEventListener('click', () =>
    run(async () => {
      folders = await api('/folders');
      if (!folders.length) return toast(t('emptyTitle'));
      modal(
        t('publish'),
        `<p>${t('publishHelp')}</p>
      <label>${t('title')}<input name="title" required maxlength="120">
      </label>
      <label>${t('description')}<input name="description" maxlength="500">
      </label>
      <label>${t('chooseFolder')}<select name="folderId">${folders.map((f) => `<option value="${f.id}">${esc(f.name)} (${f.card_count})</option>`).join('')}</select>
      </label>
      <button class="btn">${t('publishButton')}</button>`,
        async (e, m) => {
          await api('/templates', {
            method: 'POST',
            body: Object.fromEntries(new FormData(e.target)),
          });
          m.remove();
          await load('templates');
        },
      );
    }),
  );
  document.querySelectorAll('[data-copy]').forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          await api(`/templates/${b.dataset.copy}/copy`, {
            method: 'POST',
          });
          await load('folders');
        })),
  );
  document.querySelectorAll('[data-delete-template]').forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm(t('confirmTemplate')))
          run(async () => {
            await api(`/templates/${b.dataset.deleteTemplate}`, {
              method: 'DELETE',
            });
            await load('templates');
          });
      }),
  );
}
