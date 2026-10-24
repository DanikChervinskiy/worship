// Настройки (видит лидер): кто вошёл в приложение, какие права у каждого, лидеры, закрыть доступ.
import { S, isCloud, setPerms, setLeaders, revokeAccess } from '../store.js';
import { h, icon, run, sheet, empty, bar, confirmSheet, avatar, toast } from '../ui.js';
import { PERMS, PERM, member } from '../model.js';

export function render(el, p, nav) {
  el.append(bar('Настройки', nav));

  if (!S.isLeader) {
    el.append(h('div.list', empty('sliders', 'Только для лидера', 'Права в команде раздаёт лидер.')));
    return;
  }
  if (!isCloud()) {
    el.append(h('div.note', icon('info', 18), h('span', 'В демо-режиме права не раздаются: здесь только вы.')));
    return;
  }

  el.append(h('section.card',
    h('h2.h2', 'Права в команде'),
    h('p.small.muted', 'Выберите человека и включите, что ему можно делать. Лидер может всё, включая эти настройки. Остальное — смотреть песни и расписание, отмечать доступность, голосовать, проходить уроки, настраивать каподастр — доступно всем.')));

  const rows = Object.entries(S.links)
    .filter(([, a]) => a && a.memberId)
    .map(([uid, a]) => ({ uid, a, m: member(a.memberId) }))
    .sort((x, y) => String(x.m ? x.m.name : '').localeCompare(String(y.m ? y.m.name : ''), 'ru'));

  // Лидеры, у которых нет записи доступа (например, вы сами до выбора себя в профиле).
  for (const uid of S.leaders) if (!rows.some(r => r.uid === uid)) rows.unshift({ uid, a: {}, m: null });

  if (!rows.length) {
    el.append(h('div.list', empty('users', 'Пока никого', 'Когда участники войдут в приложение и вы подтвердите заявки, они появятся здесь.')));
    return;
  }

  el.append(h('div.list', rows.map(({ uid, a, m }) => {
    const leader = S.leaders.includes(uid);
    const perms = S.permsAll[uid] || [];
    const self = uid === S.uid;
    const name = m ? m.name : self ? 'Вы' : 'Участник';
    const sub = leader ? 'Лидер · может всё' : perms.length ? perms.map(k => (PERM[k] || {}).label).filter(Boolean).join(', ') : 'Обычный участник';
    return h('button.li', { type: 'button', onclick: () => openPerson(uid, name, a.email || '', nav) },
      avatar(name, leader ? '.lg.ink' : '.lg'),
      h('div.li-main', h('div.li-t', name, self ? h('span.muted', ' · вы') : null), h('div.li-s', sub), a.email ? h('div.li-s.ellip', a.email) : null),
      icon('right', 18));
  })));
}

function openPerson(uid, name, email, nav) {
  const self = uid === S.uid;
  sheet(name, (b, ctx) => {
    const leader = S.leaders.includes(uid);
    const perms = new Set(S.permsAll[uid] || []);
    const save = async next => { await run(() => setPerms(uid, [...next]), 'Сохранено'); setTimeout(ctx.paint, 150); };

    b.append(
      email ? h('p.small.muted', email) : null,
      h('label.perm-row' + (leader ? '.on' : ''),
        h('div.grow', h('b', 'Лидер'), h('div.small.muted', 'Все права и эти настройки')),
        h('input', {
          type: 'checkbox', id: 'pm-leader-' + uid, checked: leader, disabled: self,
          onchange: async e => {
            const on = e.target.checked;
            const next = on ? [...S.leaders, uid] : S.leaders.filter(x => x !== uid);
            if (!next.length) { toast('В команде должен остаться хотя бы один лидер'); ctx.paint(); return; }
            await run(() => setLeaders(next), on ? `${name} теперь лидер` : `${name} больше не лидер`);
            setTimeout(ctx.paint, 150);
          },
        })),
      self ? h('p.hint', 'Снять лидерство с себя нельзя — попросите другого лидера.') : null,
      h('div.divider'),
      h('p.eyebrow', leader ? 'У лидера уже есть все права' : 'Отдельные права'),
      PERMS.map(pm => h('label.perm-row' + (leader || perms.has(pm.k) ? '.on' : ''),
        h('div.grow', h('b', pm.label), h('div.small.muted', pm.hint)),
        h('input', {
          type: 'checkbox', id: `pm-${pm.k}-${uid}`, checked: leader || perms.has(pm.k), disabled: leader,
          onchange: e => { const next = new Set(perms); if (e.target.checked) next.add(pm.k); else next.delete(pm.k); save(next); },
        }))),
      !self ? h('div.divider') : null,
      !self ? h('button.btn.ghost', {
        type: 'button', onclick: () => confirmSheet('Закрыть доступ?', `${name} больше не сможет открыть приложение. Служитель останется в списке команды.`, 'Закрыть доступ', async () => {
          ctx.close();
          await run(async () => {
            if (S.leaders.includes(uid)) await setLeaders(S.leaders.filter(x => x !== uid));
            await revokeAccess(uid);
          }, 'Доступ закрыт');
          nav.refresh();
        }),
      }, icon('x', 18), 'Закрыть доступ к приложению') : null);
  }, { onClose: () => nav.refresh() });
}
