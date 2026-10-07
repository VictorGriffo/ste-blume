const firebaseConfig = window.STEBLUME.firebaseConfig;
const SCHEDULE = window.STEBLUME.SCHEDULE;

const panelSection = document.getElementById('admin-panel');
const checkingEl = document.getElementById('admin-checking');
const logoutBtn = document.getElementById('admin-logout');

const calWrap = document.getElementById('a-cal');
const timesWrap = document.getElementById('a-times');
const selectedLabel = document.getElementById('a-selected-label');
const allBtn = document.getElementById('a-all');
const noneBtn = document.getElementById('a-none');
const saveBtn = document.getElementById('a-save');
const statusEl = document.getElementById('a-status');
const listEl = document.getElementById('a-list');
const emptyEl = document.getElementById('a-empty');

const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const WEEKDAY_LETTER = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

const allTimes = window.STEBLUME.buildTimeList();

const today = new Date();
today.setHours(0, 0, 0, 0);
const maxDate = new Date(today);
maxDate.setDate(maxDate.getDate() + SCHEDULE.daysAhead - 1);

let auth, db, fsAuth, fsFire;
let released = {};
const selectedDates = new Set();
const selectedTimes = new Set();
let viewYear = today.getFullYear();
let viewMonth = today.getMonth();

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function toDateStr(d) {
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function parseDate(dateStr) {
  return new Date(dateStr + 'T00:00:00');
}

function shortLabel(dateStr) {
  const d = parseDate(dateStr);
  return WEEKDAY_SHORT[d.getDay()] + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
}

function setStatus(text, kind) {
  statusEl.textContent = text;
  statusEl.className = 'form-status' + (kind ? ' form-' + kind : '');
}

// ---------- Banco de dados ----------

async function loadReleased() {
  const q = fsFire.query(fsFire.collection(db, 'availability'), fsFire.where('date', '>=', toDateStr(today)));
  const snap = await fsFire.getDocs(q);
  const map = {};
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.date && Array.isArray(data.times) && data.times.length) map[data.date] = data.times.slice().sort();
  });
  released = map;
}

// Sem nenhum horário marcado, o dia deixa de existir (fica fechado para as clientes).
async function saveDays(dates, times) {
  const batch = fsFire.writeBatch(db);
  dates.forEach((date) => {
    const ref = fsFire.doc(db, 'availability', date);
    if (times.length) {
      batch.set(ref, { date: date, times: times, updatedAt: fsFire.serverTimestamp() });
    } else {
      batch.delete(ref);
    }
  });
  await batch.commit();
}

// Antes, a agenda era "tudo aberto" e a Steffany bloqueava horários. Agora nada abre sem ela liberar,
// então bloqueios antigos só atrapalhariam (um horário bloqueado apareceria como ocupado).
async function clearLegacyBlocks() {
  try {
    const q = fsFire.query(fsFire.collection(db, 'slots'), fsFire.where('blocked', '==', true));
    const snap = await fsFire.getDocs(q);
    if (snap.empty) return;
    const batch = fsFire.writeBatch(db);
    snap.forEach((docSnap) => batch.delete(docSnap.ref));
    await batch.commit();
  } catch (e) {
    // sem permissão ou sem bloqueios: segue sem limpar
  }
}

// ---------- Calendário ----------

