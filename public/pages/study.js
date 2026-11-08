'use strict';

function shuffle(a) {
  return [...a].sort(() => Math.random() - 0.5);
}

// Each selected card starts with one required correct answer.
function startStudy(selected) {
  const chosen = shuffle(selected).slice(0, 25);
  study = {
    queue: chosen.map((c) => ({
      card: c,
      needed: 1,
      missed: false,
    })),
    total: chosen.length,
    completed: 0,
    results: {},
    revealed: false,
    reverse: Math.random() < 0.5,
    saving: false,
    summary: null,
  };
  view = 'study';
  render();
}

function studyPage() {
  if (study.summary) {
    shell(
      `<div class="study-wrap">
      <div class="empty">
      <div class="big-icon">✨</div>
      <h2>${t('sessionDone')}</h2>
      <p>${t('sessionText')}</p>
      <div class="toolbar" style="justify-content:center;margin-bottom:24px">
      <span class="points">✓ ${study.summary.correct} ${t('correct')}</span>
      <span class="points">↻ ${study.summary.incorrect} ${t('incorrect')}</span>
      <span class="points">✦ ${study.summary.points} ${t('summaryPoints')}</span>
      </div>
      <button class="btn" id="finish">${t('finish')}</button>
      </div>
      </div>`,
    );
    document.querySelector('#finish').onclick = () => run(() => openFolder(folder.id));
    return;
  }
  const item = study.queue[0];
  if (!item) {
    shell(
      `<div class="empty"><h2>${t('sessionDone')}</h2><p>${t('saveError')}</p><button class="btn" id="retry">${t('retry')}</button></div>`,
    );
    document.querySelector('#retry').onclick = saveStudy;
    return;
  }
  const c = item.card;
  shell(
    `<div class="study-wrap">
      <button class="link back" id="exit">← ${t('finish')}</button>
      <div class="toolbar" style="justify-content:space-between">
      <span class="eyebrow">${t('practice')}</span>
      <span class="muted">${study.queue.length} ${t('remaining')}</span>
      </div>
      <div class="progress" aria-label="${t('sessionProgress')}">
      <div style="width:${(study.completed / study.total) * 100}%">
      </div>
      </div>
      <div class="study-card">
      <span class="eyebrow">${t(study.reverse ? 'questionMeaning' : 'questionWord')}</span>
      <div class="prompt">${esc(study.reverse ? c.meaning : c.word)}</div>${study.revealed ? `<div class="answer">${esc(study.reverse ? c.word : c.meaning)}${c.example ? `<p>${esc(c.example)}</p>` : ''}</div>` : `<p>${t('hint')}</p>`}</div>
      <div class="study-actions">${
        study.revealed
          ? `<button class="btn secondary" id="no">↻ ${t('no')}</button>
      <button class="btn" id="yes">✓ ${t('yes')}</button>
      <button class="btn soft" id="mark">${c.important ? t('marked') : t('mark')}</button>`
          : `<button class="btn" id="show">${t('show')} →</button>`
      }</div>
      </div>`,
  );
  document.querySelector('#exit').onclick = () => run(() => openFolder(folder.id));
  document.querySelector('#show')?.addEventListener('click', () => {
    study.revealed = true;
    render();
  });
  document.querySelector('#mark')?.addEventListener('click', () =>
    run(async () => {
      await api(`/cards/${c.id}`, {
        method: 'PATCH',
        body: {
          important: true,
        },
      });
      c.important = true;
      render();
    }),
  );
  document.querySelector('#yes')?.addEventListener('click', () => answer(true));
  document.querySelector('#no')?.addEventListener('click', () => answer(false));
}

// A missed card returns to the queue and needs three subsequent correct answers.
function answer(correct) {
  const item = study.queue.shift();
  const r =
    study.results[item.card.id] ||
    (study.results[item.card.id] = {
      id: item.card.id,
      correct: 0,
      incorrect: 0,
    });
  if (correct) {
    r.correct++;
    item.needed--;
    if (item.needed > 0) study.queue.push(item);
    else study.completed++;
  } else {
    r.incorrect++;
    item.missed = true;
    item.needed = 3;
    study.queue.push(item);
  }
  study.revealed = false;
  study.reverse = Math.random() < 0.5;
  if (!study.queue.length) saveStudy();
  else render();
}

// Save results only once a session has been completed.
function saveStudy() {
  if (study.saving) return;
  study.saving = true;
  run(async () => {
    try {
      study.summary = await api('/study', {
        method: 'POST',
        body: {
          folderId: folder.id,
          results: Object.values(study.results),
        },
      });
      user.points += study.summary.points;
    } finally {
      study.saving = false;
      render();
    }
  });
}
