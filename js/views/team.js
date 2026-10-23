// Команда: служители и их роли.
import { S, put, del, isCloud, approveRequest, rejectRequest, revokeAccess, setLeaders } from '../store.js';
import { h, icon, run, sheet, field, avatar, empty, bar, toast, confirmSheet } from '../ui.js';
import { ROLES, roleLabel, membersSorted, memberOfUid, me, upcoming, rolesIn } from '../model.js';
import { fmt } from '../dates.js';

let filter = 'all';

export function render(el, p, nav) {
  const M = me();
  const linked = new Set(Object.keys(S.links).map(u => memberOfUid(u)).filter(Boolean));
  el.append(bar('Команда', nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить служителя', onclick: () => openMemberEditor() }, icon('plus', 20))] : []));

  if (S.isLeader && isCloud()) {
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
    return h(S.isLeader ? 'button.li' : 'div.li', { type: S.isLeader ? 'button' : null, onclick: S.isLeader ? () => openMemberEditor(m) : null },
      avatar(m.name, m.id === M.memberId ? '.lg.ink' : '.lg'),
      h('div.li-main',
        h('div.li-t', m.name, m.id === M.memberId ? h('span.muted', ' · вы') : null),
        h('div.li-s', (m.roles || []).map(roleLabel).join(', ') || 'Роль не указана'),
        next ? h('div.li-s.mono', `Служит: ${fmt.short(next.date)}`) : null),
      S.isLeader ? h('span.small.muted', linked.has(m.id) ? 'в приложении' : 'не вошёл') : null);
  })) : h('div.list', empty('users', S.members.length ? 'Нет служителей с этой ролью' : 'Команда пока пуста',
    S.isLeader ? 'Добавьте служителей и отметьте их роли — потом их можно выбирать в служениях.' : null,
    S.isLeader ? h('button.btn', { type: 'button', onclick: () => openMemberEditor() }, icon('plus', 18), 'Добавить служителя') : null)));

  if (S.isLeader && isCloud()) el.append(accountsCard());
  if (S.isLeader) el.append(h('p.hint', { style: { padding: '0 4px' } },
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

function accountsCard() {
  const rows = Object.entries(S.links).filter(([, a]) => a && a.memberId);
  if (!rows.length) return h('div');
  return h('section.card',
    h('div', h('h2.h2', 'Аккаунты'), h('p.small.muted', 'Кто вошёл в приложение. Лидеры могут менять песни, расписание и состав.')),
    h('div.stack', rows.map(([uid, a]) => {
      const m = membersSorted().find(x => x.id === a.memberId);
      const leader = S.leaders.includes(uid);
      const self = uid === S.uid;
      return h('div.row.nowrap',
        h('div.grow', h('div.ellip', h('b', m ? m.name : 'Удалённый служитель'), leader ? h('span.muted', ' · лидер') : null), h('div.small.muted.ellip', a.email || '')),
        !self ? h('button.btn.sm.soft', {
          type: 'button', onclick: () => run(() => setLeaders(leader ? S.leaders.filter(x => x !== uid) : [...S.leaders, uid]), leader ? 'Больше не лидер' : 'Назначен лидером'),
        }, leader ? 'Снять лидера' : 'Сделать лидером') : null,
        !self ? h('button.iconbtn', {
          type: 'button', 'aria-label': 'Закрыть доступ', onclick: () => confirmSheet('Закрыть доступ?', `${m ? m.name : 'Этот участник'} больше не сможет открыть приложение. Служитель останется в списке команды.`, 'Закрыть доступ', () => run(async () => {
            if (leader) await setLeaders(S.leaders.filter(x => x !== uid));
            await revokeAccess(uid);
          }, 'Доступ закрыт')),
        }, icon('x', 18)) : null);
    })));
}

export function openMemberEditor(existing) {
  const st = existing ? { name: existing.name, roles: [...(existing.roles || [])] } : { name: '', roles: [] };
  sheet(existing ? 'Служитель' : 'Новый служитель', (b, ctx) => {
    b.append(
      field('Имя', h('input#mb-name', { value: st.name, placeholder: 'Имя', oninput: e => (st.name = e.target.value) })),
      h('div.fld', h('span', 'Роли — можно несколько'),
        h('div.chips', ROLES.map(r => h('button.chip', {
          type: 'button', style: { height: '38px', padding: '0 14px', fontSize: '14px' }, 'aria-pressed': String(st.roles.includes(r.k)),
          onclick: () => { st.roles = st.roles.includes(r.k) ? st.roles.filter(x => x !== r.k) : [...st.roles, r.k]; ctx.paint(); },
        }, r.label)))),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить', onclick: () => confirmSheet('Удалить служителя?', `${existing.name} исчезнет из списка команды. В уже составленных служениях появится пометка «Удалённый участник».`, 'Удалить', async () => {
            ctx.close();
            await run(() => del('members', existing.id), 'Удалено');
          }),
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.name.trim()) return toast('Введите имя');
            const doc = { name: st.name.trim(), roles: st.roles };
            if (existing && existing.demo) doc.demo = true;
            if (await run(() => put('members', doc, existing && existing.id), existing ? 'Сохранено' : 'Служитель добавлен')) ctx.close();
          },
        }, existing ? 'Сохранить' : 'Добавить')));
  }, { focus: !existing });
}
