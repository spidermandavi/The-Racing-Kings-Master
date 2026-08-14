// Supabase Auth integration for The Racing Kings Master.
// Loaded after the auth page's existing scripts so it can replace the old
// server-side /api/auth handlers without changing the page design.
(function () {
  function client() {
    return window.rkSupabase;
  }

  function showError(id, msg) {
    if (typeof window.showErr === 'function') window.showErr(id, msg);
  }

  function showSuccess(id, msg) {
    if (typeof window.showOk === 'function') window.showOk(id, msg);
  }

  function hide(id) {
    if (typeof window.hideMsg === 'function') window.hideMsg(id);
  }

  window.handleLogin = async function (e) {
    e.preventDefault();
    hide('loginError');
    hide('loginSuccess');

    const btn = document.getElementById('loginBtn');
    btn.disabled = true;
    btn.textContent = 'Logging in…';

    try {
      const supabase = client();
      if (!supabase) throw new Error('Supabase client is not available.');

      const username = document.getElementById('loginUser').value.trim();
      const password = document.getElementById('loginPass').value;

      // Supabase Auth uses email as the login identifier. For this site,
      // usernames are stored in profiles, so find the matching profile first.
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('id, username')
        .eq('username', username)
        .maybeSingle();

      if (profileError) throw profileError;
      if (!profile) throw new Error('No account was found for that username.');

      // The public profile does not contain the email, so accounts created by
      // this page use a deterministic internal email based on the user id.
      const email = `user-${profile.id}@accounts.racing-kings-master.local`;
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      showSuccess('loginSuccess', `Welcome back, ${profile.username}! Redirecting…`);
      setTimeout(() => { window.location.href = 'index.html'; }, 700);
    } catch (error) {
      showError('loginError', error.message || 'Login failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Login';
    }
  };

  window.handleRegister = async function (e) {
    e.preventDefault();
    hide('registerError');
    hide('registerSuccess');

    const username = document.getElementById('regUser').value.trim();
    const password = document.getElementById('regPass').value;
    const confirm = document.getElementById('regConfirm').value;

    if (!username) return showError('registerError', 'Please enter your Lichess username.');
    if (password !== confirm) return showError('registerError', 'Passwords do not match.');
    if (password.length < 6) return showError('registerError', 'Password must be at least 6 characters.');

    const btn = document.getElementById('registerBtn');
    btn.disabled = true;
    btn.textContent = 'Creating account…';

    try {
      const supabase = client();
      if (!supabase) throw new Error('Supabase client is not available.');

      // Check that the chosen username is not already registered.
      const { data: existing, error: existingError } = await supabase
        .from('profiles')
        .select('id')
        .eq('username', username)
        .maybeSingle();
      if (existingError) throw existingError;
      if (existing) throw new Error('That username is already registered.');

      const email = `pending-${crypto.randomUUID()}@accounts.racing-kings-master.local`;
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username } }
      });
      if (error) throw error;

      // When email confirmation is disabled, the trigger creates the profile
      // immediately and the user is logged in. If confirmation is enabled,
      // Supabase will require confirmation before a session is created.
      if (data.session) {
        showSuccess('registerSuccess', `Account created! Welcome, ${username}! Redirecting…`);
        setTimeout(() => { window.location.href = 'index.html'; }, 900);
      } else {
        showSuccess('registerSuccess', 'Account created. Please complete the email verification step if requested by Supabase.');
      }
    } catch (error) {
      showError('registerError', error.message || 'Registration failed.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Create account';
    }
  };

  // Replace the old server-session check with Supabase's session state.
  document.addEventListener('DOMContentLoaded', async function () {
    const supabase = client();
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    if (data.session) window.location.href = 'index.html';
  });
})();
