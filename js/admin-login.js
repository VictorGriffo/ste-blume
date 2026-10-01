// Tela de entrada (admin.html): faz o login e leva para o painel (painel.html).

(function () {
  var firebaseConfig = window.STEBLUME.firebaseConfig;

  var loginForm = document.getElementById('admin-login-form');
  var loginError = document.getElementById('admin-login-error');
  var submitBtn = loginForm.querySelector('button[type="submit"]');

  var auth = null;
  var fsAuth = null;

  // O listener do formulário é ligado já, sem esperar o Firebase carregar,
  // para um clique em "Entrar" nunca virar um recarregamento comum da página.
  submitBtn.disabled = true;
  submitBtn.textContent = 'Carregando...';

  var ready = Promise.all([
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js'),
    import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js')
  ]).then(function (mods) {
    fsAuth = mods[1];
    auth = fsAuth.getAuth(mods[0].initializeApp(firebaseConfig));
    fsAuth.onAuthStateChanged(auth, function (user) {
      if (user) location.replace('painel.html');
    });
  }).catch(function (err) {
    loginError.textContent = 'Não foi possível carregar o sistema de login. Verifique sua internet e recarregue a página.';
    throw err;
  }).then(function () {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Entrar';
  }, function () {});

  loginForm.addEventListener('submit', function (e) {
    e.preventDefault();
    loginError.textContent = '';
    ready.then(function () {
      if (!auth) return;
      var email = document.getElementById('admin-email').value.trim();
      var password = document.getElementById('admin-password').value;
      submitBtn.disabled = true;
      return fsAuth.signInWithEmailAndPassword(auth, email, password).catch(function () {
        loginError.textContent = 'E-mail ou senha incorretos.';
      }).then(function () {
        submitBtn.disabled = false;
      });
    });
  });
})();