function renderCalendar() {
  const firstOfMonth = new Date(viewYear, viewMonth, 1);
  const startWeekday = firstOfMonth.getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const canGoPrev = firstOfMonth > new Date(today.getFullYear(), today.getMonth(), 1);
  const canGoNext = new Date(viewYear, viewMonth + 1, 1) <= maxDate;

  let html = '<div class="cal-header">'
    + '<button type="button" class="cal-nav" data-dir="-1"' + (canGoPrev ? '' : ' disabled') + ' aria-label="Mês anterior">‹</button>'
    + '<span class="cal-month-label">' + MONTH_NAMES[viewMonth] + ' ' + viewYear + '</span>'
    + '<button type="button" class="cal-nav" data-dir="1"' + (canGoNext ? '' : ' disabled') + ' aria-label="Próximo mês">›</button>'
    + '</div><div class="cal-weekdays">';
  WEEKDAY_LETTER.forEach((w) => { html += '<span>' + w + '</span>'; });
  html += '</div><div class="cal-grid">';
  for (let i = 0; i < startWeekday; i++) html += '<span class="cal-empty"></span>';
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(viewYear, viewMonth, day);
    const dateStr = toDateStr(d);
    const inRange = d >= today && d <= maxDate;
    const isSelected = selectedDates.has(dateStr);
    const isReleased = !!released[dateStr];
    html += '<button type="button" class="cal-day' + (isSelected ? ' selected' : '') + (isReleased ? ' released' : '')
      + '" data-date="' + dateStr + '" aria-pressed="' + isSelected + '"'
      + (isReleased ? ' title="Já tem horários liberados"' : '')
      + (inRange ? '' : ' disabled') + '>' + day + '</button>';
  }
  html += '</div><p class="avail-legend"><span class="avail-dot"></span> dia com horários liberados</p>';
  calWrap.innerHTML = html;

  calWrap.querySelectorAll('.cal-nav:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => {
      viewMonth += parseInt(btn.dataset.dir, 10);
      if (viewMonth < 0) { viewMonth = 11; viewYear--; }
      if (viewMonth > 11) { viewMonth = 0; viewYear++; }
      renderCalendar();
    });
  });

  calWrap.querySelectorAll('.cal-day:not([disabled])').forEach((btn) => {
    btn.addEventListener('click', () => toggleDate(btn.dataset.date));
  });
}

function toggleDate(dateStr) {
  if (selectedDates.has(dateStr)) selectedDates.delete(dateStr);
  else selectedDates.add(dateStr);

  // Com um único dia, mostra os horários que ele já tem. Com vários, mantém os marcados
  // e aplica a todos eles ao salvar.
  if (selectedDates.size === 1) {
    const only = Array.from(selectedDates)[0];
    selectedTimes.clear();
    (released[only] || []).forEach((t) => selectedTimes.add(t));
  } else if (selectedDates.size === 0) {
    selectedTimes.clear();
  }
  setStatus('');
  refresh();
}

// ---------- Horários ----------

function renderTimes() {
  timesWrap.innerHTML = '';
  const enabled = selectedDates.size > 0;
  allTimes.forEach((time) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'slot-btn' + (selectedTimes.has(time) ? ' selected' : '');
    btn.textContent = time;
    btn.disabled = !enabled;
    btn.setAttribute('aria-pressed', selectedTimes.has(time) ? 'true' : 'false');
    btn.addEventListener('click', () => {
      if (selectedTimes.has(time)) selectedTimes.delete(time);
      else selectedTimes.add(time);
      setStatus('');
      renderTimes();
    });
    timesWrap.appendChild(btn);
  });
}

function updateLabel() {
  const dates = Array.from(selectedDates).sort();
  if (dates.length === 0) selectedLabel.textContent = 'Nenhum dia selecionado';
  else if (dates.length === 1) selectedLabel.textContent = shortLabel(dates[0]);
  else selectedLabel.textContent = dates.length + ' dias selecionados: os horários marcados valem para todos';
  saveBtn.disabled = dates.length === 0;
  allBtn.disabled = noneBtn.disabled = dates.length === 0;
}

function refresh() {
  renderCalendar();
  renderTimes();
  updateLabel();
}

allBtn.addEventListener('click', () => {
  allTimes.forEach((t) => selectedTimes.add(t));
  renderTimes();
});

noneBtn.addEventListener('click', () => {
  selectedTimes.clear();
  renderTimes();
});

saveBtn.addEventListener('click', async () => {
  const dates = Array.from(selectedDates).sort();
  const times = Array.from(selectedTimes).sort();
  if (dates.length === 0) return;

  saveBtn.disabled = true;
  const originalLabel = saveBtn.textContent;
  saveBtn.textContent = 'Salvando...';
  setStatus('');
  try {
    await saveDays(dates, times);
    await loadReleased();
    selectedDates.clear();
    selectedTimes.clear();
    refresh();
    renderList();
    if (times.length) {
      setStatus('Pronto! ' + (dates.length === 1 ? 'Dia liberado' : dates.length + ' dias liberados') + ' com ' + times.length + (times.length === 1 ? ' horário.' : ' horários.'), 'success');
    } else {
      setStatus('Nenhum horário marcado: ' + (dates.length === 1 ? 'o dia ficou fechado' : 'os dias ficaram fechados') + ' para as clientes.', 'success');
    }
  } catch (err) {
    setStatus('Não foi possível salvar: ' + (err && err.message ? err.message : String(err)), 'error');
  } finally {
    saveBtn.textContent = originalLabel;
    updateLabel();
  }
});

