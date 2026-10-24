// Небольшие помощники интерфейса: создание элементов, иконки, шторки, уведомления.

export function h(sel, ...args) {
  const [tag, ...rest] = sel.split(/(?=[.#])/);
  const el = document.createElement(tag || 'div');
  for (const r of rest) r[0] === '.' ? el.classList.add(r.slice(1)) : (el.id = r.slice(1));
  let attrs = null;
  if (args[0] && typeof args[0] === 'object' && !(args[0] instanceof Node) && !Array.isArray(args[0])) attrs = args.shift();
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false || k === 'value') continue;
      if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'class') String(v).split(' ').filter(Boolean).forEach(c => el.classList.add(c));
      else if (k === 'style' && typeof v === 'object') for (const [sk, sv] of Object.entries(v)) { if (sk.startsWith('--')) el.style.setProperty(sk, sv); else el.style[sk] = sv; }
      else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  add(el, args);
  if (attrs && attrs.value != null) el.value = attrs.value;
  return el;
}
export function add(el, kids) {
  for (const k of kids) {
    if (k == null || k === false || k === true) continue;
    if (Array.isArray(k)) add(el, k);
    else Element.prototype.append.call(el, k instanceof Node ? k : document.createTextNode(String(k)));
  }
}

const ICONS = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  grid: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  calendar: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  music: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  bell: 'M6 16v-5a6 6 0 1 1 12 0v5l2 2H4zM10 21h4',
  left: 'M15 5l-7 7 7 7',
  right: 'M9 5l7 7-7 7',
  down: 'M12 5v14M6 13l6 6 6-6',
  up: 'M12 19V5M6 11l6-6 6 6',
  x: 'M6 6l12 12M18 6 6 18',
  check: 'M5 12.5l4.5 4.5L19 7',
  clock: 'M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  users: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20V3H6.5A2.5 2.5 0 0 0 4 5.5zM4 19.5A2.5 2.5 0 0 0 6.5 22H20v-5',
  list: 'M9 6h11M9 12h11M9 18h11M4.5 6h.01M4.5 12h.01M4.5 18h.01',
  mic: 'M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3zM19 11a7 7 0 0 1-14 0M12 18v3',
  msg: 'M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z',
  link: 'M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
  edit: 'M4 20h4L19 9l-4-4L4 16zM14 6l4 4',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  copy: 'M9 9h11v11H9zM5 15H4V4h11v1',
  send: 'M22 2 11 13M22 2l-7 20-4-9-9-4z',
  play: 'M7 4v16l13-8z',
  user: 'M20 21v-1a5 5 0 0 0-5-5H9a5 5 0 0 0-5 5v1M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  type: 'M4 7V5h16v2M9 19h6M12 5v14',
  wave: 'M2 12h2l2-6 3 12 3-14 3 16 3-10 2 2h2',
  sliders: 'M4 6h9M17 6h3M4 12h3M11 12h9M4 18h11M19 18h1M15 4v4M9 10v4M17 16v4',
  flag: 'M5 21V4M5 4h11l-2 4 2 4H5',
  heart: 'M12 20s-7-4.4-9-9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c-2 4.6-9 9-9 9z',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  cloud: 'M7 18a5 5 0 0 1-.6-10A6 6 0 0 1 18 9a4.5 4.5 0 0 1-.5 9z',
  ext: 'M14 4h6v6M20 4l-9 9M18 14v6H4V6h6',
  refresh: 'M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4',
  capo: 'M6 3v18M10 3v18M14 3v18M18 3v18M3 9h18v4H3z',
  tag: 'M3 12V4h8l10 10-8 8zM7.5 7.5h.01',
};

export function icon(name, size = 22, stroke = 1.8) {
  const NS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', stroke);
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(NS, 'path');
  p.setAttribute('d', ICONS[name] || ICONS.info);
  svg.append(p);
  return svg;
}

export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._tm);
  t._tm = setTimeout(() => t.classList.remove('show'), 2800);
}

export function errText(e) {
  if (e && e.message === 'offline') return 'Нет связи с базой. Изменение не сохранено.';
  if (e && e.message === 'noid') return 'Войдите в аккаунт, чтобы сохранять свои отметки.';
  if (e && (e.code === 'invalid_argument' || e.code === 'permission-denied')) return 'Недостаточно прав для этого действия.';
  if (e && e.code === 'quota_exceeded') return 'База заполнена. Удалите старые записи и повторите.';
  return 'Не удалось сохранить. Попробуйте ещё раз.';
}

