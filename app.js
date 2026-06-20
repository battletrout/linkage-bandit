const viewers = document.querySelector('#viewers');
const viewerTemplate = document.querySelector('#viewer-template');
const relationshipControls = document.querySelector('#relationship-controls');
const leftMatchField = document.querySelector('#left-match-field');
const rightMatchField = document.querySelector('#right-match-field');
const relationshipLines = document.querySelector('#relationship-lines');
const connectionSpace = document.querySelector('#connection-space');
const connectionSpaceValue = document.querySelector('#connection-space-value');
const linkageLayout = document.querySelector('#linkage-layout');
const selectionStatus = document.querySelector('#selection-status');
const addManualLinkButton = document.querySelector('#add-manual-link');
const clearSelectionButton = document.querySelector('#clear-selection');
const changesFileInput = document.querySelector('#changes-file');
const downloadChangesButton = document.querySelector('#download-changes');
const configFileInput = document.querySelector('#config-file');
const downloadConfigButton = document.querySelector('#download-config');
const hotkeyAddLink = document.querySelector('#hotkey-add-link');
const hotkeyClearSelection = document.querySelector('#hotkey-clear-selection');
const csvViewers = [];
let relationshipLineFrame;
let manualLinks = [];
let selectedCards = { left: null, right: null };
let loadedConfiguration = null;

function createViewer(title, side) {
  const viewer = viewerTemplate.content.firstElementChild.cloneNode(true);
  viewers.append(viewer);
  const csvViewer = new CsvViewer(viewer, title, side);
  csvViewers.push(csvViewer);
  return csvViewer;
}

