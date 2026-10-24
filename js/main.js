// Точка входа: навигация, нижнее меню, кнопка «+».
import { S, init, onChange } from './store.js';
import { h, icon, sheet, add } from './ui.js';
import * as Home from './views/home.js';
import * as Schedule from './views/schedule.js';
import * as Songs from './views/songs.js';
import * as Perform from './views/perform.js';
import * as More from './views/more.js';
import * as Team from './views/team.js';
import * as Suggestions from './views/suggestions.js';
import * as Study from './views/study.js';
import * as Tasks from './views/tasks.js';
import * as Warmups from './views/warmups.js';
import * as Feedback from './views/feedback.js';
import * as Profile from './views/profile.js';
import * as Auth from './views/auth.js';
import { initPullToRefresh } from './pull.js';

window.__wtBooted = true;

// Шрифты подключаем без блокировки: без сети приложение откроется на системном шрифте.
(() => {
  const l = document.createElement('link');
  l.rel = 'stylesheet';
  l.href = 'https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&family=Unbounded:wght@500;600&display=swap';
  document.head.append(l);
})();

const view = document.getElementById('view');
const tabbar = document.getElementById('tabbar');
view.append = (...kids) => add(view, kids);

const routes = {
  home: Home.render, feed: Home.renderFeed,
  schedule: Schedule.render, service: Schedule.renderService, event: Schedule.renderEvent,
  songs: Songs.render, song: Songs.renderSong,
  perform: Perform.render,
  more: More.render, team: Team.render, suggestions: Suggestions.render,
  study: Study.render, lesson: Study.renderLesson, block: Study.renderBlock,
  tasks: Tasks.render, warmups: Warmups.render, feedback: Feedback.render, profile: Profile.render,
};
const TAB_OF = { home: 'home', feed: 'home', schedule: 'schedule', service: 'schedule', event: 'schedule', songs: 'songs', song: 'songs', perform: 'schedule' };
const TABS = ['home', 'schedule', 'songs', 'more'];

export const nav = {
  stack: [{ v: 'home', p: {} }],
  push(v, p = {}) { this.stack[this.stack.length - 1].y = window.scrollY; this.stack.push({ v, p }); render('top'); },
  replace(v, p = {}) { this.stack[this.stack.length - 1] = { v, p }; render('top'); },
  back() { if (this.stack.length > 1) { this.stack.pop(); render('restore'); } else this.go('home'); },
  go(tab) { this.stack = [{ v: tab, p: {} }]; render('top'); },
  refresh() { render('keep'); },
};

let cleanup = null;

function render(scroll = 'keep') {
  const top = nav.stack[nav.stack.length - 1];
  const keepY = window.scrollY;

  // запомним фокус, чтобы живое обновление данных не сбивало ввод
  const ae = document.activeElement;
  const focusId = ae && ae.id && view.contains(ae) ? ae.id : null;
  const sel = focusId && 'selectionStart' in ae ? [ae.selectionStart, ae.selectionEnd] : null;

  if (cleanup) { try { cleanup(); } catch { /* */ } cleanup = null; }
  document.body.classList.remove('perform');
  view.replaceChildren();

  const gate = S.auth !== 'ready';
  if (!S.loaded) {
    view.append(h('div.boot', h('span.boot-ring', { 'aria-hidden': 'true' }), h('p', 'Загружаем команду…')));
  } else if (gate) {
    Auth.render(view, {}, nav);
  } else {
    const fn = routes[top.v] || routes.home;
    const res = fn(view, top.p || {}, nav);
    if (typeof res === 'function') cleanup = res;
  }
  tabbar.hidden = gate || !S.loaded;
  if (!tabbar.hidden) renderTabs(TAB_OF[top.v] || 'more');

  if (focusId) {
    const el = document.getElementById(focusId);
    if (el) { el.focus({ preventScroll: true }); if (sel && el.setSelectionRange) try { el.setSelectionRange(sel[0], sel[1]); } catch { /* */ } }
  }
  const y = scroll === 'top' ? 0 : scroll === 'restore' ? (top.y || 0) : keepY;
  window.scrollTo(0, y);
}

function renderTabs(active) {
  const LABEL = { home: 'Главная', schedule: 'Расписание', songs: 'Песни', more: 'Ещё' };
  const ICON = { home: 'home', schedule: 'calendar', songs: 'music', more: 'grid' };
  const tab = k => h('button.tab', { type: 'button', 'aria-current': active === k ? 'page' : null, 'aria-label': LABEL[k], onclick: () => nav.go(k) },
    icon(ICON[k], 23), h('span', LABEL[k]));
  tabbar.replaceChildren(h('div.tabs',
    tab(TABS[0]), tab(TABS[1]),
    h('button.tab-plus', { type: 'button', 'aria-label': 'Добавить', onclick: quickActions }, icon('plus', 26, 2.2)),
    tab(TABS[2]), tab(TABS[3])));
}

function quickActions() {
  sheet('Добавить', (b, ctx) => {
    const act = (ic, title, sub, fn) => h('button', { type: 'button', onclick: () => { ctx.close(); fn(); } }, icon(ic, 24), h('div', h('b', title), h('br'), h('small', sub)));
    const items = S.isLeader ? [
      act('calendar', 'Служение', 'Песни, состав, репетиция', () => Schedule.openServiceEditor(nav)),
      act('music', 'Песня', 'Слова, аккорды, партии', () => Songs.openSongEditor(nav)),
      act('star', 'Событие', 'Конференция, фестиваль', () => Schedule.openEventEditor(nav)),
      act('bell', 'Уведомление', 'Сообщение всей команде', () => Home.openNotify()),
      act('list', 'Задача', 'С подзадачами по ролям', () => Tasks.openTaskEditor()),
      act('book', 'Урок', 'Духовное развитие', () => Study.openLessonEditor()),
    ] : [
      act('heart', 'Предложить песню', 'Название и ссылка', () => Suggestions.openSuggest()),
      act('calendar', 'Моя доступность', 'Смогу или не смогу', () => nav.go('schedule')),
      act('msg', 'Обратная связь', 'Ошибка или отзыв', () => nav.push('feedback')),
      act('mic', 'Распевки', 'Перед служением и дома', () => nav.push('warmups')),
    ];
    b.append(h('div.qa', items));
  });
}

// Когда доступ сменился (вошли, вышли, подтвердили) — начинаем с главной.
let lastAuth = S.auth;
onChange(() => {
  if (S.auth !== lastAuth) { lastAuth = S.auth; nav.stack = [{ v: 'home', p: {} }]; render('top'); return; }
  render('keep');
});
render('top');
init();
initPullToRefresh();

// Офлайн-режим и push: сервис-воркер (работает на настоящем хостинге, например GitHub Pages).
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(e => console.warn('sw', e)));
}