export async function run(fn, okMsg) {
  try { await fn(); if (okMsg) toast(okMsg); return true; }
  catch (e) { console.error(e); toast(errText(e)); return false; }
}

// Нижняя шторка. build(body, ctx) рисует содержимое; ctx.paint() перерисовывает.
export function sheet(title, build, opts = {}) {
  const layer = document.getElementById('layer');
  const body = h('div.sheet-body');
  body.append = (...kids) => add(body, kids); // принимает массивы и пропускает пустые значения
  const titleEl = h('h2', title);
  let wrap;
  const close = () => {
    if (!wrap.isConnected) return;
    wrap.classList.add('closing');
    document.removeEventListener('keydown', esc);
    setTimeout(() => wrap.remove(), 170);
    opts.onClose && opts.onClose();
  };
  const esc = e => { if (e.key === 'Escape') close(); };
  const panel = h('div.sheet', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.sheet-head', titleEl, h('button.iconbtn', { type: 'button', onclick: close, 'aria-label': 'Закрыть' }, icon('x', 20))),
    body);
  wrap = h('div.sheet-wrap', h('div.sheet-back', { onclick: close }), panel);
  layer.append(wrap);
  document.addEventListener('keydown', esc);
  const ctx = {
    body, close, panel,
    setTitle: t => { titleEl.textContent = t; },
    paint: () => { const top = panel.scrollTop; body.replaceChildren(); build(body, ctx); panel.scrollTop = top; },
  };
  ctx.paint();
  const first = body.querySelector('input:not([type=checkbox]), textarea');
  if (first && opts.focus) setTimeout(() => first.focus(), 60);
  return ctx;
}

export function confirmSheet(title, text, okLabel, onOk) {
  sheet(title, (b, ctx) => {
    b.append(
      h('p.muted', text),
      h('div.btn-row',
        h('button.btn.ghost', { type: 'button', onclick: ctx.close }, 'Отмена'),
        h('button.btn.danger', { type: 'button', onclick: async () => { ctx.close(); await onOk(); } }, okLabel)));
  });
}

export function seg(options, value, onChange, cls = '') {
  return h('div.seg-ctl' + cls, { role: 'group' },
    options.map(([v, label]) => h('button', { type: 'button', 'aria-pressed': String(v === value), onclick: () => onChange(v) }, label)));
}

export function field(label, input, hint) {
  return h('label.fld', h('span', label), input, hint ? h('small.hint', hint) : null);
}

export function initials(name) {
  return String(name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
export function fill(el, ...kids) { el.replaceChildren(); add(el, kids); return el; }
export function avatar(name, cls = '') { return h('span.av' + cls, { title: name }, initials(name)); }

export function bar(title, nav, actions = []) {
  return h('header.bar',
    h('button.iconbtn.flat', { type: 'button', onclick: () => nav.back(), 'aria-label': 'Назад' }, icon('left')),
    h('h1.bar-t', title),
    h('div.bar-a', actions));
}

export function empty(iconName, title, text, action) {
  return h('div.empty', icon(iconName, 30, 1.6), h('p.empty-t', title), text ? h('p', text) : null, action || null);
}

export async function copyText(text, label = 'Скопировано') {
  try {
    await navigator.clipboard.writeText(text);
    toast(label);
  } catch {
    sheet('Скопируйте текст', b => {
      const ta = h('textarea', { readonly: true, rows: 12, value: text });
      b.append(h('p.muted.small', 'Выделите текст и скопируйте его вручную.'), ta);
      setTimeout(() => { ta.focus(); ta.select(); }, 80);
    });
  }
}

export function linkBtn(url, label, cls = '.btn.soft.sm') {
  return h('a' + cls, { href: url, target: '_blank', rel: 'noopener noreferrer' }, icon('ext', 16), label);
}

export const safeUrl = u => {
  const s = String(u || '').trim();
  if (!s) return '';
  if (/^https?:\/\//i.test(s)) return s;
  if (/^[\w-]+(\.[\w-]+)+/.test(s)) return 'https://' + s;
  return '';
};
