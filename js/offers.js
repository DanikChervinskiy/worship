// «Предложить себя» в состав служения.
// Предложение хранится в своём документе avail/{uid} (поле o: { serviceId: { role: время } }),
// поэтому участнику не нужны права на расписание. Решение лидера — в самом служении:
// offerDone[uid_role] = { at, ok }: принят (человек появляется в составе) или отклонён.
import { S, put, putMine } from './store.js';
import { h, icon, run, sheet, avatar, toast } from './ui.js';
import { fmt } from './dates.js';
import { ROLES, roleLabel, member, me, personName, svcTitle, svcLabel, isDone, upcoming, memberOfUid, can } from './model.js';

// Вокалисты добавляются, остальные роли — замена того, кто стоит.
export const ADDS = new Set(['vocal']);

const offerKey = (uid, role) => `${uid}_${role}`;
const inRole = (svc, role, memberId) => ((svc.team || {})[role] || []).some(p => p.memberId === memberId);
const occupants = (svc, role) => (svc.team || {})[role] || [];

export const myOffers = sid => (((S.avail[S.uid] || {}).o || {})[sid]) || {};

// Состояние моего предложения на роль: in | pending | rejected | none
export function offerState(svc, role, uid = S.uid) {
  const mid = memberOfUid(uid);
  if (mid && inRole(svc, role, mid)) return 'in';
  const at = ((((S.avail[uid] || {}).o || {})[svc.id]) || {})[role];
  if (!at) return 'none';
  const d = (svc.offerDone || {})[offerKey(uid, role)];
  if (d && d.at >= at) return d.ok ? 'none' : 'rejected';
  return 'pending';
}

export function offersFor(svc) {
  if (!svc || isDone(svc)) return [];
  const out = [];
  for (const [uid, a] of Object.entries(S.avail)) {
    const roles = ((a && a.o) || {})[svc.id];
    if (!roles) continue;
    const memberId = memberOfUid(uid);
    if (!memberId || !member(memberId)) continue;
    for (const [role, at] of Object.entries(roles)) {
      if (offerState(svc, role, uid) === 'pending') out.push({ svc, uid, memberId, role, at });
    }
  }
  return out.sort((x, y) => x.at - y.at);
}

export const allPendingOffers = () => upcoming().flatMap(offersFor);

function baseAvail() {
  const cur = S.avail[S.uid] || {};
  return { memberId: me().memberId, s: { ...(cur.s || {}) }, t: { ...(cur.t || {}) }, o: JSON.parse(JSON.stringify(cur.o || {})) };
}

async function toggleOffer(svc, role) {
  const doc = baseAvail();
  const mine = doc.o[svc.id] || (doc.o[svc.id] = {});
  const st = offerState(svc, role);
  if (st === 'pending') {
    delete mine[role];
    if (!Object.keys(mine).length) delete doc.o[svc.id];
    await putMine('avail', doc);
    toast('Предложение отменено');
    return;
  }
  mine[role] = Date.now();
  // Старые предложения к прошедшим служениям убираем, чтобы документ не рос.
  for (const sid of Object.keys(doc.o)) { const x = S.services.find(v => v.id === sid); if (!x || isDone(x)) delete doc.o[sid]; }
  await putMine('avail', doc);
  // Сообщить лидерам (лента + push). Если правила базы ещё старые — просто пропускаем.
  const to = (S.leaders || []).filter(u => u !== S.uid).map(u => 'u:' + u);
  if (to.length) {
    const who = me().member ? me().member.name : 'Участник';
    try {
      await put('feed', { at: Date.now(), kind: 'offer', title: `${who} предлагает себя: ${roleLabel(role)}`, body: `${svcLabel(svc)} · ${svcTitle(svc)}. Подтвердите в служении.`, to, serviceId: svc.id });
    } catch (e) { console.warn('offer notify', e); }
  }
  toast('Предложение отправлено лидеру');
}

function roleHint(svc, role) {
  if (!svc.published && !can('schedule')) return ADDS.has(role) ? 'Добавитесь к вокалу' : '';
  const occ = occupants(svc, role);
  if (!occ.length) return 'Место свободно';
  if (ADDS.has(role)) return 'Добавитесь к: ' + occ.map(personName).join(', ');
  return 'Вместо: ' + occ.map(personName).join(', ');
}

// Карточка на экране служения для участника.
export function offerCard(svc) {
  const M = me();
  if (!M.memberId || isDone(svc)) return null;
  const mine = Object.keys(myOffers(svc.id)).filter(r => offerState(svc, r) !== 'in');
  return h('section.card',
    h('div.card-h', h('div', h('h2.h2', 'Хотите служить?'), h('p.small.muted', 'Предложите себя — лидер подтвердит')), icon('flag', 22)),
    mine.length ? h('div.chips', mine.map(r => {
      const st = offerState(svc, r);
      return h('span.chip' + (st === 'rejected' ? '.no' : '.line'), roleLabel(r), st === 'rejected' ? ' · не принято' : ' · ждёт ответа');
    })) : null,
    h('button.btn.soft', { type: 'button', onclick: () => openOffer(svc) }, icon('plus', 18), mine.length ? 'Изменить предложение' : 'Предложить себя'));
}

