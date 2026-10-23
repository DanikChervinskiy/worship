// База песен: поиск, карточка песни (транспонирование, режимы, переводы), редактор.
import { S, put, del } from '../store.js';
import { h, icon, run, sheet, field, seg, empty, bar, toast, confirmSheet, copyText, linkBtn, safeUrl } from '../ui.js';
import { me, songsSorted, song, MUSICIANS } from '../model.js';
import { plural } from '../dates.js';
import { renderSong as renderText, transposeKey, semitones, prefersFlats, ALL_KEYS, lyricsOnly, convertChordsAbove } from '../chords.js';

let q = '';
const view = {}; // id песни → { mode, steps, v }

export function defaultMode(roles) {
  if (!roles || !roles.length) return 'both';
  return roles.some(r => MUSICIANS.has(r)) ? 'both' : 'lyrics';
}

export function render(el, p, nav) {
  el.append(h('header.top',
    h('div.stack', { style: { gap: '6px' } }, h('p.eyebrow', 'База'), h('h1.display', 'Песни')),
    S.isLeader ? h('div.top-actions', h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить песню', onclick: () => openSongEditor(nav) }, icon('plus'))) : null));

  const listBox = h('div');
  const paint = () => {
    const t = q.trim().toLowerCase();
    const list = songsSorted().filter(s => !t || [s.title, s.author, ...(s.versions || []).map(v => v.text)].join(' ').toLowerCase().includes(t));
    listBox.replaceChildren(list.length
      ? h('div.list', list.map(s => h('button.li', { type: 'button', onclick: () => nav.push('song', { id: s.id }) },
        h('span.key-badge', s.key || '—'),
        h('div.li-main', h('div.li-t', s.title), h('div.li-s.ellip', s.author || ((s.versions || []).length > 1 ? `${s.versions.length} версии` : ''))),
        h('span.li-s.mono', [s.meter, s.bpm ? `${s.bpm}` : ''].filter(Boolean).join(' · ')))))
      : h('div.list', S.songs.length
        ? empty('search', 'Ничего не нашлось', 'Попробуйте другое слово из названия или текста.')
        : empty('music', 'В базе пока нет песен', S.isLeader ? 'Добавьте первую песню — со словами, аккордами и партиями.' : 'Лидер скоро добавит песни.',
          S.isLeader ? h('button.btn', { type: 'button', onclick: () => openSongEditor(nav) }, icon('plus', 18), 'Добавить песню') : null)));
  };
  el.append(h('div.search', icon('search', 18), h('input#song-q', { type: 'search', placeholder: 'Название, автор или строчка из песни', value: q, oninput: e => { q = e.target.value; paint(); } })));
  el.append(h('div.row.between', h('span.small.muted', `${S.songs.length} ${plural(S.songs.length, ['песня', 'песни', 'песен'])} в базе`),
    h('span.small.muted', 'тон · размер · темп')));
  el.append(listBox);
  paint();
}

export function renderSong(el, { id, key }, nav) {
  const s = song(id);
  if (!s) { el.append(bar('Песня', nav), h('div.list', empty('music', 'Песня не найдена', 'Возможно, её удалили из базы.'))); return; }
  const versions = (s.versions && s.versions.length) ? s.versions : [{ label: 'Текст', text: '' }];
  const st = view[id + '|' + (key || '')] || (view[id + '|' + (key || '')] = { mode: defaultMode(me().roles), steps: key ? semitones(s.key, key) : 0, v: 0 });
  if (st.v >= versions.length) st.v = 0;

  el.append(bar(s.title, nav, S.isLeader ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить песню', onclick: () => openSongEditor(nav, s) }, icon('edit', 20))] : []));

  const target = transposeKey(s.key, st.steps);
  const textBox = h('section.card');
  const paintText = () => {
    const tk = transposeKey(s.key, st.steps);
    textBox.replaceChildren(renderText(versions[st.v].text, { mode: st.mode, steps: st.steps, flats: prefersFlats(tk) }));
    if (!versions[st.v].text.trim()) textBox.replaceChildren(h('p.muted', 'Текст ещё не добавлен.'));
  };

  el.append(h('div.stack',
    s.author ? h('p.muted', s.author) : null,
    h('div.meta-grid',
      h('div.meta', h('small', 'Тональность'), h('b', target || '—'), st.steps && s.key ? h('span.small.muted', ` из ${s.key}`) : null),
      h('div.meta', h('small', 'Размер'), h('b', s.meter || '—')),
      h('div.meta', h('small', 'Темп'), h('b', s.bpm ? `${s.bpm}` : '—'), s.bpm ? h('span.small.muted', ' BPM') : null))));

  el.append(h('section.card',
    seg([['both', 'Аккорды и слова'], ['lyrics', 'Слова'], ['chords', 'Аккорды']], st.mode, v => { st.mode = v; nav.refresh(); }, '.full'),
    h('div.row.between',
      h('span.small.muted', 'Транспонировать'),
      h('div.transp',
        h('button', { type: 'button', 'aria-label': 'На полтона ниже', onclick: () => { st.steps = Math.max(-11, st.steps - 1); nav.refresh(); } }, icon('minus', 18)),
        h('b', target || '—'),
        h('button', { type: 'button', 'aria-label': 'На полтона выше', onclick: () => { st.steps = Math.min(11, st.steps + 1); nav.refresh(); } }, icon('plus', 18)))),
    versions.length > 1 ? h('div.row', h('span.small.muted', 'Перевод'), h('div.chips', versions.map((v, i) => h('button.chip', { type: 'button', 'aria-pressed': String(st.v === i), onclick: () => { st.v = i; nav.refresh(); } }, v.label || `Версия ${i + 1}`)))) : null));

  if (s.arrangement || s.notes) {
    el.append(h('section.card',
      s.arrangement ? h('div', h('p.eyebrow', 'Порядок'), h('p.mono', { style: { marginTop: '4px' } }, s.arrangement)) : null,
      s.notes ? h('div', h('p.eyebrow', 'Партии'), h('p.pre', { style: { marginTop: '4px' } }, s.notes)) : null));
  }

  el.append(h('div.row',
    safeUrl(s.youtube) ? linkBtn(safeUrl(s.youtube), 'YouTube') : null,
    h('button.btn.soft.sm', { type: 'button', onclick: () => copyText(lyricsOnly(versions[st.v].text), 'Текст скопирован') }, icon('copy', 16), 'Текст для проектора')));

  el.append(textBox);
  paintText();
}

export function openSongEditor(nav, existing) {
  const st = existing ? JSON.parse(JSON.stringify(existing)) : {
    title: '', author: '', key: 'G', bpm: '', meter: '4/4', youtube: '', arrangement: '', notes: '',
    versions: [{ label: 'Русский', text: '' }],
  };
  if (!st.versions || !st.versions.length) st.versions = [{ label: 'Русский', text: '' }];

  sheet(existing ? 'Изменить песню' : 'Новая песня', (b, ctx) => {
    b.append(
      field('Название', h('input#so-title', { value: st.title, placeholder: 'Название песни', oninput: e => (st.title = e.target.value) })),
      field('Автор', h('input#so-author', { value: st.author || '', placeholder: 'Автор или группа', oninput: e => (st.author = e.target.value) })),
      h('div.grid3',
        field('Тон', h('select#so-key', { value: st.key || '', onchange: e => (st.key = e.target.value) }, h('option', { value: '' }, '—'), ALL_KEYS.map(k => h('option', { value: k }, k)))),
        field('Размер', h('select#so-meter', { value: st.meter || '4/4', onchange: e => (st.meter = e.target.value) }, ['4/4', '3/4', '6/8', '2/4', '12/8'].map(m => h('option', { value: m }, m)))),
        field('BPM', h('input#so-bpm', { type: 'number', inputmode: 'numeric', min: 30, max: 240, value: st.bpm || '', oninput: e => (st.bpm = e.target.value) }))),
      field('Ссылка на YouTube', h('input#so-yt', { type: 'url', value: st.youtube || '', placeholder: 'https://youtube.com/…', oninput: e => (st.youtube = e.target.value) })),
      field('Порядок частей', h('input#so-arr', { value: st.arrangement || '', placeholder: 'К1 · П · К2 · П · Б · П', oninput: e => (st.arrangement = e.target.value) })),
      field('Партии', h('textarea#so-notes', { value: st.notes || '', placeholder: 'Вокальные партии, кто что играет, динамика', oninput: e => (st.notes = e.target.value) })),
      h('div.divider'),
      h('div', h('b', 'Текст и аккорды'), h('p.hint', 'Аккорд пишется в квадратных скобках перед слогом: [G]Слава [C]Тебе. Части песни — строкой «Куплет 1:» или «# Припев». Если вставили текст с аккордами над строками, нажмите «Преобразовать».')),
      st.versions.map((v, i) => h('div.stack', { style: { gap: '8px' } },
        h('div.row.nowrap',
          h('input', { id: 'so-vl-' + i, 'aria-label': 'Название версии', value: v.label || '', placeholder: 'Язык или перевод', oninput: e => (v.label = e.target.value) }),
          st.versions.length > 1 ? h('button.iconbtn', { type: 'button', 'aria-label': 'Удалить версию', onclick: () => { st.versions.splice(i, 1); ctx.paint(); } }, icon('trash', 18)) : null),
        h('textarea.code', { id: 'so-vt-' + i, value: v.text || '', placeholder: '[G]Слава [D]Тебе, [Em]Господь…', spellcheck: 'false', oninput: e => (v.text = e.target.value) }),
        h('button.btn.sm.ghost', { type: 'button', onclick: () => { v.text = convertChordsAbove(v.text); ctx.paint(); toast('Аккорды перенесены в строки'); } }, 'Преобразовать аккорды над строками'))),
      h('button.btn.soft', { type: 'button', onclick: () => { st.versions.push({ label: 'Перевод', text: '' }); ctx.paint(); } }, icon('plus', 18), 'Добавить перевод'),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить песню', onclick: () => confirmSheet('Удалить песню?', `«${existing.title}» исчезнет из базы. В прошлых служениях она перестанет отображаться.`, 'Удалить', async () => {
            ctx.close();
            if (await run(() => del('songs', existing.id), 'Песня удалена')) nav.back();
          }),
        }, icon('trash', 18)) : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            if (!st.title.trim()) return toast('Введите название');
            const doc = {
              title: st.title.trim(), author: (st.author || '').trim(), key: st.key || '', meter: st.meter || '4/4',
              bpm: st.bpm ? Number(st.bpm) : '', youtube: (st.youtube || '').trim(), arrangement: st.arrangement || '', notes: st.notes || '',
              versions: st.versions.map(v => ({ label: (v.label || '').trim() || 'Текст', text: v.text || '' })),
              createdAt: st.createdAt || Date.now(),
            };
            if (existing && existing.demo) doc.demo = true;
            let id;
            const ok = await run(async () => { id = await put('songs', doc, existing && existing.id); }, existing ? 'Сохранено' : 'Песня добавлена');
            if (ok) { ctx.close(); if (!existing) nav.push('song', { id }); }
          },
        }, existing ? 'Сохранить' : 'Добавить')));
  }, { focus: !existing });
}