class CsvViewer {
  constructor(element, title, side) {
    this.element = element;
    this.side = side;
    this.headers = [];
    this.dataRows = [];
    this.fileName = '';
    this.rawCsv = '';
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
    this.exportFormat = element.querySelector('.export-format');
    this.downloadFileButton = element.querySelector('.download-file');
    element.querySelector('.viewer-title').textContent = title;

    this.fileInput.addEventListener('change', () => this.loadFile());
    element.querySelector('.select-all').addEventListener('click', () => this.setAllFields(true));
    element.querySelector('.clear-all').addEventListener('click', () => this.setAllFields(false));
    this.filterField.addEventListener('change', () => this.updateDisplay());
    this.filterValue.addEventListener('input', () => this.updateDisplay());
    this.sortField.addEventListener('change', () => this.updateDisplay());
    this.sortDirection.addEventListener('change', () => this.updateDisplay());
    this.exportFormat.addEventListener('change', () => this.updateExportButton());
    this.downloadFileButton.addEventListener('click', () => this.downloadFile());
    element.querySelector('.clear-filter').addEventListener('click', () => {
      this.filterValue.value = '';
      this.updateDisplay();
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
    this.rawCsv = '';
    this.exportFormat.hidden = true;
    this.downloadFileButton.hidden = true;
    updateRelationshipControls();

    if (!file) {
      this.status.textContent = 'No file selected.';
      return;
    }

    try {
      const importedText = await file.text();
      this.rawCsv = getImportedCsv(file.name, importedText);
      const rows = parseCsv(this.rawCsv);
      if (rows.length < 2 || !rows[0].some(header => header.trim())) {
        throw new Error('The CSV needs a header row and at least one data row.');
      }

      this.headers = rows[0].map((header, index) => header.trim() || `Column ${index + 1}`);
      this.dataRows = rows.slice(1).filter(row => row.some(value => value.trim() !== ''));
      this.fileName = getImportedFileName(file.name, importedText);
      this.buildFieldPicker();
      this.buildDataControls();
      applyViewerConfiguration(this);
      this.renderCards();
      this.fieldControls.hidden = false;
      this.dataControls.hidden = false;
      this.exportFormat.hidden = false;
      this.downloadFileButton.hidden = false;
      this.updateExportButton();
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
      checkbox.addEventListener('change', () => this.updateDisplay());
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
    this.updateDisplay();
  }

  updateDisplay() {
    const bothFilesLoaded = csvViewers[0]?.headers.length && csvViewers[1]?.headers.length;
    if (linkageLayout.value !== 'none' && bothFilesLoaded) refreshRelationshipDisplay();
    else this.renderCards();
  }

  renderCards() {
    const selectedFields = [...this.fieldList.querySelectorAll('input:checked')].map(input => Number(input.value));
    const visibleRows = this.getRowsForDisplay();

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
      card.recordValues = row.slice();
      card.addEventListener('click', () => selectCard(this.side, card));
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

  getBaseRows() {
    const filterIndex = Number(this.filterField.value);
    const sortIndex = Number(this.sortField.value);
    const query = this.filterValue.value.trim().toLocaleLowerCase();
    const direction = this.sortDirection.value === 'desc' ? -1 : 1;
    return this.dataRows
      .filter(row => !query || (row[filterIndex] ?? '').toLocaleLowerCase().includes(query))
      .map((row, index) => ({ row, index }))
      .sort((a, b) => compareValues(a.row[sortIndex], b.row[sortIndex]) * direction || a.index - b.index)
      .map(item => item.row);
  }

  getRowsForDisplay() {
    const baseRows = this.getBaseRows();
    const [leftViewer, rightViewer] = csvViewers;
    const isLinkedLayout = linkageLayout.value !== 'none' && leftViewer?.headers.length && rightViewer?.headers.length;
    const thisIsAnchor = (linkageLayout.value === 'anchor-a' && this === leftViewer)
      || (linkageLayout.value === 'anchor-b' && this === rightViewer);
    if (!isLinkedLayout || thisIsAnchor) return baseRows;

    const anchorViewer = linkageLayout.value === 'anchor-a' ? leftViewer : rightViewer;
    const thisRelationshipField = this === leftViewer ? Number(leftMatchField.value) : Number(rightMatchField.value);
    const anchorRelationshipField = anchorViewer === leftViewer ? Number(leftMatchField.value) : Number(rightMatchField.value);
    const anchorKeys = anchorViewer.getBaseRows()
      .map(row => normalizeRelationshipValue(row[anchorRelationshipField]))
      .filter((key, index, keys) => key && keys.indexOf(key) === index);
    return groupRowsByRelationship(baseRows, thisRelationshipField, anchorKeys);
  }

  updateExportButton() {
    this.downloadFileButton.textContent = `Download ${this.exportFormat.value.toUpperCase()}`;
  }

  downloadFile() {
    const exportingJson = this.exportFormat.value === 'json';
    const contents = exportingJson
      ? JSON.stringify({ format: 'csv-json-lossless-v1', sourceFileName: this.fileName, csv: this.rawCsv }, null, 2)
      : this.rawCsv;
    const exportedFile = new Blob([contents], {
      type: exportingJson ? 'application/json' : 'text/csv;charset=utf-8',
    });
    const url = URL.createObjectURL(exportedFile);
    const download = document.createElement('a');
    download.href = url;
    download.download = getFileNameWithExtension(this.fileName, exportingJson ? 'json' : 'csv');
    download.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

createViewer('CSV A', 'left');
createViewer('CSV B', 'right');

leftMatchField.addEventListener('change', refreshRelationshipDisplay);
rightMatchField.addEventListener('change', refreshRelationshipDisplay);
linkageLayout.addEventListener('change', refreshRelationshipDisplay);
addManualLinkButton.addEventListener('click', addManualLink);
clearSelectionButton.addEventListener('click', clearSelectedCards);
changesFileInput.addEventListener('change', loadChangesFile);
downloadChangesButton.addEventListener('click', downloadChangesFile);
configFileInput.addEventListener('change', loadConfigurationFile);
downloadConfigButton.addEventListener('click', downloadConfigurationFile);
setupHotkeyRecorder(hotkeyAddLink);
setupHotkeyRecorder(hotkeyClearSelection);
document.addEventListener('keydown', handleHotkeys);
connectionSpace.addEventListener('input', () => {
  setConnectionSpace(Number(connectionSpace.value));
  scheduleRelationshipLineUpdate();
});
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
  applyRelationshipConfiguration();
  refreshRelationshipDisplay();
}

function populateMatchField(select, headers) {
  const previousValue = select.value;
  select.replaceChildren();
  headers.forEach((header, index) => select.add(new Option(header, index)));
  select.value = headers[previousValue] ? previousValue : '0';
}

function refreshRelationshipDisplay() {
  clearSelectedCards();
  csvViewers.forEach(viewer => viewer.renderCards());
  scheduleRelationshipLineUpdate();
}

function selectCard(side, card) {
  selectedCards[side] = card;
  updateSelectedCardUi();
}

function clearSelectedCards() {
  selectedCards = { left: null, right: null };
  updateSelectedCardUi();
}

function updateSelectedCardUi() {
  document.querySelectorAll('.row-card.relationship-selected').forEach(card => card.classList.remove('relationship-selected'));
  Object.values(selectedCards).filter(Boolean).forEach(card => card.classList.add('relationship-selected'));
  const canAdd = selectedCards.left && selectedCards.right;
  addManualLinkButton.disabled = !canAdd;
  selectionStatus.textContent = canAdd
    ? 'Ready to add a blue linkage between the selected cards.'
    : 'Select one card on each side to add a linkage.';
}

function addManualLink() {
  const { left, right } = selectedCards;
  if (!left || !right) return;
  const leftRow = left.recordValues;
  const rightRow = right.recordValues;
  const exists = manualLinks.some(link => getRecordKey(link.leftRow) === getRecordKey(leftRow)
    && getRecordKey(link.rightRow) === getRecordKey(rightRow));
  if (!exists) {
    manualLinks.push({
      id: createChangeId(),
      leftRow: leftRow.slice(),
      rightRow: rightRow.slice(),
    });
  }
  clearSelectedCards();
  scheduleRelationshipLineUpdate();
}

function createChangeId() {
  return globalThis.crypto?.randomUUID?.() ?? `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getRecordKey(row) {
  return JSON.stringify(row ?? []);
}

async function loadChangesFile() {
  const [file] = changesFileInput.files;
  if (!file) return;
  try {
    const changes = JSON.parse(await file.text());
    if (changes?.format !== 'changes-v1' || !Array.isArray(changes.manualLinks)) {
      throw new Error('This is not a supported changes file.');
    }
    manualLinks = changes.manualLinks.filter(link => Array.isArray(link.leftRow) && Array.isArray(link.rightRow));
    scheduleRelationshipLineUpdate();
  } catch (error) {
    alert(`Could not load changes: ${error.message}`);
  } finally {
    changesFileInput.value = '';
  }
}

function downloadChangesFile() {
  downloadTextFile('changes.json', JSON.stringify({ format: 'changes-v1', manualLinks }, null, 2));
}

async function loadConfigurationFile() {
  const [file] = configFileInput.files;
  if (!file) return;
  try {
    const configuration = JSON.parse(await file.text());
    if (configuration?.format !== 'relationship-config-v1') {
      throw new Error('This is not a supported configuration file.');
    }
    loadedConfiguration = configuration;
    applyConfigurationToWorkspace();
  } catch (error) {
    alert(`Could not load configuration: ${error.message}`);
  } finally {
    configFileInput.value = '';
  }
}

function downloadConfigurationFile() {
  const [leftViewer, rightViewer] = csvViewers;
  const configuration = {
    format: 'relationship-config-v1',
    viewers: {
      left: getViewerConfiguration(leftViewer),
      right: getViewerConfiguration(rightViewer),
    },
    relationship: {
      leftMatchField: leftViewer.headers[Number(leftMatchField.value)] ?? '',
      rightMatchField: rightViewer.headers[Number(rightMatchField.value)] ?? '',
      connectionSpace: Number(connectionSpace.value),
      linkageLayout: linkageLayout.value,
    },
    hotkeys: {
      addLink: hotkeyAddLink.value,
      clearSelection: hotkeyClearSelection.value,
    },
  };
  downloadTextFile('config.json', JSON.stringify(configuration, null, 2));
}

function getViewerConfiguration(viewer) {
  return {
    displayFields: [...viewer.fieldList.querySelectorAll('input:checked')].map(input => viewer.headers[Number(input.value)]),
    filterField: viewer.headers[Number(viewer.filterField.value)] ?? '',
    filterValue: viewer.filterValue.value,
    sortField: viewer.headers[Number(viewer.sortField.value)] ?? '',
    sortDirection: viewer.sortDirection.value,
    exportFormat: viewer.exportFormat.value,
  };
}

function applyConfigurationToWorkspace() {
  applyHotkeyConfiguration();
  csvViewers.forEach(viewer => applyViewerConfiguration(viewer));
  const bothFilesLoaded = csvViewers[0]?.headers.length && csvViewers[1]?.headers.length;
  if (bothFilesLoaded) {
    applyRelationshipConfiguration();
    refreshRelationshipDisplay();
  } else {
    csvViewers.filter(viewer => viewer.headers.length).forEach(viewer => viewer.renderCards());
  }
}

function applyViewerConfiguration(viewer) {
  const configuration = loadedConfiguration?.viewers?.[viewer.side];
  if (!configuration || !viewer.headers.length) return;
  if (Array.isArray(configuration.displayFields)) {
    viewer.fieldList.querySelectorAll('input').forEach(input => {
      input.checked = configuration.displayFields.includes(viewer.headers[Number(input.value)]);
    });
  }
  selectOptionByHeader(viewer.filterField, viewer.headers, configuration.filterField);
  viewer.filterValue.value = configuration.filterValue ?? '';
  selectOptionByHeader(viewer.sortField, viewer.headers, configuration.sortField);
  viewer.sortDirection.value = configuration.sortDirection === 'desc' ? 'desc' : 'asc';
  viewer.exportFormat.value = configuration.exportFormat === 'csv' ? 'csv' : 'json';
  viewer.updateExportButton();
}

function applyRelationshipConfiguration() {
  const configuration = loadedConfiguration?.relationship;
  if (!configuration) return;
  const [leftViewer, rightViewer] = csvViewers;
  selectOptionByHeader(leftMatchField, leftViewer.headers, configuration.leftMatchField);
  selectOptionByHeader(rightMatchField, rightViewer.headers, configuration.rightMatchField);
  linkageLayout.value = ['none', 'anchor-a', 'anchor-b'].includes(configuration.linkageLayout)
    ? configuration.linkageLayout : 'none';
  const space = Number(configuration.connectionSpace);
  if (Number.isFinite(space)) setConnectionSpace(space);
}

function applyHotkeyConfiguration() {
  const hotkeys = loadedConfiguration?.hotkeys;
  if (!hotkeys) return;
  if (typeof hotkeys.addLink === 'string' && hotkeys.addLink) hotkeyAddLink.value = hotkeys.addLink;
  if (typeof hotkeys.clearSelection === 'string' && hotkeys.clearSelection) hotkeyClearSelection.value = hotkeys.clearSelection;
}

function selectOptionByHeader(select, headers, header) {
  const index = headers.indexOf(header);
  if (index >= 0) select.value = String(index);
}

function downloadTextFile(fileName, contents) {
  const blob = new Blob([contents], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const download = document.createElement('a');
  download.href = url;
  download.download = fileName;
  download.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function setConnectionSpace(value) {
  const clampedValue = Math.min(Number(connectionSpace.max), Math.max(Number(connectionSpace.min), value));
  connectionSpace.value = String(clampedValue);
  viewers.style.setProperty('--connection-gap', `${clampedValue}px`);
  connectionSpaceValue.textContent = `${clampedValue} px`;
}

function setupHotkeyRecorder(input) {
  input.addEventListener('keydown', event => {
    event.preventDefault();
    if (isModifierKey(event.key)) return;
    input.value = formatHotkey(event);
    input.blur();
  });
}

function handleHotkeys(event) {
  if (event.target.matches('input, select, textarea, button')) return;
  if (formatHotkey(event) === hotkeyAddLink.value) {
    event.preventDefault();
    addManualLink();
  }
  if (formatHotkey(event) === hotkeyClearSelection.value) {
    event.preventDefault();
    clearSelectedCards();
  }
}

function formatHotkey(event) {
  const modifiers = [event.ctrlKey && 'Ctrl', event.altKey && 'Alt', event.shiftKey && 'Shift'].filter(Boolean);
  const key = event.key === ' ' ? 'Space' : event.key.length === 1 ? event.key.toUpperCase() : event.key;
  return [...modifiers, key].filter(Boolean).join('+');
}

function isModifierKey(key) {
  return ['Control', 'Alt', 'Shift', 'Meta'].includes(key);
}

function scheduleRelationshipLineUpdate() {
  cancelAnimationFrame(relationshipLineFrame);
  relationshipLineFrame = requestAnimationFrame(drawRelationshipLines);
}

function drawRelationshipLines() {
  const [leftViewer, rightViewer] = csvViewers;
  relationshipLines.replaceChildren();
  if (!leftViewer?.headers.length || !rightViewer?.headers.length) return;

  alignLinkageGroups();
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
    rightCards.forEach(rightCard => addRelationshipLine(leftCard, rightCard, key, canvas, 'hard'));
  });

  const leftCardsByRecord = getCardsByRecord(leftViewer.cardList);
  const rightCardsByRecord = getCardsByRecord(rightViewer.cardList);
  manualLinks.forEach(link => {
    const leftCards = leftCardsByRecord.get(getRecordKey(link.leftRow)) ?? [];
    const rightCards = rightCardsByRecord.get(getRecordKey(link.rightRow)) ?? [];
    leftCards.forEach(leftCard => rightCards.forEach(rightCard => {
      addRelationshipLine(leftCard, rightCard, link.id, canvas, 'manual');
    }));
  });
}

function getCardsByRecord(cardList) {
  const cardsByRecord = new Map();
  cardList.querySelectorAll('.row-card').forEach(card => {
    const key = getRecordKey(card.recordValues);
    const cards = cardsByRecord.get(key) ?? [];
    cards.push(card);
    cardsByRecord.set(key, cards);
  });
  return cardsByRecord;
}

function groupRowsByRelationship(rows, fieldIndex, relationshipOrder) {
  const rowsByKey = new Map();
  const unlinkedRows = [];
  rows.forEach(row => {
    const key = normalizeRelationshipValue(row[fieldIndex]);
    if (!key) {
      unlinkedRows.push(row);
      return;
    }
    const group = rowsByKey.get(key) ?? [];
    group.push(row);
    rowsByKey.set(key, group);
  });
  const orderedRows = relationshipOrder.flatMap(key => rowsByKey.get(key) ?? []);
  const orderedKeys = new Set(relationshipOrder);
  rowsByKey.forEach((group, key) => {
    if (!orderedKeys.has(key)) orderedRows.push(...group);
  });
  return [...orderedRows, ...unlinkedRows];
}

function alignLinkageGroups() {
  const [leftViewer, rightViewer] = csvViewers;
  leftViewer.cardList.querySelectorAll('.row-card').forEach(card => { card.style.marginTop = ''; });
  rightViewer.cardList.querySelectorAll('.row-card').forEach(card => { card.style.marginTop = ''; });
  if (linkageLayout.value === 'none') return;

  const anchorViewer = linkageLayout.value === 'anchor-a' ? leftViewer : rightViewer;
  const groupedViewer = anchorViewer === leftViewer ? rightViewer : leftViewer;
  const firstGroupedCardByKey = new Map();
  groupedViewer.cardList.querySelectorAll('.row-card[data-relationship-key]').forEach(card => {
    const key = card.dataset.relationshipKey;
    if (key && !firstGroupedCardByKey.has(key)) firstGroupedCardByKey.set(key, card);
  });

  const alignedKeys = new Set();
  anchorViewer.cardList.querySelectorAll('.row-card[data-relationship-key]').forEach(anchorCard => {
    const key = anchorCard.dataset.relationshipKey;
    const groupedCard = firstGroupedCardByKey.get(key);
    if (!key || !groupedCard || alignedKeys.has(key)) return;
    alignedKeys.add(key);
    const offset = groupedCard.getBoundingClientRect().top - anchorCard.getBoundingClientRect().top;
    if (offset > 1) anchorCard.style.marginTop = `${offset}px`;
    if (offset < -1) groupedCard.style.marginTop = `${Math.abs(offset)}px`;
  });
}

function addRelationshipLine(leftCard, rightCard, key, canvas, type) {
  const left = leftCard.getBoundingClientRect();
  const right = rightCard.getBoundingClientRect();
  const startX = left.right - canvas.left;
  const startY = left.top + left.height / 2 - canvas.top;
  const endX = right.left - canvas.left;
  const endY = right.top + right.height / 2 - canvas.top;
  const bend = Math.max(36, (endX - startX) * .35);
  const line = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  line.classList.add('relationship-line', type === 'manual' ? 'manual-link' : 'hard-link');
  line.dataset.relationshipKey = type === 'manual' ? `manual-${key}` : key;
  line.setAttribute('d', `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`);
  line.addEventListener('mouseenter', () => {
    if (type === 'manual') highlightManualLink(leftCard, rightCard, line);
    else highlightRelationship(line.dataset.relationshipKey);
  });
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

function highlightManualLink(leftCard, rightCard, line) {
  clearRelationshipHighlight();
  document.querySelectorAll('.relationship-line').forEach(otherLine => {
    otherLine.classList.toggle('relationship-active', otherLine === line);
    otherLine.classList.toggle('relationship-muted', otherLine !== line);
  });
  leftCard.classList.add('relationship-active');
  rightCard.classList.add('relationship-active');
}

function clearRelationshipHighlight() {
  document.querySelectorAll('.relationship-active, .relationship-muted').forEach(element => {
    element.classList.remove('relationship-active', 'relationship-muted');
  });
}

function normalizeRelationshipValue(value) {
  return (value ?? '').trim().toLocaleLowerCase();
}

function getCrossPlatformFileName(filePath) {
  const fileName = String(filePath ?? '').split(/[\\/]/).pop();
  return fileName || 'untitled.csv';
}

function getFileNameWithExtension(filePath, extension) {
  const fileName = getCrossPlatformFileName(filePath);
  const baseName = fileName.replace(/\.[^.]*$/, '');
  return `${baseName || 'untitled'}.${extension}`;
}

function getImportedCsv(fileName, contents) {
  if (!/\.json$/i.test(fileName)) return contents;
  let json;
  try {
    json = JSON.parse(contents);
  } catch {
    throw new Error('The JSON file is not valid JSON.');
  }
  if (json?.format !== 'csv-json-lossless-v1' || typeof json.csv !== 'string') {
    throw new Error('JSON imports must use the lossless JSON format exported by this app.');
  }
  return json.csv;
}

function getImportedFileName(fileName, contents) {
  if (!/\.json$/i.test(fileName)) return getCrossPlatformFileName(fileName);
  try {
    const sourceFileName = JSON.parse(contents)?.sourceFileName;
    return getCrossPlatformFileName(sourceFileName || fileName.replace(/\.json$/i, '.csv'));
  } catch {
    return getCrossPlatformFileName(fileName.replace(/\.json$/i, '.csv'));
  }
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
