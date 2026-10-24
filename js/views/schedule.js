// Расписание: месяц по неделям, служения, репетиции, события, доступность, редакторы.
import { S, put, del } from '../store.js';
import { h, icon, run, sheet, field, seg, avatar, empty, bar, toast, confirmSheet } from '../ui.js';
import {
  me, servicesSorted, rolesIn, roleLabel, ROLES, ROLE, svcSongs, svcTitle, svcLabel, myAvail, setAvail, availOf,
  member, membersSorted, songsSorted, song, service, event, personName, teamMemberIds, teamPeople, notify, OPERATORS,
} from '../model.js';
import { fmt, weeksOfMonth, today, addDays, parse, nextWeekday, monthKey, plural, relDay, pad } from '../dates.js';
import { keyChoices } from '../chords.js';
import { openProjector } from '../projector.js';

let cur = (() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; })();
let onlyMine = false;

export function render(el, p, nav) {
  const M = me();
  const mk = `${cur.y}-${pad(cur.m + 1)}`;
  const list = servicesSorted().filter(s => monthKey(s.date) === mk);
  const monthName = fmt.month(cur.y, cur.m) + (cur.y !== new Date().getFullYear() ? ` ${cur.y}` : '');
  const shift = d => { const n = new Date(cur.y, cur.m + d, 1); cur = { y: n.getFullYear(), m: n.getMonth() }; nav.refresh(); window.scrollTo(0, 0); };
  const firstSunday = (() => { const f = `${mk}-01`; const s = nextWeekday(0, f); return s < today() && monthKey(today()) === mk ? nextWeekday(0) : s; })();

  el.append(h('header.top',
    h('div.stack', { style: { gap: '6px' } }, h('p.eyebrow', 'Расписание'), h('h1.display', 'Служения')),
    S.isLeader ? h('div.top-actions',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить событие', onclick: () => openEventEditor(nav) }, icon('star')),
      h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить служение', onclick: () => openServiceEditor(nav, null, { date: firstSunday }) }, icon('plus'))) : null));

  el.append(h('section.cal',
    h('div.cal-h',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Предыдущий месяц', onclick: () => shift(-1) }, icon('left')),
      h('h2', monthName),
      h('button.iconbtn', { type: 'button', 'aria-label': 'Следующий месяц', onclick: () => shift(1) }, icon('right'))),
    list.length
      ? h('div.strip', list.map(s => h('button', {
        type: 'button',
        class: [s.date === today() ? 'today' : '', s.published && rolesIn(s, M.memberId).length ? 'mine' : ''].join(' '),
        onclick: () => { const t = document.getElementById('svc-' + s.id); if (t) t.scrollIntoView({ behavior: 'smooth', block: 'center' }); },
      }, h('span', fmt.wd(s.date)), h('b', parse(s.date).getDate()))))
      : h('p.strip-empty', 'В этом месяце служений пока нет'),
    M.memberId ? seg([['all', 'Все служения'], ['mine', 'Где я участвую']], onlyMine ? 'mine' : 'all', v => { onlyMine = v === 'mine'; nav.refresh(); }, '.on-hero.full') : null));

  if (S.isLeader && list.length) {
    const drafts = list.filter(s => !s.published && s.date >= today()).length;
    el.append(h('div.note', icon('send', 18),
      h('div.grow', drafts ? `${drafts} ${plural(drafts, ['служение', 'служения', 'служений'])} без объявленного состава.` : 'Состав на месяц объявлен.',
        h('div', { style: { marginTop: '8px' } },
          h('button.btn.sm', { type: 'button', onclick: () => publishMonth(list, monthName) }, 'Уведомить команду о месяце')))));
  }

  const evs = S.events.filter(e => monthKey(e.start) === mk || monthKey(e.end || e.start) === mk);
  evs.forEach(e => el.append(h('button.card.tight.event-card', { type: 'button', style: { textAlign: 'left' }, onclick: () => nav.push('event', { id: e.id }) },
    h('div.row.nowrap', h('span.li-ic', icon('star', 20)),
      h('div.grow', h('p.eyebrow', 'Событие'), h('b', e.title), h('div.small.muted', rangeLabel(e))),
      icon('right', 18)))));

  if (!list.length) {
    el.append(h('div.list', empty('calendar', 'Служений нет', S.isLeader ? 'Добавьте первое служение на этот месяц.' : 'Расписание на этот месяц ещё не составлено.',
      S.isLeader ? h('button.btn', { type: 'button', onclick: () => openServiceEditor(nav, null, { date: firstSunday }) }, icon('plus', 18), 'Добавить служение') : null)));
    return;
  }

  for (const w of weeksOfMonth(cur.y, cur.m)) {
    const items = list.filter(s => s.date >= w.start && s.date <= w.end);
    if (!items.length) continue;
    const isNow = today() >= w.start && today() <= w.end;
    el.append(h('div.stack',
      h('div.week-h', h('span', isNow ? 'Эта неделя' : 'Неделя'), h('span.mono', `${fmt.dayShort(w.start)} — ${fmt.dayShort(w.end)}`)),
      items.map(s => svcCard(s, M, nav))));
  }
}

const rangeLabel = e => (e.end && e.end !== e.start ? `${fmt.dayShort(e.start)} — ${fmt.dayShort(e.end)}` : fmt.full(e.start));

export function svcCard(s, M, nav) {
  const myRoles = s.published ? rolesIn(s, M.memberId) : [];
  const st = myAvail(s.id);
  const cls = ['svc'];
  if (myRoles.length) cls.push('mine');
  if (st === 'yes') cls.push('ok');
  if (st === 'no') cls.push('no');
  if (s.date < today()) cls.push('past');
  if (onlyMine && !myRoles.length) cls.push('dim');
  const songs = svcSongs(s);
  const people = (s.published || S.isLeader) ? teamPeople(s) : [];
  return h('button', { class: cls.join(' '), id: 'svc-' + s.id, type: 'button', onclick: () => nav.push('service', { id: s.id }) },
    h('div.svc-date', h('b', parse(s.date).getDate()), h('span', fmt.wd(s.date))),
    h('div.svc-body',
      s.rehearsal ? h('span.reh', icon('clock', 13), `Репетиция · ${fmt.short(s.rehearsal.date)}, ${s.rehearsal.time}`) : null,
      h('div.svc-t', svcTitle(s)),
      h('div.svc-m', [s.time, songs.length ? `${songs.length} ${plural(songs.length, ['песня', 'песни', 'песен'])}` : 'песни не выбраны'].filter(Boolean).join(' · ')),
      h('div.svc-foot',
        people.length
          ? h('div.avs', people.slice(0, 5).map(p => avatar(personName(p))), people.length > 5 ? h('span.av', `+${people.length - 5}`) : null)
          : h('span.small.muted', s.published ? 'Состав не назначен' : 'Состав уточняется'),
        h('div.chips',
          !s.published && S.isLeader ? h('span.chip.line', 'Черновик') : null,
          myRoles.length ? h('span.chip.ink', myRoles.map(roleLabel).join(', ')) : null,
          st === 'yes' ? h('span.chip.ok', 'Смогу') : st === 'no' ? h('span.chip.no', 'Не смогу') : null))));
}

/* ——— Служение подробно ——— */

export function renderService(el, { id }, nav) {
  const s = service(id);
  if (!s) { el.append(bar('Служение', nav), h('div.list', empty('calendar', 'Служение не найдено', 'Возможно, его удалили.'))); return; }
  const M = me();
  const songs = svcSongs(s);
  const ev = s.eventId ? event(s.eventId) : null;
  const myRoles = s.published ? rolesIn(s, M.memberId) : [];

  el.append(bar(svcTitle(s), nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить', onclick: () => openServiceEditor(nav, s) }, icon('edit', 20))] : []));

  el.append(h('section.hero',
    h('div',
      h('p.hero-k', relDay(s.date) + (ev ? ` · ${ev.title}` : '')),
      h('p.hero-t', fmt.full(s.date)),
      h('p.hero-s', [s.time, svcTitle(s)].filter(Boolean).join(' · '))),
    (s.rehearsal || myRoles.length) ? h('div.chips',
      s.rehearsal ? h('span.chip', icon('clock', 14), `Репетиция · ${fmt.short(s.rehearsal.date)}, ${s.rehearsal.time}`) : null,
      myRoles.map(r => h('span.chip', 'Вы: ' + roleLabel(r)))) : null,
    h('div.row',
      h('button.btn.on-hero', { type: 'button', disabled: !songs.length, onclick: () => nav.push('perform', { id: s.id }) }, icon('play', 16), 'Режим служения'),
      h('button.btn.on-hero.ghost', { type: 'button', disabled: !songs.length, onclick: () => openProjector(s) }, icon('monitor', 16), 'Тексты'))));

  if (M.memberId && s.date >= today()) {
    const st = myAvail(s.id);
    el.append(h('section.card',
      h('div.card-h', h('h2.h2', 'Ваша доступность'), st ? h('span.chip.' + (st === 'yes' ? 'ok' : 'no'), st === 'yes' ? 'Отмечено: смогу' : 'Отмечено: не смогу') : h('span.small.muted', 'не отмечено')),
      h('div.grid2',
        h('button.av-btn.yes', { type: 'button', style: { height: '46px', justifyContent: 'center' }, 'aria-pressed': String(st === 'yes'), onclick: () => run(() => setAvail(s.id, 'yes')) }, icon('check', 16, 2.2), 'Смогу'),
        h('button.av-btn.no', { type: 'button', style: { height: '46px', justifyContent: 'center' }, 'aria-pressed': String(st === 'no'), onclick: () => run(() => setAvail(s.id, 'no')) }, icon('x', 16, 2.2), 'Не смогу'))));
  }

  if (s.note) el.append(h('div.note', icon('info', 18), h('span', s.note)));

  el.append(h('div.sec-h', h('h2.h2', 'Песни'), h('span.small.muted', songs.length ? `${songs.length} ${plural(songs.length, ['песня', 'песни', 'песен'])}` : '')));
  el.append(songs.length
    ? h('div.list', songs.map((x, i) => h('button.li', { type: 'button', onclick: () => nav.push('song', { id: x.songId, key: x.key }) },
      h('span.num', i + 1),
      h('div.li-main', h('div.li-t', x.song.title), h('div.li-s', [x.song.meter, x.song.bpm ? `${x.song.bpm} BPM` : '', x.song.author].filter(Boolean).join(' · '))),
      h('span.key-badge', x.key || x.song.playKey || x.song.key || '—'))))
    : h('div.list', empty('music', 'Песни не выбраны', S.isLeader ? 'Откройте редактор и добавьте песни из базы.' : null)));

  // Состав
  el.append(h('div.sec-h', h('h2.h2', 'Состав'), !s.published && S.isLeader ? h('span.chip.line', 'Черновик') : null));
  if (!s.published && !S.isLeader) {
    el.append(h('div.card', h('p.muted', 'Состав объявят позже. Пока можно отметить, сможете ли вы служить.')));
  } else {
    const rows = ROLES.filter(r => (s.team && s.team[r.k] || []).length).map(r => h('div.team-row',
      h('div.team-k', r.label),
      h('div.team-v', s.team[r.k].map(p => {
        const a = S.isLeader && p.memberId ? availOf(p.memberId, s.id) : null;
        const isMe = p.memberId && p.memberId === M.memberId;
        return h('span.chip' + (isMe ? '.ink' : a === 'no' ? '.no' : a === 'yes' ? '.ok' : ''), personName(p), a === 'no' ? ' · не сможет' : '');
      }))));
    el.append(h('section.card', rows.length ? rows : h('p.muted', 'Состав пока не назначен.')));
  }

  // Лидеру: кто отметился
  if (S.isLeader) {
    const yes = [], no = [];
    S.members.forEach(m => { const a = availOf(m.id, s.id); if (a === 'yes') yes.push(m.name); if (a === 'no') no.push(m.name); });
    el.append(h('section.card',
      h('h2.h2', 'Отметки команды'),
      h('div.team-row', h('div.team-k', 'Смогут'), h('div.team-v', yes.length ? yes.map(n => h('span.chip.ok', n)) : h('span.small.muted', 'пока никто'))),
      h('div.team-row', h('div.team-k', 'Не смогут'), h('div.team-v', no.length ? no.map(n => h('span.chip.no', n)) : h('span.small.muted', 'пока никто')))));

    el.append(h('section.card',
      h('h2.h2', 'Уведомления'),
      !s.published
        ? h('button.btn.block', { type: 'button', onclick: () => publishService(s) }, icon('send', 18), 'Объявить состав и уведомить')
        : h('button.btn.block.soft', { type: 'button', onclick: () => remindTeam(s) }, icon('bell', 18), 'Напомнить составу'),
      h('button.btn.block.ghost', { type: 'button', disabled: !songs.length, onclick: () => sendToOperators(s) }, icon('monitor', 18), 'Отправить список песен операторам'),
      h('p.hint', 'Уведомления появляются у команды в ленте на главном экране.')));
  }
}

async function publishService(s) {
  await run(async () => {
    await put('services', { ...s, published: true }, s.id);
    await notify(`Объявлен состав: ${svcLabel(s)}`, `${svcTitle(s)}. Откройте служение, чтобы увидеть песни и состав.`, 'all', s.id);
    for (const mid of teamMemberIds(s)) {
      await notify('Вы в составе служения', `${svcLabel(s)} · ${rolesIn(s, mid).map(roleLabel).join(', ')}`, [mid], s.id);
    }
  }, 'Состав объявлен');
}

async function remindTeam(s) {
  const ids = [...teamMemberIds(s)];
  if (!ids.length) return toast('В составе пока никого нет');
  const reh = s.rehearsal ? `Репетиция: ${fmt.short(s.rehearsal.date)}, ${s.rehearsal.time}. ` : '';
  await run(() => notify(`Напоминание: ${svcLabel(s)}`, `${reh}Служение: ${s.time || ''}. Песни: ${svcSongs(s).map(x => x.song.title).join(', ')}`, ids, s.id), 'Напоминание отправлено');
}

async function sendToOperators(s) {
  let ids = [...teamMemberIds(s)].filter(mid => rolesIn(s, mid).some(r => OPERATORS.has(r)));
  if (!ids.length) ids = S.members.filter(m => (m.roles || []).some(r => OPERATORS.has(r))).map(m => m.id);
  if (!ids.length) return toast('Нет участников с ролью «Звук» или «Компьютер»');
  const list = svcSongs(s).map((x, i) => `${i + 1}. ${x.song.title}`).join('\n');
  await run(() => notify(`Песни на ${svcLabel(s)}`, list + '\nТексты для проектора — в карточке служения.', ids, s.id), 'Список отправлен операторам');
}

function publishMonth(list, monthName) {
  confirmSheet('Уведомить команду?', `Все служения за ${monthName.toLowerCase()} будут объявлены вместе с составом, а команда получит уведомление в ленте.`, 'Уведомить', async () => {
    await run(async () => {
      for (const s of list.filter(x => !x.published)) await put('services', { ...s, published: true }, s.id);
      await notify(`Расписание на ${monthName.toLowerCase()} готово`, 'Проверьте, где вы служите, и отметьте, если не сможете.');
    }, 'Команда уведомлена');
  });
}

/* ——— Событие ——— */

export function renderEvent(el, { id }, nav) {
  const e = event(id);
  if (!e) { el.append(bar('Событие', nav), h('div.list', empty('star', 'Событие не найдено'))); return; }
  const M = me();
  const days = servicesSorted().filter(s => s.eventId === id);
  el.append(bar(e.title, nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить', onclick: () => openEventEditor(nav, e) }, icon('edit', 20))] : []));
  el.append(h('section.hero',
    h('div', h('p.hero-k', 'Событие'), h('p.hero-t', e.title), h('p.hero-s', rangeLabel(e))),
    e.note ? h('p.hero-s', e.note) : null,
    S.isLeader ? h('div.row', h('button.btn.on-hero', {
      type: 'button',
      onclick: () => {
        const last = days.length ? days[days.length - 1].date : null;
        const date = last ? (last < (e.end || e.start) ? addDays(last, 1) : last) : e.start;
        openServiceEditor(nav, null, { eventId: id, date, time: days.length ? days[days.length - 1].time : '18:00', title: `${e.title} · день ${days.length + 1}` });
      },
    }, icon('plus', 18), 'Добавить день')) : null));
  el.append(days.length ? h('div.stack', days.map(s => svcCard(s, M, nav)))
    : h('div.list', empty('calendar', 'Дни ещё не добавлены', S.isLeader ? 'Добавьте день — у каждого свой список песен и состав.' : null)));
}

export function openEventEditor(nav, existing) {
  const st = existing ? { ...existing } : { title: '', start: nextWeekday(5), end: addDays(nextWeekday(5), 1), note: '' };
  sheet(existing ? 'Изменить событие' : 'Новое событие', (b, ctx) => {
    b.append(
      field('Название', h('input#ev-title', { value: st.title, placeholder: 'Конференция, фестиваль…', oninput: e => (st.title = e.target.value) })),
      h('div.grid2',
        field('Начало', h('input#ev-start', { type: 'date', value: st.start, onchange: e => { st.start = e.target.value; if (!st.end || st.end < st.start) { st.end = st.start; ctx.paint(); } } })),
        field('Конец', h('input#ev-end', { type: 'date', value: st.end, onchange: e => (st.end = e.target.value) }))),
      field('Описание', h('textarea#ev-note', { value: st.note || '', placeholder: 'Место, сбор команды, особенности', oninput: e => (st.note = e.target.value) })),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', onclick: () => confirmSheet('Удалить событие?', 'Дни события тоже будут удалены из расписания.', 'Удалить', async () => {
            ctx.close();
            await run(async () => { for (const s of S.services.filter(x => x.eventId === existing.id)) await del('services', s.id); await del('events', existing.id); }, 'Событие удалено');
            nav.back();
          }),
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите название');
            if (!st.start) return toast('Укажите дату начала');
            let id;
            const ok = await run(async () => { id = await put('events', { title: st.title.trim(), start: st.start, end: st.end || st.start, note: st.note || '' }, existing && existing.id); }, existing ? 'Сохранено' : 'Событие создано');
            if (ok) { ctx.close(); if (!existing) nav.push('event', { id }); }
          },
        }, existing ? 'Сохранить' : 'Создать')));
  }, { focus: !existing });
}

/* ——— Редактор служения ——— */

export function openServiceEditor(nav, existing, preset = {}) {
  const isNew = !existing;
  const date0 = preset.date || nextWeekday(0);
  const st = existing ? JSON.parse(JSON.stringify(existing)) : {
    date: date0, time: preset.time || '10:00', title: preset.title || 'Воскресное служение',
    eventId: preset.eventId || '', rehearsal: { date: addDays(date0, -1), time: '18:00' },
    songs: [], team: {}, note: '', published: false,
  };
  let hasReh = !!st.rehearsal;
  if (!st.rehearsal) st.rehearsal = { date: addDays(st.date, -1), time: '18:00' };
  if (preset.eventId && !existing) st.rehearsal = { date: st.date, time: '16:30' };
  st.team = st.team || {};
  if (!st.songs.length) st.songs = [{ songId: '', key: '' }, { songId: '', key: '' }, { songId: '', key: '' }];
  const other = {};
  const before = existing ? teamMemberIds(existing) : new Set();
  const mark = mid => {
    if (!existing) return '';
    const a = availOf(mid, existing.id);
    return a === 'yes' ? '✓ ' : a === 'no' ? '✗ ' : '';
  };

  sheet(isNew ? 'Новое служение' : 'Изменить служение', (b, ctx) => {
    const songsList = songsSorted();
    b.append(
      h('div.grid2',
        field('Дата', h('input#se-date', {
          type: 'date', value: st.date, onchange: e => {
            const old = st.date; st.date = e.target.value;
            if (hasReh && st.rehearsal.date === addDays(old, -1)) { st.rehearsal.date = addDays(st.date, -1); ctx.paint(); }
          },
        })),
        field('Начало', h('input#se-time', { type: 'time', value: st.time, oninput: e => (st.time = e.target.value) }))),
      field('Название', h('input#se-title', { value: st.title, oninput: e => (st.title = e.target.value) })),
      S.events.length ? field('Событие', h('select#se-event', { value: st.eventId || '', onchange: e => (st.eventId = e.target.value) },
        h('option', { value: '' }, 'Обычное служение'),
        S.events.map(ev => h('option', { value: ev.id }, ev.title)))) : null,
      h('label.check', h('input#se-reh', { type: 'checkbox', checked: hasReh, onchange: e => { hasReh = e.target.checked; ctx.paint(); } }), h('span', h('b', 'Репетиция'))),
      hasReh ? h('div.grid2',
        field('Дата репетиции', h('input#se-rdate', { type: 'date', value: st.rehearsal.date, onchange: e => (st.rehearsal.date = e.target.value) })),
        field('Время', h('input#se-rtime', { type: 'time', value: st.rehearsal.time, oninput: e => (st.rehearsal.time = e.target.value) }))) : null,
      h('div.divider'),
      h('div.row.between',
        h('div', h('b', 'Песни'), h('div.small.muted', 'Сколько песен на служении')),
        h('div.transp',
          h('button', { type: 'button', 'aria-label': 'Меньше песен', onclick: () => { if (st.songs.length > 1) { st.songs.pop(); ctx.paint(); } } }, icon('minus', 18)),
          h('b', st.songs.length),
          h('button', { type: 'button', 'aria-label': 'Больше песен', onclick: () => { if (st.songs.length < 12) { st.songs.push({ songId: '', key: '' }); ctx.paint(); } } }, icon('plus', 18)))),
      !songsList.length ? h('p.hint', 'В базе пока нет песен — сначала добавьте их в разделе «Песни».') : null,
      st.songs.map((it, i) => {
        const sg = it.songId ? song(it.songId) : null;
        return h('div.slot',
          h('span.num', i + 1),
          h('select', {
            id: 'se-song-' + i, 'aria-label': `Песня ${i + 1}`, value: it.songId,
            onchange: e => { it.songId = e.target.value; const s2 = song(it.songId); it.key = s2 ? s2.playKey || s2.key || '' : ''; ctx.paint(); },
          }, h('option', { value: '' }, 'Выберите песню'), songsList.map(s2 => h('option', { value: s2.id }, s2.title))),
          h('select', {
            id: 'se-key-' + i, 'aria-label': 'Тональность', value: it.key || (sg ? sg.playKey || sg.key : ''), disabled: !sg,
            onchange: e => (it.key = e.target.value),
          }, sg ? keyChoices(sg.key).map(k => h('option', { value: k }, k + (k === (sg.playKey || sg.key) ? ' •' : ''))) : h('option', { value: '' }, '—')));
      }),
      h('div.divider'),
      h('div', h('b', 'Состав'), existing ? h('div.small.muted', '✓ — отметили «смогу», ✗ — «не смогу»') : null),
      ROLES.map(r => roleField(r, ctx)),
      h('div.divider'),
      field('Заметка для команды', h('textarea#se-note', { value: st.note || '', placeholder: 'Например: молитва команды в 9:30', oninput: e => (st.note = e.target.value) })),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить служение', onclick: () => confirmSheet('Удалить служение?', `${svcLabel(existing)} исчезнет из расписания у всей команды.`, 'Удалить', async () => {
            ctx.close();
            if (await run(() => del('services', existing.id), 'Служение удалено')) nav.back();
          }),
        }, icon('trash', 18)) : null,
        h('button.btn', { type: 'button', onclick: () => save(ctx) }, isNew ? 'Создать' : 'Сохранить')));
  });

  function roleField(r, ctx) {
    const arr = st.team[r.k] || (st.team[r.k] = []);
    const chosen = new Set(arr.map(p => p.memberId).filter(Boolean));
    const withRole = membersSorted().filter(m => (m.roles || []).includes(r.k) && !chosen.has(m.id));
    const others = membersSorted().filter(m => !(m.roles || []).includes(r.k) && !chosen.has(m.id));
    return h('div.stack', { style: { gap: '8px' } },
      h('div.row.between.nowrap',
        h('span.eyebrow', r.label),
        h('select', {
          id: 'se-role-' + r.k, 'aria-label': `Добавить: ${r.label}`, style: { width: 'auto', minHeight: '36px', fontSize: '14px' }, value: '',
          onchange: e => { const v = e.target.value; if (v === '__other') other[r.k] = ''; else if (v) arr.push({ memberId: v }); ctx.paint(); },
        },
          h('option', { value: '' }, '+ Добавить'),
          withRole.length ? h('optgroup', { label: r.label }, withRole.map(m => h('option', { value: m.id }, mark(m.id) + m.name))) : null,
          others.length ? h('optgroup', { label: 'Вся команда' }, others.map(m => h('option', { value: m.id }, mark(m.id) + m.name))) : null,
          h('option', { value: '__other' }, 'Другой человек…'))),
      arr.length ? h('div.chips', arr.map((p, idx) => h('span.chip.ink', (p.memberId ? mark(p.memberId) : '') + personName(p),
        h('button.chip-x', { type: 'button', 'aria-label': 'Убрать', onclick: () => { arr.splice(idx, 1); ctx.paint(); } }, icon('x', 12, 2.6))))) : null,
      other[r.k] != null ? h('div.row.nowrap',
        h('input', { id: 'se-other-' + r.k, placeholder: 'Имя (не из команды)', value: other[r.k], oninput: e => (other[r.k] = e.target.value) }),
        h('button.btn.sm', {
          type: 'button', onclick: () => { const n = (other[r.k] || '').trim(); if (n) arr.push({ name: n }); delete other[r.k]; ctx.paint(); },
        }, 'Добавить')) : null);
  }

  async function save(ctx) {
    if (!st.date) return toast('Укажите дату');
    const doc = {
      date: st.date, time: st.time || '', title: (st.title || '').trim() || 'Служение',
      kind: st.eventId ? 'event' : 'service', eventId: st.eventId || '',
      rehearsal: hasReh ? { date: st.rehearsal.date, time: st.rehearsal.time } : null,
      songs: st.songs.filter(x => x.songId).map(x => { const s2 = song(x.songId) || {}; return { songId: x.songId, key: x.key || s2.playKey || s2.key || '' }; }),
      team: {}, note: st.note || '', published: !!st.published,
    };
    if (existing && existing.demo) doc.demo = true;
    Object.entries(st.team).forEach(([k, arr]) => { if (arr && arr.length) doc.team[k] = arr.map(p => (p.memberId ? { memberId: p.memberId } : { name: p.name })); });
    let id;
    const ok = await run(async () => {
      id = await put('services', doc, existing && existing.id);
      if (existing && existing.published) {
        const after = teamMemberIds(doc);
        const label = svcLabel(doc);
        for (const mid of after) if (!before.has(mid)) await notify('Вы добавлены в служение', `${label} · ${rolesIn(doc, mid).map(roleLabel).join(', ')}`, [mid], id);
        for (const mid of before) if (!after.has(mid)) await notify('Вас сняли со служения', label, [mid], id);
      }
    }, isNew ? 'Служение создано' : 'Сохранено');
    if (ok) { ctx.close(); if (isNew) nav.push('service', { id }); }
  }
}
