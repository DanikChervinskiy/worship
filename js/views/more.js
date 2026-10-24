// Меню «Ещё»: все остальные разделы.
import { S } from '../store.js';
import { h, icon } from '../ui.js';
import { me, roleLabel, voteCounts, lessonsOnly } from '../model.js';

export function render(el, p, nav) {
  const M = me();
  const notes = (S.notes[S.uid] && S.notes[S.uid].lessons) || {};
  const myTasks = S.tasks.filter(t => t.role === 'all' || M.roles.includes(t.role));
  const open = myTasks.filter(t => (t.subtasks || []).some(s => !s.done)).length;

  el.append(h('header.top',
    h('div.stack', { style: { gap: '6px' } }, h('p.eyebrow', 'Разделы'), h('h1.display', 'Ещё')),
    h('div.top-actions', h('button.iconbtn', { type: 'button', 'aria-label': 'Профиль', onclick: () => nav.push('profile') }, icon('user')))));

  const item = (ic, title, sub, route) => h('button.li', { type: 'button', onclick: () => nav.push(route) },
    h('span.li-ic', icon(ic, 20)), h('div.li-main', h('div.li-t', title), h('div.li-s', sub)), icon('right', 18));

  el.append(h('div.list',
    item('users', 'Команда', `${S.members.length} служителей`, 'team'),
    item('heart', 'Новые песни', `${S.suggestions.filter(s => s.status !== 'added').length} в списке · голосование`, 'suggestions'),
    item('book', 'Духовное развитие', `${lessonsOnly().filter(l => notes[l.id]).length} из ${lessonsOnly().length} уроков пройдено`, 'study'),
    item('list', 'Задачи', open ? `${open} в работе для вас` : 'Подготовка к служению по ролям', 'tasks')));

  el.append(h('div.list',
    item('mic', 'Распевки', 'Перед служением', 'warmups'),
    item('wave', 'Вокальные упражнения', 'Каждый день дома', 'warmups'),
    item('msg', 'Обратная связь', S.isLeader ? 'Ошибки и отзывы команды' : 'Сообщить об ошибке или идее', 'feedback'),
    item('user', 'Профиль и данные', M.member ? `${M.member.name} · ${M.roles.map(roleLabel).join(', ') || 'без роли'}` : 'Кто я, офлайн-доступ', 'profile')));
}
