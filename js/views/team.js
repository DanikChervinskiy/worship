// Команда: служители и их роли.
import { S, put, del, isCloud, approveRequest, rejectRequest } from '../store.js';
import { h, icon, run, sheet, field, avatar, empty, bar, toast, confirmSheet } from '../ui.js';
import { ROLES, roleLabel, membersSorted, memberOfUid, me, upcoming, rolesIn, can } from '../model.js';
import { fmt } from '../dates.js';

let filter = 'all';

export function render(el, p, nav) {
  const M = me();
  const linked = new Set(Object.keys(S.links).map(u => memberOfUid(u)).filter(Boolean));
  el.append(bar('Команда', nav, can('team') ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить служителя', onclick: () => openMemberEditor() }, icon('plus', 20))] : []));

  if (can('team') && isCloud()) {
    if (S.requests.length) el.append(requestsCard());
  }

  el.append(h('div.filters',
    h('button.chip', { type: 'button', 'aria-pressed': String(filter === 'all'), onclick: () => { filter = 'all'; nav.refresh(); } }, `Все · ${S.members.length}`),
    ROLES.map(r => {
      const n = S.members.filter(m => (m.roles || []).includes(r.k)).length;
      return h('button.chip', { type: 'button', 'aria-pressed': String(filter === r.k), onclick: () => { filter = r.k; nav.refresh(); } }, `${r.label} · ${n}`);
    })));

  const list = membersSorted().filter(m => filter === 'all' || (m.roles || []).includes(filter));
  const ups = upcoming().filter(s => s.published);
  el.append(list.length ? h('div.list', list.map(m => {
    const next = ups.find(s => rolesIn(s, m.id).length);
    return h(can('team') ? 'button.li' : 'div.li', { type: can('team') ? 'button' : null, onclick: can('team') ? () => openMemberEditor(m) : null },
      avatar(m.name, m.id === M.memberId ? '.lg.ink' : '.lg'),
      h('div.li-main',
        h('div.li-t', m.name, m.id === M.memberId ? h('span.muted', ' · вы') : null),
        h('div.li-s', (m.roles || []).map(roleLabel).join(', ') || 'Роль не указана'),
        next ? h('div.li-s.mono', `Служит: ${fmt.short(next.date)}`) : null),
      can('team') ? h('span.small.muted', linked.has(m.id) ? 'в приложении' : 'не вошёл') : null);
  })) : h('div.list', empty('users', S.members.length ? 'Нет служителей с этой ролью' : 'Команда пока пуста',
    can('team') ? 'Добавьте служителей и отметьте их роли — потом их можно выбирать в служениях.' : null,
    can('team') ? h('button.btn', { type: 'button', onclick: () => openMemberEditor() }, icon('plus', 18), 'Добавить служителя') : null)));

  if (S.isLeader && isCloud()) el.append(h('button.btn.soft', { type: 'button', onclick: () => nav.push('settings') }, icon('sliders', 18), 'Доступы и права — в «Настройках»'));
  if (can('team')) el.append(h('p.hint', { style: { padding: '0 4px' } },
    isCloud()
      ? 'Участник регистрируется по ссылке на приложение, а вы подтверждаете заявку и выбираете, кто он в списке служителей.'
      : 'В демо-режиме вы выбираете себя на главном экране.'));
}

function requestsCard() {
  const pick = {};
  return h('section.card',
    h('div.card-h', h('h2.h2', 'Заявки на вход'), h('span.chip.ink', S.requests.length)),
    h('div.stack', S.requests.map(r => {
      const sel = h('select', { id: 'rq-' + r.uid, 'aria-label': 'Кто это в команде', onchange: e => (pick[r.uid] = e.target.value) },
        h('option', { value: '__new' }, `Новый служитель: ${r.name || r.email}`),
        membersSorted().map(m => h('option', { value: m.id, selected: r.name && m.name.toLowerCase() === String(r.name).toLowerCase() }, m.name)));
      pick[r.uid] = sel.value;
      return h('div.stack', { style: { gap: '8px', paddingBottom: '10px', borderBottom: '1px solid var(--line)' } },
        h('div', h('b', r.name || 'Без имени'), h('div.small.muted', r.email || '')),
        sel,
        h('div.row',
          h('button.btn.sm', {
            type: 'button', onclick: () => run(async () => {
              let mid = pick[r.uid] || sel.value;
              if (mid === '__new') mid = await put('members', { name: (r.name || r.email || 'Участник').trim(), roles: [] });
              await approveRequest(r.uid, mid, r.email || '');
            }, 'Доступ открыт'),
          }, icon('check', 16, 2.2), 'Подтвердить'),
          h('button.btn.sm.ghost', { type: 'button', onclick: () => run(() => rejectRequest(r.uid), 'Заявка отклонена') }, 'Отклонить')));
    })));
}
