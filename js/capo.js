// Каподастр: гитарист заранее выбирает, какими формами играет песню (например, формы D),
// а кнопка с каподастром переключает аккорды на эти формы. Лад считается сам:
// песня звучит в F#, формы D → каподастр на 4 ладу. Настройка своя у каждого (хранится на устройстве).
import { ls } from './store.js';
import { h, icon, sheet } from './ui.js';
import { transposeKey, semitones } from './chords.js';

const KEY = 'wt.capo';
const read = () => ls.get(KEY) || {};
const write = v => ls.set(KEY, v);

// Лад каподастра: насколько звучащая тональность выше формы (0–11).
export const fretFor = (target, shape) => ((semitones(shape, target) % 12) + 12) % 12;

// Текущее состояние для песни при звучащей тональности target.
export function capoState(songId, target) {
  const c = read()[songId];
  if (!c || !c.shape || !target) return { on: false, shape: '', fret: 0 };
  const fret = fretFor(target, c.shape);
  return { on: !!c.on && fret > 0, saved: true, shape: c.shape, fret };
}

export function setCapo(songId, patch) {
  const all = read();
  all[songId] = { ...(all[songId] || {}), ...patch };
  write(all);
}

// Кнопка-переключатель и подпись. onChange вызывается после любого изменения.
export function capoControl(songId, target, onChange) {
  const st = capoState(songId, target);
  const toggle = () => {
    if (!st.saved) return openCapoChooser(songId, target, onChange);
    setCapo(songId, { on: !st.on });
    onChange();
  };
  return h('div.capo',
    h('button.capo-btn', { type: 'button', 'aria-pressed': String(st.on), 'aria-label': st.on ? 'Выключить каподастр' : 'Включить каподастр', title: 'Каподастр', onclick: toggle }, icon('capo', 18, 2)),
    h('button.capo-label', { type: 'button', onclick: () => openCapoChooser(songId, target, onChange) },
      st.saved ? (st.fret ? `Капо ${st.fret} · формы ${st.shape}` : `Формы ${st.shape} · без капо`) : 'Каподастр…'));
}

export function openCapoChooser(songId, target, onChange) {
  const cur = capoState(songId, target);
  sheet('Каподастр', (b, ctx) => {
    b.append(
      h('p.small.muted', `Песня звучит в ${target}. Выберите, какими формами аккордов вы играете — лад посчитается сам.`),
      h('div.stack', { style: { gap: '6px' } },
        [1, 2, 3, 4, 5, 6, 7].map(fret => {
          const shape = transposeKey(target, -fret);
          const active = cur.saved && cur.shape === shape;
          return h('button.li', {
            type: 'button', style: { borderRadius: '14px', background: active ? 'var(--ink)' : 'var(--surface-2)', color: active ? 'var(--bg)' : 'var(--ink)' },
            onclick: () => { setCapo(songId, { shape, on: true }); ctx.close(); onChange(); },
          }, h('span.mono', { style: { fontWeight: '700', width: '56px' } }, `Капо ${fret}`), h('div.li-main', `формы ${shape}`), active ? icon('check', 18, 2.2) : null);
        })),
      cur.saved ? h('button.btn.ghost', { type: 'button', onclick: () => { setCapo(songId, { shape: '', on: false }); ctx.close(); onChange(); } }, 'Убрать каподастр') : null);
  });
}
