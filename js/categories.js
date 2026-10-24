// Категории песен: название и цвет. Создаёт и меняет лидер, фильтровать может каждый.
import { S, put, del } from './store.js';
import { h, icon, run, sheet, field, toast, confirmSheet, empty } from './ui.js';
import { categoriesSorted, CAT_COLORS, category } from './model.js';

export function catChip(c, extra = {}) {
  return h('span.chip.cat', { style: { '--cat': c.color || CAT_COLORS[8] }, ...extra }, h('span.cat-dot'), c.name);
}

export function songCats(s) {
  return (s.cats || []).map(category).filter(Boolean);
}

// Список категорий: изменить название и цвет, удалить, создать новую.
export function openCategories(onDone) {
  sheet('Категории', (b, ctx) => {
    const list = categoriesSorted();
    const repaint = () => setTimeout(ctx.paint, 120);
    b.append(
      h('p.small.muted', 'Нажмите на категорию, чтобы поменять название или цвет.'),
      list.length ? h('div.stack', { style: { gap: '6px' } }, list.map(c => h('div.cat-row',
        h('button.cat-row-main', { type: 'button', onclick: () => openCategoryEditor(c, repaint) },
          h('span.cat-swatch', { style: { background: c.color } }),
          h('div.li-main', h('div.li-t', c.name), h('div.li-s', `${S.songs.filter(s => (s.cats || []).includes(c.id)).length} ${songsWord(S.songs.filter(s => (s.cats || []).includes(c.id)).length)}`))),
        h('button.iconbtn.flat', { type: 'button', 'aria-label': `Изменить «${c.name}»`, onclick: () => openCategoryEditor(c, repaint) }, icon('edit', 18)),
        h('button.iconbtn.flat', { type: 'button', 'aria-label': `Удалить «${c.name}»`, onclick: () => confirmDelete(c, repaint) }, icon('trash', 18)))))
        : empty('tag', 'Категорий пока нет', 'Например: «Быстрые», «Поклонение», «Рождество», «Новые».'),
      h('button.btn', { type: 'button', onclick: () => openCategoryEditor(null, repaint) }, icon('plus', 18), 'Новая категория'));
  }, { onClose: onDone });
}

const songsWord = n => (n % 10 === 1 && n % 100 !== 11 ? 'песня' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'песни' : 'песен');

function confirmDelete(c, after) {
  confirmSheet('Удалить категорию?', `«${c.name}» пропадёт у всех песен. Сами песни останутся.`, 'Удалить', async () => {
    await run(async () => {
      for (const s of S.songs.filter(x => (x.cats || []).includes(c.id))) await put('songs', { ...s, cats: s.cats.filter(id => id !== c.id) }, s.id);
      await del('categories', c.id);
    }, 'Категория удалена');
    after && after(null);
  });
}

export function openCategoryEditor(existing, onSaved) {
  const st = existing ? { name: existing.name, color: existing.color } : { name: '', color: CAT_COLORS[S.categories.length % CAT_COLORS.length] };
  sheet(existing ? 'Категория' : 'Новая категория', (b, ctx) => {
    b.append(
      field('Название', h('input#cat-name', { value: st.name, placeholder: 'Например: Поклонение', maxlength: 30, oninput: e => { st.name = e.target.value; const pv = ctx.body.querySelector('.cat-preview .chip'); if (pv) pv.lastChild.textContent = st.name.trim() || 'Название'; } })),
      h('div.fld', h('span', 'Цвет'),
        h('div.swatches',
          CAT_COLORS.map(c => h('button.cat-swatch.lg', {
            type: 'button', 'aria-label': `Цвет ${c}`, 'aria-pressed': String(st.color.toLowerCase() === c.toLowerCase()), style: { background: c },
            onclick: () => { st.color = c; ctx.paint(); },
          }, st.color.toLowerCase() === c.toLowerCase() ? icon('check', 16, 2.6) : null)),
          h('label.cat-swatch.lg.custom', {
            title: 'Свой цвет', 'aria-pressed': String(!CAT_COLORS.some(c => c.toLowerCase() === st.color.toLowerCase())),
            style: CAT_COLORS.some(c => c.toLowerCase() === st.color.toLowerCase()) ? {} : { background: st.color },
          },
            icon('plus', 16, 2.4),
            h('input', { type: 'color', 'aria-label': 'Свой цвет', value: st.color, oninput: e => { st.color = e.target.value; ctx.paint(); } })))),
      h('div.fld', h('span', 'Так будет выглядеть'), h('div.cat-preview', catChip({ name: st.name.trim() || 'Название', color: st.color }))),
      h('div.btn-row',
        existing ? h('button.btn.ghost', { type: 'button', onclick: () => { ctx.close(); confirmDelete(existing, onSaved); } }, icon('trash', 18), 'Удалить') : null,
        h('button.btn', {
          type: 'button', onclick: async () => {
            const name = st.name.trim();
            if (!name) return toast('Введите название');
            let id;
            const doc = { name, color: st.color };
            if (existing && existing.demo) doc.demo = true;
            if (await run(async () => { id = await put('categories', doc, existing && existing.id); }, existing ? 'Сохранено' : 'Категория создана')) {
              ctx.close();
              onSaved && onSaved(id);
            }
          },
        }, existing ? 'Сохранить' : 'Создать')));
  }, { focus: !existing });
}
