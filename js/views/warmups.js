// Распевки перед служением и вокальные упражнения на каждый день.
import { S, ls, put, del } from '../store.js';
import { h, icon, run, sheet, field, empty, bar, toast, confirmSheet, linkBtn, safeUrl, seg } from '../ui.js';
import { can } from '../model.js';
import { today, addDays, plural } from '../dates.js';

export function warmupList(kind) {
  const list = S.warmups.filter(w => (w.kind || 'warmup') === kind);
  if (!list.length) return h('div.list', empty('mic', 'Пока пусто', kind === 'daily' ? 'Лидер добавит упражнения на каждый день.' : 'Лидер добавит распевки перед служением.'));
  return h('div.list', list.map((w, i) => h('div.li', { style: { alignItems: 'flex-start' } },
    h('span.num', { style: { paddingTop: '2px' } }, i + 1),
    h('div.li-main', { style: { display: 'grid', gap: '6px' } },
      h('div.li-t', w.title),
      w.note ? h('div.li-s', { style: { color: 'var(--ink-2)' } }, w.note) : null,
      safeUrl(w.url) ? h('div', linkBtn(safeUrl(w.url), 'Открыть', '.chip.line')) : null),
    can('tasks') ? h('button.iconbtn.flat', { type: 'button', 'aria-label': 'Изменить', onclick: () => openWarmupEditor(w) }, icon('edit', 18)) : null)));
}

export function render(el, p, nav) {
  el.append(bar('Распевки', nav, can('tasks') ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить упражнение', onclick: () => openWarmupEditor() }, icon('plus', 20))] : []));

  const days = ls.get('wt.daily') || [];
  const t = today();
  const doneToday = days.includes(t);
  let streak = 0; let d = doneToday ? t : addDays(t, -1);
  while (days.includes(d)) { streak++; d = addDays(d, -1); }
  const week = Array.from({ length: 7 }, (_, i) => addDays(t, i - 6));

  el.append(h('section.hero',
    h('div', h('p.hero-k', 'Каждый день дома'), h('p.hero-t', streak ? `${streak} ${plural(streak, ['день', 'дня', 'дней'])} подряд` : 'Начните серию сегодня'), h('p.hero-s', 'Несколько минут для голоса — и к воскресенью он готов.')),
    h('div.row', { style: { gap: '6px' } }, week.map(x => h('span.av', {
      style: { width: '34px', height: '34px', boxShadow: 'none', background: days.includes(x) ? 'var(--on-hero)' : 'var(--hero-line)', color: days.includes(x) ? 'var(--hero)' : 'var(--on-hero-2)' },
      title: x,
    }, new Date(x + 'T12:00').toLocaleDateString('ru-RU', { weekday: 'narrow' })))),
    h('div.row', h('button.btn.on-hero', {
      type: 'button', onclick: () => {
        ls.set('wt.daily', doneToday ? days.filter(x => x !== t) : [...days.filter(x => x >= addDays(t, -60)), t]);
        if (!doneToday) toast('Отмечено на сегодня');
        nav.refresh();
      },
    }, icon('check', 18), doneToday ? 'Сделано сегодня' : 'Отметить на сегодня'))));

  el.append(h('div.sec-h', h('h2.h2', 'Упражнения на каждый день')));
  el.append(warmupList('daily'));
  el.append(h('div.sec-h', h('h2.h2', 'Перед служением')));
  el.append(warmupList('warmup'));
  el.append(h('p.hint', { style: { padding: '0 4px' } }, 'Распевки перед служением также открываются кнопкой с микрофоном в режиме служения.'));
}

export function openWarmupEditor(existing) {
  const st = existing ? { ...existing } : { kind: 'warmup', title: '', url: '', note: '' };
  sheet(existing ? 'Изменить упражнение' : 'Новое упражнение', (b, ctx) => {
    b.append(
      seg([['warmup', 'Перед служением'], ['daily', 'Каждый день']], st.kind || 'warmup', v => { st.kind = v; ctx.paint(); }, '.full'),
      field('Название', h('input#wu-title', { value: st.title, placeholder: 'Губная трель', oninput: e => (st.title = e.target.value) })),
      field('Как выполнять', h('textarea#wu-note', { value: st.note || '', placeholder: 'Сколько времени, на что обратить внимание', oninput: e => (st.note = e.target.value) })),
      field('Ссылка на видео или аудио', h('input#wu-url', { type: 'url', value: st.url || '', placeholder: 'https://…', oninput: e => (st.url = e.target.value) })),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить', onclick: () => confirmSheet('Удалить упражнение?', `«${existing.title}» исчезнет из списка.`, 'Удалить', async () => { ctx.close(); await run(() => del('warmups', existing.id), 'Удалено'); }),
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите название');
            const doc = { kind: st.kind || 'warmup', title: st.title.trim(), note: st.note || '', url: (st.url || '').trim() };
            if (existing && existing.demo) doc.demo = true;
            if (await run(() => put('warmups', doc, existing && existing.id), existing ? 'Сохранено' : 'Добавлено')) ctx.close();
          },
        }, existing ? 'Сохранить' : 'Добавить')));
  }, { focus: !existing });
}
