// Тексты для проектора: только слова, по порядку служения, с копированием.
import { h, icon, sheet, copyText } from './ui.js';
import { svcSongs, svcTitle } from './model.js';
import { lyricsOnly } from './chords.js';
import { fmt } from './dates.js';

export function openProjector(svc) {
  const items = svcSongs(svc);
  const pick = items.map(() => 0);
  const textOf = (x, i) => lyricsOnly(((x.song.versions || [])[pick[i]] || {}).text || '');
  sheet('Тексты для проектора', (b, ctx) => {
    b.append(h('p.small.muted', `${fmt.full(svc.date)} · ${svcTitle(svc)}`));
    if (!items.length) { b.append(h('p.muted', 'В этом служении пока нет песен.')); return; }
    b.append(h('button.btn.block', {
      type: 'button',
      onclick: () => copyText(items.map((x, i) => `${i + 1}. ${x.song.title}\n\n${textOf(x, i)}`).join('\n\n———\n\n'), 'Все тексты скопированы'),
    }, icon('copy', 18), 'Скопировать все тексты'));
    items.forEach((x, i) => {
      const versions = x.song.versions || [];
      b.append(h('div.proj',
        h('div.row.between.nowrap',
          h('b.grow.ellip', `${i + 1}. ${x.song.title}`),
          h('button.btn.sm.soft', { type: 'button', onclick: () => copyText(textOf(x, i), `«${x.song.title}» скопирована`) }, icon('copy', 16), 'Копировать')),
        versions.length > 1 ? h('div.chips', versions.map((v, k) => h('button.chip', {
          type: 'button', 'aria-pressed': String(pick[i] === k), onclick: () => { pick[i] = k; ctx.paint(); },
        }, v.label || `Версия ${k + 1}`))) : null,
        h('div.pre', textOf(x, i) || 'Текст не заполнен')));
    });
  });
}
