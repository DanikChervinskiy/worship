// Главная: ближайшее служение, мои отметки, задачи, лента уведомлений.
import { S, ls, putMine, loadDemo } from '../store.js';
import { h, icon, run, sheet, field, avatar, initials, empty, bar, toast } from '../ui.js';
import {
  me, upcoming, onTeam, rolesIn, roleLabel, svcSongs, feedFor, myAvail, setAvail, svcTitle,
  membersSorted, member, service, OPERATORS, recentAvail, notify, memberOfUid,
} from '../model.js';
import { fmt, relDay, daysBetween, today, addDays, plural } from '../dates.js';
import { openServiceEditor } from './schedule.js';
import { openProjector } from '../projector.js';

const greeting = () => {
  const hr = new Date().getHours();
  return hr < 5 ? 'Доброй ночи' : hr < 12 ? 'Доброе утро' : hr < 18 ? 'Добрый день' : 'Добрый вечер';
};

export function render(el, p, nav) {
  const M = me();
  const feed = feedFor(M.memberId);
  const seen = ls.get('wt.feedSeen') || 0;
  const unread = feed.filter(f => (f.at || 0) > seen).length;

  el.append(h('header.top',
    h('div.stack', { style: { gap: '6px' } },
      h('p.eyebrow', greeting() + (M.member ? `, ${M.member.name}` : '')),
      h('h1.display', 'Living', h('br'), h('span.soft', 'Spring'))),
    h('div.top-actions',
      h('button.iconbtn', { type: 'button', onclick: () => nav.push('feed'), 'aria-label': 'Уведомления' },
        icon('bell'), unread ? h('span.dot', unread > 9 ? '9+' : unread) : null),
      h('button.iconbtn', { type: 'button', onclick: () => nav.push('profile'), 'aria-label': 'Профиль' },
        M.member ? h('span.av.ink', initials(M.member.name)) : icon('user')))));

  // Режим работы
  if (S.mode === 'local') el.append(h('div.note', icon('info', 18), h('span', 'Демо-режим: изменения сохраняются только на этом устройстве.')));
  if (S.mode !== 'local' && !S.online) el.append(h('div.note', icon('cloud', 18), h('span', `Нет связи с общей базой. Показаны сохранённые данные${S.syncedAt ? ' от ' + fmt.stamp(S.syncedAt) : ''}.`)));
  if (S.mode === 'cloud' && !S.uid) el.append(h('div.note', icon('info', 18), h('span', 'Войдите в аккаунт Claude, чтобы отмечать доступность и голосовать.')));

  // Кто я?
  if (S.uid && !M.member && S.members.length && S.isLeader) el.append(linkCard());

  // Первый запуск у лидера
  if (S.isLeader && S.mode === 'cloud' && !S.members.length && !S.songs.length && !S.services.length) el.append(onboarding(nav));

  // Ближайшее служение
  const ups = upcoming();
  const mineNext = M.memberId ? ups.find(s => onTeam(s, M.memberId) && s.published) : null;
  el.append(hero(mineNext || ups[0], M, nav));

  // Ответы команды (лидеру)
  if (S.isLeader) {
    const rec = recentAvail(5);
    if (rec.length) el.append(h('section.card',
      h('div.card-h', h('h2.h2', 'Ответы команды'), h('span.small.muted', 'доступность')),
      h('div.stack', rec.map(r => {
        const svc = service(r.sid);
        const m = member(r.memberId);
        return h('button.row.nowrap', { type: 'button', style: { textAlign: 'left' }, onclick: () => nav.push('service', { id: r.sid }) },
          avatar(m ? m.name : '?'),
          h('div.grow', h('div.ellip', h('b', m ? m.name : 'Участник'), ' · ', svc ? fmt.short(svc.date) : '')),
          h('span.chip.' + (r.st === 'yes' ? 'ok' : 'no'), r.st === 'yes' ? 'Сможет' : 'Не сможет'));
      }))));
  }

  // Моя доступность
  if (M.memberId) {
    const next = ups.filter(s => s.date <= addDays(today(), 42)).slice(0, 5);
    if (next.length) el.append(h('section.card',
      h('div.card-h', h('h2.h2', 'Сможете служить?'), h('button.small.muted', { type: 'button', onclick: () => nav.go('schedule') }, 'Весь месяц')),
      h('div.stack', next.map(s => availRow(s)))));
  }

  // Операторам — тексты на проектор
  const opSvc = mineNext || ups[0];
  if (M.roles.some(r => OPERATORS.has(r)) && opSvc && svcSongs(opSvc).length) {
    el.append(h('section.card',
      h('div.card-h', h('div', h('h2.h2', 'Тексты на проектор'), h('p.small.muted', `${fmt.short(opSvc.date)} · ${svcSongs(opSvc).length} ${plural(svcSongs(opSvc).length, ['песня', 'песни', 'песен'])}`)), icon('monitor', 24)),
      h('div.chips', svcSongs(opSvc).map((x, i) => h('span.chip', `${i + 1}. ${x.song.title}`))),
      h('button.btn.soft', { type: 'button', onclick: () => openProjector(opSvc) }, icon('copy', 18), 'Открыть тексты')));
  }

  // Мои задачи
  const myTasks = S.tasks.filter(t => (t.role === 'all' || M.roles.includes(t.role) || (S.isLeader && !M.memberId)))
    .filter(t => !(t.subtasks || []).length || t.subtasks.some(s => !s.done)).slice(0, 3);
  if (myTasks.length) el.append(h('section.card',
    h('div.card-h', h('h2.h2', 'Задачи'), h('button.small.muted', { type: 'button', onclick: () => nav.push('tasks') }, 'Все')),
    h('div.stack', myTasks.map(t => {
      const subs = t.subtasks || [];
      const done = subs.filter(s => s.done).length;
      return h('button.row.nowrap', { type: 'button', style: { textAlign: 'left' }, onclick: () => nav.push('tasks') },
        h('span.li-ic', icon('list', 18)),
        h('div.grow', h('div.ellip', h('b', t.title)), h('div.small.muted', [roleLabel(t.role), t.when].filter(Boolean).join(' · '))),
        subs.length ? h('span.chip.mono', `${done}/${subs.length}`) : null);
    }))));

  // Распевка дома
  el.append(dailyCard(nav));

  // Плитки
  const learning = S.suggestions.filter(s => s.status !== 'added').length;
  const notes = (S.notes[S.uid] && S.notes[S.uid].lessons) || {};
  const doneLessons = S.lessons.filter(l => notes[l.id]).length;
  el.append(h('div.tiles',
    tile('', 'Новые песни', `${learning} в списке`, 'heart', () => nav.push('suggestions')),
    tile('.alt', 'Духовное развитие', `${doneLessons}/${S.lessons.length} уроков`, 'book', () => nav.push('study')),
    tile('.alt', 'Распевки', `${S.warmups.filter(w => w.kind !== 'daily').length} упражнения`, 'mic', () => nav.push('warmups')),
    tile('.dark', 'Все разделы', 'команда, задачи, отзывы', 'grid', () => nav.go('more'))));

  // Лента
  el.append(h('div.sec-h', h('h2.h2', 'Лента'), feed.length ? h('button.link', { type: 'button', onclick: () => nav.push('feed') }, 'Все') : null));
  el.append(feed.length
    ? h('div.list', feed.slice(0, 4).map(f => feedItem(f, seen, nav)))
    : h('div.list', empty('bell', 'Пока тихо', 'Здесь появятся объявления о служениях и изменениях в составе.')));
}

