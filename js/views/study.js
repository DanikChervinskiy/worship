// Духовное развитие: блоки уроков (например, «Лекции Лео Франка») и уроки со ссылками,
// конспект после просмотра, отметка «пройден».
// Блоки хранятся в той же коллекции lessons с kind: 'block', уроки ссылаются на блок через blockId.
import { S, put, del, putMine } from '../store.js';
import { h, icon, run, sheet, field, empty, bar, toast, confirmSheet, safeUrl } from '../ui.js';
import { myMemberId, nameOfUid, lessonsOnly, lessonBlocks, can } from '../model.js';
import { fmt, plural } from '../dates.js';

const byOrder = (a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title), 'ru');
const myNotes = () => (S.notes[S.uid] && S.notes[S.uid].lessons) || {};
const lessonsIn = blockId => lessonsOnly().filter(l => (l.blockId || '') === (blockId || '')).sort(byOrder);
const lessonsWord = n => plural(n, ['урок', 'урока', 'уроков']);
const nextOrder = list => list.reduce((m, x) => Math.max(m, x.order || 0), 0) + 1;

function progressBar(done, total) {
  const pct = total ? Math.round(done / total * 100) : 0;
  return h('div.progress', { role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100' }, h('span', { style: { width: pct + '%' } }));
}

function lessonRow(l, i, notes, nav) {
  const n = (l.links || []).length;
  return h('button.li', { type: 'button', onclick: () => nav.push('lesson', { id: l.id }) },
    h('span.li-ic', notes[l.id] ? icon('check', 20, 2.2) : h('span.mono', { style: { fontWeight: '700' } }, i + 1)),
    h('div.li-main', h('div.li-t', l.title), h('div.li-s', notes[l.id] ? `Пройден · ${fmt.stamp(notes[l.id].at)}` : n ? `${n} ${plural(n, ['материал', 'материала', 'материалов'])}` : 'Без ссылок')),
    icon('right', 18));
}

/* ——— главный экран раздела ——— */

export function render(el, p, nav) {
  const notes = myNotes();
  const all = lessonsOnly();
  const done = all.filter(l => notes[l.id]).length;
  const blocks = lessonBlocks();
  const loose = lessonsIn('');

  el.append(bar('Духовное развитие', nav, can('study') ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить', onclick: () => openAddChooser(nav) }, icon('plus', 20))] : []));

  if (all.length) {
    el.append(h('section.hero',
      h('div.hero-top',
        h('div', h('p.hero-k', 'Ваш путь'), h('p.hero-t', `${done} из ${all.length} ${lessonsWord(all.length)}`), h('p.hero-s', 'Посмотрите материалы и отправьте короткий конспект — урок отметится пройденным.')),
        h('div.ring', { style: { border: '6px solid var(--hero-line)', borderRadius: '50%' } }, h('div.ring-v', h('div', h('b', all.length ? Math.round(done / all.length * 100) : 0), h('span', '%')))))));
  }

  if (!all.length && !blocks.length) {
    el.append(h('div.list', empty('book', 'Уроков пока нет', can('study') ? 'Создайте блок — например, цикл лекций — и добавьте в него уроки со ссылками на видео.' : 'Лидер скоро добавит уроки.',
      can('study') ? h('div.row', { style: { justifyContent: 'center' } },
        h('button.btn', { type: 'button', onclick: () => openBlockEditor(nav) }, icon('plus', 18), 'Создать блок'),
        h('button.btn.ghost', { type: 'button', onclick: () => openLessonEditor() }, 'Отдельный урок')) : null)));
    return;
  }

  if (blocks.length) {
    el.append(h('div.sec-h', h('h2.h2', 'Блоки'), h('span.small.muted', blocks.length)));
    el.append(h('div.stack', blocks.map(b => {
      const ls = lessonsIn(b.id);
      const d = ls.filter(l => notes[l.id]).length;
      const complete = ls.length && d === ls.length;
      return h('button.card.block-card', { type: 'button', onclick: () => nav.push('block', { id: b.id }) },
        h('div.row.nowrap', { style: { alignItems: 'flex-start' } },
          h('span.li-ic', complete ? icon('check', 20, 2.2) : icon('book', 20)),
          h('div.grow',
            h('div.block-t', b.title),
            b.desc ? h('div.small.muted.clamp2', b.desc) : null),
          icon('right', 18)),
        h('div.row.nowrap', progressBar(d, ls.length), h('span.small.muted.mono', { style: { flex: 'none' } }, `${d}/${ls.length}`)));
    })));
  }

  if (loose.length) {
    el.append(h('div.sec-h', h('h2.h2', blocks.length ? 'Отдельные уроки' : 'Уроки')));
    el.append(h('div.list', loose.map((l, i) => lessonRow(l, i, notes, nav))));
  }
}

function openAddChooser(nav) {
  sheet('Добавить', (b, ctx) => {
    b.append(h('div.qa',
      h('button', { type: 'button', onclick: () => { ctx.close(); openBlockEditor(nav); } }, icon('book', 24), h('div', h('b', 'Блок уроков'), h('br'), h('small', 'Цикл лекций, курс, серия'))),
      h('button', { type: 'button', onclick: () => { ctx.close(); openLessonEditor(); } }, icon('play', 24), h('div', h('b', 'Урок'), h('br'), h('small', 'В блок или отдельно')))));
  });
}

/* ——— блок ——— */

export function renderBlock(el, { id }, nav) {
  const b = S.lessons.find(x => x.id === id && x.kind === 'block');
  if (!b) { el.append(bar('Блок', nav), h('div.list', empty('book', 'Блок не найден', 'Возможно, его удалили.'))); return; }
  const notes = myNotes();
  const ls = lessonsIn(id);
  const d = ls.filter(l => notes[l.id]).length;

  el.append(bar(b.title, nav, can('study') ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить блок', onclick: () => openBlockEditor(nav, b) }, icon('edit', 20))] : []));
  el.append(h('section.hero',
    h('div', h('p.hero-k', 'Блок уроков'), h('p.hero-t', b.title), b.desc ? h('p.hero-s', { style: { whiteSpace: 'pre-line' } }, b.desc) : null),
    h('div.row.nowrap', h('div.progress.on-hero', h('span', { style: { width: (ls.length ? Math.round(d / ls.length * 100) : 0) + '%' } })), h('span.mono', { style: { fontSize: '13px', flex: 'none' } }, `${d} из ${ls.length}`)),
    (() => {
      const next = ls.find(l => !notes[l.id]);
      return next ? h('div.row', h('button.btn.on-hero', { type: 'button', onclick: () => nav.push('lesson', { id: next.id }) }, icon('play', 16), d ? 'Продолжить' : 'Начать')) : null;
    })()));

  if (!ls.length) {
    el.append(h('div.list', empty('play', 'В блоке пока нет уроков', can('study') ? 'Добавьте первый урок со ссылкой на видео.' : null,
      can('study') ? h('button.btn', { type: 'button', onclick: () => openLessonEditor(null, id) }, icon('plus', 18), 'Добавить урок') : null)));
    return;
  }

  el.append(h('div.list', ls.map((l, i) => can('study')
    ? h('div.li', { style: { gridTemplateColumns: '1fr auto' } },
      h('div', { style: { minWidth: '0' } }, lessonRow(l, i, notes, nav)),
      h('div.reorder',
        h('button.iconbtn.flat', { type: 'button', 'aria-label': 'Выше', disabled: i === 0, onclick: () => swap(ls, i, i - 1) }, icon('up', 16)),
        h('button.iconbtn.flat', { type: 'button', 'aria-label': 'Ниже', disabled: i === ls.length - 1, onclick: () => swap(ls, i, i + 1) }, icon('down', 16))))
    : lessonRow(l, i, notes, nav))));

  if (can('study')) el.append(h('button.btn.soft', { type: 'button', onclick: () => openLessonEditor(null, id) }, icon('plus', 18), 'Добавить урок в блок'));
}

// Поменять два урока местами (порядок нумеруется заново, чтобы не было совпадений).
async function swap(list, i, j) {
  const arr = list.slice();
  [arr[i], arr[j]] = [arr[j], arr[i]];
  await run(async () => {
    for (let k = 0; k < arr.length; k++) if ((arr[k].order || 0) !== k + 1) await put('lessons', { ...arr[k], order: k + 1 }, arr[k].id);
  });
}

export function openBlockEditor(nav, existing) {
  const st = existing ? { title: existing.title, desc: existing.desc || '', quick: '' } : { title: '', desc: '', quick: '' };
  sheet(existing ? 'Изменить блок' : 'Новый блок уроков', (b, ctx) => {
    b.append(
      field('Название блока', h('input#bl-title', { value: st.title, placeholder: 'Например: Лекции Лео Франка', oninput: e => (st.title = e.target.value) })),
      field('Описание', h('textarea#bl-desc', { value: st.desc, rows: 3, placeholder: 'О чём этот цикл, для кого, как проходить', oninput: e => (st.desc = e.target.value) })),
      !existing ? field('Сразу добавить уроки (необязательно)', h('textarea#bl-quick', {
        value: st.quick, rows: 5, placeholder: 'Урок 1 | https://youtu.be/…\nУрок 2 | https://youtu.be/…',
        oninput: e => (st.quick = e.target.value),
      }), 'Каждый урок с новой строки: «Название | ссылка». Можно вставить и просто ссылки — названия будут «Урок 1», «Урок 2»…') : null,
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить блок', onclick: () => {
            const inside = lessonsIn(existing.id);
            confirmSheet('Удалить блок?', inside.length ? `Уроки из блока (${inside.length}) не удалятся — они станут отдельными уроками.` : 'Блок пустой, уроков в нём нет.', 'Удалить блок', async () => {
              ctx.close();
              if (await run(async () => {
                for (const l of inside) await put('lessons', { ...l, blockId: '' }, l.id);
                await del('lessons', existing.id);
              }, 'Блок удалён')) nav.back();
            });
          },
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            const title = st.title.trim();
            if (!title) return toast('Введите название блока');
            const doc = { kind: 'block', title, desc: st.desc.trim(), order: existing ? existing.order || 0 : nextOrder(lessonBlocks()) };
            if (existing && existing.demo) doc.demo = true;
            let id;
            const quick = parseQuick(st.quick);
            const ok = await run(async () => {
              id = await put('lessons', doc, existing && existing.id);
              for (let i = 0; i < quick.length; i++) await put('lessons', { title: quick[i].title || `Урок ${i + 1}`, desc: '', links: quick[i].url ? [{ title: 'Видео', url: quick[i].url }] : [], blockId: id, order: i + 1 });
            }, existing ? 'Сохранено' : quick.length ? `Блок создан, уроков: ${quick.length}` : 'Блок создан');
            if (ok) { ctx.close(); if (!existing) nav.push('block', { id }); }
          },
        }, existing ? 'Сохранить' : 'Создать блок')));
  }, { focus: !existing });
}

function parseQuick(text) {
  return String(text || '').split('\n').map(x => x.trim()).filter(Boolean).map(line => {
    const parts = line.split('|');
    if (parts.length > 1) return { title: parts[0].trim(), url: parts.slice(1).join('|').trim() };
    return /^https?:\/\/|^[\w-]+\.[\w.-]+\//i.test(line) ? { title: '', url: line } : { title: line, url: '' };
  });
}

/* ——— урок ——— */

export function renderLesson(el, { id }, nav) {
  const l = S.lessons.find(x => x.id === id && x.kind !== 'block');
  if (!l) { el.append(bar('Урок', nav), h('div.list', empty('book', 'Урок не найден'))); return; }
  const mine = myNotes()[id];
  const draftKey = 'wt.note.' + id;
  let text = mine ? mine.text : (localStorage.getItem(draftKey) || '');
  const block = l.blockId ? S.lessons.find(x => x.id === l.blockId && x.kind === 'block') : null;
  const siblings = block ? lessonsIn(block.id) : [];
  const pos = siblings.findIndex(x => x.id === id);
  const next = pos >= 0 ? siblings[pos + 1] : null;

  el.append(bar(l.title, nav, can('study') ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить урок', onclick: () => openLessonEditor(l) }, icon('edit', 20))] : []));
  el.append(h('section.card',
    block ? h('p.eyebrow', `${block.title} · урок ${pos + 1} из ${siblings.length}`) : null,
    mine ? h('span.chip.ok', { style: { alignSelf: 'flex-start' } }, icon('check', 14, 2.4), `Пройден · ${fmt.stamp(mine.at)}`) : null,
    l.desc ? h('p.pre', l.desc) : null,
    (l.links || []).length ? h('div.stack', l.links.map(k => safeUrl(k.url)
      ? h('a.li', { href: safeUrl(k.url), target: '_blank', rel: 'noopener noreferrer', style: { padding: '12px 0', textDecoration: 'none' } },
        h('span.li-ic', icon('play', 18)), h('div.li-main', h('div.li-t', k.title || 'Видео'), h('div.li-s.ellip', safeUrl(k.url))), icon('ext', 18))
      : h('div.li', { style: { padding: '12px 0' } }, h('span.li-ic', icon('book', 18)), h('div.li-main', h('div.li-t', k.title)), null)))
      : h('p.small.muted', 'Ссылок к уроку пока нет.')));

  el.append(h('section.card',
    h('h2.h2', mine ? 'Ваш конспект' : 'Конспект'),
    h('p.small.muted', 'После просмотра запишите главные мысли. Конспект увидит только лидер.'),
    h('textarea#lesson-note', {
      rows: 7, value: text, placeholder: 'Что вы поняли, что хотите применить…',
      oninput: e => { text = e.target.value; try { localStorage.setItem(draftKey, text); } catch { /* */ } },
    }),
    h('button.btn', {
      type: 'button', disabled: !S.uid, onclick: async () => {
        if (!text.trim()) return toast('Напишите хотя бы пару мыслей');
        const cur = S.notes[S.uid] || {};
        const lessons = { ...(cur.lessons || {}), [id]: { text: text.trim(), at: Date.now() } };
        if (await run(() => putMine('notes', { memberId: myMemberId(), lessons }), mine ? 'Конспект обновлён' : 'Отправлено. Урок пройден!')) {
          try { localStorage.removeItem(draftKey); } catch { /* */ }
        }
      },
    }, icon('send', 18), mine ? 'Обновить конспект' : 'Отправить и отметить пройденным')));

  if (next) el.append(h('button.btn.ghost.block', { type: 'button', onclick: () => nav.replace('lesson', { id: next.id }) }, `Следующий урок: ${next.title}`, icon('right', 18)));

  if (S.isLeader) {
    const all = Object.entries(S.notes).map(([uid, n]) => ({ uid, n: n.lessons && n.lessons[id] })).filter(x => x.n && x.uid !== S.uid);
    el.append(h('div.sec-h', h('h2.h2', 'Конспекты команды'), h('span.small.muted', all.length)));
    el.append(all.length ? h('div.stack', all.sort((a, b) => b.n.at - a.n.at).map(x => h('section.card.tight',
      h('div.row.between', h('b', nameOfUid(x.uid) || 'Участник'), h('span.small.muted.mono', fmt.stamp(x.n.at))),
      h('p.pre', x.n.text))))
      : h('div.list', empty('book', 'Конспектов пока нет', 'Когда кто-то пройдёт урок, его конспект появится здесь.')));
  }
}

export function openLessonEditor(existing, presetBlock) {
  const st = existing
    ? { title: existing.title, desc: existing.desc || '', blockId: existing.blockId || '', links: (existing.links || []).map(k => ({ ...k })) }
    : { title: '', desc: '', blockId: presetBlock || '', links: [{ title: '', url: '' }] };
  if (!st.links.length) st.links = [{ title: '', url: '' }];

  sheet(existing ? 'Изменить урок' : 'Новый урок', (b, ctx) => {
    const blocks = lessonBlocks();
    b.append(
      field('Название', h('input#ls-title', { value: st.title, placeholder: 'Например: Лекция 1. Что такое поклонение', oninput: e => (st.title = e.target.value) })),
      blocks.length ? field('Блок', h('select#ls-block', { value: st.blockId, onchange: e => (st.blockId = e.target.value) },
        h('option', { value: '' }, 'Без блока (отдельный урок)'),
        blocks.map(bl => h('option', { value: bl.id }, bl.title)))) : null,
      field('Описание и задание', h('textarea#ls-desc', { value: st.desc, rows: 4, placeholder: 'Что посмотреть, что прочитать, о чём подумать', oninput: e => (st.desc = e.target.value) })),
      h('div.fld', h('span', 'Ссылки'),
        h('div.stack', { style: { gap: '8px' } }, st.links.map((k, i) => h('div.link-row',
          h('input', { id: 'ls-lt-' + i, 'aria-label': 'Название ссылки', value: k.title || '', placeholder: 'Видео', oninput: e => (k.title = e.target.value) }),
          h('input', { id: 'ls-lu-' + i, 'aria-label': 'Адрес ссылки', type: 'url', inputmode: 'url', value: k.url || '', placeholder: 'https://youtu.be/…', oninput: e => (k.url = e.target.value) }),
          st.links.length > 1 ? h('button.iconbtn.flat', { type: 'button', 'aria-label': 'Убрать ссылку', onclick: () => { st.links.splice(i, 1); ctx.paint(); } }, icon('x', 16)) : h('span'))))),
      h('button.btn.sm.ghost', { type: 'button', style: { alignSelf: 'flex-start' }, onclick: () => { st.links.push({ title: '', url: '' }); ctx.paint(); } }, icon('plus', 16), 'Ещё ссылка'),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить урок', onclick: () => confirmSheet('Удалить урок?', 'Конспекты к нему останутся в базе, но урок пропадёт из списка.', 'Удалить', async () => { ctx.close(); await run(() => del('lessons', existing.id), 'Урок удалён'); }),
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите название');
            const links = st.links.map(k => ({ title: (k.title || '').trim() || 'Видео', url: (k.url || '').trim() })).filter(k => k.url || (k.title && k.title !== 'Видео'));
            const moved = existing && (existing.blockId || '') !== st.blockId;
            const order = existing && !moved ? existing.order || 0 : nextOrder(lessonsIn(st.blockId));
            const doc = { title: st.title.trim(), desc: st.desc, links, blockId: st.blockId, order };
            if (existing && existing.demo) doc.demo = true;
            if (await run(() => put('lessons', doc, existing && existing.id), existing ? 'Сохранено' : 'Урок добавлен')) ctx.close();
          },
        }, existing ? 'Сохранить' : 'Добавить')));
  }, { focus: !existing });
}
