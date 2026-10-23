// Вход, регистрация, ожидание подтверждения, первый лидер.
import { S, signIn, signUp, resetPassword, signOutUser, claimLeader } from '../store.js';
import { h, icon, field, seg, toast } from '../ui.js';

let tab = 'in';
const form = { name: '', email: '', password: '' };
let busy = false;

const AUTH_ERR = {
  'auth/invalid-credential': 'Неверная почта или пароль.',
  'auth/invalid-login-credentials': 'Неверная почта или пароль.',
  'auth/wrong-password': 'Неверная почта или пароль.',
  'auth/user-not-found': 'Аккаунт с такой почтой не найден.',
  'auth/email-already-in-use': 'Эта почта уже зарегистрирована. Войдите или восстановите пароль.',
  'auth/weak-password': 'Пароль должен быть не короче 6 символов.',
  'auth/invalid-email': 'Проверьте адрес почты.',
  'auth/missing-password': 'Введите пароль.',
  'auth/too-many-requests': 'Слишком много попыток. Подождите пару минут.',
  'auth/network-request-failed': 'Нет связи с интернетом.',
};
const authErr = e => AUTH_ERR[e && e.code] || 'Не получилось. Попробуйте ещё раз.';

function brand() {
  return h('header.top', h('div.stack', { style: { gap: '6px' } },
    h('p.eyebrow', 'Команда прославления'),
    h('h1.display', 'Служим', h('br'), h('span.soft', 'вместе'))));
}

export function render(el, p, nav) {
  el.append(brand());

  if (S.auth === 'loading') {
    el.append(h('div.boot', { style: { padding: '12vh 0' } }, h('span.boot-ring', { 'aria-hidden': 'true' }), h('p', 'Проверяем доступ…')));
    return;
  }

  if (S.auth === 'offline') {
    el.append(h('section.card', h('h2.h2', 'Нет связи'), h('p.muted', 'Для первого входа нужен интернет. После этого песни и расписание будут открываться и без сети.')));
    return;
  }

  if (S.auth === 'setup') {
    el.append(h('section.hero',
      h('div', h('p.hero-k', 'Первый запуск'), h('p.hero-t', 'Вы первый в этой базе'), h('p.hero-s', 'Станьте лидером команды: вы будете вести песни, расписание и подтверждать участников.')),
      h('div.row', h('button.btn.on-hero', {
        type: 'button', onclick: async () => {
          try { await claimLeader(); toast('Вы лидер команды'); } catch (e) { console.error(e); toast('Не получилось. Проверьте правила Firestore из инструкции.'); }
        },
      }, icon('star', 18), 'Стать лидером'))));
    el.append(h('p.hint', { style: { padding: '0 4px' } }, `Вы вошли как ${S.user && S.user.email}.`), signOutBtn());
    return;
  }

  if (S.auth === 'pending') {
    el.append(h('section.hero',
      h('div', h('p.hero-k', 'Заявка отправлена'), h('p.hero-t', S.user && S.user.name ? `${S.user.name}, почти готово` : 'Почти готово'),
        h('p.hero-s', 'Лидер увидит вашу заявку в разделе «Команда» и откроет доступ. Страница обновится сама.'))));
    el.append(h('div.note', icon('info', 18), h('span', `Вы вошли как ${S.user && S.user.email}. Если ошиблись почтой — выйдите и зарегистрируйтесь заново.`)), signOutBtn());
    return;
  }

  // Вход / регистрация
  const submit = async () => {
    if (busy) return;
    const email = form.email.trim();
    if (!email) return toast('Введите почту');
    if (tab === 'up' && !form.name.trim()) return toast('Введите имя');
    busy = true; nav.refresh();
    try {
      if (tab === 'in') await signIn(email, form.password);
      else await signUp(form.name.trim(), email, form.password);
      form.password = '';
    } catch (e) { console.warn(e); toast(authErr(e)); }
    busy = false; nav.refresh();
  };

  el.append(h('section.card',
    seg([['in', 'Вход'], ['up', 'Регистрация']], tab, v => { tab = v; nav.refresh(); }, '.full'),
    h('form.stack', { onsubmit: e => { e.preventDefault(); submit(); } },
      tab === 'up' ? field('Имя', h('input#au-name', { value: form.name, autocomplete: 'name', placeholder: 'Как вас зовут в команде', oninput: e => (form.name = e.target.value) })) : null,
      field('Почта', h('input#au-email', { type: 'email', value: form.email, autocomplete: 'email', inputmode: 'email', placeholder: 'name@example.com', oninput: e => (form.email = e.target.value) })),
      field('Пароль', h('input#au-pass', { type: 'password', value: form.password, autocomplete: tab === 'in' ? 'current-password' : 'new-password', placeholder: tab === 'up' ? 'Не короче 6 символов' : '', oninput: e => (form.password = e.target.value) })),
      h('button.btn.block', { type: 'submit', disabled: busy }, busy ? 'Подождите…' : tab === 'in' ? 'Войти' : 'Создать аккаунт')),
    tab === 'in' ? h('button.small.muted', {
      type: 'button', style: { alignSelf: 'center' }, onclick: async () => {
        const email = form.email.trim();
        if (!email) return toast('Введите почту, и мы пришлём ссылку');
        try { await resetPassword(email); toast('Письмо для смены пароля отправлено'); } catch (e) { toast(authErr(e)); }
      },
    }, 'Забыли пароль?') : h('p.hint', 'После регистрации лидер подтвердит, что вы из команды.')));
}

function signOutBtn() {
  return h('button.btn.ghost', { type: 'button', onclick: () => signOutUser() }, 'Выйти');
}
