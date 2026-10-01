const firebaseConfig = window.STEBLUME.firebaseConfig;

const panelSection = document.getElementById('admin-panel');
const checkingEl = document.getElementById('admin-checking');
const logoutBtn = document.getElementById('admin-logout');
const bookingsList = document.getElementById('admin-bookings');
const emptyMsg = document.getElementById('admin-empty');
const summaryEl = document.getElementById('admin-summary');

const WEEKDAY_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

let auth, db, fsAuth, fsFire;

function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
}

function formatDate(dateStr) {
  const parts = dateStr.split('-');
  return parts[2] + '/' + parts[1] + '/' + parts[0];
}

function weekdayName(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return WEEKDAY_FULL[d.getDay()];
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str || '';
  return div.innerHTML;
}

function buildRow(item) {
  const row = document.createElement('div');
  row.className = 'admin-row';

  const badge = document.createElement('div');
  badge.className = 'admin-time-badge';
  badge.textContent = item.time;

  const info = document.createElement('div');
  info.className = 'admin-row-info';
  let infoHtml = '<strong>' + escapeHtml(item.name) + '</strong><span>' + escapeHtml(item.phone) + '</span>';
  if (item.notes) infoHtml += '<span class="admin-notes">' + escapeHtml(item.notes) + '</span>';
  info.innerHTML = infoHtml;

  const actions = document.createElement('div');
  actions.className = 'admin-row-actions';

  const cancelBtn = document.createElement('button');
  cancelBtn.type = 'button';
  cancelBtn.className = 'btn-ghost btn';
  cancelBtn.textContent = 'Cancelar';

  const rowError = document.createElement('p');
  rowError.className = 'admin-row-error';

  let confirming = false;
  let resetTimer = null;

  cancelBtn.addEventListener('click', () => {
    if (!confirming) {
      confirming = true;
      cancelBtn.textContent = 'Confirmar cancelamento?';
      cancelBtn.classList.add('confirming');
      resetTimer = setTimeout(() => {
        confirming = false;
        cancelBtn.textContent = 'Cancelar';
        cancelBtn.classList.remove('confirming');
      }, 4000);
      return;
    }

    clearTimeout(resetTimer);
    cancelBooking(item.id, item.date, item.time, cancelBtn, rowError);
  });

  actions.appendChild(cancelBtn);
  actions.appendChild(rowError);

  row.appendChild(badge);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

async function loadBookings() {
  bookingsList.innerHTML = '<p class="slots-loading">Carregando agendamentos...</p>';
  emptyMsg.hidden = true;
  summaryEl.textContent = '';

  const q = fsFire.query(fsFire.collection(db, 'bookings'), fsFire.orderBy('date', 'asc'));
  const snap = await fsFire.getDocs(q);
  const today = todayStr();
  const items = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.date >= today) {
      items.push(Object.assign({ id: docSnap.id }, data));
    }
  });
  items.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  bookingsList.innerHTML = '';

  if (items.length === 0) {
    emptyMsg.hidden = false;
    return;
  }

  summaryEl.textContent = items.length + (items.length === 1 ? ' agendamento futuro' : ' agendamentos futuros');

  let currentDate = null;
  let dayGroup = null;

  items.forEach((item) => {
    if (item.date !== currentDate) {
      currentDate = item.date;
      dayGroup = document.createElement('div');
      dayGroup.className = 'admin-day-group';

      const dayItemsCount = items.filter((i) => i.date === currentDate).length;
      const heading = document.createElement('div');
      heading.className = 'admin-day-heading';
      heading.innerHTML = '<span class="day-name">' + weekdayName(currentDate) + ', ' + formatDate(currentDate) + '</span>'
        + '<span class="day-count">' + dayItemsCount + (dayItemsCount === 1 ? ' horário' : ' horários') + '</span>';

      dayGroup.appendChild(heading);
      bookingsList.appendChild(dayGroup);
    }

    dayGroup.appendChild(buildRow(item));
  });
}

async function cancelBooking(bookingId, date, time, btn, rowError) {
  rowError.textContent = '';
  btn.disabled = true;
  btn.textContent = 'Cancelando...';

  try {
    const batch = fsFire.writeBatch(db);
    batch.delete(fsFire.doc(db, 'bookings', bookingId));
    batch.delete(fsFire.doc(db, 'slots', date + '_' + time));
    await batch.commit();
    loadBookings();
  } catch (err) {
    rowError.textContent = 'Não foi possível cancelar: ' + (err && err.message ? err.message : String(err));
    btn.disabled = false;
    btn.textContent = 'Cancelar';
    btn.classList.remove('confirming');
  }
}

// Página do painel (painel.html): só mostra os agendamentos quando há login.
// Sem login, volta para a tela de entrada (admin.html).

async function init() {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    fsAuth = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    fsFire = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js');

    const app = initializeApp(firebaseConfig);
    auth = fsAuth.getAuth(app);
    db = fsFire.getFirestore(app);

    fsAuth.onAuthStateChanged(auth, (user) => {
      if (user) {
        checkingEl.hidden = true;
        panelSection.hidden = false;
        loadBookings();
      } else {
        location.replace('admin.html');
      }
    });
  } catch (err) {
    checkingEl.textContent = 'Não foi possível carregar o painel. Verifique sua internet e recarregue a página.';
  }
}

logoutBtn.addEventListener('click', () => {
  if (fsAuth && auth) fsAuth.signOut(auth);
});

init();
