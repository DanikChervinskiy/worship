// Справочники и выборки поверх хранилища.
import { S, put, del, putMine } from './store.js';
import { today, fmt } from './dates.js';

export const ROLES = [
  { k: 'vocal', label: 'Вокал' },
  { k: 'keys', label: 'Клавиши' },
  { k: 'guitar', label: 'Гитара' },
  { k: 'bass', label: 'Бас' },
  { k: 'drums', label: 'Барабаны' },
  { k: 'sound', label: 'Звук' },
  { k: 'media', label: 'Компьютер' },
];
export const ROLE = Object.fromEntries(ROLES.map(r => [r.k, r]));
export const roleLabel = k => (ROLE[k] ? ROLE[k].label : k === 'all' ? 'Все' : k);
export const MUSICIANS = new Set(['keys', 'guitar', 'bass', 'drums']);
export const OPERATORS = new Set(['sound', 'media']);

// Права, которые лидер может выдать участникам (вкладка «Настройки»).
export const PERMS = [
  { k: 'songs', label: 'Песни и категории', hint: 'Добавлять и менять песни, категории, предложенные песни' },
  { k: 'schedule', label: 'Расписание и состав', hint: 'Служения, события, состав, отметка «прошло», объявления о составе' },
  { k: 'notify', label: 'Сообщения команде', hint: 'Отправлять объявления в ленту и push' },
  { k: 'team', label: 'Команда и заявки', hint: 'Добавлять служителей, подтверждать заявки на вход' },
  { k: 'study', label: 'Духовное развитие', hint: 'Блоки и уроки' },
  { k: 'tasks', label: 'Задачи и распевки', hint: 'Создавать и менять задачи и упражнения' },
];
export const PERM = Object.fromEntries(PERMS.map(p => [p.k, p]));
export const can = p => S.isLeader || (S.perms || []).includes(p);

export const member = id => S.members.find(m => m.id === id);
export const song = id => S.songs.find(s => s.id === id);
export const service = id => S.services.find(s => s.id === id);
export const event = id => S.events.find(e => e.id === id);
// В коллекции lessons лежат и уроки, и блоки уроков (kind: 'block').
export const lessonsOnly = () => S.lessons.filter(l => l.kind !== 'block');
export const lessonBlocks = () => S.lessons.filter(l => l.kind === 'block').sort((a, b) => (a.order || 0) - (b.order || 0) || String(a.title).localeCompare(String(b.title), 'ru'));
export const category = id => S.categories.find(c => c.id === id);
export const categoriesSorted = () => [...S.categories].sort((a, b) => String(a.name).localeCompare(String(b.name), 'ru'));
// Цвета категорий: читаются и на светлой, и на тёмной теме.
export const CAT_COLORS = ['#E5484D', '#F76B15', '#E2A336', '#46A758', '#12A594', '#0090FF', '#6E56CF', '#D6409F', '#8B8D98'];

// Когда песню играли: последний раз, сколько всего и когда в следующий раз по расписанию.
export function songHistory(songId) {
  const t = today();
  const all = servicesSorted().filter(s => (s.songs || []).some(x => x.songId === songId));
  const past = all.filter(s => s.date <= t);
  return { last: past.length ? past[past.length - 1] : null, count: past.length, next: all.find(s => s.date > t) || null };
}

export const memberOfUid = uid => (S.links[uid] && S.links[uid].memberId) || (S.avail[uid] && S.avail[uid].memberId) || null;
export const myMemberId = () => (S.links[S.uid] && S.links[S.uid].memberId) || null;
export function me() {
  const memberId = myMemberId();
  const m = memberId ? member(memberId) : null;
  return { uid: S.uid, memberId: m ? memberId : null, member: m, roles: m ? m.roles || [] : [], isLeader: S.isLeader };
}

export const byName = (a, b) => String(a.name || a.title).localeCompare(String(b.name || b.title), 'ru');
export const membersSorted = () => [...S.members].sort(byName);
export const songsSorted = () => [...S.songs].sort((a, b) => a.title.localeCompare(b.title, 'ru'));
export const servicesSorted = () => [...S.services].sort((a, b) => (a.date + (a.time || '')).localeCompare(b.date + (b.time || '')));
// Служение считается прошедшим, если его отметили «прошло» или его день уже позади.
export const isDone = s => !!s.done || s.date < today();
export const upcoming = (from = today()) => servicesSorted().filter(s => s.date >= from && !s.done);

