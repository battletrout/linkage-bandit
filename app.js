const fileInput = document.querySelector('#csv-file');
const status = document.querySelector('#status');
const cardList = document.querySelector('#card-list');
const fieldControls = document.querySelector('#field-controls');
const fieldList = document.querySelector('#field-list');
const selectAllButton = document.querySelector('#select-all');
const clearAllButton = document.querySelector('#clear-all');
let headers = [];
let dataRows = [];

fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  cardList.replaceChildren();
  fieldControls.hidden = true;
  status.classList.remove('error');

  if (!file) {
    status.textContent = 'No file selected.';
    return;
  }

  try {
    const rows = parseCsv(await file.text());
    if (rows.length < 2 || !rows[0].some(header => header.trim())) {
      throw new Error('The CSV needs a header row and at least one data row.');
    }

    headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
    dataRows = rows.slice(1).filter(row => row.some(value => value.trim() !== ''));
    buildFieldPicker();
    renderCards();
    fieldControls.hidden = false;

    status.textContent = `${dataRows.length} row${dataRows.length === 1 ? '' : 's'} loaded from ${file.name}.`;
  } catch (error) {
    status.classList.add('error');
    status.textContent = `Could not read this CSV: ${error.message}`;
  }
});

selectAllButton.addEventListener('click', () => setAllFields(true));
clearAllButton.addEventListener('click', () => setAllFields(false));

function buildFieldPicker() {
  fieldList.replaceChildren();
  headers.forEach((header, index) => {
    const option = document.createElement('label');
    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.value = index;
    checkbox.checked = true;
    checkbox.addEventListener('change', renderCards);
    option.className = 'field-option';
    option.append(checkbox, document.createTextNode(header));
    fieldList.append(option);
  });
}

function setAllFields(checked) {
  fieldList.querySelectorAll('input').forEach(input => { input.checked = checked; });
  renderCards();
}

function renderCards() {
  const selectedFields = [...fieldList.querySelectorAll('input:checked')].map(input => Number(input.value));
  cardList.replaceChildren();

  dataRows.forEach(row => {
    const card = document.createElement('article');
    card.className = 'row-card';

    selectedFields.forEach(index => {
      const field = document.createElement('div');
      const label = document.createElement('strong');
      field.className = 'field-value';
      label.textContent = `${headers[index]} : `;
      field.append(label, document.createTextNode(row[index] ?? ''));
      card.append(field);
    });

    if (!selectedFields.length) card.textContent = 'No fields selected.';
    cardList.append(card);
  });
}

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
