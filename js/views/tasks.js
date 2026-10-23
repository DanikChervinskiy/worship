// Задачи с подзадачами для разных ролей (например, звукооператору — протереть пульт).
import { S, put, del } from '../store.js';
import { h, icon, run, sheet, field, empty, bar, toast, confirmSheet } from '../ui.js';
import { ROLES, roleLabel, me } from '../model.js';

let filter = null;

export function render(el, p, nav) {
  const M = me();
  if (filter == null) filter = M.roles.length ? 'mine' : 'all';
  el.append(bar('Задачи', nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить задачу', onclick: () => openTaskEditor() }, icon('plus', 20))] : []));

  const roleKeys = ['all', ...ROLES.map(r => r.k)];
  el.append(h('div.filters',
    M.roles.length ? h('button.chip', { type: 'button', 'aria-pressed': String(filter === 'mine'), onclick: () => { filter = 'mine'; nav.refresh(); } }, 'Мои') : null,
    roleKeys.map(k => h('button.chip', { type: 'button', 'aria-pressed': String(filter === k), onclick: () => { filter = k; nav.refresh(); } }, k === 'all' ? 'Все' : roleLabel(k)))));

  const list = S.tasks
    .filter(t => filter === 'all' ? true : filter === 'mine' ? (t.role === 'all' || M.roles.includes(t.role)) : t.role === filter)
    .sort((a, b) => String(a.title).localeCompare(String(b.title), 'ru'));

  if (!list.length) {
    el.append(h('div.list', empty('list', 'Задач нет', S.isLeader ? 'Добавьте задачу для роли — например, подготовить пульт перед служением.' : 'Для выбранной роли задач пока нет.',
      S.isLeader ? h('button.btn', { type: 'button', onclick: () => openTaskEditor() }, icon('plus', 18), 'Добавить задачу') : null)));
    return;
  }

  el.append(h('div.stack', list.map(t => {
    const subs = t.subtasks || [];
    const done = subs.filter(s => s.done).length;
    const toggle = i => run(() => put('tasks', { ...t, subtasks: subs.map((s, k) => (k === i ? { ...s, done: !s.done } : s)) }, t.id));
    return h('section.card',
      h('div.card-h',
        h('div.grow', h('b', t.title), h('div.small.muted', [roleLabel(t.role), t.when].filter(Boolean).join(' · '))),
        subs.length ? h('span.chip.mono' + (done === subs.length ? '.ok' : ''), `${done}/${subs.length}`) : null,
        S.isLeader ? h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить задачу', onclick: () => openTaskEditor(t) }, icon('edit', 18)) : null),
      subs.length ? h('div', subs.map((s, i) => h('label.check' + (s.done ? '.done' : ''),
        h('input', { type: 'checkbox', id: `tk-${t.id}-${i}`, checked: !!s.done, onchange: () => toggle(i) }),
        h('span', s.t)))) : null,
      subs.length && done ? h('button.btn.sm.ghost', { type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => run(() => put('tasks', { ...t, subtasks: subs.map(s => ({ ...s, done: false })) }, t.id), 'Отметки сброшены') }, icon('refresh', 16), 'Сбросить отметки') : null);
  })));
  el.append(h('p.hint', { style: { padding: '0 4px' } }, 'Отметки общие для всех: если один отметил пункт, остальные увидят, что он сделан.'));
}

export function openTaskEditor(existing) {
  const st = existing
    ? { title: existing.title, role: existing.role || 'all', when: existing.when || '', subs: (existing.subtasks || []).map(s => s.t).join('\n') }
    : { title: '', role: 'all', when: 'Перед каждым служением', subs: '' };
  sheet(existing ? 'Изменить задачу' : 'Новая задача', (b, ctx) => {
    b.append(
      field('Задача', h('input#tk-title', { value: st.title, placeholder: 'Например: подготовить пульт', oninput: e => (st.title = e.target.value) })),
      h('div.grid2',
        field('Для кого', h('select#tk-role', { value: st.role, onchange: e => (st.role = e.target.value) }, h('option', { value: 'all' }, 'Для всех'), ROLES.map(r => h('option', { value: r.k }, r.label)))),
        field('Когда', h('input#tk-when', { value: st.when, placeholder: 'Перед служением', oninput: e => (st.when = e.target.value) }))),
      field('Подзадачи', h('textarea#tk-subs', { value: st.subs, placeholder: 'Каждая подзадача с новой строки', oninput: e => (st.subs = e.target.value) })),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить задачу', onclick: () => confirmSheet('Удалить задачу?', `«${existing.title}» исчезнет у всей команды.`, 'Удалить', async () => { ctx.close(); await run(() => del('tasks', existing.id), 'Задача удалена'); }),
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите задачу');
            const old = existing ? existing.subtasks || [] : [];
            const subtasks = st.subs.split('\n').map(x => x.trim()).filter(Boolean).map(t => ({ t, done: !!(old.find(o => o.t === t) || {}).done }));
            const doc = { title: st.title.trim(), role: st.role, when: st.when.trim(), subtasks };
            if (existing && existing.demo) doc.demo = true;
            if (await run(() => put('tasks', doc, existing && existing.id), existing ? 'Сохранено' : 'Задача добавлена')) ctx.close();
          },
        }, existing ? 'Сохранить' : 'Добавить')));
  }, { focus: !existing });
}
