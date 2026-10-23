// Даты храним строками "YYYY-MM-DD", время — "HH:MM".
export const pad = n => String(n).padStart(2, '0');
export const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = s => { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, (m || 1) - 1, d || 1); };
export const today = () => toStr(new Date());
export const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return toStr(d); };
export const daysBetween = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);

const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const F = o => new Intl.DateTimeFormat('ru-RU', o);
const fDay = F({ day: 'numeric', month: 'long' });
const fDayShort = F({ day: 'numeric', month: 'short' });
const fWd = F({ weekday: 'short' });
const fWdLong = F({ weekday: 'long' });
const fMonth = F({ month: 'long' });
const fTime = F({ hour: '2-digit', minute: '2-digit' });

export const fmt = {
  day: s => fDay.format(parse(s)),                                   // 26 октября
  dayShort: s => fDayShort.format(parse(s)).replace('.', ''),        // 26 окт
  wd: s => fWd.format(parse(s)).replace('.', ''),                    // вс
  weekday: s => cap(fWdLong.format(parse(s))),                       // Воскресенье
  full: s => `${cap(fWdLong.format(parse(s)))}, ${fDay.format(parse(s))}`,
  short: s => `${cap(fWd.format(parse(s)).replace('.', ''))}, ${fDayShort.format(parse(s)).replace('.', '')}`,
  month: (y, m) => cap(fMonth.format(new Date(y, m, 1))),
  stamp: ms => { const d = new Date(ms); const s = toStr(d); const t = fTime.format(d); return s === today() ? `сегодня, ${t}` : `${fDayShort.format(d).replace('.', '')}, ${t}`; },
};

export function plural(n, [one, few, many]) {
  const a = Math.abs(n) % 100, b = a % 10;
  if (a > 10 && a < 20) return many;
  if (b > 1 && b < 5) return few;
  if (b === 1) return one;
  return many;
}

export function relDay(s) {
  const d = daysBetween(today(), s);
  if (d === 0) return 'Сегодня';
  if (d === 1) return 'Завтра';
  if (d === -1) return 'Вчера';
  if (d > 1) return `Через ${d} ${plural(d, ['день', 'дня', 'дней'])}`;
  return `${-d} ${plural(-d, ['день', 'дня', 'дней'])} назад`;
}

// Недели месяца (понедельник — воскресенье), только те, что пересекают месяц.
export function weeksOfMonth(y, m) {
  const first = new Date(y, m, 1);
  const shift = (first.getDay() + 6) % 7;
  let start = toStr(new Date(y, m, 1 - shift));
  const last = toStr(new Date(y, m + 1, 0));
  const weeks = [];
  while (start <= last) { weeks.push({ start, end: addDays(start, 6) }); start = addDays(start, 7); }
  return weeks;
}

export function monthKey(s) { return String(s).slice(0, 7); }

export function nextWeekday(dow, from = today()) {
  // dow: 0 = воскресенье
  const d = parse(from);
  const diff = (dow - d.getDay() + 7) % 7;
  return addDays(from, diff);
}