export function openOffer(svc) {
  sheet('Предложить себя', (b, ctx) => {
    const M = me();
    const fresh = () => S.services.find(x => x.id === svc.id) || svc;
    const s = fresh();
    const myRoles = M.roles.length ? ROLES.filter(r => M.roles.includes(r.k)) : [];
    const others = ROLES.filter(r => !M.roles.includes(r.k));
    b.append(h('p.small.muted', `${svcLabel(s)} · ${svcTitle(s)}`));
    const row = r => {
      const st = offerState(s, r.k);
      return h('div.offer-row',
        h('div.grow', h('b', r.label), h('div.small.muted', st === 'in' ? 'Вы уже в составе' : st === 'rejected' ? 'Лидер не принял. Можно предложить снова' : roleHint(s, r.k))),
        st === 'in' ? h('span.chip.ok', icon('check', 12, 2.6), 'в составе')
          : h('button.btn.sm' + (st === 'pending' ? '.ghost' : ''), {
            type: 'button', id: 'offer-' + r.k,
            onclick: () => run(async () => { await toggleOffer(fresh(), r.k); ctx.paint(); }),
          }, st === 'pending' ? 'Отменить' : 'Предложить'));
    };
    if (myRoles.length) b.append(h('div.stack', myRoles.map(row)));
    if (others.length) {
      if (myRoles.length) b.append(h('p.eyebrow', { style: { marginTop: '6px' } }, 'Другие роли'));
      b.append(h('div.stack', others.map(row)));
    }
    b.append(h('p.hint', 'Вокалист добавляется к составу, музыкант — заменяет того, кто стоит. Окончательно решает лидер.'));
  });
}

// Принять предложение. replace: memberId/name-индекс того, кого заменить; null — добавить.
async function accept(o, replaceIdx) {
  const svc = S.services.find(x => x.id === o.svc.id) || o.svc;
  const team = JSON.parse(JSON.stringify(svc.team || {}));
  const arr = team[o.role] || (team[o.role] = []);
  let replaced = null;
  if (replaceIdx != null && arr[replaceIdx]) replaced = arr.splice(replaceIdx, 1, { memberId: o.memberId })[0];
  else if (!arr.some(p => p.memberId === o.memberId)) arr.push({ memberId: o.memberId });
  const offerDone = { ...(svc.offerDone || {}), [offerKey(o.uid, o.role)]: { at: Date.now(), ok: true } };
  await put('services', { ...svc, team, offerDone }, svc.id);
  const name = member(o.memberId).name;
  if (svc.published) {
    const label = `${svcLabel(svc)} · ${svcTitle(svc)}`;
    try {
      await put('feed', { at: Date.now(), title: `Вы в составе: ${roleLabel(o.role)}`, body: `${label}. Ваше предложение принято.`, to: [o.memberId], serviceId: svc.id });
      if (replaced && replaced.memberId && replaced.memberId !== o.memberId) {
        await put('feed', { at: Date.now(), title: `Изменение состава: ${svcLabel(svc)}`, body: `${roleLabel(o.role)}: вместо вас служит ${name}. ${svcTitle(svc)}.`, to: [replaced.memberId], serviceId: svc.id });
      }
    } catch (e) { console.warn(e); }
  }
  toast(replaced ? `${name} вместо ${personName(replaced)}` : `${name} добавлен(а) в состав`);
}

async function reject(o) {
  const svc = S.services.find(x => x.id === o.svc.id) || o.svc;
  await put('services', { ...svc, offerDone: { ...(svc.offerDone || {}), [offerKey(o.uid, o.role)]: { at: Date.now(), ok: false } } }, svc.id);
  if (svc.published) {
    try { await put('feed', { at: Date.now(), title: 'Предложение не принято', body: `${roleLabel(o.role)} · ${svcLabel(svc)}. Спасибо за готовность служить!`, to: [o.memberId], serviceId: svc.id }); } catch (e) { console.warn(e); }
  }
  toast('Отклонено');
}

function onAccept(o) {
  const svc = S.services.find(x => x.id === o.svc.id) || o.svc;
  const occ = occupants(svc, o.role);
  if (ADDS.has(o.role) || !occ.length) return run(() => accept(o, null));
  if (occ.length === 1) return run(() => accept(o, 0));
  // Несколько человек на роли — выбрать, кого заменить, или просто добавить.
  sheet('Кого заменить?', (b, ctx) => {
    b.append(h('p.small.muted', `${member(o.memberId).name} · ${roleLabel(o.role)}`),
      h('div.stack', occ.map((p, i) => h('button.btn.soft.block', { type: 'button', onclick: () => { ctx.close(); run(() => accept(o, i)); } }, 'Вместо: ' + personName(p)))),
      h('button.btn.ghost.block', { type: 'button', onclick: () => { ctx.close(); run(() => accept(o, null)); } }, icon('plus', 16), 'Добавить, никого не заменяя'));
  });
}

// Список предложений для лидера (на экране служения и на главной).
export function offersList(list, nav, showSvc) {
  return h('div.stack', list.map(o => {
    const m = member(o.memberId);
    const occ = occupants(o.svc, o.role);
    const what = ADDS.has(o.role) || !occ.length ? 'добавится' : occ.length === 1 ? 'вместо ' + personName(occ[0]) : 'вместо одного из ' + occ.length;
    const info = h('div.grow', { style: { minWidth: 0 } },
      h('div.ellip', h('b', m.name), ' · ', roleLabel(o.role)),
      h('div.small.muted.ellip', showSvc ? `${fmt.short(o.svc.date)} · ${what}` : what));
    return h('div.row.nowrap.offer-item',
      showSvc && nav
        ? h('button.row.nowrap.grow', { type: 'button', style: { textAlign: 'left', minWidth: 0, gap: '10px' }, onclick: () => nav.push('service', { id: o.svc.id }) }, avatar(m.name), info)
        : [avatar(m.name), info],
      h('button.iconbtn.sm.ok', { type: 'button', 'aria-label': 'Принять', onclick: () => onAccept(o) }, icon('check', 18, 2.4)),
      h('button.iconbtn.sm', { type: 'button', 'aria-label': 'Отклонить', onclick: () => run(() => reject(o)) }, icon('x', 18, 2.4)));
  }));
}
