// Языки песни: украинский и русский варианты. Других вариантов нет.
// В базе песня хранит versions: [{ lang: 'uk', text }, { lang: 'ru', text }].
// У старых песен lang не записан — язык определяется по названию версии или по буквам (і, ї, є, ґ — украинский).
import { ls } from './store.js';
import { h } from './ui.js';

export const LANGS = [
  { k: 'uk', label: 'Укр', name: 'Украинский' },
  { k: 'ru', label: 'Рус', name: 'Русский' },
];

function guess(v) {
  const l = String(v.label || '').toLowerCase();
  if (/укр|україн|uk/.test(l)) return 'uk';
  if (/рус|рос|ru/.test(l)) return 'ru';
  return /[іїєґІЇЄҐ]/.test(v.text || '') ? 'uk' : 'ru';
}

// { uk: 'текст' | '', ru: 'текст' | '' }
export function songTexts(song) {
  const out = { uk: '', ru: '' };
  for (const v of (song && song.versions) || []) {
    let k = v.lang || guess(v);
    if (out[k]) k = k === 'uk' ? 'ru' : 'uk';   // два варианта одного языка — второй в свободное место
    if (!out[k]) out[k] = v.text || '';
  }
  return out;
}

export const hasLang = (song, k) => !!songTexts(song)[k].trim();

// Какой язык показать: выбранный раньше (общий для всех песен), если он есть у песни, иначе тот, что есть.
export function pickLang(song, wanted) {
  const t = songTexts(song);
  const pref = wanted || ls.get('wt.lang') || 'uk';
  if (t[pref] && t[pref].trim()) return pref;
  return LANGS.map(l => l.k).find(k => t[k].trim()) || pref;
}
export const rememberLang = k => ls.set('wt.lang', k);

// Переключатель «Укр | Рус»; язык без текста — серый и неактивный.
export function langSwitch(song, current, onChange, cls = '') {
  const t = songTexts(song);
  return h('div.seg-ctl.lang-sw' + cls, { role: 'group', 'aria-label': 'Язык песни' },
    LANGS.map(l => h('button', {
      type: 'button', 'aria-pressed': String(current === l.k), disabled: !t[l.k].trim(),
      title: t[l.k].trim() ? l.name : `${l.name} варианта нет`,
      onclick: () => { rememberLang(l.k); onChange(l.k); },
    }, l.label)));
}

// Собрать versions для сохранения.
export function buildVersions(texts) {
  return LANGS.filter(l => (texts[l.k] || '').trim()).map(l => ({ lang: l.k, label: l.label, text: texts[l.k] }));
}
