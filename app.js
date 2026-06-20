const viewers = document.querySelector('#viewers');
const viewerTemplate = document.querySelector('#viewer-template');
const relationshipControls = document.querySelector('#relationship-controls');
const leftMatchField = document.querySelector('#left-match-field');
const rightMatchField = document.querySelector('#right-match-field');
const relationshipLines = document.querySelector('#relationship-lines');
const csvViewers = [];
let relationshipLineFrame;

function createViewer(title) {
  const viewer = viewerTemplate.content.firstElementChild.cloneNode(true);
  viewers.append(viewer);
  const csvViewer = new CsvViewer(viewer, title);
  csvViewers.push(csvViewer);
  return csvViewer;
}

class CsvViewer {
  constructor(element, title) {
    this.element = element;
    this.headers = [];
    this.dataRows = [];
    this.fileName = '';
    this.fileInput = element.querySelector('.csv-file');
    this.status = element.querySelector('.status');
    this.cardList = element.querySelector('.card-list');
    this.fieldControls = element.querySelector('.field-controls');
    this.fieldList = element.querySelector('.field-list');
    this.dataControls = element.querySelector('.data-controls');
    this.filterField = element.querySelector('.filter-field');
    this.filterValue = element.querySelector('.filter-value');
    this.sortField = element.querySelector('.sort-field');
    this.sortDirection = element.querySelector('.sort-direction');
    element.querySelector('.viewer-title').textContent = title;

    this.fileInput.addEventListener('change', () => this.loadFile());
    element.querySelector('.select-all').addEventListener('click', () => this.setAllFields(true));
    element.querySelector('.clear-all').addEventListener('click', () => this.setAllFields(false));
    this.filterField.addEventListener('change', () => this.renderCards());
    this.filterValue.addEventListener('input', () => this.renderCards());
    this.sortField.addEventListener('change', () => this.renderCards());
    this.sortDirection.addEventListener('change', () => this.renderCards());
    element.querySelector('.clear-filter').addEventListener('click', () => {
      this.filterValue.value = '';
      this.renderCards();
    });
  }

  async loadFile() {
    const [file] = this.fileInput.files;
    this.cardList.replaceChildren();
    this.fieldControls.hidden = true;
    this.dataControls.hidden = true;
    this.status.classList.remove('error');
    this.headers = [];
    this.dataRows = [];
    this.fileName = '';
    updateRelationshipControls();

    if (!file) {
      this.status.textContent = 'No file selected.';
      return;
    }

    try {
      const rows = parseCsv(await file.text());
      if (rows.length < 2 || !rows[0].some(header => header.trim())) {
        throw new Error('The CSV needs a header row and at least one data row.');
      }

      this.headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
      this.dataRows = rows.slice(1).filter(row => row.some(value => value.trim() !== ''));
      this.fileName = file.name;
      this.buildFieldPicker();
      this.buildDataControls();
      this.renderCards();
      this.fieldControls.hidden = false;
      this.dataControls.hidden = false;
      updateRelationshipControls();
      scheduleRelationshipLineUpdate();
    } catch (error) {
      this.status.classList.add('error');
      this.status.textContent = `Could not read this CSV: ${error.message}`;
      updateRelationshipControls();
    }
  }

  buildFieldPicker() {
    this.fieldList.replaceChildren();
    this.headers.forEach((header, index) => {
      const option = document.createElement('label');
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.value = index;
      checkbox.checked = true;
      checkbox.addEventListener('change', () => this.renderCards());
      option.className = 'field-option';
      option.append(checkbox, document.createTextNode(header));
      this.fieldList.append(option);
    });
  }

  buildDataControls() {
    [this.filterField, this.sortField].forEach(select => {
      select.replaceChildren();
      this.headers.forEach((header, index) => select.add(new Option(header, index)));
    });
    this.filterValue.value = '';
    this.sortDirection.value = 'asc';
  }

  setAllFields(checked) {
    this.fieldList.querySelectorAll('input').forEach(input => { input.checked = checked; });
    this.renderCards();
  }

  renderCards() {
    const selectedFields = [...this.fieldList.querySelectorAll('input:checked')].map(input => Number(input.value));
    const filterIndex = Number(this.filterField.value);
    const sortIndex = Number(this.sortField.value);
    const query = this.filterValue.value.trim().toLocaleLowerCase();
    const direction = this.sortDirection.value === 'desc' ? -1 : 1;
    const visibleRows = this.dataRows
      .filter(row => !query || (row[filterIndex] ?? '').toLocaleLowerCase().includes(query))
      .map((row, index) => ({ row, index }))
      .sort((a, b) => compareValues(a.row[sortIndex], b.row[sortIndex]) * direction || a.index - b.index)
      .map(item => item.row);

    const relationshipField = this === csvViewers[0] ? Number(leftMatchField.value) : Number(rightMatchField.value);
    const canDrawRelationships = csvViewers[0]?.headers.length && csvViewers[1]?.headers.length;
    this.cardList.replaceChildren();
    visibleRows.forEach(row => {
      const card = document.createElement('article');
      card.className = 'row-card';
      if (canDrawRelationships) {
        card.dataset.relationshipKey = normalizeRelationshipValue(row[relationshipField]);
        card.addEventListener('mouseenter', () => highlightRelationship(card.dataset.relationshipKey));
        card.addEventListener('mouseleave', clearRelationshipHighlight);
      }
      selectedFields.forEach(index => {
        const field = document.createElement('div');
        const label = document.createElement('strong');
        field.className = 'field-value';
        label.textContent = `${this.headers[index]} : `;
        field.append(label, document.createTextNode(row[index] ?? ''));
        card.append(field);
      });
      if (!selectedFields.length) card.textContent = 'No fields selected.';
      this.cardList.append(card);
    });

    if (!visibleRows.length) {
      const empty = document.createElement('p');
      empty.className = 'empty-state';
      empty.textContent = 'No rows match this filter.';
      this.cardList.append(empty);
    }
    this.status.textContent = `${visibleRows.length} of ${this.dataRows.length} row${this.dataRows.length === 1 ? '' : 's'} shown from ${this.fileName}.`;
    scheduleRelationshipLineUpdate();
  }
}

