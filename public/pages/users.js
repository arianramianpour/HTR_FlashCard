'use strict';

function usersPage() {
  shell(
    `<div class="heading">
      <div>
      <span class="eyebrow">${t('users')}</span>
      <h1>${t('managePeople')}</h1>
      <p>${t('peopleText')}</p>
      </div>
      </div>
      <div class="cards-list">${people
        .map(
          (p) => `<div class="card-row">
      <div>
      <strong>${esc(p.name)}</strong>
      <p>${esc(p.email)}</p>
      </div>
      <select style="width:auto" data-user="${p.id}" ${p.id === user.id ? 'disabled' : ''} aria-label="${t('role')}">${['student', 'teacher', 'admin'].map((role) => `<option value="${role}" ${p.role === role ? 'selected' : ''}>${role}</option>`).join('')}</select>
      </div>`,
        )
        .join('')}</div>`,
  );
  document.querySelectorAll('[data-user]').forEach(
    (s) =>
      (s.onchange = () =>
        run(async () => {
          await api(`/users/${s.dataset.user}`, {
            method: 'PATCH',
            body: {
              role: s.value,
            },
          });
          await load('users');
        })),
  );
}
