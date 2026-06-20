const fileInput = document.querySelector('#csv-file');
const status = document.querySelector('#status');
const cardList = document.querySelector('#card-list');
const fieldControls = document.querySelector('#field-controls');
const fieldList = document.querySelector('#field-list');
const selectAllButton = document.querySelector('#select-all');
const clearAllButton = document.querySelector('#clear-all');
const dataControls = document.querySelector('#data-controls');
const filterField = document.querySelector('#filter-field');
const filterValue = document.querySelector('#filter-value');
const clearFilterButton = document.querySelector('#clear-filter');
const sortField = document.querySelector('#sort-field');
const sortDirection = document.querySelector('#sort-direction');
let headers = [];
let dataRows = [];
let fileName = '';

fileInput.addEventListener('change', async () => {
  const [file] = fileInput.files;
  cardList.replaceChildren();
  fieldControls.hidden = true;
  dataControls.hidden = true;
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
    fileName = file.name;
    buildFieldPicker();
    buildDataControls();
    renderCards();
    fieldControls.hidden = false;
    dataControls.hidden = false;
  } catch (error) {
    status.classList.add('error');
    status.textContent = `Could not read this CSV: ${error.message}`;
  }
});

selectAllButton.addEventListener('click', () => setAllFields(true));
clearAllButton.addEventListener('click', () => setAllFields(false));
filterField.addEventListener('change', renderCards);
filterValue.addEventListener('input', renderCards);
sortField.addEventListener('change', renderCards);
sortDirection.addEventListener('change', renderCards);
clearFilterButton.addEventListener('click', () => {
  filterValue.value = '';
  renderCards();
});

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

function buildDataControls() {
  [filterField, sortField].forEach(select => {
    select.replaceChildren();
    headers.forEach((header, index) => select.add(new Option(header, index)));
  });
  filterValue.value = '';
  sortDirection.value = 'asc';
}

function renderCards() {
  const selectedFields = [...fieldList.querySelectorAll('input:checked')].map(input => Number(input.value));
  const filterIndex = Number(filterField.value);
  const sortIndex = Number(sortField.value);
  const query = filterValue.value.trim().toLocaleLowerCase();
  const direction = sortDirection.value === 'desc' ? -1 : 1;
  const visibleRows = dataRows
    .filter(row => !query || (row[filterIndex] ?? '').toLocaleLowerCase().includes(query))
    .map((row, index) => ({ row, index }))
    .sort((a, b) => compareValues(a.row[sortIndex], b.row[sortIndex]) * direction || a.index - b.index)
    .map(item => item.row);

  cardList.replaceChildren();

  visibleRows.forEach(row => {
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

  if (!visibleRows.length) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'No rows match this filter.';
    cardList.append(empty);
  }

  status.textContent = `${visibleRows.length} of ${dataRows.length} row${dataRows.length === 1 ? '' : 's'} shown from ${fileName}.`;
}

function compareValues(first, second) {
  const a = (first ?? '').trim();
  const b = (second ?? '').trim();
  const numericA = Number(a);
  const numericB = Number(b);
  if (a !== '' && b !== '' && Number.isFinite(numericA) && Number.isFinite(numericB)) return numericA - numericB;
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
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
