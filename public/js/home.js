const $ = (sel) => document.querySelector(sel);

const PROVIDER_NAMES = { password: 'Email', 'google.com': 'Google' };

function toast(msg, type = '') {
  const el = $('#toast');
  el.textContent = msg;
  el.className = `toast is-visible ${type ? `toast--${type}` : ''}`;
  setTimeout(() => el.classList.remove('is-visible'), 3500);
}

function initialsAvatar(name) {
  const initials = (name || '?').split(/\s+/).map((p) => p[0]).slice(0, 2).join('').toUpperCase();
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 72 72"><rect width="72" height="72" fill="#c9eedd"/><text x="50%" y="50%" dy=".35em" text-anchor="middle" font-family="Poppins,sans-serif" font-size="28" font-weight="600" fill="#066948">${initials}</text></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

const [{ onAuthStateChanged, signOut }, { auth, api }] = await Promise.all([
  import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
  import('./firebase-init.js'),
]);

onAuthStateChanged(auth, async (fbUser) => {
  if (!fbUser) return location.replace('/');

  try {
    const { user } = await api('/api/auth/me', { user: fbUser });
    const name = user.displayName || fbUser.displayName || user.email?.split('@')[0] || 'there';
    $('#userName').textContent = name;
    $('#userEmail').textContent = user.email || '';
    $('#avatar').src = user.photoURL || initialsAvatar(name);
    $('#avatar').onerror = (e) => (e.target.src = initialsAvatar(name));
    $('#userProvider').textContent = (user.providers || []).map((p) => PROVIDER_NAMES[p] || p).join(', ') || '—';
    $('#userRole').textContent = user.role;
    $('#userSince').textContent = new Date(user.createdAt).toLocaleDateString(undefined, { dateStyle: 'medium' });
    if (['admin', 'pharmacist'].includes(user.role)) {
      const link = document.createElement('a');
      link.href = '/admin/';
      link.className = 'topbar__btn';
      link.style.cssText = 'display:inline-flex;align-items:center;text-decoration:none;margin-right:8px';
      link.textContent = 'Admin panel';
      $('#signOutBtn').before(link);
    }
    $('#verifyNote').hidden = fbUser.emailVerified || !(user.providers || []).includes('password');

    const welcome = sessionStorage.getItem('dm_welcome');
    if (welcome) {
      sessionStorage.removeItem('dm_welcome');
      toast(welcome === 'new' ? `Welcome to Dipti Medical, ${name}!` : `Welcome back, ${name}!`, 'success');
    }
  } catch (err) {
    console.error(err);
    if (err.status === 401 || err.status === 404) {
      await signOut(auth);
      return location.replace('/');
    }
    toast('Could not load your profile. Please refresh.', 'error');
  } finally {
    const splash = $('#splash');
    splash.classList.add('is-hidden');
    setTimeout(() => splash.remove(), 500);
  }
});

$('#signOutBtn').addEventListener('click', async () => {
  await signOut(auth);
  location.replace('/');
});
