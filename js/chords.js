// Аккорды: формат ChordPro — аккорд в квадратных скобках перед слогом: "[G]Слава [C]Тебе".
// Заголовки частей: "# Припев", "{Припев}" или строка вида "Куплет 1:".
import { h } from './ui.js';

const SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_NAMES = ['Cm', 'C#m', 'Dm', 'Ebm', 'Em', 'Fm', 'F#m', 'Gm', 'G#m', 'Am', 'Bbm', 'Bm'];
const IDX = { C: 0, 'B#': 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4, Fb: 4, F: 5, 'E#': 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9, 'A#': 10, Bb: 10, Hb: 10, B: 11, H: 11, Cb: 11 };
const FLAT_KEYS = new Set(['F', 'Bb', 'Eb', 'Ab', 'Db', 'Gb', 'Dm', 'Gm', 'Cm', 'Fm', 'Bbm', 'Ebm']);

export const ALL_KEYS = [...MAJOR_NAMES, ...MINOR_NAMES];

const CHORD_RE = /^([A-H])([#b]?)([^/\s]*)(?:\/([A-H])([#b]?))?$/;
const QUAL_RE = /^(maj|min|dim|aug|sus|add|m|M|\d|\+|-|\(|\)|#|b|°|ø|\*)*$/;
const SECTION_RE = /^(куплет|припев|пред-?припев|бридж|мост|проигрыш|вступление|интро|кода|окончание|концовка|тэг|тег|verse|chorus|pre-?chorus|bridge|intro|outro|tag|interlude|instrumental)[\s\d.]*:?\s*$/i;

export function isChord(tok) {
  const m = CHORD_RE.exec(tok);
  return !!m && QUAL_RE.test(m[3]);
}

function rootIndex(key) {
  const m = /^([A-H])([#b]?)/.exec(key || '');
  return m ? IDX[m[1] + m[2]] : null;
}

export function semitones(fromKey, toKey) {
  const a = rootIndex(fromKey), b = rootIndex(toKey);
  if (a == null || b == null) return 0;
  let d = ((b - a) % 12 + 12) % 12;
  if (d > 6) d -= 12;
  return d;
}

export function transposeKey(key, steps) {
  const i = rootIndex(key);
  if (i == null) return key || '';
  const minor = /^[A-H][#b]?m(?!aj)/.test(key);
  const j = ((i + steps) % 12 + 12) % 12;
  return minor ? MINOR_NAMES[j] : MAJOR_NAMES[j];
}

export const prefersFlats = key => FLAT_KEYS.has(key) || /^[A-H]b/.test(key || '');

function shiftNote(n, acc, steps, flats) {
  const i = IDX[n + acc];
  if (i == null) return n + acc;
  const j = ((i + steps) % 12 + 12) % 12;
  return (flats ? FLAT : SHARP)[j];
}

export function transposeChord(ch, steps, flats) {
  if (!steps) return ch;
  const m = CHORD_RE.exec(ch);
  if (!m) return ch;
  let out = shiftNote(m[1], m[2], steps, flats) + m[3];
  if (m[4]) out += '/' + shiftNote(m[4], m[5], steps, flats);
  return out;
}

// Все 12 тональностей относительно исходной (для выпадающего списка).
export function keyChoices(baseKey) {
  if (!baseKey) return ALL_KEYS.slice(0, 12);
  const out = [];
  for (let s = -5; s <= 6; s++) out.push(transposeKey(baseKey, s));
  return out;
}

function sectionName(line) {
  const t = line.trim();
  let m = /^#\s*(.+)$/.exec(t); if (m) return m[1];
  m = /^\{\s*(.+?)\s*\}$/.exec(t); if (m) return m[1];
  if (SECTION_RE.test(t)) return t.replace(/:\s*$/, '');
  return null;
}

export function parseSong(text) {
  const out = [];
  for (const raw of String(text || '').replace(/\r/g, '').split('\n')) {
    if (!raw.trim()) { out.push({ type: 'blank' }); continue; }
    const sec = sectionName(raw);
    if (sec) { out.push({ type: 'section', text: sec }); continue; }
    const segs = [];
    const re = /\[([^\]]+)\]/g;
    let last = 0, chord = '', m;
    while ((m = re.exec(raw))) {
      const t = raw.slice(last, m.index);
      if (t || chord) segs.push({ c: chord, t });
      chord = m[1].trim();
      last = re.lastIndex;
    }
    segs.push({ c: chord, t: raw.slice(last) });
    out.push({ type: 'line', segs: segs.filter(s => s.c || s.t), hasChords: segs.some(s => s.c) });
  }
  return out;
}

// mode: 'both' | 'lyrics' | 'chords'
export function renderSong(text, { mode = 'both', steps = 0, flats = false } = {}) {
  const box = h('div.songtxt' + (mode === 'lyrics' ? '.lyrics' : ''));
  const lines = parseSong(text);
  let prevBlank = true;
  let pending = null; // заголовок части выводим, только если под ним есть что показать
  const flush = () => { if (pending) { box.append(h('div', h('span.sec', pending))); pending = null; } };
  for (const ln of lines) {
    if (ln.type === 'blank') {
      if (!prevBlank && !pending) box.append(h('div.gap'));
      prevBlank = true; continue;
    }
    if (ln.type === 'section') { pending = ln.text; prevBlank = true; continue; }
    const visible = mode === 'lyrics' ? ln.segs.some(s => s.t.trim()) : mode === 'chords' ? ln.hasChords : true;
    if (!visible) continue;
    flush();
    if (mode === 'lyrics') {
      const txt = ln.segs.map(s => s.t).join('').replace(/\s+$/, '');
      if (!txt.trim()) continue;
      box.append(h('div.ln.plain', txt.replace(/\s{2,}/g, ' ')));
    } else if (mode === 'chords') {
      if (!ln.hasChords) continue;
      box.append(h('div.chline', ln.segs.filter(s => s.c).map(s => transposeChord(s.c, steps, flats)).join('  ')));
    } else if (!ln.hasChords) {
      box.append(h('div.ln.plain', ln.segs.map(s => s.t).join('')));
    } else {
      box.append(h('div.ln', ln.segs.map(s => h('span.seg',
        h('span.c', s.c ? transposeChord(s.c, steps, flats) : ' '),
        h('span.t', s.t || ' ')))));
    }
    prevBlank = false;
  }
  return box;
}

// Текст для проектора: только слова и названия частей.
export function lyricsOnly(text) {
  const out = [];
  for (const ln of parseSong(text)) {
    if (ln.type === 'blank') { if (out.length && out[out.length - 1] !== '') out.push(''); continue; }
    if (ln.type === 'section') { if (out.length && out[out.length - 1] !== '') out.push(''); out.push(ln.text); continue; }
    const t = ln.segs.map(s => s.t).join('').replace(/\s{2,}/g, ' ').trim();
    if (t) out.push(t);
  }
  return out.join('\n').trim();
}

// Конвертер: аккорды над строками (как на сайтах с аккордами) → [G]формат.
export function convertChordsAbove(text) {
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  const isChordLine = l => { const toks = l.trim().split(/\s+/).filter(Boolean); return toks.length > 0 && toks.every(isChord); };
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (!isChordLine(l)) { out.push(l); continue; }
    const next = lines[i + 1];
    const chords = [];
    const re = /\S+/g; let m;
    while ((m = re.exec(l))) chords.push({ pos: m.index, c: m[0] });
    if (next != null && next.trim() && !isChordLine(next) && !sectionName(next)) {
      let lyric = next.padEnd(chords[chords.length - 1].pos, ' ');
      for (let k = chords.length - 1; k >= 0; k--) {
        const { pos, c } = chords[k];
        lyric = lyric.slice(0, pos) + `[${c}]` + lyric.slice(pos);
      }
      out.push(lyric.replace(/\s+$/, ''));
      i++;
    } else {
      out.push(chords.map(x => `[${x.c}]`).join(' '));
    }
  }
  return out.join('\n');
}