createViewer('CSV A');
createViewer('CSV B');

leftMatchField.addEventListener('change', refreshRelationshipDisplay);
rightMatchField.addEventListener('change', refreshRelationshipDisplay);
window.addEventListener('resize', scheduleRelationshipLineUpdate);
window.addEventListener('scroll', scheduleRelationshipLineUpdate, true);

function updateRelationshipControls() {
  const [leftViewer, rightViewer] = csvViewers;
  const bothFilesLoaded = leftViewer?.headers.length && rightViewer?.headers.length;
  relationshipControls.hidden = !bothFilesLoaded;
  if (!bothFilesLoaded) {
    relationshipLines.replaceChildren();
    return;
  }

  populateMatchField(leftMatchField, leftViewer.headers);
  populateMatchField(rightMatchField, rightViewer.headers);
  refreshRelationshipDisplay();
}

function populateMatchField(select, headers) {
  const previousValue = select.value;
  select.replaceChildren();
  headers.forEach((header, index) => select.add(new Option(header, index)));
  select.value = headers[previousValue] ? previousValue : '0';
}

function refreshRelationshipDisplay() {
  csvViewers.forEach(viewer => viewer.renderCards());
  scheduleRelationshipLineUpdate();
}

function scheduleRelationshipLineUpdate() {
  cancelAnimationFrame(relationshipLineFrame);
  relationshipLineFrame = requestAnimationFrame(drawRelationshipLines);
}

function drawRelationshipLines() {
  const [leftViewer, rightViewer] = csvViewers;
  relationshipLines.replaceChildren();
  if (!leftViewer?.headers.length || !rightViewer?.headers.length) return;

  const canvas = viewers.getBoundingClientRect();
  relationshipLines.setAttribute('width', canvas.width);
  relationshipLines.setAttribute('height', canvas.height);
  relationshipLines.setAttribute('viewBox', `0 0 ${canvas.width} ${canvas.height}`);

  const rightCardsByKey = new Map();
  rightViewer.cardList.querySelectorAll('.row-card[data-relationship-key]').forEach(card => {
    const key = card.dataset.relationshipKey;
    if (!key) return;
    const matches = rightCardsByKey.get(key) ?? [];
    matches.push(card);
    rightCardsByKey.set(key, matches);
  });

  leftViewer.cardList.querySelectorAll('.row-card[data-relationship-key]').forEach(leftCard => {
    const key = leftCard.dataset.relationshipKey;
    if (!key) return;
    const rightCards = rightCardsByKey.get(key) ?? [];
    rightCards.forEach(rightCard => addRelationshipLine(leftCard, rightCard, key, canvas));
  });
}

function addRelationshipLine(leftCard, rightCard, key, canvas) {
  const left = leftCard.getBoundingClientRect();
  const right = rightCard.getBoundingClientRect();
  const startX = left.right - canvas.left;
  const startY = left.top + left.height / 2 - canvas.top;
  const endX = right.left - canvas.left;
  const endY = right.top + right.height / 2 - canvas.top;
  const bend = Math.max(36, (endX - startX) * .35);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.classList.add('relationship-line');
  line.dataset.relationshipKey = key;
  line.setAttribute('d', `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`);
  line.addEventListener('mouseenter', () => highlightRelationship(key));
  line.addEventListener('mouseleave', clearRelationshipHighlight);
  relationshipLines.append(line);
}

function highlightRelationship(key) {
  if (!key || !relationshipLines.querySelector(`[data-relationship-key="${CSS.escape(key)}"]`)) return;
  document.querySelectorAll('.row-card[data-relationship-key], .relationship-line').forEach(element => {
    const matches = element.dataset.relationshipKey === key;
    element.classList.toggle('relationship-active', matches);
    element.classList.toggle('relationship-muted', !matches);
  });
}

function clearRelationshipHighlight() {
  document.querySelectorAll('.relationship-active, .relationship-muted').forEach(element => {
    element.classList.remove('relationship-active', 'relationship-muted');
  });
}

function normalizeRelationshipValue(value) {
  return (value ?? '').trim().toLocaleLowerCase();
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
    } else cell += char;
  }
  if (quoted) throw new Error('There is an unclosed quoted value.');
  rows.at(-1).push(cell);
  if (rows.at(-1).length === 1 && rows.at(-1)[0] === '') rows.pop();
  if (rows[0]?.[0]) rows[0][0] = rows[0][0].replace(/^\uFEFF/, '');
  return rows;
}
