// Духовное развитие: уроки со ссылками, конспект после просмотра, отметка «пройден».
import { S, put, del, putMine } from '../store.js';
import { h, icon, run, sheet, field, empty, bar, toast, confirmSheet, linkBtn, safeUrl } from '../ui.js';
import { myMemberId, nameOfUid } from '../model.js';
import { fmt } from '../dates.js';

const sorted = () => [...S.lessons].sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title), 'ru'));
const myNotes = () => (S.notes[S.uid] && S.notes[S.uid].lessons) || {};

export function render(el, p, nav) {
  const notes = myNotes();
  const list = sorted();
  const done = list.filter(l => notes[l.id]).length;
  el.append(bar('Духовное развитие', nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить урок', onclick: () => openLessonEditor() }, icon('plus', 20))] : []));

  if (list.length) {
    el.append(h('section.hero',
      h('div.hero-top',
        h('div', h('p.hero-k', 'Ваш путь'), h('p.hero-t', `${done} из ${list.length} уроков`), h('p.hero-s', 'Посмотрите материалы и отправьте короткий конспект — урок отметится пройденным.')),
        h('div.ring', { style: { border: '6px solid var(--hero-line)', borderRadius: '50%' } }, h('div.ring-v', h('div', h('b', list.length ? Math.round(done / list.length * 100) : 0), h('span', '%')))))));
  }

  el.append(list.length ? h('div.list', list.map((l, i) => h('button.li', { type: 'button', onclick: () => nav.push('lesson', { id: l.id }) },
    h('span.li-ic', notes[l.id] ? icon('check', 20, 2.2) : h('span.mono', { style: { fontWeight: '700' } }, i + 1)),
    h('div.li-main', h('div.li-t', l.title), h('div.li-s', notes[l.id] ? `Пройден · ${fmt.stamp(notes[l.id].at)}` : `${(l.links || []).length} ${(l.links || []).length === 1 ? 'материал' : 'материала'}`)),
    icon('right', 18))))
    : h('div.list', empty('book', 'Уроков пока нет', S.isLeader ? 'Добавьте первый урок: описание и ссылки на видео.' : 'Лидер скоро добавит уроки.',
      S.isLeader ? h('button.btn', { type: 'button', onclick: () => openLessonEditor() }, icon('plus', 18), 'Добавить урок') : null)));
}

export function renderLesson(el, { id }, nav) {
  const l = S.lessons.find(x => x.id === id);
  if (!l) { el.append(bar('Урок', nav), h('div.list', empty('book', 'Урок не найден'))); return; }
  const mine = myNotes()[id];
  const draftKey = 'wt.note.' + id;
  let text = mine ? mine.text : (localStorage.getItem(draftKey) || '');

  el.append(bar(l.title, nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить урок', onclick: () => openLessonEditor(l) }, icon('edit', 20))] : []));
  el.append(h('section.card',
    mine ? h('span.chip.ok', { style: { alignSelf: 'flex-start' } }, icon('check', 14, 2.4), `Пройден · ${fmt.stamp(mine.at)}`) : null,
    l.desc ? h('p.pre', l.desc) : null,
    (l.links || []).length ? h('div.stack', l.links.map(k => safeUrl(k.url)
      ? h('a.li', { href: safeUrl(k.url), target: '_blank', rel: 'noopener noreferrer', style: { padding: '12px 0', textDecoration: 'none' } },
        h('span.li-ic', icon('play', 18)), h('div.li-main', h('div.li-t', k.title || 'Материал'), h('div.li-s.ellip', safeUrl(k.url))), icon('ext', 18))
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

  if (S.isLeader) {
    const all = Object.entries(S.notes).map(([uid, n]) => ({ uid, n: n.lessons && n.lessons[id] })).filter(x => x.n && x.uid !== S.uid);
    el.append(h('div.sec-h', h('h2.h2', 'Конспекты команды'), h('span.small.muted', all.length)));
    el.append(all.length ? h('div.stack', all.sort((a, b) => b.n.at - a.n.at).map(x => h('section.card.tight',
      h('div.row.between', h('b', nameOfUid(x.uid) || 'Участник'), h('span.small.muted.mono', fmt.stamp(x.n.at))),
      h('p.pre', x.n.text))))
      : h('div.list', empty('book', 'Конспектов пока нет', 'Когда кто-то пройдёт урок, его конспект появится здесь.')));
  }
}

export function openLessonEditor(existing) {
  const st = existing ? { title: existing.title, desc: existing.desc || '', links: (existing.links || []).map(k => `${k.title} | ${k.url}`).join('\n') } : { title: '', desc: '', links: '' };
  sheet(existing ? 'Изменить урок' : 'Новый урок', (b, ctx) => {
    b.append(
      field('Название', h('input#ls-title', { value: st.title, oninput: e => (st.title = e.target.value) })),
      field('Описание и задание', h('textarea#ls-desc', { value: st.desc, placeholder: 'Что посмотреть, что прочитать, о чём подумать', oninput: e => (st.desc = e.target.value) })),
      field('Ссылки', h('textarea#ls-links', { value: st.links, placeholder: 'Название | https://…\nКаждая ссылка с новой строки', oninput: e => (st.links = e.target.value) }), 'Формат: «Название | ссылка», по одной в строке.'),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить урок', onclick: () => confirmSheet('Удалить урок?', 'Конспекты к нему останутся в базе, но урок пропадёт из списка.', 'Удалить', async () => { ctx.close(); await run(() => del('lessons', existing.id), 'Урок удалён'); }),
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите название');
            const links = st.links.split('\n').map(x => x.trim()).filter(Boolean).map(x => {
              const [a, ...rest] = x.split('|');
              const url = rest.length ? rest.join('|').trim() : (/^https?:/i.test(a.trim()) ? a.trim() : '');
              const title = rest.length || !url ? a.trim() : 'Видео';
              return { title, url };
            });
            const doc = { title: st.title.trim(), desc: st.desc, links, order: existing ? existing.order || 0 : S.lessons.length + 1 };
            if (existing && existing.demo) doc.demo = true;
            if (await run(() => put('lessons', doc, existing && existing.id), existing ? 'Сохранено' : 'Урок добавлен')) ctx.close();
          },
        }, existing ? 'Сохранить' : 'Добавить')));
  }, { focus: !existing });
}
