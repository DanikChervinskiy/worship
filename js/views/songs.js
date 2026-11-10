// База песен: поиск и категории, карточка песни (основная тональность, транспонирование, каподастр,
// режимы показа, переводы, когда играли), редактор.
import { S, put, del } from '../store.js';
import { h, icon, run, sheet, field, seg, empty, bar, toast, confirmSheet, copyText, linkBtn, safeUrl } from '../ui.js';
import { me, songsSorted, song, MUSICIANS, categoriesSorted, songHistory, PART_ROLES, songParts, roleLabel, can } from '../model.js';
import { plural, fmt, daysBetween, today } from '../dates.js';
import { renderSong as renderText, transposeKey, semitones, prefersFlats, ALL_KEYS, keyChoices, lyricsOnly, convertChordsAbove } from '../chords.js';
import { capoControl, capoState } from '../capo.js';
import { LANGS, songTexts, pickLang, langSwitch, buildVersions } from '../langs.js';
import { catChip, songCats, openCategories, openCategoryEditor } from '../categories.js';

let q = '';
let catFilter = 'all';
const view = {}; // песня|тональность из служения → { mode, steps, v }

export function defaultMode(roles) {
  if (!roles || !roles.length) return 'both';
  return roles.some(r => MUSICIANS.has(r)) ? 'both' : 'lyrics';
}

// Тональность, в которой команда играет песню сейчас.
export const playKey = s => s.playKey || s.key || '';

function ago(date) {
  const d = daysBetween(date, today());
  if (d === 0) return 'сегодня';
  if (d === 1) return 'вчера';
  if (d < 7) return `${d} ${plural(d, ['день', 'дня', 'дней'])} назад`;
  const w = Math.round(d / 7);
  if (d < 60) return `${w} ${plural(w, ['неделю', 'недели', 'недель'])} назад`;
  const m = Math.round(d / 30);
  return `${m} ${plural(m, ['месяц', 'месяца', 'месяцев'])} назад`;
}

export function render(el, p, nav) {
  el.append(h('header.top',
    h('div.stack', { style: { gap: '6px' } }, h('p.eyebrow', 'База'), h('h1.display', 'Песни')),
    can('songs') ? h('div.top-actions',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Категории', onclick: openCategories }, icon('tag')),
      h('button.iconbtn', { type: 'button', 'aria-label': 'Добавить песню', onclick: () => openSongEditor(nav) }, icon('plus'))) : null));

  const cats = categoriesSorted();
  if (catFilter !== 'all' && !cats.some(c => c.id === catFilter)) catFilter = 'all';

  const listBox = h('div');
  const countBox = h('span.small.muted');
  const paint = () => {
    const t = q.trim().toLowerCase();
    const list = songsSorted()
      .filter(s => catFilter === 'all' || (s.cats || []).includes(catFilter))
      .filter(s => !t || [s.title, s.author, ...(s.versions || []).map(v => v.text)].join(' ').toLowerCase().includes(t));
    countBox.textContent = `${list.length} ${plural(list.length, ['песня', 'песни', 'песен'])}`;
    listBox.replaceChildren(list.length
      ? h('div.list', list.map(s => {
        const hist = songHistory(s.id);
        const sc = songCats(s);
        return h('button.li', { type: 'button', onclick: () => nav.push('song', { id: s.id }) },
          h('span.key-badge', playKey(s) || '—'),
          h('div.li-main',
            h('div.li-t', s.title),
            h('div.li-s.ellip', [s.author, hist.last ? `играли ${fmt.dayShort(hist.last.date)}` : 'ещё не играли'].filter(Boolean).join(' · ')),
            sc.length ? h('div.cat-dots', sc.map(c => h('span.cat-dot', { title: c.name, style: { '--cat': c.color } }))) : null),
          h('span.li-s.mono', [s.meter, s.bpm ? `${s.bpm}` : ''].filter(Boolean).join(' · ')));
      }))
      : h('div.list', S.songs.length
        ? empty('search', 'Ничего не нашлось', catFilter !== 'all' ? 'В этой категории таких песен нет.' : 'Попробуйте другое слово из названия или текста.')
        : empty('music', 'В базе пока нет песен', can('songs') ? 'Добавьте первую песню — со словами, аккордами и партиями.' : 'Лидер скоро добавит песни.',
          can('songs') ? h('button.btn', { type: 'button', onclick: () => openSongEditor(nav) }, icon('plus', 18), 'Добавить песню') : null)));
  };

  el.append(h('div.search', icon('search', 18), h('input#song-q', { type: 'search', placeholder: 'Название, автор или строчка из песни', value: q, oninput: e => { q = e.target.value; paint(); } })));
  if (cats.length || can('songs')) {
    el.append(h('div.filters',
      cats.length ? h('button.chip', { type: 'button', 'aria-pressed': String(catFilter === 'all'), onclick: () => { catFilter = 'all'; nav.refresh(); } }, 'Все') : null,
      cats.map(c => h('button.chip.cat', {
        type: 'button', style: { '--cat': c.color }, 'aria-pressed': String(catFilter === c.id),
        onclick: () => { catFilter = catFilter === c.id ? 'all' : c.id; nav.refresh(); },
      }, h('span.cat-dot'), c.name)),
      can('songs') ? h('button.chip.line', { type: 'button', onclick: () => openCategories() }, icon(cats.length ? 'edit' : 'plus', 14, 2.2), cats.length ? 'Изменить' : 'Категории') : null));
  }
  el.append(h('div.row.between', countBox, h('span.small.muted', 'тон · размер · темп')));
  el.append(listBox);
  paint();
}

