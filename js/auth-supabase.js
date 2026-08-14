// Supabase Auth integration for The Racing Kings Master.
(function () {
  function client() { return window.rkSupabase; }
  function showError(id, msg) { if (typeof window.showErr === 'function') window.showErr(id, msg); }
  function showSuccess(id, msg) { if (typeof window.showOk === 'function') window.showOk(id, msg); }
  function hide(id) { if (typeof window.hideMsg === 'function') window.hideMsg(id); }

  window.handleLogin = async function (e) {
    e.preventDefault();
    hide('loginError'); hide('loginSuccess');
    const btn = document.getElementById('loginBtn');
    btn.disabled = true; btn.textContent = 'Logging in…';
    try {
      const supabase = client();
      if (!supabase) throw new Error('Supabase client is not available.');
      const email = document.getElementById('loginUser').value.trim();
      const password = document.getElementById('loginPass').value;
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('username').eq('id', data.user.id).maybeSingle();
      showSuccess('loginSuccess', `Welcome back, ${profile?.username || email}! Redirecting…`);
      setTimeout(() => { window.location.href = 'index.html'; }, 700);
    } catch (error) {
      showError('loginError', error.message || 'Login failed.');
    } finally {
      btn.disabled = false; btn.textContent = 'Login';
    }
  };

  window.handleRegister = async function (e) {
    e.preventDefault();
    hide('registerError'); hide('registerSuccess');
    const username = document.getElementById('regUser').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPass').value;
    const confirm = document.getElementById('regConfirm').value;
    if (!username) return showError('registerError', 'Please enter your Lichess username.');
    if (!email) return showError('registerError', 'Please enter your email address.');
    if (password !== confirm) return showError('registerError', 'Passwords do not match.');
    if (password.length < 6) return showError('registerError', 'Password must be at least 6 characters.');

    const btn = document.getElementById('registerBtn');
    btn.disabled = true; btn.textContent = 'Creating account…';
    try {
      const supabase = client();
      if (!supabase) throw new Error('Supabase client is not available.');
      const { data: existing, error: existingError } = await supabase.from('profiles').select('id').eq('username', username).maybeSingle();
      if (existingError) throw existingError;
      if (existing) throw new Error('That Lichess username is already registered.');
      const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { username } } });
      if (error) throw error;
      if (data.session) {
        showSuccess('registerSuccess', `Account created! Welcome, ${username}! Redirecting…`);
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
      } else {
        showSuccess('registerSuccess', 'Account created. Please check your email to verify your account.');
      }
    } catch (error) {
      showError('registerError', error.message || 'Registration failed.');
    } finally {
      btn.disabled = false; btn.textContent = 'Create account';
    }
  };

  document.addEventListener('DOMContentLoaded', async function () {
    const supabase = client();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) window.location.href = 'index.html';
  });
})();
