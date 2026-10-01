const firebaseConfig = window.STEBLUME.firebaseConfig;

const panelSection = document.getElementById('admin-panel');
const checkingEl = document.getElementById('admin-checking');
const logoutBtn = document.getElementById('admin-logout');

const blockDayForm = document.getElementById('admin-block-day-form');
const blockDayDate = document.getElementById('block-day-date');
const blockDayError = document.getElementById('block-day-error');
const blockSlotForm = document.getElementById('admin-block-slot-form');
const blockSlotDate = document.getElementById('block-slot-date');
const blockSlotTime = document.getElementById('block-slot-time');
const blockSlotError = document.getElementById('block-slot-error');
const blockedList = document.getElementById('admin-blocked-list');
const blockedEmpty = document.getElementById('admin-blocked-empty');

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

const buildTimeList = window.STEBLUME.buildTimeList;

buildTimeList().forEach((time) => {
  const opt = document.createElement('option');
  opt.value = time;
  opt.textContent = time;
  blockSlotTime.appendChild(opt);
});
blockDayDate.min = todayStr();
blockSlotDate.min = todayStr();

const WEEKDAY_SHORT = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

function withConfirm(btn, idleLabel, confirmLabel, action) {
  let confirming = false;
  let resetTimer = null;
  btn.addEventListener('click', () => {
    if (!confirming) {
      confirming = true;
      btn.textContent = confirmLabel;
      btn.classList.add('confirming');
      resetTimer = setTimeout(() => {
        confirming = false;
        btn.textContent = idleLabel;
        btn.classList.remove('confirming');
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    action();
  });
}

function buildBlockedRow(entry) {
  const row = document.createElement('div');
  row.className = 'admin-row admin-row-blocked';

  const badge = document.createElement('div');
  badge.className = 'admin-time-badge';
  badge.textContent = entry.allDay ? 'Dia todo' : entry.time;

  const info = document.createElement('div');
  info.className = 'admin-row-info';
  info.innerHTML = '<strong>' + (entry.allDay ? 'Dia bloqueado' : 'Horário bloqueado') + '</strong>';

  const actions = document.createElement('div');
  actions.className = 'admin-row-actions';

  const unblockBtn = document.createElement('button');
  unblockBtn.type = 'button';
  unblockBtn.className = 'btn-ghost btn';
  unblockBtn.textContent = 'Desbloquear';

  const rowError = document.createElement('p');
  rowError.className = 'admin-row-error';

  let confirming = false;
  let resetTimer = null;

  unblockBtn.addEventListener('click', () => {
    if (!confirming) {
      confirming = true;
      unblockBtn.textContent = 'Confirmar?';
      unblockBtn.classList.add('confirming');
      resetTimer = setTimeout(() => {
        confirming = false;
        unblockBtn.textContent = 'Desbloquear';
        unblockBtn.classList.remove('confirming');
      }, 4000);
      return;
    }
    clearTimeout(resetTimer);
    unblockEntry(entry, unblockBtn, rowError);
  });

  actions.appendChild(unblockBtn);
  actions.appendChild(rowError);

  row.appendChild(badge);
  row.appendChild(info);
  row.appendChild(actions);
  return row;
}

async function loadBlocked() {
  blockedList.innerHTML = '<p class="slots-loading">Carregando bloqueios...</p>';
  blockedEmpty.hidden = true;

  const q = fsFire.query(fsFire.collection(db, 'slots'));
  const snap = await fsFire.getDocs(q);
  const today = todayStr();
  const items = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (data.blocked && data.date >= today) items.push(Object.assign({ id: docSnap.id }, data));
  });
  items.sort((a, b) => (a.date + (a.allDay ? '' : a.time)).localeCompare(b.date + (b.allDay ? '' : b.time)));

  blockedList.innerHTML = '';

  if (items.length === 0) {
    blockedEmpty.hidden = false;
    return;
  }

  let currentDate = null;
  let dayGroup = null;

  items.forEach((item) => {
    if (item.date !== currentDate) {
      currentDate = item.date;
      dayGroup = document.createElement('div');
      dayGroup.className = 'admin-day-group';
      const heading = document.createElement('div');
      heading.className = 'admin-day-heading';
      const d = new Date(currentDate + 'T00:00:00');
      heading.innerHTML = '<span class="day-name">' + WEEKDAY_SHORT[d.getDay()] + ', ' + formatDate(currentDate) + '</span>';
      dayGroup.appendChild(heading);
      blockedList.appendChild(dayGroup);
    }
    dayGroup.appendChild(buildBlockedRow(item));
  });
}

async function blockSingleSlot(dateStr, time) {
  const slotRef = fsFire.doc(db, 'slots', dateStr + '_' + time);
  const existing = await fsFire.getDoc(slotRef);
  if (existing.exists()) throw new Error('taken');
  await fsFire.setDoc(slotRef, { date: dateStr, time: time, blocked: true, createdAt: fsFire.serverTimestamp() });
}

async function blockAllDay(dateStr) {
  const slotRef = fsFire.doc(db, 'slots', dateStr + '_ALLDAY');
  await fsFire.setDoc(slotRef, { date: dateStr, time: 'ALLDAY', blocked: true, allDay: true, createdAt: fsFire.serverTimestamp() });
}

async function unblockEntry(entry, btn, rowError) {
  rowError.textContent = '';
  btn.disabled = true;
  btn.textContent = '...';
  try {
    if (entry.allDay) {
      const q = fsFire.query(fsFire.collection(db, 'slots'), fsFire.where('date', '==', entry.date), fsFire.where('blocked', '==', true));
      const snap = await fsFire.getDocs(q);
      const batch = fsFire.writeBatch(db);
      snap.forEach((docSnap) => batch.delete(docSnap.ref));
      await batch.commit();
    } else {
      await fsFire.deleteDoc(fsFire.doc(db, 'slots', entry.id));
    }
    loadBlocked();
  } catch (err) {
    rowError.textContent = 'Não foi possível desbloquear: ' + (err && err.message ? err.message : String(err));
    btn.disabled = false;
    btn.textContent = 'Desbloquear';
    btn.classList.remove('confirming');
  }
}

blockDayForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  blockDayError.textContent = '';
  const dateStr = blockDayDate.value;
  const submitBtn = blockDayForm.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Bloqueando...';
  try {
    await blockAllDay(dateStr);
    blockDayForm.reset();
    loadBlocked();
  } catch (err) {
    blockDayError.textContent = 'Erro: ' + (err && err.message ? err.message : String(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

blockSlotForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  blockSlotError.textContent = '';
  const dateStr = blockSlotDate.value;
  const time = blockSlotTime.value;
  const submitBtn = blockSlotForm.querySelector('button[type="submit"]');
  const originalLabel = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = 'Bloqueando...';
  try {
    await blockSingleSlot(dateStr, time);
    blockSlotForm.reset();
    loadBlocked();
  } catch (err) {
    blockSlotError.textContent = 'Erro: ' + (err && err.message ? err.message : String(err));
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;
  }
});

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

async function checkAuth() {
  await initFirebase();
  return new Promise((resolve) => {
    fsAuth.onAuthStateChanged(auth, (user) => {
      if (user) {
        panelSection.hidden = false;
        checkingEl.hidden = true;
        loadBlocked();
        resolve(true);
      } else {
        window.location.href = 'admin.html';
      }
    });
  });
}

logoutBtn.addEventListener('click', () => {
  fsAuth.signOut(auth).then(() => {
    window.location.href = 'index.html';
  });
});

checkAuth();
