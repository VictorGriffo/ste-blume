// Configuração de horários de atendimento e do banco de dados (Firebase).
// Ajuste os valores abaixo conforme a agenda real da Steffany.

window.STEBLUME = {
  SCHEDULE: {
    // 0=domingo, 1=segunda, 2=terça, 3=quarta, 4=quinta, 5=sexta, 6=sábado
    workDays: [1, 2, 3, 4, 5, 6],
    startHour: 9,
    endHour: 19,
    breakStart: 12,
    breakEnd: 13,
    slotMinutes: 60,
    daysAhead: 30
  },

  WHATSAPP_NUMBER: '5527998041609',

  // Valores públicos do projeto Firebase (Console > Configurações do projeto).
  // Com "COLOQUE_AQUI" no apiKey o site funciona em modo de demonstração local.
  firebaseConfig: {
    apiKey: 'AIzaSyCIY1IK8IVpg8k3DbWgWFJkwdKkcZJvAAA',
    authDomain: 'steblume-agenda.firebaseapp.com',
    projectId: 'steblume-agenda',
    storageBucket: 'steblume-agenda.firebasestorage.app',
    messagingSenderId: '877035109297',
    appId: '1:877035109297:web:2d7953edfb32b955929b90'
  }

  // Para testar localhost: http://localhost:8123
  // Adicione esses domínios em Firebase Console > Authentication > Settings > Authorized domains:
  // - localhost
  // - 127.0.0.1
  // Remova depois de publicar no domínio real.
};

// Lista de horários do dia (ex.: "09:00", "10:00"...), pulando o intervalo de almoço.
// Usada tanto no agendamento (js/booking-ui.js) quanto no painel de bloqueio (js/admin-block.js).
window.STEBLUME.buildTimeList = function () {
  var SCHEDULE = window.STEBLUME.SCHEDULE;
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  var times = [];
  for (var h = SCHEDULE.startHour; h < SCHEDULE.endHour; h++) {
    if (h >= SCHEDULE.breakStart && h < SCHEDULE.breakEnd) continue;
    times.push(pad(h) + ':00');
  }
  return times;
};
