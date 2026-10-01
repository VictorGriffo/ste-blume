(function () {
  const root = document.getElementById('booking-form');
  if (!root) return;

  const SCHEDULE = window.STEBLUME.SCHEDULE;
  const WHATSAPP_NUMBER = window.STEBLUME.WHATSAPP_NUMBER;
  const fetchTakenSlots = window.STEBLUME_BACKEND.fetchTakenSlots;
  const reserveSlot = window.STEBLUME_BACKEND.reserveSlot;
  const isDemoMode = window.STEBLUME_BACKEND.isDemoMode;

  const datesWrap = document.getElementById('b-dates');
  const dateInput = document.getElementById('b-date');
  const slotsWrap = document.getElementById('b-slots');
  const slotInput = document.getElementById('b-slot-value');
  const statusEl = document.getElementById('b-status');
  let selectedDateLabel = '';

  function pad(n) {
    return n < 10 ? '0' + n : '' + n;
  }

  function toDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function weekdayLabel(d) {
    return ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][d.getDay()];
  }

  const MONTH_NAMES = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  const WEEKDAY_SHORT = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + SCHEDULE.daysAhead - 1);

  let viewYear = today.getFullYear();
  let viewMonth = today.getMonth();

  function isSelectable(d) {
    return d >= today && d <= maxDate && SCHEDULE.workDays.indexOf(d.getDay()) !== -1;
  }

  function renderCalendar() {
    const firstOfMonth = new Date(viewYear, viewMonth, 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    const todayMonthFirst = new Date(today.getFullYear(), today.getMonth(), 1);
    const canGoPrev = firstOfMonth > todayMonthFirst;

    const nextMonthFirst = new Date(viewYear, viewMonth + 1, 1);
    const canGoNext = nextMonthFirst <= maxDate;

    let html = '<div class="cal-header">'
      + '<button type="button" class="cal-nav" data-dir="-1"' + (canGoPrev ? '' : ' disabled') + ' aria-label="Mês anterior">‹</button>'
      + '<span class="cal-month-label">' + MONTH_NAMES[viewMonth] + ' ' + viewYear + '</span>'
      + '<button type="button" class="cal-nav" data-dir="1"' + (canGoNext ? '' : ' disabled') + ' aria-label="Próximo mês">›</button>'
      + '</div>';

    html += '<div class="cal-weekdays">';
    WEEKDAY_SHORT.forEach((w) => { html += '<span>' + w + '</span>'; });
    html += '</div>';

    html += '<div class="cal-grid">';
    for (let i = 0; i < startWeekday; i++) html += '<span class="cal-empty"></span>';
    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(viewYear, viewMonth, day);
      const dateStr = toDateStr(d);
      const selectable = isSelectable(d);
      const isSelected = dateInput.value === dateStr;
      html += '<button type="button" class="cal-day' + (isSelected ? ' selected' : '') + '" data-date="' + dateStr + '" aria-pressed="' + isSelected + '"' + (selectable ? '' : ' disabled') + '>' + day + '</button>';
    }
    html += '</div>';

    datesWrap.innerHTML = html;

    datesWrap.querySelectorAll('.cal-nav:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dir = parseInt(btn.dataset.dir, 10);
        viewMonth += dir;
        if (viewMonth < 0) { viewMonth = 11; viewYear--; }
        if (viewMonth > 11) { viewMonth = 0; viewYear++; }
        renderCalendar();
      });
    });

    datesWrap.querySelectorAll('.cal-day:not([disabled])').forEach((btn) => {
      btn.addEventListener('click', () => {
        const dateStr = btn.dataset.date;
        const d = new Date(dateStr + 'T00:00:00');
        dateInput.value = dateStr;
        selectedDateLabel = weekdayLabel(d) + ' ' + pad(d.getDate()) + '/' + pad(d.getMonth() + 1);
        clearStatus();
        renderCalendar();
        renderSlots(dateStr);
      });
    });
  }

  function clearStatus() {
    statusEl.textContent = '';
    statusEl.className = 'form-status';
  }

  const buildTimeList = window.STEBLUME.buildTimeList;

  async function renderSlots(dateStr) {
    slotInput.value = '';
    if (!dateStr) {
      slotsWrap.innerHTML = '';
      return;
    }
    slotsWrap.innerHTML = '<p class="slots-loading">Carregando horários...</p>';

    const times = buildTimeList();
    let taken = [];
    try {
      taken = await fetchTakenSlots(dateStr);
    } catch (e) {
      slotsWrap.innerHTML = '<p class="slots-loading">Não foi possível carregar os horários agora.</p>';
      return;
    }

    const now = new Date();
    const isToday = dateStr === toDateStr(now);

    slotsWrap.innerHTML = '';
    times.forEach((time) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'slot-btn';
      btn.textContent = time;
      btn.setAttribute('aria-pressed', 'false');

      let isPast = false;
      if (isToday) {
        const hourNum = parseInt(time.split(':')[0], 10);
        if (hourNum <= now.getHours()) isPast = true;
      }

      if (taken.indexOf(time) !== -1 || isPast) {
        btn.disabled = true;
        btn.classList.add('slot-taken');
      } else {
        btn.addEventListener('click', () => {
          slotsWrap.querySelectorAll('.slot-btn').forEach((b) => {
            b.classList.remove('selected');
            b.setAttribute('aria-pressed', 'false');
          });
          btn.classList.add('selected');
          btn.setAttribute('aria-pressed', 'true');
          slotInput.value = time;
          clearStatus();
        });
      }
      slotsWrap.appendChild(btn);
    });
  }

  renderCalendar();

  if (isDemoMode() && statusEl) {
    statusEl.textContent = 'Modo de demonstração: os horários reservados aqui só ficam salvos neste navegador. Configure o Firebase (js/schedule-config.js) para valer entre todas as clientes.';
    statusEl.className = 'form-status demo-warning';
  }

  root.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('b-name').value.trim();
    const phone = document.getElementById('b-phone').value.trim();
    const notes = document.getElementById('b-notes').value.trim();
    const dateStr = dateInput.value;
    const time = slotInput.value;
    const dateLabel = selectedDateLabel || dateStr;

    if (!dateStr || !time) {
      statusEl.textContent = 'Escolha um dia e um horário disponível antes de enviar.';
      statusEl.className = 'form-status form-error';
      return;
    }

    const submitBtn = root.querySelector('button[type="submit"]');
    const originalLabel = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = 'Reservando...';

    const result = await reserveSlot(dateStr, time, {
      name,
      phone,
      notes
    });

    submitBtn.disabled = false;
    submitBtn.textContent = originalLabel;

    if (!result.ok) {
      if (result.reason === 'taken') {
        statusEl.textContent = 'Esse horário acabou de ser reservado por outra pessoa. Escolha outro, por favor.';
        statusEl.className = 'form-status form-error';
        renderSlots(dateStr);
      } else {
        statusEl.textContent = 'Não foi possível concluir a reserva agora. Tente novamente ou chame direto no WhatsApp.';
        statusEl.className = 'form-status form-error';
      }
      return;
    }

    statusEl.textContent = 'Horário reservado! Confirme pelo WhatsApp que vai abrir agora.';
    statusEl.className = 'form-status form-success';

    const lines = [
      'Oi Steffany! 🌸',
      '',
      'Reservei um horário para minha avaliação e gostaria de confirmar:',
      '',
      'Nome: ' + name,
      'Dia: ' + dateLabel,
      'Horário: ' + time
    ];
    if (notes) lines.push('Observações: ' + notes);

    const message = encodeURIComponent(lines.join('\n'));
    const url = 'https://api.whatsapp.com/send?phone=' + WHATSAPP_NUMBER + '&text=' + message;
    window.open(url, '_blank', 'noopener');

    root.reset();
    dateInput.value = '';
    slotInput.value = '';
    selectedDateLabel = '';
    renderCalendar();
    slotsWrap.innerHTML = '<p class="slots-loading">Selecione um dia para ver os horários disponíveis.</p>';
  });
})();
