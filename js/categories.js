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

// Список категорий с редактированием.
export function openCategories() {
  sheet('Категории', (b, ctx) => {
    const list = categoriesSorted();
    b.append(
      list.length ? h('div.stack', { style: { gap: '6px' } }, list.map(c => h('button.li', {
        type: 'button', style: { borderRadius: '14px', background: 'var(--surface-2)' },
        onclick: () => openCategoryEditor(c, () => setTimeout(ctx.paint, 120)),
      },
        h('span.cat-swatch', { style: { background: c.color } }),
        h('div.li-main', h('div.li-t', c.name), h('div.li-s', `${S.songs.filter(s => (s.cats || []).includes(c.id)).length} песен`)),
        icon('edit', 18))))
        : empty('tag', 'Категорий пока нет', 'Например: «Быстрые», «Поклонение», «Рождество», «Новые».'),
      h('button.btn', { type: 'button', onclick: () => openCategoryEditor(null, () => setTimeout(ctx.paint, 120)) }, icon('plus', 18), 'Новая категория'));
  });
}

export function openCategoryEditor(existing, onSaved) {
  const st = existing ? { name: existing.name, color: existing.color } : { name: '', color: CAT_COLORS[S.categories.length % CAT_COLORS.length] };
  sheet(existing ? 'Категория' : 'Новая категория', (b, ctx) => {
    b.append(
      field('Название', h('input#cat-name', { value: st.name, placeholder: 'Например: Поклонение', maxlength: 30, oninput: e => (st.name = e.target.value) })),
      h('div.fld', h('span', 'Цвет'),
        h('div.swatches', CAT_COLORS.map(c => h('button.cat-swatch.lg', {
          type: 'button', 'aria-label': `Цвет ${c}`, 'aria-pressed': String(st.color === c), style: { background: c },
          onclick: () => { st.color = c; ctx.paint(); },
        }, st.color === c ? icon('check', 16, 2.6) : null)))),
      h('div.btn-row',
        existing ? h('button.btn.ghost', {
          type: 'button', 'aria-label': 'Удалить категорию', onclick: () => confirmSheet('Удалить категорию?', `«${existing.name}» пропадёт у всех песен. Сами песни останутся.`, 'Удалить', async () => {
            ctx.close();
            await run(async () => {
              for (const s of S.songs.filter(x => (x.cats || []).includes(existing.id))) await put('songs', { ...s, cats: s.cats.filter(id => id !== existing.id) }, s.id);
              await del('categories', existing.id);
            }, 'Категория удалена');
            onSaved && onSaved(null);
          }),
        }, icon('trash', 18)) : null,
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