export function renderSong(el, { id, key }, nav) {
  const s = song(id);
  if (!s) { el.append(bar('Песня', nav), h('div.list', empty('music', 'Песня не найдена', 'Возможно, её удалили из базы.'))); return; }
  const texts = songTexts(s);
  const main = playKey(s);
  const vkey = id + '|' + (key || '');
  const st = view[vkey] || (view[vkey] = { mode: defaultMode(me().roles), steps: semitones(s.key, key || main), lang: null });
  st.lang = pickLang(s, st.lang);

  el.append(bar(s.title, nav, can('songs') ? [h('button.iconbtn', { type: 'button', 'aria-label': 'Изменить песню', onclick: () => openSongEditor(nav, s) }, icon('edit', 20))] : []));

  const target = transposeKey(s.key, st.steps);
  const capo = capoState(s.id, target);
  const shown = capo.on ? capo.shape : target;
  const hist = songHistory(s.id);
  const sc = songCats(s);

  el.append(h('div.stack',
    (s.author || sc.length) ? h('div.row', { style: { gap: '8px' } }, s.author ? h('span.muted', s.author) : null, sc.map(c => catChip(c))) : null,
    h('div.meta-grid',
      h('div.meta', h('small', 'Тональность'), h('b', target || '—'), target !== main && main ? h('span.small.muted', ` · основная ${main}`) : null),
      h('div.meta', h('small', 'Размер'), h('b', s.meter || '—')),
      h('div.meta', h('small', 'Темп'), h('b', s.bpm ? `${s.bpm}` : '—'), s.bpm ? h('span.small.muted', ' BPM') : null)),
    h('div.note', icon('clock', 18), h('div',
      hist.last
        ? h('span', 'Последний раз на служении: ', h('b', `${fmt.short(hist.last.date)}`), ` (${ago(hist.last.date)})`, hist.count > 1 ? ` · всего ${hist.count} ${plural(hist.count, ['раз', 'раза', 'раз'])}` : '')
        : h('span', 'На служениях ещё не играли'),
      hist.next ? h('div', { style: { marginTop: '2px' } }, 'Следующий раз: ', h('b', fmt.short(hist.next.date))) : null))));

  const refresh = () => nav.refresh();
  el.append(h('section.card',
    seg([['both', 'Аккорды и слова'], ['lyrics', 'Слова'], ['chords', 'Аккорды']], st.mode, v => { st.mode = v; refresh(); }, '.full'),
    h('div.row.between',
      h('span.small.muted', 'Транспонировать'),
      h('div.transp',
        h('button', { type: 'button', 'aria-label': 'На полтона ниже', onclick: () => { st.steps = Math.max(-11, st.steps - 1); refresh(); } }, icon('minus', 18)),
        h('b', target || '—'),
        h('button', { type: 'button', 'aria-label': 'На полтона выше', onclick: () => { st.steps = Math.min(11, st.steps + 1); refresh(); } }, icon('plus', 18)))),
    can('songs') && target && target !== main ? h('button.btn.sm.soft', {
      type: 'button', style: { alignSelf: 'flex-end' },
      onclick: () => run(() => put('songs', { ...s, playKey: target }, s.id), `Теперь основная тональность — ${target}`),
    }, `Сделать ${target} основной`) : null,
    target ? capoControl(s.id, target, refresh) : null,
    h('div.row.between', h('span.small.muted', 'Язык'), langSwitch(s, st.lang, k => { st.lang = k; refresh(); }))));

  const parts = songParts(s).filter(([, u]) => safeUrl(u));
  if (parts.length) {
    const myRoles = me().roles;
    el.append(h('section.card',
      h('p.eyebrow', 'Партии'),
      h('div.parts', PART_ROLES.filter(k => parts.some(([r]) => r === k)).map(k => {
        const u = safeUrl(s.parts[k]);
        return h('a.part' + (myRoles.includes(k) ? '.mine' : ''), { href: u, target: '_blank', rel: 'noopener noreferrer' },
          icon('play', 16), h('span', roleLabel(k)), myRoles.includes(k) ? h('small', 'ваша') : null);
      }))));
  }

  if (s.arrangement || s.notes) {
    el.append(h('section.card',
      s.arrangement ? h('div', h('p.eyebrow', 'Порядок'), h('p.mono', { style: { marginTop: '4px' } }, s.arrangement)) : null,
      s.notes ? h('div', h('p.eyebrow', 'Заметки'), h('p.pre', { style: { marginTop: '4px' } }, s.notes)) : null));
  }

  el.append(h('div.row',
    safeUrl(s.youtube) ? linkBtn(safeUrl(s.youtube), 'YouTube') : null,
    h('button.btn.soft.sm', { type: 'button', onclick: () => copyText(lyricsOnly(texts[st.lang]), 'Текст скопирован') }, icon('copy', 16), 'Текст для проектора')));

  const text = texts[st.lang] || '';
  el.append(h('section.card',
    capo.on && st.mode !== 'lyrics' ? h('span.chip.ink', { style: { alignSelf: 'flex-start' } }, icon('capo', 14, 2), `Капо ${capo.fret} · формы ${capo.shape} · звучит ${target}`) : null,
    text.trim()
      ? renderText(text, { mode: st.mode, steps: st.steps - (capo.on ? capo.fret : 0), flats: prefersFlats(shown) })
      : h('p.muted', 'Текст ещё не добавлен.')));
}

