'use strict';

function folderList() {
  shell(
    `<div class="heading">
      <div>
      <span class="eyebrow">${t('dashboard')}</span>
      <h1>${t('welcome')}</h1>
      <p>${t('subtitle')}</p>
      </div>
      <button class="btn" id="new-folder">＋ &nbsp; ${t('newFolder')}</button>
      </div>${
        folders.length
          ? `<div class="grid">${folders
              .map(
                (f) => `<button class="folder" data-folder="${f.id}">
      <div class="folder-icon">▱</div>
      <h3>${esc(f.name)}</h3>
      <span class="muted">${f.card_count} ${t('cards')}</span>
      <div class="folder-foot">
      <span>✦ ${f.important_count} ${t('important')}</span>
      <span>→</span>
      </div>
      </button>`,
              )
              .join('')}</div>`
          : `<div class="empty">
      <div class="big-icon">🌱</div>
      <h3>${t('emptyTitle')}</h3>
      <p>${t('emptyText')}</p>
      <button class="btn" id="empty-create">＋ ${t('create')}</button>
      </div>`
      }`,
  );
  const create = () =>
    modal(
      t('newFolder'),
      `<label>${t('folderName')}<input name="name" maxlength="120" required></label><div class="toolbar"><button class="btn">${t('create')}</button></div>`,
      async (e, m) => {
        await api('/folders', {
          method: 'POST',
          body: Object.fromEntries(new FormData(e.target)),
        });
        m.remove();
        await load('folders');
      },
    );
  document.querySelector('#new-folder').onclick = create;
  document.querySelector('#empty-create')?.addEventListener('click', create);
  document
    .querySelectorAll('[data-folder]')
    .forEach((b) => (b.onclick = () => run(() => openFolder(Number(b.dataset.folder)))));
}
async function openFolder(fid) {
  folder = folders.find((f) => f.id === fid);
  if (!folder) {
    folders = await api('/folders');
    folder = folders.find((f) => f.id === fid);
  }
  if (!folder) return load('folders');
  cards = await api(`/folders/${fid}/cards`);
  view = 'folder';
  render();
}

function folderPage() {
  shell(
    `<button class="link back" id="back">← ${t('back')}</button>
      <div class="heading">
      <div>
      <span class="eyebrow">${cards.length} / 300 ${t('cards')}</span>
      <h1>${esc(folder.name)}</h1>
      <p>${cards.filter((c) => c.important).length} ${t('important')}</p>
      </div>
      <div class="toolbar">
      <button class="btn secondary" id="important-study">✦ ${t('studyImportant')}</button>
      <button class="btn" id="start-study" ${!cards.length ? 'disabled' : ''}>▶ ${t('study')}</button>
      </div>
      </div>
      <div class="toolbar" style="margin-bottom:20px">
      <button class="btn secondary" id="add-card">＋ ${t('addCard')}</button>
      <button class="btn secondary" id="import">⇧ ${t('import')}</button>
      <button class="btn danger" id="delete-folder">${t('delete')}</button>
      </div>${
        cards.length
          ? `<div class="cards-list">${cards
              .map(
                (c) => `<div class="card-row">
      <div>
      <strong>${esc(c.word)}</strong>
      <p>${esc(c.meaning)}</p>${c.example ? `<span class="muted">${esc(c.example)}</span>` : ''}</div>
      <div class="row-actions">
      <button class="btn small ${c.important ? 'soft' : 'secondary'}" data-important="${c.id}" aria-label="${t('important')}">${c.important ? '★' : '☆'}</button>
      <button class="btn secondary small" data-edit="${c.id}">${t('edit')}</button>
      <button class="btn danger small" data-delete="${c.id}">${t('remove')}</button>
      </div>
      </div>`,
              )
              .join('')}</div>`
          : `<div class="empty">
      <div class="big-icon">✎</div>
      <h3>${t('noCards')}</h3>
      <p>${t('noCardsText')}</p>
      </div>`
      }`,
  );
  document.querySelector('#back').onclick = () => run(() => load('folders'));
  document.querySelector('#add-card').onclick = () => cardModal();
  document.querySelector('#import').onclick = importModal;
  document.querySelector('#delete-folder').onclick = () => {
    if (confirm(t('confirmFolder')))
      run(async () => {
        await api(`/folders/${folder.id}`, {
          method: 'DELETE',
        });
        await load('folders');
      });
  };
  document.querySelector('#start-study').onclick = () => startStudy(cards);
  document.querySelector('#important-study').onclick = () => {
    const selected = cards.filter((c) => c.important);
    if (!selected.length) return toast(t('noImportant'));
    startStudy(selected);
  };
  document.querySelectorAll('[data-important]').forEach(
    (b) =>
      (b.onclick = () =>
        run(async () => {
          const c = cards.find((x) => x.id === Number(b.dataset.important));
          await api(`/cards/${c.id}`, {
            method: 'PATCH',
            body: {
              important: !c.important,
            },
          });
          await openFolder(folder.id);
        })),
  );
  document
    .querySelectorAll('[data-edit]')
    .forEach(
      (b) => (b.onclick = () => cardModal(cards.find((c) => c.id === Number(b.dataset.edit)))),
    );
  document.querySelectorAll('[data-delete]').forEach(
    (b) =>
      (b.onclick = () => {
        if (confirm(t('confirmCard')))
          run(async () => {
            await api(`/cards/${b.dataset.delete}`, {
              method: 'DELETE',
            });
            await openFolder(folder.id);
          });
      }),
  );
}

function cardModal(card) {
  modal(
    t(card ? 'edit' : 'addCard'),
    `<label>${t('word')}<input name="word" required maxlength="1000" value="${esc(card?.word || '')}">
      </label>
      <label>${t('meaning')}<input name="meaning" required maxlength="1000" value="${esc(card?.meaning || '')}">
      </label>
      <label>${t('example')}<input name="example" maxlength="2000" value="${esc(card?.example || '')}">
      </label>
      <div class="toolbar">
      <button class="btn">${t('save')}</button>
      </div>`,
    async (e, m) => {
      const data = Object.fromEntries(new FormData(e.target));
      await api(card ? `/cards/${card.id}` : `/folders/${folder.id}/cards`, {
        method: card ? 'PATCH' : 'POST',
        body: card
          ? data
          : {
              cards: [data],
            },
      });
      m.remove();
      await openFolder(folder.id);
    },
  );
}
