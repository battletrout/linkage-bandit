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
const showChanges = document.querySelector('#show-changes');
const showHardLinks = document.querySelector('#show-hard-links');
const changesFileInput = document.querySelector('#changes-file');
const saveChangesButton = document.querySelector('#save-changes');
const configFileInput = document.querySelector('#config-file');
const saveConfigButton = document.querySelector('#save-config');
const resetConfigButton = document.querySelector('#reset-config');
const hotkeyAddLink = document.querySelector('#hotkey-add-link');
const hotkeyAddLinkedRecord = document.querySelector('#hotkey-add-linked-record');
const hotkeyDeleteRecord = document.querySelector('#hotkey-delete-record');
const hotkeyEditRecord = document.querySelector('#hotkey-edit-record');
const hotkeyToggleChanges = document.querySelector('#hotkey-toggle-changes');
const hotkeyToggleHard = document.querySelector('#hotkey-toggle-hard');
const hotkeyToggleSettings = document.querySelector('#hotkey-toggle-settings');
const hotkeyUndo = document.querySelector('#hotkey-undo');
const hotkeyRedo = document.querySelector('#hotkey-redo');
const hotkeyClearSelection = document.querySelector('#hotkey-clear-selection');
const hotkeyMenu = document.querySelector('#hotkey-menu');
const hideHotkeysButton = document.querySelector('#hide-hotkeys');
const showHotkeysButton = document.querySelector('#show-hotkeys');
const recordEditor = document.querySelector('#record-editor');
const recordEditorForm = document.querySelector('#record-editor-form');
const recordEditorFields = document.querySelector('#record-editor-fields');
const configurationStatus = document.querySelector('#configuration-status');
const configurationMessage = document.querySelector('#configuration-message');
const openSettingsButton = document.querySelector('#open-settings');
const closeSettingsButton = document.querySelector('#close-settings');
const settingsDrawer = document.querySelector('#settings-drawer');
const workspaceSummary = document.querySelector('#workspace-summary');
const openHelpButton = document.querySelector('#open-help');
const helpDialog = document.querySelector('#help-dialog');
const closeHelpButton = document.querySelector('#close-help');
const undoChangeButton = document.querySelector('#undo-change');
const redoChangeButton = document.querySelector('#redo-change');
const backupReminder = document.querySelector('#backup-reminder');
const changeLog = document.querySelector('#change-log');
const unresolvedChanges = document.querySelector('#unresolved-changes');
const csvViewers = [];
let relationshipLineFrame;
let manualLinks = [];
let recordChanges = [];
let addedRecords = [];
let deletedRecords = [];
let selectedCards = { left: null, right: null };
let selectedManualLinkId = null;
let loadedConfiguration = null;
let loadedChangesFileName = '';
let changesDirty = false;
let configDirty = false;
let undoStack = [];
let redoStack = [];

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
    this.delimiter = ',';
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
    this.exportContent = element.querySelector('.export-content');
    this.delimiterMenu = element.querySelector('.delimiter-menu');
    this.delimiterChoice = element.querySelector('.delimiter-choice');
    this.customDelimiter = element.querySelector('.custom-delimiter');
    this.addRecordButton = element.querySelector('.add-record');
    this.downloadFileButton = element.querySelector('.download-file');
    element.querySelector('.viewer-title').textContent = title;

    this.fileInput.addEventListener('change', () => this.showDelimiterMenu());
    element.querySelector('.select-all').addEventListener('click', () => this.setAllFields(true));
    element.querySelector('.clear-all').addEventListener('click', () => this.setAllFields(false));
    this.filterField.addEventListener('change', () => this.updateDisplay());
    this.filterValue.addEventListener('input', () => this.updateDisplay());
    this.sortField.addEventListener('change', () => this.updateDisplay());
    this.sortDirection.addEventListener('change', () => this.updateDisplay());
    this.exportFormat.addEventListener('change', () => this.updateExportButton());
    this.exportContent.addEventListener('change', () => this.updateExportButton());
    this.delimiterChoice.addEventListener('change', () => this.updateDelimiterChoice());
    this.delimiterMenu.addEventListener('submit', event => this.confirmDelimiter(event));
    this.delimiterMenu.addEventListener('close', () => {
      if (this.delimiterMenu.returnValue === 'load') this.loadFile();
      else this.fileInput.value = '';
    });
    this.addRecordButton.addEventListener('click', () => openNewRecordEditor(this));
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
    this.delimiter = ',';
    this.exportFormat.hidden = true;
    this.exportContent.hidden = true;
    this.addRecordButton.hidden = true;
    this.downloadFileButton.hidden = true;
    updateRelationshipControls();

    if (!file) {
      this.status.textContent = 'No file selected.';
      updateConfigurationStatus();
      return;
    }

    if (this.delimiterChoice.value === 'custom' && !this.customDelimiter.value) {
      this.status.classList.add('error');
      this.status.textContent = 'Enter a custom delimiter character before loading this file.';
      return;
    }

    try {
      const importedText = await file.text();
      const imported = getImportedFile(file.name, importedText);
      this.delimiter = resolveImportDelimiter(this.delimiterChoice.value, this.customDelimiter.value, file.name, importedText, imported.csv);
      const rows = imported.rows ?? parseCsv(imported.csv, this.delimiter);
      this.rawCsv = serializeCsv(rows[0] ?? [], rows.slice(1), this.delimiter);
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
      this.exportContent.hidden = false;
      this.addRecordButton.hidden = false;
      this.downloadFileButton.hidden = false;
      this.updateExportButton();
      updateRelationshipControls();
      scheduleRelationshipLineUpdate();
      updateConfigurationStatus();
      updateWorkspaceSummary();
      updateChangesPanel();
    } catch (error) {
      this.status.classList.add('error');
      this.status.textContent = `Could not read this CSV: ${error.message}`;
      updateRelationshipControls();
      updateConfigurationStatus();
      updateWorkspaceSummary();
      updateChangesPanel();
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
      checkbox.addEventListener('change', () => { markConfigDirty(); this.updateDisplay(); });
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
    markConfigDirty();
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
      const displayRow = getDisplayRow(this.side, row);
      const card = document.createElement('article');
      card.className = 'row-card';
      if (isAddedRecord(this.side, row)) card.classList.add('added-record');
      if (isDeletedRecord(this.side, row)) {
        card.classList.add('marked-deletion');
        const note = document.createElement('p');
        note.className = 'deletion-note';
        note.textContent = 'Marked for deletion';
        card.append(note);
      }
      if (canDrawRelationships) {
        card.dataset.relationshipKey = normalizeRelationshipValue(displayRow[relationshipField]);
        card.dataset.side = this.side;
        card.addEventListener('mouseenter', () => highlightCardConnections(card, this.side));
        card.addEventListener('mouseleave', clearRelationshipHighlight);
      }
      card.recordValues = row.slice();
      card.addEventListener('click', () => selectCard(this.side, card));
      selectedFields.forEach(index => {
        const field = document.createElement('div');
        const label = document.createElement('strong');
        field.className = 'field-value';
        label.textContent = `${this.headers[index]} : `;
        const value = document.createElement('span');
        value.textContent = displayRow[index] ?? '';
        if (isFieldChanged(this.side, row, index) || isAddedRecord(this.side, row)) value.className = 'changed-value';
        field.append(label, value);
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

    getOrphanRecords(this.side).forEach(row => this.cardList.append(createGhostCard(this, row)));
    this.status.textContent = `${visibleRows.length} of ${this.dataRows.length} row${this.dataRows.length === 1 ? '' : 's'} shown from ${this.fileName}.`;
    scheduleRelationshipLineUpdate();
  }

  getBaseRows() {
    const filterIndex = Number(this.filterField.value);
    const sortIndex = Number(this.sortField.value);
    const query = this.filterValue.value.trim().toLocaleLowerCase();
    const direction = this.sortDirection.value === 'desc' ? -1 : 1;
    const rows = [...this.dataRows, ...(showChanges.checked ? getAddedRecords(this.side) : [])];
    return rows
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
    return groupRowsForAnchor(baseRows, this, anchorViewer);
  }

  updateDelimiterChoice() {
    this.customDelimiter.hidden = this.delimiterChoice.value !== 'custom';
  }

  showDelimiterMenu() {
    const [file] = this.fileInput.files;
    if (!file) {
      return;
    }
    if (/\.json$/i.test(file.name)) {
      this.loadFile();
      return;
    }
    this.delimiterChoice.value = 'auto';
    this.customDelimiter.value = '';
    this.customDelimiter.hidden = true;
    this.delimiterMenu.showModal();
  }

  confirmDelimiter(event) {
    if (event.submitter?.value !== 'load') return;
    if (this.delimiterChoice.value === 'custom' && !this.customDelimiter.value) {
      event.preventDefault();
      this.customDelimiter.focus();
    }
  }

  updateExportButton() {
    const prefix = this.exportContent.value === 'integrated' ? 'Download integrated' : 'Download source';
    this.downloadFileButton.textContent = `${prefix} ${this.exportFormat.value.toUpperCase()}`;
  }

  downloadFile() {
    const exportingJson = this.exportFormat.value === 'json';
    const integrating = this.exportContent.value === 'integrated';
    if (integrating && !confirmIntegratedExport()) return;
    const rows = integrating ? buildIntegratedRows(this) : this.dataRows;
    const csv = serializeCsv(this.headers, rows, this.delimiter);
    const contents = exportingJson
      ? JSON.stringify({
        format: 'csv-json-lossless-v1',
        sourceFileName: this.fileName,
        delimiter: this.delimiter,
        headers: this.headers,
        data: rows.map(row => Object.fromEntries(this.headers.map((header, index) => [header, row[index] ?? '']))),
      }, null, 2)
      : csv;
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

function confirmIntegratedExport() {
  const [leftViewer, rightViewer] = csvViewers;
  const leftField = leftViewer?.headers[Number(leftMatchField.value)] ?? 'not selected';
  const rightField = rightViewer?.headers[Number(rightMatchField.value)] ?? 'not selected';
  return window.confirm(`Integrated export will write linkage values using:\n\nData A: ${leftField}\nData B: ${rightField}\n\nMake sure these are the correct linkage fields before continuing.`);
}

createViewer('Data A', 'left');
createViewer('Data B', 'right');

leftMatchField.addEventListener('change', () => { markConfigDirty(); refreshRelationshipDisplay(); });
rightMatchField.addEventListener('change', () => { markConfigDirty(); refreshRelationshipDisplay(); });
linkageLayout.addEventListener('change', () => { markConfigDirty(); refreshRelationshipDisplay(); });
showChanges.addEventListener('change', () => { markConfigDirty(); refreshRelationshipDisplay(); });
showHardLinks.addEventListener('change', () => { markConfigDirty(); refreshRelationshipDisplay(); });
changesFileInput.addEventListener('change', loadChangesFile);
saveChangesButton.addEventListener('click', () => saveChangesFile(getWorkspaceFileName('changes')));
configFileInput.addEventListener('change', loadConfigurationFile);
saveConfigButton.addEventListener('click', () => saveConfigurationFile(getWorkspaceFileName('config')));
resetConfigButton.addEventListener('click', () => { if (loadedConfiguration) applyConfigurationToWorkspace(); });
undoChangeButton.addEventListener('click', undoChange);
redoChangeButton.addEventListener('click', redoChange);
openSettingsButton.addEventListener('click', () => { settingsDrawer.hidden = false; });
closeSettingsButton.addEventListener('click', () => { settingsDrawer.hidden = true; });
openHelpButton.addEventListener('click', () => helpDialog.showModal());
closeHelpButton.addEventListener('click', () => helpDialog.close());
hideHotkeysButton.addEventListener('click', () => setHotkeyMenuVisibility(false));
showHotkeysButton.addEventListener('click', () => setHotkeyMenuVisibility(true));
setupHotkeyRecorder(hotkeyAddLink);
setupHotkeyRecorder(hotkeyAddLinkedRecord);
setupHotkeyRecorder(hotkeyDeleteRecord);
setupHotkeyRecorder(hotkeyEditRecord);
setupHotkeyRecorder(hotkeyToggleChanges);
setupHotkeyRecorder(hotkeyToggleHard);
setupHotkeyRecorder(hotkeyToggleSettings);
setupHotkeyRecorder(hotkeyUndo);
setupHotkeyRecorder(hotkeyRedo);
setupHotkeyRecorder(hotkeyClearSelection);
document.addEventListener('keydown', handleHotkeys);
recordEditorForm.addEventListener('submit', saveRecordEdit);
connectionSpace.addEventListener('input', () => {
  markConfigDirty();
  setConnectionSpace(Number(connectionSpace.value));
  scheduleRelationshipLineUpdate();
});
window.addEventListener('resize', scheduleRelationshipLineUpdate);
window.addEventListener('scroll', scheduleRelationshipLineUpdate, true);
window.addEventListener('beforeunload', event => {
  if (!changesDirty && !configDirty) return;
  event.preventDefault();
  event.returnValue = '';
});

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
  selectedManualLinkId = null;
  document.querySelectorAll('.relationship-link-selected').forEach(line => line.classList.remove('relationship-link-selected'));
  updateSelectedCardUi();
}

function updateSelectedCardUi() {
  document.querySelectorAll('.row-card.relationship-selected').forEach(card => card.classList.remove('relationship-selected'));
  Object.values(selectedCards).filter(Boolean).forEach(card => card.classList.add('relationship-selected'));
  const canAdd = selectedCards.left && selectedCards.right;
  const oneCardSelected = selectedCards.left || selectedCards.right;
  selectionStatus.textContent = canAdd
    ? 'Ready to add a blue linkage between the selected cards.'
    : oneCardSelected
      ? 'Record selected. Press the edit hotkey to change visible fields.'
      : 'Select one card on each side to add a linkage.';
}

function selectManualLink(linkId) {
  selectedManualLinkId = linkId;
  selectedCards = { left: null, right: null };
  document.querySelectorAll('.relationship-line.manual-link, .relationship-line.ghost-link').forEach(line => {
    line.classList.toggle('relationship-link-selected', line.dataset.manualLinkId === linkId);
  });
  updateSelectedCardUi();
  selectionStatus.textContent = 'Blue link selected. Delete it with the button or configured hotkey.';
}

function addManualLink() {
  const { left, right } = selectedCards;
  if (!left || !right) return;
  const leftRow = left.recordValues;
  const rightRow = right.recordValues;
  const exists = manualLinks.some(link => getRecordKey(link.leftRow) === getRecordKey(leftRow)
    && getRecordKey(link.rightRow) === getRecordKey(rightRow));
  if (!exists) {
    rememberChangeState();
    manualLinks.push({
      id: createChangeId(),
      leftRow: leftRow.slice(),
      rightRow: rightRow.slice(),
    });
    markChangesDirty();
  }
  clearSelectedCards();
  scheduleRelationshipLineUpdate();
}

function deleteSelectedManualLink() {
  if (!selectedManualLinkId) return;
  if (!window.confirm('Are you sure you want to delete this new linkage?')) return;
  rememberChangeState();
  manualLinks = manualLinks.filter(link => link.id !== selectedManualLinkId);
  markChangesDirty();
  clearSelectedCards();
  refreshRelationshipDisplay();
}

function deleteSelectedItem() {
  if (selectedManualLinkId) {
    deleteSelectedManualLink();
    return;
  }
  deleteSelectedRecord();
}

function createChangeId() {
  return globalThis.crypto?.randomUUID?.() ?? `link-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function getRecordKey(row) {
  return JSON.stringify(row ?? []);
}

function getAddedRecords(side) {
  return addedRecords.filter(record => record.side === side).map(record => record.record);
}

function isAddedRecord(side, row) {
  return showChanges.checked && addedRecords.some(record => record.side === side && getRecordKey(record.record) === getRecordKey(row));
}

function isDeletedRecord(side, row) {
  return showChanges.checked && deletedRecords.some(record => record.side === side && getRecordKey(record.record) === getRecordKey(row));
}

function deleteSelectedRecord() {
  const selected = selectedCards.left || selectedCards.right;
  if (!selected || selectedCards.left && selectedCards.right) return;
  const side = selectedCards.left ? 'left' : 'right';
  const row = selected.recordValues;
  const isNewRecord = isAddedRecord(side, row);
  const confirmation = isNewRecord
    ? 'Are you sure you want to delete this new record and all associated linkages?'
    : 'Are you sure you want to delete this record?';
  if (!window.confirm(confirmation)) return;
  rememberChangeState();
  if (isNewRecord) {
    addedRecords = addedRecords.filter(record => !(record.side === side && getRecordKey(record.record) === getRecordKey(row)));
    manualLinks = manualLinks.filter(link => {
      const linkedRow = side === 'left' ? link.leftRow : link.rightRow;
      return getRecordKey(linkedRow) !== getRecordKey(row);
    });
    recordChanges = recordChanges.filter(change => !(change.side === side && getRecordKey(change.record) === getRecordKey(row)));
  } else if (!isDeletedRecord(side, row)) {
    deletedRecords.push({ side, record: row.slice() });
  }
  markChangesDirty();
  clearSelectedCards();
  refreshRelationshipDisplay();
}

function addLinkedRecord() {
  const selected = selectedCards.left || selectedCards.right;
  if (!selected || selectedCards.left && selectedCards.right) return;
  const selectedSide = selectedCards.left ? 'left' : 'right';
  const targetViewer = csvViewers.find(viewer => viewer.side !== selectedSide);
  openNewRecordEditor(targetViewer, { side: selectedSide, record: selected.recordValues });
}

function openNewRecordEditor(viewer, linkedRecord = null) {
  const visibleIndexes = [...viewer.fieldList.querySelectorAll('input:checked')].map(input => Number(input.value));
  const defaultRecord = new Array(viewer.headers.length).fill('');
  if (linkedRecord) {
    const sourceField = linkedRecord.side === 'left' ? Number(leftMatchField.value) : Number(rightMatchField.value);
    const targetField = viewer.side === 'left' ? Number(leftMatchField.value) : Number(rightMatchField.value);
    defaultRecord[targetField] = linkedRecord.record[sourceField] ?? '';
  }
  recordEditorFields.replaceChildren();
  visibleIndexes.forEach(index => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'text';
    input.dataset.fieldIndex = index;
    input.value = defaultRecord[index];
    label.append(document.createTextNode(viewer.headers[index]), input);
    recordEditorFields.append(label);
  });
  recordEditor.dataset.mode = 'add';
  recordEditor.dataset.side = viewer.side;
  recordEditor.recordValues = defaultRecord;
  recordEditor.linkedRecord = linkedRecord;
  recordEditor.querySelector('h2').textContent = `Add record to ${viewer.side === 'left' ? 'Data A' : 'Data B'}`;
  recordEditor.showModal();
  recordEditorFields.querySelector('input')?.focus();
}

function getOrphanRecords(side) {
  const viewer = csvViewers.find(candidate => candidate.side === side);
  const existingRecords = new Set([...(viewer?.dataRows ?? []), ...getAddedRecords(side)].map(getRecordKey));
  const orphanRecords = [];
  recordChanges.filter(change => change.side === side).forEach(change => {
    if (!existingRecords.has(getRecordKey(change.record))) orphanRecords.push(change.record);
  });
  manualLinks.forEach(link => {
    const record = side === 'left' ? link.leftRow : link.rightRow;
    if (!existingRecords.has(getRecordKey(record))) orphanRecords.push(record);
  });
  return [...new Map(orphanRecords.map(record => [getRecordKey(record), record])).values()];
}

function createGhostCard(viewer, row) {
  const card = document.createElement('article');
  card.className = 'row-card ghost-record';
  card.recordValues = row.slice();
  card.isGhost = true;
  const note = document.createElement('p');
  note.className = 'ghost-note';
  note.textContent = 'Ghost record — expected by changes but missing from this dataset.';
  card.append(note);
  viewer.headers.slice(0, 3).forEach((header, index) => {
    const field = document.createElement('div');
    const label = document.createElement('strong');
    field.className = 'field-value';
    label.textContent = `${header} : `;
    field.append(label, document.createTextNode(row[index] ?? ''));
    card.append(field);
  });
  return card;
}

function getRecordChange(side, row) {
  return recordChanges.find(change => change.side === side && getRecordKey(change.record) === getRecordKey(row));
}

function getDisplayRow(side, row) {
  if (!showChanges.checked) return row;
  const change = getRecordChange(side, row);
  if (!change) return row;
  return row.map((value, index) => Object.hasOwn(change.fields, index) ? change.fields[index] : value);
}

function isFieldChanged(side, row, index) {
  return showChanges.checked && Boolean(getRecordChange(side, row)?.fields?.[index] !== undefined);
}

function editSelectedRecord() {
  const selected = selectedCards.left || selectedCards.right;
  if (!selected || selectedCards.left && selectedCards.right) return;
  const viewer = csvViewers.find(candidate => candidate.side === (selectedCards.left ? 'left' : 'right'));
  const visibleIndexes = [...viewer.fieldList.querySelectorAll('input:checked')].map(input => Number(input.value));
  const displayRow = getDisplayRow(viewer.side, selected.recordValues);
  recordEditorFields.replaceChildren();
  visibleIndexes.forEach(index => {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'text';
    input.value = displayRow[index] ?? '';
    input.dataset.fieldIndex = index;
    label.append(document.createTextNode(viewer.headers[index]), input);
    recordEditorFields.append(label);
  });
  recordEditor.dataset.side = viewer.side;
  recordEditor.dataset.mode = 'edit';
  recordEditor.recordValues = selected.recordValues;
  recordEditor.querySelector('h2').textContent = 'Edit selected record';
  recordEditor.showModal();
  recordEditorFields.querySelector('input')?.focus();
}

function saveRecordEdit(event) {
  if (event.submitter?.value !== 'save') return;
  const side = recordEditor.dataset.side;
  const record = recordEditor.recordValues;
  if (!side || !record) return;
  if (recordEditor.dataset.mode === 'add') {
    rememberChangeState();
    const addedRecord = record.slice();
    recordEditorFields.querySelectorAll('input').forEach(input => {
      addedRecord[Number(input.dataset.fieldIndex)] = input.value;
    });
    addedRecords.push({ side, record: addedRecord });
    if (recordEditor.linkedRecord) {
      const source = recordEditor.linkedRecord;
      const link = side === 'left'
        ? { id: createChangeId(), leftRow: addedRecord, rightRow: source.record }
        : { id: createChangeId(), leftRow: source.record, rightRow: addedRecord };
      const exists = manualLinks.some(existing => getRecordKey(existing.leftRow) === getRecordKey(link.leftRow)
        && getRecordKey(existing.rightRow) === getRecordKey(link.rightRow));
      if (!exists) manualLinks.push(link);
    }
    recordEditor.linkedRecord = null;
    markChangesDirty();
    showChanges.checked = true;
    refreshRelationshipDisplay();
    return;
  }
  const fields = {};
  recordEditorFields.querySelectorAll('input').forEach(input => {
    const index = Number(input.dataset.fieldIndex);
    if (input.value !== (record[index] ?? '')) fields[index] = input.value;
  });
  const existingIndex = recordChanges.findIndex(change => change.side === side && getRecordKey(change.record) === getRecordKey(record));
  rememberChangeState();
  if (Object.keys(fields).length) {
    const change = { side, record: record.slice(), fields };
    if (existingIndex >= 0) recordChanges[existingIndex] = change;
    else recordChanges.push(change);
  } else if (existingIndex >= 0) {
    recordChanges.splice(existingIndex, 1);
  }
  markChangesDirty();
  showChanges.checked = true;
  refreshRelationshipDisplay();
}

async function loadChangesFile() {
  const [file] = changesFileInput.files;
  if (!file) return;
  try {
    const changes = JSON.parse(await file.text());
    if (!isValidChangesDocument(changes)) {
      throw new Error('Unsupported changes schema. Expected format "changes-v1".');
    }
    manualLinks = changes.manualLinks.filter(link => Array.isArray(link.leftRow) && Array.isArray(link.rightRow));
    recordChanges = Array.isArray(changes.recordChanges)
      ? changes.recordChanges.filter(change => ['left', 'right'].includes(change.side)
        && Array.isArray(change.record) && change.fields && typeof change.fields === 'object')
      : [];
    addedRecords = Array.isArray(changes.addedRecords)
      ? changes.addedRecords.filter(record => ['left', 'right'].includes(record.side) && Array.isArray(record.record))
      : [];
    deletedRecords = Array.isArray(changes.deletedRecords)
      ? changes.deletedRecords.filter(record => ['left', 'right'].includes(record.side) && Array.isArray(record.record))
      : [];
    loadedChangesFileName = getCrossPlatformFileName(file.name);
    changesDirty = false;
    undoStack = [];
    redoStack = [];
    scheduleRelationshipLineUpdate();
    updateConfigurationStatus();
    updateWorkspaceSummary();
  } catch (error) {
    alert(`Could not load changes: ${error.message}`);
  } finally {
    changesFileInput.value = '';
  }
}

function saveChangesFile(fileName) {
  loadedChangesFileName = fileName;
  updateInMemoryFileConfiguration(fileName);
  downloadTextFile(fileName, JSON.stringify({ format: 'changes-v1', manualLinks, recordChanges, addedRecords, deletedRecords }, null, 2));
  changesDirty = false;
  updateWorkspaceSummary();
  updateConfigurationStatus();
}

async function loadConfigurationFile() {
  const [file] = configFileInput.files;
  if (!file) return;
  try {
    const configuration = JSON.parse(await file.text());
    if (!isValidConfigurationDocument(configuration)) {
      throw new Error('Unsupported configuration schema. Expected format "relationship-config-v1".');
    }
    loadedConfiguration = configuration;
    configDirty = false;
    applyConfigurationToWorkspace();
    updateConfigurationStatus();
    updateWorkspaceSummary();
  } catch (error) {
    alert(`Could not load configuration: ${error.message}`);
  } finally {
    configFileInput.value = '';
  }
}

function saveConfigurationFile(fileName) {
  const [leftViewer, rightViewer] = csvViewers;
  const associatedChangesFile = loadedChangesFileName || getWorkspaceFileName('changes');
  loadedChangesFileName = associatedChangesFile;
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
      showChanges: showChanges.checked,
      showHardLinks: showHardLinks.checked,
    },
    files: {
      leftFile: leftViewer.fileName || '',
      rightFile: rightViewer.fileName || '',
      changesFile: associatedChangesFile,
    },
    hotkeys: {
      addLink: hotkeyAddLink.value,
      addLinkedRecord: hotkeyAddLinkedRecord.value,
      deleteRecord: hotkeyDeleteRecord.value,
      editRecord: hotkeyEditRecord.value,
      toggleChanges: hotkeyToggleChanges.value,
      toggleHard: hotkeyToggleHard.value,
      toggleSettings: hotkeyToggleSettings.value,
      undo: hotkeyUndo.value,
      redo: hotkeyRedo.value,
      clearSelection: hotkeyClearSelection.value,
      menuVisible: !hotkeyMenu.hidden,
    },
  };
  loadedConfiguration = configuration;
  downloadTextFile(fileName, JSON.stringify(configuration, null, 2));
  updateConfigurationStatus();
  configDirty = false;
  updateWorkspaceSummary();
}

function getWorkspaceFileName(extension) {
  const [leftViewer, rightViewer] = csvViewers;
  const leftName = getFileNameWithExtension(leftViewer?.fileName || 'left', '');
  const rightName = getFileNameWithExtension(rightViewer?.fileName || 'right', '');
  return `${leftName}--${rightName}.${extension}`;
}

function isValidChangesDocument(changes) {
  return changes?.format === 'changes-v1'
    && Array.isArray(changes.manualLinks)
    && (!changes.recordChanges || Array.isArray(changes.recordChanges))
    && (!changes.addedRecords || Array.isArray(changes.addedRecords))
    && (!changes.deletedRecords || Array.isArray(changes.deletedRecords));
}

function isValidConfigurationDocument(configuration) {
  return configuration?.format === 'relationship-config-v1'
    && (!configuration.files || typeof configuration.files === 'object')
    && (!configuration.viewers || typeof configuration.viewers === 'object')
    && (!configuration.relationship || typeof configuration.relationship === 'object')
    && (!configuration.hotkeys || typeof configuration.hotkeys === 'object');
}

function updateInMemoryFileConfiguration(changesFileName) {
  const [leftViewer, rightViewer] = csvViewers;
  if (!loadedConfiguration) loadedConfiguration = { format: 'relationship-config-v1' };
  loadedConfiguration.files = {
    leftFile: leftViewer.fileName || '',
    rightFile: rightViewer.fileName || '',
    changesFile: changesFileName,
  };
}

function getViewerConfiguration(viewer) {
  return {
    displayFields: [...viewer.fieldList.querySelectorAll('input:checked')].map(input => viewer.headers[Number(input.value)]),
    filterField: viewer.headers[Number(viewer.filterField.value)] ?? '',
    filterValue: viewer.filterValue.value,
    sortField: viewer.headers[Number(viewer.sortField.value)] ?? '',
    sortDirection: viewer.sortDirection.value,
    exportFormat: viewer.exportFormat.value,
    exportContent: viewer.exportContent.value,
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

function updateConfigurationStatus() {
  const configuredFiles = loadedConfiguration?.files;
  if (!loadedConfiguration) {
    configurationStatus.classList.remove('error');
    configurationMessage.textContent = 'No configuration loaded.';
    return;
  }
  if (!configuredFiles) {
    configurationStatus.classList.remove('error');
    configurationMessage.textContent = 'Configuration loaded; no default files were recorded.';
    return;
  }
  const [leftViewer, rightViewer] = csvViewers;
  const missing = [];
  if (configuredFiles.leftFile && leftViewer?.fileName !== configuredFiles.leftFile) {
    missing.push(`Configuration expecting left file “${configuredFiles.leftFile}”.`);
  }
  if (configuredFiles.rightFile && rightViewer?.fileName !== configuredFiles.rightFile) {
    missing.push(`Configuration expecting right file “${configuredFiles.rightFile}”.`);
  }
  if (configuredFiles.changesFile && loadedChangesFileName !== configuredFiles.changesFile) {
    missing.push(`Configuration expecting changes file “${configuredFiles.changesFile}”.`);
  }
  configurationStatus.classList.toggle('error', missing.length > 0);
  configurationMessage.textContent = missing.length
    ? missing.join(' ')
    : 'Configured files loaded successfully.';
}

function markChangesDirty() {
  changesDirty = true;
  updateWorkspaceSummary();
  updateChangesPanel();
}

function markConfigDirty() {
  configDirty = true;
  updateWorkspaceSummary();
}

function updateWorkspaceSummary() {
  const states = [];
  if (loadedConfiguration) states.push('config loaded');
  if (changesDirty) states.push('unsaved changes');
  if (configDirty) states.push('unsaved config');
  const orphanCount = getOrphanRecords('left').length + getOrphanRecords('right').length;
  if (orphanCount) states.push(`${orphanCount} unresolved record${orphanCount === 1 ? '' : 's'}`);
  workspaceSummary.textContent = states.length ? states.join(' · ') : 'New workspace';
}

function captureChangeState() {
  return structuredClone({ manualLinks, recordChanges, addedRecords, deletedRecords });
}

function rememberChangeState() {
  undoStack.push(captureChangeState());
  if (undoStack.length > 50) undoStack.shift();
  redoStack = [];
}

function restoreChangeState(state) {
  ({ manualLinks, recordChanges, addedRecords, deletedRecords } = structuredClone(state));
  changesDirty = true;
  refreshRelationshipDisplay();
  updateWorkspaceSummary();
  updateChangesPanel();
}

function undoChange() {
  if (!undoStack.length) return;
  redoStack.push(captureChangeState());
  restoreChangeState(undoStack.pop());
}

function redoChange() {
  if (!redoStack.length) return;
  undoStack.push(captureChangeState());
  restoreChangeState(redoStack.pop());
}

function updateChangesPanel() {
  undoChangeButton.disabled = !undoStack.length;
  redoChangeButton.disabled = !redoStack.length;
  backupReminder.classList.toggle('unsaved', changesDirty);
  backupReminder.textContent = changesDirty
    ? 'Unsaved changes — use Save changes to download a backup sidecar.'
    : 'No unsaved changes.';
  renderChangeLog();
  renderUnresolvedChanges();
}

function renderChangeLog() {
  changeLog.replaceChildren();
  const entries = [[addedRecords.length, 'new record'], [recordChanges.length, 'field edit'], [manualLinks.length, 'new linkage'], [deletedRecords.length, 'record marked for deletion']];
  entries.filter(([count]) => count).forEach(([count, label]) => {
    const entry = document.createElement('div');
    entry.className = 'change-entry';
    entry.textContent = `${count} ${label}${count === 1 ? '' : 's'}`;
    changeLog.append(entry);
  });
  if (!changeLog.children.length) changeLog.innerHTML = '<div class="change-entry">No recorded changes.</div>';
}

function getUnresolvedChanges() {
  const issues = [];
  ['left', 'right'].forEach(side => {
    const viewer = csvViewers.find(candidate => candidate.side === side);
    const sourceRecords = new Set((viewer?.dataRows ?? []).map(getRecordKey));
    recordChanges.filter(change => change.side === side && !sourceRecords.has(getRecordKey(change.record))).forEach(change => issues.push({ type: 'edit', side, record: change.record, label: `Field edit references a missing ${side} record.` }));
  });
  manualLinks.forEach(link => {
    const leftExists = csvViewers[0]?.dataRows.some(row => getRecordKey(row) === getRecordKey(link.leftRow)) || getAddedRecords('left').some(row => getRecordKey(row) === getRecordKey(link.leftRow));
    const rightExists = csvViewers[1]?.dataRows.some(row => getRecordKey(row) === getRecordKey(link.rightRow)) || getAddedRecords('right').some(row => getRecordKey(row) === getRecordKey(link.rightRow));
    if (!leftExists || !rightExists) issues.push({ type: 'link', id: link.id, record: !leftExists ? link.leftRow : link.rightRow, side: !leftExists ? 'left' : 'right', label: 'Linkage references a missing record.' });
  });
  return issues;
}

function renderUnresolvedChanges() {
  unresolvedChanges.replaceChildren();
  const issues = getUnresolvedChanges();
  issues.forEach(issue => {
    const entry = document.createElement('div');
    entry.className = 'unresolved-entry';
    entry.append(document.createTextNode(issue.label));
    const actions = document.createElement('div');
    const inspect = document.createElement('button');
    inspect.textContent = 'Inspect';
    inspect.addEventListener('click', () => inspectUnresolvedChange(issue));
    const dismiss = document.createElement('button');
    dismiss.textContent = 'Dismiss';
    dismiss.addEventListener('click', () => dismissUnresolvedChange(issue));
    actions.append(inspect, dismiss);
    entry.append(actions);
    unresolvedChanges.append(entry);
  });
  if (!issues.length) unresolvedChanges.innerHTML = '<div class="change-entry">No unresolved changes.</div>';
}

function inspectUnresolvedChange(issue) {
  const viewer = csvViewers.find(candidate => candidate.side === issue.side);
  const card = [...(viewer?.cardList.querySelectorAll('.row-card') ?? [])].find(item => getRecordKey(item.recordValues) === getRecordKey(issue.record));
  card?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  card?.classList.add('relationship-selected');
}

function dismissUnresolvedChange(issue) {
  rememberChangeState();
  if (issue.type === 'edit') recordChanges = recordChanges.filter(change => !(change.side === issue.side && getRecordKey(change.record) === getRecordKey(issue.record)));
  if (issue.type === 'link') manualLinks = manualLinks.filter(link => link.id !== issue.id);
  markChangesDirty();
  refreshRelationshipDisplay();
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
  viewer.exportContent.value = configuration.exportContent === 'source' ? 'source' : 'integrated';
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
  showChanges.checked = configuration.showChanges !== false;
  showHardLinks.checked = configuration.showHardLinks !== false;
}

function applyHotkeyConfiguration() {
  const hotkeys = loadedConfiguration?.hotkeys;
  if (!hotkeys) return;
  if (typeof hotkeys.addLink === 'string' && hotkeys.addLink) hotkeyAddLink.value = hotkeys.addLink;
  if (typeof hotkeys.addLinkedRecord === 'string' && hotkeys.addLinkedRecord) hotkeyAddLinkedRecord.value = hotkeys.addLinkedRecord;
  if (typeof hotkeys.deleteRecord === 'string' && hotkeys.deleteRecord) hotkeyDeleteRecord.value = hotkeys.deleteRecord;
  if (typeof hotkeys.editRecord === 'string' && hotkeys.editRecord) hotkeyEditRecord.value = hotkeys.editRecord;
  if (typeof hotkeys.toggleChanges === 'string' && hotkeys.toggleChanges) hotkeyToggleChanges.value = hotkeys.toggleChanges;
  if (typeof hotkeys.toggleHard === 'string' && hotkeys.toggleHard) hotkeyToggleHard.value = hotkeys.toggleHard;
  if (typeof hotkeys.toggleSettings === 'string' && hotkeys.toggleSettings) hotkeyToggleSettings.value = hotkeys.toggleSettings;
  if (typeof hotkeys.undo === 'string' && hotkeys.undo) hotkeyUndo.value = hotkeys.undo;
  if (typeof hotkeys.redo === 'string' && hotkeys.redo) hotkeyRedo.value = hotkeys.redo;
  if (typeof hotkeys.clearSelection === 'string' && hotkeys.clearSelection) hotkeyClearSelection.value = hotkeys.clearSelection;
  if (typeof hotkeys.menuVisible === 'boolean') setHotkeyMenuVisibility(hotkeys.menuVisible);
}

function setHotkeyMenuVisibility(visible) {
  hotkeyMenu.hidden = !visible;
  showHotkeysButton.hidden = visible;
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
    markConfigDirty();
    input.blur();
  });
}

function handleHotkeys(event) {
  if (event.target.matches('input, select, textarea, button')) return;
  if (formatHotkey(event) === hotkeyUndo.value) {
    event.preventDefault();
    undoChange();
    return;
  }
  if (formatHotkey(event) === hotkeyRedo.value) {
    event.preventDefault();
    redoChange();
    return;
  }
  if (formatHotkey(event) === hotkeyAddLink.value) {
    event.preventDefault();
    addManualLink();
  }
  if (formatHotkey(event) === hotkeyAddLinkedRecord.value) {
    event.preventDefault();
    addLinkedRecord();
  }
  if (formatHotkey(event) === hotkeyDeleteRecord.value) {
    event.preventDefault();
    deleteSelectedItem();
  }
  if (formatHotkey(event) === hotkeyEditRecord.value) {
    event.preventDefault();
    editSelectedRecord();
  }
  if (formatHotkey(event) === hotkeyToggleChanges.value) {
    event.preventDefault();
    showChanges.checked = !showChanges.checked;
    refreshRelationshipDisplay();
  }
  if (formatHotkey(event) === hotkeyToggleHard.value) {
    event.preventDefault();
    showHardLinks.checked = !showHardLinks.checked;
    refreshRelationshipDisplay();
  }
  if (formatHotkey(event) === hotkeyToggleSettings.value) {
    event.preventDefault();
    settingsDrawer.hidden = !settingsDrawer.hidden;
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

  groupCardsForLinkageLayout();
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

  if (showHardLinks.checked) {
    leftViewer.cardList.querySelectorAll('.row-card[data-relationship-key]').forEach(leftCard => {
      const key = leftCard.dataset.relationshipKey;
      if (!key) return;
      const rightCards = rightCardsByKey.get(key) ?? [];
      rightCards.forEach(rightCard => addRelationshipLine(leftCard, rightCard, key, canvas, 'hard'));
    });
  }

  const leftCardsByRecord = getCardsByRecord(leftViewer.cardList);
  const rightCardsByRecord = getCardsByRecord(rightViewer.cardList);
  if (showChanges.checked) {
    manualLinks.forEach(link => {
      const leftCards = leftCardsByRecord.get(getRecordKey(link.leftRow)) ?? [];
      const rightCards = rightCardsByRecord.get(getRecordKey(link.rightRow)) ?? [];
      leftCards.forEach(leftCard => rightCards.forEach(rightCard => {
        addRelationshipLine(leftCard, rightCard, link.id, canvas, leftCard.isGhost || rightCard.isGhost ? 'ghost' : 'manual');
      }));
    });
  }
}

function groupCardsForLinkageLayout() {
  if (linkageLayout.value === 'none') return;
  const [leftViewer, rightViewer] = csvViewers;
  const anchorViewer = linkageLayout.value === 'anchor-a' ? leftViewer : rightViewer;
  const groupedViewer = anchorViewer === leftViewer ? rightViewer : leftViewer;
  const anchorCards = [...anchorViewer.cardList.querySelectorAll('.row-card')];
  const groupedCards = [...groupedViewer.cardList.querySelectorAll('.row-card')];
  const correctlyOrderedCards = [];
  const unmatchedCards = [...groupedCards];
  anchorCards.forEach(anchorCard => {
    const matches = [];
    for (let index = unmatchedCards.length - 1; index >= 0; index -= 1) {
      if (rowsAreLinked(anchorCard.recordValues, anchorViewer.side, unmatchedCards[index].recordValues, groupedViewer.side)) {
        matches.unshift(unmatchedCards[index]);
        unmatchedCards.splice(index, 1);
      }
    }
    correctlyOrderedCards.push(...matches);
  });
  correctlyOrderedCards.push(...unmatchedCards);
  correctlyOrderedCards.forEach(card => groupedViewer.cardList.append(card));
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

function groupRowsForAnchor(rows, dependentViewer, anchorViewer) {
  const remainingRows = [...rows];
  const orderedRows = [];
  anchorViewer.getBaseRows().forEach(anchorRow => {
    const matches = [];
    for (let index = remainingRows.length - 1; index >= 0; index -= 1) {
      if (rowsAreLinked(anchorRow, anchorViewer.side, remainingRows[index], dependentViewer.side)) {
        matches.unshift(remainingRows[index]);
        remainingRows.splice(index, 1);
      }
    }
    orderedRows.push(...matches);
  });
  return [...orderedRows, ...remainingRows];
}

function rowsAreLinked(firstRow, firstSide, secondRow, secondSide) {
  const leftRow = firstSide === 'left' ? firstRow : secondRow;
  const rightRow = firstSide === 'right' ? firstRow : secondRow;
  const leftValue = normalizeRelationshipValue(leftRow[Number(leftMatchField.value)]);
  const rightValue = normalizeRelationshipValue(rightRow[Number(rightMatchField.value)]);
  const hardLink = showHardLinks.checked && leftValue && leftValue === rightValue;
  const manualLink = showChanges.checked && manualLinks.some(link =>
    getRecordKey(link.leftRow) === getRecordKey(leftRow)
    && getRecordKey(link.rightRow) === getRecordKey(rightRow));
  return hardLink || manualLink;
}

function alignLinkageGroups() {
  const [leftViewer, rightViewer] = csvViewers;
  leftViewer.cardList.querySelectorAll('.row-card').forEach(card => { card.style.marginTop = ''; });
  rightViewer.cardList.querySelectorAll('.row-card').forEach(card => { card.style.marginTop = ''; });
  if (linkageLayout.value === 'none') return;

  const anchorViewer = linkageLayout.value === 'anchor-a' ? leftViewer : rightViewer;
  const groupedViewer = anchorViewer === leftViewer ? rightViewer : leftViewer;
  const groupedCards = [...groupedViewer.cardList.querySelectorAll('.row-card')];
  const alignedGroupedCards = new Set();
  anchorViewer.cardList.querySelectorAll('.row-card').forEach(anchorCard => {
    const groupedCard = groupedCards.find(card => !alignedGroupedCards.has(card)
      && rowsAreLinked(anchorCard.recordValues, anchorViewer.side, card.recordValues, groupedViewer.side));
    if (!groupedCard) return;
    alignedGroupedCards.add(groupedCard);
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
  line.classList.add('relationship-line', type === 'ghost' ? 'ghost-link' : type === 'manual' ? 'manual-link' : 'hard-link');
  line.dataset.relationshipKey = type === 'manual' || type === 'ghost' ? `manual-${key}` : key;
  if (type === 'manual' || type === 'ghost') line.dataset.manualLinkId = key;
  line.setAttribute('d', `M ${startX} ${startY} C ${startX + bend} ${startY}, ${endX - bend} ${endY}, ${endX} ${endY}`);
  line.addEventListener('mouseenter', () => {
    if (type === 'manual' || type === 'ghost') highlightManualLink(leftCard, rightCard, line);
    else highlightRelationship(line.dataset.relationshipKey);
  });
  line.addEventListener('mouseleave', clearRelationshipHighlight);
  if (type === 'manual' || type === 'ghost') line.addEventListener('click', event => {
    event.stopPropagation();
    selectManualLink(key);
  });
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

function highlightCardConnections(card, side) {
  const oppositeSide = side === 'left' ? 'right' : 'left';
  const linkedCards = new Set([card]);
  const manualLinkIds = new Set();
  manualLinks.forEach(link => {
    const row = side === 'left' ? link.leftRow : link.rightRow;
    if (showChanges.checked && getRecordKey(row) === getRecordKey(card.recordValues)) manualLinkIds.add(link.id);
  });

  document.querySelectorAll(`.row-card[data-side="${oppositeSide}"]`).forEach(candidate => {
    const hardLinked = showHardLinks.checked
      && card.dataset.relationshipKey
      && card.dataset.relationshipKey === candidate.dataset.relationshipKey;
    const manualLinked = showChanges.checked && manualLinkIds.size && manualLinks.some(link => {
      const oppositeRow = side === 'left' ? link.rightRow : link.leftRow;
      return manualLinkIds.has(link.id) && getRecordKey(oppositeRow) === getRecordKey(candidate.recordValues);
    });
    if (hardLinked || manualLinked) linkedCards.add(candidate);
  });

  document.querySelectorAll('.row-card[data-side]').forEach(candidate => {
    candidate.classList.toggle('relationship-active', linkedCards.has(candidate));
    candidate.classList.toggle('relationship-muted', !linkedCards.has(candidate));
  });
  document.querySelectorAll('.relationship-line').forEach(line => {
    const hardLinked = showHardLinks.checked && card.dataset.relationshipKey && line.dataset.relationshipKey === card.dataset.relationshipKey;
    const manualLinked = showChanges.checked && manualLinkIds.has(line.dataset.manualLinkId);
    line.classList.toggle('relationship-active', hardLinked || manualLinked);
    line.classList.toggle('relationship-muted', !(hardLinked || manualLinked));
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
  const baseName = getFileStem(filePath);
  return extension ? `${baseName}.${extension}` : baseName;
}

function getFileStem(filePath) {
  const fileName = getCrossPlatformFileName(filePath);
  return fileName.replace(/\.[^.]*$/, '') || 'untitled';
}

function buildIntegratedRows(viewer) {
  const [leftViewer, rightViewer] = csvViewers;
  const isLeft = viewer === leftViewer;
  const ownField = isLeft ? Number(leftMatchField.value) : Number(rightMatchField.value);
  const oppositeField = isLeft ? Number(rightMatchField.value) : Number(leftMatchField.value);
  const ownEntries = getIntegratedEntries(viewer);
  const oppositeEntries = getIntegratedEntries(isLeft ? rightViewer : leftViewer);

  return ownEntries.map(entry => {
    const row = entry.values.slice();
    if (!oppositeEntries.length || !Number.isFinite(ownField) || !Number.isFinite(oppositeField)) return row;
    const linkedEntries = getIntegratedLinkedEntries(entry, viewer.side, oppositeEntries, isLeft ? 'right' : 'left');
    if (linkedEntries.length) row[ownField] = formatLinkageValue(linkedEntries.map(linked => linked.values[oppositeField] ?? ''));
    return row;
  });
}

function getIntegratedEntries(viewer) {
  if (!viewer?.headers.length) return [];
  const sourceRows = [...viewer.dataRows, ...getAddedRecords(viewer.side)];
  return sourceRows
    .filter(row => !deletedRecords.some(record => record.side === viewer.side && getRecordKey(record.record) === getRecordKey(row)))
    .map(row => ({ source: row, values: getIntegratedDisplayRow(viewer.side, row) }));
}

function getIntegratedDisplayRow(side, row) {
  const change = getRecordChange(side, row);
  if (!change) return row.slice();
  return row.map((value, index) => Object.hasOwn(change.fields, index) ? change.fields[index] : value);
}

function getIntegratedLinkedEntries(entry, side, oppositeEntries, oppositeSide) {
  const [leftViewer, rightViewer] = csvViewers;
  const ownField = side === 'left' ? Number(leftMatchField.value) : Number(rightMatchField.value);
  const oppositeField = oppositeSide === 'left' ? Number(leftMatchField.value) : Number(rightMatchField.value);
  const ownValue = normalizeRelationshipValue(entry.values[ownField]);
  const linked = new Map();
  oppositeEntries.forEach(candidate => {
    const oppositeValue = normalizeRelationshipValue(candidate.values[oppositeField]);
    const hardLinked = ownValue && ownValue === oppositeValue;
    const leftRow = side === 'left' ? entry.source : candidate.source;
    const rightRow = side === 'right' ? entry.source : candidate.source;
    const manualLinked = manualLinks.some(link => getRecordKey(link.leftRow) === getRecordKey(leftRow)
      && getRecordKey(link.rightRow) === getRecordKey(rightRow));
    if (hardLinked || manualLinked) linked.set(getRecordKey(candidate.source), candidate);
  });
  return [...linked.values()];
}

function formatLinkageValue(values) {
  if (values.length === 1) return values[0];
  return `[${values.map(value => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`).join(', ')}]`;
}

function serializeCsv(headers, rows, delimiter = ',') {
  const encodeCell = value => {
    const text = String(value ?? '');
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers, ...rows].map(row => row.map(encodeCell).join(delimiter)).join('\r\n');
}

function getImportedFile(fileName, contents) {
  if (!/\.json$/i.test(fileName)) return { csv: contents };
  let json;
  try {
    json = JSON.parse(contents);
  } catch {
    throw new Error('The JSON file is not valid JSON.');
  }
  if (json?.format !== 'csv-json-lossless-v1') {
    throw new Error('JSON imports must use the csv-json-lossless-v1 format exported by this app.');
  }
  if (typeof json.csv === 'string') return { csv: json.csv };

  const records = Array.isArray(json.data) ? json.data : json.data && typeof json.data === 'object' ? [json.data] : [];
  const headers = Array.isArray(json.headers) ? json.headers : Object.keys(records[0] ?? {});
  if (!headers.length || !records.length) {
    throw new Error('The JSON file needs a headers array and at least one data record.');
  }
  const rows = [headers, ...records.map(record => headers.map(header => String(record?.[header] ?? '')))];
  return { csv: serializeCsv(headers, rows.slice(1), json.delimiter || ','), rows };
}

function getImportedDelimiter(fileName, contents, csv) {
  if (/\.json$/i.test(fileName)) {
    try {
      const delimiter = JSON.parse(contents)?.delimiter;
      if ([',', ';', '\t', '|'].includes(delimiter)) return delimiter;
    } catch {
      // Fall back to detection for older lossless JSON files.
    }
  }
  return detectDelimiter(csv);
}

function resolveImportDelimiter(choice, customDelimiter, fileName, contents, csv) {
  if (choice === 'auto') return getImportedDelimiter(fileName, contents, csv);
  if (choice === 'tab') return '\t';
  if (choice === 'custom') {
    if (!customDelimiter) throw new Error('Enter a custom delimiter character before importing.');
    return customDelimiter;
  }
  return choice;
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
function detectDelimiter(input) {
  const candidates = [',', ';', '\t', '|'];
  const counts = new Map(candidates.map(candidate => [candidate, 0]));
  let quoted = false;
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (char === '"') {
      if (quoted && input[index + 1] === '"') index += 1;
      else quoted = !quoted;
    } else if (!quoted && counts.has(char)) {
      counts.set(char, counts.get(char) + 1);
    } else if (!quoted && (char === '\n' || char === '\r')) {
      break;
    }
  }
  return candidates.reduce((best, candidate) => counts.get(candidate) > counts.get(best) ? candidate : best, ',');
}

function parseCsv(input, delimiter = ',') {
  const rows = [[]];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    if (char === '"') {
      if (quoted && input[i + 1] === '"') { cell += '"'; i += 1; }
      else quoted = !quoted;
    } else if (char === delimiter && !quoted) {
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
