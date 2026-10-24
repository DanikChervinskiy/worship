// Режим служения: все песни подряд, листаешь вниз или жмёшь «Далее».
// Вокалисту по умолчанию — слова, музыканту — аккорды со словами. Каждую песню можно переключить.
import { ls } from '../store.js';
import { h, icon, sheet, seg, empty, bar, fill } from '../ui.js';
import { service, svcSongs, svcTitle, rolesIn, me } from '../model.js';
import { renderSong, transposeKey, semitones, prefersFlats } from '../chords.js';
import { fmt } from '../dates.js';
import { defaultMode } from './songs.js';
import { capoControl, capoState } from '../capo.js';
import { warmupList } from './warmups.js';

export function render(el, { id }, nav) {
  const s = service(id);
  if (!s) { el.append(bar('Режим служения', nav), h('div.list', empty('calendar', 'Служение не найдено'))); return; }
  document.body.classList.add('perform');

  const prefs = Object.assign({ fs: 1, m: {}, k: {}, v: {} }, ls.get('wt.perf') || {});
  const save = () => ls.set('wt.perf', prefs);
  const M = me();
  const roles = rolesIn(s, M.memberId);
  const defMode = defaultMode(roles.length ? roles : M.roles);
  const items = svcSongs(s);
  el.style.setProperty('--fs', prefs.fs);

  const counter = h('span', `1 / ${items.length}`);
  const setFs = d => { prefs.fs = Math.round(Math.min(1.8, Math.max(0.8, prefs.fs + d)) * 10) / 10; save(); el.style.setProperty('--fs', prefs.fs); };

  el.append(h('header.pbar',
    h('button.iconbtn.flat', { type: 'button', 'aria-label': 'Выйти из режима служения', onclick: () => nav.back() }, icon('x')),
    h('div.pbar-t', h('b', svcTitle(s)), h('span', `${fmt.short(s.date)} · `, counter)),
    h('div.bar-a',
      h('button.iconbtn', { type: 'button', 'aria-label': 'Распевки', onclick: openWarmups }, icon('mic', 20)),
      h('button.iconbtn', { type: 'button', 'aria-label': 'Мельче', onclick: () => setFs(-0.1) }, h('span', { style: { fontSize: '13px', fontWeight: '700' } }, 'A−')),
      h('button.iconbtn', { type: 'button', 'aria-label': 'Крупнее', onclick: () => setFs(0.1) }, h('span', { style: { fontSize: '17px', fontWeight: '700' } }, 'A+')))));

  if (!items.length) { el.append(h('div.list', empty('music', 'В служении нет песен'))); return; }

  const sections = items.map((x, i) => {
    const key = `${s.id}:${i}`;
    const sec = h('section.psong', { id: 'ps-' + i });
    const paint = () => {
      const versions = (x.song.versions && x.song.versions.length) ? x.song.versions : [{ label: 'Текст', text: '' }];
      const vi = Math.min(prefs.v[key] || 0, versions.length - 1);
      const baseKey = x.key || x.song.playKey || x.song.key;
      const targetKey = prefs.k[key] || baseKey;
      const steps = semitones(x.song.key, targetKey);
      const mode = prefs.m[key] || defMode;
      const capo = mode !== 'lyrics' ? capoState(x.song.id, targetKey) : { on: false, fret: 0 };
      const shiftKey = d => { prefs.k[key] = transposeKey(targetKey, d); save(); paint(); };
      fill(sec,
        h('div.psong-h',
          h('span.psong-n', i + 1),
          h('div', h('div.psong-t', x.song.title),
            h('div.small.muted.mono', [targetKey, x.song.meter, x.song.bpm ? `${x.song.bpm} BPM` : ''].filter(Boolean).join(' · ')))),
        h('div.psong-ctl',
          seg([['lyrics', 'Слова'], ['both', 'Акк + слова'], ['chords', 'Аккорды']], mode, v => { prefs.m[key] = v; save(); paint(); }),
          mode !== 'lyrics' ? h('div.transp',
            h('button', { type: 'button', 'aria-label': 'Ниже', onclick: () => shiftKey(-1) }, icon('minus', 16)),
            h('b', targetKey || '—'),
            h('button', { type: 'button', 'aria-label': 'Выше', onclick: () => shiftKey(1) }, icon('plus', 16))) : null,
          mode !== 'lyrics' && targetKey ? capoControl(x.song.id, targetKey, paint) : null,
          versions.length > 1 ? h('select', {
            'aria-label': 'Перевод', style: { width: 'auto', minHeight: '40px', fontSize: '14px' }, value: String(vi),
            onchange: e => { prefs.v[key] = Number(e.target.value); save(); paint(); },
          }, versions.map((v, k) => h('option', { value: String(k) }, v.label || `Версия ${k + 1}`))) : null),
        x.song.arrangement && mode !== 'lyrics' ? h('p.small.mono.muted', x.song.arrangement) : null,
        versions[vi].text.trim()
          ? renderSong(versions[vi].text, { mode, steps: steps - capo.fret * (capo.on ? 1 : 0), flats: prefersFlats(capo.on ? capo.shape : targetKey) })
          : h('p.muted', 'Текст ещё не добавлен.'));
    };
    paint();
    return sec;
  });
  el.append(...sections);

  const fab = h('button.next-fab', { type: 'button' });
  const current = () => {
    const y = 90;
    let idx = 0;
    sections.forEach((sec, i) => { if (sec.getBoundingClientRect().top <= y + 10) idx = i; });
    return idx;
  };
  const update = () => {
    const i = current();
    counter.textContent = `${i + 1} / ${items.length}`;
    const atEnd = i >= items.length - 1 && (window.innerHeight + window.scrollY >= document.body.scrollHeight - 40);
    fab.replaceChildren(...(i < items.length - 1
      ? [h('span', 'Далее'), icon('down', 20, 2.2)]
      : atEnd ? [icon('up', 20, 2.2), h('span', 'В начало')] : [h('span', 'Последняя'), icon('down', 20, 2.2)]));
    fab.dataset.target = i < items.length - 1 ? String(i + 1) : atEnd ? '0' : 'end';
  };
  fab.onclick = () => {
    const t = fab.dataset.target;
    if (t === 'end') window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    else sections[Number(t)].scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
  el.append(fab);
  update();
  const onScroll = () => requestAnimationFrame(update);
  window.addEventListener('scroll', onScroll, { passive: true });

  // Экран не гаснет, пока открыт режим служения (если браузер разрешает).
  let lock = null;
  const askLock = async () => { try { if (navigator.wakeLock && document.visibilityState === 'visible') lock = await navigator.wakeLock.request('screen'); } catch { lock = null; } };
  askLock();
  const onVis = () => { if (document.visibilityState === 'visible') askLock(); };
  document.addEventListener('visibilitychange', onVis);

  function openWarmups() {
    sheet('Распевки', b => b.append(warmupList('warmup')));
  }

  return () => {
    window.removeEventListener('scroll', onScroll);
    document.removeEventListener('visibilitychange', onVis);
    try { lock && lock.release(); } catch { /* */ }
    document.body.classList.remove('perform');
  };
}
