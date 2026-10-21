const $ = (sel) => document.querySelector(sel);

const splash = $('#splash');
const splashStatus = $('#splashStatus');
const loader = $('#authLoader');
const loaderText = $('#loaderText');
const toastEl = $('#toast');
const form = $('#authForm');
const tabs = document.querySelector('.tabs');
const nameField = document.querySelector('.field--name');
const nameInput = $('#name');
const emailInput = $('#email');
const pwInput = $('#password');
const submitBtn = $('#submitBtn');
const errorEl = $('#formError');
const strengthEl = $('#strength');
const forgotBtn = $('#forgotBtn');
const socialBtns = [$('#googleBtn')];

let mode = 'signin';
let pendingDisplayName = '';
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
  [nameInput, emailInput, pwInput].forEach((i) => i.classList.remove('is-invalid'));
}

function setBusy(busy) {
  submitBtn.disabled = busy;
  submitBtn.classList.toggle('is-loading', busy);
  socialBtns.forEach((b) => (b.disabled = busy));
}

function setMode(next) {
  mode = next;
  const signup = mode === 'signup';
  tabs.dataset.mode = mode;
  tabs.querySelectorAll('.tabs__btn').forEach((b) => {
    const active = b.dataset.mode === mode;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-selected', active);
  });
  nameField.hidden = !signup;
  strengthEl.hidden = !signup;
  forgotBtn.hidden = signup;
  pwInput.autocomplete = signup ? 'new-password' : 'current-password';
  pwInput.placeholder = signup ? 'At least 8 characters' : 'Enter your password';
  $('#cardTitle').textContent = signup ? 'Create your account' : 'Welcome back';
  $('#cardSubtitle').textContent = signup
    ? 'Join Dipti Medical for faster orders & refills'
    : 'Sign in to continue to Dipti Medical';
  submitBtn.querySelector('.btn__label').textContent = signup ? 'Create account' : 'Sign in';
  clearError();
}

function passwordScore(pw) {
  let s = 0;
  if (pw.length >= 8) s++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) s++;
  if (/\d/.test(pw)) s++;
  if (/[^A-Za-z0-9]/.test(pw)) s++;
  return pw ? Math.max(1, s) : 0;
}

const ERRORS = {
  'auth/invalid-email': 'Please enter a valid email address.',
  'auth/missing-password': 'Please enter your password.',
  'auth/invalid-credential': 'Incorrect email or password.',
  'auth/wrong-password': 'Incorrect email or password.',
  'auth/user-not-found': 'No account found with this email.',
  'auth/user-disabled': 'This account has been disabled. Please contact support.',
  'auth/email-already-in-use': 'An account with this email already exists. Try signing in.',
  'auth/weak-password': 'Password is too weak. Use at least 8 characters.',
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
  sendPasswordResetEmail, sendEmailVerification, updateProfile,
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
    if (pendingDisplayName && !user.displayName) {
      await updateProfile(user, { displayName: pendingDisplayName }).catch(() => {});
    }
    loaderText.textContent = 'Setting up your profile…';
    const { isNewUser } = await api('/api/auth/session', {
      method: 'POST',
      body: { displayName: pendingDisplayName || user.displayName || '' },
      user,
    });
    loaderText.textContent = isNewUser ? 'Welcome to Dipti Medical!' : 'Welcome back!';
    sessionStorage.setItem('dm_welcome', isNewUser ? 'new' : 'back');
    setTimeout(() => location.replace('/home/'), 500);
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
tabs.addEventListener('click', (e) => {
  const btn = e.target.closest('.tabs__btn');
  if (btn && btn.dataset.mode !== mode) setMode(btn.dataset.mode);
});

$('#togglePw').addEventListener('click', (e) => {
  const btn = e.currentTarget;
  const show = pwInput.type === 'password';
  pwInput.type = show ? 'text' : 'password';
  btn.setAttribute('aria-pressed', show);
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
});

pwInput.addEventListener('input', () => {
  if (mode === 'signup') strengthEl.dataset.score = passwordScore(pwInput.value);
});
[nameInput, emailInput, pwInput].forEach((i) => i.addEventListener('input', () => i.classList.remove('is-invalid')));

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const email = emailInput.value.trim();
  const password = pwInput.value;
  const name = nameInput.value.trim();

  if (mode === 'signup' && name.length < 2) {
    nameInput.classList.add('is-invalid');
    return showError('Please enter your full name.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    emailInput.classList.add('is-invalid');
    return showError(ERRORS['auth/invalid-email']);
  }
  if (password.length < (mode === 'signup' ? 8 : 6)) {
    pwInput.classList.add('is-invalid');
    return showError(mode === 'signup' ? 'Password must be at least 8 characters.' : ERRORS['auth/missing-password']);
  }

  setBusy(true);
  try {
    if (mode === 'signup') {
      pendingDisplayName = name;
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      sendEmailVerification(cred.user).catch(() => {});
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
    // onAuthStateChanged → completeLogin takes over from here
  } catch (err) {
    pendingDisplayName = '';
    setBusy(false);
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
