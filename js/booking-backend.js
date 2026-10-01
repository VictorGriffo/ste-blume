// Camada de dados do agendamento (script comum, sem módulos).
// Se o Firebase estiver configurado (js/schedule-config.js), usa o Firestore
// como banco real, compartilhado entre todas as clientes. Caso contrário,
// cai em um modo de demonstração local (localStorage) só para testes.

(function () {
  var firebaseConfig = window.STEBLUME.firebaseConfig;
  var isConfigured = !!firebaseConfig.apiKey && firebaseConfig.apiKey.indexOf('COLOQUE_AQUI') === -1;

  var db = null;
  var fs = null;
  var initPromise = null;

  function initFirebase() {
    if (!isConfigured) return Promise.resolve(null);
    if (db) return Promise.resolve(db);
    if (!initPromise) {
      initPromise = Promise.all([
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js')
      ]).then(function (mods) {
        fs = mods[1];
        var app = mods[0].initializeApp(firebaseConfig);
        db = fs.getFirestore(app);
        return db;
      });
    }
    return initPromise;
  }

  var LOCAL_KEY = 'steblume_demo_bookings';

  function localReadAll() {
    try {
      return JSON.parse(localStorage.getItem(LOCAL_KEY) || '{}');
    } catch (e) {
      return {};
    }
  }

  function localGetTaken(dateStr) {
    var all = localReadAll();
    return Object.keys(all)
      .filter(function (id) { return id.indexOf(dateStr + '_') === 0; })
      .map(function (id) { return id.split('_')[1]; });
  }

  function localReserve(dateStr, time, data) {
    var all = localReadAll();
    var id = dateStr + '_' + time;
    if (all[id]) return { ok: false, reason: 'taken' };
    all[id] = Object.assign({ date: dateStr, time: time, createdAt: Date.now() }, data);
    try {
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
    } catch (e) {
      return { ok: false, reason: 'error', error: e };
    }
    return { ok: true };
  }

  function isDemoMode() {
    return !isConfigured;
  }

  function fetchTakenSlots(dateStr) {
    if (!isConfigured) return Promise.resolve(localGetTaken(dateStr));
    return initFirebase().then(function () {
      var q = fs.query(fs.collection(db, 'slots'), fs.where('date', '==', dateStr));
      return fs.getDocs(q);
    }).then(function (snap) {
      var taken = [];
      snap.forEach(function (d) { taken.push(d.data().time); });
      return taken;
    });
  }

  function reserveSlot(dateStr, time, bookingData) {
    if (!isConfigured) return Promise.resolve(localReserve(dateStr, time, bookingData));
    return initFirebase().then(function () {
      var slotRef = fs.doc(db, 'slots', dateStr + '_' + time);
      return fs.runTransaction(db, function (tx) {
        return tx.get(slotRef).then(function (existing) {
          if (existing.exists()) throw new Error('taken');
          tx.set(slotRef, { date: dateStr, time: time, createdAt: fs.serverTimestamp() });
          var bookingRef = fs.doc(fs.collection(db, 'bookings'));
          tx.set(bookingRef, Object.assign({ date: dateStr, time: time, createdAt: fs.serverTimestamp() }, bookingData));
        });
      });
    }).then(function () {
      return { ok: true };
    }).catch(function (err) {
      if (err && err.message === 'taken') return { ok: false, reason: 'taken' };
      return { ok: false, reason: 'error', error: err };
    });
  }

  window.STEBLUME_BACKEND = {
    isDemoMode: isDemoMode,
    fetchTakenSlots: fetchTakenSlots,
    reserveSlot: reserveSlot
  };
})();