export function personName(p) {
  if (!p) return '—';
  if (p.memberId) { const m = member(p.memberId); return m ? m.name : 'Удалённый участник'; }
  return p.name || '—';
}
export function rolesIn(svc, memberId) {
  if (!svc || !memberId) return [];
  return Object.entries(svc.team || {}).filter(([, arr]) => (arr || []).some(p => p.memberId === memberId)).map(([k]) => k);
}
export const onTeam = (svc, memberId) => rolesIn(svc, memberId).length > 0;
export function teamMemberIds(svc) {
  const set = new Set();
  Object.values((svc && svc.team) || {}).forEach(arr => (arr || []).forEach(p => p.memberId && set.add(p.memberId)));
  return set;
}
export function teamPeople(svc) {
  const out = []; const seen = new Set();
  Object.values((svc && svc.team) || {}).forEach(arr => (arr || []).forEach(p => {
    const key = p.memberId || 'n:' + p.name;
    if (!seen.has(key)) { seen.add(key); out.push(p); }
  }));
  return out;
}

export const myAvail = sid => (S.avail[S.uid] && S.avail[S.uid].s && S.avail[S.uid].s[sid]) || null;
export function availOf(memberId, sid) {
  for (const [uid, a] of Object.entries(S.avail)) {
    if (memberOfUid(uid) === memberId && a.s && a.s[sid]) return a.s[sid];
  }
  return null;
}

export function svcSongs(svc) {
  return ((svc && svc.songs) || []).map(it => ({ ...it, song: song(it.songId) })).filter(x => x.song);
}
export const svcTitle = svc => svc.title || 'Служение';
export const svcLabel = svc => `${fmt.short(svc.date)}${svc.time ? ' · ' + svc.time : ''}`;

export function feedFor(memberId) {
  return S.feed
    .filter(f => f.to === 'all' || (Array.isArray(f.to) && memberId && f.to.includes(memberId)))
    .sort((a, b) => (b.at || 0) - (a.at || 0));
}

export function voteCounts() {
  const c = {};
  Object.values(S.votes).forEach(v => Object.entries((v && v.ids) || {}).forEach(([k, on]) => { if (on) c[k] = (c[k] || 0) + 1; }));
  return c;
}

export async function notify(title, body, to = 'all', serviceId = null) {
  await put('feed', { at: Date.now(), title, body: body || '', to, serviceId });
  // Старые уведомления (старше 120 дней) убираем, чтобы лента не разрасталась.
  const cutoff = Date.now() - 120 * 864e5;
  for (const f of S.feed.filter(f => (f.at || 0) < cutoff).slice(0, 20)) {
    try { await del('feed', f.id); } catch { /* не критично */ }
  }
}

// Отметка «смогу / не смогу». Повторное нажатие снимает отметку.
export async function setAvail(sid, status) {
  const cur = S.avail[S.uid] || {};
  const s = { ...(cur.s || {}) };
  const t = { ...(cur.t || {}) };
  if (s[sid] === status) { delete s[sid]; delete t[sid]; } else { s[sid] = status; t[sid] = Date.now(); }
  await putMine('avail', { memberId: myMemberId(), s, t });
}

// Последние ответы команды о доступности (для лидера).
export function recentAvail(limit = 6) {
  const out = [];
  for (const [uid, a] of Object.entries(S.avail)) {
    const mid = memberOfUid(uid);
    for (const [sid, st] of Object.entries((a && a.s) || {})) {
      const svc = service(sid);
      if (!svc || svc.date < today()) continue;
      out.push({ memberId: mid, sid, st, at: (a.t && a.t[sid]) || 0 });
    }
  }
  return out.sort((x, y) => y.at - x.at).slice(0, limit);
}

export function nameOfUid(uid) {
  const mid = memberOfUid(uid);
  const m = mid && member(mid);
  return m ? m.name : '';
}
