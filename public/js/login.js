const $ = (sel) => document.querySelector(sel);

const splash = $('#splash');
const splashStatus = $('#splashStatus');
const loader = $('#authLoader');
const loaderText = $('#loaderText');
const toastEl = $('#toast');
const form = $('#authForm');
const emailInput = $('#email');
const pwInput = $('#password');
const submitBtn = $('#submitBtn');
const errorEl = $('#formError');
const forgotBtn = $('#forgotBtn');
const socialBtns = [$('#googleBtn')];

let completing = false;

/* ---------------- UI helpers ---------------- */
function hideSplash() {
  splash.classList.add('is-hidden');
  setTimeout(() => splash.remove(), 500);
}

function showLoader(text) {
  loaderText.textContent = text;
  loader.hidden = false;
}
function hideLoader() { loader.hidden = true; }

let toastTimer;
function toast(msg, type = '') {
  toastEl.textContent = msg;
  toastEl.className = `toast is-visible ${type ? `toast--${type}` : ''}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('is-visible'), 3800);
}

function showError(msg) {
  errorEl.textContent = msg;
  errorEl.hidden = false;
}
function clearError() {
  errorEl.hidden = true;
  [emailInput, pwInput].forEach((i) => i.classList.remove('is-invalid'));
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.classList.toggle('is-loading', busy);
  socialBtns.forEach((b) => (b.disabled = busy));
}

const ERRORS = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password':
    'This email already has an account, but the password is wrong. Try again, tap “Forgot password?”, or use Continue with Google.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/weak-password': 'Please choose a password with at least 6 characters.',
  'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
  'auth/network-request-failed': 'Network error. Check your internet connection.',
  'auth/popup-closed-by-user': 'Sign-in was cancelled.',
  'auth/cancelled-popup-request': 'Sign-in was cancelled.',
  'auth/account-exists-with-different-credential':
    'This email is already registered with another sign-in method. Please use that method.',
  'auth/operation-not-allowed': 'This sign-in method is not enabled yet.',
  'auth/unauthorized-domain': 'This domain is not authorised in Firebase. Add it under Authentication → Settings.',
};
const friendly = (err) => ERRORS[err?.code] || err?.message || 'Something went wrong. Please try again.';

/* ---------------- Boot ---------------- */
splashStatus.textContent = 'Connecting securely…';

let fb;
try {
  const [authMod, init] = await Promise.all([
    import('https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js'),
    import('./firebase-init.js'),
  ]);
  fb = { ...authMod, ...init };
} catch (err) {
  console.error(err);
  splashStatus.textContent = err.message || 'Unable to load. Please refresh.';
  throw err;
}

const {
  auth, api, googleProvider,
  onAuthStateChanged, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword,
  sendPasswordResetEmail, sendEmailVerification,
  signInWithPopup, signInWithRedirect, signOut,
} = fb;

// Native-wrapped apps / installed PWAs can't use popups reliably → use redirect there.
const preferRedirect =
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true ||
  !!window.Capacitor;

// Single place where a signed-in Firebase user is synced to MongoDB and sent into the app.
async function completeLogin(user) {
  if (completing) return;
  completing = true;
  showLoader('Verifying your account…');
  try {
    loaderText.textContent = 'Setting up your profile…';
    const { isNewUser, user: profile } = await api('/api/auth/session', {
      method: 'POST',
      body: { displayName: user.displayName || '' },
      user,
    });
    loaderText.textContent = isNewUser ? 'Welcome to Dipti Medical!' : 'Welcome back!';
    sessionStorage.setItem('dm_welcome', isNewUser ? 'new' : 'back');
    // Back to where the customer came from (e.g. checkout); staff go to the admin panel
    const next = new URLSearchParams(location.search).get('next');
    const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : null;
    const dest = safeNext || (['admin', 'pharmacist'].includes(profile.role) ? '/admin/' : '/');
    setTimeout(() => location.replace(dest), 500);
  } catch (err) {
    console.error(err);
    await signOut(auth).catch(() => {});
    hideLoader();
    setBusy(false);
    showError(err.status === 403 ? err.message : `We couldn't complete sign-in. ${friendly(err)}`);
    completing = false;
  }
}

splashStatus.textContent = 'Checking your session…';

getRedirectResult(auth).catch((err) => {
  if (err?.code) showError(friendly(err));
});

let firstAuthEvent = true;
onAuthStateChanged(auth, (user) => {
  if (user) {
    completeLogin(user).finally(() => firstAuthEvent && hideSplash());
  } else if (firstAuthEvent) {
    hideSplash();
  }
  firstAuthEvent = false;
});

/* ---------------- Events ---------------- */
$('#togglePw').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const show = pwInput.type === 'password';
  pwInput.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show);
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

[emailInput, pwInput].forEach((i) => i.addEventListener('input', () => i.classList.remove('is-invalid')));

// One "Continue" button: existing users are signed in, new emails get an account automatically.
// Firebase identifies the person by UID either way, and /api/auth/session links that UID to their profile.
async function continueWithEmail(email, password) {
  try {
    return await signInWithEmailAndPassword(auth, email, password);
  } catch (err) {
    // With email-enumeration protection Firebase reports "invalid-credential" for both a wrong password and an
    // unknown email, so try creating the account; "email-already-in-use" then means the password was wrong.
    if (!['auth/invalid-credential', 'auth/user-not-found', 'auth/wrong-password'].includes(err.code)) throw err;
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      sendEmailVerification(cred.user).catch(() => {});
      return cred;
    } catch (createErr) {
      if (createErr.code === 'auth/email-already-in-use') throw Object.assign(new Error(), { code: 'auth/wrong-password' });
      throw createErr;
    }
  }
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email = emailInput.value.trim();
  const password = pwInput.value;

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.classList.add('is-invalid');
    return showError(ERRORS['auth/invalid-email']);
  }
  if (password.length < 6) {
    pwInput.classList.add('is-invalid');
    return showError(password ? ERRORS['auth/weak-password'] : ERRORS['auth/missing-password']);
  }

  setBusy(true);
  try {
    await continueWithEmail(email, password);
    // onAuthStateChanged → completeLogin takes over from here
  } catch (err) {
    setBusy(false);
    if (err.code === 'auth/wrong-password') pwInput.classList.add('is-invalid');
    showError(friendly(err));
  }
});

async function socialLogin(provider) {
  clearError();
  setBusy(true);
  try {
    if (preferRedirect) {
      showLoader('Redirecting…');
      await signInWithRedirect(auth, provider);
      return;
    }
    await signInWithPopup(auth, provider);
  } catch (err) {
    if (err.code === 'auth/popup-blocked') {
      showLoader('Redirecting…');
      return signInWithRedirect(auth, provider);
    }
    hideLoader();
    setBusy(false);
    if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
      showError(friendly(err));
    }
  }
}
$('#googleBtn').addEventListener('click', () => socialLogin(googleProvider));

forgotBtn.addEventListener('click', async () => {
  clearError();
  const email = emailInput.value.trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.classList.add('is-invalid');
    emailInput.focus();
    return showError('Enter your email above, then tap "Forgot password?" again.');
  }
  forgotBtn.disabled = true;
  try {
    await sendPasswordResetEmail(auth, email);
    toast('Password reset link sent. Check your inbox.', 'success');
  } catch (err) {
    showError(friendly(err));
  } finally {
    forgotBtn.disabled = false;
  }
});
