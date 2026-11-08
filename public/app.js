'use strict';

// Route between the page renderers after shared state and page scripts load.
async function load(next) {
  view = next;
  if (next === 'folders') folders = await api('/folders');
  if (next === 'templates') templates = await api('/templates');
  if (next === 'users') people = await api('/users');
  render();
}

function render() {
  applyLanguage();
  if (!user) return authPage();
  if (view === 'folders') folderList();
  else if (view === 'folder') folderPage();
  else if (view === 'templates') templatePage();
  else if (view === 'users') usersPage();
  else if (view === 'study') studyPage();
}
(async () => {
  try {
    user = await api('/me');
    lang = user.language;
    localStorage.setItem('language', lang);
    await load('folders');
  } catch (e) {
    user = null;
    render();
  }
})();
