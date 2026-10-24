// Каподастр: лидер или тот, у кого есть право «Песни и категории», выбирает формы аккордов (например, формы D).
// Настройка сохраняется в самой песне — у всей команды одинаково. Остальные видят её, но не меняют.
// Лад считается сам: песня звучит в F#, формы D → капо 4.
import { patch } from './store.js';
import { h, icon, sheet, run } from './ui.js';
import { transposeKey, semitones } from './chords.js';
import { song, can } from './model.js';

// Лад каподастра: насколько звучащая тональность выше формы (0–11).
export const fretFor = (target, shape) => ((semitones(shape, target) % 12) + 12) % 12;

export function capoState(songId, target) {
  const s = song(songId);
  const c = (s && s.capo) || null;
  if (!c || !c.shape || !target) return { on: false, saved: false, shape: '', fret: 0 };
  const fret = fretFor(target, c.shape);
  return { on: !!c.on && fret > 0, teamOn: !!c.on, saved: true, shape: c.shape, fret };
}

async function saveCapo(songId, capo) {
  const s = song(songId);
  if (!s) return;
  await run(() => patch('songs', songId, { capo }), capo && capo.shape ? 'Каподастр сохранён для всей команды' : 'Каподастр убран');
}

// Кнопка-переключатель и подпись. onChange вызывается после любого изменения.
export function capoControl(songId, target, onChange) {
  const st = capoState(songId, target);
  const label = !st.saved ? 'Каподастр…'
    : st.fret ? `Капо ${st.fret} · формы ${st.shape}` : `Формы ${st.shape} · без капо`;

  // Без права «Песни и категории» — только посмотреть настройку.
  if (!can('songs')) {
    if (!st.saved) return null;
    return h('div.capo',
      h('span.capo-btn', { 'aria-hidden': 'true', class: st.on ? 'is-on' : '' }, icon('capo', 18, 2)),
      h('span.capo-label', { style: { textDecoration: 'none' } }, st.on ? label : `${label} · выключен`));
  }

  const toggle = async () => {
    if (!st.saved) return openCapoChooser(songId, target, onChange);
    await saveCapo(songId, { shape: st.shape, on: !st.teamOn });
    onChange();
  };
  return h('div.capo',
    h('button.capo-btn', { type: 'button', 'aria-pressed': String(st.on), 'aria-label': st.on ? 'Выключить каподастр' : 'Включить каподастр', title: 'Каподастр', onclick: toggle }, icon('capo', 18, 2)),
    h('button.capo-label', { type: 'button', onclick: () => openCapoChooser(songId, target, onChange) }, label));
}

export function openCapoChooser(songId, target, onChange) {
  if (!can('songs')) return;
  const cur = capoState(songId, target);
  sheet('Каподастр', (b, ctx) => {
    b.append(
      h('p.small.muted', `Песня звучит в ${target}. Выберите формы аккордов — лад посчитается сам. Настройка сохранится в песне для всей команды.`),
      h('div.stack', { style: { gap: '6px' } },
        [1, 2, 3, 4, 5, 6, 7].map(fret => {
          const shape = transposeKey(target, -fret);
          const active = cur.saved && cur.shape === shape;
          return h('button.li', {
            type: 'button', style: { borderRadius: '14px', background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--bg)' : 'var(--ink)' },
            onclick: async () => { ctx.close(); await saveCapo(songId, { shape, on: true }); onChange(); },
          }, h('span.mono', { style: { fontWeight: '700', width: '56px' } }, `Капо ${fret}`), h('div.li-main', `формы ${shape}`), active ? icon('check', 18, 2.2) : null);
        })),
      cur.saved ? h('button.btn.ghost', { type: 'button', onclick: async () => { ctx.close(); await saveCapo(songId, null); onChange(); } }, 'Убрать каподастр') : null);
  });
}
