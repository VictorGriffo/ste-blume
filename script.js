(function(){
  var items = document.querySelectorAll('.reveal');
  if(!('IntersectionObserver' in window)){
    items.forEach(function(el){ el.classList.add('is-visible'); });
    return;
  }
  var observer = new IntersectionObserver(function(entries){
    entries.forEach(function(entry){
      entry.target.classList.toggle('is-visible', entry.isIntersecting);
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -60px 0px' });
  items.forEach(function(el){ observer.observe(el); });
})();

// A lógica de envio do formulário de agendamento agora vive em
// js/booking-ui.js + js/booking-backend.js (carregada só na página agendar.html),
// pois precisa consultar/gravar horários no banco de dados.

// Logo no topo: ao clicar, mostra o acesso discreto ao painel administrativo.
(function(){
  var btn = document.getElementById('brandBtn');
  var pop = document.getElementById('adminPop');
  if (!btn || !pop) return;
  function close(){ pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); }
  btn.addEventListener('click', function(e){
    e.stopPropagation();
    pop.hidden = !pop.hidden;
    btn.setAttribute('aria-expanded', pop.hidden ? 'false' : 'true');
  });
  document.addEventListener('click', function(e){ if (!pop.contains(e.target)) close(); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') close(); });
})();

// Celular: menu recolhido atrás de um botão ☰ (o CSS só o mostra em telas pequenas).
(function(){
  var bar = document.querySelector('.topbar');
  var nav = bar && bar.querySelector('nav');
  if (!nav) return;
  document.documentElement.classList.add('has-js');
  var toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'nav-toggle';
  toggle.setAttribute('aria-label', 'Abrir menu');
  toggle.setAttribute('aria-expanded', 'false');
  toggle.innerHTML = '<span></span><span></span><span></span>';
  bar.appendChild(toggle);
  function setOpen(open){
    bar.classList.toggle('nav-open', open);
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    toggle.setAttribute('aria-label', open ? 'Fechar menu' : 'Abrir menu');
  }
  toggle.addEventListener('click', function(e){
    e.stopPropagation();
    setOpen(!bar.classList.contains('nav-open'));
  });
  nav.addEventListener('click', function(){ setOpen(false); });
  document.addEventListener('click', function(e){ if (!bar.contains(e.target)) setOpen(false); });
  document.addEventListener('keydown', function(e){ if (e.key === 'Escape') setOpen(false); });
})();

// Galeria: componente "antes/depois" com arraste (mouse, toque e teclado).
(function(){
  document.querySelectorAll('[data-ba]').forEach(function(slider){
    var before = slider.querySelector('.ba-before');
    var handle = slider.querySelector('.ba-handle');
    var grip = slider.querySelector('.ba-grip');
    var dragging = false;

    function setPercent(pct){
      pct = Math.max(0, Math.min(100, pct));
      before.style.clipPath = 'inset(0 ' + (100 - pct) + '% 0 0)';
      handle.style.left = pct + '%';
      slider.setAttribute('aria-valuenow', Math.round(pct));
    }

    function percentFromClientX(clientX){
      var rect = slider.getBoundingClientRect();
      return ((clientX - rect.left) / rect.width) * 100;
    }

    function onMove(e){
      if (!dragging) return;
      var clientX = e.touches ? e.touches[0].clientX : e.clientX;
      setPercent(percentFromClientX(clientX));
    }

    function start(e){
      dragging = true;
      e.preventDefault();
      onMove(e);
    }
    function stop(){ dragging = false; }

    // Só arrasta segurando a bolinha (grip) — o resto da foto não responde a clique/arraste.
    grip.addEventListener('mousedown', start);
    grip.addEventListener('touchstart', start, { passive: false });
    document.addEventListener('mousemove', onMove);
    document.addEventListener('touchmove', onMove, { passive: true });
    document.addEventListener('mouseup', stop);
    document.addEventListener('touchend', stop);

    slider.addEventListener('keydown', function(e){
      var current = parseFloat(slider.getAttribute('aria-valuenow')) || 50;
      if (e.key === 'ArrowLeft'){ setPercent(current - 5); e.preventDefault(); }
      if (e.key === 'ArrowRight'){ setPercent(current + 5); e.preventDefault(); }
    });
  });
})();