// ---------- Lista de dias liberados ----------

function buildRow(dateStr) {
  const d = parseDate(dateStr);
  const times = released[dateStr];

  const row = document.createElement('div');
  row.className = 'admin-row';

  const badge = document.createElement('div');
  badge.className = 'admin-time-badge';
  badge.textContent = pad(d.getDate()) + '/' + pad(d.getMonth() + 1);

  const info = document.createElement('div');
  info.className = 'admin-row-info';
  const title = document.createElement('strong');
  title.textContent = WEEKDAY_SHORT[d.getDay()];
  const detail = document.createElement('span');
  detail.textContent = times.join(' · ');
  info.appendChild(title);
  info.appendChild(detail);

  const actions = document.createElement('div');
  actions.className = 'admin-row-actions';

  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'btn-ghost btn';
  editBtn.textContent = 'Editar';
  editBtn.addEventListener('click', () => {
    selectedDates.clear();
    selectedDates.add(dateStr);
    selectedTimes.clear();
    times.forEach((t) => selectedTimes.add(t));
    viewYear = d.getFullYear();
    viewMonth = d.getMonth();
    setStatus('');
    refresh();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-ghost btn';
  closeBtn.textContent = 'Fechar dia';

  const rowError = document.createElement('p');
  rowError.className = 'admin-row-error';

  let confirming = false;
  let resetTimer = null;
  closeBtn.addEventListener('click', async () => {
    if (!confirming) {
      confirming = true;
      closeBtn.textContent = 'Confirmar?';
      closeBtn.classList.add('confirming');
      resetTimer = setTimeout(() => {
        confirming = false;
        closeBtn.textContent = 'Fechar dia';
        closeBtn.classList.remove('confirming');
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    closeBtn.disabled = true;
    closeBtn.textContent = '...';
    rowError.textContent = '';
    try {
      await saveDays([dateStr], []);
      await loadReleased();
      selectedDates.delete(dateStr);
      refresh();
      renderList();
    } catch (err) {
      rowError.textContent = 'Não foi possível fechar: ' + (err && err.message ? err.message : String(err));
      closeBtn.disabled = false;
      closeBtn.textContent = 'Fechar dia';
      closeBtn.classList.remove('confirming');
      confirming = false;
    }
  });

  actions.appendChild(editBtn);
  actions.appendChild(closeBtn);
  actions.appendChild(rowError);

  row.appendChild(badge);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

function renderList() {
  listEl.innerHTML = '';
  const dates = Object.keys(released).sort();
  emptyEl.hidden = dates.length > 0;
  dates.forEach((dateStr) => listEl.appendChild(buildRow(dateStr)));
}

// ---------- Acesso ----------

async function initFirebase() {
  const [appModule, authModule, firestoreModule] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
  ]);
  fsAuth = authModule;
  fsFire = firestoreModule;
  const app = appModule.initializeApp(firebaseConfig);
  auth = fsAuth.getAuth(app);
  db = fsFire.getFirestore(app);
}

async function start() {
  panelSection.hidden = false;
  checkingEl.hidden = true;
  refresh();
  try {
    await clearLegacyBlocks();
    await loadReleased();
    renderList();
    refresh();
  } catch (err) {
    setStatus('Não foi possível carregar os dias liberados: ' + (err && err.message ? err.message : String(err)), 'error');
  }
}

async function checkAuth() {
  await initFirebase();
  fsAuth.onAuthStateChanged(auth, (user) => {
    if (user) start();
    else window.location.href = 'admin.html';
  });
}

logoutBtn.addEventListener('click', () => {
  fsAuth.signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
});

checkAuth();
