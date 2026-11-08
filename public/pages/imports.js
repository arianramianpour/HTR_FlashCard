'use strict';

// Parse quoted CSV fields, including commas and line breaks inside quotes.
function parseCsv(text) {
  const rows = [];
  let row = [],
    field = '',
    quoted = false,
    closed = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          quoted = false;
          closed = true;
        }
      } else field += c;
    } else if (c === '"') {
      if (field.trim() || closed) throw Error('Invalid quote in text file');
      field = '';
      quoted = true;
    } else if (c === ',') {
      row.push(field.trim());
      field = '';
      closed = false;
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field.trim());
      if (row.some(Boolean)) rows.push(row);
      row = [];
      field = '';
      closed = false;
    } else {
      if (closed && !/\s/.test(c)) throw Error('Invalid text after closing quote');
      field += c;
    }
  }
  if (quoted) throw Error('Unclosed quoted field');
  row.push(field.trim());
  if (row.some(Boolean)) rows.push(row);
  return rows.map((r, i) => {
    if (r.length !== 2 || !r[0] || !r[1])
      throw Error(`Invalid line ${i + 1}: expected word,meaning`);
    return {
      word: r[0],
      meaning: r[1],
    };
  });
}

function importModal() {
  let imported = [];
  const m = modal(
    t('importTitle'),
    `<p>${t('importHelp')}</p><label>${t('file')}<input type="file" name="file" accept=".txt,.csv,.json,application/json,text/plain,text/csv" required></label><div class="preview">${t('preview')}</div><button class="btn" disabled>${t('importButton')}</button>`,
    async (e, el) => {
      if (!imported.length) return;
      await api(`/folders/${folder.id}/cards`, {
        method: 'POST',
        body: {
          cards: imported,
        },
      });
      el.remove();
      await openFolder(folder.id);
    },
  );
  const input = m.querySelector('input'),
    preview = m.querySelector('.preview'),
    button = m.querySelector('form button');
  input.onchange = () =>
    run(async () => {
      imported = [];
      button.disabled = true;
      try {
        const file = input.files[0];
        if (!file) return;
        if (file.size > 1024 * 1024) throw Error('File is too large (maximum 1 MB)');
        const text = (await file.text()).replace(/^\uFEFF/, '');
        const data = /\.json$/i.test(file.name) ? JSON.parse(text) : parseCsv(text);
        if (!Array.isArray(data) || !data.length) throw Error('No cards found');
        if (data.length + cards.length > 300) throw Error('A folder can contain at most 300 cards');
        imported = data.map((item, i) => {
          if (
            !item ||
            typeof item.word !== 'string' ||
            !item.word.trim() ||
            typeof item.meaning !== 'string' ||
            !item.meaning.trim()
          )
            throw Error(`Invalid card ${i + 1}`);
          return {
            word: item.word.trim(),
            meaning: item.meaning.trim(),
            example: typeof item.example === 'string' ? item.example : '',
          };
        });
        preview.textContent =
          `${imported.length} ${t('cards')}\n` +
          imported
            .slice(0, 10)
            .map((c) => `${c.word} — ${c.meaning}`)
            .join('\n') +
          (imported.length > 10 ? '\n…' : '');
        button.disabled = false;
      } catch (e) {
        preview.textContent = e.message;
      }
    });
}
