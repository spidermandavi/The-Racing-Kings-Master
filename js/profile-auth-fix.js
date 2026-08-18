// Supabase-backed authentication bridge for the title application modal.
(function () {
  if (!document.getElementById('applyModal')) return;

  const titles = [
    ['RKSGM','RKSGM — Super Grandmaster'], ['RKGM','RKGM — Grandmaster'],
    ['RKIM','RKIM — International Master'], ['RKM','RKM — Master'],
    ['RKCM','RKCM — Candidate Master'], ['RKV','RKV — Veteran']
  ];

  function esc(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
  }

  async function getLoggedInUser() {
    if (!window.rkAuth) return null;
    const session = await window.rkAuth.session();
    if (!session) return null;
    return await window.rkAuth.user();
  }

  async function getProfileStats(username) {
    try {
      const encoded = encodeURIComponent(username);
      const [userRes, perfRes] = await Promise.all([
        fetch(`https://lichess.org/api/user/${encoded}`),
        fetch(`https://lichess.org/api/user/${encoded}/perf/racingKings`)
      ]);
      const user = userRes.ok ? await userRes.json() : {};
      const perf = perfRes.ok ? await perfRes.json() : {};
      const rk = user.perfs?.racingKings || {};
      const stat = perf.stat || {};
      return {
        games: Number(stat.count?.all ?? rk.games ?? 0) || 0,
        peak_rating: Number(stat.highest?.int ?? rk.rating ?? 0) || 0
      };
    } catch {
      return { games: 0, peak_rating: 0 };
    }
  }

  window.openApplyModal = async function () {
    const overlay = document.getElementById('applyModal');
    const body = document.getElementById('applyModalBody');
    const profileInput = document.getElementById('usernameInput');
    const profileUser = profileInput?.value.trim();
    overlay.classList.remove('hidden');
    body.innerHTML = '<div class="modal-info">Checking your account…</div>';

    let loggedUser;
    try { loggedUser = await getLoggedInUser(); }
    catch (error) { console.warn('Could not check Supabase session:', error); }

    if (!loggedUser) {
      const redirect = encodeURIComponent('profile.html' + window.location.search);
      body.innerHTML = `<div class="modal-info">You need a site account to apply for a title.</div><div class="modal-actions"><button class="modal-cancel-btn" onclick="closeApplyModal()">Close</button><button class="modal-submit-btn" onclick="window.location.href='auth.html?redirect=${redirect}'">Login / Register</button></div>`;
      return;
    }

    if (!profileUser || loggedUser.username.toLowerCase() !== profileUser.toLowerCase()) {
      body.innerHTML = `<div class="modal-info">You're logged in as <strong>${esc(loggedUser.username)}</strong>. You can only apply for your own title.</div><div class="modal-actions"><button class="modal-cancel-btn" onclick="closeApplyModal()">Close</button><button class="modal-submit-btn" id="loadOwnProfileBtn">Load My Profile</button></div>`;
      document.getElementById('loadOwnProfileBtn').onclick = () => {
        profileInput.value = loggedUser.username;
        closeApplyModal();
        if (typeof window.loadProfile === 'function') window.loadProfile(loggedUser.username);
      };
      return;
    }

    body.innerHTML = `
      <div class="modal-field"><label class="modal-label">Lichess Username</label><input class="modal-input" value="${esc(profileUser)}" readonly></div>
      <div class="modal-field"><label class="modal-label">Title Applying For</label><select class="modal-select" id="applyTitleSelect">${titles.map(([code,label]) => `<option value="${code}">${label}</option>`).join('')}</select></div>
      <div class="modal-field"><label class="modal-label">Message (optional)</label><textarea class="modal-textarea" id="applyMessage" placeholder="Any additional context for the admin…"></textarea></div>
      <div class="modal-info">Your application will be submitted securely to the Racing Kings Titles database for admin review.</div>
      <div id="applyFeedback" style="margin-bottom:.75rem;font-size:.84rem;display:none"></div>
      <div class="modal-actions"><button class="modal-cancel-btn" onclick="closeApplyModal()">Cancel</button><button class="modal-submit-btn" id="applySubmitBtn">Submit Application</button></div>`;

    document.getElementById('applySubmitBtn').onclick = async () => {
      const btn = document.getElementById('applySubmitBtn');
      const feedback = document.getElementById('applyFeedback');
      btn.disabled = true;
      btn.textContent = 'Submitting…';
      feedback.style.display = 'none';

      try {
        const session = await window.rkAuth.session();
        if (!session?.user?.id) throw new Error('Your login session expired. Please log in again.');
        if (!window.rkSupabase) throw new Error('The database connection is not ready. Please refresh and try again.');

        const titleCode = document.getElementById('applyTitleSelect').value;
        const message = (document.getElementById('applyMessage').value || '').trim();
        const stats = await getProfileStats(profileUser);

        const { error } = await window.rkSupabase
          .from('title_applications')
          .insert({
            user_id: session.user.id,
            title_code: titleCode,
            message,
            games: stats.games,
            peak_rating: stats.peak_rating
          });

        if (error) throw new Error(error.message || 'Submission failed.');

        feedback.textContent = '✓ Application submitted! The admin will review it shortly.';
        feedback.style.color = '#4ade80';
        feedback.style.display = 'block';
        btn.textContent = 'Submitted';
      } catch (error) {
        console.error('Title application submission failed:', error);
        feedback.textContent = error.message || 'Submission failed. Please try again.';
        feedback.style.color = '#f87171';
        feedback.style.display = 'block';
        btn.disabled = false;
        btn.textContent = 'Submit Application';
      }
    };
  };
})();