function hero(svc, M, nav) {
  if (!svc) {
    return h('section.hero',
      h('p.hero-k', 'Расписание'),
      h('p.hero-t', 'Ближайших служений пока нет'),
      M.isLeader
        ? h('div.row', h('button.btn.on-hero', { type: 'button', onclick: () => openServiceEditor(nav) }, icon('plus', 18), 'Добавить служение'))
        : h('p.hero-s', 'Как только расписание составят, оно появится здесь.'));
  }
  const days = daysBetween(today(), svc.date);
  const roles = rolesIn(svc, M.memberId);
  const songs = svcSongs(svc);
  return h('section.hero',
    h('div.hero-top',
      h('div',
        h('p.hero-k', (roles.length && svc.published ? 'Вы служите · ' : '') + relDay(svc.date)),
        h('p.hero-t', fmt.full(svc.date)),
        h('p.hero-s', [svc.time, svcTitle(svc)].filter(Boolean).join(' · '))),
      ring(days)),
    (svc.rehearsal || roles.length) ? h('div.chips',
      svc.rehearsal ? h('span.chip', icon('clock', 14), `Репетиция · ${fmt.short(svc.rehearsal.date)}, ${svc.rehearsal.time}`) : null,
      svc.published ? roles.map(r => h('span.chip', roleLabel(r))) : null) : null,
    h('div.row',
      h('button.btn.on-hero', { type: 'button', disabled: !songs.length, onclick: () => nav.push('perform', { id: svc.id }) }, icon('play', 16), 'Режим служения'),
      h('button.btn.on-hero.ghost', { type: 'button', onclick: () => nav.push('service', { id: svc.id }) },
        songs.length ? `${songs.length} ${plural(songs.length, ['песня', 'песни', 'песен'])}` : 'Подробнее')));
}

