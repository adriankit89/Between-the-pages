(() => {
  const SUPABASE_URL = 'https://vhuzxjzijliwfogvjacc.supabase.co';
  const SUPABASE_KEY = 'sb_publishable_mOfPT8PmG4ep444ikNUkKQ_DJLfX2TS';
  const WORKER_URL = 'https://between-the-pages-email.akitajewski.workers.dev';
  const STORAGE_KEY = 'btp_prototype_v1';

  let client;

  function loadSupabase() {
    return new Promise((resolve, reject) => {
      if (window.supabase) return resolve();
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  async function setup() {
    await loadSupabase();
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    addPanel();
  }

  function addPanel() {
    const grid = document.querySelector('.arc-settings-grid');
    if (!grid || document.getElementById('btp-cloud-panel')) return;

    const panel = document.createElement('section');
    panel.className = 'arc-panel';
    panel.id = 'btp-cloud-panel';
    panel.innerHTML = `
      <h3>Account & cloud backup</h3>
      <p>Sign in to protect your ARC library with a private cloud backup.</p>
      <label>Email</label>
      <input id="btp-email" type="email" autocomplete="email" placeholder="Your email">
      <label style="display:block;margin-top:10px">Password</label>
      <input id="btp-password" type="password" autocomplete="current-password" placeholder="At least 8 characters">
      <div class="arc-stack-actions" style="margin-top:14px">
        <button type="button" id="btp-signin">Sign in</button>
        <button type="button" class="secondary" id="btp-signup">Create free account</button>
      </div>
      <p id="btp-status" class="arc-help" aria-live="polite">Not signed in.</p>
      <div class="arc-stack-actions">
        <button type="button" id="btp-backup">Back Up Now</button>
        <button type="button" class="secondary" id="btp-restore">Restore Cloud Backup</button>
        <button type="button" class="secondary" id="btp-signout">Sign out</button>
      </div>
      <p class="arc-help">Your existing browser library is kept. Restoring replaces it only after confirmation.</p>
    `;
    grid.prepend(panel);

    const el = id => document.getElementById('btp-' + id);
    const status = message => { el('status').textContent = message; };

    async function session() {
      const result = await client.auth.getSession();
      return result.data.session;
    }

    async function requestBackup(method, body) {
      const current = await session();
      if (!current) throw new Error('Please sign in first.');
      const response = await fetch(WORKER_URL + '/backup', {
        method,
        headers: {
          Authorization: 'Bearer ' + current.access_token,
          'Content-Type': 'application/json'
        },
        ...(body ? { body: JSON.stringify(body) } : {})
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Backup request failed.');
      return result;
    }

    el('signup').onclick = async () => {
      try {
        const { data, error } = await client.auth.signUp({
          email: el('email').value.trim(),
          password: el('password').value
        });
        if (error) throw error;
        status(data.session
          ? 'Account created. You are signed in.'
          : 'Account created. Check your email to confirm, then sign in.');
      } catch (e) { status(e.message); }
    };

    el('signin').onclick = async () => {
      try {
        const { error } = await client.auth.signInWithPassword({
          email: el('email').value.trim(),
          password: el('password').value
        });
        if (error) throw error;
        status('Signed in. Your local library has not been changed.');
      } catch (e) { status(e.message); }
    };

    el('backup').onclick = async () => {
      try {
        const current = await session();
        if (!current) throw new Error('Please sign in first.');
        const existing = await fetch(WORKER_URL + '/backup', {
          headers: { Authorization: 'Bearer ' + current.access_token }
        });
        if (existing.ok && !confirm('A cloud backup already exists. Replace it with the library on this device?')) return;
        if (!existing.ok && existing.status !== 404) throw new Error('Could not check the existing backup.');
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) throw new Error('No local library was found.');
        await requestBackup('POST', JSON.parse(raw));
        localStorage.setItem('btp_cloud_backup_enabled', 'yes');
        status('Cloud backup saved successfully.');
      } catch (e) { status(e.message); }
    };

    el('restore').onclick = async () => {
      try {
        if (!confirm('Restore the cloud backup over the library on this device? Export a local backup first if you want to keep both.')) return;
        const result = await requestBackup('GET');
        if (!result.backup) throw new Error('No cloud backup was returned.');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(result.backup));
        status('Backup restored. Reloading the app…');
        setTimeout(() => location.reload(), 1000);
      } catch (e) { status(e.message); }
    };

    el('signout').onclick = async () => {
      await client.auth.signOut();
      status('Signed out.');
    };

    client.auth.getSession().then(({ data }) => {
      if (data.session) status('Signed in as ' + data.session.user.email);
    });
  }

  const observer = new MutationObserver(addPanel);
  const start = () => {
    const content = document.getElementById('content');
    if (content) observer.observe(content, { childList: true, subtree: true });
    addPanel();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  setup().catch(error => console.error('Cloud backup setup failed:', error));
})();
