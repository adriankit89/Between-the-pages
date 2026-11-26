/* Between the Pages account + cloud backup layer.
   Local use remains available without an account. Cloud operations require sign-in. */
(() => {
  'use strict';
  const SUPABASE_URL = 'https://vhuzxjzijliwfogvjacc.supabase.co';
  const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_mOfPT8PmG4ep444ikNUkKQ_DJLfX2TS';
  const BACKUP_URL = 'https://between-the-pages.akitajewski.workers.dev/backup';
  let client = null;
  let authUser = null;
  let authReady = false;

  const $ = (id) => document.getElementById(id);
  const safeText = (value) => String(value || '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const message = (text, error = false) => {
    const node = $('btpAuthMessage');
    if (node) { node.textContent = text; node.style.color = error ? 'var(--danger-ink,#8c3d3b)' : 'var(--green)'; }
  };
  const session = async () => {
    if (!client) return null;
    const { data, error } = await client.auth.getSession();
    if (error) throw error;
    return data.session;
  };
  const renderStatus = () => {
    const node = $('btpAccountStatus');
    if (!node) return;
    if (!authReady) { node.textContent = 'Connecting securely…'; return; }
    node.textContent = authUser
      ? 'Signed in as ' + authUser.email + '. Cloud backup is available.'
      : 'You are using local mode. Sign in or create an account to use cloud backup.';
    const signed = $('btpSignedInActions'), forms = $('btpAuthForms'), signout = $('btpSignOut');
    if (signed) signed.hidden = !authUser;
    if (forms) forms.hidden = !!authUser;
    if (signout) signout.hidden = !authUser;
  };
  const refreshPanel = () => { renderStatus(); };
  async function cloudRequest(method, body) {
    const current = await session();
    if (!current?.access_token) throw new Error('Please sign in again to continue.');
    const response = await fetch(BACKUP_URL, {
      method,
      headers: { 'Authorization': 'Bearer ' + current.access_token, ...(body ? {'Content-Type':'application/json'} : {}) },
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    let result = {};
    try { result = await response.json(); } catch (_) {}
    if (!response.ok) {
      const diagnostics = [result.stage ? 'Stage: ' + result.stage : '', result.detail ? 'Detail: ' + result.detail : ''].filter(Boolean).join('\n');
      throw new Error((result.error || 'Cloud backup request failed (' + response.status + ').') + (diagnostics ? '\n' + diagnostics : ''));
    }
    return result;
  }
  async function signUp() {
    const email = $('btpAuthEmail')?.value.trim();
    const password = $('btpAuthPassword')?.value || '';
    const confirm = $('btpAuthConfirm')?.value || '';
    if (!email) return message('Enter your email address.', true);
    if (password.length < 8) return message('Your password must be at least 8 characters.', true);
    if (password !== confirm) return message('The passwords do not match.', true);
    message('Creating your account…');
    const { data, error } = await client.auth.signUp({
      email, password,
      options: { emailRedirectTo: window.location.origin + window.location.pathname }
    });
    if (error) return message(error.message, true);
    if (data.session) {
      authUser = data.user; refreshPanel();
      message('Account created and signed in. Your existing library is still on this device. Choose Back up this device to save it to the cloud.');
    } else {
      message('Account created. Check your email and confirm your address, then come back here and sign in.');
    }
  }
  async function signIn() {
    const email = $('btpAuthEmail')?.value.trim();
    const password = $('btpAuthPassword')?.value || '';
    if (!email || !password) return message('Enter your email address and password.', true);
    message('Signing in…');
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) return message(error.message, true);
    authUser = data.user; refreshPanel();
    message('Signed in. Your local library has not been changed. Choose whether to back it up or restore an existing cloud copy.');
  }
  async function forgotPassword() {
    const email = $('btpAuthEmail')?.value.trim();
    if (!email) return message('Enter your email address first, then choose Forgot password.', true);
    message('Sending password reset email…');
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname + '?resetPassword=1'
    });
    if (error) return message(error.message, true);
    message('If an account exists for that address, a password reset email has been sent. Check your inbox and spam folder.');
  }
  async function signOut() {
    const { error } = await client.auth.signOut();
    if (error) return message(error.message, true);
    authUser = null; refreshPanel(); message('Signed out. Your local library is still available on this device.');
  }
  async function backupDevice() {
    if (!authUser) return message('Sign in to use cloud backup.', true);
    if (!confirm('Back up the library currently on this device to your account? This replaces the previous cloud backup for this account.')) return;
    message('Uploading your library…');
    try {
      const result = await cloudRequest('POST', data);
      message('Cloud backup saved successfully' + (result.updated_at ? ' (' + new Date(result.updated_at).toLocaleString() + ').' : '.'));
    } catch (error) { message(error.message, true); }
  }
  async function restoreCloud() {
    if (!authUser) return message('Sign in to restore a cloud backup.', true);
    message('Checking your cloud backup…');
    try {
      const result = await cloudRequest('GET');
      const backup = result.backup;
      if (!backup || !Array.isArray(backup.books)) throw new Error('The cloud backup does not look like a valid Between the Pages library.');
      const count = backup.books.length;
      if (!confirm('Cloud backup found: ' + count + ' saved record' + (count === 1 ? '' : 's') + '. Restoring will replace the library currently stored in this browser. Export a local JSON backup first if you want to keep both. Continue?')) {
        message('Cloud restore cancelled. Your current library has not been changed.');
        return;
      }
      const previousData = data;
      backup.yearChallenges = backup.yearChallenges || {};
      backup.coverCache = backup.coverCache || {};
      backup.coverSuggestions = backup.coverSuggestions || {};
      backup.coverLocked = backup.coverLocked || {};
      backup.settings = backup.settings || {};
      data = backup;
      if (typeof save !== 'function' || !save()) {
        data = previousData;
        throw new Error('The cloud backup was downloaded, but this device could not save it. Your existing library has been kept.');
      }
      if (typeof applyTheme === 'function') applyTheme();
      if (typeof render === 'function') render();
      message('Cloud backup restored (' + count + ' saved record' + (count === 1 ? '' : 's') + '). Your library is now saved on this device.');
    } catch (error) { message(error.message, true); }
  }
  function panelMarkup() {
    return `
      <section class="arc-panel" id="btpAccountPanel">
        <h3>Account & cloud backup</h3>
        <p>Between the Pages works without an account. Your library stays on this device unless you choose to back it up. Sign in to access your private cloud backup.</p>
        <p class="arc-help" id="btpAccountStatus" role="status" aria-live="polite">Connecting securely…</p>
        <div id="btpAuthForms">
          <div class="field"><label for="btpAuthEmail">Email address</label><input id="btpAuthEmail" type="email" autocomplete="email" placeholder="you@example.com"></div>
          <div class="field"><label for="btpAuthPassword">Password</label><input id="btpAuthPassword" type="password" autocomplete="current-password" minlength="8" placeholder="At least 8 characters"></div>
          <div class="field"><label for="btpAuthConfirm">Confirm password (for new accounts)</label><input id="btpAuthConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="Enter your password again"></div>
          <div class="arc-actions">
            <button type="button" id="btpSignIn">Sign in</button>
            <button type="button" class="secondary" id="btpSignUp">Create account</button>
            <button type="button" class="secondary" id="btpForgot">Forgot password?</button>
          </div>
        </div>
        <div id="btpSignedInActions" hidden>
          <div class="arc-actions">
            <button type="button" id="btpCloudBackup">Back up this device</button>
            <button type="button" class="secondary" id="btpCloudRestore">Restore cloud backup</button>
          </div>
          <p class="arc-help">Back up uploads this device's current library. Restore replaces this device's current library with the saved cloud copy. Neither happens automatically.</p>
        </div>
        <div class="arc-actions"><button type="button" class="secondary" id="btpSignOut" hidden>Sign out</button></div>
        <p id="btpAuthMessage" class="arc-help" role="status" aria-live="polite"></p>
      </section>`;
  }
  function installPanel() {
    const container = document.querySelector('.arc-settings-grid');
    if (!container || $('btpAccountPanel')) return;
    container.insertAdjacentHTML('afterbegin', panelMarkup());
    refreshPanel();
  }
  function hookSettings() {
    if (typeof window.arcSettings !== 'function' || window.arcSettings.__btpAuthWrapped) return;
    const original = window.arcSettings;
    const wrapped = function() {
      const html = original.apply(this, arguments);
      return html.replace('<div class="arc-settings-grid">', '<div class="arc-settings-grid">' + panelMarkup());
    };
    wrapped.__btpAuthWrapped = true;
    window.arcSettings = wrapped;
  }
  function hookRender() {
    if (typeof window.arcRender !== 'function' || window.arcRender.__btpAuthWrapped) return;
    const original = window.arcRender;
    const wrapped = function() {
      const result = original.apply(this, arguments);
      if (window.page === 'backup') {
        installPanel();
        // Settings markup is rebuilt whenever the user leaves and returns.
        // Re-apply the current Supabase session to the newly rendered panel.
        refreshPanel();
      }
      return result;
    };
    wrapped.__btpAuthWrapped = true;
    window.arcRender = wrapped;
    if (typeof window.render === 'function') window.render = wrapped;
  }
  function bindPanelEvents() {
    document.addEventListener('click', (event) => {
      const id = event.target?.id;
      const actions = {
        btpSignIn: signIn, btpSignUp: signUp, btpForgot: forgotPassword,
        btpSignOut: signOut, btpCloudBackup: backupDevice, btpCloudRestore: restoreCloud
      };
      if (actions[id]) actions[id]();
    });
  }
  function addRecoveryPasswordForm() {
    const params = new URLSearchParams(window.location.search);
    if (params.get('resetPassword') !== '1') return;

    let observer = null;
    let completed = false;
    const show = () => {
      if (completed || $('btpNewPasswordPanel')) return;
      const host = document.querySelector('.arc-settings-grid');
      if (!host) return;
      host.insertAdjacentHTML('afterbegin', `
        <section class="arc-panel" id="btpNewPasswordPanel">
          <h3>Choose a new password</h3>
          <p class="arc-help">Use the link from your reset email to set a new password. If this link has expired, request another reset email.</p>
          <div class="field"><label for="btpNewPassword">New password</label><input id="btpNewPassword" type="password" minlength="8" autocomplete="new-password"></div>
          <div class="field"><label for="btpNewPasswordConfirm">Confirm new password</label><input id="btpNewPasswordConfirm" type="password" minlength="8" autocomplete="new-password"></div>
          <button type="button" id="btpSaveNewPassword">Save new password</button>
          <p id="btpResetMessage" class="arc-help" role="status" aria-live="polite"></p>
        </section>`);
      // We only need to watch for the settings page to appear. Disconnect now:
      // otherwise removing the completed form can cause the observer to add it again.
      observer?.disconnect();

      $('btpSaveNewPassword').addEventListener('click', async () => {
        const button = $('btpSaveNewPassword');
        const a = $('btpNewPassword')?.value || '';
        const b = $('btpNewPasswordConfirm')?.value || '';
        const out = $('btpResetMessage');
        if (a.length < 8) { out.textContent = 'Use at least 8 characters.'; return; }
        if (a !== b) { out.textContent = 'The passwords do not match.'; return; }

        button.disabled = true;
        out.textContent = 'Saving your new password…';
        try {
          // Supabase exchanges the recovery link for a session during client
          // initialisation. Check that session exists before attempting the update.
          const { data: sessionData, error: sessionError } = await client.auth.getSession();
          if (sessionError) throw sessionError;
          if (!sessionData?.session?.access_token) {
            throw new Error('This password reset link is invalid, expired, or has already been used. Please request a new reset email.');
          }

          const { data: updated, error } = await client.auth.updateUser({ password: a });
          if (error) throw error;

          completed = true;
          observer?.disconnect();
          // Remove the recovery query and any token hash from the address bar.
          window.history.replaceState({}, '', window.location.pathname);
          $('btpNewPasswordPanel')?.remove();

          authUser = updated?.user || sessionData.session.user;
          authReady = true;
          refreshPanel();
          message('Password updated successfully. You are now signed in with your new password.');
        } catch (error) {
          if (out) out.textContent = error?.message || 'We could not update your password. Please request a new reset email and try again.';
          if (button) button.disabled = false;
        }
      });
    };

    observer = new MutationObserver(show);
    observer.observe(document.body, { childList: true, subtree: true });
    show();
  }

  async function listPendingArcImports() {
    if (!authUser || !client) throw new Error('Sign in to view your pending ARC imports.');
    const { data, error } = await client.from('pending_arc_imports')
      .select('id,title,author,publisher,publication_date,netgalley_url,subject,received_at,status')
      .eq('status', 'pending').order('received_at', { ascending: false });
    if (error) throw error;
    return data || [];
  }
  async function updatePendingArcImport(id, status) {
    if (!authUser || !client) throw new Error('Sign in to manage ARC imports.');
    if (!['imported', 'dismissed'].includes(status)) throw new Error('Invalid import status.');
    const { data, error } = await client.from('pending_arc_imports')
      .update({ status }).eq('id', id).select('id,status').single();
    if (error) throw error;
    return data;
  }

  function start() {
    if (!window.supabase?.createClient) {
      const tag = document.createElement('script');
      tag.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
      tag.onload = start;
      tag.onerror = () => console.error('Could not load Supabase client library.');
      document.head.appendChild(tag);
      return;
    }
    client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    window.BTPAccount = {
      isSignedIn: () => !!authUser,
      listPendingArcImports,
      updatePendingArcImport
    };
    hookSettings();
    hookRender();
    bindPanelEvents();
    client.auth.getSession().then(({data, error}) => {
      if (error) console.warn('Supabase session check:', error.message);
      authUser = data?.session?.user || null;
      authReady = true;
      refreshPanel();
      if (typeof window.loadPendingArcImports === 'function') window.loadPendingArcImports();
    });
    client.auth.onAuthStateChange((_event, sessionValue) => {
      authUser = sessionValue?.user || null;
      authReady = true;
      refreshPanel();
      if (typeof window.loadPendingArcImports === 'function') window.loadPendingArcImports();
    });
    addRecoveryPasswordForm();
    if (new URLSearchParams(window.location.search).get('resetPassword') === '1') {
      setTimeout(() => { if (typeof window.arcGo === 'function') window.arcGo('backup'); }, 0);
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
// Cloudflare preview build trigger; no runtime behaviour changed.