function ring(days) {
  const NS = 'http://www.w3.org/2000/svg';
  const r = 34, c = 2 * Math.PI * r;
  const v = days <= 0 ? 1 : Math.max(0.06, 1 - days / 7);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 78 78'); svg.setAttribute('width', 78); svg.setAttribute('height', 78);
  const mk = (stroke, dash) => {
    const ci = document.createElementNS(NS, 'circle');
    ci.setAttribute('cx', 39); ci.setAttribute('cy', 39); ci.setAttribute('r', r);
    ci.setAttribute('fill', 'none'); ci.setAttribute('stroke-width', 6); ci.setAttribute('stroke-linecap', 'round');
    ci.style.stroke = stroke;
    if (dash) { ci.setAttribute('stroke-dasharray', c); ci.setAttribute('stroke-dashoffset', c * (1 - v)); }
    return ci;
  };
  svg.append(mk('var(--hero-line)'), mk('var(--on-hero)', true));
  const label = days <= 0 ? h('div.ring-v', h('div', h('b', '•'), h('span', 'сегодня')))
    : h('div.ring-v', h('div', h('b', days), h('span', plural(days, ['день', 'дня', 'дней']))));
  return h('div.ring', { 'aria-label': days <= 0 ? 'Сегодня' : `Через ${days} дн.` }, svg, label);
}

export function availRow(s) {
  const st = myAvail(s.id);
  return h('div.row.nowrap',
    h('div.grow', h('div.ellip', h('b', fmt.short(s.date)), s.time ? h('span.muted', ' · ' + s.time) : null), h('div.small.muted.ellip', svcTitle(s))),
    h('div.av-btns',
      h('button.av-btn.yes', { type: 'button', 'aria-pressed': String(st === 'yes'), onclick: () => run(() => setAvail(s.id, 'yes')) }, icon('check', 15, 2.2), 'Смогу'),
      h('button.av-btn.no', { type: 'button', 'aria-pressed': String(st === 'no'), 'aria-label': 'Не смогу', onclick: () => run(() => setAvail(s.id, 'no')) }, icon('x', 15, 2.2))));
}

function linkCard() {
  const linked = new Set(Object.keys(S.links).map(u => memberOfUid(u)).filter(Boolean));
  const list = membersSorted();
  return h('section.card',
    h('div', h('h2.h2', 'Кто вы в команде?'), h('p.small.muted', 'Выберите себя в списке служителей, чтобы видеть свои служения и отмечать доступность.')),
    h('div.chips', list.map(m => h('button.chip' + (linked.has(m.id) ? '.line' : ''), {
      type: 'button', style: { height: '36px', padding: '0 14px', fontSize: '14px' },
      onclick: () => run(() => putMine('links', { memberId: m.id }), `Готово, ${m.name}!`),
    }, m.name))),
    h('p.hint', 'Нет себя в списке? Добавьте себя в разделе «Команда».'));
}

function onboarding(nav) {
  return h('section.card',
    h('div', h('p.eyebrow', 'С чего начать'), h('h2.h2', { style: { marginTop: '6px' } }, 'Соберите команду и первые песни')),
    h('div.stack.small',
      h('div', '1. Добавьте служителей и их роли в разделе «Команда».'),
      h('div', '2. Внесите песни: слова, аккорды, тональность, BPM.'),
      h('div', '3. Создайте служение и выберите песни и состав.'),
      h('div', '4. Поделитесь ссылкой с командой (кнопка «Поделиться» сверху).')),
    h('div.row',
      h('button.btn', { type: 'button', onclick: () => nav.push('team') }, icon('users', 18), 'Команда'),
      h('button.btn.ghost', { type: 'button', onclick: () => run(loadDemo, 'Пример загружен') }, 'Заполнить примером')),
    h('p.hint', 'Пример можно удалить одной кнопкой в профиле.'));
}

