const fileInput = document.querySelector('#csv-file');
const status = document.querySelector('#status');
const cardList = document.querySelector('#card-list');

fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  cardList.replaceChildren();
  status.classList.remove('error');

  if (!file) {
    status.textContent = 'No file selected.';
    return;
  }

  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2 || !rows[0][0]?.trim()) {
      throw new Error('The CSV needs a header row and at least one data row.');
    }

    const header = rows[0][0].trim();
    const dataRows = rows.slice(1).filter(row => row.some(value => value.trim() !== ''));

    dataRows.forEach(row => {
      const card = document.createElement('article');
      const label = document.createElement('strong');
      label.textContent = `${header} : `;
      card.className = 'row-card';
      card.append(label, document.createTextNode(row[0] ?? ''));
      cardList.append(card);
    });

    status.textContent = `${dataRows.length} row${dataRows.length === 1 ? '' : 's'} loaded from ${file.name}.`;
  } catch (error) {
    status.classList.add('error');
    status.textContent = `Could not read this CSV: ${error.message}`;
  }
});

// Handles commas, quoted cells, escaped quotes, and line breaks inside quoted cells.
function parseCsv(input) {
  const rows = [[]];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === ',' && !quoted) {
      rows.at(-1).push(cell); cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && input[i + 1] === '\n') i += 1;
      rows.at(-1).push(cell); cell = '';
      rows.push([]);
    } else {
      cell += char;
    }
  }

  if (quoted) throw new Error('There is an unclosed quoted value.');
  rows.at(-1).push(cell);
  if (rows.at(-1).length === 1 && rows.at(-1)[0] === '') rows.pop();
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}
