// login.js — full-screen login gate in the shadcn login-01 layout, adapted to
// the vanilla prototype. Credentials are fixed by PROTOTYPE_REVIEW.md and valid
// for this demo only; the session flag lives in sessionStorage (per-tab).

import { BLANK_MODE } from './data.js';

const USERNAME = 'se-admin';
const PASSWORD = '@NorthwindEnergy2026';
const KEY = 'edqms-auth';

export function logout() {
  sessionStorage.removeItem(KEY);
  location.reload();
}

export function requireLogin() {
  return new Promise((resolve) => {
    if (sessionStorage.getItem(KEY) === '1') return resolve();

    const screen = document.createElement('div');
    screen.className = 'login-screen';

    const card = document.createElement('div');
    card.className = 'login-card';

    const mark = document.createElement('div');
    mark.className = 'brand-mark';
    mark.textContent = 'DG';

    const title = document.createElement('h1');
    title.className = 'login-title';
    title.textContent = 'Login to your account';

    const sub = document.createElement('p');
    sub.className = 'login-sub';
    sub.textContent = 'Division Governance Portal · EDQMS';

    const form = document.createElement('form');
    form.className = 'login-form';

    const user = loginField('Username', 'text', 'username');
    const pass = loginField('Password', 'password', 'current-password');

    const err = document.createElement('div');
    err.className = 'login-error';

    const btn = document.createElement('button');
    btn.type = 'submit';
    btn.className = 'btn-primary login-submit';
    btn.textContent = 'Login';

    form.append(user.wrap, pass.wrap, err, btn);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      if (user.input.value.trim() === USERNAME && pass.input.value === PASSWORD) {
        sessionStorage.setItem(KEY, '1');
        screen.classList.add('login-out');
        setTimeout(() => { screen.remove(); resolve(); }, 180);
      } else {
        err.textContent = 'Invalid username or password.';
        pass.input.value = '';
        pass.input.focus();
      }
    });

    // ux-review U8: the demo gate protects nothing sensitive — show the
    // credentials so a Pages visitor isn't stopped cold. The MVP walkthrough
    // keeps them out: only invited sessions get in.
    const note = document.createElement('p');
    note.className = 'login-note';
    note.textContent = BLANK_MODE
      ? 'MVP walkthrough — start from an empty QMS; your records persist in this browser.'
      : `Demo environment — sign in with ${USERNAME} / ${PASSWORD}. Non-persistent data, resets on reload.`;

    card.append(mark, title, sub, form, note);
    screen.appendChild(card);
    document.body.appendChild(screen);
    user.input.focus();
  });
}

function loginField(label, type, autocomplete) {
  const wrap = document.createElement('label');
  wrap.className = 'form-field';
  const l = document.createElement('span');
  l.className = 'form-label';
  l.textContent = label;
  const input = document.createElement('input');
  input.type = type;
  input.className = 'form-input';
  input.required = true;
  input.autocomplete = autocomplete;
  wrap.append(l, input);
  return { wrap, input };
}