function tile(cls, title, sub, ic, onclick) {
  return h('button.tile' + cls, { type: 'button', onclick },
    h('div.tile-t', title), h('div.tile-s', sub), h('span.tile-ic', icon(ic, 72, 1.4)));
}

function dailyCard(nav) {
  const days = ls.get('wt.daily') || [];
  const t = today();
  const doneToday = days.includes(t);
  let streak = 0; let d = doneToday ? t : addDays(t, -1);
  while (days.includes(d)) { streak++; d = addDays(d, -1); }
  const daily = S.warmups.filter(w => w.kind === 'daily');
  return h('section.card',
    h('div.card-h',
      h('div', h('h2.h2', 'Распевка дома'), h('p.small.muted', daily.length ? daily.map(w => w.title).slice(0, 2).join(' · ') : 'Пара минут для голоса каждый день')),
      h('span.streak', streak ? `${streak} ${plural(streak, ['день', 'дня', 'дней'])} подряд` : '')),
    h('div.row',
      h('button.btn' + (doneToday ? '.soft' : ''), {
        type: 'button', onclick: () => {
          const next = doneToday ? days.filter(x => x !== t) : [...days.filter(x => x >= addDays(t, -60)), t];
          ls.set('wt.daily', next);
          if (!doneToday) toast('Отлично! Отмечено на сегодня');
          nav.refresh();
        },
      }, icon('check', 18), doneToday ? 'Сделано сегодня' : 'Отметить на сегодня'),
      h('button.btn.ghost', { type: 'button', onclick: () => nav.push('warmups') }, 'Упражнения')));
}

function feedItem(f, seen, nav) {
  const svc = f.serviceId ? service(f.serviceId) : null;
  return h(svc ? 'button.feed-i' : 'div.feed-i', {
    class: (f.at || 0) > seen ? 'new' : '', type: svc ? 'button' : null,
    style: { width: '100%', textAlign: 'left' },
    onclick: svc ? () => nav.push('service', { id: svc.id }) : null,
  },
    h('span.feed-dot'),
    h('div', h('div.feed-t', f.title), f.body ? h('div.feed-b', f.body) : null,
      h('div.feed-m', fmt.stamp(f.at || Date.now()) + (S.isLeader && Array.isArray(f.to) ? ` · лично: ${f.to.map(id => (member(id) || {}).name).filter(Boolean).join(', ')}` : ''))));
}

export function renderFeed(el, p, nav) {
  const M = me();
  const feed = feedFor(M.memberId);
  const seen = ls.get('wt.feedSeen') || 0;
  el.append(bar('Уведомления', nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Написать команде', onclick: openNotify }, icon('send', 20))] : []));
  el.append(feed.length ? h('div.list', feed.map(f => feedItem(f, seen, nav)))
    : h('div.list', empty('bell', 'Уведомлений нет', 'Сюда приходят объявления о служениях и изменениях в составе.')));
  el.append(h('p.hint', { style: { padding: '0 4px' } }, 'Важные уведомления также приходят на телефон, если включить их в профиле.'));
  const latest = feed.length ? Math.max(...feed.map(f => f.at || 0)) : 0;
  if (latest > seen) ls.set('wt.feedSeen', latest);
}

export function openNotify() {
  const st = { title: '', body: '' };
  sheet('Сообщение команде', (b, ctx) => {
    b.append(
      field('Заголовок', h('input#nt-title', { value: st.title, placeholder: 'Например: репетиция переносится', oninput: e => (st.title = e.target.value) })),
      field('Текст', h('textarea#nt-body', { value: st.body, placeholder: 'Подробности', oninput: e => (st.body = e.target.value) })),
      h('div.btn-row',
        h('button.btn.ghost', { type: 'button', onclick: ctx.close }, 'Отмена'),
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите заголовок');
            if (await run(() => notify(st.title.trim(), st.body.trim()), 'Отправлено команде')) ctx.close();
          },
        }, icon('send', 18), 'Отправить')));
  }, { focus: true });
}