export function openSongEditor(nav, existing) {
  const st = existing ? JSON.parse(JSON.stringify(existing)) : {
    title: '', author: '', key: 'G', playKey: '', bpm: '', meter: '4/4', youtube: '', arrangement: '', notes: '', cats: [],
    versions: [],
  };
  const texts = songTexts(st);
  let edLang = texts.uk.trim() || !texts.ru.trim() ? 'uk' : 'ru';
  st.cats = st.cats || [];
  st.parts = { ...(st.parts || {}) };
  if (!st.playKey) st.playKey = st.key || '';

  sheet(existing ? 'Изменить песню' : 'Новая песня', (b, ctx) => {
    const cats = categoriesSorted();
    b.append(
      field('Название', h('input#so-title', { value: st.title, placeholder: 'Название песни', oninput: e => (st.title = e.target.value) })),
      field('Автор', h('input#so-author', { value: st.author || '', placeholder: 'Автор или группа', oninput: e => (st.author = e.target.value) })),
      h('div.grid2',
        field('Аккорды записаны в', h('select#so-key', {
          value: st.key || '', onchange: e => { const was = st.key; st.key = e.target.value; if (!st.playKey || st.playKey === was) st.playKey = st.key; ctx.paint(); },
        }, h('option', { value: '' }, '—'), ALL_KEYS.map(k => h('option', { value: k }, k)))),
        field('Играем в (основная)', h('select#so-play', { value: st.playKey || '', disabled: !st.key, onchange: e => (st.playKey = e.target.value) },
          st.key ? keyChoices(st.key).map(k => h('option', { value: k }, k + (k === st.key ? ' (как записано)' : ''))) : h('option', { value: '' }, '—')))),
      h('p.hint', { style: { marginTop: '-6px' } }, 'Основная тональность открывается сразу в песне и подставляется в новые служения.'),
      h('div.grid2',
        field('Размер', h('select#so-meter', { value: st.meter || '4/4', onchange: e => (st.meter = e.target.value) }, ['4/4', '3/4', '6/8', '2/4', '12/8'].map(m => h('option', { value: m }, m)))),
        field('BPM', h('input#so-bpm', { type: 'number', inputmode: 'numeric', min: 30, max: 240, value: st.bpm || '', oninput: e => (st.bpm = e.target.value) }))),
      h('div.fld', h('div.row.between', h('span', 'Категории'), cats.length ? h('button.small', { type: 'button', style: { fontWeight: '600', color: 'var(--ink-2)' }, onclick: () => openCategories(() => setTimeout(ctx.paint, 120)) }, 'Изменить категории') : null),
        h('div.chips',
          cats.map(c => h('button.chip.cat', {
            type: 'button', style: { '--cat': c.color, height: '34px', padding: '0 12px', fontSize: '13px' }, 'aria-pressed': String(st.cats.includes(c.id)),
            onclick: () => { st.cats = st.cats.includes(c.id) ? st.cats.filter(x => x !== c.id) : [...st.cats, c.id]; ctx.paint(); },
          }, h('span.cat-dot'), c.name)),
          h('button.chip.line', {
            type: 'button', style: { height: '34px', padding: '0 12px', fontSize: '13px' },
            onclick: () => openCategoryEditor(null, id => { if (id && !st.cats.includes(id)) st.cats.push(id); setTimeout(ctx.paint, 150); }),
          }, icon('plus', 14, 2.2), 'Новая'))),
      field('Ссылка на YouTube', h('input#so-yt', { type: 'url', value: st.youtube || '', placeholder: 'https://youtube.com/…', oninput: e => (st.youtube = e.target.value) })),
      field('Порядок частей', h('input#so-arr', { value: st.arrangement || '', placeholder: 'К1 · П · К2 · П · Б · П', oninput: e => (st.arrangement = e.target.value) })),
      h('div.fld', h('span', 'Партии — ссылки на YouTube'),
        h('div.stack', { style: { gap: '8px' } }, PART_ROLES.map(k => h('label.part-row',
          h('span.part-k', roleLabel(k)),
          h('input', { id: 'so-part-' + k, type: 'url', inputmode: 'url', value: st.parts[k] || '', placeholder: 'https://youtu.be/…', oninput: e => (st.parts[k] = e.target.value) })))),
        h('small.hint', 'Музыкант увидит ссылку на свою партию на главном экране, когда песня стоит в его служении.')),
      field('Заметки', h('textarea#so-notes', { value: st.notes || '', placeholder: 'Динамика, кто начинает, особенности', oninput: e => (st.notes = e.target.value) })),
      h('div.divider'),
      h('div', h('b', 'Текст и аккорды'), h('p.hint', 'Аккорд пишется в квадратных скобках перед слогом: [G]Слава [C]Тебе. Части песни — строкой «Куплет 1:» или «# Припев». Если вставили текст с аккордами над строками, нажмите «Преобразовать».')),
      h('div.row.between',
        h('div.seg-ctl.lang-sw', { role: 'group', 'aria-label': 'Язык текста' }, LANGS.map(l => h('button', {
          type: 'button', 'aria-pressed': String(edLang === l.k), onclick: () => { edLang = l.k; ctx.paint(); },
        }, l.label, texts[l.k].trim() ? ' ✓' : ''))),
        h('span.small.muted', texts[edLang].trim() ? 'есть текст' : 'пусто — у песни будет неактивно')),
      h('textarea.code', { id: 'so-vt-' + edLang, value: texts[edLang], placeholder: edLang === 'uk' ? '[G]Слава [D]Тобі, [Em]Господь…' : '[G]Слава [D]Тебе, [Em]Господь…', spellcheck: 'false', oninput: e => (texts[edLang] = e.target.value) }),
      h('button.btn.sm.ghost', { type: 'button', onclick: () => { texts[edLang] = convertChordsAbove(texts[edLang]); ctx.paint(); toast('Аккорды перенесены в строки'); } }, 'Преобразовать аккорды над строками'),
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
              title: st.title.trim(), author: (st.author || '').trim(), key: st.key || '', playKey: st.playKey || st.key || '',
              meter: st.meter || '4/4', bpm: st.bpm ? Number(st.bpm) : '', youtube: (st.youtube || '').trim(),
              arrangement: st.arrangement || '', notes: st.notes || '',
              parts: Object.fromEntries(PART_ROLES.map(k => [k, (st.parts[k] || '').trim()]).filter(([, u]) => u)), cats: st.cats.filter(id => S.categories.some(c => c.id === id)),
              versions: buildVersions(texts),
              createdAt: st.createdAt || Date.now(),
              capo: st.capo || null,
            };
            if (existing && existing.demo) doc.demo = true;
            let id;
            const ok = await run(async () => { id = await put('songs', doc, existing && existing.id); }, existing ? 'Сохранено' : 'Песня добавлена');
            if (ok) { ctx.close(); if (!existing) nav.push('song', { id }); }
          },
        }, existing ? 'Сохранить' : 'Добавить')));
  }, { focus: !existing });
}
